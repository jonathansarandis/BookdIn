-- Google Ads client accounts managed under a Manager (MCC) account require a
-- 'login-customer-id' header on every API call identifying which manager account
-- we're acting through — otherwise the API returns 403 USER_PERMISSION_DENIED even
-- when the connected user genuinely has access. Not sensitive (it's just an account
-- number, same shape as google_ads_customer_id), so stored in plain text.

alter table businesses add column if not exists google_ads_login_customer_id text;

update businesses
set google_ads_login_customer_id = '966-308-1184'
where id = '9363c6d5-31c1-4d56-90f4-cf6715eda809'; -- Clean Freaks
