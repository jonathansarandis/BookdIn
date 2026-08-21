-- Adds a column to hold a *test-only* Vapi assistant id, separate from
-- businesses.vapi_assistant_id (the live one your phone number is assigned
-- to). Used by the "Test: OpenAI Realtime voice" section on the Voice Agent
-- settings card so Jonathan can compare the OpenAI Realtime speech-to-speech
-- model against the current cascaded Claude+11labs+Deepgram pipeline without
-- touching the live assistant or the number customers actually call.
alter table businesses add column if not exists vapi_test_assistant_id text;
