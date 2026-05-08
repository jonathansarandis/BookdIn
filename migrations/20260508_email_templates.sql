-- Email templates: per-tenant customizable email content
-- Run this in Supabase SQL Editor

-- Step 1: Add cancellation policy columns to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cancellation_fee_cents integer DEFAULT 5000;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cancellation_cutoff text DEFAULT '5 PM';

-- Step 2: Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, template_type)
);

CREATE INDEX IF NOT EXISTS email_templates_business_idx ON email_templates(business_id);

-- Step 3: Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_email_templates" ON email_templates
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auth_write_email_templates" ON email_templates
  FOR ALL TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- Step 4: updated_at trigger
-- NOTE: this requires update_updated_at_column() to already exist in your DB.
-- If you see an error here, skip this block — the updated_at column will simply
-- not auto-update on edits (no functional impact on the feature).
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
