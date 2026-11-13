'use client'
import { supabase } from './supabase'

// A professional's contact details, for the people entitled to them.
//
// Email, phone and payment details are not public columns (SQL Section 41).
// The database hands them out through freelancer_contact(id): the email to
// someone in a conversation with that professional, and the phone and
// payment details as well to someone who has a quote from them, since those
// are printed on quotes, invoices and receipts.
//
// Pages that show a professional alongside a conversation or a job load the
// public part of the row as usual and then call withFreelancerContacts() to
// fill in email / phone / payment_details on it.
//
// Before Section 41 has been run the function does not exist yet; the
// columns are still readable then, so they are read directly instead.

const REUSE_MS = 5 * 60_000
let cache = { userId: null, byId: new Map() } // id -> { at, contact }

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.user?.id || null
  } catch { return null }
}

async function loadContact(id) {
  const { data, error } = await supabase.rpc('freelancer_contact', { p_freelancer_id: id })
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data
    return row ? { email: row.email ?? null, phone: row.phone ?? null, payment_details: row.payment_details ?? null } : null
  }
  const { data: direct } = await supabase
    .from('freelancers')
    .select('email, phone, payment_details')
    .eq('id', id)
    .maybeSingle()
  return direct ? { email: direct.email ?? null, phone: direct.phone ?? null, payment_details: direct.payment_details ?? null } : null
}

/** Contact details for several professionals: Map of id -> { email, phone, payment_details } */
export async function fetchFreelancerContacts(ids) {
  const wanted = [...new Set((ids || []).filter(Boolean))]
  const out = new Map()
  if (wanted.length === 0) return out

  // What one account may see is never handed to the next one to sign in.
  const userId = await currentUserId()
  if (cache.userId !== userId) cache = { userId, byId: new Map() }
  const mine = cache

  await Promise.all(wanted.map(async id => {
    const hit = mine.byId.get(id)
    if (hit && Date.now() - hit.at < REUSE_MS) { if (hit.contact) out.set(id, hit.contact); return }
    try {
      const contact = await loadContact(id)
      mine.byId.set(id, { at: Date.now(), contact })
      if (contact) out.set(id, contact)
    } catch { /* leave it out: the page shows the row without contact details */ }
  }))
  return out
}

/**
 * Fill in contact details on rows that carry an embedded professional.
 * `pick` returns the embedded object for a row (default: row.freelancers).
 * Returns new rows; nothing is changed in place.
 */
export async function withFreelancerContacts(rows, pick = r => r?.freelancers) {
  const list = rows || []
  const contacts = await fetchFreelancerContacts(list.map(r => pick(r)?.id))
  if (contacts.size === 0) return list
  return list.map(r => {
    const f = pick(r)
    const c = f?.id ? contacts.get(f.id) : null
    return c ? { ...r, freelancers: { ...f, ...c } } : r
  })
}
