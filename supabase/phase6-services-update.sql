-- Additive Phase 6 service-catalog update for databases that already ran schema.sql.
-- This script does not modify existing services, appointments, reminders, or cron jobs.

begin;

do $$
begin
  if exists (
    select 1 from public.health_services
    where service_code = 'SRV-07' and name <> 'Dental'
  ) then
    raise exception 'SRV-07 is already assigned to another service.';
  end if;

  if exists (
    select 1 from public.health_services
    where lower(name) = 'dental' and service_code <> 'SRV-07'
  ) then
    raise exception 'Dental already exists under another service code.';
  end if;

  insert into public.health_services (service_code, name, duration_minutes, is_active)
  select 'SRV-07', 'Dental', 30, true
  where not exists (
    select 1 from public.health_services
    where service_code = 'SRV-07' and name = 'Dental'
  );
end
$$;

commit;

select service_code, name, duration_minutes, is_active
from public.health_services
order by service_code;
