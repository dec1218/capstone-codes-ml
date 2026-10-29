# Seed Test Data

This folder provides a small development dataset for testing the admin pages before staff workflows, SMS reminders, and machine learning are implemented.

## What It Adds

- Promotes `admin@gmail.com` to the active admin profile `headnurse`.
- 20 fictional patient records.
- 30 appointments across the previous 14 days, today, and tomorrow.
- 15 queue records.
- 15 attendance records with a 20% no-show rate.
- 12 activity log entries.
- No predictions or SMS deliveries; those modules are intentionally later phases.

All names and phone numbers are fictional test values.

## Run It

1. Confirm [`../schema.sql`](../schema.sql) completed successfully.
2. Confirm `admin@gmail.com` exists and is confirmed in **Authentication > Users**.
3. Open Supabase **SQL Editor** and create a new query.
4. Copy all of `seed.sql` into the editor.
5. Click **Run**.

Expected result: `Success. No rows returned`.

The script is protected by the `admin-test-v1` marker. Running it again produces an intentional error instead of duplicating records.

## Verify

```sql
select 'patients' as item, count(*) from public.patients
union all select 'appointments', count(*) from public.appointments
union all select 'queue_entries', count(*) from public.queue_entries
union all select 'attendance', count(*) from public.attendance
union all select 'activity_logs', count(*) from public.activity_logs;
```

Verify the admin profile:

```sql
select p.full_name, p.username, p.role, p.status, u.email
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = 'admin@gmail.com';
```

Expected profile: `Althea Dumapias`, `headnurse`, `admin`, `active`.

## Important

Do not use these records as real patient information. Do not run this seed against a production database containing real health-center data.
