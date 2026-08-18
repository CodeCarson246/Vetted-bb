-- ============================================================
-- RESET DUMMY DATA — ONE-OFF SCRIPT, RUN ONCE, THEN STOP
-- ============================================================
-- Clears the test/dummy reviews, jobs and conversations so every account
-- starts fresh. Profiles, services, photos, categories, ventures, bookings
-- settings and logins are all KEPT — only the activity history goes.
--
-- THIS IS DESTRUCTIVE AND CANNOT BE UNDONE.
-- Do NOT paste this into SUPABASE_SQL.sql. That file is safe to re-run;
-- this one is not. Take a backup first:
--   Supabase Dashboard > Database > Backups (or run a manual pg_dump)
--
-- Run the sections you want in the Supabase SQL Editor. Each section is
-- independent, so you can run 1 and 2 and skip 3 if you'd rather keep chats.
-- ============================================================


-- ============================================================
-- SECTION 1 — REVIEWS (most important)
-- Removes every review in both directions (client-on-pro and pro-on-client)
-- and zeroes the denormalized rating shown on cards and profiles.
-- ============================================================

DELETE FROM reviews;

-- Reset the cached rating summary carried on the profile row. Without this,
-- profiles keep showing "4.8 (12)" even though the reviews are gone.
UPDATE freelancers
   SET rating = 0,
       review_count = 0;


-- ============================================================
-- SECTION 2 — JOBS, QUOTES, INVOICES AND EARNINGS (most important)
-- quotes holds the whole lifecycle: sent > accepted > invoiced >
-- completed > paid. Clearing it resets open jobs, completed jobs,
-- earnings totals and the earnings chart in one go.
-- ============================================================

DELETE FROM quotes;

-- Booking requests / calendar appointments made against the dummy jobs.
-- Comment this out if you want to keep test bookings on the calendar.
DELETE FROM appointments;


-- ============================================================
-- SECTION 3 — MESSAGES AND CONVERSATIONS (optional)
-- Replies are deleted first because they hang off messages.
-- Skip this whole section if you'd rather keep the chat history.
-- ============================================================

DELETE FROM message_replies;
DELETE FROM messages;


-- ============================================================
-- SECTION 4 — LEFTOVER NOTIFICATIONS (recommended if you ran 1-3)
-- Old alerts ("You have a new review", "Quote accepted") would otherwise
-- link to rows that no longer exist and 404 when tapped.
-- ============================================================

DELETE FROM notifications;


-- ============================================================
-- SECTION 5 — TEST ANALYTICS (optional)
-- Profile view counts racked up while testing.
-- ============================================================

-- DELETE FROM profile_views;


-- ============================================================
-- VERIFY — all of these should come back 0 (except the ones you skipped)
-- ============================================================

SELECT 'reviews'       AS table_name, COUNT(*) AS remaining FROM reviews
UNION ALL SELECT 'quotes',        COUNT(*) FROM quotes
UNION ALL SELECT 'appointments',  COUNT(*) FROM appointments
UNION ALL SELECT 'messages',      COUNT(*) FROM messages
UNION ALL SELECT 'replies',       COUNT(*) FROM message_replies
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'rated profiles (should be 0)', COUNT(*) FROM freelancers WHERE review_count > 0;
