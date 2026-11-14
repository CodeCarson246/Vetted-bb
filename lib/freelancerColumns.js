// The columns of a professional's profile that anyone may read.
//
// The freelancers table also holds things that are not public: the email
// address, phone number, payment details, default terms, and the admin's
// flag and its reason. The database only lets the site's public roles read
// the columns named here (SQL Section 41), so a page must ask for them by
// name: asking for the whole row ("*") is refused.
//
// Adding a column to the table? It is not readable until it is granted in
// the database AND listed here.
//
// The owner's own complete profile comes from lib/myFreelancer, and a
// professional's contact details, for the people entitled to them, from
// lib/freelancerContact.
export const FREELANCER_PUBLIC_COLS = [
  'id', 'user_id', 'created_at', 'name', 'company_name', 'trade', 'category', 'extra_categories', 'ventures',
  'location', 'bio', 'skills', 'qualifications', 'years_experience', 'hourly_rate', 'min_price', 'avatar_url',
  'available', 'rating', 'client_rating', 'review_count', 'verified', 'featured', 'phone_verified',
  'hidden', 'deactivated_at', 'govt_vendor_status',
  'handle', 'handle_changed_at', 'previous_handle', 'previous_handle_until',
  'auto_invoice_default', 'rising_since',
].join(', ')

// Not public. Listed so a check can make sure no page asks for them directly.
export const FREELANCER_PRIVATE_COLS = ['email', 'phone', 'payment_details', 'default_terms', 'flagged', 'flag_reason']
