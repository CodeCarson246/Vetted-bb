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
