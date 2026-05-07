-- Migration: Refactor frequency_discounts from per-service to per-business
-- Also adds is_enabled flag so tenants can toggle each frequency independently.
-- Safe to re-run (uses IF EXISTS / ON CONFLICT guards throughout).

-- ─── 1. Add new columns ───────────────────────────────────────────────────────
ALTER TABLE frequency_discounts
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

-- ─── 2. Backfill business_id from the linked service row ─────────────────────
UPDATE frequency_discounts fd
SET business_id = s.business_id
FROM services s
WHERE s.id = fd.service_id
  AND fd.business_id IS NULL;

-- ─── 3. Enforce NOT NULL now that backfill is complete ────────────────────────
ALTER TABLE frequency_discounts ALTER COLUMN business_id SET NOT NULL;

-- ─── 4. Dedup: per-service model may have created one row per service per
--    frequency for the same business. Keep the row with the highest
--    discount_percent (ties: prefer most-recently inserted by id DESC).
DELETE FROM frequency_discounts
WHERE id NOT IN (
  SELECT DISTINCT ON (business_id, frequency) id
  FROM frequency_discounts
  ORDER BY business_id, frequency, discount_percent DESC, id DESC
);

-- ─── 5. Drop all existing UNIQUE constraints (they include service_id) ────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'frequency_discounts'
      AND constraint_type = 'UNIQUE'
  LOOP
    EXECUTE format('ALTER TABLE frequency_discounts DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

-- ─── 6. Drop service_id column (CASCADE removes any remaining FK/index) ───────
ALTER TABLE frequency_discounts DROP COLUMN IF EXISTS service_id CASCADE;

-- ─── 7. Add new unique constraint ────────────────────────────────────────────
ALTER TABLE frequency_discounts
  ADD CONSTRAINT frequency_discounts_business_frequency_key
  UNIQUE (business_id, frequency);

-- ─── 8. Seed Clean Freaks rows (safe re-run via ON CONFLICT DO NOTHING) ──────
INSERT INTO frequency_discounts (business_id, frequency, discount_percent, is_enabled)
VALUES
  ('9363c6d5-31c1-4d56-90f4-cf6715eda809', 'weekly',      5,  true),
  ('9363c6d5-31c1-4d56-90f4-cf6715eda809', 'fortnightly', 10, true),
  ('9363c6d5-31c1-4d56-90f4-cf6715eda809', 'monthly',     10, true)
ON CONFLICT (business_id, frequency) DO NOTHING;

-- ─── 9. Ensure anon SELECT policy is present ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'frequency_discounts'
      AND policyname = 'anon read frequency_discounts'
  ) THEN
    CREATE POLICY "anon read frequency_discounts"
      ON frequency_discounts FOR SELECT TO anon USING (true);
  END IF;
END $$;
