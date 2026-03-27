import { supabase } from '@/lib/supabase'

export default async function sitemap() {
  const baseUrl = 'https://vetted-bb.vercel.app'

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
    { url: `${baseUrl}/signup`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.6 },
  ]

  const { data: freelancers } = await supabase
    .from('freelancers')
    .select('id, updated_at')
    .order('created_at', { ascending: false })

  const freelancerPages = (freelancers || []).map(f => ({
    url: `${baseUrl}/freelancers/${f.id}`,
    lastModified: f.updated_at ? new Date(f.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticPages, ...freelancerPages]
}
