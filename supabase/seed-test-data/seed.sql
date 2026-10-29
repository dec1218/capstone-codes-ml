-- Phase 3: Small, repeatable test dataset for admin-page development.
-- Run once after supabase/schema.sql and after creating admin@gmail.com in Auth.

begin;

do $$
begin
  if exists (
    select 1 from public.activity_logs
    where metadata ->> 'seed_version' = 'admin-test-v1'
  ) then
    raise exception 'Seed admin-test-v1 has already been applied.';
  end if;
end;
$$;

update public.profiles
set
  full_name = 'Althea Dumapias',
  username = 'headnurse',
  role = 'admin',
  status = 'active'
where id = (
  select id from auth.users where lower(email) = 'admin@gmail.com'
);

do $$
begin
  if not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = 'admin@gmail.com' and p.role = 'admin'
  ) then
    raise exception 'Create and confirm admin@gmail.com in Authentication > Users before running this seed.';
  end if;
end;
$$;

create temporary table seed_patients (
  row_no integer primary key,
  id uuid not null,
  first_name text not null,
  last_name text not null,
  age smallint not null,
  gender text not null,
  contact_number text not null,
  address text not null
) on commit drop;

insert into seed_patients values
  (1, gen_random_uuid(), 'Liza', 'Navarro', 34, 'Female', '09170001001', 'Purok 2, Barangay San Isidro'),
  (2, gen_random_uuid(), 'Marco', 'Flores', 42, 'Male', '09170001002', 'Purok 5, Barangay San Isidro'),
  (3, gen_random_uuid(), 'Elena', 'Garcia', 29, 'Female', '09170001003', 'Purok 1, Barangay San Isidro'),
  (4, gen_random_uuid(), 'Ramon', 'Torres', 57, 'Male', '09170001004', 'Purok 4, Barangay San Isidro'),
  (5, gen_random_uuid(), 'Teresa', 'Ramos', 38, 'Female', '09170001005', 'Purok 3, Barangay San Isidro'),
  (6, gen_random_uuid(), 'Noel', 'Castillo', 51, 'Male', '09170001006', 'Purok 6, Barangay San Isidro'),
  (7, gen_random_uuid(), 'Maria', 'Santos', 26, 'Female', '09170001007', 'Purok 2, Barangay San Isidro'),
  (8, gen_random_uuid(), 'Jose', 'Reyes', 63, 'Male', '09170001008', 'Purok 1, Barangay San Isidro'),
  (9, gen_random_uuid(), 'Ana', 'Mendoza', 31, 'Female', '09170001009', 'Purok 5, Barangay San Isidro'),
  (10, gen_random_uuid(), 'Carlo', 'Villanueva', 45, 'Male', '09170001010', 'Purok 3, Barangay San Isidro'),
  (11, gen_random_uuid(), 'Rosa', 'Cruz', 54, 'Female', '09170001011', 'Purok 4, Barangay San Isidro'),
  (12, gen_random_uuid(), 'Daniel', 'Aquino', 22, 'Male', '09170001012', 'Purok 6, Barangay San Isidro'),
  (13, gen_random_uuid(), 'Grace', 'Bautista', 36, 'Female', '09170001013', 'Purok 2, Barangay San Isidro'),
  (14, gen_random_uuid(), 'Paolo', 'Dela Cruz', 48, 'Male', '09170001014', 'Purok 1, Barangay San Isidro'),
  (15, gen_random_uuid(), 'Joy', 'Domingo', 27, 'Female', '09170001015', 'Purok 5, Barangay San Isidro'),
  (16, gen_random_uuid(), 'Miguel', 'Fernandez', 59, 'Male', '09170001016', 'Purok 3, Barangay San Isidro'),
  (17, gen_random_uuid(), 'Carmen', 'Lopez', 40, 'Female', '09170001017', 'Purok 4, Barangay San Isidro'),
  (18, gen_random_uuid(), 'Luis', 'Mercado', 33, 'Male', '09170001018', 'Purok 6, Barangay San Isidro'),
  (19, gen_random_uuid(), 'Nina', 'Pascual', 24, 'Female', '09170001019', 'Purok 2, Barangay San Isidro'),
  (20, gen_random_uuid(), 'Ben', 'Soriano', 67, 'Male', '09170001020', 'Purok 1, Barangay San Isidro');

insert into public.patients (id, first_name, last_name, age, gender, contact_number, address, created_by, registered_at)
select
  id, first_name, last_name, age, gender, contact_number, address,
  (select id from public.profiles where username = 'headnurse'),
  now() - ((21 - row_no) || ' days')::interval
from seed_patients;

create temporary table seed_appointments (
  row_no integer primary key,
  id uuid not null,
  patient_id uuid not null,
  service_id uuid not null,
  appointment_date date not null,
  appointment_time time not null,
  status text not null
) on commit drop;

insert into seed_appointments
select
  series as row_no,
  gen_random_uuid(),
  patient.id,
  service.id,
  current_date + ((series - 1) / 2 - 13),
  (time '08:00' + (((series - 1) % 8) * interval '30 minutes'))::time,
  case
    when current_date + ((series - 1) / 2 - 13) > current_date then 'Scheduled'
    when series % 11 = 0 then 'Cancelled'
    else 'Completed'
  end
from generate_series(1, 30) as series
join seed_patients patient on patient.row_no = ((series - 1) % 20) + 1
join (
  select id, row_number() over (order by service_code) as row_no
  from public.health_services
  where is_active
) service on service.row_no = ((series - 1) % 6) + 1;

insert into public.appointments (
  id, patient_id, service_id, appointment_date, appointment_time, status, remarks, created_by
)
select
  id, patient_id, service_id, appointment_date, appointment_time, status,
  case when status = 'Cancelled' then 'Patient requested cancellation' else '' end,
  (select id from public.profiles where username = 'headnurse')
from seed_appointments;

with queue_source as (
  select
    id as appointment_id,
    appointment_date as queue_date,
    row_number() over (partition by appointment_date order by appointment_time)::integer as queue_number,
    row_number() over (order by appointment_date desc, appointment_time) as selected_row
  from seed_appointments
  where appointment_date <= current_date and status <> 'Cancelled'
)
insert into public.queue_entries (
  appointment_id, queue_date, queue_number, status, called_at, completed_at, created_by, created_at, updated_at
)
select
  appointment_id,
  queue_date,
  queue_number,
  case when queue_date = current_date and queue_number = 1 then 'Serving' else 'Completed' end,
  (queue_date + time '08:15')::timestamptz,
  case when queue_date = current_date and queue_number = 1 then null else (queue_date + time '08:40')::timestamptz end,
  (select id from public.profiles where username = 'headnurse'),
  (queue_date + time '08:00')::timestamptz,
  (queue_date + time '08:40')::timestamptz
from queue_source
where selected_row <= 15;

with recent_completed as (
  select
    id as appointment_id,
    appointment_date,
    appointment_time
  from seed_appointments
  where appointment_date < current_date and status = 'Completed'
  order by appointment_date desc, appointment_time desc
  limit 15
), attendance_source as (
  select
    appointment_id,
    appointment_date,
    appointment_time,
    row_number() over (order by appointment_date desc, appointment_time desc) as row_no
  from recent_completed
)
insert into public.attendance (appointment_id, status, check_in, check_out, recorded_by)
select
  appointment_id,
  case when row_no in (4, 9, 14) then 'No-Show' when row_no in (3, 8) then 'Late' else 'Present' end,
  case
    when row_no in (4, 9, 14) then null
    when row_no in (3, 8) then (appointment_date + appointment_time + interval '12 minutes')::timestamptz
    else (appointment_date + appointment_time - interval '6 minutes')::timestamptz
  end,
  case
    when row_no in (4, 9, 14) then null
    else (appointment_date + appointment_time + interval '25 minutes')::timestamptz
  end,
  (select id from public.profiles where username = 'headnurse')
from attendance_source;

insert into public.activity_logs (
  activity_type, actor_id, actor_name, action, module, description, metadata, created_at
)
values
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Create', 'Patient Records', 'Registered a patient test record.', '{"seed_version":"admin-test-v1"}', now() - interval '2 hours'),
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Create', 'Appointments', 'Created an appointment test record.', '{}', now() - interval '110 minutes'),
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Update', 'Queue', 'Updated a queue entry to Serving.', '{}', now() - interval '95 minutes'),
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Update', 'Attendance', 'Recorded attendance for a completed appointment.', '{}', now() - interval '80 minutes'),
  ('System Activity', null, 'System', 'Login', 'Authentication', 'Recorded a successful administrator sign-in.', '{}', now() - interval '70 minutes'),
  ('System Activity', null, 'System', 'Reminder', 'Appointments', 'Reminder test event queued for a scheduled appointment.', '{}', now() - interval '60 minutes'),
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Update', 'Patient Records', 'Updated a patient contact number.', '{}', now() - interval '50 minutes'),
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Update', 'Appointments', 'Rescheduled an appointment test record.', '{}', now() - interval '40 minutes'),
  ('System Activity', null, 'System', 'Prediction', 'No-Show Prediction', 'Prediction module is awaiting model integration.', '{}', now() - interval '30 minutes'),
  ('Staff Activity', (select id from public.profiles where username = 'headnurse'), 'Althea Dumapias', 'Update', 'Queue', 'Completed a patient queue entry.', '{}', now() - interval '20 minutes'),
  ('System Activity', null, 'System', 'Logout', 'Authentication', 'Recorded a completed administrator session.', '{}', now() - interval '10 minutes'),
  ('System Activity', null, 'System', 'Login', 'Authentication', 'Activity tracking verified after database setup.', '{}', now());

commit;
