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
