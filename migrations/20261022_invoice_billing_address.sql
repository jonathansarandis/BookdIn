-- Free-text billing address printed under "Bill to" on the invoice PDF (manual invoices / old customers).
alter table invoices add column if not exists billing_address text;
