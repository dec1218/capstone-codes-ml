# Supabase Edge Functions

## Create Staff User

`create-staff-user` securely creates a confirmed Supabase Auth user and its staff profile. It rejects unauthenticated, inactive, and non-admin callers.

The function uses Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` Edge Function secrets. Never copy the service-role key into the React `.env` file.

## Deploy Once

Run these commands from the `capstone2-ui` folder:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref asucmvsvxbpnvjjvgksc
npx.cmd supabase functions deploy create-staff-user
```

The login command opens a browser so you can authorize the CLI. Do not send your access token to anyone or save it in this repository.

After deployment, restart the Vite development server, sign in as the admin, and use **User Accounts > Add staff account**.

## Expected Behavior

- The staff user appears under **Authentication > Users**.
- A matching row appears in `public.profiles` with `role = staff`.
- The account appears immediately in the admin User Accounts table.
- A Create event is added to `activity_logs`.
- Duplicate email and username attempts show an error and do not create partial records.

## PhilSMS Appointment Reminders

`send-appointment-reminders` sends consent-based standard reminders and additional High-risk follow-ups through PhilSMS. It supports authenticated staff runs and automated cron runs protected by a private scheduler secret. Provider credentials are read only from Supabase Edge Function secrets.

Configure `PHILSMS_API_TOKEN`, `PHILSMS_SENDER_ID=PhilSMS`, `PHILSMS_API_BASE_URL=https://dashboard.philsms.com/api/v3`, `SMS_PROVIDER=philsms`, `CRON_SECRET`, and `HIGH_RISK_MODEL_VERSION=rf-real-pilot-colab-v1` in the Supabase Dashboard. Never use a `VITE_` variable for these values. Rotate any token that has been pasted into chat or another untrusted location.

Run `supabase/phase6-risk-follow-up-setup.sql` after adding the matching `reminder_cron_secret` and `project_url` values to Supabase Vault. Then deploy from the `capstone2-ui` folder:

```powershell
npx.cmd supabase functions deploy send-appointment-reminders --no-verify-jwt
```

JWT gateway verification is intentionally disabled for this function because a cron request has no user session. The function itself rejects requests unless they contain either a valid active staff/admin JWT or the matching private `CRON_SECRET` header.

After deployment, active staff or admin users can run either reminder type from **Staff > Appointment Schedules**. The 07:00 job sends the standard reminder to every eligible appointment. The 17:00 job sends an additional follow-up only for a current High `rf-real-pilot-colab-v1` prediction generated that Manila day and after the latest schedule update. Already queued or sent deliveries of the same type are skipped. Each invocation processes at most 100 scheduled appointments, sends only for consenting patients, and allows at most three attempts per type.
