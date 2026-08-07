-- SIP trunk connection for the voice agent: lets a business route an existing
-- Dialpad number (Settings → Office → Desk phones → Add desk phone → Generic
-- SIP phone) straight into Vapi as a BYO SIP trunk, instead of porting/buying
-- a number through Twilio.
--
-- SIP password is encrypted at rest with the same AES-256-GCM scheme already
-- used for Dialpad SMS credentials (see src/lib/crypto), split into
-- ciphertext + iv columns to mirror sms_api_key_encrypted/sms_api_key_iv.

alter table businesses add column if not exists voice_sip_username text;
alter table businesses add column if not exists voice_sip_password_encrypted text;
alter table businesses add column if not exists voice_sip_password_iv text;
alter table businesses add column if not exists voice_sip_domain text;
alter table businesses add column if not exists voice_sip_port integer not null default 5060;

-- Vapi-side identifiers, stored so re-running the "Connect via SIP" flow
-- updates the existing credential/phone number instead of creating duplicates.
alter table businesses add column if not exists vapi_sip_credential_id text;
alter table businesses add column if not exists vapi_sip_phone_number_id text;
