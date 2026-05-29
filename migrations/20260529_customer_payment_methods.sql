-- Migration: customer_payment_methods junction table
-- One saved PM per (customer, business). Updated on each new card save, cleared on cancel.
-- RLS follows the existing profiles-based pattern: business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())

CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  customer_id               uuid        NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
  business_id               uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_payment_method_id  text        NOT NULL,
  card_brand                text,
  card_last4                text,
  card_exp_month            int,
  card_exp_year             int,
  CONSTRAINT uq_cpm_customer_business UNIQUE (customer_id, business_id)
);

CREATE INDEX IF NOT EXISTS cpm_customer_id_idx ON customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS cpm_business_id_idx ON customer_payment_methods(business_id);

ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpm_authenticated_read ON customer_payment_methods
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY cpm_authenticated_write ON customer_payment_methods
  FOR ALL TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));
