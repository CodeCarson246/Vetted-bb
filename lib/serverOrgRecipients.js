import { createNotification } from './serverNotify'
import { sendPushToUser } from './serverPush'

// Who should hear about activity on a thread. An individual client is one
// person. An organisation thread fans out to every member of the
// organisation, so a quote or invoice is never sitting unseen because the
// colleague who happened to send the enquiry is away.
//
// Server-side only: takes a service-role client, since organisation_members
// is not readable across accounts under RLS.
export async function threadRecipients(admin, msg) {
  if (msg?.organisation_id) {
    const [{ data: members }, { data: org }] = await Promise.all([
      admin.from('organisation_members').select('user_id, email').eq('organisation_id', msg.organisation_id),
      admin.from('organisations').select('name').eq('id', msg.organisation_id).maybeSingle(),
    ])
    const list = members || []
    const userIds = [...new Set(list.map(m => m.user_id).filter(Boolean))]
    const emails = [...new Set(
      [...list.map(m => (m.email || '').trim().toLowerCase()), (msg.sender_email || '').trim().toLowerCase()].filter(Boolean),
    )]
    return {
      isOrganisation: true,
      organisationName: org?.name || null,
      userIds,
      emails,
      greeting: org?.name ? `Hi team at ${org.name}` : 'Hi',
    }
  }
  return {
    isOrganisation: false,
    organisationName: null,
    userIds: msg?.sender_user_id ? [msg.sender_user_id] : [],
    emails: msg?.sender_email ? [msg.sender_email] : [],
    greeting: msg?.sender_name ? `Hi ${msg.sender_name}` : 'Hi',
  }
}

// Is this user a member of the organisation? Used to authorise actions on
// an organisation's quotes by colleagues other than the original enquirer.
export async function isOrganisationMember(admin, organisationId, userId) {
  if (!organisationId || !userId) return false
  const { data } = await admin
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', organisationId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// In-app notification + push for every recipient. The inserts are awaited
// so they complete before a serverless function returns; push is fire-and-
// forget as elsewhere.
export async function fanOut(userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  await Promise.all(ids.map(id => createNotification(id, payload)))
  for (const id of ids) {
    sendPushToUser(id, { title: payload.title, body: payload.body || '', url: payload.link }).catch(() => {})
  }
}
