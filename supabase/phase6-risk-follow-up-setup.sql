-- Incremental setup for standard reminders plus high-risk follow-ups.
-- Existing notification rows remain standard reminders.

alter table public.notification_logs
  add column if not exists reminder_type text not null default 'standard';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notification_logs_reminder_type_check'
      and conrelid = 'public.notification_logs'::regclass
  ) then
    alter table public.notification_logs
      add constraint notification_logs_reminder_type_check
      check (reminder_type in ('standard', 'high_risk_follow_up'));
  end if;
end
$$;

drop index if exists public.notification_one_active_sms_per_appointment;
drop index if exists public.notification_one_active_sms_per_type;

create unique index notification_one_active_sms_per_type
  on public.notification_logs (appointment_id, channel, reminder_type)
  where channel = 'SMS' and status in ('Queued', 'Sent');

create index if not exists notification_reminder_type_idx
  on public.notification_logs (reminder_type, created_at desc);

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Missing Vault secret: project_url';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'reminder_cron_secret') then
    raise exception 'Missing Vault secret: reminder_cron_secret';
  end if;
end
$$;

select cron.unschedule(jobid)
from cron.job
where jobname in ('daily-appointment-reminders', 'daily-high-risk-follow-ups');

-- pg_cron uses UTC. 23:00 UTC is 07:00 in Asia/Manila.
select cron.schedule(
  'daily-appointment-reminders',
  '0 23 * * *',
  $job$
  select net.http_post(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'project_url'), '/') || '/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{"reminderType":"standard"}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $job$
);

-- 09:00 UTC is 17:00 in Asia/Manila.
select cron.schedule(
  'daily-high-risk-follow-ups',
  '0 9 * * *',
  $job$
  select net.http_post(
    url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'project_url'), '/') || '/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{"reminderType":"high_risk_follow_up"}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $job$
);
