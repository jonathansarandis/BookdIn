-- Stores manually-entered invoice line items so custom (no linked job) invoices
-- show the real description/qty/price on the PDF instead of "Services rendered".
alter table invoices add column if not exists line_items jsonb;
