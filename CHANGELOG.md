# Vetted.bb Changelog

## Status key

| Status | Meaning |
|---|---|
| SHIPPED | live on vetted.bb and manually confirmed working |
| DEPLOYED | code is live but not manually verified |
| WRITTEN | code exists, not deployed or not confirmed |
| BROKEN | known not working |
| BACKLOG | planned, not started |

Only Carson moves an item to SHIPPED, after testing it. New work starts as DEPLOYED or WRITTEN.

## Outstanding / unverified

Everything that is not SHIPPED, newest first. Last checked against the live site and database on 2026-11-13. Items marked "April checklist" come from `Vetted-bb-Pre-Launch-Checklist.docx` (April 2026) and its 21 June reconciliation, `Vetted-bb-Outstanding-Issues-Updated_1.docx`, both in Downloads.

### Written, not live

- **[WRITTEN]** Rising Talent badge, 2026-11-13. Not deployed. SQL Section 43 has been run (column confirmed 2026-11-13), so it is safe to push.
  - Needs testing: give a profile the badge from the admin panel (↑ Rising), then check it on search, a category page, the homepage (if featured) and the profile header; remove it again.
- **[WRITTEN]** Profile save shows the real reason when it fails, 2026-11-13. Not deployed.
- **[WRITTEN]** Dead `deleteReply` removed from the inbox, 2026-11-13. The pre-push scan is now clean. Not deployed.
- **[WRITTEN]** Admin link in the workspace sidebar and the top menu, shown only to accounts in `ADMIN_EMAILS`, 2026-11-13. Not deployed. Checked on localhost: shown for an admin account, the check answers 401 signed out.
  - Needs testing: sign in as a non-admin account and confirm there is no Admin link.

### Live but not verified

- **[DEPLOYED]** SQL Sections 39, 40 and 41, run by Carson 2026-11-13. Checked on live: `notified_at` exists; a signed-out insert into messages is refused; professionals' email is no longer publicly readable; signed in, `my_freelancer()` returns the full own profile and a whole-row read is refused; Dashboard, Inbox, Quotes, Calendar, Settings, Search (6 profiles) and a public profile load with no console errors. Section 40's guards were not exercised directly (they need a second signed-in account).
- **[DEPLOYED]** Storage rules, SQL Section 42, run 2026-11-13 (code 2d1c3f0). Checked on live while signed out: uploads to all six buckets refused, file listing returns nothing, an existing profile photo cannot be replaced or deleted, `.html` refused, and existing photos still load. Signed-in uploads not yet tested (on Carson's test list).
- **[DEPLOYED]** Notification routes lock-down, 2026-11-13 (60b427b): `notify-message`, `notify-reply`, `match-saved-searches`.
  - Confirmed on live: unsigned requests get 401; Dashboard, Inbox, Quotes & earnings and My enquiries load when signed in.
  - Needs testing: send a real enquiry and check the professional gets the email and push; reply as the professional and check the client is notified; send a quote, an invoice, a reminder and a receipt.
- **[DEPLOYED]** Enquiries need an account, 2026-11-13 (60b427b). The email field on the form is read-only.
  - Needs testing: signed out, every Contact and Request a Quote button goes to log in.
- **[DEPLOYED]** Audit fixes to eight routes, 2026-11-13 (60b427b): `documents/pdf`, `notify-quote-event`, `notify-saved`, `request-booking`, `reviews`, `client-review`, `organisation-invite`, `signup`.
  - Tested only against a fake database, never on live.
  - Needs testing: download a quote, an invoice and a receipt; accept and decline a quote; mark a job paid and completed; request a booking; invite someone to an organisation twice (second time shows the existing link).
- **[DEPLOYED]** Contact details read through `my_freelancer()` and `freelancer_contact()`, 2026-11-13 (60b427b). Section 41 is live, so this path is now in use; `my_freelancer()` confirmed on live.
  - Needs testing: Edit profile still shows payment details and terms; a client sees the professional's email in a conversation; an invoice PDF still prints the phone and payment details.
- **[DEPLOYED]** Sitemap lists professionals again, 2026-11-13 (60b427b). Confirmed live: 6 profile URLs. Not checked in Google Search Console.
- **[DEPLOYED]** "Your invoice has been sent" wording for automatic invoices, 2026-11-12 (d5798cc).
  - Needs testing: accept a quote that has the automatic box ticked, from a second account.
- **[DEPLOYED]** "Quote this service" button hides once a quote is sent, 2026-11-12 (a1942a8).
- **[DEPLOYED]** Log out in the workspace sidebar, 2026-11-12 (7378303). The button renders on live; the click was not tested.
- **[DEPLOYED]** Quote guard trigger, SQL Section 38, run 2026-11-12. Not re-tested on live.
  - Needs testing: accept a quote from a second account; tick "job completed" as the client on My jobs.
- **[DEPLOYED]** "Waiting on you" list and the Send invoice dialog from the email link, 2026-11-12 (23577ff). Carson confirmed the notification route; these two were not confirmed.
- **[DEPLOYED]** Rentals & Stays beyond the confirm-and-quote path, 2026-11-12 (3a5dbbe): length discounts, per-night items, blocking an item, the public availability calendar. 2 rental bookings exist.
- **[DEPLOYED]** Guided profile setup and the read-back step, 2026-11-04 and 2026-11-11. Reviewed on localhost; not confirmed on live with a brand-new account.
- **[DEPLOYED]** Organisation accounts, 2026-09-12. There are 0 organisations in the live database, so signup, team invites, quote requests, records and purchase-order attachments have no real use behind them.
- **[DEPLOYED]** Review photo uploads (April checklist §2). Checked 2026-11-13: the `reviews.image_url` column and the `review-photos` bucket exist, and a signed-out visitor cannot upload to it. Never used: there are 0 reviews in the live database. On Carson's test list.
- **[DEPLOYED]** Phone verification (April checklist §2). Built 2026-06-12/13 as automatic SMS codes through Supabase (Twilio set up in the Supabase dashboard), then `/api/verify-phone` sets the badge; the manual admin pages from the April plan were never built. Carson confirmed it worked; on his test list for a re-test.
- **[DEPLOYED]** Signup confirmation emails (April checklist §1.1, then failing because Supabase sent from Resend's test address). Checked 2026-11-13: 2 email sign-ups in July were confirmed, so it worked then. Every sign-up since August has used Google, so the email path has not been exercised since.
- **[DEPLOYED]** Web push. 4 device subscriptions are stored; lock-screen push was confirmed by Carson in June. Not re-checked since the notification routes changed on 2026-11-13.
- **[DEPLOYED]** Signup password rules. They are enforced in `/api/signup` only; a direct call to Supabase skips them. Whether the Supabase dashboard minimum-password setting has been raised is not known.

### Supabase / Vercel settings, not confirmed

- **[BACKLOG]** Supabase Pro plan and backups (April checklist §2). No record either way. The free plan has no backups and pauses after 7 idle days.

### Broken


### Known gaps, left as they are

- **[BACKLOG]** `vetted-rising` form: anyone can submit, by design. Left alone at Carson's request (2026-11-12).
- **[BACKLOG]** Rate limits are held in one server's memory (`lib/rateLimit.js`). Durable limits need Upstash.
- **[BACKLOG]** Rentals & Stays category icon is a placeholder.
- **[BACKLOG]** Social share graphics still use the old fonts (Sora and Inter), not Barlow.
- **[BACKLOG]** ESLint reports about 119 problems. None stop the build.

### Planned, not started

- **[BACKLOG]** Native app with Capacitor. Audit done 2026-11-12; biggest obstacle is the server-rendered profile route.
- **[BACKLOG]** Calendar sync with Airbnb (iCal) for rentals.
- **[BACKLOG]** Sentry, analytics, notification retention and preferences, email digests.
- **[BACKLOG]** Guest bookings, multi-day time off, unifying the old availability display with bookings.
- **[BACKLOG]** Earnings tax set-aside estimator.
- **[BACKLOG]** Gold membership tier and tiered ID verification.

## Carson's test list

Things Carson has said he will test himself. He asks for this list when he is ready; tick them off by moving each to SHIPPED.

- Phone verification: verify a professional's phone from the dashboard and check the badge appears on the public profile. (Worked before; re-test.)
- Review photos: as a client with a paid, completed job, leave a review with a photo, and check the photo shows on the professional's profile. Section 42 and the review-photo path change are both live.
- Storage (Section 42 is live): upload and remove a profile photo (professional and client), add and delete a portfolio image, add service photos, attach a photo in a chat.

## History

Reverse chronological. Backfilled from git on 2026-11-13: one line per meaningful change, not per commit.

Entries from 2026-11-11 onward carry a status. Earlier entries are all live; anything among them with an open question is listed under Outstanding, and the rest were not individually re-verified for this backfill.

### 2026-11-13

- **[WRITTEN]** Rising Talent badge: given and removed from the admin panel, shown for 90 days on search, category pages, the homepage and the profile header; new entry on the badges page — `lib/rising.js`, `components/TrustMark.js`, `components/badgeArt.js` (hand-drawn emblem until the designer supplies one), `app/badges/page.js`, `app/admin/page.js`, `app/api/admin`, `app/search/page.js`, `app/page.js`, `app/categories/[slug]/page.js`, `app/freelancers/[id]/page.js`, `app/api/featured-professionals`, `lib/freelancerColumns.js`
  - Needs testing: give and remove the badge in the admin panel; check where it shows
  - SQL to run: Section 43, run by Carson 2026-11-13
- **[WRITTEN]** Profile and client-profile save errors now say what went wrong — `lib/saveErrorMessage.js`, `app/dashboard/page.js`
  - SQL to run: no
- **[WRITTEN]** Removed the dead `deleteReply` function — `app/inbox/page.js`
  - SQL to run: no
- **[WRITTEN]** Admin link for admins only, in the workspace sidebar and the top menu; `/api/admin?check=1` answers whether the caller is an admin — `lib/useIsAdmin.js`, `components/WorkspaceSidebar.js`, `components/SiteNav.js`, `app/api/admin/route.js`
  - Needs testing: no Admin link for a non-admin account
  - SQL to run: no
- Local only, not in git: the admin page failed on localhost because `.env.local`'s `ADMIN_EMAILS` listed only the Outlook address; the Gmail address was added. Vercel already had both.
- **[SHIPPED]** Vetted Rising admin alert email: arrives at the addresses in `ADMIN_EMAILS`. Confirmed by Carson 2026-11-13 (email received 5 Nov).
- **[DEPLOYED]** Storage rules: only the owner can add, replace or delete their own files; nobody can list other people's; photo buckets take JPG, PNG and WebP up to 10 MB — `SUPABASE_SQL.sql` Section 42, `app/freelancers/[id]/page.js` (review photos saved under the reviewer's own folder). Code live as 2d1c3f0; tested on an in-memory Postgres, 10 checks.
  - Needs testing: the upload and delete actions on Carson's test list
  - SQL to run: Section 42, run by Carson 2026-11-13
- **[SHIPPED]** Profile "Save changes" works (April checklist §1.2). Confirmed by Carson 2026-11-13.
- **[SHIPPED]** Leaked key clean-up: legacy keys changed (April checklist §1.3). Confirmed by Carson 2026-11-13.
- **[WRITTEN]** `CHANGELOG.md` and `CLAUDE.md` added — repo root. Not committed.
  - SQL to run: no
- **[DEPLOYED]** Notification routes accept only a saved row's id and need its author to be signed in — `app/api/notify-message`, `notify-reply`, `match-saved-searches`, `lib/serverNotifyGuard.js`, `lib/notifyContent.js`
  - Needs testing: enquiry, reply, quote, invoice, reminder and receipt notifications
  - SQL to run: yes, Section 39 (not run)
- **[DEPLOYED]** Enquiries need an account — `app/freelancers/[id]/page.js`
  - Needs testing: signed-out Contact buttons go to log in
  - SQL to run: yes, Section 39 (not run)
- **[DEPLOYED]** Audit fixes: receipts need a paid job, quote events must match the saved quote, bookings validated on the server, invite limits, whole-number ratings — `app/api/documents/pdf`, `notify-quote-event`, `notify-saved`, `request-booking`, `reviews`, `client-review`, `organisation-invite`, `signup`, `lib/displayName.js`
  - Needs testing: see Outstanding
  - SQL to run: no
- **[WRITTEN]** Database guards on quotes, professional profiles, messages and replies — `SUPABASE_SQL.sql` Section 40
  - SQL to run: yes, Section 40 (not run)
- **[DEPLOYED]** Pages read named public columns of a professional, never the whole row — `lib/freelancerColumns.js`, `lib/freelancerContact.js`, `lib/myFreelancer.js`, 9 pages, `tests/freelancerColumns.test.js`
  - Needs testing: profile, search, saved, dashboard, messages, jobs after Section 41
  - SQL to run: yes, Section 41 (not run; only after the code is live, which it now is)
- **[DEPLOYED]** Sitemap lists professionals again — `app/sitemap.js`
  - SQL to run: no

### 2026-11-12

- **[DEPLOYED]** Client sees "your invoice has been sent" when it went automatically — `app/messages/page.js`, `app/organisation/requests/[id]/page.js`
- **[DEPLOYED]** "Quote this service" hides once a quote is sent — `app/inbox/page.js`, `lib/quoteReply.js`
- **[DEPLOYED]** Log out in the workspace sidebar — `components/WorkspaceSidebar.js`
- **[SHIPPED]** Confirming a rental sends its quote by itself; "Quote this service" restored; "Unauthorized" on confirm fixed — `app/api/booking-respond`, `lib/serverQuote.js`, `lib/authedFetch.js`. Confirmed by Carson 2026-11-12.
- **[SHIPPED]** Invoice on acceptance: automatic tick box and Send invoice from the notification — `app/api/notify-quote-event`, `lib/serverInvoice.js`. Confirmed by Carson 2026-11-12 (SQL Section 37 run).
- **[DEPLOYED]** Clients can only respond to a quote, not edit it — SQL Section 38 (run 2026-11-12)
- **[SHIPPED]** Dashboard never loading, fixed — `app/dashboard/page.js`. Confirmed by Carson 2026-11-12.
- **[DEPLOYED]** Rentals & Stays: per-item availability, date requests, length discounts — SQL Section 36 (run 2026-11-12)

### 2026-11-11

- **[DEPLOYED]** Site set in Barlow, fonts in three CSS variables, documents moved over
- **[DEPLOYED]** Guided profile setup; the site's own icons; guide layout and hover

### 2026-11-04

- Read-back step before a profile goes live; stale "From" price fixed (SQL Section 35)

### 2026-11-03

- Review write path closed: reviews only through the two API routes (SQL Section 34)
- Public trust claims rewritten to say only what can be backed
- Browsers can spellcheck listings

### 2026-09-15

- Dashboard, Inbox and Quotes & earnings load faster: shared profile lookup, parallel queries, saved copy

### 2026-09-14

- Quotes, invoices and receipts render as real PDFs on the server
- Documents: validity, payment details and terms; payment terms shown instead of a due date; one sheet on US Letter; iPhone pagination fixed
- Next.js upgraded to 16.3.5 for security advisories

### 2026-09-13

- Profile handles (`/freelancers/<handle>`) (SQL Section 32); inbox quote preview uses the shared printer

### 2026-09-12

- Organisation accounts: a third account type with its own workspace, team, enquiries, quotes and search (SQL Section 27)
- Document verification codes; multi-professional quote requests (SQL Sections 28, 29)
- Purchase order attachments on accepted quotes (SQL Section 30)
- Exportable records for organisations; public organisation page (SQL Section 31)
- Trust-mark family and the "What our badges mean" page
- Visual pass: line icons, one card system, Bds$, designer's category icons and trust marks

### 2026-08-19

- Vetted Rising programme page and application form; added to the sidebar
- Dark mode fixes on Vetted Rising and the review-a-client empty state

### 2026-08-16 to 2026-08-17

- Services grouped by venture on one profile; profiles appear under up to 3 categories
- Per-venture jobs and earnings (SQL Section 26)
- Terms of Service acceptance required and recorded; existing users re-prompted on new versions
- Brand assets: favicons, app icons, share image tuned for WhatsApp
- Install / Add to home screen button in Settings; My enquiries for professionals
- Em dashes removed from user-facing copy

### 2026-08-10 to 2026-08-11

- All absolute links use the custom domain (`NEXT_PUBLIC_SITE_URL`)
- Auth flows behind Supabase email links hardened
- Invite a friend share page (`/invite`)

### 2026-07-28

- Delete any quote or invoice, with confirmation
- Calendar "Now" line; dummy-data seed script retired

### 2026-07-03 to 2026-07-11

- Account deactivation with a 60-day grace period; hide profile; admin clean-up tools (SQL Section 22)
- Google sign-in and a guided profile tour
- Workspace Guide (`/guide`); Facebook and X share buttons; new app icon
- Theme choice syncs across devices; theme reset on the installed app fixed

### 2026-06-18 to 2026-06-23

- Workspace sidebar shell; Settings, Clients and Reviews pages; marketplace search in the top bar
- Calendar and appointments; booking requests end to end; My bookings for clients (SQL Sections 18 to 21)
- Inbox and Messages rebuilt as a split-pane chat; multi-select delete
- Earnings: chart over time, trend cards, transactions table, CSV export
- Notification bell made reliable: realtime auth, fallback poll, awaited inserts
- Push: stale subscription cleared before re-subscribing

### 2026-06-10 to 2026-06-15

- Security overhaul: authenticated APIs and row level security (SQL Section 2)
- Saved professionals, quotes dashboard, installable app (SQL Section 3)
- Push notifications (SQL Section 4); in-app notifications with bell and page (SQL Section 13)
- Profile analytics, featured listings, category pages (SQL Section 5); client profiles (SQL Section 6)
- Invoices and earnings tracking (SQL Section 7); paid receipts; payment reminders
- Phone verification and the verified badge (SQL Section 9)
- Dual job completion and paid-gated reviews (SQL Section 10); review responses (SQL Section 14)
- Live conversations (SQL Section 11); chat photos (SQL Section 15)
- Response-time signal (SQL Section 16); saved-search alerts (SQL Section 17)
- Dark mode; stronger signup password policy

### 2026-04-14 to 2026-04-20

- Calendar, new navigation and footer, featured professionals, availability system, review reports
- Quote and messaging system updated; roadmap page; tooltips

### 2026-03-18 to 2026-03-29

- First build: search, profiles, signup and login, dashboard, two-way reviews
- Inbox and contact form; client and professional dashboards separated
- Password reset; account settings; Terms and Privacy pages
- Services with images and a lightbox; 15 categories; price indicators
- Admin panel; About and FAQ pages
- SEO metadata, sitemap and structured data
- Client messages with quotes and PDF download; email on new message
- "Vetted 3.0" overhaul
