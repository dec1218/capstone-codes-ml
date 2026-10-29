-- Phase 2: Supabase database schema
-- Run this file once in the Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create sequence public.patient_code_seq start 1;
create sequence public.appointment_code_seq start 1;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null,
  contact_number text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_unique on public.profiles (lower(username));

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_code text not null unique default ('PT-' || lpad(nextval('public.patient_code_seq')::text, 4, '0')),
  first_name text not null,
  last_name text not null,
  age smallint not null check (age between 0 and 130),
  gender text not null check (gender in ('Female', 'Male')),
  contact_number text not null check (contact_number ~ '^09[0-9]{9}$'),
  sms_consent boolean not null default false,
  address text not null,
  created_by uuid references public.profiles(id) on delete set null,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.health_services (
  id uuid primary key default gen_random_uuid(),
  service_code text not null unique,
  name text not null unique,
  duration_minutes smallint not null check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_code text not null unique default ('AP-' || lpad(nextval('public.appointment_code_seq')::text, 4, '0')),
  patient_id uuid not null references public.patients(id) on delete restrict,
  service_id uuid not null references public.health_services(id) on delete restrict,
  appointment_date date not null,
  appointment_time time not null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled')),
  remarks text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, appointment_date, appointment_time)
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete restrict,
  queue_date date not null default current_date,
  queue_number integer not null check (queue_number > 0),
  status text not null default 'Waiting' check (status in ('Waiting', 'Serving', 'Completed')),
  called_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_date, queue_number)
);

create unique index queue_one_serving_per_day
  on public.queue_entries (queue_date)
  where status = 'Serving';

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete restrict,
  status text not null check (status in ('Present', 'Late', 'No-Show')),
  check_in timestamptz,
  check_out timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out is null or check_in is not null),
  check (check_out is null or check_out >= check_in),
  check (status = 'No-Show' or check_in is not null)
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  probability numeric(5,4) not null check (probability between 0 and 1),
  result text not null check (result in ('Show', 'No-Show')),
  risk_level text generated always as (
    case
      when probability >= 0.70 then 'High'
      when probability >= 0.40 then 'Moderate'
      else 'Low'
    end
  ) stored,
  model_version text not null,
  predicted_at timestamptz not null default now()
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  prediction_id uuid references public.predictions(id) on delete set null,
  channel text not null check (channel in ('SMS', 'Email')),
  reminder_type text not null default 'standard' check (reminder_type in ('standard', 'high_risk_follow_up')),
  recipient text not null,
  status text not null default 'Queued' check (status in ('Queued', 'Sent', 'Failed', 'Not required')),
  provider_message_id text,
  error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  activity_type text not null check (activity_type in ('Staff Activity', 'System Activity')),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  action text not null check (action in ('Create', 'Update', 'Delete', 'Login', 'Logout', 'Reminder', 'Prediction')),
  module text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index patients_name_idx on public.patients (last_name, first_name);
create index patients_contact_idx on public.patients (contact_number);
create index appointments_date_status_idx on public.appointments (appointment_date, status);
create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_service_idx on public.appointments (service_id);
create index queue_date_status_idx on public.queue_entries (queue_date, status);
create index attendance_status_created_idx on public.attendance (status, created_at);
create unique index predictions_one_per_appointment on public.predictions (appointment_id);
create index notification_appointment_date_idx on public.notification_logs (appointment_id, created_at desc);
create unique index notification_one_active_sms_per_type
  on public.notification_logs (appointment_id, channel, reminder_type)
  where channel = 'SMS' and status in ('Queued', 'Sent');
create index activity_created_idx on public.activity_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger patients_set_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger health_services_set_updated_at before update on public.health_services
for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger queue_entries_set_updated_at before update on public.queue_entries
for each row execute function public.set_updated_at();
create trigger attendance_set_updated_at before update on public.attendance
for each row execute function public.set_updated_at();

create or replace function public.complete_related_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'queue_entries' and new.status <> 'Completed' then
    return new;
  end if;

  update public.appointments
  set status = 'Completed'
  where id = new.appointment_id
    and status = 'Scheduled';

  return new;
end;
$$;

create trigger queue_completion_updates_appointment
after insert or update of status on public.queue_entries
for each row execute function public.complete_related_appointment();

create trigger attendance_updates_appointment
after insert or update of status on public.attendance
for each row execute function public.complete_related_appointment();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_username text;
begin
  generated_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, 'staff'), '@', 1) || '_' || left(new.id::text, 8)
  );

  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Staff User'), '@', 1)),
    generated_username
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.health_services enable row level security;
alter table public.appointments enable row level security;
alter table public.queue_entries enable row level security;
alter table public.attendance enable row level security;
alter table public.predictions enable row level security;
alter table public.notification_logs enable row level security;
alter table public.activity_logs enable row level security;

create policy "Users read own profile and admins read all"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Admins update profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Active users read patients"
on public.patients for select to authenticated
using (public.is_active_user());
create policy "Active users create patients"
on public.patients for insert to authenticated
with check (public.is_active_user() and (created_by is null or created_by = auth.uid()));
create policy "Active users update patients"
on public.patients for update to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy "Active users read services"
on public.health_services for select to authenticated
using (public.is_active_user());
create policy "Admins create services"
on public.health_services for insert to authenticated
with check (public.is_admin());
create policy "Admins update services"
on public.health_services for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Active users read appointments"
on public.appointments for select to authenticated
using (public.is_active_user());
create policy "Active users create appointments"
on public.appointments for insert to authenticated
with check (public.is_active_user() and (created_by is null or created_by = auth.uid()));
create policy "Active users update appointments"
on public.appointments for update to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy "Active users read queue"
on public.queue_entries for select to authenticated
using (public.is_active_user());
create policy "Active users create queue entries"
on public.queue_entries for insert to authenticated
with check (public.is_active_user() and (created_by is null or created_by = auth.uid()));
create policy "Active users update queue entries"
on public.queue_entries for update to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy "Active users read attendance"
on public.attendance for select to authenticated
using (public.is_active_user());
create policy "Active users create attendance"
on public.attendance for insert to authenticated
with check (public.is_active_user() and (recorded_by is null or recorded_by = auth.uid()));
create policy "Active users update attendance"
on public.attendance for update to authenticated
using (public.is_active_user())
with check (public.is_active_user());

create policy "Active users read predictions"
on public.predictions for select to authenticated
using (public.is_active_user());

create policy "Active users read notifications"
on public.notification_logs for select to authenticated
using (public.is_active_user());

create policy "Admins read activity logs"
on public.activity_logs for select to authenticated
using (public.is_admin());

revoke all on all tables in schema public from anon;
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.health_services to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update on public.queue_entries to authenticated;
grant select, insert, update on public.attendance to authenticated;
grant select on public.predictions to authenticated;
grant select on public.notification_logs to authenticated;
grant select on public.activity_logs to authenticated;
grant usage, select on sequence public.patient_code_seq to authenticated;
grant usage, select on sequence public.appointment_code_seq to authenticated;

insert into public.health_services (service_code, name, duration_minutes)
values
  ('SRV-01', 'General Consultation', 20),
  ('SRV-02', 'Immunization', 15),
  ('SRV-03', 'Prenatal Care', 30),
  ('SRV-04', 'Blood Pressure Monitoring', 15),
  ('SRV-05', 'Child Wellness Check', 25),
  ('SRV-06', 'Family Planning', 25),
  ('SRV-07', 'Dental', 30);

alter table public.queue_entries replica identity full;
alter publication supabase_realtime add table public.queue_entries;

commit;
