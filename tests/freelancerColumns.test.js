import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FREELANCER_PUBLIC_COLS, FREELANCER_PRIVATE_COLS } from '../lib/freelancerColumns.js'

// The database only lets the site's public roles read the public columns of
// the freelancers table (SQL Section 41). A page that asks for the whole row,
// or for a private column by name, gets "permission denied" and shows
// nothing. That is easy to do by accident and impossible to see until it is
// live, so this reads every source file and fails on the first one that
// would.
//
// It covers everything that talks to the database with the PUBLIC key: all
// pages, components and lib files, plus the few API routes that use the
// caller's own session. Routes that use the service role are exempt.

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = new Set(FREELANCER_PUBLIC_COLS.split(',').map(s => s.trim()))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.js')) out.push(p)
  }
  return out
}

// Files whose database client is the service role: not subject to the rule.
const usesServiceRole = src => /SUPABASE_SERVICE_ROLE_KEY/.test(src) || /^\/\/ Server-only|\* Server-only/m.test(src)
// lib/ helpers that are only ever handed a service-role client.
const SERVICE_ONLY = new Set(['lib/serverQuote.js', 'lib/serverInvoice.js', 'lib/serverThreadNotify.js', 'lib/serverOrgRecipients.js', 'lib/serverPush.js', 'lib/serverNotify.js'])
// Reading the private columns directly is the documented fallback for a
// database that has not had Section 41 run yet.
const FALLBACKS = new Set(['lib/myFreelancer.js', 'lib/freelancerContact.js'])

const files = ['app', 'components', 'lib'].flatMap(d => walk(path.join(ROOT, d)))
  .map(p => ({ rel: path.relative(ROOT, p).split(path.sep).join('/'), src: readFileSync(p, 'utf8') }))
  .filter(f => !SERVICE_ONLY.has(f.rel) && !FALLBACKS.has(f.rel))
  .filter(f => !(f.rel.startsWith('app/api/') && usesServiceRole(f.src)))

// Column names in a select list. Nested embeds like services(price) are
// other tables, and ${...} pieces are checked where they are defined.
function columns(list) {
  return list
    .replace(/\$\{[^}]*\}/g, '')
    .replace(/[a-z_]+(?:!inner)?\([^)]*\)/g, '')
    .split(',').map(s => s.trim()).filter(Boolean)
}

// A named constant instead of a literal list: the public list, or the
// server-only issuer list used through readIssuer() with the service role.
const NAMED_LISTS = /^(FREELANCER_PUBLIC_COLS|COLS|ISSUER_COLS)$/

test('the public column list and the private one do not overlap', () => {
  for (const c of FREELANCER_PRIVATE_COLS) assert.equal(PUBLIC.has(c), false, c)
  assert.equal(PUBLIC.size, 32)
})

test('no page reads the freelancers table as a whole row, or a private column', () => {
  const problems = []
  for (const { rel, src } of files) {
    // Direct reads: .from('freelancers') ... .select(<arg>)
    // The query runs from that call to the next .from( (the next query), so
    // a .select() after a long .insert({...}) or .update({...}) is seen too.
    for (const start of src.matchAll(/from\('freelancers'\)/g)) {
      const rest = src.slice(start.index + start[0].length)
      const next = rest.search(/\.from\(|\.rpc\(/)
      const query = next === -1 ? rest.slice(0, 3000) : rest.slice(0, Math.min(next, 3000))
      const m = query.match(/\.select\(([^()]*(?:\([^()]*\)[^()]*)*)\)/)
      if (!m) continue
      const arg = m[1].trim()
      const line = src.slice(0, start.index).split('\n').length
      if (arg === '' ) { problems.push(`${rel}:${line} .select() with no columns returns the whole row`); continue }
      const first = arg.split(/,\s*\{/)[0].trim()
      if (NAMED_LISTS.test(first) || /^`\$\{FREELANCER_PUBLIC_COLS\}/.test(first)) continue
      const text = first.replace(/^[`'"]|[`'"]$/g, '')
      if (/^\*|,\s*\*/.test(text)) { problems.push(`${rel}:${line} select('*') on freelancers`); continue }
      for (const c of columns(text)) {
        if (!PUBLIC.has(c)) problems.push(`${rel}:${line} reads freelancers.${c}, which is not a public column`)
      }
    }
    // Embedded reads: freelancers(<cols>) or freelancers!inner(<cols>) inside another table's select
    for (const m of src.matchAll(/freelancers(?:!inner)?\(([^)]*)\)/g)) {
      const line = src.slice(0, m.index).split('\n').length
      const text = m[1].trim()
      if (/FREELANCER_PUBLIC_COLS/.test(text)) continue
      if (text === '*') { problems.push(`${rel}:${line} freelancers(*) embed`); continue }
      for (const c of text.split(',').map(s => s.trim()).filter(Boolean)) {
        if (!/^[a-z_]+$/.test(c)) continue
        if (!PUBLIC.has(c)) problems.push(`${rel}:${line} embeds freelancers.${c}, which is not a public column`)
      }
    }
  }
  assert.deepEqual(problems, [])
})
