# Phase 2: Supabase Database Setup

This folder contains the Phase 2 database schema for the Smart Queue and No-Show Prediction System.

**Phase status:** Complete; the live project and later incremental migrations are verified.

## Files

- `schema.sql`: complete schema, constraints, indexes, triggers, starter health services, RLS policies, and queue real-time configuration.

## Before Running the SQL

1. Open the correct project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor**.
3. Select **New query**.
4. Open `schema.sql` from this folder and copy its entire contents.
5. Paste it into the Supabase SQL Editor.
6. Confirm the editor is connected to project `asucmvsvxbpnvjjvgksc`.

The script is intended for a fresh database and should be run once. It uses a transaction, so an error should roll back the schema instead of leaving a partially completed setup.

## Run the Schema

Click **Run** in the SQL Editor. A successful execution should return a success message without an error.

The schema creates these application tables:

| Table | Purpose |
|---|---|
| `profiles` | Public role and staff profile linked to protected `auth.users` |
| `patients` | Patient demographic and contact records |
| `health_services` | Available health center services |
| `appointments` | Patient schedules and appointment status |
| `queue_entries` | Daily queue number and service status |
| `attendance` | Present, late, and no-show records |
| `predictions` | Model output and no-show probability |
| `notification_logs` | Reminder delivery attempts and status |
| `activity_logs` | Staff and automated activity audit trail |

`activity_logs` is separate from `notification_logs` because the admin UI tracks patient, queue, attendance, authentication, prediction, and reminder events.

## Phase 5 SMS Upgrade

Existing projects must run `phase5-sms-setup.sql` after creating the required Vault secrets. It adds the patient `sms_consent` column and schedules the reminder function for 07:00 Asia/Manila. New databases receive the consent column directly from `schema.sql`, but still need the Phase 5 script for the cron job.

The API token belongs only in Supabase Edge Function secrets. See [`functions/README.md`](functions/README.md) and [`../../docs/phase5-sms-reminders.md`](../../docs/phase5-sms-reminders.md) for the secure deployment order.

## Phase 6 Prediction Upgrade

Before the FastAPI service stores predictions, existing projects must run `phase6-predictions-setup.sql` in Supabase SQL Editor. It removes older duplicate prediction rows per appointment and creates `predictions_one_per_appointment`, allowing the backend to safely replace the current prediction with an upsert.

The FastAPI service uses the service-role key only from `ml/.env`. Never place that key in this React project or any `VITE_` variable. The active artifact is the disclosed `rf-real-pilot-colab-v1`; see [`../../ml/README.md`](../../ml/README.md).

Existing projects also use `phase6-services-update.sql` to add the active 30-minute Dental service as `SRV-07`. The migration is additive and leaves all existing services, appointments, and reminder configuration unchanged. If Dental already appears in the live catalog, rerunning the file is unnecessary; the copy remains the reproducible migration record.

## Create the First Admin

Do this only after `schema.sql` succeeds.

1. Open **Authentication > Users** in Supabase.
2. Select **Add user > Create new user**.
3. Enter the administrator's email and a strong temporary password.
4. Enable **Auto Confirm User**.
5. Create the user. The database trigger automatically creates a staff profile.
6. Open **SQL Editor** and run the following, replacing the values:

```sql
update public.profiles
set
  full_name = 'Administrator Name',
  username = 'headnurse',
  role = 'admin',
  status = 'active'
where id = (
  select id from auth.users where email = 'admin@example.com'
);
```

Confirm exactly one row was updated. The UI uses Supabase email/password authentication, and staff creation runs through the protected `create-staff-user` Edge Function.

## Verification Queries

Run these queries separately after the schema succeeds.

### Confirm the Tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected application tables:

```text
activity_logs
appointments
attendance
health_services
notification_logs
patients
predictions
profiles
queue_entries
```

### Confirm RLS

```sql
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;
```

Every application table should show `rls_enabled = true`.

### Confirm Starter Services

```sql
select service_code, name, duration_minutes, is_active
from public.health_services
order by service_code;
```

Seven active services should be returned, including Dental (`SRV-07`).

### Confirm the Admin Profile

```sql
select full_name, username, role, status
from public.profiles
order by created_at;
```

The first administrator should show `role = admin` and `status = active`.

## RLS Summary

- Anonymous visitors cannot access application tables.
- Active admin and staff accounts can work with patients, appointments, queues, and attendance.
- Only admins can maintain health services and view all staff profiles and activity logs.
- Prediction writes use the private FastAPI backend; notification writes use the protected reminder Edge Function.
- Profile creation is handled by the `auth.users` trigger.

Supabase service-role credentials bypass RLS. Never put a service-role key in this React project or any `VITE_` environment variable.

## Troubleshooting

If the script fails because an object already exists, do not delete tables containing needed data. Record the exact error and review the existing objects before changing anything.

If admin creation does not produce a profile, check **Database > Logs** for an error from `handle_new_auth_user`.

If the real-time publication reports that `queue_entries` is already a member, the table was previously configured for real-time. Remove only the final `alter publication` statement before retrying a clean, reviewed migration.

## Completion Checklist

- [x] `schema.sql` runs without errors.
- [x] Nine application tables appear in Table Editor.
- [x] RLS is enabled on all nine tables.
- [x] Seven health services exist.
- [x] The administrator Auth user and profile exist.
- [x] The administrator profile has the `admin` role.
- [x] Queue real-time replication is enabled.
- [x] Phase 2 is marked complete in [`../../tracker.md`](../../tracker.md).

Later upgrades are reproducible in the Phase 5, Phase 6, and Phase 7 incremental SQL files in this folder. `phase7-stabilization.sql` synchronizes completed queue/attendance records with appointment status.
