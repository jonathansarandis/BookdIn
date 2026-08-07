-- Voice agent integration (Vapi.ai): per-business config columns on `businesses`,
-- plus a `voice_calls` log table for call history, transcripts, and booking linkage.
--
-- Voice provider defaults to ElevenLabs "Charlotte" (Australian female) — businesses
-- can override voice_provider/voice_id from Settings to pick a different AU voice.

alter table businesses add column if not exists voice_enabled boolean not null default false;
alter table businesses add column if not exists voice_phone_number text;
alter table businesses add column if not exists vapi_assistant_id text;
alter table businesses add column if not exists voice_agent_name text not null default 'Aria';
alter table businesses add column if not exists voice_agent_personality text;
alter table businesses add column if not exists voice_provider text not null default 'elevenlabs';
alter table businesses add column if not exists voice_id text not null default 'XB0fDUnXU5powFXDhCwa';

create table voice_calls (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses(id) on delete cascade,
  vapi_call_id       text,
  phone_number_from  text,
  phone_number_to    text,
  status             text not null default 'in_progress',
  duration_seconds   integer,
  transcript         text,
  recording_url      text,
  booking_id         uuid references jobs(id) on delete set null,
  created_at         timestamptz not null default now(),
  ended_at           timestamptz
);

create index voice_calls_business_id_idx on voice_calls(business_id, created_at desc);
-- Plain (non-partial) unique index: Postgres treats NULL as distinct from NULL for
-- uniqueness, so multiple rows with vapi_call_id null are still allowed, while this
-- stays usable as an ON CONFLICT (vapi_call_id) target for the call-events upsert.
create unique index voice_calls_vapi_call_id_idx on voice_calls(vapi_call_id);

alter table voice_calls enable row level security;
create policy "voice_calls_business" on voice_calls for all
  using (business_id = get_my_business_id());
