// Which line icon (components/Icon) stands for each notification type.
// Shared by the bell dropdown and the /notifications page, which used to keep
// two separate emoji maps: the page's copy had no booking entries, so booking
// notifications there fell back to a generic bell.
const MAP = {
  message: 'message',
  reply: 'message',
  quote: 'document',
  invoice: 'document',
  receipt: 'check',
  reminder: 'clock',
  review: 'star',
  quote_accepted: 'check',
  quote_declined: 'declined',
  job_completed: 'check',
  job_paid: 'money',
  saved: 'heart',
  profile_views: 'eye',
  welcome: 'shield',
  saved_search: 'search',
  booking_request: 'calendar',
  booking_confirmed: 'check',
  booking_declined: 'declined',
}

export function notificationIcon(type) {
  return MAP[type] || 'bell'
}
