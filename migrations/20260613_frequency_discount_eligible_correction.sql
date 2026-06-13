-- Correct frequency_discount_eligible flags after initial migration.
-- Deep Reset Clean reinstated as eligible; Move In Clean marked ineligible.

UPDATE services SET frequency_discount_eligible = true
WHERE id = 'c0a10d0a-fc65-4865-87f2-c6127052a045';  -- Deep Reset Clean

UPDATE services SET frequency_discount_eligible = false
WHERE id = 'db546eed-5e05-4aa5-9623-add793e949db';  -- Move In Clean
