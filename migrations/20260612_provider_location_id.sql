-- providers.location_id
--
-- This column already exists in prod as: uuid NOT NULL REFERENCES locations(id)
-- It was added outside of tracked migrations (Run A, 2026-06-12).
--
-- The statement below is safe to replay on any database:
--   - ADD COLUMN IF NOT EXISTS  → no-op if column already present (prod)
--   - nullable, no FK clause    → avoids NOT NULL failure on tables with existing
--                                  rows, and avoids FK ordering issues on fresh
--                                  schema setup
--
-- The NOT NULL constraint and FK that exist in prod must be applied manually
-- when bootstrapping a fresh database; they are recorded in schema.sql.

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS location_id uuid;
