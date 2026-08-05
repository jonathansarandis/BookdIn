-- Replaces the manually-pasted Client ID/Secret/Refresh Token from the previous
-- migration (20260805_google_ads_integration.sql) with a real OAuth flow.
-- Client ID/Secret move to env vars (GOOGLE_ADS_CLIENT_ID/GOOGLE_ADS_CLIENT_SECRET,
-- shared across all businesses, same OAuth app). Nothing was ever saved into the old
-- blob columns (verified before this migration), so dropping them is safe.

alter table businesses drop column if exists google_ads_credentials_encrypted;
alter table businesses drop column if exists google_ads_credentials_iv;

alter table businesses add column if not exists google_ads_developer_token_encrypted text;
alter table businesses add column if not exists google_ads_developer_token_iv text;
alter table businesses add column if not exists google_ads_refresh_token_encrypted text;
alter table businesses add column if not exists google_ads_refresh_token_iv text;
alter table businesses add column if not exists google_ads_connected_email text;
