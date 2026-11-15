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

Everything that is not SHIPPED, newest first. Last checked against the live site and database on 2026-11-14. Items marked "April checklist" come from `Vetted-bb-Pre-Launch-Checklist.docx` (April 2026) and its 21 June reconciliation, `Vetted-bb-Outstanding-Issues-Updated_1.docx`, both in Downloads.

### Written, not live

- **[WRITTEN]** Signup password minimum raised in the Supabase dashboard (8 characters, upper and lower case, digits and symbols). Set by Carson 2026-11-13; it is a setting, not code.

### Live but not verified

- **[DEPLOYED]** Inbox crash fix and three fixes from Carson's first test run, 2026-11-14 (f97e149). On the live site, signed in as the Pro, the Client Test conversation that crashed now opens with its quote and invoice cards and no console errors. Not seen: the enquiry form's read-only name, the header email on a phone, and whether a push now arrives (needs a real device).
  - Needs testing: TESTING.md section 2 (enquiry name, header email, push).
- After the push on 2026-11-14 the live site was checked signed in as a professional: Dashboard (Outstanding card, Reports link), Quotes & earnings, Reports, Settings (reminders switch) and Inbox all load with no console errors. Nothing was clicked through: no payment recorded, no deposit quote sent, no expense added, no PDF or CSV downloaded. Reminders are in dry-run mode.
- **[DEPLOYED]** Stress-test fixes to the whole unpushed batch, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. They changed SQL Sections 44, 45 (comments only) and 47, so the combined 44–47 file must be run again even if the earlier one was run (it is safe to re-run). Tested: reminder job against a fake database (18 checks), reminder rules (18 unit tests), Sections 44 and 47 in an in-memory database (17 and 12 checks), the per-person limit through the real route, the original stress script (no failures left), 218 unit tests, the build. NOT tested: two payments saved at the same instant (the in-memory database has one connection); the receipts upload rule against Supabase's real storage; any signed-in screen.
  - Needs testing: TESTING.md sections 3 (Removed payments, overpayment), 5 and 6.
- **[DEPLOYED]** Year-end income summary, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. Needs no SQL of its own; part payments (44) and expenses (47) only count once those sections have run. Tested: the figures (8 unit tests), the PDF route against a fake database (6 checks: signed out, own figures only, figures sent by the browser ignored, members only for an organisation, disclaimer present, no expense descriptions), the production build. The PDF layout was seen with sample figures; the signed-in pages were not seen (the local preview is signed out).
  - Needs testing: TESTING.md sections 3 and 4 (Reports, Year-end summary).
- **[DEPLOYED]** Job expenses, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. SQL Section 47 must run BEFORE the push (it also updates the Section 44 payment trigger, so run 44 first; the combined file does). Tested: privacy rules in an in-memory database (9 checks), billed vs unbilled through the real acceptance code (2 checks), PDF and money rules (unit tests), a test that fails if any client-facing file reads job_expenses. Not seen signed in.
  - Needs testing: TESTING.md section 3 (Expenses).
- **[DEPLOYED]** Outstanding / Payable card, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. Needs SQL Section 44 (part payments) for part-paid amounts to count right; without it every unpaid invoice counts in full. Unit-tested; the card itself was not seen signed in.
  - Needs testing: TESTING.md (dashboard and Records).
- **[DEPLOYED]** Rate limits shared across servers, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. SQL Section 46 can run before or after the push (until it runs, the routes keep the old per-server counts). Tested: the SQL in an in-memory database (4 checks), two separate copies of the limiter sharing one count (4 checks), every route's limiter call awaited (test).
- **[DEPLOYED]** Automatic payment reminders, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. SQL Section 45 must run BEFORE the push. The daily job is in DRY-RUN mode until `PAYMENT_REMINDERS_MODE=live` is set in Vercel. Tested: decision rules (11 unit tests, including a full invoice life and Barbados-time edges), the real job against a fake database (7 checks), the SQL in an in-memory database (4 checks). Never run against the live database.
  - Needs testing: see TESTING.md section 5.
- **[DEPLOYED]** Deposits and part payments, 2026-11-14. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. SQL Section 44 must run BEFORE the push. Tested against an in-memory database (8 checks), the real acceptance route with a fake database (3 checks) and unit tests; the signed-in screens were not seen (no signed-in session available).
  - Needs testing: build a quote with a 50% deposit and preview its PDF; accept it from a client account; record the deposit payment; raise the balance invoice; record a part payment then the rest; check the PDFs, the client's cards and My jobs; a quote with no deposit still invoices for the total.
- **[DEPLOYED]** CSV export of quotes and invoices, 2026-11-13. Deployed 2026-11-14 (2cd5e4f); SQL Sections 44–47 run the same day, checked on the live database. Checked on localhost as a professional: the dialog opens on 1 Jan to today; the file downloaded with the right name, a BOM, the header in order, invoices linked to their quotes, newest first; "No records found for that date range" for last year. The organisation version was checked only by unit tests (no organisation account exists).
  - Needs testing: export as an organisation from Records; open a file in Excel.

- **[DEPLOYED]** Rising Talent badge, 2026-11-13 (341df58). Checked on live: the admin panel shows a Rising button on all 6 profiles; the badges page lists it. No profile has the badge yet.
  - Needs testing: give a profile the badge, check it on search, a category page and the profile header, then remove it.
- **[DEPLOYED]** Admin link for admins only, 2026-11-13 (341df58). Checked on live: shown in the sidebar and the top menu for Carson's account.
  - Needs testing: no Admin link for a non-admin account.
- **[DEPLOYED]** Profile save shows the real reason when it fails; dead `deleteReply` removed, 2026-11-13 (341df58).

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

The full step-by-step list is in [TESTING.md](TESTING.md), grouped by account (visitor, client, professional, organisation).

## History

Reverse chronological. Backfilled from git on 2026-11-13: one line per meaningful change, not per commit.

Entries from 2026-11-11 onward carry a status. Earlier entries are all live; anything among them with an open question is listed under Outstanding, and the rest were not individually re-verified for this backfill.

### 2026-11-14

- **[DEPLOYED]** The Pro's inbox crashed ("This page couldn't load") on opening any conversation with a quote in it, live since 2cd5e4f: the quote builder's deposit settings were named `quoteDeposit`, hiding the `quoteDeposit()` helper the quote card calls. The "No messages yet" share box had the same fault with `profileUrl`, crashing the inbox for a professional with no messages. A new test fails if any file declares a name it also imports. The enquiry form's name is now the account's name and cannot be edited there (clients change it on their dashboard), like the email. The client's conversation header shows the professional's email (it was only in the side panel, hidden below laptop width). Every push is now awaited (nine places sent it without waiting, so Vercel could stop the function before it went), with an 8-second limit per device. — `app/inbox/page.js`, `app/page.js`, `app/freelancers/[id]/page.js`, `app/messages/page.js`, `lib/serverPush.js`, `lib/serverOrgRecipients.js`, eight routes in `app/api/`, `tests/hiddenImports.test.js`
  - Needs testing: TESTING.md sections 2 and 3
  - SQL to run: no
- **[DEPLOYED]** Stress test of the unpushed batch, then fixes for everything it found.
  - Reminders: only the people in the job's conversation are emailed (a quote with no conversation, or the address typed on a quote, is never used); what was sent is read from `payment_reminder_log`, not from the quote row a professional can edit; a series never starts on an invoice already 14+ days overdue and nothing goes at 60+ days (so going live does not email old unpaid invoices); at most 10 reminders per job; a failed email is retried on later days (3 tries per stage) and no longer uses up the stage; the job reads every page of invoices within a due-date window instead of the 500 oldest, and stops with time to spare.
  - Money, in the database: a payment cannot be future-dated, exceed what is owed, name another job's invoice, or go on a job already marked paid; the job's row is locked so two payments at once are both counted; a removed payment is kept in `invoice_payment_removals` and shown under "Removed"; a deposit invoice cannot exceed the total; billed costs cannot be negative; expenses have date, amount and length limits; receipts are for professionals only, 2,000 files each.
  - Other: every non-number CSV cell is guarded against spreadsheet formulas (the expenses file had three unguarded columns); an invoice that includes billed costs says so and how much in the client's notification and email; rate limits on signed-in routes are per person, with a generous per-connection ceiling, a 1.5 second cap on the shared count, and IPv6 counted by network; a job marked paid counts as received in full in the year-end summary; other currencies are left out of the summary and said so.
  - Files: `app/api/cron/payment-reminders/route.js`, `lib/paymentReminders.js`, `lib/rateLimit.js`, six routes in `app/api/` (notify-message, notify-reply, notify-quote-event, notify-saved, organisation-invite, request-booking), `lib/financialCsv.js`, `lib/payments.js`, `lib/incomeSummary.js`, `lib/reportHtml.js`, `lib/invoicing.js`, `lib/serverInvoice.js`, `components/PaymentsPanel.js`, `components/IncomeSummary.js`, `app/quotes/page.js`, `SUPABASE_SQL.sql`, tests
  - Needs testing: TESTING.md sections 3, 5 and 6
  - SQL to run: Sections 44–47, run 2026-11-14
- **[DEPLOYED]** Year-end income summary. Professionals get a new **Reports** page in the sidebar; organisations get a "Year-end summary" section at the bottom of Records. Pick a year (this year by default): Total received (cash basis) is the headline, then Total invoiced, Outstanding, Expenses logged and Net (professionals only), Invoices issued, Clients or Professionals, Average invoice, and a Month / Invoiced / Received / Expenses table. Received counts money on the day it came in, whichever year it was invoiced; Invoiced counts each invoice (deposit and balance separately) on its issue date; Outstanding is what is still owed today on that year's invoices. Download as CSV (one row per month) and Download as PDF (branded like invoices; the server works the figures out again from the database with the person's own session, so a Vetted.bb-branded summary always matches the records). The disclaimer is on screen and on the PDF, word for word. No tax figures, rates or forms anywhere. No new tables. — `lib/incomeSummary.js`, `lib/reportHtml.js`, `lib/printQuote.js` (`downloadReportPdf`), `components/IncomeSummary.js`, `app/reports/page.js`, `components/WorkspaceSidebar.js`, `app/organisation/records/page.js`, `app/api/documents/pdf/route.js`, `tests/incomeSummary.test.js`, `tests/expenses.test.js` (allowlist)
  - Needs testing: TESTING.md sections 3 and 4
  - SQL to run: no (uses 44 and 47, run 2026-11-14)
- **[DEPLOYED]** Job expenses: an "Expenses" section on each job in Quotes & earnings (description, amount, date, optional receipt photo, "Bill to client"), with a private Invoiced / Expenses / Profit summary. Billed expenses are copied onto the invoice as "Cost:" lines when it is issued (the job's invoice, or for a deposit job the balance invoice), raise its total, and are marked billed so they never go twice; issued invoices never change. Unbilled expenses never leave job_expenses, which only the professional can read. Receipts go to a PRIVATE `receipts` bucket (owner-only, opened by a 5-minute signed link), not a public one like portfolio. The invoices export can add a second file of expenses with invoiced, expenses and profit per job. Paid-in-full and document verification now use the invoiced total including billed costs. There is no invoices table, so `invoice_id` from the brief is not used: `quote_id` identifies the job and its invoices. — `lib/expenses.js`, `lib/payments.js` (`jobTotal`), `lib/documentHtml.js`, `lib/serverInvoice.js`, `components/ExpensesPanel.js`, `components/ExportCsvDialog.js`, `components/QuickInvoiceDialog.js`, `app/quotes/page.js`, `app/inbox/page.js`, `app/messages/page.js`, `app/jobs/page.js`, `app/organisation/records/page.js`, `tests/expenses.test.js`
  - Needs testing: TESTING.md section 3
  - SQL to run: Section 47, run 2026-11-14
- **[DEPLOYED]** Outstanding card at the top of a professional's dashboard and a Payable card on an organisation's Records: the amount still owed across unpaid and part-paid invoices (per invoice, part payments taken off), "across N invoices", and "N overdue" in red when there are any; "All invoices paid" when nothing is owed. The dashboard card opens Quotes & earnings on Pending payment (`?view=outstanding`); the Records card switches the table to a new "Unpaid invoices" filter. Computed in the browser from one query; no new route. The figure uses the site's display font (Barlow Semi Condensed), not Sora, which is now kept for the logo. — `lib/payments.js` (`outstandingSummary`), `components/OutstandingCard.js`, `app/dashboard/page.js`, `app/quotes/page.js`, `app/organisation/records/page.js`, `tests/payments.test.js`
  - Needs testing: TESTING.md sections 3 and 4
  - SQL to run: Section 44, run 2026-11-14
- **[DEPLOYED]** Rate limits now hold across every Vercel server: counts are kept in Supabase (`rate_limits`, `rate_limit_hit()`, sliding window), with each server's own memory as a quick first check. Keys are hashed, so no IP or user id is stored readably. Only the service role can use them. If the database cannot answer, requests go through on the server's own count rather than locking people out. Old counts are cleared by the daily clean-up job. A test fails if any route forgets to `await` the limiter. Chosen over Upstash: no new account or service. — `lib/rateLimit.js`, the 12 rate-limited routes in `app/api/`, `app/api/cron/purge-deactivated/route.js`, `tests/rateLimit.test.js`
  - Needs testing: TESTING.md section 6
  - SQL to run: Section 46, run 2026-11-14
- **[DEPLOYED]** Automatic payment reminders: a daily job at 9am Barbados time emails clients about unpaid and part-paid invoices 3 days before the due date, on it, and at 7, 14 and 30 days overdue, then stops; the professional gets a notification and push at 7, 14 and 30 days only. Reminders state the outstanding amount, include the professional's payment details, and never go twice in a day (enforced by a unique index on the log) or for an invoice sent in the last 24 hours. Dates are Barbados days. A master switch in Settings (on by default) and "Pause reminders" on each invoice. Dry run by default: nothing is sent until `PAYMENT_REMINDERS_MODE=live`. Every reminder (and every dry-run check) is logged in `payment_reminder_log`. Organisations get no switch: they receive invoices, they do not send them. — `lib/paymentReminders.js`, `app/api/cron/payment-reminders/route.js`, `vercel.json`, `app/settings/page.js`, `components/PaymentsPanel.js`, `app/quotes/page.js`, `tests/paymentReminders.test.js`
  - Needs testing: TESTING.md section 5
  - SQL to run: Section 45, run 2026-11-14
- **[DEPLOYED]** `TESTING.md`: the step-by-step test checklist, by account; `CLAUDE.md` says to keep it updated.
- **[DEPLOYED]** Deposits and part payments. Quotes can ask for a deposit (percentage, default 50, or fixed Bds$), shown under Total on the quote and its PDF. Accepting such a quote invoices the deposit only ("Deposit invoice"); once the deposit is paid, "Raise balance invoice" invoices the rest. Every invoice takes payments through "Record a payment" (amount, date received, method, reference), each one its own row with a history; the job is paid when payments reach the total. The "Paid" tick box is replaced by the payments panel (jobs ticked paid before this still show, with Undo). Invoice PDFs show Total / Paid / Balance due when part-paid. The CSV export now has a line per deposit and balance invoice and fills Payment method and Payment reference from recorded payments. No invoices table exists: an invoice is the quote's row, so the deposit and balance invoices both live on it (no parent_quote_id needed). — `lib/payments.js`, `lib/invoicing.js`, `lib/serverInvoice.js`, `lib/documentHtml.js`, `lib/financialCsv.js`, `lib/printQuote.js`, `components/DepositSection.js`, `components/PaymentsPanel.js`, `components/RecordPaymentDialog.js`, `components/QuickInvoiceDialog.js`, `app/quotes/page.js`, `app/inbox/page.js`, `app/messages/page.js`, `app/jobs/page.js`, `app/organisation/requests/[id]/page.js`, `app/organisation/records/page.js`, `app/api/documents/pdf`, `app/api/notify-reply`, `tests/payments.test.js`, `tests/documentHtml.test.js`, `tests/financialCsv.test.js`
  - Needs testing: see Outstanding
  - SQL to run: Section 44, run 2026-11-14

### 2026-11-13

- **[WRITTEN]** CSV export of quotes and invoices: an Export CSV button on Quotes & earnings (professionals) and on Records (organisations), opening a dialog with From/To dates, presets (This year, Last year, Last 90 days, All time) and a type (All, Invoices only, Quotes only). Each quote is one line and, once invoiced, its invoice is a second line linked by the quote number. Amounts as charged; VAT, payment method and payment reference are always blank because none of them is recorded anywhere. Formula-looking text such as `=HYPERLINK(...)` in a client name is written as text. On Records it replaces the old Export CSV, which downloaded the filtered table with different columns. — `lib/financialCsv.js`, `components/ExportCsvDialog.js`, `app/quotes/page.js`, `app/organisation/records/page.js`, `tests/financialCsv.test.js`
  - Needs testing: export as an organisation; open a file in Excel
  - SQL to run: no
- **[DEPLOYED]** Rising Talent badge: given and removed from the admin panel, shown for 90 days on search, category pages, the homepage and the profile header; new entry on the badges page — `lib/rising.js`, `components/TrustMark.js`, `components/badgeArt.js` (hand-drawn emblem until the designer supplies one), `app/badges/page.js`, `app/admin/page.js`, `app/api/admin`, `app/search/page.js`, `app/page.js`, `app/categories/[slug]/page.js`, `app/freelancers/[id]/page.js`, `app/api/featured-professionals`, `lib/freelancerColumns.js`
  - Needs testing: give and remove the badge in the admin panel; check where it shows
  - SQL to run: Section 43, run by Carson 2026-11-13
- **[DEPLOYED]** Profile and client-profile save errors now say what went wrong — `lib/saveErrorMessage.js`, `app/dashboard/page.js`
  - SQL to run: no
- **[DEPLOYED]** Removed the dead `deleteReply` function — `app/inbox/page.js`
  - SQL to run: no
- **[DEPLOYED]** Admin link for admins only, in the workspace sidebar and the top menu; `/api/admin?check=1` answers whether the caller is an admin — `lib/useIsAdmin.js`, `components/WorkspaceSidebar.js`, `components/SiteNav.js`, `app/api/admin/route.js`
  - Needs testing: no Admin link for a non-admin account
  - SQL to run: no
- Local only, not in git: the admin page failed on localhost because `.env.local`'s `ADMIN_EMAILS` listed only the Outlook address; the Gmail address was added. Vercel already had both.
- **[SHIPPED]** Vetted Rising admin alert email: arrives at the addresses in `ADMIN_EMAILS`. Confirmed by Carson 2026-11-13 (email received 5 Nov).
- **[DEPLOYED]** Storage rules: only the owner can add, replace or delete their own files; nobody can list other people's; photo buckets take JPG, PNG and WebP up to 10 MB — `SUPABASE_SQL.sql` Section 42, `app/freelancers/[id]/page.js` (review photos saved under the reviewer's own folder). Code live as 2d1c3f0; tested on an in-memory Postgres, 10 checks.
  - Needs testing: the upload and delete actions on Carson's test list
  - SQL to run: Section 42, run by Carson 2026-11-13
- **[SHIPPED]** Profile "Save changes" works (April checklist §1.2). Confirmed by Carson 2026-11-13.
- **[SHIPPED]** Leaked key clean-up: legacy keys changed (April checklist §1.3). Confirmed by Carson 2026-11-13.
- **[DEPLOYED]** `CHANGELOG.md` and `CLAUDE.md` added — repo root (2d1c3f0).
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
- **[DEPLOYED]** Database guards on quotes, professional profiles, messages and replies — `SUPABASE_SQL.sql` Section 40 (run 2026-11-13)
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
