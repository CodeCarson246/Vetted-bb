/**
 * The category catalogue — single source of truth shared by the
 * homepage grid, the /categories SEO pages, and the sitemap.
 * `name` must match the freelancers.category column values exactly.
 */
export const CATEGORIES = [
  { icon: '🔧', name: 'Trades & Construction', slug: 'trades-construction', searchQuery: 'electrician plumber carpenter mason painter roofer welder tiler construction builder', description: 'Electricians, plumbers, carpenters, masons, painters and more — vetted construction and trade professionals across Barbados.' },
  { icon: '❄️', name: 'AC & Solar', slug: 'ac-solar', searchQuery: 'ac air conditioning solar installer technician cooling heating', description: 'Air conditioning technicians and solar installers keeping Barbados cool and powered.' },
  { icon: '🌿', name: 'Landscaping & Outdoors', slug: 'landscaping-outdoors', searchQuery: 'landscaper gardener pool cleaner pest control tree garden lawn irrigation', description: 'Landscapers, gardeners, pool cleaners and pest control professionals for your outdoor spaces.' },
  { icon: '🚗', name: 'Automotive', slug: 'automotive', searchQuery: 'mechanic auto car body repair detailer tow boat motorcycle vehicle engine', description: 'Mechanics, auto-body specialists, detailers and vehicle repair professionals in Barbados.' },
  { icon: '🧹', name: 'Cleaning & Domestic', slug: 'cleaning-domestic', searchQuery: 'cleaner cleaning housekeeper laundry maid domestic janitor ironing', description: 'House cleaners, housekeepers and domestic help — trusted and reviewed by real clients.' },
  { icon: '💇', name: 'Beauty & Wellness', slug: 'beauty-wellness', searchQuery: 'hairdresser barber nail makeup artist massage therapist personal trainer nutritionist beauty salon', description: 'Hairdressers, barbers, nail techs, makeup artists and massage therapists across the island.' },
  { icon: '🍽️', name: 'Food & Catering', slug: 'food-catering', searchQuery: 'chef caterer baker bartender food vendor cake catering meal prep cook', description: 'Chefs, caterers, bakers and bartenders for events, meal prep and celebrations.' },
  { icon: '⚽', name: 'Sports & Fitness', slug: 'sports-fitness', searchQuery: 'football cricket swimming tennis gym trainer dance yoga coach instructor fitness', description: 'Personal trainers, coaches and instructors for football, cricket, swimming, yoga and more.' },
  { icon: '🎨', name: 'Creative & Design', slug: 'creative-design', searchQuery: 'graphic designer photographer videographer web designer social media content creator illustrator', description: 'Graphic designers, photographers, videographers and content creators in Barbados.' },
  { icon: '💻', name: 'Technology', slug: 'technology', searchQuery: 'web developer app developer IT support computer repair network CCTV installer tech', description: 'Web developers, IT support, computer repair and CCTV installation professionals.' },
  { icon: '🎉', name: 'Events & Entertainment', slug: 'events-entertainment', searchQuery: 'DJ event planner MC host decorator sound technician lighting band musician entertainment', description: 'DJs, event planners, decorators and entertainers for weddings, parties and corporate events.' },
  { icon: '📚', name: 'Education & Tutoring', slug: 'education-tutoring', searchQuery: 'tutor teacher maths english music driving language special needs education instructor', description: 'Tutors and instructors for maths, English, music, driving and more.' },
  { icon: '💼', name: 'Business & Professional', slug: 'business-professional', searchQuery: 'accountant bookkeeper lawyer notary HR consultant marketing translator business professional', description: 'Accountants, bookkeepers, consultants and professional services for Barbados businesses.' },
  { icon: '❤️', name: 'Health & Care', slug: 'health-care', searchQuery: 'nurse caregiver babysitter nanny elder care first aid health carer', description: 'Nurses, caregivers, babysitters and elder-care professionals you can trust.' },
  { icon: '✨', name: 'Other', slug: 'other', searchQuery: 'other', description: 'Skilled professionals across Barbados offering specialised services.' },
]

export function categoryBySlug(slug) {
  return CATEGORIES.find(c => c.slug === slug) || null
}
