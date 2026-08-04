-- agent_daily_logs: one row per business per day, accumulated throughout the day so the
-- AI agent has continuity — it reads yesterday's row when building today's morning brief,
-- and today's row is appended to every time a VA sends a message, dismisses a task, or
-- logs a free-text outcome.
create table agent_daily_logs (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  date              date not null,
  tasks_actioned    jsonb not null default '[]'::jsonb,
  messages_sent     jsonb not null default '[]'::jsonb,
  outcomes          jsonb not null default '[]'::jsonb,
  revenue_recovered numeric not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (business_id, date)
);

alter table agent_daily_logs enable row level security;
create policy "agent_daily_logs_business" on agent_daily_logs for all
  using (business_id = get_my_business_id());

-- Atomic append to one of the jsonb array columns — avoids read-modify-write races when
-- multiple VAs act on tasks concurrently. Creates today's row on first write.
create or replace function append_agent_daily_log(
  p_business_id uuid, p_date date, p_field text, p_entry jsonb
) returns agent_daily_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  result agent_daily_logs;
begin
  if p_field not in ('tasks_actioned', 'messages_sent', 'outcomes') then
    raise exception 'invalid field: %', p_field;
  end if;

  insert into agent_daily_logs (business_id, date)
  values (p_business_id, p_date)
  on conflict (business_id, date) do nothing;

  if p_field = 'tasks_actioned' then
    update agent_daily_logs set tasks_actioned = tasks_actioned || p_entry
      where business_id = p_business_id and date = p_date returning * into result;
  elsif p_field = 'messages_sent' then
    update agent_daily_logs set messages_sent = messages_sent || p_entry
      where business_id = p_business_id and date = p_date returning * into result;
  else
    update agent_daily_logs set outcomes = outcomes || p_entry
      where business_id = p_business_id and date = p_date returning * into result;
  end if;

  return result;
end;
$$;
