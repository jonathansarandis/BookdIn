-- Second-stage offline conversion: fires when a customer's card is actually
-- captured (booking confirmed + card on file), not just when a lead form is
-- submitted and not only at job completion. This is a separate signal from
-- the existing google_ads_conversion_action_id / conversion_uploaded_at pair
-- (20260825_offline_conversions.sql), which stays tied to job completion —
-- reusing those columns here would make the completion-sync's "already
-- uploaded" check collide with this earlier upload for the same job.
alter table businesses add column if not exists google_ads_booking_conversion_action_id text;

alter table jobs add column if not exists booking_conversion_uploaded_at timestamptz;
alter table jobs add column if not exists booking_conversion_upload_error text;
