alter table businesses add column if not exists voice_agent_knowledge text;
alter table voice_calls add column if not exists is_urgent boolean default false;
