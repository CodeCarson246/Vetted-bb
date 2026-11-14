# Vetted.bb: instructions for Claude

## Keep CHANGELOG.md up to date

At the end of every session where code changes, add an entry to `CHANGELOG.md` at the repo root. Do this before reporting the work as finished.

Entry format, under `## History`, newest date first:

```
### YYYY-MM-DD
- **[STATUS]** What changed — files touched
  - Needs testing: what specifically to check
  - SQL to run: yes/no
```

Rules:

- New work is `DEPLOYED` (code is live) or `WRITTEN` (not deployed, or not confirmed). Never `SHIPPED`.
- Only Carson moves an item to `SHIPPED`, after he has tested it. When he says something is tested and working, change its status and remove it from `## Outstanding / unverified`.
- Anything not `SHIPPED` also goes in `## Outstanding / unverified`, newest first.
- Always say if a change needs SQL that has not been run, and which section of `SUPABASE_SQL.sql`.
- Keep entries short: one line each, plus the two sub-lines.
- Be accurate over tidy. If something was only tested against a fake database, or not tested at all, say so. Do not write that something works unless it was checked on the live site.
- Before changing a status, check the real state (git, the live site, the database) and do not go by memory.
