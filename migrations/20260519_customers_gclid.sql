-- Add Google click ID fields to customers table for ad conversion tracking
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gclid  text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text;
