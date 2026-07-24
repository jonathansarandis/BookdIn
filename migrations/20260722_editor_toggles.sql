-- Migration: expose two per-service flags that the app already reads but the
-- editor couldn't set. Idempotent — safe whether or not the columns exist.
--
-- frequency_discount_eligible: when false, no frequency discount applies to the
--   service (both booking routes already respect this). Default true = current behaviour.
-- is_quantifiable (per add-on): when true, the booking form shows a +/- stepper so a
--   customer can add the same add-on multiple times (AddonsPicker already supports it).
--   Default false = current behaviour.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS frequency_discount_eligible boolean NOT NULL DEFAULT true;

ALTER TABLE service_extras
  ADD COLUMN IF NOT EXISTS is_quantifiable boolean NOT NULL DEFAULT false;
