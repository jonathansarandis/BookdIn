-- Add is_quantifiable flag to extras catalog and quantity to job_extras.
-- is_quantifiable defaults false: all existing extras stay on/off until admin opts in.
-- quantity defaults 1: backfills all existing job_extras rows; CHECK enforces minimum.

ALTER TABLE extras
  ADD COLUMN IF NOT EXISTS is_quantifiable boolean NOT NULL DEFAULT false;

ALTER TABLE job_extras
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1);
