-- ============================================================
-- CLEANUP: remove dummy freelancer profiles + all their data
-- ------------------------------------------------------------
-- Dummy profiles were created manually WITHOUT an email. Every real
-- profile is created through signup with email = the account's email
-- (see app/dashboard/page.js handleCreate), so "email is null or empty"
-- reliably matches only dummies.
--
-- HOW TO USE:
--   1. Run STEP 1 (read-only) and eyeball the list. Every row shown here
--      WILL be deleted. If a real profile ever appears, STOP — do not run
--      Step 2, and tell Claude so we switch to deleting by explicit IDs.
--   2. Export a CSV backup if you're not on Supabase Pro (Table Editor →
--      the table → Export).
--   3. Run STEP 2 (the deletes) top to bottom. It is scoped to the same
--      "no email" set at every stage, children first, parent last.
--
-- This does NOT delete auth logins (Authentication → Users) — those are
-- harmless without a profile; remove them by hand only if you're sure
-- they aren't your own account. It also does not touch client-side test
-- data (test conversations you started as a client); review those
-- separately in /admin if needed.
-- ============================================================


-- ── STEP 1 — PREVIEW (read-only). Confirm these are ALL dummies. ──
select
  f.id, f.name, f.trade, f.email, f.created_at,
  (select count(*) from services s where s.freelancer_id = f.id) as services,
  (select count(*) from reviews  r where r.freelancer_id = f.id) as reviews,
  (select count(*) from messages m where m.freelancer_id = f.id) as messages,
  (select count(*) from quotes   q where q.freelancer_id = f.id) as quotes
from freelancers f
where f.email is null or f.email = ''
order by f.created_at;


-- ── STEP 2 — DELETE (destructive). Only after reviewing Step 1. ──
-- Children are removed before parents so it works regardless of which
-- foreign keys cascade. Each statement re-scopes to the no-email set.

-- images belonging to dummy services
delete from service_images
where service_id in (
  select s.id from services s join freelancers f on f.id = s.freelancer_id
  where f.email is null or f.email = ''
);

-- replies inside dummy conversations
delete from message_replies
where message_id in (
  select m.id from messages m join freelancers f on f.id = m.freelancer_id
  where f.email is null or f.email = ''
);

delete from services
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from reviews
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from quotes
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from messages
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from appointments
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from availability_settings
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from availability_blocks
where freelancer_id in (select id from freelancers where email is null or email = '');

delete from portfolio_items
where freelancer_id in (select id from freelancers where email is null or email = '');

-- clients who had saved a dummy pro (harmless row on the client side)
delete from saved_professionals
where freelancer_id in (select id from freelancers where email is null or email = '');

-- finally, the dummy profiles themselves
delete from freelancers
where email is null or email = '';


-- ── STEP 3 — VERIFY (read-only). Should return 0. ──
select count(*) as remaining_dummy_profiles
from freelancers where email is null or email = '';
