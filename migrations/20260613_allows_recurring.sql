-- Add allows_recurring flag to services.
-- One-off services (End of Lease Clean, Move In Clean) are set to false
-- so recurring frequency options are hidden and the server enforces one_time.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS allows_recurring boolean NOT NULL DEFAULT true;

UPDATE services SET allows_recurring = false
WHERE id IN (
  'c0d6f49d-210a-415a-b699-037c061a0e2f',  -- End of Lease Clean
  'db546eed-5e05-4aa5-9623-add793e949db'   -- Move In Clean
);
