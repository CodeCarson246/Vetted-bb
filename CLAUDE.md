# Vetted.bb

A marketplace for finding and hiring trusted, reviewed freelancers and
tradespeople in **Barbados**. Clients search by category and parish, message
professionals, receive quotes, and leave reviews once a job is completed and
paid. Professionals get a full workspace: inbox, calendar, quoting, invoicing,
earnings and client management.

Production domain: **https://vetted.bb** (deployed on Vercel).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | **JavaScript, not TypeScript** (`.js` / `.jsx`, ESM, `"type": "module"`) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/postcss`), custom CSS vars in `app/globals.css` |
| Backend | Supabase (Postgres + Auth + Realtime + Storage), RLS-first |
| Push | `web-push` (VAPID), service worker + `push_subscriptions` table |
| Email | Resend (`RESEND_API_KEY`) |
| Tests | `node --test` (built-in runner), no test framework |
| Deploy | Vercel, one cron in `vercel.json` |

Path alias: `@/*` maps to the repo root (`jsconfig.json`), e.g. `@/lib/supabase`.

## Commands

```bash
npm install        # node_modules is NOT checked in and may be absent in a fresh session
npm run dev        # next dev
npm run build      # next build
npm test           # node --test "tests/**/*.test.js"  (48 tests, pure Node, no deps needed)
npm run lint       # eslint  (requires npm install first)
```

`npm test` passes without `npm install` because the tests only cover
dependency-free helpers in `lib/`. Anything touching Next, React or Supabase
needs the install first.

---

## Layout

```
app/                Next App Router pages + route handlers
  api/              server routes (see "Server routes" below)
  dashboard/        freelancer home (3.4k lines, the largest file in the repo)
  freelancers/[id]/ public professional profile
  inbox/ messages/ quotes/ calendar/ clients/ reviews/   freelancer workspace
  search/ categories/ saved/                             client-side marketplace
  guide/ roadmap/ about/ faq/ terms/ privacy/ invite/ vetted-rising/
components/         shared UI; calendar/ holds the week/month views
lib/                helpers, Supabase client, auth context, formatters
tests/              node:test unit tests for lib/ helpers
*.sql               Supabase schema and maintenance scripts (see below)
```

### SQL files
Schema is **not** managed by migrations. `SUPABASE_SQL.sql` (864 lines) is the
cumulative, idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) schema + RLS
policy script, run by hand in the Supabase SQL editor.
`VETTED_RISING_SQL.sql` adds the Vetted Rising table.
`CLEANUP_DUMMY_DATA.sql` and `RESET_DUMMY_DATA.sql` are guided maintenance
scripts. **When you add a column, table or policy, append it to
`SUPABASE_SQL.sql` in the same idempotent style** so a fresh database can be
rebuilt from the one file.

---

## Domain model

**Two roles, one account system.** A user is a *freelancer* if they have a row
in `freelancers` keyed by `user_id`; otherwise they are a *client*.
`components/AppChrome.js` branches on this: freelancers get
`WorkspaceSidebar` + `WorkspaceTopbar` on every page, everyone else gets
`SiteNav` + `SiteFooter`. The flag is cached in `localStorage`
(`vetted_is_freelancer`) so returning freelancers don't flash the wrong chrome.

**Key tables** (by usage): `freelancers`, `messages`, `reviews`, `quotes`,
`message_replies`, `services`, `appointments`, `notifications`,
`client_profiles`, `availability_settings`, `availability_blocks`,
`portfolio_items`, `service_images`, `saved_professionals`, `saved_searches`,
`push_subscriptions`, `profile_views`, `account_deactivations`,
`vetted_rising_applications`, `review_reports`.

**Storage buckets**: `avatars`, `portfolio`, `service-images`, `chat-photos`,
`review-photos`.

**Job lifecycle** (`quotes.status`): `sent` → `accepted` / `declined` →
`invoiced` → `paid`. Completion is *mutual*: `completed_at` is the
freelancer's confirmation and `client_completed_at` is the client's.

**Review integrity gate** (`app/api/reviews/route.js`): a client may review a
professional only after a job between them is both mutually completed **and**
marked `paid`. One client review per user per freelancer. Posting a review
recalculates and persists `freelancers.rating` / `review_count`. Do not
loosen this gate without an explicit ask; it is the product's core promise.

**Categories and parishes** are single sources of truth in `lib/categories.js`
and `lib/parishes.js`. `CATEGORIES[].name` must match `freelancers.category`
values exactly. A profile can appear under up to `MAX_CATEGORIES` (3):
its primary `category` plus `extra_categories`; always resolve them through
`effectiveCategories(f)` so search, category pages, saved-search alerts and
the public profile can't drift apart. Parishes are stored in full
("Saint Michael"); display them via `formatParish()`.

**Ventures**: one professional can run multiple businesses. Services are
grouped by venture and shown as tabs on the public profile.

---

## Server routes and security model

Route handlers live in `app/api/*/route.js`. The important pattern, followed by
every privileged route:

1. Read `SUPABASE_SERVICE_ROLE_KEY`; 500 if missing.
2. Pull the caller's JWT from the `Authorization: Bearer` header.
3. `supabase.auth.getUser(token)` to derive identity **server-side**.
4. `rateLimit(key, { limit, windowMs })` from `lib/rateLimit.js`.
5. Validate the body; never trust caller-supplied identity, type or dates.

The service-role key bypasses RLS, so a route using it **must** do its own
authorization. `lib/rateLimit.js` is per-instance and in-memory: a speed bump,
not a security boundary. The real boundaries are the auth checks and RLS.

- Admin routes gate on `ADMIN_EMAILS` (comma-separated), checked server-side
  only; `app/admin/page.js` is a UI shell with no privileged logic.
- `app/api/cron/purge-deactivated` is protected by `CRON_SECRET` and runs
  daily at 06:00 UTC via `vercel.json`.
- Notifications: `lib/serverNotify.js` (in-app rows, `dedupe_key` makes repeat
  sends idempotent, swallows Postgres `23505`) and `lib/serverPush.js` (web
  push). Both are server-only and use the service-role key.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL        NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       (server only, never expose)
NEXT_PUBLIC_SITE_URL            https://vetted.bb | http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY    VAPID_PRIVATE_KEY  VAPID_SUBJECT
RESEND_API_KEY                  ADMIN_EMAILS       CRON_SECRET
NEXT_PUBLIC_SHOW_STATS_NUMBERS
```

Always build absolute URLs from `SITE_URL` / `SITE_HOST` in `lib/siteUrl.js`,
never hardcode the domain.

---

## Conventions

**No em dashes in user-facing copy.** This has been enforced across several
commits. Use a comma, a colon, or a full stop instead. Em dashes are fine in
code comments and JSX comments, where the codebase uses them heavily.

**Theme.** Light/dark via `data-theme` on `<html>`. The choice is persisted in
*both* a cookie and `localStorage` (each heals the other, since some browsers
drop one), applied by an inline pre-paint script in `app/layout.js`, and
synced to `auth.user_metadata.theme` for logged-in users so it follows them
across devices. `suppressHydrationWarning` on `<html>` is deliberate.
**Every new surface must be checked in dark mode** — several commits exist
purely to fix dark-mode regressions. Prefer the semantic CSS vars
(`--page-bg`, `--surface-card`, `--border-card`, `--accent`) over raw hex.

**Brand colours**: navy `#00267F`, yellow `#F9C000`, cream `#FFFCF4`
(the Barbados flag). Fonts: Sora (headings) + Inter (body), from Google Fonts.

**Navigation must be client-side.** Use `next/link`, never a bare `<a>` for
internal routes — a full page load resets the theme and flashes in the PWA.

**PWA.** Installable (`app/manifest.js`, `public/sw.js`, `components/InstallPrompt.js`,
`lib/install.js`). Test changes to chrome and navigation in installed-PWA mode.

**Realtime.** `lib/auth-context.js` pushes the access token into
`supabase.realtime.setAuth()` on every session change. Without it, RLS
policies using `auth.uid()` deliver *nothing* over `postgres_changes` and live
updates silently degrade to polling. Don't remove that sync.

**Terms versioning.** Bump `TERMS_VERSION` in `lib/terms.js` (keep it in step
with the "Last updated" date on `/terms`) whenever the Terms change in a way
that needs fresh consent. Users are re-prompted via `TermsUpdateNotice`.

**Auth context.** `AuthProvider` makes exactly one `getSession()` call and one
`onAuthStateChange` subscription for the whole app. Consume it with
`useAuth()`; do not add parallel session listeners.

**Comments.** The codebase favours short explanatory comments about *why*,
especially around browser quirks and security decisions. Match that density.

**Commit messages**: imperative, sentence case, no prefix convention, a scope
prefix only when it helps. For example
`Fix dark mode on the Vetted Rising page`,
`Quotes tab: delete any quote/invoice (not just recent earnings)`.

**Tests.** Only dependency-free `lib/` helpers are unit-tested. If you add a
pure helper (formatting, matching, validation, policy), add a
`tests/<name>.test.js` alongside it using `node:test` and `node:assert`.

---

## Working notes

- `app/dashboard/page.js` (3.4k lines), `app/freelancers/[id]/page.js` (2k) and
  `app/inbox/page.js` (1.7k) are large. Read the relevant section rather than
  the whole file, and prefer surgical edits.
- The public roadmap at `/roadmap` tracks product phases: The Foundation,
  Trust & Reach, Growth Tools, Business & Engagement, The App, Payments &
  Membership.
- **Vetted Rising** is a programme for new/emerging professionals
  (`/vetted-rising`, `components/VettedRisingForm.js`,
  `app/api/vetted-rising/route.js`).
- Each Claude Code session starts from a fresh clone with no memory of prior
  sessions. Git history is the durable record; this file is the handoff.
