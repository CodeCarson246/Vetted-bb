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
