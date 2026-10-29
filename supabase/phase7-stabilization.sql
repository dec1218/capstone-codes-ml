-- Phase 7 stabilization: keep appointment lifecycle status aligned with
-- completed queue service and recorded attendance.

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

drop trigger if exists queue_completion_updates_appointment on public.queue_entries;
create trigger queue_completion_updates_appointment
after insert or update of status on public.queue_entries
for each row execute function public.complete_related_appointment();

drop trigger if exists attendance_updates_appointment on public.attendance;
create trigger attendance_updates_appointment
after insert or update of status on public.attendance
for each row execute function public.complete_related_appointment();

update public.appointments as appointment
set status = 'Completed'
where appointment.status = 'Scheduled'
  and (
    exists (
      select 1
      from public.queue_entries as queue_entry
      where queue_entry.appointment_id = appointment.id
        and queue_entry.status = 'Completed'
    )
    or exists (
      select 1
      from public.attendance as attendance_record
      where attendance_record.appointment_id = appointment.id
    )
  );
