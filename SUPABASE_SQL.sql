-- ============================================================
-- RUN THIS IN THE SUPABASE SQL EDITOR BEFORE DEPLOYING CODE
-- ============================================================

-- Table 1: availability_blocks
CREATE TABLE IF NOT EXISTS availability_blocks (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id uuid        REFERENCES freelancers(id) ON DELETE CASCADE,
  block_type    text        NOT NULL,
  -- 'time_slot' | 'full_day' | 'full_week' | 'full_month'
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  label         text,
  service_id    uuid        REFERENCES services(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Freelancers manage own blocks" ON availability_blocks;
CREATE POLICY "Freelancers manage own blocks"
  ON availability_blocks FOR ALL
  USING (
    freelancer_id IN (
      SELECT id FROM freelancers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read blocks" ON availability_blocks;
CREATE POLICY "Public can read blocks"
  ON availability_blocks FOR SELECT
  USING (true);

-- Table 2: availability_settings
CREATE TABLE IF NOT EXISTS availability_settings (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id   uuid        REFERENCES freelancers(id) ON DELETE CASCADE UNIQUE,
  mode            text        NOT NULL DEFAULT 'calendar',
  -- 'available' | 'calendar'
  show_on_profile boolean     DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE availability_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Freelancers manage own settings" ON availability_settings;
CREATE POLICY "Freelancers manage own settings"
  ON availability_settings FOR ALL
  USING (
    freelancer_id IN (
      SELECT id FROM freelancers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read settings" ON availability_settings;
CREATE POLICY "Public can read settings"
  ON availability_settings FOR SELECT
  USING (true);

-- Add duration_minutes to services table
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- ============================================================
-- SECTION 2 — SECURITY HARDENING (2026-06-10)
-- Run everything below in the Supabase SQL editor BEFORE
-- deploying the matching code changes.
--
-- IMPORTANT: RLS policies are OR'd together. After running this,
-- open Authentication → Policies in the Supabase dashboard and
-- DELETE any old, more-permissive policies on messages,
-- message_replies, reviews and quotes that these replace.
-- ============================================================

-- ── 2.1 Reviews: tie each review to the authenticated author ──
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2.2 Quotes: first-class link from reply to quote ──
-- (replaces the '__QUOTE__<id>' magic string in reply bodies)
ALTER TABLE message_replies
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;

-- Backfill quote_id from legacy sentinel bodies
UPDATE message_replies
SET quote_id = substring(body from 10)::uuid
WHERE left(body, 9) = '__QUOTE__'
  AND quote_id IS NULL
  AND substring(body from 10) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ── 2.3 Cascade deletes ──
-- Deleting a freelancer (or a message thread) should remove child
-- rows automatically instead of relying on app code to clean up.
-- Constraint names below are the Supabase defaults
-- (<table>_<column>_fkey); adjust if yours differ.
ALTER TABLE services        DROP CONSTRAINT IF EXISTS services_freelancer_id_fkey;
ALTER TABLE services        ADD  CONSTRAINT services_freelancer_id_fkey
  FOREIGN KEY (freelancer_id) REFERENCES freelancers(id) ON DELETE CASCADE;

ALTER TABLE reviews         DROP CONSTRAINT IF EXISTS reviews_freelancer_id_fkey;
ALTER TABLE reviews         ADD  CONSTRAINT reviews_freelancer_id_fkey
  FOREIGN KEY (freelancer_id) REFERENCES freelancers(id) ON DELETE CASCADE;

ALTER TABLE messages        DROP CONSTRAINT IF EXISTS messages_freelancer_id_fkey;
ALTER TABLE messages        ADD  CONSTRAINT messages_freelancer_id_fkey
  FOREIGN KEY (freelancer_id) REFERENCES freelancers(id) ON DELETE CASCADE;

ALTER TABLE message_replies DROP CONSTRAINT IF EXISTS message_replies_message_id_fkey;
ALTER TABLE message_replies ADD  CONSTRAINT message_replies_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;

ALTER TABLE portfolio_items DROP CONSTRAINT IF EXISTS portfolio_items_freelancer_id_fkey;
ALTER TABLE portfolio_items ADD  CONSTRAINT portfolio_items_freelancer_id_fkey
  FOREIGN KEY (freelancer_id) REFERENCES freelancers(id) ON DELETE CASCADE;

ALTER TABLE service_images  DROP CONSTRAINT IF EXISTS service_images_service_id_fkey;
ALTER TABLE service_images  ADD  CONSTRAINT service_images_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;

-- ── 2.4 Row Level Security ──

-- messages: anyone may send (public contact form), but only the
-- two participants may read, update or delete a thread.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can send a message"        ON messages;
CREATE POLICY "Anyone can send a message"
  ON messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Participants can read messages"   ON messages;
CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    OR sender_user_id = auth.uid()
    OR (sender_email IS NOT NULL AND sender_email = auth.jwt()->>'email')
  );

DROP POLICY IF EXISTS "Participants can update messages" ON messages;
CREATE POLICY "Participants can update messages"
  ON messages FOR UPDATE
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    OR sender_user_id = auth.uid()
    OR (sender_email IS NOT NULL AND sender_email = auth.jwt()->>'email')
  );

DROP POLICY IF EXISTS "Freelancer can delete own threads" ON messages;
CREATE POLICY "Freelancer can delete own threads"
  ON messages FOR DELETE
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
  );

-- message_replies: visible only to thread participants.
ALTER TABLE message_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read replies"  ON message_replies;
CREATE POLICY "Participants can read replies"
  ON message_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_replies.message_id
        AND (
          m.freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
          OR m.sender_user_id = auth.uid()
          OR (m.sender_email IS NOT NULL AND m.sender_email = auth.jwt()->>'email')
        )
    )
  );

-- Insert stays open so logged-out clients can follow up on an
-- existing thread from the public contact form.
DROP POLICY IF EXISTS "Anyone can reply"               ON message_replies;
CREATE POLICY "Anyone can reply"
  ON message_replies FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authors can delete own replies" ON message_replies;
CREATE POLICY "Authors can delete own replies"
  ON message_replies FOR DELETE
  USING (sender_user_id = auth.uid());

-- reviews: public to read; writing requires a logged-in user who
-- claims their own user id. (The /api/reviews route uses the
-- service-role key and enforces stricter rules on top.)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read reviews"        ON reviews;
CREATE POLICY "Public can read reviews"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Logged-in users can write reviews" ON reviews;
CREATE POLICY "Logged-in users can write reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND author_user_id = auth.uid());

DROP POLICY IF EXISTS "Authors can delete own reviews" ON reviews;
CREATE POLICY "Authors can delete own reviews"
  ON reviews FOR DELETE
  USING (author_user_id = auth.uid());

-- quotes: visible to the issuing freelancer and the client it was
-- addressed to; only the freelancer can create/update.
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read quotes"   ON quotes;
CREATE POLICY "Participants can read quotes"
  ON quotes FOR SELECT
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    OR (client_email IS NOT NULL AND client_email = auth.jwt()->>'email')
  );

DROP POLICY IF EXISTS "Freelancers manage own quotes"  ON quotes;
CREATE POLICY "Freelancers manage own quotes"
  ON quotes FOR ALL
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
  );

-- ── 2.5 Public inquiry count for profile social proof ──
-- The profile page shows "N inquiries received" without exposing
-- the messages themselves. SECURITY DEFINER lets anon callers get
-- just the count.
CREATE OR REPLACE FUNCTION public.freelancer_message_count(f_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM messages WHERE freelancer_id = f_id
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_message_count(uuid) TO anon, authenticated;

-- ── 2.6 Storage policies (review in dashboard: Storage → Policies) ──
-- avatars bucket: object name must start with the uploader's uid
--   (the app uploads to '<uid>.<ext>').
-- portfolio bucket: first folder must equal the uploader's uid
--   (the app uploads to '<uid>/<random>.<ext>').
-- review-photos bucket: INSERT restricted to authenticated users.
-- Example policies:
--
-- CREATE POLICY "Users manage own avatar" ON storage.objects FOR ALL
--   USING (bucket_id = 'avatars' AND name LIKE auth.uid()::text || '.%')
--   WITH CHECK (bucket_id = 'avatars' AND name LIKE auth.uid()::text || '.%');
--
-- CREATE POLICY "Users manage own portfolio" ON storage.objects FOR ALL
--   USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text)
--   WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
--
-- CREATE POLICY "Logged-in users upload review photos" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'review-photos' AND auth.role() = 'authenticated');

-- ============================================================
-- SECTION 3 — SAVED PROFESSIONALS + QUOTE RESPONSES (2026-06-11)
-- Run before deploying the saved-professionals / quotes-page code.
-- ============================================================

-- ── 3.1 Saved professionals (client favourites) ──
CREATE TABLE IF NOT EXISTS saved_professionals (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  freelancer_id uuid        NOT NULL REFERENCES freelancers(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, freelancer_id)
);

ALTER TABLE saved_professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved list" ON saved_professionals;
CREATE POLICY "Users manage own saved list"
  ON saved_professionals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 3.2 Clients can accept/decline quotes addressed to them ──
DROP POLICY IF EXISTS "Clients can respond to quotes" ON quotes;
CREATE POLICY "Clients can respond to quotes"
  ON quotes FOR UPDATE
  USING (client_email IS NOT NULL AND client_email = auth.jwt()->>'email');

-- ── 3.3 Verified badge column ──
-- The "✓ Vetted" badge in the UI reads freelancers.verified, but the
-- column never existed, so the badge never rendered. Adding it makes
-- the badge system real. Mark a freelancer verified (after the manual
-- checks in the admin panel checklist) with:
--   UPDATE freelancers SET verified = true WHERE id = '<freelancer-id>';
ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- ============================================================
-- SECTION 4 — PUSH NOTIFICATIONS (2026-06-11)
-- Run before deploying the web-push code.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL UNIQUE,
  subscription jsonb       NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SECTION 5 — PHASE 3 GROWTH TOOLS (2026-06-12)
-- Run before deploying analytics / featured listings / category pages.
-- ============================================================

-- ── 5.1 Profile view analytics ──
CREATE TABLE IF NOT EXISTS profile_views (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id uuid        NOT NULL REFERENCES freelancers(id) ON DELETE CASCADE,
  viewed_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_freelancer_time
  ON profile_views (freelancer_id, viewed_at DESC);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can record a view…
DROP POLICY IF EXISTS "Anyone can record a profile view" ON profile_views;
CREATE POLICY "Anyone can record a profile view"
  ON profile_views FOR INSERT
  WITH CHECK (true);

-- …but only the profile owner can read their analytics.
DROP POLICY IF EXISTS "Freelancers read own view analytics" ON profile_views;
CREATE POLICY "Freelancers read own view analytics"
  ON profile_views FOR SELECT
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
  );

-- ── 5.2 Featured listings ──
-- Admin-controlled flag: featured freelancers lead the homepage
-- carousel and carry a badge in search. Toggle from the admin panel.
ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- ============================================================
-- SECTION 6 — CLIENT PROFILES (2026-06-12)
-- Run before deploying the client-profiles code.
-- ============================================================

-- ── 6.1 Client profile rows ──
-- Visible to freelancers the client has contacted; public only when
-- the client opts in (is_public).
CREATE TABLE IF NOT EXISTS client_profiles (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  is_public    boolean     DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients manage own profile" ON client_profiles;
CREATE POLICY "Clients manage own profile"
  ON client_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Contacted freelancers or public can view client profiles" ON client_profiles;
CREATE POLICY "Contacted freelancers or public can view client profiles"
  ON client_profiles FOR SELECT
  USING (
    is_public
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM messages m
      JOIN freelancers f ON f.id = m.freelancer_id
      WHERE m.sender_user_id = client_profiles.user_id
        AND f.user_id = auth.uid()
    )
  );

-- ── 6.2 Link freelancer→client reviews to the client's account ──
-- (legacy rows keyed only by typed name stay display-only, as agreed)
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_client_user
  ON reviews (client_user_id) WHERE client_user_id IS NOT NULL;

-- ============================================================
-- SECTION 7 — INVOICES + EARNINGS (2026-06-12)
-- Run before deploying the earnings/invoice code.
--
-- Quote lifecycle becomes:
--   sent → accepted → invoiced → completed → paid   (declined terminal)
-- A quote and an invoice are legally distinct documents: the invoice
-- gets its own number, issue date and payment terms, set when the
-- freelancer sends it after acceptance.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_number   text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoiced_at      timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_terms    text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_due_date date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS completed_at     timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS paid_at          timestamptz;

-- ============================================================
-- SECTION 8 — CLIENT-SIDE UNREAD TRACKING (2026-06-12)
-- Run before deploying the header-badge fix.
--
-- messages.read tracks the FREELANCER's unread state; client_read
-- tracks the CLIENT's. Freelancer replies/quotes set it false, the
-- client opening the thread sets it true.
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS client_read boolean DEFAULT true;

-- ============================================================
-- SECTION 9 — PHONE VERIFICATION (2026-06-12)
-- Run before deploying the phone-verification code, AND configure a
-- phone provider in the Supabase dashboard (see deploy notes).
--
-- Phone OTP itself is handled by Supabase Auth (updateUser + verifyOtp);
-- these columns just mirror the verified state onto the public
-- freelancers row so the badge can render for anonymous visitors.
-- ============================================================

ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS phone          text;
ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- Guard: a freelancer can edit their own row (bio, services, etc.), so
-- without this they could simply set phone_verified = true themselves.
-- This trigger freezes phone/phone_verified for every writer EXCEPT the
-- service role — only /api/verify-phone (which checks the confirmed OTP
-- server-side) can change them.
CREATE OR REPLACE FUNCTION public.protect_phone_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' THEN
    NEW.phone_verified := OLD.phone_verified;
    NEW.phone := OLD.phone;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freelancers_protect_phone ON freelancers;
CREATE TRIGGER freelancers_protect_phone
  BEFORE UPDATE ON freelancers
  FOR EACH ROW EXECUTE FUNCTION public.protect_phone_verification();

-- ============================================================
-- SECTION 10 — DUAL JOB COMPLETION (2026-06-13)
-- Run before deploying the /jobs page and review-gating.
--
-- quotes.completed_at = the FREELANCER's confirmation (existing).
-- quotes.client_completed_at = the CLIENT's confirmation (new).
-- A job is "mutually completed" only when BOTH are set — that's the
-- gate for either party leaving a review. The existing
-- "Clients can respond to quotes" UPDATE policy already lets a client
-- set their own confirmation on a quote addressed to their email.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_completed_at timestamptz;

-- ============================================================
-- SECTION 11 — REALTIME FOR LIVE CONVERSATIONS (2026-06-14)
-- Run to make /messages and /inbox update instantly via Supabase
-- Realtime instead of (only) the slow safety-net poll.
--
-- The pages subscribe to inserts on messages/message_replies and any
-- change on quotes; RLS (SECTION 2) already scopes what each user can
-- SELECT, and Realtime applies those same policies, so users only get
-- events for their own threads/quotes. The app refetches on each event
-- (it never trusts the payload), so minimal replica identity is fine —
-- but we set FULL on quotes so UPDATE events (accept/decline/paid) pass
-- the RLS check on the changed row.
-- ============================================================

-- Idempotent: ADD TABLE errors if the table is already published, so guard.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_replies') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_replies;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
  END IF;
END $$;

ALTER TABLE quotes REPLICA IDENTITY FULL;

-- ============================================================
-- SECTION 12 — RECEIPT SENT TIMESTAMP (2026-06-14)
-- Run before deploying the "Receipt sent" indicator on the quotes page.
-- Records when the paid receipt was sent so the workflow box can show it.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;

-- ============================================================
-- SECTION 13 — IN-APP NOTIFICATIONS (2026-06-14)
-- Run before deploying the notifications bell + /notifications page.
--
-- One row per notification, addressed to a recipient (user_id). Rows are
-- created server-side with the service-role key (there is deliberately no
-- INSERT policy, so one user can't fabricate notifications for another).
-- Users read/update/delete only their own. dedupe_key makes daily digests
-- and "saved you" notifications idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  title      text        NOT NULL,
  body       text,
  link       text,
  read       boolean     DEFAULT false,
  dedupe_key text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_time
  ON notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can read / mark-read / delete their own; nobody can INSERT via
-- the anon/authenticated roles (service role bypasses RLS and is the only
-- writer — see lib/serverNotify.js).
DROP POLICY IF EXISTS "Users read own notifications"   ON notifications;
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE USING (user_id = auth.uid());

-- Realtime so the bell badge updates live (idempotent; RLS scopes events).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ============================================================
-- SECTION 14 — REVIEW RESPONSES (2026-06-14)
-- Lets a freelancer post a public reply under a review about them.
-- Written via /api/review-response (service role, verifies ownership);
-- there is no client UPDATE policy on reviews, so this is the only writer.
-- ============================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS response    text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS response_at timestamptz;

-- ============================================================
-- SECTION 15 — CHAT PHOTOS (2026-06-14)
-- Lets either party attach a photo to a message reply (e.g. "here's the
-- leak"). Uploaded to a public chat-photos bucket under the sender's own
-- folder; the URL is stored on the reply row.
-- ============================================================

ALTER TABLE message_replies ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-photos', 'chat-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users upload only into their own uid folder; anyone can read
-- (public bucket — images render via the public URL in the thread).
DROP POLICY IF EXISTS "chat-photos upload own" ON storage.objects;
CREATE POLICY "chat-photos upload own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "chat-photos public read" ON storage.objects;
CREATE POLICY "chat-photos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-photos');

-- ============================================================
-- SECTION 16 — RESPONSE-TIME SIGNAL (2026-06-14)
-- Public "typically replies within X / responds to Y% of enquiries" badge.
-- Messages are private under RLS, so (like freelancer_message_count) this
-- SECURITY DEFINER function returns only timing AGGREGATES — no content —
-- for the last 90 days. median_minutes = time from a thread's first message
-- to the freelancer's first reply.
-- ============================================================

CREATE OR REPLACE FUNCTION public.freelancer_response_stats(f_id uuid)
RETURNS TABLE (median_minutes numeric, response_rate numeric, sample int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH f AS (SELECT user_id FROM freelancers WHERE id = f_id),
  threads AS (
    SELECT m.id, m.created_at,
      (SELECT min(r.created_at) FROM message_replies r, f
        WHERE r.message_id = m.id AND r.sender_user_id = f.user_id) AS first_reply
    FROM messages m
    WHERE m.freelancer_id = f_id
      AND m.created_at > now() - interval '90 days'
  )
  SELECT
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY extract(epoch FROM (first_reply - created_at)) / 60
    ) FILTER (WHERE first_reply IS NOT NULL))::numeric AS median_minutes,
    round((count(*) FILTER (WHERE first_reply IS NOT NULL))::numeric / nullif(count(*), 0), 2) AS response_rate,
    count(*)::int AS sample
  FROM threads;
$$;

GRANT EXECUTE ON FUNCTION public.freelancer_response_stats(uuid) TO anon, authenticated;

-- ============================================================
-- SECTION 17 — SAVED SEARCHES + ALERTS (2026-06-15)
-- A client saves a search (keyword + category + parish); when a new
-- freelancer that matches joins, they get a notification. Match runs
-- server-side in /api/match-saved-searches (service role) on profile
-- creation; rows here are managed by the owner.
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query      text,
  category   text,
  location   text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches (user_id);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved searches" ON saved_searches;
CREATE POLICY "Users manage own saved searches"
  ON saved_searches FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SECTION 18 — CALENDAR APPOINTMENTS (2026-06-21)
-- Private scheduling for the freelancer workspace calendar. Each row is a
-- job/appointment the freelancer puts on their calendar (optionally linked
-- to a quote). Unlike availability_blocks (public-readable), this is PRIVATE
-- — only the owning freelancer can read it, since it carries client details.
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id uuid        NOT NULL REFERENCES freelancers(id) ON DELETE CASCADE,
  quote_id      uuid        REFERENCES quotes(id) ON DELETE SET NULL,
  title         text        NOT NULL,
  client_name   text,
  client_email  text,
  date          date        NOT NULL,
  start_time    text,       -- 'HH:MM' 24h; null = all-day / blocked
  duration_min  integer     DEFAULT 60,
  status        text        NOT NULL DEFAULT 'confirmed', -- confirmed | pending | blocked
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_freelancer_date ON appointments (freelancer_id, date);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Freelancers manage own appointments" ON appointments;
CREATE POLICY "Freelancers manage own appointments"
  ON appointments FOR ALL
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
  );

-- ============================================================
-- SECTION 19 — BOOKINGS: OPT-IN + PER-SERVICE (2026-06-21)
-- "Request a booking" is opt-in per freelancer (off by default). When on,
-- the freelancer chooses a booking mode and which services are bookable.
-- Public availability is driven only by these settings + time-off blocks —
-- never by private job bookings. Extends the existing availability_settings
-- (public-readable) + services tables.
-- ============================================================

ALTER TABLE availability_settings
  ADD COLUMN IF NOT EXISTS bookings_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_mode     text    DEFAULT 'day',   -- 'day' | 'slot'
  ADD COLUMN IF NOT EXISTS work_days        integer[] DEFAULT '{1,2,3,4,5}', -- 0=Sun..6=Sat
  ADD COLUMN IF NOT EXISTS work_start       text    DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS work_end         text    DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS lead_time_days   integer DEFAULT 1;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS bookable boolean DEFAULT false;

-- ============================================================
-- SECTION 20 — CLIENT BOOKING REQUESTS (2026-06-21)
-- Clients request a booking from a freelancer's public profile; it lands as a
-- pending appointment the freelancer confirms/declines. Clients never write to
-- appointments directly (RLS is freelancer-only) — the /api/request-booking and
-- /api/booking-respond routes do it with the service role. These columns let an
-- appointment carry the requesting client + the service it's for.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS client_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id     uuid REFERENCES services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments (client_user_id);

-- ============================================================
-- SECTION 21 — CLIENTS READ THEIR OWN BOOKINGS (2026-06-21)
-- Adds a SELECT policy so a client can read the booking rows they requested
-- (client_user_id = them) for the /bookings page. Freelancers' private entries
-- (manual jobs / time off, client_user_id null) stay invisible to clients.
-- Policies are OR'd, so this only widens read access to the client's own rows.
-- ============================================================

DROP POLICY IF EXISTS "Clients read own booking requests" ON appointments;
CREATE POLICY "Clients read own booking requests"
  ON appointments FOR SELECT
  USING (client_user_id = auth.uid());

-- ============================================================
-- SECTION 22 — HIDE PROFILE, DEACTIVATE ACCOUNT, ADMIN FLAG (2026-07-03)
-- Three visibility states, weakest to strongest:
--   hidden          freelancer-controlled toggle (Settings) — profile drops out
--                   of search/categories/featured/sitemap, direct link shows
--                   "unavailable". Existing conversations keep working.
--   flagged         admin-only marker for problem profiles (with optional
--                   reason). Purely internal — does NOT change visibility.
--   deactivated_at  account deactivation. Profile down everywhere immediately;
--                   after 60 days a daily cron permanently deletes the account
--                   (auth user + all data). Logging back in within the window
--                   offers one-click reactivation.
-- account_deactivations covers BOTH roles (clients have no freelancers row).
-- Writes happen via /api/account with the service role; the RLS SELECT policy
-- exists so the logged-in user can see their own pending deletion (banner).
-- ============================================================

ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS hidden         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason    text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE TABLE IF NOT EXISTS account_deactivations (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  deactivated_at timestamptz NOT NULL DEFAULT now(),
  purge_after    timestamptz NOT NULL DEFAULT (now() + interval '60 days')
);

ALTER TABLE account_deactivations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own deactivation" ON account_deactivations;
CREATE POLICY "Users read own deactivation"
  ON account_deactivations FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- SECTION 23 — SERVICE BUSINESS GROUPS (2026-08-16)
-- Entrepreneurs often run several ventures under one name (e.g. a
-- landscaping business AND a catering business). Rather than multiple
-- profiles, a service can be tagged with the venture it belongs to; the
-- public profile then renders services grouped under those headings.
-- NULL/empty = ungrouped, which is the existing behaviour for everyone.
-- ============================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS business_group text;

-- ============================================================
-- SECTION 24 — EXTRA CATEGORIES (2026-08-16)
-- A freelancer running more than one venture can appear under several
-- categories without needing separate profiles. `category` stays the
-- PRIMARY category (drives the card's main pill and is unchanged);
-- `extra_categories` lists the others. Capped at 2 extras in the UI
-- (3 categories total) so nobody blankets every category page.
-- Empty array = today's behaviour for everyone.
-- ============================================================

ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS extra_categories text[] DEFAULT '{}';

-- ============================================================
-- SECTION 25 — VENTURE LIST ON THE PROFILE (2026-08-16)
-- The named businesses a pro runs. Collected during profile creation
-- ("Do you run more than one business?") and manageable afterwards, so the
-- service form can offer a DROPDOWN instead of free text. That stops near
-- duplicates ("CTech" vs "C-Tech") splitting into two tabs on the profile.
-- services.business_group still holds which venture each service belongs
-- to; this is just the canonical list of names to choose from.
-- Empty array = single-business pro, which is the default for everyone.
-- ============================================================

ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS ventures text[] DEFAULT '{}';

-- ============================================================
-- SECTION 26 — VENTURE ON QUOTES / JOBS / EARNINGS (2026-08-17)
-- Which venture a quote belongs to, so a pro running several businesses
-- can filter jobs (open/completed/paid) and earnings per venture instead
-- of seeing one merged pile. Stamped when the quote is created, from the
-- venture the quoted services belong to, so later renaming or deleting a
-- service can't retroactively change historic earnings.
-- NULL = not tied to a venture (single-business pros, and every quote
-- raised before this shipped), which is the default and stays valid.
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS business_group text;

CREATE INDEX IF NOT EXISTS quotes_business_group_idx
  ON quotes (freelancer_id, business_group);

-- One-time backfill for quotes raised before the column existed. Line item
-- descriptions are stored as "Service name - details", so match the part
-- before the separator back to the service and inherit its venture. Only
-- fills rows that are still NULL, so it is safe to re-run.
UPDATE quotes q
   SET business_group = s.business_group
  FROM services s
 WHERE q.business_group IS NULL
   AND s.freelancer_id = q.freelancer_id
   AND s.business_group IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(
              CASE jsonb_typeof(q.items::jsonb) WHEN 'array' THEN q.items::jsonb ELSE '[]'::jsonb END
            ) AS item
      WHERE split_part(item->>'description', ' - ', 1) = s.name
   );

-- ============================================================
-- SECTION 27 — ORGANISATIONS, VENDOR DETAILS, BILLING SNAPSHOTS (2026-09-12)
-- A third account type. An organisation (a ministry, a hotel, an NGO) is a
-- legal entity that several staff act for: they search the portal, enquire
-- with freelancers, receive quotes and decide. Each freelancer invoices the
-- organisation directly. Vetted issues nothing and never handles money.
--
-- Nothing changes for individual clients: organisation_id is NULL on every
-- existing message and quote, and the email-based policies still apply.
-- ============================================================

-- 27.1 Organisations
CREATE TABLE IF NOT EXISTS organisations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  division              text,                         -- printed under the name on documents
  kind                  text NOT NULL DEFAULT 'business'
                        CHECK (kind IN ('government','business','nonprofit','other')),
  address_line1         text,
  address_line2         text,
  city_town             text,
  parish                text,
  country               text NOT NULL DEFAULT 'Barbados',
  email                 text,                         -- accounts / general contact
  phone                 text,
  default_payment_terms text NOT NULL DEFAULT 'net30'
                        CHECK (default_payment_terms IN ('due_receipt','net7','net14','net30','net60')),
  -- Set by an admin after checking the organisation is who it says it is.
  -- Shown to freelancers so an enquiry from "Ministry of X" can be trusted.
  verified              boolean NOT NULL DEFAULT false,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- 27.2 Membership. Every staff member signs in as themselves and acts for
-- the organisation, so the record shows who did what. Two roles only.
CREATE TABLE IF NOT EXISTS organisation_members (
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id)    ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  -- Copied from the login at join time so the Team page can show who is
  -- who without reading auth.users, which clients cannot.
  email           text,
  full_name       text,
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (organisation_id, user_id)
);
CREATE INDEX IF NOT EXISTS organisation_members_user_idx ON organisation_members (user_id);

-- 27.3 Invitations. An owner invites a colleague by email; the link carries
-- the token, and accepting it (below) attaches the new account to the org.
CREATE TABLE IF NOT EXISTS organisation_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  token           text NOT NULL UNIQUE,
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organisation_invites_org_idx ON organisation_invites (organisation_id);

-- Which organisations does the caller belong to. SECURITY DEFINER so the
-- policies on organisation_members can use it without recursing.
CREATE OR REPLACE FUNCTION public.my_organisation_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.my_organisation_ids() TO authenticated;

-- Create an organisation and make the caller its owner in one step, so an
-- organisation can never exist without an owner.
CREATE OR REPLACE FUNCTION public.create_organisation(p_name text, p_kind text DEFAULT 'business')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'Organisation name is required'; END IF;
  INSERT INTO organisations (name, kind, created_by)
       VALUES (trim(p_name), COALESCE(p_kind, 'business'), auth.uid())
    RETURNING id INTO new_id;
  INSERT INTO organisation_members (organisation_id, user_id, role, email, full_name)
       VALUES (new_id, auth.uid(), 'owner',
               auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'full_name');
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_organisation(text, text) TO authenticated;

-- Accept an invitation. The caller's login email must match the invited
-- address, the invite must be unexpired and unused. Returns the org id.
CREATE OR REPLACE FUNCTION public.accept_organisation_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inv organisation_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO inv FROM organisation_invites WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation has expired'; END IF;
  IF lower(inv.email) <> lower(COALESCE(auth.jwt()->>'email', '')) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;
  INSERT INTO organisation_members (organisation_id, user_id, role, email, full_name)
       VALUES (inv.organisation_id, auth.uid(), inv.role,
               auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'full_name')
  ON CONFLICT (organisation_id, user_id) DO NOTHING;
  UPDATE organisation_invites SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.organisation_id;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_organisation_invite(text) TO authenticated;

-- 27.4 Freelancer billing and vendor details. A separate table because the
-- freelancers row is publicly readable and RLS is row-level: a TAMIS number
-- or home address on that row would be visible to everyone.
-- NO banking fields, by design: those go to Treasury on the vendor form and
-- are never stored here.
CREATE TABLE IF NOT EXISTS freelancer_billing (
  freelancer_id                     uuid PRIMARY KEY REFERENCES freelancers(id) ON DELETE CASCADE,
  address_line1                     text,
  address_line2                     text,
  city_town                         text,
  parish                            text,
  country                           text NOT NULL DEFAULT 'Barbados',
  vendor_classification             text CHECK (vendor_classification IN
                                      ('employee','small_business','other_business',
                                       'medium_business','large_business')),
  tamis_number                      text,
  company_registration_number       text,
  small_business_association_number text,
  updated_at                        timestamptz DEFAULT now()
);

-- The one vendor fact that IS public: a badge organisations can filter on.
ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS govt_vendor_status text NOT NULL DEFAULT 'not_registered';
ALTER TABLE freelancers DROP CONSTRAINT IF EXISTS freelancers_govt_vendor_status_check;
ALTER TABLE freelancers ADD CONSTRAINT freelancers_govt_vendor_status_check
  CHECK (govt_vendor_status IN ('not_registered','applying','registered'));

-- 27.5 Attribute threads and quotes to an organisation.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE SET NULL;
ALTER TABLE quotes   ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES organisations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_organisation_idx ON messages (organisation_id);
CREATE INDEX IF NOT EXISTS quotes_organisation_idx   ON quotes   (organisation_id);

-- 27.6 What the document said when it was issued. Snapshotted so an old
-- invoice does not change when the freelancer moves or the org renames.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS currency         text NOT NULL DEFAULT 'BBD';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS from_address     text;   -- freelancer address block
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS bill_to_division text;   -- e.g. "Division of Youth"
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS bill_to_address  text;   -- organisation address block
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reference        text;   -- optional PO / requisition no.

-- 27.7 Row level security

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their organisations" ON organisations;
CREATE POLICY "Members read their organisations"
  ON organisations FOR SELECT
  USING (id IN (SELECT my_organisation_ids()));
-- A freelancer may read the name/verified flag of an organisation that has
-- contacted them, so the thread can show who it is and whether it's verified.
DROP POLICY IF EXISTS "Freelancers read organisations that contacted them" ON organisations;
CREATE POLICY "Freelancers read organisations that contacted them"
  ON organisations FOR SELECT
  USING (id IN (
    SELECT m.organisation_id FROM messages m
     WHERE m.organisation_id IS NOT NULL
       AND m.freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
  ));
DROP POLICY IF EXISTS "Owners update their organisations" ON organisations;
CREATE POLICY "Owners update their organisations"
  ON organisations FOR UPDATE
  USING (id IN (SELECT organisation_id FROM organisation_members
                 WHERE user_id = auth.uid() AND role = 'owner'));
-- No INSERT policy on purpose: creation goes through create_organisation().

ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read roster" ON organisation_members;
CREATE POLICY "Members read roster"
  ON organisation_members FOR SELECT
  USING (organisation_id IN (SELECT my_organisation_ids()));
DROP POLICY IF EXISTS "Owners remove members" ON organisation_members;
CREATE POLICY "Owners remove members"
  ON organisation_members FOR DELETE
  USING (organisation_id IN (SELECT organisation_id FROM organisation_members
                              WHERE user_id = auth.uid() AND role = 'owner'));
-- Inserts happen only via create_organisation() and accept_organisation_invite().

ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage invites" ON organisation_invites;
CREATE POLICY "Owners manage invites"
  ON organisation_invites FOR ALL
  USING (organisation_id IN (SELECT organisation_id FROM organisation_members
                              WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM organisation_members
                                   WHERE user_id = auth.uid() AND role = 'owner'));

ALTER TABLE freelancer_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Freelancer manages own billing" ON freelancer_billing;
CREATE POLICY "Freelancer manages own billing"
  ON freelancer_billing FOR ALL
  USING (freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid()))
  WITH CHECK (freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid()));

-- Extend the participant policies so every member of an organisation sees
-- the organisation's threads and quotes, not only the mailbox that sent them.
DROP POLICY IF EXISTS "Participants can read messages" ON messages;
CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    OR sender_user_id = auth.uid()
    OR (sender_email IS NOT NULL AND sender_email = auth.jwt()->>'email')
    OR (organisation_id IS NOT NULL AND organisation_id IN (SELECT my_organisation_ids()))
  );

DROP POLICY IF EXISTS "Participants can update messages" ON messages;
CREATE POLICY "Participants can update messages"
  ON messages FOR UPDATE
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    OR sender_user_id = auth.uid()
    OR (sender_email IS NOT NULL AND sender_email = auth.jwt()->>'email')
    OR (organisation_id IS NOT NULL AND organisation_id IN (SELECT my_organisation_ids()))
  );

DROP POLICY IF EXISTS "Participants can read quotes" ON quotes;
CREATE POLICY "Participants can read quotes"
  ON quotes FOR SELECT
  USING (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    OR (client_email IS NOT NULL AND client_email = auth.jwt()->>'email')
    OR (organisation_id IS NOT NULL AND organisation_id IN (SELECT my_organisation_ids()))
  );

DROP POLICY IF EXISTS "Clients can respond to quotes" ON quotes;
CREATE POLICY "Clients can respond to quotes"
  ON quotes FOR UPDATE
  USING (
    (client_email IS NOT NULL AND client_email = auth.jwt()->>'email')
    OR (organisation_id IS NOT NULL AND organisation_id IN (SELECT my_organisation_ids()))
  );

-- ============================================================
-- SECTION 28 — DOCUMENT VERIFICATION (2026-09-12)
-- Every quote carries a short code printed on the quote, invoice and
-- receipt. Anyone holding the document (an accounts department, say) can
-- open vetted.bb/verify/<code> and see that it is genuine and where it
-- stands: issued, accepted, invoiced, completed, paid, with dates. The
-- lookup exposes no email, address or line items.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS verify_code text;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_verify_code_idx ON quotes (verify_code) WHERE verify_code IS NOT NULL;

-- 10 characters from an alphabet with no look-alikes (no 0/O, 1/I/L).
CREATE OR REPLACE FUNCTION public.gen_verify_code()
RETURNS text
LANGUAGE sql VOLATILE
AS $$
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
    FROM generate_series(1, 10)
$$;

-- One-time backfill so documents already issued can be verified too.
-- Only fills NULLs, so it is safe to re-run.
UPDATE quotes SET verify_code = gen_verify_code() WHERE verify_code IS NULL;

-- Public lookup. SECURITY DEFINER because the caller is usually not logged
-- in; the column list is the whole point, so keep it minimal.
CREATE OR REPLACE FUNCTION public.verify_document(p_code text)
RETURNS TABLE (
  quote_number          text,
  invoice_number        text,
  status                text,
  total                 numeric,
  currency              text,
  quote_date            text,
  invoiced_at           timestamptz,
  completed_at          timestamptz,
  paid_at               timestamptz,
  issuer_name           text,
  billed_to             text,
  organisation_verified boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.quote_number, q.invoice_number, q.status, q.total::numeric, COALESCE(q.currency, 'BBD'),
         q.quote_date::text, q.invoiced_at, q.completed_at, q.paid_at,
         COALESCE(NULLIF(trim(f.company_name), ''), f.name) AS issuer_name,
         q.client_name AS billed_to,
         COALESCE(o.verified, false) AS organisation_verified
    FROM quotes q
    JOIN freelancers f ON f.id = q.freelancer_id
    LEFT JOIN organisations o ON o.id = q.organisation_id
   WHERE q.verify_code = upper(trim(p_code))
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated;

-- ============================================================
-- SECTION 29 — QUOTE REQUESTS (2026-09-12)
-- An organisation describes a job once and sends it to several shortlisted
-- professionals at the same time. Each one lands as an ordinary enquiry
-- thread; the quotes that come back are tied to the request so the
-- organisation can compare them side by side and accept one.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title           text NOT NULL,
  details         text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','closed')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_requests_org_idx ON quote_requests (organisation_id, created_at DESC);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS quote_request_id uuid REFERENCES quote_requests(id) ON DELETE SET NULL;
ALTER TABLE quotes   ADD COLUMN IF NOT EXISTS quote_request_id uuid REFERENCES quote_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_quote_request_idx ON messages (quote_request_id);
CREATE INDEX IF NOT EXISTS quotes_quote_request_idx   ON quotes   (quote_request_id);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage their organisation's requests" ON quote_requests;
CREATE POLICY "Members manage their organisation's requests"
  ON quote_requests FOR ALL
  USING (organisation_id IN (SELECT my_organisation_ids()))
  WITH CHECK (organisation_id IN (SELECT my_organisation_ids()));
-- The invited freelancer reads the request through its message thread, which
-- the existing "Participants can read messages" policy already allows; the
-- request row itself stays with the organisation.

-- ============================================================
-- SECTION 30 — PURCHASE ORDER ATTACHMENTS (2026-09-12)
-- An organisation (or any client) can attach a purchase order or
-- requisition to an accepted quote, and the professional can see it, so
-- the invoice references it without anyone retyping. Files live in a
-- PRIVATE bucket and are read through short-lived signed URLs; access is
-- decided by the same participant rule as the quote itself.
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  path        text NOT NULL,          -- object path inside the quote-attachments bucket
  file_name   text NOT NULL,
  file_size   integer,
  mime_type   text,
  kind        text NOT NULL DEFAULT 'purchase_order' CHECK (kind IN ('purchase_order','other')),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_attachments_quote_idx ON quote_attachments (quote_id);

-- Who may see or add attachments: exactly the parties who can see the quote.
CREATE OR REPLACE FUNCTION public.can_access_quote(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quotes q
     WHERE q.id = p_quote_id
       AND (
         q.freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
         OR (q.client_email IS NOT NULL AND q.client_email = auth.jwt()->>'email')
         OR (q.organisation_id IS NOT NULL AND q.organisation_id IN (SELECT my_organisation_ids()))
       )
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_access_quote(uuid) TO authenticated;

ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Quote participants read attachments" ON quote_attachments;
CREATE POLICY "Quote participants read attachments"
  ON quote_attachments FOR SELECT
  USING (can_access_quote(quote_id));
DROP POLICY IF EXISTS "Quote participants add attachments" ON quote_attachments;
CREATE POLICY "Quote participants add attachments"
  ON quote_attachments FOR INSERT
  WITH CHECK (can_access_quote(quote_id) AND uploaded_by = auth.uid());
DROP POLICY IF EXISTS "Uploader removes own attachment" ON quote_attachments;
CREATE POLICY "Uploader removes own attachment"
  ON quote_attachments FOR DELETE
  USING (uploaded_by = auth.uid());

-- Private bucket. Object paths are <quote_id>/<uuid>-<file name>, so the
-- first folder segment is the quote and the storage policies can reuse
-- can_access_quote().
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-attachments', 'quote-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "quote-attachments participants upload" ON storage.objects;
CREATE POLICY "quote-attachments participants upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-attachments'
    AND can_access_quote(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "quote-attachments participants read" ON storage.objects;
CREATE POLICY "quote-attachments participants read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-attachments'
    AND can_access_quote(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "quote-attachments uploader delete" ON storage.objects;
CREATE POLICY "quote-attachments uploader delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'quote-attachments' AND owner = auth.uid());

-- ============================================================
-- SECTION 31 — PUBLIC ORGANISATION PAGE (2026-09-12)
-- A light public profile at /organisations/<id>: name, type, parish,
-- verified mark, member since, and how much it has done on the platform.
-- Organisations are otherwise readable only by their members and by
-- freelancers they have contacted, so this SECURITY DEFINER lookup exposes
-- exactly the public fields and two counts, nothing else (no address, no
-- email, no members, no amounts).
-- ============================================================

CREATE OR REPLACE FUNCTION public.organisation_public(p_id uuid)
RETURNS TABLE (
  id              uuid,
  name            text,
  division        text,
  kind            text,
  parish          text,
  verified        boolean,
  created_at      timestamptz,
  jobs_completed  integer,
  quotes_received integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.division, o.kind, o.parish, o.verified, o.created_at,
         (SELECT count(*)::int FROM quotes q WHERE q.organisation_id = o.id AND q.status IN ('completed', 'paid')),
         (SELECT count(*)::int FROM quotes q WHERE q.organisation_id = o.id)
    FROM organisations o
   WHERE o.id = p_id
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.organisation_public(uuid) TO anon, authenticated;


-- ============================================================
-- SECTION 32 — PROFILE HANDLES (2026-09-13)
-- A freelancer can pick a handle so their profile lives at
-- /freelancers/<handle> instead of /freelancers/<uuid>. Old uuid links
-- keep working (the page redirects). Uniqueness is case-insensitive,
-- format/reserved-word/profanity checks live in the database so the
-- browser cannot bypass them, and a change is allowed once every 30
-- days with the previous handle redirecting for 90 days.
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS handle                text,
  ADD COLUMN IF NOT EXISTS handle_changed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS previous_handle       text,
  ADD COLUMN IF NOT EXISTS previous_handle_until timestamptz;

-- Case-insensitive uniqueness (ThinkSports and thinksports are one handle).
CREATE UNIQUE INDEX IF NOT EXISTS freelancers_handle_lower_key
  ON public.freelancers (lower(handle)) WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS freelancers_previous_handle_lower_idx
  ON public.freelancers (lower(previous_handle)) WHERE previous_handle IS NOT NULL;

-- Format is also enforced at the table level: 3-30 chars, letters,
-- digits and hyphens, no leading or trailing hyphen.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freelancers_handle_format') THEN
    ALTER TABLE public.freelancers ADD CONSTRAINT freelancers_handle_format
      CHECK (handle IS NULL OR handle ~* '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
  END IF;
END $$;

-- Every reason a handle can be refused, in one place. Returns NULL when
-- the handle is fine, otherwise a short code the UI turns into a message:
-- 'format' | 'reserved' | 'profanity' | 'taken'.
CREATE OR REPLACE FUNCTION public.handle_problem(p_handle text, p_exclude uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text := lower(coalesce(p_handle, ''));
  n text;
  w text;
  -- Exact names the site itself uses or that would read as official.
  reserved text[] := ARRAY[
    'admin','administrator','vetted','vettedbb','vetted-bb','official','support','help','staff','team','moderator','mod',
    'verified','featured','trusted','government','govt','ministry','treasury','barbados','gov','police','bank',
    'login','logout','signup','signin','register','search','settings','dashboard','profile','profiles','freelancer','freelancers',
    'organisation','organisations','organization','client','clients','api','www','mail','email','about','contact','terms','privacy',
    'guide','badges','verify','inbox','messages','quotes','jobs','bookings','calendar','reviews','saved','invite','new','edit','me','null','undefined','test'
  ];
  -- Anything starting with these reads as the platform or the state.
  reserved_prefix text[] := ARRAY['vetted','admin','official','govt','government','ministry','treasury'];
  -- Refused wherever they appear, even inside a longer word.
  banned_anywhere text[] := ARRAY['fuck','shit','cunt','nigg','faggot','motherf','bitch','wanker','twat','slut','whore','pussy','bastard','rapist','nazi','kkk','rasshole','bullah','cocksuck','blowjob','jackass','dumbass','asshole'];
  -- Refused only as a whole word (so bass-fishing, dickson, assistant pass).
  banned_word text[] := ARRAY['ass','arse','dick','cock','tit','tits','cum','sex','fag','hoe','ho','damn','hell','crap','piss','penis','vagina','porn','xxx','nude','nudes','anal','boob','boobs','wuk','cunny','bumbo'];
BEGIN
  IF h !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' THEN
    RETURN 'format';
  END IF;
  IF h = ANY(reserved) THEN
    RETURN 'reserved';
  END IF;
  FOREACH w IN ARRAY reserved_prefix LOOP
    IF h LIKE w || '%' THEN RETURN 'reserved'; END IF;
  END LOOP;
  -- Undo the usual letter-for-digit tricks (sh1t, a55) before checking.
  n := translate(h, '013457-', 'oieast ');
  FOREACH w IN ARRAY banned_anywhere LOOP
    IF position(w IN replace(n, ' ', '')) > 0 THEN RETURN 'profanity'; END IF;
  END LOOP;
  FOREACH w IN ARRAY banned_word LOOP
    IF n ~ ('\m' || w || '\M') THEN RETURN 'profanity'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM freelancers f WHERE lower(f.handle) = h AND (p_exclude IS NULL OR f.id <> p_exclude)) THEN
    RETURN 'taken';
  END IF;
  -- A handle someone gave up recently still redirects to them, so it
  -- cannot be re-registered until that grace period ends.
  IF EXISTS (SELECT 1 FROM freelancers f WHERE lower(f.previous_handle) = h AND f.previous_handle_until > now() AND (p_exclude IS NULL OR f.id <> p_exclude)) THEN
    RETURN 'taken';
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.handle_problem(text, uuid) TO anon, authenticated;

-- Live availability check for the settings card (same rules, no write).
CREATE OR REPLACE FUNCTION public.handle_available(p_handle text, p_freelancer_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.handle_problem(p_handle, p_freelancer_id)
$$;
GRANT EXECUTE ON FUNCTION public.handle_available(text, uuid) TO anon, authenticated;

-- The only sanctioned way to set a handle. Checks ownership, the rules
-- above, and the 30-day cooldown; keeps the previous handle redirecting
-- for 90 days. Returns {ok, handle} or {error, ...}.
CREATE OR REPLACE FUNCTION public.set_handle(p_freelancer_id uuid, p_handle text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f freelancers%ROWTYPE;
  prob text;
  wanted text := trim(coalesce(p_handle, ''));
BEGIN
  SELECT * INTO f FROM freelancers WHERE id = p_freelancer_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_owner');
  END IF;
  prob := public.handle_problem(wanted, f.id);
  IF prob IS NOT NULL THEN
    RETURN json_build_object('error', prob);
  END IF;
  PERFORM set_config('vetted.allow_handle', '1', true);
  -- Only the casing changed (thinksports -> ThinkSports): free, no cooldown.
  IF f.handle IS NOT NULL AND lower(f.handle) = lower(wanted) THEN
    UPDATE freelancers SET handle = wanted WHERE id = f.id;
    RETURN json_build_object('ok', true, 'handle', wanted);
  END IF;
  IF f.handle_changed_at IS NOT NULL AND f.handle_changed_at > now() - interval '30 days' THEN
    RETURN json_build_object('error', 'cooldown', 'next_change', f.handle_changed_at + interval '30 days');
  END IF;
  UPDATE freelancers
     SET previous_handle       = f.handle,
         previous_handle_until = CASE WHEN f.handle IS NULL THEN NULL ELSE now() + interval '90 days' END,
         handle                = wanted,
         handle_changed_at     = now()
   WHERE id = f.id;
  RETURN json_build_object('ok', true, 'handle', wanted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_handle(uuid, text) TO authenticated;

-- Handles change only through set_handle: a direct UPDATE from the
-- browser (which RLS otherwise allows on the owner's row) is refused,
-- so the reserved-word and profanity rules cannot be skipped.
CREATE OR REPLACE FUNCTION public.freelancers_guard_handle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.handle IS DISTINCT FROM OLD.handle
     AND coalesce(current_setting('vetted.allow_handle', true), '') <> '1' THEN
    RAISE EXCEPTION 'Use set_handle() to change a profile handle';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS freelancers_guard_handle ON public.freelancers;
CREATE TRIGGER freelancers_guard_handle
  BEFORE UPDATE ON public.freelancers
  FOR EACH ROW EXECUTE FUNCTION public.freelancers_guard_handle();


-- ============================================================
-- SECTION 33 — DOCUMENT FIELDS (2026-09-13)
-- Quote validity, richer billed-to block, per-document terms, and the
-- freelancer's once-set payment details + default terms. Invoices are
-- quotes rows (no separate table), so the quote columns cover both.
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS valid_until    date,
  ADD COLUMN IF NOT EXISTS client_phone   text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS terms          text;

ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS payment_details text,
  ADD COLUMN IF NOT EXISTS default_terms   text;

-- ============================================================
-- SECTION 34 — REVIEWS: CLOSE THE DIRECT WRITE PATH (2026-11-03)
-- Both review routes (/api/reviews for client→professional and
-- /api/client-review for professional→client) check that a real,
-- mutually-completed job exists before a review is written. That
-- check was skippable: the INSERT policy below let ANY logged-in
-- user write a review row straight to the table with the public
-- anon key, which ships in the browser bundle.
--
-- Removing the policy leaves no INSERT policy on reviews, so with
-- RLS on, only the service role (i.e. the two API routes) can
-- write one. Reading and deleting your own are unchanged.
--
-- Deploy the matching code FIRST (the dashboard now posts client
-- reviews to /api/client-review instead of inserting directly),
-- then run this.
-- ============================================================

DROP POLICY IF EXISTS "Logged-in users can write reviews" ON reviews;

-- Verify: this should return no INSERT row for reviews.
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'reviews';

-- ============================================================
-- SECTION 35 — BACKFILL min_price, PAID SERVICES ONLY (2026-11-03)
-- freelancers.min_price drives the "From Bds$…" figure. It was
-- computed as the minimum over ALL services, so anyone offering a
-- free consultation or site visit advertised "From Bds$0", which
-- tells a client nothing about what the work costs.
--
-- The app now skips free services when it recalculates (lib/price.js
-- lowestPaidPrice), but it only recalculates when a service is saved
-- or deleted, so existing rows keep the old value until this runs.
--
-- Safe to re-run. The public pages no longer depend on it being
-- fresh (they compute from services), but keeping the column honest
-- avoids surprises anywhere it is read later.
-- ============================================================

UPDATE freelancers f
SET    min_price = sub.min_paid
FROM (
  SELECT freelancer_id,
         MIN(NULLIF(regexp_replace(price::text, '[^0-9.]', '', 'g'), '')::numeric) AS min_paid
  FROM   services
  WHERE  NULLIF(regexp_replace(price::text, '[^0-9.]', '', 'g'), '')::numeric > 0
  GROUP  BY freelancer_id
) sub
WHERE f.id = sub.freelancer_id
  AND (f.min_price IS DISTINCT FROM sub.min_paid);

-- Nobody with only free services (or none at all) should carry a price.
UPDATE freelancers f
SET    min_price = NULL
WHERE  f.min_price IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM services s
    WHERE s.freelancer_id = f.id
      AND NULLIF(regexp_replace(s.price::text, '[^0-9.]', '', 'g'), '')::numeric > 0
  );

-- Verify: every row should show the lowest price above zero, or NULL.
--   SELECT name, min_price FROM freelancers ORDER BY name;

-- ============================================================
-- SECTION 36 — RENTALS & STAYS (2026-11-11)
-- Things one customer has at a time, for a run of days: a hire car,
-- a holiday apartment, a marquee, a boat. Three differences from
-- every other service, each needing somewhere to live:
--
--   services.rental            this item is hired out, one customer at a time
--   services.price_unit        'day' or 'night': what the price is per
--   services.length_discounts  optional tiers, e.g. [{"min":7,"percent":10}]
--                              applied automatically to longer rentals
--
--   appointments.end_date      last OCCUPIED day of a multi-day booking or
--                              block (null = the single day in `date`)
--   appointments.message_id    the conversation a booking request opened,
--                              where the quote is then sent
--   appointments.rental        snapshot of the price the customer was shown
--                              {unit, units, rate, discountPct, unitPrice, total}
--
-- appointments.service_id (section 20) already says WHICH item. A
-- confirmed booking, or a block with a service_id, takes that one
-- item off the market for its dates; a block with no service_id is
-- still time off for the whole profile.
--
-- Everything here is additive and safe to re-run. Until it runs,
-- the rest of the site works as before; only saving a service as a
-- rental, and requesting a rental, will fail.
-- ============================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS rental           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_unit       text,
  ADD COLUMN IF NOT EXISTS length_discounts jsonb   DEFAULT '[]'::jsonb;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS end_date   date,
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rental     jsonb;

-- "What is booked on this item from today?" is asked on every profile view.
CREATE INDEX IF NOT EXISTS idx_appointments_service_date
  ON appointments (service_id, date) WHERE service_id IS NOT NULL;

-- Verify: both should list the new columns.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'services' AND column_name IN ('rental','price_unit','length_discounts');
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'appointments' AND column_name IN ('end_date','message_id','rental');

-- ============================================================
-- SECTION 37 — INVOICE ON ACCEPTANCE (2026-11-12)
-- A client who has accepted a quote is waiting for the invoice, and a
-- missed notification used to leave them waiting. Three small columns:
--
--   quotes.auto_invoice              the professional ticked "send the invoice
--                                    automatically when this is accepted" on
--                                    this quote; /api/notify-quote-event then
--                                    issues it the moment the client accepts
--   quotes.accepted_at               when the client accepted; shown as
--                                    "accepted 2 days ago" under Waiting on you,
--                                    and what stops a repeated request from
--                                    emailing the professional twice
--   freelancers.auto_invoice_default their last choice, so the tick box on the
--                                    next quote starts where they left it
--
-- Additive and safe to re-run. Until it runs the rest of the site works as
-- before: the acceptance email, the Send invoice button on the notification
-- and the Waiting on you list all work without it. Only a quote sent with
-- the automatic box ticked will fail to send.
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS auto_invoice boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_at  timestamptz;

ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS auto_invoice_default boolean DEFAULT false;

-- Verify: should list auto_invoice and accepted_at.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'quotes' AND column_name IN ('auto_invoice','accepted_at');

-- ============================================================
-- SECTION 38 — CLIENTS CAN ONLY RESPOND TO A QUOTE (2026-11-12)
-- The "Clients can respond to quotes" policy lets the client a quote is
-- addressed to (or a member of the organisation it is addressed to) UPDATE
-- that row, and row-level security cannot say WHICH columns. So with the
-- public key a client could rewrite the total or the line items, or set
-- completed_at, paid_at and status = 'paid' themselves, which unlocks a
-- review for a job that was never done or paid ("Reviews only from paid
-- jobs"). They could also flip auto_invoice (section 37).
--
-- This trigger narrows a client's update to the two things a client really
-- does, whatever else the request contains:
--
--   1. answer a quote that is waiting:   sent -> accepted | declined
--   2. tick or untick "job completed" on their side (client_completed_at),
--      once it is accepted. Status then follows from both sides' ticks,
--      worked out here rather than taken from the request, and a job
--      marked paid stays paid.
--
-- Every other column keeps its stored value. Nothing is refused with an
-- error: the pages keep working, and a tampered request simply changes
-- nothing it should not.
--
-- Not affected: the professional who owns the quote, the service role (the
-- API routes), and the SQL editor (no signed-in user at all).
--
-- Safe to re-run. To undo:
--   DROP TRIGGER IF EXISTS quotes_guard_client_update ON public.quotes;
-- ============================================================

CREATE OR REPLACE FUNCTION public.quotes_guard_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  want_status text        := NEW.status;
  want_done   timestamptz := NEW.client_completed_at;
  keep_status text        := OLD.status;
  keep_done   timestamptz := OLD.client_completed_at;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;

  -- The SQL editor or a direct connection (no signed-in user), and the
  -- service role used by the API routes: unrestricted.
  IF claims IS NULL OR coalesce(claims ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- The professional the quote belongs to: unrestricted.
  IF EXISTS (
    SELECT 1 FROM freelancers f
    WHERE f.id = OLD.freelancer_id AND f.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Anyone else who got this far is on the client side of the quote.

  -- 1. Answering a quote that is waiting for an answer.
  IF OLD.status = 'sent' AND want_status IN ('accepted', 'declined') THEN
    keep_status := want_status;
  END IF;

  -- 2. Their own "job completed" tick, once the quote has been accepted.
  --    The time is ours, not theirs: now when ticked, cleared when unticked.
  IF OLD.status IN ('accepted', 'invoiced', 'completed', 'paid') THEN
    IF want_done IS NULL THEN
      keep_done := NULL;
    ELSIF OLD.client_completed_at IS NULL THEN
      keep_done := now();
    END IF;
  END IF;

  -- Status between invoiced and completed follows the two ticks.
  IF OLD.status IN ('invoiced', 'completed') THEN
    keep_status := CASE
      WHEN OLD.completed_at IS NOT NULL AND keep_done IS NOT NULL THEN 'completed'
      ELSE 'invoiced'
    END;
  END IF;

  NEW := OLD;
  NEW.status := keep_status;
  NEW.client_completed_at := keep_done;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_guard_client_update ON public.quotes;
CREATE TRIGGER quotes_guard_client_update
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_guard_client_update();

-- Verify: should return one row.
--   SELECT tgname FROM pg_trigger WHERE tgname = 'quotes_guard_client_update';

-- ============================================================
-- SECTION 39 — MESSAGES COME FROM AN ACCOUNT, AND ARE ANNOUNCED ONCE (2026-11-12)
-- Two things, both for the notification routes (/api/notify-message and
-- /api/notify-reply), which now accept only the id of a saved row.
--
-- 1. notified_at on messages and message_replies. The route stamps it when
--    it sends the email and push for that row, and skips a row already
--    stamped, so one row is announced once however often it is asked for.
--
-- 2. Who may write a row. Until now "Anyone can send a message" and
--    "Anyone can reply" let any visitor, signed in or not, save a message or
--    a reply under any name, any email address and any sender_user_id. Now a
--    message or reply can only be saved by a signed-in user, as themselves:
--
--      messages          sender_user_id is the caller, and sender_email is
--                        the address on the caller's account
--      message_replies   sender_user_id is the caller
--
--    The API routes use the service role and are not affected (booking
--    requests, the quote sent when a rental is confirmed, the invoice sent
--    when a quote is accepted).
--
-- Safe to re-run. It can be run before or after the code that goes with it:
-- before it runs the routes send without the once-only stamp, and the pages
-- already save rows the way the new rules require.
--
-- To undo part 2 only (reopens writing to everyone, do not do this lightly):
--   DROP POLICY IF EXISTS "Signed-in users send as themselves" ON messages;
--   CREATE POLICY "Anyone can send a message" ON messages FOR INSERT WITH CHECK (true);
--   DROP POLICY IF EXISTS "Signed-in users reply as themselves" ON message_replies;
--   CREATE POLICY "Anyone can reply" ON message_replies FOR INSERT WITH CHECK (true);
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

ALTER TABLE message_replies
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

DROP POLICY IF EXISTS "Anyone can send a message"          ON messages;
DROP POLICY IF EXISTS "Signed-in users send as themselves" ON messages;
CREATE POLICY "Signed-in users send as themselves"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND lower(sender_email) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Anyone can reply"                    ON message_replies;
DROP POLICY IF EXISTS "Signed-in users reply as themselves" ON message_replies;
CREATE POLICY "Signed-in users reply as themselves"
  ON message_replies FOR INSERT
  TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

-- Verify: should return the two new policies and neither "Anyone can ...".
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename IN ('messages', 'message_replies') AND cmd = 'INSERT';

-- ============================================================
-- SECTION 40 — WHAT EACH SIDE MAY WRITE (2026-11-12)
-- Row level security says WHICH ROWS a person may change, never which
-- columns. Four tables let someone who may touch a row rewrite parts of it
-- that are not theirs to decide. Each gets a guard here. Like section 38,
-- nothing is refused with an error: a column the caller may not set simply
-- keeps its stored (or correct) value. The service role used by the API
-- routes, and the SQL editor, are never restricted.
--
--   1. quotes     A professional could save a quote with ANY organisation_id
--                 and it appeared in that organisation's dashboard and
--                 records, e.g. an invoice in a ministry's records from
--                 someone it never contacted. Now organisation_id and
--                 quote_request_id are taken from the conversation the quote
--                 belongs to, which must be one of the professional's own.
--
--   2. freelancers  A professional may edit their own profile, which until
--                 now included verified, featured, rating, review_count,
--                 client_rating, flagged, flag_reason, deactivated_at,
--                 user_id, email and created_at. Those now change only
--                 through the admin panel, the review routes and the
--                 account route (service role).
--
--   3. messages   Either side of a conversation could rewrite any column of
--                 its first message: the text, the subject, who it is from,
--                 which professional it is to. Now only the two unread flags
--                 (read, client_read) can be changed.
--
--   4. message_replies  Any signed-in user could add a reply to any
--                 conversation whose id they knew. Now only someone who can
--                 see the conversation can reply in it. The read rule is
--                 restated the same way, which also lets every member of an
--                 organisation read the replies in the organisation's
--                 conversations (section 27 did this for messages and quotes
--                 but not for replies).
--
-- Safe to re-run. Can be run before or after the code that goes with it.
--
-- To undo (reopens the gaps above, do not do this lightly):
--   DROP TRIGGER IF EXISTS quotes_guard_organisation ON public.quotes;
--   DROP TRIGGER IF EXISTS freelancers_guard_trust ON public.freelancers;
--   DROP TRIGGER IF EXISTS messages_guard_update ON public.messages;
-- ============================================================

-- ── 1. quotes: the organisation comes from the conversation ──
CREATE OR REPLACE FUNCTION public.quotes_guard_organisation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims     jsonb;
  thread_org uuid;
  thread_req uuid;
  thread_ok  boolean := false;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL OR coalesce(claims ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- An update that leaves these four alone is none of this guard's business.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.message_id       IS NOT DISTINCT FROM OLD.message_id
       AND NEW.freelancer_id    IS NOT DISTINCT FROM OLD.freelancer_id
       AND NEW.organisation_id  IS NOT DISTINCT FROM OLD.organisation_id
       AND NEW.quote_request_id IS NOT DISTINCT FROM OLD.quote_request_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- The conversation the quote says it belongs to, if it really is one of
  -- this professional's.
  IF NEW.message_id IS NOT NULL THEN
    SELECT m.organisation_id, m.quote_request_id, true
      INTO thread_org, thread_req, thread_ok
      FROM messages m
     WHERE m.id = NEW.message_id AND m.freelancer_id = NEW.freelancer_id;
  END IF;

  IF coalesce(thread_ok, false) THEN
    NEW.organisation_id := thread_org;
    IF NEW.quote_request_id IS NOT NULL THEN
      NEW.quote_request_id := thread_req;
    END IF;
  ELSE
    NEW.message_id       := NULL;
    NEW.organisation_id  := NULL;
    NEW.quote_request_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_guard_organisation ON public.quotes;
CREATE TRIGGER quotes_guard_organisation
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_guard_organisation();

-- ── 2. freelancers: trust columns are not the professional's to set ──
CREATE OR REPLACE FUNCTION public.freelancers_guard_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL OR coalesce(claims ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new profile belongs to the person creating it and starts with
    -- nothing earned.
    NEW.user_id        := coalesce(nullif(claims ->> 'sub', '')::uuid, NEW.user_id);
    NEW.email          := coalesce(nullif(claims ->> 'email', ''), NEW.email);
    NEW.rating         := 0;
    NEW.client_rating  := 0;
    NEW.review_count   := 0;
    NEW.verified       := false;
    NEW.featured       := false;
    NEW.phone_verified := false;
    NEW.phone          := NULL;
    NEW.flagged        := false;
    NEW.flag_reason    := NULL;
    NEW.deactivated_at := NULL;
  ELSE
    NEW.user_id        := OLD.user_id;
    NEW.email          := OLD.email;
    NEW.created_at     := OLD.created_at;
    NEW.rating         := OLD.rating;
    NEW.client_rating  := OLD.client_rating;
    NEW.review_count   := OLD.review_count;
    NEW.verified       := OLD.verified;
    NEW.featured       := OLD.featured;
    NEW.flagged        := OLD.flagged;
    NEW.flag_reason    := OLD.flag_reason;
    NEW.deactivated_at := OLD.deactivated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freelancers_guard_trust ON public.freelancers;
CREATE TRIGGER freelancers_guard_trust
  BEFORE INSERT OR UPDATE ON public.freelancers
  FOR EACH ROW EXECUTE FUNCTION public.freelancers_guard_trust();

-- ── 3. messages: only the unread flags change ──
CREATE OR REPLACE FUNCTION public.messages_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims           jsonb;
  want_read        boolean := NEW.read;
  want_client_read boolean := NEW.client_read;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL OR coalesce(claims ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW := OLD;
  NEW.read        := coalesce(want_read, OLD.read);
  NEW.client_read := coalesce(want_client_read, OLD.client_read);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard_update ON public.messages;
CREATE TRIGGER messages_guard_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_guard_update();

-- ── 4. message_replies: reply and read only where you can see the thread ──
-- The inner SELECT runs as the person asking, so the messages read rule
-- ("Participants can read messages": the professional, the sender, the
-- sender's email, a member of the organisation) decides both.
DROP POLICY IF EXISTS "Anyone can reply"                    ON message_replies;
DROP POLICY IF EXISTS "Signed-in users reply as themselves" ON message_replies;
CREATE POLICY "Signed-in users reply as themselves"
  ON message_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_replies.message_id)
  );

DROP POLICY IF EXISTS "Participants can read replies" ON message_replies;
CREATE POLICY "Participants can read replies"
  ON message_replies FOR SELECT
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_replies.message_id));

-- Verify: should return three rows.
--   SELECT tgname FROM pg_trigger
--   WHERE tgname IN ('quotes_guard_organisation', 'freelancers_guard_trust', 'messages_guard_update');

-- ============================================================
-- SECTION 41 — A PROFESSIONAL'S CONTACT DETAILS ARE NOT PUBLIC (2026-11-12)
--
--   >>> RUN THIS ONLY AFTER THE MATCHING CODE IS LIVE. <<<
--   Older pages read whole rows of this table (select *), and after this
--   runs that request is refused. Sections 39 and 40 have no such order.
--
-- Anyone holding the public key (it ships in every browser) could read
-- every professional's email address, phone number, payment details,
-- default terms and the admin's private flag note, for the whole table in
-- one request. Row level security cannot hide columns, so this uses column
-- privileges: the public roles may read the listed columns and no others.
--
-- Two functions give those details to the people who should have them:
--
--   my_freelancer()            the caller's own profile, complete
--   freelancer_contact(id)     a professional's email, for someone who is in
--                              a conversation with them or has a quote from
--                              them; and their phone and payment details,
--                              for someone who has a quote from them (those
--                              appear on quotes, invoices and receipts)
--
-- IMPORTANT FOR LATER: a column added to freelancers after this is NOT
-- readable by the site until it is granted. Add it to the GRANT below (or
-- run GRANT SELECT (new_column) ON public.freelancers TO anon, authenticated).
--
-- Safe to re-run.
--
-- To undo:
--   GRANT SELECT ON public.freelancers TO anon, authenticated;
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_freelancer()
RETURNS SETOF public.freelancers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.* FROM freelancers f
  WHERE f.user_id = auth.uid()
  ORDER BY f.created_at
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.my_freelancer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_freelancer() TO authenticated;

CREATE OR REPLACE FUNCTION public.freelancer_contact(p_freelancer_id uuid)
RETURNS TABLE (freelancer_id uuid, email text, phone text, payment_details text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid, lower(nullif(auth.jwt() ->> 'email', '')) AS email
  ), f AS (
    SELECT fr.* FROM freelancers fr WHERE fr.id = p_freelancer_id
  ), rel AS (
    SELECT
      EXISTS (SELECT 1 FROM f, me WHERE f.user_id = me.uid) AS is_owner,
      EXISTS (
        SELECT 1 FROM messages m, me
        WHERE m.freelancer_id = p_freelancer_id
          AND (m.sender_user_id = me.uid
               OR (m.sender_email IS NOT NULL AND lower(m.sender_email) = me.email)
               OR (m.organisation_id IS NOT NULL AND m.organisation_id IN (SELECT my_organisation_ids())))
      ) AS in_thread,
      EXISTS (
        SELECT 1 FROM quotes q, me
        WHERE q.freelancer_id = p_freelancer_id
          AND ((q.client_email IS NOT NULL AND lower(q.client_email) = me.email)
               OR (q.organisation_id IS NOT NULL AND q.organisation_id IN (SELECT my_organisation_ids())))
      ) AS has_quote
  )
  SELECT f.id,
         f.email,
         CASE WHEN rel.is_owner OR rel.has_quote THEN f.phone END,
         CASE WHEN rel.is_owner OR rel.has_quote THEN f.payment_details END
  FROM f, rel, me
  WHERE me.uid IS NOT NULL
    AND (rel.is_owner OR rel.in_thread OR rel.has_quote)
$$;

REVOKE ALL ON FUNCTION public.freelancer_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.freelancer_contact(uuid) TO authenticated;

REVOKE SELECT ON public.freelancers FROM anon, authenticated;
GRANT SELECT (
  id, user_id, created_at, name, company_name, trade, category, extra_categories, ventures,
  location, bio, skills, qualifications, years_experience, hourly_rate, min_price, avatar_url,
  available, rating, client_rating, review_count, verified, featured, phone_verified,
  hidden, deactivated_at, govt_vendor_status,
  handle, handle_changed_at, previous_handle, previous_handle_until,
  auto_invoice_default
) ON public.freelancers TO anon, authenticated;

-- Verify: should list the six private columns and nothing else.
--   SELECT column_name FROM information_schema.columns c
--   WHERE table_schema = 'public' AND table_name = 'freelancers'
--     AND NOT has_column_privilege('anon', 'public.freelancers', column_name, 'SELECT');

-- ============================================================
-- SECTION 42 — STORAGE: ONLY THE OWNER CAN CHANGE THEIR FILES (2026-11-13)
-- Found 2026-11-13: anyone, signed in or not, could upload, overwrite and
-- delete any file in the avatars bucket (any file type, HTML included), and
-- anyone could list the files in avatars, portfolio, service-images,
-- review-photos and chat-photos. The rules for those buckets were set up by
-- hand in the Supabase dashboard; the ones in section 2.6 were only ever
-- commented-out examples.
--
-- This replaces them. For each photo bucket a signed-in person may add,
-- replace and delete only their own files, and see only their own in a
-- file listing. Nobody can list anyone else's. Photos still show for
-- everyone, because the buckets stay public: a public bucket serves its
-- files by link without checking these rules.
--
-- Whose file it is comes from where it is saved, matching the site's code:
--   avatars          <user id>.<jpg|jpeg|png|webp>
--                    (older uploads: avatars/<user id>-<time>.jpg, which
--                    the owner can still delete)
--   portfolio        <user id>/...   (older uploads: portfolio/<user id>/...)
--   service-images   <user id>/...
--   review-photos    <user id>/...   (the site saved these under the
--                    professional's id until 2026-11-13; it now uses the
--                    reviewer's)
--   chat-photos      <user id>/...   (section 15; only its open file
--                    listing changes here)
--
-- The five photo buckets also accept only JPG, PNG and WebP images up to
-- 10 MB, the same rule the site's upload forms already apply.
--
-- quote-attachments (section 30) is private and is not changed.
--
-- How the old rules are removed: every rule on storage files that names one
-- of the four buckets below, or names no bucket at all (such a rule applies
-- to every bucket), is dropped. A rule that also names chat-photos or
-- quote-attachments is left alone and reported. The result grid at the end
-- lists every storage rule that remains.
--
-- Safe to re-run.
-- ============================================================

DO $$
DECLARE
  p           record;
  def         text;
  mine        boolean;
  others      boolean;
  any_bucket  boolean;
BEGIN
  FOR p IN
    SELECT policyname, qual, with_check FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    def := coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '');
    mine := def ~ '''(avatars|portfolio|service-images|review-photos)''';
    others := def ~ '''(chat-photos|quote-attachments)''';
    any_bucket := def ~ 'bucket_id';
    IF (mine AND NOT others) OR NOT any_bucket THEN
      EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
      RAISE NOTICE 'Removed storage rule: %', p.policyname;
    ELSIF mine THEN
      RAISE NOTICE 'Left in place (also covers chat-photos or quote-attachments): %', p.policyname;
    END IF;
  END LOOP;
END $$;

-- ── avatars ──
CREATE POLICY "avatars owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (
    name ~ ('^' || auth.uid()::text || '\.(jpe?g|png|webp)$')
    OR name LIKE 'avatars/' || auth.uid()::text || '-%'));
CREATE POLICY "avatars owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name ~ ('^' || auth.uid()::text || '\.(jpe?g|png|webp)$'));
CREATE POLICY "avatars owner replace" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name ~ ('^' || auth.uid()::text || '\.(jpe?g|png|webp)$'))
  WITH CHECK (bucket_id = 'avatars' AND name ~ ('^' || auth.uid()::text || '\.(jpe?g|png|webp)$'));
CREATE POLICY "avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (
    name ~ ('^' || auth.uid()::text || '\.(jpe?g|png|webp)$')
    OR name LIKE 'avatars/' || auth.uid()::text || '-%'));

-- ── portfolio ──
CREATE POLICY "portfolio owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'portfolio' AND (storage.foldername(name))[2] = auth.uid()::text)));
CREATE POLICY "portfolio owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portfolio owner replace" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portfolio owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'portfolio' AND (storage.foldername(name))[2] = auth.uid()::text)));

-- ── service-images ──
CREATE POLICY "service-images owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "service-images owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "service-images owner replace" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "service-images owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── review-photos ──
CREATE POLICY "review-photos owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "review-photos owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "review-photos owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── chat-photos: no more open file listing (section 15 allowed anyone) ──
DROP POLICY IF EXISTS "chat-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "chat-photos owner read" ON storage.objects;
CREATE POLICY "chat-photos owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── the photo buckets take photos only ──
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'portfolio', 'service-images', 'review-photos', 'chat-photos');

-- Every storage rule now in place. Expect the 16 above, plus the chat-photos
-- upload rule (section 15) and the three quote-attachments rules (section 30):
-- 20 rows.
SELECT policyname, cmd, roles::text AS who
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- ============================================================
-- SECTION 43 — RISING TALENT BADGE (2026-11-13)
--
--   >>> RUN THIS BEFORE THE MATCHING CODE GOES LIVE. <<<
--   The pages ask for the new column by name; until it exists, search,
--   profiles and category pages would fail to load. Adding it first is
--   harmless: nothing reads it until the code arrives.
--
-- The Vetted Rising page promises members "a Rising Talent badge for your
-- first 90 days". This is that badge.
--
--   freelancers.rising_since   when the badge was given. Set and cleared only
--                              from the admin panel (/api/admin, service role).
--                              The badge shows while this is under 90 days ago
--                              (lib/rising.js) and ends by itself.
--
-- Two follow-on changes:
--   - Section 41 lets the public read only the columns it names, so the new
--     column is granted here.
--   - Section 40's guard stops a professional setting their own trust marks;
--     rising_since is added to it, so nobody can give themselves the badge.
--
-- Safe to re-run.
-- ============================================================

ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS rising_since timestamptz;

GRANT SELECT (rising_since) ON public.freelancers TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.freelancers_guard_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL OR coalesce(claims ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new profile belongs to the person creating it and starts with
    -- nothing earned.
    NEW.user_id        := coalesce(nullif(claims ->> 'sub', '')::uuid, NEW.user_id);
    NEW.email          := coalesce(nullif(claims ->> 'email', ''), NEW.email);
    NEW.rating         := 0;
    NEW.client_rating  := 0;
    NEW.review_count   := 0;
    NEW.verified       := false;
    NEW.featured       := false;
    NEW.phone_verified := false;
    NEW.phone          := NULL;
    NEW.flagged        := false;
    NEW.flag_reason    := NULL;
    NEW.deactivated_at := NULL;
    NEW.rising_since   := NULL;
  ELSE
    NEW.user_id        := OLD.user_id;
    NEW.email          := OLD.email;
    NEW.created_at     := OLD.created_at;
    NEW.rating         := OLD.rating;
    NEW.client_rating  := OLD.client_rating;
    NEW.review_count   := OLD.review_count;
    NEW.verified       := OLD.verified;
    NEW.featured       := OLD.featured;
    NEW.flagged        := OLD.flagged;
    NEW.flag_reason    := OLD.flag_reason;
    NEW.deactivated_at := OLD.deactivated_at;
    NEW.rising_since   := OLD.rising_since;
  END IF;
  RETURN NEW;
END;
$$;

-- Verify: should return one row, rising_since, readable by the public.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'freelancers' AND column_name = 'rising_since'
--     AND has_column_privilege('anon', 'public.freelancers', column_name, 'SELECT');

-- ============================================================
-- SECTION 44 — DEPOSITS AND PART PAYMENTS (2026-11-14)
--
--   >>> RUN THIS BEFORE THE MATCHING CODE GOES LIVE. <<<
--   Additive and harmless on its own; the new code reads these columns.
--
-- Trades here often work on 50% upfront. This lets a quote ask for a
-- deposit, invoices take part payments, and a deposit job be invoiced twice
-- (the deposit, then the balance).
--
-- There is no invoices table: an invoice is the quote's own row with its
-- invoice_* columns set (lib/invoicing.js). So the columns go on quotes, and
-- a deposit job keeps BOTH its invoices on that one row (lib/payments.js):
--
--   deposit_type, deposit_value   on the quote: 'percent' (1 to 100) or
--                                 'fixed' (Bds$); both empty = no deposit
--   is_deposit                    the row's first invoice is the deposit
--   invoice_amount                that first invoice's amount when it is
--                                 the deposit (otherwise it is the total)
--   balance_invoice_number,       the second invoice, for the rest, raised
--   balance_invoiced_at,          once the deposit is paid
--   balance_invoice_terms,
--   balance_invoice_due_date
--   amount_paid                   running total of invoice_payments,
--                                 kept by the trigger below, never typed in
--
-- No parent_quote_id is needed: both invoices sit on the parent quote's row.
--
-- invoice_payments: one row per payment received (a deposit, a second
-- payment, a final one), never overwritten. A mistaken entry is deleted and
-- entered again.
--
-- Who can see and change payments (row level security):
--   read     anyone who can read the quote: the professional, the client it
--            is addressed to, and members of the organisation it belongs to
--            (the same can_access_quote() rule the purchase orders use)
--   add      only the professional the quote belongs to, as themselves
--   delete   only the professional the quote belongs to
--   change   nobody (delete and enter again)
--
-- When payments reach the job's total, the trigger marks the job paid
-- (paid_at, status 'paid'), the same as ticking Paid used to. Deleting a
-- payment that takes it back below the total un-marks it.
--
-- Rules the database keeps, not just the screens (a professional can write
-- to their own rows without using the site):
--   - a payment is not dated in the future, is against one of the job's own
--     invoices, and never takes the job past what is owed; a job already
--     marked paid takes no more payments (invoice_payments_guard)
--   - a deposit invoice is never for more than the quote's total
--   - two payments saved at the same moment are counted one after the
--     other (the job's row is locked first), so neither is lost
--   - a removed payment leaves a record: invoice_payment_removals, written
--     only by the trigger, readable by everyone who can read the quote
--
-- Safe to re-run.
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS deposit_type             text,
  ADD COLUMN IF NOT EXISTS deposit_value            numeric,
  ADD COLUMN IF NOT EXISTS is_deposit               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_amount           numeric,
  ADD COLUMN IF NOT EXISTS balance_invoice_number   text,
  ADD COLUMN IF NOT EXISTS balance_invoiced_at      timestamptz,
  ADD COLUMN IF NOT EXISTS balance_invoice_terms    text,
  ADD COLUMN IF NOT EXISTS balance_invoice_due_date date,
  ADD COLUMN IF NOT EXISTS amount_paid              numeric DEFAULT 0;

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_deposit_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_deposit_check CHECK (
  (deposit_type IS NULL AND deposit_value IS NULL)
  OR (deposit_type = 'percent' AND deposit_value IS NOT NULL AND deposit_value > 0 AND deposit_value <= 100)
  OR (deposit_type = 'fixed' AND deposit_value IS NOT NULL AND deposit_value > 0)
);

-- A deposit invoice is for part of the job, never more than all of it.
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_invoice_amount_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_invoice_amount_check CHECK (
  invoice_amount IS NULL OR (invoice_amount > 0 AND invoice_amount <= total)
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id       uuid        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  invoice_number text,
  amount         numeric     NOT NULL CHECK (amount > 0),
  received_on    date        NOT NULL,
  method         text,
  reference      text,
  recorded_by    uuid        DEFAULT auth.uid(),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_payments_quote_idx ON invoice_payments (quote_id, received_on);

ALTER TABLE invoice_payments DROP CONSTRAINT IF EXISTS invoice_payments_sane;
ALTER TABLE invoice_payments ADD CONSTRAINT invoice_payments_sane CHECK (
  received_on >= DATE '2000-01-01'
  AND char_length(coalesce(method, '')) <= 80
  AND char_length(coalesce(reference, '')) <= 120
  AND char_length(coalesce(invoice_number, '')) <= 60
);

-- Payments that were removed: what was entered, who took it off, and when.
-- Nobody can write here except the trigger below.
CREATE TABLE IF NOT EXISTS invoice_payment_removals (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id       uuid        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  invoice_number text,
  amount         numeric     NOT NULL,
  received_on    date        NOT NULL,
  method         text,
  reference      text,
  recorded_at    timestamptz,
  removed_by     uuid,
  removed_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_payment_removals_quote_idx ON invoice_payment_removals (quote_id, removed_at DESC);
ALTER TABLE invoice_payment_removals ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON invoice_payment_removals FROM anon, authenticated;
DROP POLICY IF EXISTS "Removed payments readable with the quote" ON invoice_payment_removals;
CREATE POLICY "Removed payments readable with the quote"
  ON invoice_payment_removals FOR SELECT
  USING (can_access_quote(quote_id));

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payments readable with the quote" ON invoice_payments;
CREATE POLICY "Payments readable with the quote"
  ON invoice_payments FOR SELECT
  USING (can_access_quote(quote_id));

DROP POLICY IF EXISTS "Professional records payments" ON invoice_payments;
CREATE POLICY "Professional records payments"
  ON invoice_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    recorded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM quotes q JOIN freelancers f ON f.id = q.freelancer_id
      WHERE q.id = invoice_payments.quote_id AND f.user_id = auth.uid() AND q.invoice_number IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Professional deletes payments" ON invoice_payments;
CREATE POLICY "Professional deletes payments"
  ON invoice_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q JOIN freelancers f ON f.id = q.freelancer_id
      WHERE q.id = invoice_payments.quote_id AND f.user_id = auth.uid()
    )
  );

-- Before a payment is saved: is it one the job can take?
-- Only speaks to the professional the job belongs to (and the service role);
-- anyone else falls through to the row level security rules above, which
-- refuse them without telling them anything about the job.
CREATE OR REPLACE FUNCTION public.invoice_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims    jsonb;
  q         quotes%ROWTYPE;
  paid_sum  numeric;
  job_total numeric;
  today     date := ((now() AT TIME ZONE 'UTC') - interval '4 hours')::date;  -- Barbados
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NOT NULL AND coalesce(claims ->> 'role', '') <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM quotes x JOIN freelancers f ON f.id = x.freelancer_id
    WHERE x.id = NEW.quote_id AND f.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Lock the job first. A second payment saved at the same moment waits
  -- here until this one is finished, then sees it.
  SELECT * INTO q FROM quotes WHERE id = NEW.quote_id FOR UPDATE;
  IF NOT FOUND OR q.invoice_number IS NULL THEN RETURN NEW; END IF;

  IF NEW.received_on > today + 1 THEN
    RAISE EXCEPTION 'A payment cannot be dated in the future.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.invoice_number IS NOT NULL
     AND NEW.invoice_number IS DISTINCT FROM q.invoice_number
     AND NEW.invoice_number IS DISTINCT FROM q.balance_invoice_number THEN
    RAISE EXCEPTION 'That invoice is not on this job.' USING ERRCODE = 'check_violation';
  END IF;
  IF q.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'This job is already marked as paid.' USING ERRCODE = 'check_violation';
  END IF;

  -- The invoiced total: the quote plus any costs billed on (section 47).
  job_total := coalesce(q.total, 0) + coalesce((to_jsonb(q) ->> 'billed_expenses_total')::numeric, 0);
  SELECT coalesce(sum(amount), 0) INTO paid_sum FROM invoice_payments WHERE quote_id = NEW.quote_id;
  IF paid_sum + NEW.amount > job_total + 0.005 THEN
    RAISE EXCEPTION 'That is more than is still owed on this job.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_payments_guard ON invoice_payments;
CREATE TRIGGER invoice_payments_guard
  BEFORE INSERT ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.invoice_payments_guard();

-- Keep quotes.amount_paid (and paid / not paid) in step with the payments.
-- Paid in full means the quote's total plus any costs billed on to the
-- client (section 47 adds that column; before it exists it counts as 0).
CREATE OR REPLACE FUNCTION public.invoice_payments_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qid       uuid := coalesce(NEW.quote_id, OLD.quote_id);
  paid_sum  numeric;
  last_day  date;
  q         quotes%ROWTYPE;
  job_total numeric;
  when_paid timestamptz;
BEGIN
  -- The job's row is locked before the payments are added up, so two
  -- changes at the same moment cannot each miss the other.
  SELECT * INTO q FROM quotes WHERE id = qid FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;  -- the whole job is being deleted
  SELECT coalesce(sum(amount), 0), max(received_on) INTO paid_sum, last_day
    FROM invoice_payments WHERE quote_id = qid;
  job_total := coalesce(q.total, 0) + coalesce((to_jsonb(q) ->> 'billed_expenses_total')::numeric, 0);

  IF TG_OP = 'DELETE' THEN
    INSERT INTO invoice_payment_removals (quote_id, invoice_number, amount, received_on, method, reference, recorded_at, removed_by)
    VALUES (OLD.quote_id, OLD.invoice_number, OLD.amount, OLD.received_on, OLD.method, OLD.reference, OLD.created_at, auth.uid());
  END IF;

  IF paid_sum >= job_total AND job_total > 0 AND q.paid_at IS NULL THEN
    -- Paid in full: dated the day the last payment came in (noon, Barbados).
    when_paid := (last_day::timestamp + interval '16 hours') AT TIME ZONE 'UTC';
    UPDATE quotes SET
      amount_paid  = paid_sum,
      paid_at      = when_paid,
      completed_at = coalesce(completed_at, when_paid),
      status       = 'paid'
    WHERE id = qid;
  ELSIF TG_OP = 'DELETE' AND paid_sum < job_total AND q.paid_at IS NOT NULL THEN
    -- A payment was taken back and the job is no longer paid in full.
    UPDATE quotes SET
      amount_paid = paid_sum,
      paid_at     = NULL,
      status      = CASE WHEN completed_at IS NOT NULL AND client_completed_at IS NOT NULL THEN 'completed' ELSE 'invoiced' END
    WHERE id = qid;
  ELSE
    UPDATE quotes SET amount_paid = paid_sum WHERE id = qid;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS invoice_payments_sync ON invoice_payments;
CREATE TRIGGER invoice_payments_sync
  AFTER INSERT OR DELETE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.invoice_payments_sync();

-- Verify: should list invoice_payments with its three rules and
-- invoice_payment_removals with one.
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('invoice_payments', 'invoice_payment_removals');

-- ============================================================
-- SECTION 45 — AUTOMATIC PAYMENT REMINDERS (2026-11-14)
--
--   >>> RUN THIS BEFORE THE MATCHING CODE GOES LIVE. <<<
--   The daily reminder job reads these columns; without them it stops
--   with an error and sends nothing.
--
-- A daily job (/api/cron/payment-reminders) emails clients about unpaid and
-- part-paid invoices: 3 days before the due date, on it, and at 7, 14 and 30
-- days overdue (lib/paymentReminders.js).
--
-- There is no invoices table (an invoice is the quote's row), so the
-- per-invoice columns go on quotes:
--   reminders_paused     the professional paused reminders on this invoice
--   last_reminder_sent   the Barbados day the last reminder went
--   reminder_stage       "<invoice number>:<stage>" of the last one sent
--                        (these two are for the professional's screen only;
--                        the job decides from payment_reminder_log below,
--                        because a professional can change their own row)
--
-- freelancers.payment_reminders_enabled: the professional's master switch,
-- on by default. Organisations are not given one: they receive invoices,
-- they do not send them. This column is not publicly readable (section 41);
-- the owner reads it through my_freelancer().
--
-- payment_reminder_log: one row per reminder, sent or (in dry-run mode)
-- only checked, so what went out is provable. It is also what the job reads
-- to know which stages an invoice has had. A unique index allows one real
-- reminder per invoice per Barbados day: a second attempt fails in the
-- database, not just in the code. `error` is 'pending' while the email is
-- going, empty once it was accepted, and the reason if it failed (a failed
-- one is tried again another day). Readable by the professional the invoice
-- belongs to; written only by the job (service role).
--
-- Safe to re-run.
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS reminders_paused   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_reminder_sent date,
  ADD COLUMN IF NOT EXISTS reminder_stage     text;

ALTER TABLE freelancers
  ADD COLUMN IF NOT EXISTS payment_reminders_enabled boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS payment_reminder_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id       uuid        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  invoice_number text        NOT NULL,
  stage          text        NOT NULL,
  sent_on        date        NOT NULL,
  amount         numeric     NOT NULL,
  recipients     text[]      NOT NULL DEFAULT '{}',
  dry_run        boolean     NOT NULL DEFAULT false,
  error          text,
  created_at     timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_reminder_log_once_a_day
  ON payment_reminder_log (quote_id, invoice_number, sent_on) WHERE NOT dry_run;
CREATE INDEX IF NOT EXISTS payment_reminder_log_quote_idx ON payment_reminder_log (quote_id, created_at DESC);

ALTER TABLE payment_reminder_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professional reads own reminder log" ON payment_reminder_log;
CREATE POLICY "Professional reads own reminder log"
  ON payment_reminder_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes q JOIN freelancers f ON f.id = q.freelancer_id
    WHERE q.id = payment_reminder_log.quote_id AND f.user_id = auth.uid()
  ));

-- Verify: the last reminders the job sent (or checked, in dry-run mode).
--   SELECT sent_on, invoice_number, stage, amount, dry_run, error, recipients
--   FROM payment_reminder_log ORDER BY created_at DESC LIMIT 20;

-- ============================================================
-- SECTION 46 — RATE LIMITS THAT HOLD ACROSS SERVERS (2026-11-14)
-- Twelve API routes limit how often they can be called (for example 5
-- enquiries per 10 minutes from one connection). The counts used to live in
-- the memory of whichever Vercel server answered, so they reset whenever a
-- server restarted and each server counted on its own: a speed bump, not a
-- limit. The counts now live here, shared by every server (lib/rateLimit.js).
--
--   rate_limits        one row per key per time window, with a hit count.
--                      Keys are hashed in the app, so no IP address or user
--                      id is stored in readable form.
--   rate_limit_hit()   counts one request and answers whether it is within
--                      the limit, in one atomic step. It uses a sliding
--                      window (this window's count plus the share of the
--                      last window still inside the period), so a burst
--                      across a window boundary is not let through double.
--
-- Only the service role (the API routes) can use either; the public key can
-- neither read the counts nor call the function. Old rows are deleted by the
-- daily clean-up job.
--
-- Safe to re-run. Before it runs, the routes fall back to the old
-- per-server counts, so nothing breaks either way.
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  win        double precision := greatest(coalesce(p_window_seconds, 60), 1);
  now_epoch  double precision := extract(epoch FROM clock_timestamp());
  cur_start  timestamptz := to_timestamp(floor(now_epoch / win) * win);
  prev_start timestamptz := cur_start - make_interval(secs => win);
  cur_hits   integer;
  prev_hits  integer;
  elapsed    double precision;
BEGIN
  INSERT INTO rate_limits AS r (key, window_start, hits)
  VALUES (p_key, cur_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO cur_hits;

  SELECT hits INTO prev_hits FROM rate_limits WHERE key = p_key AND window_start = prev_start;
  elapsed := (now_epoch - extract(epoch FROM cur_start)) / win;

  RETURN cur_hits + coalesce(prev_hits, 0) * (1 - elapsed) <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

-- Verify: the busiest keys right now (hashed).
--   SELECT key, window_start, hits FROM rate_limits ORDER BY hits DESC LIMIT 10;

-- ============================================================
-- SECTION 47 — JOB EXPENSES (2026-11-14)
--
--   >>> RUN THIS BEFORE THE MATCHING CODE GOES LIVE. <<<
--
-- A professional can log what a job cost them (materials, parts, hire),
-- with an optional receipt photo, and choose to bill an expense on to the
-- client. Profit = what was invoiced minus what it cost.
--
-- WHO CAN SEE WHAT. Expenses are the professional's private commercial data:
--
--   job_expenses        only the professional who logged it can read, add,
--                       change or delete a row, and only against their own
--                       jobs. Nobody else, ever: no client, no organisation,
--                       no public read. The service role (the automatic
--                       invoice) reads it to copy billed lines.
--   receipts bucket     PRIVATE (not public like portfolio): a receipt photo
--                       is only reachable by its owner through a short-lived
--                       signed link. Files live under <user id>/... and only
--                       that user can add, see or delete them.
--
-- An expense reaches the client only when the professional ticks "Bill to
-- client", and only as a copy made when the invoice is issued:
--
--   quotes.billed_expenses        [{description, amount, incurred_on}], the
--                                 cost lines printed on the invoice
--   quotes.billed_expenses_total  their sum; the invoice total is the
--                                 quote's total plus this
--   job_expenses.billed_invoice_number   the invoice a billed expense went
--                                 on, so it is never billed twice
--
-- Unbilled expenses are never copied, so no client-facing page, document or
-- email can show them: those all read the quotes row, never job_expenses.
--
-- The invoices are rows in quotes (there is no invoices table), so there is
-- no invoice_id column: quote_id identifies the job and its invoices.
--
-- Also here, because the invoice total now includes billed costs:
--   - verify_document() reports that same invoiced total
--   (the part-payment triggers in section 44 already count billed costs as
--   soon as this section has added the column)
--
-- Rules the database keeps, not just the screens: billed costs are never
-- negative; an expense has a sensible date, amount and length; only
-- professionals can upload receipts, up to 2,000 files each.
--
-- Safe to re-run.
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS billed_expenses       jsonb,
  ADD COLUMN IF NOT EXISTS billed_expenses_total numeric DEFAULT 0;

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_billed_expenses_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_billed_expenses_check CHECK (
  (billed_expenses_total IS NULL OR billed_expenses_total >= 0)
  AND CASE
        WHEN billed_expenses IS NULL THEN true
        WHEN jsonb_typeof(billed_expenses) <> 'array' THEN false
        ELSE jsonb_array_length(billed_expenses) <= 200
      END
);

CREATE TABLE IF NOT EXISTS job_expenses (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id         uuid        NOT NULL REFERENCES freelancers(id) ON DELETE CASCADE,
  quote_id              uuid        REFERENCES quotes(id) ON DELETE CASCADE,
  description           text        NOT NULL CHECK (length(trim(description)) > 0),
  amount                numeric     NOT NULL CHECK (amount > 0),
  incurred_on           date        NOT NULL,
  receipt_url           text,
  bill_to_client        boolean     NOT NULL DEFAULT false,
  billed_invoice_number text,
  created_at            timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_expenses_quote_idx ON job_expenses (quote_id);

ALTER TABLE job_expenses DROP CONSTRAINT IF EXISTS job_expenses_sane;
ALTER TABLE job_expenses ADD CONSTRAINT job_expenses_sane CHECK (
  incurred_on BETWEEN DATE '2000-01-01' AND DATE '2100-01-01'
  AND amount < 100000000
  AND char_length(description) <= 500
  AND char_length(coalesce(receipt_url, '')) <= 500
  AND char_length(coalesce(billed_invoice_number, '')) <= 60
);
CREATE INDEX IF NOT EXISTS job_expenses_freelancer_idx ON job_expenses (freelancer_id, incurred_on);

ALTER TABLE job_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON job_expenses FROM anon;

DROP POLICY IF EXISTS "Professional manages own expenses" ON job_expenses;
CREATE POLICY "Professional manages own expenses"
  ON job_expenses FOR ALL
  TO authenticated
  USING (freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid()))
  WITH CHECK (
    freelancer_id IN (SELECT id FROM freelancers WHERE user_id = auth.uid())
    AND (quote_id IS NULL OR quote_id IN (
      SELECT q.id FROM quotes q JOIN freelancers f ON f.id = q.freelancer_id WHERE f.user_id = auth.uid()
    ))
  );

-- ── receipts bucket: private, owner-only ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "receipts owner read" ON storage.objects;
CREATE POLICY "receipts owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
-- Receipts are for professionals, and not without limit: 2,000 files each.
CREATE OR REPLACE FUNCTION public.receipts_upload_allowed()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT EXISTS (SELECT 1 FROM public.freelancers WHERE user_id = auth.uid())
     AND (SELECT count(*) FROM storage.objects
           WHERE bucket_id = 'receipts' AND name LIKE auth.uid()::text || '/%') < 2000
$$;
REVOKE ALL ON FUNCTION public.receipts_upload_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipts_upload_allowed() TO authenticated;

DROP POLICY IF EXISTS "receipts owner upload" ON storage.objects;
CREATE POLICY "receipts owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text AND public.receipts_upload_allowed());
DROP POLICY IF EXISTS "receipts owner delete" ON storage.objects;
CREATE POLICY "receipts owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── document verification: the invoiced total includes billed costs ──
CREATE OR REPLACE FUNCTION public.verify_document(p_code text)
RETURNS TABLE (
  quote_number          text,
  invoice_number        text,
  status                text,
  total                 numeric,
  currency              text,
  quote_date            text,
  invoiced_at           timestamptz,
  completed_at          timestamptz,
  paid_at               timestamptz,
  issuer_name           text,
  billed_to             text,
  organisation_verified boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.quote_number, q.invoice_number, q.status,
         (q.total + CASE WHEN q.invoice_number IS NOT NULL THEN coalesce(q.billed_expenses_total, 0) ELSE 0 END)::numeric,
         COALESCE(q.currency, 'BBD'),
         q.quote_date::text, q.invoiced_at, q.completed_at, q.paid_at,
         COALESCE(NULLIF(trim(f.company_name), ''), f.name) AS issuer_name,
         q.client_name AS billed_to,
         COALESCE(o.verified, false) AS organisation_verified
    FROM quotes q
    JOIN freelancers f ON f.id = q.freelancer_id
    LEFT JOIN organisations o ON o.id = q.organisation_id
   WHERE q.verify_code = upper(trim(p_code))
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated;

-- Verify: should list the one expenses rule and the three receipts rules.
--   SELECT tablename, policyname FROM pg_policies
--   WHERE tablename = 'job_expenses' OR policyname LIKE 'receipts %';
