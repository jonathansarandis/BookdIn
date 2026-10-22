-- Payment instructions printed on every invoice PDF ("Please make payment to: ...").
alter table businesses add column if not exists invoice_payment_details text;

update businesses
set invoice_payment_details = E'Please make payment to:\n\nClean Freaks Australia\nAccount no. 35 942 3907\nBsb. 083 004'
where invoice_payment_details is null and name ilike '%clean freaks%';
