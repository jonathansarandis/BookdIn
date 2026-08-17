-- Adds:
--   1. businesses.voice_business_hours — a real settings-editable field, replacing the
--      hardcoded 'Monday to Saturday, 8am-6pm' fallback that's been baked into the voice
--      agent's system prompt since it was first built (never had a real column/UI field).
--   2. voice_calls.caller_name / actionable_notes / notes_reviewed_at — end-of-call, a
--      short LLM pass over the transcript extracts the caller's name (if given) and a
--      1-2 sentence actionable summary for the team, shown above the transcript on the
--      call detail page and surfaced as a "What needs you" task until reviewed.

alter table businesses add column if not exists voice_business_hours text;

alter table voice_calls add column if not exists caller_name text;
alter table voice_calls add column if not exists actionable_notes text;
alter table voice_calls add column if not exists notes_reviewed_at timestamptz;
