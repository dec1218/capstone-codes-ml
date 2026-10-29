# Capstone Progress Tracker

**Project:** Smart Queue & No-Show Prediction System for Barangay Health Center
**Last Updated:** 2026-10-29

---

## Phase 1: Supabase Cloud Setup

- [x] Create or select a Supabase Cloud project
- [x] Install `@supabase/supabase-js`
- [x] Configure the local `.env` file
- [x] Add a safe `.env.example`
- [x] Create the shared Supabase client
- [x] Add environment-variable type declarations
- [x] Verify the Supabase Cloud endpoint accepts the publishable key
- [x] Verify lint and production build

**Status:** Complete
**Notes:** Cloud-only workflow selected; Docker is not required.

---

## Phase 2: Database Schema

- [x] Prepare `profiles` table linked to Supabase Auth
- [x] Prepare `patients` table
- [x] Prepare `health_services` table
- [x] Prepare `appointments` table
- [x] Prepare `queue_entries` table
- [x] Prepare `attendance` table
- [x] Prepare `predictions` table
- [x] Prepare `notification_logs` table
- [x] Prepare `activity_logs` table
- [x] Add foreign keys, checks, indexes, and triggers
- [x] Add RLS policies (Row Level Security)
- [x] Run `capstone2-ui/supabase/schema.sql` in Supabase SQL Editor
- [x] Create the first administrator account
- [x] Confirm the schema transaction completed successfully

**Status:** Complete
**Notes:** Supabase SQL Editor returned success; administrator Auth user created.

---

## Phase 3: Admin Pages + Supabase

- [x] Prepare documented seed test data
- [x] Run and verify `capstone2-ui/supabase/seed-test-data/seed.sql`
- [x] Replace mock login with Supabase Auth
- [x] Restore sessions and enforce profile roles
- [x] Connect Admin Dashboard to Supabase
- [x] Connect User Accounts listing and updates to Supabase
- [x] Implement protected staff-account creation Edge Function
- [x] Deploy and verify `create-staff-user`
- [x] Connect Analytics to Supabase
- [x] Connect System Activity Logs to Supabase
- [x] Add loading, error, retry, and empty states
- [x] Verify all admin pages in the browser

**Status:** Complete
**Notes:** Seed data, all admin pages, and secure staff-account creation were verified against Supabase. Prediction and SMS data remain intentionally unavailable until Phases 6 and 5.

---

## Phase 4: Staff Pages + Supabase

- [x] Create and verify staff Auth accounts
- [x] Update StaffDashboard — fetch real stats
- [x] Update PatientRecords — CRUD with Supabase
- [x] Update AppointmentSchedules — CRUD with Supabase
- [x] Update QueueList — real-time queue updates
- [x] Update Attendance — mark status with Supabase
- [x] Update NoShowPredictions — fetch predictions
- [x] Update StaffReports — fetch real report data
- [x] Test all staff pages with real data

**Status:** Complete
**Notes:** All staff pages were browser-tested against live Supabase on desktop and mobile widths. Login, live page loads, search/filter controls, dialogs, validation, session restoration, and logout passed with no captured runtime or HTTP errors. Data-changing CRUD, realtime, permission, and persistence scenarios remain in the comprehensive Phase 7 test pass. Prediction pages correctly show the live empty state until Phase 6.

---

## Phase 5: Automated SMS Reminders

- [x] Select and configure an SMS provider
- [x] Implement protected reminder service
- [x] Schedule appointment reminders
- [x] Add consent, opt-out, retry, and rate limiting
- [x] Prevent duplicate sends
- [x] Log delivery attempts in `notification_logs`
- [x] Connect reminder status to staff views
- [x] Verify one real SMS delivery with available provider quota

**Status:** Complete
**Notes:** A controlled real PhilSMS reminder was delivered and recorded as `Sent` with provider metadata. The 07:00 Asia/Manila cron job is active; cron history and scheduled-trigger activity were verified. The exposed provider token was rotated and the replacement secret configured. A future appointment is reserved to observe the next automatic carrier delivery without using the manual button.

---

## Phase 6: Machine Learning

- [x] Install Python and scaffold `capstone\ml\` project (FastAPI + training script)
- [x] Prepare anonymized leakage-safe features (schema-based: lead time, schedule, demographics, prior no-show rate)
- [x] Create FastAPI prediction service writing to `predictions`
- [x] Fixture-test the pipeline (temporary fixture proves code runs; not the official training set)
- [x] **Data gate:** dean requires real data; synthetic data is prototype-only while verified outcomes are collected
- [x] Train and evaluate the real-data Random Forest pilot in Google Colab
- [x] Report stratified/chronological precision, recall, F1, ROC-AUC, confusion matrices, leakage checks, and persisted metadata
- [x] Connect prediction pages to live model output and verify a stored Supabase prediction
- [x] Integrate the pilot High band as an additional follow-up while preserving standard reminders for all eligible appointments

**Status:** Complete
**Notes:** `rf-real-pilot-colab-v1` was trained in Google Colab on 300 anonymized rows (176 Present, 124 No-Show), exported with matching metadata, and validated under scikit-learn 1.5.2. A controlled real-pilot prediction was generated, stored in Supabase, displayed as `Real pilot`, and persisted after refresh. The deployed `philsms-v3` extension preserves the 07:00 standard SMS for every eligible appointment and adds a separate 17:00 follow-up only for a current High real-pilot result generated that Manila day after the latest schedule change. The database migration, per-type duplicate guard, pinned model version, two active cron jobs, 401 protection, six policy tests, 17 ML tests, frontend lint/build, and cloud aggregate checks pass. No deployment SMS was sent because the current prediction is not High. Chronological performance remains limited (F1 0.3143, ROC-AUC 0.6089), so predictions never remove standard reminder eligibility.

---

## Phase 7: End-to-End Testing

- [ ] Admin login works
- [ ] Admin dashboard shows real stats
- [ ] Admin user management CRUD works
- [ ] Admin analytics show real charts
- [ ] Admin activity logs show real data
- [ ] Staff login works
- [ ] Staff patient CRUD works
- [ ] Staff appointment CRUD works
- [ ] Staff queue management works
- [ ] Staff attendance marking works
- [ ] Staff predictions generate correctly
- [ ] Pilot risk bands display consistently with their documented limitations
- [ ] Standard reminders auto-send for all eligible appointments and High-risk follow-ups send as an additional SMS
- [ ] Staff reports generate with real data
- [ ] Role-based access control works
- [ ] Data persists across sessions

**Status:** In Progress — stabilization complete; acceptance scenarios next
**Notes:** Phase 7 preflight fixed prediction timestamp refresh on upsert, synchronized Completed queue/attendance records with appointment status through deployed database triggers, restored mobile navigation, removed hardcoded shell notifications and queue counts, limited the staff prediction page to tomorrow's Scheduled appointments, separated High follow-up status from standard SMS, and stopped admin dashboards from counting unscored appointments as predicted shows. One existing lifecycle mismatch was safely backfilled. Verification passes with 18 ML tests, 6 reminder-policy tests, Edge Function type-check, frontend lint/build, and live trigger checks. The 16 end-to-end acceptance scenarios remain unchecked until executed.

---

## Summary

| Phase | Status | Completed |
|---|---|---|
| Phase 1: Supabase Cloud | Complete | 8/8 |
| Phase 2: Database Schema | Complete | 14/14 |
| Phase 3: Admin + Supabase | Complete | 12/12 |
| Phase 4: Staff + Supabase | Complete | 9/9 |
| Phase 5: SMS Reminders | Complete | 8/8 |
| Phase 6: Machine Learning | Complete | 9/9 |
| Phase 7: Testing | In Progress | 0/16 |
