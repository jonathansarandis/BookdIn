-- Business contact details: appear on customer emails, invoices, and quotes

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS street_address text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suburb text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS postcode text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country text DEFAULT 'Australia';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_number text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_number_label text DEFAULT 'ABN';
