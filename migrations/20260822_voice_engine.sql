-- Lets a business's LIVE Aria assistant (the one their real phone number is
-- assigned to) run on either the current cascaded pipeline (Claude + 11labs +
-- Deepgram) or OpenAI's native Realtime speech-to-speech model. Read by
-- create-assistant/route.ts to decide which payload builder to use.
--
-- Separate from vapi_test_assistant_id (added in 20260821_voice_test_assistant.sql)
-- — that column is for trying Realtime out on a throwaway assistant without
-- affecting the live number. This column is what actually controls the live one.
alter table businesses add column if not exists voice_engine text not null default 'cascaded';
alter table businesses add column if not exists voice_realtime_voice_id text not null default 'marin';
