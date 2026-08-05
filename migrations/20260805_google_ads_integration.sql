-- Google Ads integration for /reports/profit auto-populating ad spend per location.
-- Mirrors the sms_api_key_encrypted/sms_api_key_iv pattern already used for Dialpad,
-- but bundles all four OAuth credentials (developer token, client id/secret, refresh
-- token) into one encrypted JSON blob instead of four separate encrypted columns.

alter table businesses add column if not exists google_ads_customer_id text;
alter table businesses add column if not exists google_ads_enabled boolean not null default false;
alter table businesses add column if not exists google_ads_credentials_encrypted text;
alter table businesses add column if not exists google_ads_credentials_iv text;
