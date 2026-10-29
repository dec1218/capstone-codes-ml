# Smart Queue and No-Show Prediction System

A web-based queue, appointment, attendance, and no-show prediction system for a barangay health center.

## Current Status

The responsive React UI, Supabase Cloud setup, database schema, admin/staff integration, PhilSMS reminders, and Google Colab real-data pilot are complete. Standard reminders remain available to every eligible appointment, while a separate current High pilot result can receive one additional follow-up — see [`../docs/phase6-machine-learning.md`](../docs/phase6-machine-learning.md).

| Phase | Description | Status |
|---|---|---|
| 1 | Supabase Cloud setup | Complete |
| 2 | Database schema and RLS | Complete |
| 3 | Admin pages and Supabase | Complete |
| 4 | Staff pages and Supabase | Complete |
| 5 | Automated SMS reminders | Complete |
| 6 | Machine learning | Complete (9/9; real pilot and additional High follow-up deployed) |
| 7 | End-to-end testing | In progress (stabilization complete; 0/16 acceptance scenarios) |

Detailed instructions and completion checks are in [`../docs/`](../docs/). The working checklist is in [`../tracker.md`](../tracker.md).

## Technology Stack

- React 19 and TypeScript
- Vite
- Tailwind CSS 4
- React Router
- Supabase Cloud
- FastAPI and scikit-learn 1.5.2 real-data pilot (local service)

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and enter the Supabase project URL and publishable key.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL shown by Vite.

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Only the Supabase publishable key belongs in the frontend. Never put a Supabase secret or service-role key in a `VITE_` variable.

## Available Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.
- `npm run preview` previews the production build.

## Documentation

- [Admin and staff workflow guide](../docs/admin-and-staff-workflows.md)
- [Phase 1: Supabase Cloud setup](../docs/phase1-supabase-setup.md)
- [Phase 2: Database schema](../docs/phase2-database-schema.md)
- [Phase 3: Admin to Supabase](../docs/phase3-admin-supabase.md)
- [Phase 4: Staff to Supabase](../docs/phase4-staff-supabase.md)
- [Phase 5: Automated SMS reminders](../docs/phase5-sms-reminders.md)
- [Phase 6: Machine learning](../docs/phase6-machine-learning.md)
- [Phase 7: End-to-end testing](../docs/phase7-testing.md)
- [Supabase SQL and manual setup guide](supabase/README.md)
- [Seed test data guide](../docs/seed-test-data.md)
- [Secure staff account creation](../docs/admin-staff-account-creation.md)
