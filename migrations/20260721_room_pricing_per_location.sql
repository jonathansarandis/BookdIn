-- Migration: per-location room pricing adders (VA Request 8, Path 1)
--
-- Adds an optional location_id to room_pricing so bedroom/bathroom adders can
-- vary per location, matching how location_services already overrides base_price.
--
--   location_id IS NULL  -> service-level default (all existing rows stay as-is)
--   location_id = <loc>  -> override for that location
--
-- Lookup should prefer the location-specific row and fall back to the default.

-- 1. Add the column (additive, nullable; existing 32 rows become defaults)
ALTER TABLE room_pricing
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE CASCADE;

-- 2. Index for the booking lookup (filters on service + location)
CREATE INDEX IF NOT EXISTS room_pricing_service_location_idx
  ON room_pricing(service_id, location_id);

-- 3. Uniqueness guard we were missing: one price per (service, location, type, count).
--    NULLS NOT DISTINCT makes default rows (location_id IS NULL) unique too.
--    Requires Postgres 15+ (Supabase runs 15+).
CREATE UNIQUE INDEX IF NOT EXISTS room_pricing_unique_combo
  ON room_pricing(service_id, location_id, type, count) NULLS NOT DISTINCT;

-- Rollback:
--   DROP INDEX IF EXISTS room_pricing_unique_combo;
--   DROP INDEX IF EXISTS room_pricing_service_location_idx;
--   ALTER TABLE room_pricing DROP COLUMN IF EXISTS location_id;
