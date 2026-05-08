-- Migration: Add card-setup token columns to jobs for unauthenticated card collection flow.
-- Safe to re-run (IF NOT EXISTS / IF EXISTS guards throughout).

-- ─── Token + payment method columns ──────────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS card_setup_token             text UNIQUE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS card_setup_token_expires_at  timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stripe_payment_method_id     text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stripe_customer_id           text;

-- ─── Index for fast single-use token lookups ─────────────────────────────────
CREATE INDEX IF NOT EXISTS jobs_card_setup_token_idx
  ON jobs(card_setup_token)
  WHERE card_setup_token IS NOT NULL;
