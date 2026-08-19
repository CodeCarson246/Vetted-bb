-- ============================================================
-- VETTED RISING: APPLICATIONS TABLE
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Admin reads are NOT granted through RLS here. This codebase already
-- enforces admin access server-side: /api/admin verifies the caller's JWT
-- against the ADMIN_EMAILS env var and then queries with the service-role
-- key, which bypasses RLS entirely. Adding a database-level admin policy
-- would create a second, competing source of truth for "who is an admin",
-- so applications stay readable only via the service role.
-- ============================================================

CREATE TABLE IF NOT EXISTS vetted_rising_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  age integer NOT NULL,
  parish text NOT NULL,
  skill text NOT NULL,
  whatsapp text NOT NULL,
  notes text,
  cohort text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vetted_rising_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can apply. The API route validates every field before inserting,
-- and rate limits by IP.
DROP POLICY IF EXISTS "Anyone can submit an application" ON vetted_rising_applications;
CREATE POLICY "Anyone can submit an application"
  ON vetted_rising_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No SELECT / UPDATE / DELETE policy is defined on purpose. With RLS on and
-- no read policy, anon and authenticated clients cannot read applications at
-- all, which is what we want for personal contact details. Reads happen with
-- the service-role key, matching how the rest of the admin area works.

-- Newest applications first when reviewing a cohort.
CREATE INDEX IF NOT EXISTS vetted_rising_applications_created_idx
  ON vetted_rising_applications (created_at DESC);
