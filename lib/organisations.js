import { supabase } from './supabase'

// Organisation accounts: a third account type alongside client and
// freelancer. A person signs up "for an organisation", and everything they
// do on the marketplace (enquiries, quotes, jobs) belongs to that
// organisation and is visible to every member of it. See SUPABASE_SQL.sql
// section 27 for the tables and the reasoning.

export const ORG_ROLE = 'organisation'

export function isOrganisationUser(user) {
  return user?.user_metadata?.role === ORG_ROLE
}

export const ORG_KINDS = [
  { value: 'government', label: 'Government ministry, department or agency' },
  { value: 'business',   label: 'Business' },
  { value: 'nonprofit',  label: 'Non-profit or community organisation' },
  { value: 'other',      label: 'Other' },
]

// The five options on the Treasury vendor registration form, in its order.
export const VENDOR_CLASSIFICATIONS = [
  { value: 'employee',        label: 'Employee' },
  { value: 'small_business',  label: 'Small Business' },
  { value: 'other_business',  label: 'Other Business' },
  { value: 'medium_business', label: 'Medium Size Business' },
  { value: 'large_business',  label: 'Large Business' },
]

export const VENDOR_STATUSES = [
  { value: 'not_registered', label: 'Not registered' },
  { value: 'applying',       label: 'Registration in progress' },
  { value: 'registered',     label: 'Registered government vendor' },
]

export function vendorStatusLabel(value) {
  return VENDOR_STATUSES.find(s => s.value === value)?.label || 'Not registered'
}

// ── Cache ──────────────────────────────────────────────────────────────
// The chrome needs to know "is this an organisation user, and which one"
// before the first network round-trip, or it flashes the wrong nav. Same
// idea as the vetted_is_freelancer flag.
const CACHE_KEY = 'vetted_org'

export function readCachedOrganisation() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function cacheOrganisation(entry) {
  try {
    if (entry) localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
    else localStorage.removeItem(CACHE_KEY)
  } catch { /* ignore */ }
}

// ── Lookups ────────────────────────────────────────────────────────────

// The organisation the signed-in user belongs to, plus their role in it.
// Phase 1 assumes one organisation per person. Returns null if none.
export async function fetchMyOrganisation() {
  const { data, error } = await supabase
    .from('organisation_members')
    .select('role, organisations(*)')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data?.organisations) return null
  const entry = { organisation: data.organisations, role: data.role }
  cacheOrganisation({ id: entry.organisation.id, name: entry.organisation.name, verified: !!entry.organisation.verified, role: entry.role })
  return entry
}

// Make sure an organisation user has an organisation. Used right after
// signup (email confirm or Google) where the name was captured on the form
// and stashed in user metadata. Returns the membership, or null if there is
// nothing to create from, in which case the caller sends them to /organisation/setup.
export async function ensureOrganisation(user) {
  const existing = await fetchMyOrganisation()
  if (existing) return existing
  const name = (user?.user_metadata?.organisation_name || '').trim()
  const kind = user?.user_metadata?.organisation_kind || 'business'
  if (name.length < 2) return null
  const { error } = await supabase.rpc('create_organisation', { p_name: name, p_kind: kind })
  if (error) return null
  return fetchMyOrganisation()
}

// ── Invitations ────────────────────────────────────────────────────────
// An invite link may be opened before the person has an account. The
// token is parked in localStorage, survives the signup/login round-trip,
// and is redeemed the first time they land signed in.
const PENDING_INVITE_KEY = 'vetted_invite_token'

export function stashPendingInvite(token) {
  try { if (token) localStorage.setItem(PENDING_INVITE_KEY, token) } catch { /* ignore */ }
}

export function readPendingInvite() {
  try { return localStorage.getItem(PENDING_INVITE_KEY) } catch { return null }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(PENDING_INVITE_KEY) } catch { /* ignore */ }
}

// Redeem a stored invite for the signed-in user. Returns the organisation
// id on success, null if there was nothing to redeem or it failed (the token
// is cleared either way so a dead link cannot loop).
export async function consumePendingInvite() {
  const token = readPendingInvite()
  if (!token) return null
  const { data, error } = await supabase.rpc('accept_organisation_invite', { p_token: token })
  clearPendingInvite()
  if (error || !data) return null
  // Someone who joined via invite is an organisation user from here on,
  // unless they already run a freelancer profile, which keeps its own chrome.
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.user_metadata?.role !== 'freelancer' && user.user_metadata?.role !== ORG_ROLE) {
    await supabase.auth.updateUser({ data: { role: ORG_ROLE } })
  }
  await fetchMyOrganisation()
  return data
}

// ── Address blocks ─────────────────────────────────────────────────────
// Multi-line blocks as printed on quotes and invoices.

export function formatAddressBlock(a) {
  if (!a) return ''
  return [a.address_line1, a.address_line2, a.city_town, a.parish, a.country]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join('\n')
}

// Money on documents. Quotes default to BBD, which Barbados writes as Bds$.
export function currencySymbol(code) {
  if (!code || code === 'BBD') return 'Bds$'
  if (code === 'USD') return 'US$'
  return code + ' '
}
