import { parsePrice } from './price.js'

/**
 * What a profile needs before it is any use to a client.
 *
 * The site's whole promise is that you can see who someone is and what they
 * charge before you contact them. A profile with no bio and no priced service
 * delivers neither: the client learns nothing and the professional gets no
 * enquiry. Four of the first six profiles were in exactly that state.
 *
 * One source of truth, shared by the guided setup, the dashboard banner and
 * the search ranking, so they can never disagree about what "finished" means.
 */

export const MIN_BIO_CHARS = 40

/** A service that tells a client what something costs. */
export function isPricedService(service) {
  const n = parsePrice(service?.price)
  return n !== null && n > 0
}

/**
 * The checklist, in the order the guided setup asks for it. Each item carries
 * the copy the dashboard banner shows, so the wording stays in one place.
 */
export function profileRequirements(profile, services = []) {
  const bio = (profile?.bio || '').trim()
  const list = services || []

  return [
    {
      key: 'name',
      label: 'Your name',
      done: !!(profile?.name || '').trim(),
      hint: 'Clients look for a person, not a company alone.',
    },
    {
      key: 'trade',
      label: 'Your trade',
      done: !!(profile?.trade || '').trim(),
      hint: 'Plumber, Hairdresser, Tutor. It sits under your name everywhere.',
    },
    {
      key: 'category',
      label: 'Your category',
      done: !!(profile?.category || '').trim(),
      hint: 'Puts you on the right browse page.',
    },
    {
      key: 'location',
      label: 'Your parish',
      done: !!(profile?.location || '').trim(),
      hint: 'Most people search for someone near them.',
    },
    {
      key: 'bio',
      label: 'A few words about you',
      done: bio.length >= MIN_BIO_CHARS,
      hint: `At least ${MIN_BIO_CHARS} characters. Say what you do and how long you have done it.`,
    },
    {
      key: 'service',
      label: 'One service with a price',
      done: list.some(isPricedService),
      hint: 'A price, even a starting price, is the difference between an enquiry and a scroll past.',
    },
  ]
}

export function isProfileComplete(profile, services = []) {
  return profileRequirements(profile, services).every(r => r.done)
}

/** The items still outstanding, for the banner and the setup's first step. */
export function missingRequirements(profile, services = []) {
  return profileRequirements(profile, services).filter(r => !r.done)
}

/** 0-100, for the progress bar. */
export function completionPercent(profile, services = []) {
  const reqs = profileRequirements(profile, services)
  return Math.round((reqs.filter(r => r.done).length / reqs.length) * 100)
}
