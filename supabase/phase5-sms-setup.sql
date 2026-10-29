-- Phase 5 incremental setup for databases that already ran schema.sql.
-- Before running this file, create these Supabase Vault secrets:
--   project_url: https://<project-ref>.supabase.co
--   reminder_cron_secret: the same random value as the Edge Function CRON_SECRET

alter table public.patients
  add column if not exists sms_consent boolean not null default false;

create unique index if not exists notification_one_active_sms_per_type
  on public.notification_logs (appointment_id, channel, reminder_type)
  where channel = 'SMS' and status in ('Queued', 'Sent');

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
where jobname = 'daily-appointment-reminders';

-- pg_cron uses UTC. 23:00 UTC is 07:00 the next day in Asia/Manila.
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
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $job$
);
