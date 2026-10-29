-- Phase 6 prediction storage upgrade for databases that already ran schema.sql.
-- Keep only the newest prediction per appointment before enforcing one current row.

with ranked as (
  select id, row_number() over (partition by appointment_id order by predicted_at desc, id desc) as position
  from public.predictions
)
delete from public.predictions
where id in (select id from ranked where position > 1);

create unique index if not exists predictions_one_per_appointment
  on public.predictions (appointment_id);
