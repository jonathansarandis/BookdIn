-- Add frequency_discount_eligible flag to services.
-- One-off services (Deep Reset Clean, End of Lease Clean) are set to false
-- so the frequency discount is never applied to them at booking time.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS frequency_discount_eligible boolean NOT NULL DEFAULT true;

UPDATE services
SET frequency_discount_eligible = false
WHERE id IN (
  'c0a10d0a-fc65-4865-87f2-c6127052a045',  -- Deep Reset Clean
  'c0d6f49d-210a-415a-b699-037c061a0e2f'   -- End of Lease Clean
);
