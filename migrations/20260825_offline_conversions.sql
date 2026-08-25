-- Offline conversion upload (gclid -> Google Ads) support.
-- google_ads_conversion_action_id: the Conversion Action resource created in
-- Google Ads (Tools & Settings > Conversions > New > Import > Other data
-- sources or CRMs > Track conversions from clicks). Accepts either the bare
-- numeric ID or the full "customers/123/conversionActions/456" resource name.
alter table businesses add column if not exists google_ads_conversion_action_id text;

-- Idempotency guard + debugging trail for the upload itself. A job is only
-- ever uploaded once (conversion_uploaded_at set), and the last failure (if
-- any) is kept around so it's visible without digging through server logs.
alter table jobs add column if not exists conversion_uploaded_at timestamptz;
alter table jobs add column if not exists conversion_upload_error text;
