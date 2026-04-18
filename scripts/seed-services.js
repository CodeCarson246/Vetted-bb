/**
 * scripts/seed-services.js
 *
 * One-time seed: inserts realistic services for existing dummy freelancers.
 * Run with:  npm run seed:services
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Uses the service-role key so RLS does not block inserts.
 * Skips any freelancer that already has services.
 */

const path = require('path')
const fs = require('fs')

// Load .env.local manually — works on all platforms
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.substring(0, eqIndex).trim()
    const value = trimmed.substring(eqIndex + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.error('Add it: SUPABASE_SERVICE_ROLE_KEY=your_key_here')
  process.exit(1)
}
console.log('✓ Loaded SUPABASE_SERVICE_ROLE_KEY from .env.local')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(SUPABASE_URL, serviceKey, {
  auth: { persistSession: false },
})

// ─── Service catalogue ──────────────────────────────────────────────────────
// Each entry: { name, price, price_type, description, duration_minutes }

const CATALOGUE = {

  graphicDesigner: [
    { name: 'Logo Design',                     price: 250,  price_type: 'fixed',         duration_minutes: null, description: 'Custom logo designed to reflect your brand identity, delivered in all standard formats.' },
    { name: 'Brand Identity Package',          price: 600,  price_type: 'fixed',         duration_minutes: null, description: 'Full brand package including logo, colour palette, typography, and brand usage guidelines.' },
    { name: 'Social Media Graphics (10 posts)',price: 150,  price_type: 'fixed',         duration_minutes: null, description: 'A set of 10 on-brand social media graphics sized for Instagram, Facebook, or LinkedIn.' },
    { name: 'Business Card Design',            price: 80,   price_type: 'fixed',         duration_minutes: null, description: 'Professional double-sided business card design ready for print.' },
    { name: 'Flyer or Poster Design',          price: 100,  price_type: 'fixed',         duration_minutes: null, description: 'Eye-catching flyer or poster design for events, promotions, or advertisements.' },
  ],

  electrician: [
    { name: 'Electrical Fault Diagnosis',      price: 120,  price_type: 'fixed',         duration_minutes: null, description: 'Full diagnostic inspection to identify and report electrical faults in your home or business.' },
    { name: 'New Outlet Installation',         price: 150,  price_type: 'fixed',         duration_minutes: null, description: 'Safe installation of a new electrical outlet, including wiring and testing.' },
    { name: 'Full House Rewire',               price: 2500, price_type: 'starting_from', duration_minutes: null, description: 'Complete rewiring of a residential property to current safety standards.' },
    { name: 'Solar Panel Installation',        price: 3000, price_type: 'starting_from', duration_minutes: null, description: 'Supply and installation of solar panels with inverter setup and grid tie-in.' },
    { name: 'Circuit Breaker Replacement',     price: 200,  price_type: 'fixed',         duration_minutes: null, description: 'Safe removal and replacement of a faulty circuit breaker with a compatible unit.' },
  ],

  landscaper: [
    { name: 'Garden Design Consultation',      price: 150,  price_type: 'fixed',         duration_minutes: 60,   description: 'One-hour consultation to assess your outdoor space and provide a personalised design plan.' },
    { name: 'Weekly Lawn Maintenance',         price: 80,   price_type: 'fixed',         duration_minutes: null, description: 'Regular weekly visit covering mowing, edging, and general lawn upkeep.' },
    { name: 'Tree Trimming & Removal',         price: 200,  price_type: 'starting_from', duration_minutes: null, description: 'Safe trimming or full removal of trees and large shrubs, including debris clearance.' },
    { name: 'Garden Cleanup',                  price: 120,  price_type: 'fixed',         duration_minutes: null, description: 'One-off deep clean of your garden including weeding, pruning, and rubbish removal.' },
    { name: 'Irrigation System Install',       price: 800,  price_type: 'starting_from', duration_minutes: null, description: 'Design and installation of an automatic irrigation system tailored to your garden layout.' },
  ],

  photographer: [
    { name: 'Portrait Session (1 hour)',       price: 200,  price_type: 'fixed',         duration_minutes: 60,  description: 'One-hour professional portrait session with edited digital images delivered within 5 days.' },
    { name: 'Wedding Photography (full day)',  price: 1500, price_type: 'fixed',         duration_minutes: 480, description: 'Full-day wedding coverage from preparation to reception, with a gallery of edited images.' },
    { name: 'Event Photography (4 hours)',     price: 600,  price_type: 'fixed',         duration_minutes: 240, description: 'Four-hour event coverage for corporate events, parties, or launches, with edited photos.' },
    { name: 'Commercial Product Photography', price: 350,  price_type: 'fixed',         duration_minutes: null, description: 'Professional product photography for e-commerce, menus, or marketing materials.' },
    { name: 'Headshots (30 min)',              price: 120,  price_type: 'fixed',         duration_minutes: 30,  description: 'Quick 30-minute headshot session ideal for LinkedIn, company profiles, or press use.' },
  ],

  plumber: [
    { name: 'Leak Detection & Repair',         price: 150,  price_type: 'starting_from', duration_minutes: null, description: 'Locate and repair water leaks in pipes, fittings, or fixtures to prevent further damage.' },
    { name: 'Pipe Installation',               price: 300,  price_type: 'starting_from', duration_minutes: null, description: 'Supply and installation of new pipework for water supply or drainage systems.' },
    { name: 'Drain Cleaning',                  price: 100,  price_type: 'fixed',         duration_minutes: null, description: 'High-pressure drain cleaning to clear blockages and restore proper flow.' },
    { name: 'Water Heater Installation',       price: 400,  price_type: 'fixed',         duration_minutes: null, description: 'Supply and fitting of a new electric or gas water heater, including pressure testing.' },
    { name: 'Bathroom Fixture Fitting',        price: 250,  price_type: 'fixed',         duration_minutes: null, description: 'Installation of bathroom fixtures including toilets, basins, showers, and baths.' },
  ],

  webDeveloper: [
    { name: 'Business Website (5 pages)',      price: 800,  price_type: 'fixed',         duration_minutes: null, description: 'Custom-designed five-page business website optimised for mobile and search engines.' },
    { name: 'E-Commerce Website',              price: 1500, price_type: 'starting_from', duration_minutes: null, description: 'Full e-commerce site with product pages, cart, and payment integration.' },
    { name: 'Website Maintenance (monthly)',   price: 150,  price_type: 'fixed',         duration_minutes: null, description: 'Monthly plan covering updates, backups, security checks, and minor content changes.' },
    { name: 'Landing Page Design',             price: 400,  price_type: 'fixed',         duration_minutes: null, description: 'High-converting single-page design for a product launch, campaign, or lead generation.' },
    { name: 'Website Speed Optimisation',      price: 200,  price_type: 'fixed',         duration_minutes: null, description: 'Audit and improvements to reduce load time and improve Core Web Vitals scores.' },
  ],

  personalTrainer: [
    { name: '1-on-1 Training Session (1hr)',          price: 60,  price_type: 'fixed',  duration_minutes: 60,   description: 'Personalised one-hour session tailored to your fitness goals and current level.' },
    { name: 'Monthly Training Package (8 sessions)',  price: 400, price_type: 'fixed',  duration_minutes: null, description: 'Eight one-hour personal training sessions per month at a discounted package rate.' },
    { name: 'Fitness Assessment & Plan',              price: 80,  price_type: 'fixed',  duration_minutes: 60,   description: 'Full fitness assessment followed by a written 8-week training and nutrition plan.' },
    { name: 'Couples Training Session',               price: 90,  price_type: 'fixed',  duration_minutes: 60,   description: 'One-hour training session for two people, with exercises suited to both fitness levels.' },
    { name: 'Online Training Programme',              price: 120, price_type: 'fixed',  duration_minutes: null, description: 'Fully remote 4-week training programme with weekly check-ins and a custom workout plan.' },
  ],

  coach: [
    { name: '1-to-1 Coaching Session (1hr)',          price: 100, price_type: 'fixed',  duration_minutes: 60,   description: 'One-hour individual coaching session focusing on technique, fitness, and game awareness.' },
    { name: 'Group Session (up to 8 players)',        price: 200, price_type: 'fixed',  duration_minutes: 60,   description: 'Structured group training session covering drills, tactics, and teamwork for up to 8 players.' },
    { name: 'Monthly Coaching Package',               price: 350, price_type: 'fixed',  duration_minutes: null, description: 'Monthly package of four individual and two group sessions with ongoing progress tracking.' },
    { name: 'Video Analysis Session',                 price: 80,  price_type: 'fixed',  duration_minutes: 60,   description: 'Recorded session review with detailed feedback on technique and tactical positioning.' },
    { name: 'Meal & Performance Planning',            price: 120, price_type: 'fixed',  duration_minutes: 60,   description: 'One-hour consultation to build a nutrition and recovery plan aligned with your training goals.' },
  ],

  general: [
    { name: 'Consultation (1hr)',   price: 75,  price_type: 'fixed',         duration_minutes: 60,  description: 'One-hour consultation to discuss your requirements and provide professional advice.' },
    { name: 'Half Day Service',     price: 200, price_type: 'starting_from', duration_minutes: 240, description: 'Up to four hours of professional service at your home, business, or chosen location.' },
    { name: 'Full Day Service',     price: 350, price_type: 'starting_from', duration_minutes: 480, description: 'Full day of professional service including all standard equipment and materials.' },
  ],
}

// ─── Trade → catalogue mapping ───────────────────────────────────────────────

function getServicesForTrade(trade) {
  const t = (trade || '').toLowerCase().trim()

  // Specific trades checked first so "Graphic Designer" never falls into
  // the generic "contains designer" bucket for web developers.
  if (t.includes('graphic design'))                                  return CATALOGUE.graphicDesigner
  if (t === 'electrician' || t.includes('electric'))                 return CATALOGUE.electrician
  if (t === 'landscaper'  || t.includes('landscap') || t.includes('gardener')) return CATALOGUE.landscaper
  if (t === 'photographer'|| t.includes('photograph'))               return CATALOGUE.photographer
  if (t === 'plumber'     || t.includes('plumb'))                    return CATALOGUE.plumber
  if (t.includes('developer') || t.includes('web design') || t.includes('technology') || t.includes('software')) return CATALOGUE.webDeveloper
  if (t.includes('trainer')   || t.includes('fitness'))             return CATALOGUE.personalTrainer
  if (t.includes('coach'))                                           return CATALOGUE.coach

  return CATALOGUE.general
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching freelancers…')

  const { data: freelancers, error: fetchError } = await supabase
    .from('freelancers')
    .select('id, name, trade')

  if (fetchError) {
    console.error('Failed to fetch freelancers:', fetchError.message)
    process.exit(1)
  }

  console.log(`Found ${freelancers.length} freelancer(s)`)

  let totalInserted  = 0
  let totalSkipped   = 0
  let seededCount    = 0

  for (const freelancer of freelancers) {
    // Check whether this freelancer already has services
    const { count, error: countError } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('freelancer_id', freelancer.id)

    if (countError) {
      console.warn(`  [SKIP] ${freelancer.name} — count check failed: ${countError.message}`)
      totalSkipped++
      continue
    }

    if (count > 0) {
      console.log(`  [SKIP] ${freelancer.name} (${freelancer.trade}) — already has ${count} service(s)`)
      totalSkipped++
      continue
    }

    // Build the rows to insert
    const serviceTemplate = getServicesForTrade(freelancer.trade)
    const rows = serviceTemplate.map(svc => ({
      freelancer_id:    freelancer.id,
      name:             svc.name,
      price:            svc.price,
      price_type:       svc.price_type,
      description:      svc.description,
      duration_minutes: svc.duration_minutes,
    }))

    const { error: insertError } = await supabase
      .from('services')
      .insert(rows)

    if (insertError) {
      console.error(`  [ERROR] ${freelancer.name} — insert failed: ${insertError.message}`)
      continue
    }

    console.log(`  [OK]   ${freelancer.name} (${freelancer.trade}) — inserted ${rows.length} service(s)`)
    totalInserted += rows.length
    seededCount++
  }

  console.log('')
  console.log(`─────────────────────────────────────`)
  console.log(`Seeded ${totalInserted} services across ${seededCount} freelancer(s)`)
  if (totalSkipped > 0) {
    console.log(`Skipped ${totalSkipped} freelancer(s) (already had services or check failed)`)
  }
  console.log(`─────────────────────────────────────`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
