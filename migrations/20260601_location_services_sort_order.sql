-- Migration: per-location service ordering
-- Adds sort_order to location_services so each location can have its
-- own service display order, used by both admin and customer-side queries.

ALTER TABLE location_services
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ls_location_sort_idx
  ON location_services(location_id, sort_order);

-- Backfill: copy global services.sort_order as starting per-location order
UPDATE location_services ls
SET sort_order = s.sort_order
FROM services s
WHERE ls.service_id = s.id
  AND ls.sort_order = 0;
