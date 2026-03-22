'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPriceIndicator } from '@/lib/priceIndicator'

function displayName(author) {
  if (!author) return ''
  return author.includes('@') ? author.split('@')[0] : author
}

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={star <= Math.round(rating) ? "text-yellow-400 text-sm" : "text-gray-200 text-sm"}>★</span>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEditForm, setShowEditForm] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [clientMessages, setClientMessages] = useState([])
  const [clientReviewsLeft, setClientReviewsLeft] = useState([])
  const [topFreelancers, setTopFreelancers] = useState([])

  // Services state
  const [services, setServices] = useState([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [servicePriceOption, setServicePriceOption] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [serviceDuration, setServiceDuration] = useState('')
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceError, setServiceError] = useState(null)

  // Account settings state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit form state
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [available, setAvailable] = useState(false)
  const [skillsInput, setSkillsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Client review form state
  const [clientName, setClientName] = useState('')
  const [clientRating, setClientRating] = useState(0)
  const [clientRatingHover, setClientRatingHover] = useState(0)
  const [clientComment, setClientComment] = useState('')
  const [clientReviewSubmitting, setClientReviewSubmitting] = useState(false)
  const [clientReviewError, setClientReviewError] = useState(null)
  const [clientReviewSuccess, setClientReviewSuccess] = useState(false)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [createErrors, setCreateErrors] = useState({})
  const [createName, setCreateName] = useState('')
  const [createCompanyName, setCreateCompanyName] = useState('')
  const [createTrade, setCreateTrade] = useState('')
  const [createLocation, setCreateLocation] = useState('')
  const [createBio, setCreateBio] = useState('')
  const [createRate, setCreateRate] = useState('')
  const [createSkills, setCreateSkills] = useState('')
  const [createAvailable, setCreateAvailable] = useState(true)
  const [createServices, setCreateServices] = useState([])
  const [showCreateSvcForm, setShowCreateSvcForm] = useState(false)
  const [createSvcName, setCreateSvcName] = useState('')
  const [createSvcPrice, setCreateSvcPrice] = useState('')
  const [createSvcPriceOption, setCreateSvcPriceOption] = useState('')
  const [createSvcDescription, setCreateSvcDescription] = useState('')
  const [createSvcDuration, setCreateSvcDuration] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const PRICE_TIERS = [
    { symbol: '$',    label: 'Budget friendly', value: 20 },
    { symbol: '$$',   label: 'Mid-range',        value: 50 },
    { symbol: '$$$',  label: 'Premium',           value: 80 },
    { symbol: '$$$$', label: 'High end',          value: 150 },
  ]

  function rateToTierValue(rate) {
    const r = parseFloat(rate)
    if (!r) return null
    if (r < 30)  return 20
    if (r < 60)  return 50
    if (r < 100) return 80
    return 150
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      setCreateName(user.user_metadata?.full_name || '')
      setNewEmail(user.email || '')
      const userRole = user.user_metadata?.role || 'freelancer'
      setRole(userRole)

      if (userRole === 'client') {
        const [{ data: msgs }, { data: rLeft }, { data: topF }] = await Promise.all([
          supabase.from('messages').select('*, freelancers(name)').eq('sender_email', user.email).order('created_at', { ascending: false }),
          supabase.from('reviews').select('*').eq('author_email', user.email).order('date', { ascending: false }),
          supabase.from('freelancers').select('id, name, trade, avatar_url, rating, hourly_rate').order('rating', { ascending: false }).limit(3),
        ])
        setClientMessages(msgs || [])
        setClientReviewsLeft(rLeft || [])
        setTopFreelancers(topF || [])
      } else {
        const { data: p } = await supabase
          .from('freelancers')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (p) {
          setProfile(p)
          setBio(p.bio || '')
          setHourlyRate(p.hourly_rate || '')
          setAvailable(p.available || false)
          setSkillsInput((p.skills || []).join(', '))
          setAvatarUrl(p.avatar_url || '')

          const { data: r } = await supabase
            .from('reviews')
            .select('*')
            .eq('freelancer_id', p.id)
            .order('date', { ascending: false })
          setReviews(r || [])

          const [{ count }, { data: svc }] = await Promise.all([
            supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', p.id).eq('read', false),
            supabase.from('services').select('*').eq('freelancer_id', p.id).order('created_at', { ascending: true }),
          ])
          setUnreadCount(count || 0)
          setServices(svc || [])
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean)

    const { error } = await supabase
      .from('freelancers')
      .update({ bio, hourly_rate: hourlyRate, available, skills })
      .eq('user_id', user.id)

    if (error) {
      setSaveError(error.message)
    } else {
      setProfile(prev => ({ ...prev, bio, hourly_rate: hourlyRate, available, skills }))
      setSaveSuccess(true)
      setTimeout(() => { setSaveSuccess(false); setShowEditForm(false) }, 1500)
    }
    setSaving(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const skills = createSkills.split(',').map(s => s.trim()).filter(Boolean)

    const { data, error } = await supabase
      .from('freelancers')
      .insert({
        name: createName,
        company_name: createCompanyName || null,
        trade: createTrade,
        location: createLocation,
        bio: createBio,
        hourly_rate: createRate,
        available: createAvailable,
        skills,
        user_id: user.id,
        email: user.email,
        rating: 0,
        review_count: 0,
        client_rating: 0,
      })
      .select()
      .single()

    if (error) {
      setCreateError(error.message)
      setCreating(false)
      return
    }

    const newProfileId = data.id
    console.log('Freelancer profile created:', newProfileId)

    if (createServices.length > 0) {
      console.log('Inserting services:', createServices)
      const results = await Promise.all(
        createServices.map(svc =>
          supabase.from('services').insert({
            freelancer_id: newProfileId,
            name: svc.name,
            price: svc.price,
            description: svc.description || null,
            duration: svc.duration || null,
          }).select().single()
        )
      )
      console.log('Service insert results:', results)
      const insertErrors = results.filter(r => r.error)
      if (insertErrors.length > 0) {
        console.error('Service insert errors:', insertErrors)
        setCreateError('Profile created but some services failed to save. You can add them from your dashboard.')
      }
    } else {
      console.log('No services to insert')
    }

    router.push(`/freelancers/${newProfileId}`)
  }

  function addCreateService() {
    if (!createSvcName.trim() || !createSvcPrice.trim()) return
    setCreateServices(prev => [...prev, {
      name: createSvcName.trim(),
      price: createSvcPrice.trim(),
      description: createSvcDescription.trim(),
      duration: createSvcDuration.trim(),
    }])
    setCreateSvcName('')
    setCreateSvcPrice('')
    setCreateSvcPriceOption('')
    setCreateSvcDescription('')
    setCreateSvcDuration('')
    setShowCreateSvcForm(false)
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setSaveError(uploadError.message)
      setAvatarUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    await supabase.from('freelancers').update({ avatar_url: publicUrl }).eq('user_id', user.id)
    setAvatarUrl(publicUrl)
    setProfile(prev => ({ ...prev, avatar_url: publicUrl }))
    setAvatarUploading(false)
  }

  async function submitClientReview(e) {
    e.preventDefault()
    setClientReviewSubmitting(true)
    setClientReviewError(null)

    const { error } = await supabase.from('reviews').insert({
      freelancer_id: profile.id,
      author: clientName,
      rating: clientRating,
      comment: clientComment,
      type: 'freelancer',
      date: new Date().toISOString().split('T')[0],
    })

    if (error) {
      setClientReviewError(error.message)
    } else {
      const { data: r } = await supabase
        .from('reviews')
        .select('*')
        .eq('freelancer_id', profile.id)
        .order('date', { ascending: false })
      setReviews(r || [])
      setClientName('')
      setClientRating(0)
      setClientComment('')
      setClientReviewSuccess(true)
      setTimeout(() => setClientReviewSuccess(false), 3000)
    }
    setClientReviewSubmitting(false)
  }

  const STANDARD_PRICES = ['$25', '$50', '$75', '$100', '$150', '$200', '$250', '$300', '$500', 'Price on request']

  function openServiceForm(svc = null) {
    setEditingService(svc)
    setServiceName(svc?.name || '')
    setServiceDescription(svc?.description || '')
    setServiceDuration(svc?.duration || '')
    setServiceError(null)
    if (svc?.price) {
      if (STANDARD_PRICES.includes(svc.price)) {
        setServicePriceOption(svc.price)
        setServicePrice(svc.price)
      } else {
        setServicePriceOption('Custom amount')
        setServicePrice(svc.price)
      }
    } else {
      setServicePriceOption('')
      setServicePrice('')
    }
    setShowServiceForm(true)
  }

  function closeServiceForm() {
    setShowServiceForm(false)
    setEditingService(null)
    setServiceName('')
    setServicePrice('')
    setServicePriceOption('')
    setServiceDescription('')
    setServiceDuration('')
    setServiceError(null)
  }

  async function handleServiceSubmit(e) {
    e.preventDefault()
    setServiceSaving(true)
    setServiceError(null)

    const payload = {
      name: serviceName,
      price: servicePrice,
      description: serviceDescription,
      duration: serviceDuration || null,
    }

    let error
    if (editingService) {
      ;({ error } = await supabase.from('services').update(payload).eq('id', editingService.id))
      if (!error) {
        setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, ...payload } : s))
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('services')
        .insert({ ...payload, freelancer_id: profile.id })
        .select()
        .single()
      error = insertError
      if (!error) setServices(prev => [...prev, data])
    }

    if (error) {
      setServiceError(error.message)
    } else {
      closeServiceForm()
    }
    setServiceSaving(false)
  }

  async function handleServiceDelete(id) {
    await supabase.from('services').delete().eq('id', id)
    setServices(prev => prev.filter(s => s.id !== id))
  }

  async function handleEmailUpdate(e) {
    e.preventDefault()
    setEmailSaving(true)
    setEmailError(null)
    setEmailSuccess(false)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setEmailError(error.message)
    } else {
      setEmailSuccess(true)
    }
    setEmailSaving(false)
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setPasswordSaving(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 4000)
    }
    setPasswordSaving(false)
  }

  async function handleDeleteProfile() {
    setDeleting(true)
    await supabase.from('services').delete().eq('freelancer_id', profile.id)
    await supabase.from('reviews').delete().eq('freelancer_id', profile.id)
    await supabase.from('freelancers').delete().eq('user_id', user.id)
    window.location.reload()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100">
          <div className="flex items-center justify-between px-8 py-5">
            <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
          </div>
        </nav>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
          <div className="rounded-2xl overflow-hidden shadow-sm animate-pulse">
            <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row gap-6 items-center sm:items-start" style={{ backgroundColor: '#00267F' }}>
              <div className="w-24 h-24 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)', boxShadow: '0 0 0 4px rgba(255,255,255,0.15)' }} />
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="h-7 rounded w-48 mb-2 mx-auto sm:mx-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div className="h-5 rounded w-32 mb-3 mx-auto sm:mx-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div className="h-4 rounded w-40 mx-auto sm:mx-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div className="flex sm:flex-col gap-2 flex-shrink-0">
                <div className="h-9 rounded-full w-36" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div className="h-9 rounded-full w-28" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const clientReviews = reviews.filter(r => r.type === 'client')
  const freelancerReviews = reviews.filter(r => r.type === 'freelancer')

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
          <div className="hidden sm:flex gap-4 items-center">
            {role === 'client' ? (
              <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">
                {user?.user_metadata?.full_name?.trim() || user?.email}
              </a>
            ) : profile ? (
              <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-gray-600 text-sm font-medium">{profile.name}</span>
              </a>
            ) : (
              <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                  {(user?.user_metadata?.full_name?.trim() || user?.email || '')
                    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <span className="text-gray-600 text-sm font-medium">{user?.user_metadata?.full_name?.trim() || user?.email}</span>
              </a>
            )}
            {role !== 'client' && profile && (
              <a href="/inbox" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </a>
            )}
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              Log out
            </button>
          </div>
          <button className="sm:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 px-8 py-4 flex flex-col gap-4">
            {role === 'client' ? (
              <a href="/dashboard" className="text-gray-600 text-sm font-medium">
                {user?.user_metadata?.full_name?.trim() || user?.email}
              </a>
            ) : profile ? (
              <a href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-gray-600 text-sm font-medium">{profile.name}</span>
              </a>
            ) : (
              <a href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                  {(user?.user_metadata?.full_name?.trim() || user?.email || '')
                    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </div>
                <span className="text-gray-600 text-sm font-medium">{user?.user_metadata?.full_name?.trim() || user?.email}</span>
              </a>
            )}
            {role !== 'client' && profile && (
              <a href="/inbox" className="flex items-center gap-2 text-gray-700 font-medium">
                Inbox
                {unreadCount > 0 && (
                  <span className="min-w-[18px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </a>
            )}
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="text-left text-red-500 font-medium"
            >
              Log out
            </button>
          </div>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">

        {role === 'client' ? (
          <div className="flex flex-col gap-6">

            {/* Welcome card - navy hero */}
            <div className="rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5" style={{ backgroundColor: '#00267F' }}>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#93b8ff' }}>Welcome back</p>
                  <h1 className="text-2xl font-bold text-white leading-tight">
                    {user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'there'}
                  </h1>
                  <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>{user?.email}</p>
                </div>
                <a
                  href="/search"
                  className="flex-shrink-0 px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity text-center"
                  style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                >
                  Find a freelancer
                </a>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center" style={{ borderTop: '3px solid #00267F' }}>
                <svg className="w-5 h-5 mx-auto mb-2 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <p className="text-3xl font-bold text-gray-900">{clientReviewsLeft.length}</p>
                <p className="text-sm text-gray-500 mt-1">Reviews left</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center" style={{ borderTop: '3px solid #00267F' }}>
                <svg className="w-5 h-5 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#00267F' }}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <p className="text-3xl font-bold text-gray-900">{clientMessages.length}</p>
                <p className="text-sm text-gray-500 mt-1">Freelancers contacted</p>
              </div>
            </div>

            {/* Top rated freelancers */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Top rated freelancers</h2>
                <a href="/search" className="text-sm font-medium hover:opacity-80" style={{ color: '#00267F' }}>See all →</a>
              </div>
              <div className="divide-y divide-gray-50">
                {topFreelancers.map(f => (
                  <div key={f.id} className="px-6 sm:px-8 py-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {f.avatar_url
                        ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                        : f.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{f.name}</p>
                      <p className="text-xs text-gray-500">{f.trade}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <StarRating rating={f.rating} />
                        <span className="text-xs text-gray-500">{f.rating}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {getPriceIndicator(f.hourly_rate) && (
                        <span className="text-sm font-bold" style={{ color: '#00267F' }}>{getPriceIndicator(f.hourly_rate)}</span>
                      )}
                      <a
                        href={`/freelancers/${f.id}`}
                        className="text-white px-4 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        View profile
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews left */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Reviews I've left <span className="text-gray-400 font-normal text-sm">({clientReviewsLeft.length})</span></h2>
              </div>
              <div className="p-6 sm:p-8">
                {clientReviewsLeft.length === 0 ? (
                  <p className="text-sm text-gray-400">No reviews left yet. Visit a freelancer's profile to leave one.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {clientReviewsLeft.map((review, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900 text-sm">{review.freelancer_name || 'Freelancer'}</p>
                          <StarRating rating={review.rating} />
                        </div>
                        <p className="text-gray-600 text-sm">{review.comment}</p>
                        <p className="text-xs text-gray-400 mt-2">{review.date}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Messages sent */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Messages sent <span className="text-gray-400 font-normal text-sm">({clientMessages.length})</span></h2>
              </div>
              <div className="p-6 sm:p-8">
                {clientMessages.length === 0 ? (
                  <p className="text-sm text-gray-400">No messages sent yet. <a href="/search" style={{ color: '#00267F' }} className="font-medium hover:opacity-80">Browse freelancers →</a></p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {clientMessages.map((msg, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">{msg.freelancers?.name || 'Freelancer'}</p>
                            <p className="text-sm text-gray-600 mt-0.5">{msg.subject}</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : profile ? (
          <>
            {/* Profile card - navy hero */}
            <div className="rounded-2xl mb-6 overflow-hidden shadow-sm">
              <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row gap-6 items-center sm:items-start" style={{ backgroundColor: '#00267F' }}>
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 overflow-hidden" style={{ boxShadow: '0 0 0 4px rgba(255,255,255,0.2)' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <h1 className="text-2xl font-bold text-white leading-tight">{profile.name}</h1>
                  <p className="font-semibold mt-0.5 capitalize" style={{ color: '#F9C000' }}>{profile.trade}</p>
                  {profile.location && <p className="text-sm mt-1 capitalize" style={{ color: '#93b8ff' }}>📍 {profile.location}</p>}
                  <div className="flex items-center gap-2 mt-2.5 justify-center sm:justify-start flex-wrap">
                    <div className="flex items-center gap-1">
                      <StarRating rating={profile.rating} />
                      <span className="text-sm font-medium text-white ml-0.5">{profile.rating}</span>
                      <span className="text-xs" style={{ color: '#93b8ff' }}>({profile.review_count} reviews)</span>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${profile.available ? 'text-green-300' : 'text-white/50'}`} style={{ backgroundColor: profile.available ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.1)' }}>
                      ● {profile.available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
                {/* Buttons */}
                <div className="flex sm:flex-col gap-2 flex-shrink-0">
                  <a
                    href={`/freelancers/${profile.id}`}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors text-center"
                    style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    View public profile
                  </a>
                  <button
                    onClick={() => setShowEditForm(v => !v)}
                    className="px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                  >
                    {showEditForm ? 'Cancel' : 'Edit profile'}
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {showEditForm && (
                <form onSubmit={handleSave} className="bg-white px-6 sm:px-10 pt-6 pb-8 flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile photo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                        {avatarUrl
                          ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                          : profile.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <label className={`cursor-pointer px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors ${avatarUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {avatarUploading ? 'Uploading...' : 'Change photo'}
                        <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={avatarUploading} onChange={handleAvatarUpload} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      rows={4}
                      placeholder="Tell clients about your experience and what you do..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Price tier</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PRICE_TIERS.map(tier => (
                        <button
                          key={tier.symbol}
                          type="button"
                          onClick={() => setHourlyRate(String(tier.value))}
                          className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all ${rateToTierValue(hourlyRate) === tier.value ? 'bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          style={rateToTierValue(hourlyRate) === tier.value ? { borderColor: '#00267F', backgroundColor: '#EEF2FF' } : {}}
                        >
                          <span className="text-lg font-bold" style={{ color: '#00267F' }}>{tier.symbol}</span>
                          <span className="text-xs text-gray-500 mt-0.5">{tier.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">This helps clients find you in search. Your actual service prices are always shown on your profile.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skills <span className="text-gray-400 font-normal">(comma separated)</span></label>
                    <input
                      type="text"
                      value={skillsInput}
                      onChange={e => setSkillsInput(e.target.value)}
                      placeholder="e.g. Plumbing, Pipe fitting, Drain repair"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setAvailable(true)} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${available ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>Available</button>
                      <button type="button" onClick={() => setAvailable(false)} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${!available ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>Unavailable</button>
                    </div>
                  </div>

                  {saveError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{saveError}</p>}
                  {saveSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Profile updated successfully.</p>}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </form>
              )}
            </div>

            {/* My services */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 sm:px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">My services</h2>
                {!showServiceForm && (
                  <button
                    onClick={() => openServiceForm()}
                    className="text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    + Add service
                  </button>
                )}
              </div>

              {showServiceForm && (
                <div className="px-6 sm:px-8 py-6 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-4">{editingService ? 'Edit service' : 'New service'}</h3>
                  <form onSubmit={handleServiceSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service name</label>
                      <input
                        type="text"
                        required
                        value={serviceName}
                        onChange={e => setServiceName(e.target.value)}
                        placeholder="e.g. Full house rewire"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                      <select
                        required
                        value={servicePriceOption}
                        onChange={e => {
                          const v = e.target.value
                          setServicePriceOption(v)
                          if (v !== 'Custom amount') setServicePrice(v)
                          else setServicePrice('')
                        }}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        <option value="">Select price</option>
                        <option>$25</option>
                        <option>$50</option>
                        <option>$75</option>
                        <option>$100</option>
                        <option>$150</option>
                        <option>$200</option>
                        <option>$250</option>
                        <option>$300</option>
                        <option>$500</option>
                        <option>Price on request</option>
                        <option>Custom amount</option>
                      </select>
                      {servicePriceOption === 'Custom amount' && (
                        <input
                          type="text"
                          required
                          value={servicePrice}
                          onChange={e => setServicePrice(e.target.value)}
                          placeholder='e.g. From $80, $45 per sq ft, $120 + materials'
                          className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={serviceDescription}
                        onChange={e => setServiceDescription(e.target.value)}
                        rows={3}
                        placeholder="Describe what's included in this service..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration <span className="text-gray-400 font-normal">(optional)</span></label>
                      <select
                        value={serviceDuration}
                        onChange={e => setServiceDuration(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        <option value="">Select duration</option>
                        <option>30 minutes</option>
                        <option>1 hour</option>
                        <option>1.5 hours</option>
                        <option>2 hours</option>
                        <option>3 hours</option>
                        <option>Half day</option>
                        <option>Full day</option>
                        <option>2-3 days</option>
                        <option>1 week</option>
                      </select>
                    </div>
                    {serviceError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{serviceError}</p>}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeServiceForm}
                        className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:border-gray-300 transition-colors bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={serviceSaving}
                        className="flex-1 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        {serviceSaving ? 'Saving...' : editingService ? 'Save changes' : 'Add service'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {services.length === 0 && !showServiceForm ? (
                <div className="px-6 sm:px-8 py-8 text-center">
                  <p className="text-sm text-gray-400">No services yet. Add one to show clients what you offer.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {services.map(svc => (
                    <div key={svc.id} className="px-6 sm:px-8 py-5 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 capitalize">{svc.name}</p>
                        {svc.description && <p className="text-sm text-gray-500 mt-0.5 leading-relaxed capitalize">{svc.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm font-bold" style={{ color: '#00267F' }}>{svc.price}</span>
                          {svc.duration && <span className="text-xs text-gray-400">{svc.duration}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openServiceForm(svc)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleServiceDelete(svc.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-100 text-sm font-medium text-red-500 hover:border-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100 px-2">
                {['overview', 'reviews', 'leave-a-review'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-4 text-sm font-semibold transition-colors relative ${activeTab === tab ? '' : 'text-gray-400 hover:text-gray-600'}`}
                    style={activeTab === tab ? { color: '#00267F' } : {}}
                  >
                    {tab === 'overview' ? 'Overview' : tab === 'reviews' ? 'Reviews' : 'Leave a review'}
                    {activeTab === tab && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: '#00267F' }} />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-6 sm:p-8">

                {/* Overview tab */}
                {activeTab === 'overview' && (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white rounded-xl p-5 text-center border border-gray-100" style={{ borderTop: '3px solid #00267F' }}>
                        <svg className="w-5 h-5 mx-auto mb-2 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <p className="text-3xl font-bold text-gray-900">{profile.rating}</p>
                        <div className="flex justify-center mt-1 mb-1">
                          <StarRating rating={profile.rating} />
                        </div>
                        <p className="text-sm text-gray-500">Average rating</p>
                      </div>
                      <div className="bg-white rounded-xl p-5 text-center border border-gray-100" style={{ borderTop: '3px solid #00267F' }}>
                        <svg className="w-5 h-5 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#00267F' }}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        <p className="text-3xl font-bold text-gray-900">{profile.review_count}</p>
                        <p className="text-sm text-gray-500 mt-2">Total reviews</p>
                      </div>
                      <div className="bg-white rounded-xl p-5 text-center border border-gray-100" style={{ borderTop: '3px solid #00267F' }}>
                        <svg className="w-5 h-5 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#00267F' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <p className="text-3xl font-bold text-gray-900">${profile.hourly_rate}</p>
                        <p className="text-sm text-gray-500 mt-2">Hourly rate</p>
                      </div>
                    </div>

                    <div className="border border-gray-100 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">Review a client</h3>
                        <p className="text-sm text-gray-500 mt-1">Rate a client you've worked with so other freelancers know what to expect.</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('leave-a-review')}
                        className="flex-shrink-0 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        Leave a review
                      </button>
                    </div>
                  </div>
                )}

                {/* Reviews tab */}
                {activeTab === 'reviews' && (
                  <div className="flex flex-col gap-8">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Reviews about me <span className="text-gray-400 font-normal text-sm">({clientReviews.length})</span></h3>
                      {clientReviews.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4">No reviews yet.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {clientReviews.map((review, i) => (
                            <div key={i} className="rounded-xl p-5 border border-gray-100" style={{ borderLeft: '3px solid #00267F' }}>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                                    {displayName(review.author)[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm">{displayName(review.author)}</p>
                                    <p className="text-xs text-gray-400">{review.date}</p>
                                  </div>
                                </div>
                                <StarRating rating={review.rating} />
                              </div>
                              <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Reviews I've left <span className="text-gray-400 font-normal text-sm">({freelancerReviews.length})</span></h3>
                      {freelancerReviews.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4">You haven't reviewed any clients yet.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {freelancerReviews.map((review, i) => (
                            <div key={i} className="rounded-xl p-5 border border-gray-100" style={{ borderLeft: '3px solid #F9C000' }}>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#FEF9E7', color: '#00267F' }}>
                                    {displayName(review.author)[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm">{displayName(review.author)}</p>
                                    <p className="text-xs text-gray-400">{review.date}</p>
                                  </div>
                                </div>
                                <StarRating rating={review.rating} />
                              </div>
                              <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Leave a review tab */}
                {activeTab === 'leave-a-review' && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Review a client</h3>
                    <p className="text-sm text-gray-500 mb-6">Rate a client you've worked with so other freelancers know what to expect.</p>
                    <form onSubmit={submitClientReview} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client name</label>
                        <input
                          type="text"
                          required
                          value={clientName}
                          onChange={e => setClientName(e.target.value)}
                          placeholder="e.g. Sarah Johnson"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setClientRating(star)}
                              onMouseEnter={() => setClientRatingHover(star)}
                              onMouseLeave={() => setClientRatingHover(0)}
                              className="text-3xl leading-none transition-colors"
                            >
                              <span className={(clientRatingHover || clientRating) >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                        <textarea
                          required
                          value={clientComment}
                          onChange={e => setClientComment(e.target.value)}
                          rows={3}
                          placeholder="Describe your experience working with this client..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                        />
                      </div>

                      {clientReviewError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{clientReviewError}</p>}
                      {clientReviewSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Review submitted — thank you!</p>}

                      <button
                        type="submit"
                        disabled={clientReviewSubmitting || clientRating === 0}
                        className="w-full text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        {clientReviewSubmitting ? 'Submitting...' : 'Submit review'}
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>
          </>
        ) : (
          /* No profile — create form */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-md">
            {!showCreateForm ? (
              /* Welcome onboarding state — always shown for freelancers with no profile */
              <div>
                {/* Hero banner */}
                <div className="rounded-2xl px-8 sm:px-12 py-10 text-center" style={{ backgroundColor: '#00267F' }}>
                  <p className="text-4xl mb-4">🎉</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    Welcome to Vetted.bb{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}!
                  </h2>
                  <p className="text-sm sm:text-base" style={{ color: '#93b8ff' }}>
                    Let's set up your profile so clients can find you
                  </p>
                </div>

                {/* Steps + CTA */}
                <div className="px-8 sm:px-12 py-8">
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    {[
                      { step: '1', label: 'Add your details', icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                      )},
                      { step: '2', label: 'List your services', icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                      )},
                      { step: '3', label: 'Start getting hired', icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      )},
                    ].map(({ step, label, icon }) => (
                      <div key={step} className="flex-1 flex items-center gap-4 rounded-xl px-5 py-5 border border-gray-100 shadow-sm" style={{ borderLeft: '3px solid #F9C000' }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: '#00267F' }}>
                          {icon}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Step {step}</p>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center">
                    <button
                      onClick={() => { setCreateStep(1); setCreateErrors({}); setShowCreateForm(true) }}
                      className="px-10 py-3.5 rounded-full font-bold text-base hover:opacity-90 transition-opacity shadow-sm"
                      style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                    >
                      Create my profile →
                    </button>
                    <p className="text-xs text-gray-400 mt-3">⏱ Takes about 2 minutes</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Form hero banner */}
                <div className="rounded-2xl px-8 sm:px-12 py-8 text-center" style={{ backgroundColor: '#00267F' }}>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Create your profile</h2>
                  <p className="text-sm" style={{ color: '#93b8ff' }}>Tell clients what you do and how to find you</p>
                  <div className="h-1 w-16 rounded-full mx-auto mt-4" style={{ backgroundColor: '#F9C000' }} />
                </div>

                {/* Progress indicator */}
                <div className="px-8 sm:px-12 pt-6 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#00267F' }}>1</div>
                      <span className="text-sm font-semibold" style={{ color: createStep === 1 ? '#00267F' : '#6b7280' }}>Your details</span>
                    </div>
                    <div className="flex-1 h-px bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: createStep === 2 ? '#00267F' : '#e5e7eb', color: createStep === 2 ? 'white' : '#9ca3af' }}>2</div>
                      <span className="text-sm font-semibold" style={{ color: createStep === 2 ? '#00267F' : '#9ca3af' }}>Your services</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreate} className="px-8 sm:px-12 pb-8 pt-4 flex flex-col gap-5">

                  {/* ── Step 1 ── */}
                  {createStep === 1 && (
                    <>
                      {/* Full name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base leading-none select-none">👤</span>
                          <input
                            type="text"
                            value={createName}
                            onChange={e => { setCreateName(e.target.value); setCreateErrors(prev => ({ ...prev, name: '' })) }}
                            placeholder="Jane Smith"
                            className={`w-full pl-10 pr-4 py-3 border rounded-lg text-gray-900 outline-none bg-white transition-colors ${createErrors.name ? 'border-red-400 focus:border-red-400' : 'border-gray-200'}`}
                            style={!createErrors.name ? { '--tw-ring-color': '#00267F' } : {}}
                            onFocus={e => { if (!createErrors.name) e.target.style.borderColor = '#00267F' }}
                            onBlur={e => { if (!createErrors.name) e.target.style.borderColor = '' }}
                          />
                        </div>
                        {createErrors.name && <p className="text-xs text-red-500 mt-1">{createErrors.name}</p>}
                      </div>

                      {/* Company name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company name <span className="text-gray-400 font-normal">(optional)</span></label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base leading-none select-none">🏢</span>
                          <input
                            type="text"
                            value={createCompanyName}
                            onChange={e => setCreateCompanyName(e.target.value)}
                            placeholder="e.g. Santana's Plumbing"
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none bg-white"
                            onFocus={e => e.target.style.borderColor = '#00267F'}
                            onBlur={e => e.target.style.borderColor = ''}
                          />
                        </div>
                      </div>

                      {/* Trade */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Trade / profession</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base leading-none select-none">🔧</span>
                          <input
                            type="text"
                            value={createTrade}
                            onChange={e => { setCreateTrade(e.target.value); setCreateErrors(prev => ({ ...prev, trade: '' })) }}
                            placeholder="e.g. Plumber, Graphic Designer"
                            className={`w-full pl-10 pr-4 py-3 border rounded-lg text-gray-900 outline-none bg-white transition-colors ${createErrors.trade ? 'border-red-400' : 'border-gray-200'}`}
                            onFocus={e => { if (!createErrors.trade) e.target.style.borderColor = '#00267F' }}
                            onBlur={e => { if (!createErrors.trade) e.target.style.borderColor = '' }}
                          />
                        </div>
                        {createErrors.trade && <p className="text-xs text-red-500 mt-1">{createErrors.trade}</p>}
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base leading-none select-none">📍</span>
                          <input
                            type="text"
                            value={createLocation}
                            onChange={e => { setCreateLocation(e.target.value); setCreateErrors(prev => ({ ...prev, location: '' })) }}
                            placeholder="e.g. Bridgetown, Barbados"
                            className={`w-full pl-10 pr-4 py-3 border rounded-lg text-gray-900 outline-none bg-white transition-colors ${createErrors.location ? 'border-red-400' : 'border-gray-200'}`}
                            onFocus={e => { if (!createErrors.location) e.target.style.borderColor = '#00267F' }}
                            onBlur={e => { if (!createErrors.location) e.target.style.borderColor = '' }}
                          />
                        </div>
                        {createErrors.location && <p className="text-xs text-red-500 mt-1">{createErrors.location}</p>}
                      </div>

                      {/* Bio */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-sm font-semibold text-gray-700">Bio</label>
                          <span className={`text-xs ${createBio.length > 300 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{createBio.length}/300</span>
                        </div>
                        <textarea
                          value={createBio}
                          onChange={e => setCreateBio(e.target.value.slice(0, 300))}
                          rows={4}
                          placeholder="Tell clients about your experience and what you do..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none bg-white resize-none"
                          onFocus={e => e.target.style.borderColor = '#00267F'}
                          onBlur={e => e.target.style.borderColor = ''}
                        />
                      </div>

                      {/* Price tier */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Price tier</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {PRICE_TIERS.map(tier => (
                            <button
                              key={tier.symbol}
                              type="button"
                              onClick={() => setCreateRate(String(tier.value))}
                              className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border-2 transition-all ${rateToTierValue(createRate) === tier.value ? 'bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                              style={rateToTierValue(createRate) === tier.value ? { borderColor: '#00267F', backgroundColor: '#EEF2FF' } : {}}
                            >
                              <span className="text-lg font-bold" style={{ color: '#00267F' }}>{tier.symbol}</span>
                              <span className="text-xs text-gray-500 mt-0.5">{tier.label}</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">This helps clients find you in search. Your actual service prices are always shown on your profile.</p>
                      </div>

                      {/* Skills */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Skills <span className="text-gray-400 font-normal">(comma separated)</span></label>
                        <input
                          type="text"
                          value={createSkills}
                          onChange={e => setCreateSkills(e.target.value)}
                          placeholder="e.g. Plumbing, Pipe fitting, Drain repair"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none bg-white"
                          onFocus={e => e.target.style.borderColor = '#00267F'}
                          onBlur={e => e.target.style.borderColor = ''}
                        />
                      </div>

                      {/* Availability */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Availability</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCreateAvailable(true)}
                            className={`py-3 rounded-lg border-2 text-sm font-semibold transition-all ${createAvailable ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
                          >
                            ✓ Available
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreateAvailable(false)}
                            className={`py-3 rounded-lg border-2 text-sm font-semibold transition-all ${!createAvailable ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
                          >
                            ✗ Unavailable
                          </button>
                        </div>
                      </div>

                      {/* Step 1 nav */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => { setShowCreateForm(false); setCreateStep(1); setCreateErrors({}) }}
                          className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 font-medium hover:border-gray-300 transition-colors bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const errs = {}
                            if (!createName.trim()) errs.name = 'Full name is required'
                            if (!createTrade.trim()) errs.trade = 'Trade or profession is required'
                            if (!createLocation.trim()) errs.location = 'Location is required'
                            if (Object.keys(errs).length > 0) { setCreateErrors(errs); return }
                            setCreateErrors({})
                            setCreateStep(2)
                          }}
                          className="flex-1 py-3 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: '#00267F' }}
                        >
                          Next →
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── Step 2 ── */}
                  {createStep === 2 && (
                    <>
                      {/* Services section */}
                      <div className="border border-gray-100 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm">Your services <span className="text-gray-400 font-normal">(optional)</span></h3>
                          {!showCreateSvcForm && (
                            <button
                              type="button"
                              onClick={() => setShowCreateSvcForm(true)}
                              className="text-sm font-medium hover:opacity-80 transition-opacity"
                              style={{ color: '#00267F' }}
                            >
                              + Add a service
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mb-4">You can add these later from your dashboard.</p>

                        {createServices.length > 0 && (
                          <div className="flex flex-col gap-2 mb-4">
                            {createServices.map((svc, i) => (
                              <div key={i} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm capitalize">{svc.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-sm font-semibold" style={{ color: '#00267F' }}>{svc.price}</span>
                                    {svc.duration && <span className="text-xs text-gray-400">{svc.duration}</span>}
                                  </div>
                                  {svc.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed capitalize">{svc.description}</p>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setCreateServices(prev => prev.filter((_, idx) => idx !== i))}
                                  className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 font-medium transition-colors mt-0.5"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {showCreateSvcForm && (
                          <div className="flex flex-col gap-3 pt-1">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Service name</label>
                              <input type="text" value={createSvcName} onChange={e => setCreateSvcName(e.target.value)} placeholder="e.g. Full house rewire" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white" onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Price</label>
                              <select
                                value={createSvcPriceOption}
                                onChange={e => {
                                  const v = e.target.value
                                  setCreateSvcPriceOption(v)
                                  if (v !== 'Custom amount') setCreateSvcPrice(v)
                                  else setCreateSvcPrice('')
                                }}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white"
                                onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''}
                              >
                                <option value="">Select price</option>
                                <option>$25</option>
                                <option>$50</option>
                                <option>$75</option>
                                <option>$100</option>
                                <option>$150</option>
                                <option>$200</option>
                                <option>$250</option>
                                <option>$300</option>
                                <option>$500</option>
                                <option>Price on request</option>
                                <option>Custom amount</option>
                              </select>
                              {createSvcPriceOption === 'Custom amount' && (
                                <input type="text" value={createSvcPrice} onChange={e => setCreateSvcPrice(e.target.value)} placeholder="e.g. From $80, $45 per sq ft, $120 + materials" className="w-full mt-2 px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white" onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''} />
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                              <textarea value={createSvcDescription} onChange={e => setCreateSvcDescription(e.target.value)} rows={2} placeholder="Describe what's included..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white resize-none" onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Duration <span className="text-gray-400 font-normal">(optional)</span></label>
                              <select value={createSvcDuration} onChange={e => setCreateSvcDuration(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white" onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''}>
                                <option value="">Select duration</option>
                                <option>30 minutes</option>
                                <option>1 hour</option>
                                <option>1.5 hours</option>
                                <option>2 hours</option>
                                <option>3 hours</option>
                                <option>Half day</option>
                                <option>Full day</option>
                                <option>2-3 days</option>
                                <option>1 week</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setShowCreateSvcForm(false); setCreateSvcName(''); setCreateSvcPrice(''); setCreateSvcPriceOption(''); setCreateSvcDescription(''); setCreateSvcDuration('') }} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-colors bg-white">Cancel</button>
                              <button type="button" onClick={addCreateService} disabled={!createSvcName.trim() || !createSvcPrice.trim()} className="flex-1 text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: '#00267F' }}>Add service</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {createError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{createError}</p>}

                      {/* Step 2 nav */}
                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setCreateStep(1)} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 font-medium hover:border-gray-300 transition-colors bg-white">← Back</button>
                        <button type="submit" disabled={creating} className="flex-1 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: '#00267F' }}>
                          {creating ? 'Creating...' : 'Create profile'}
                        </button>
                      </div>
                    </>
                  )}

                </form>
              </div>
            )}
          </div>
        )}

        {/* Account settings — shown for all roles */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-6">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 sm:px-8 py-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4.5 h-4.5 w-5 h-5 flex-shrink-0" style={{ color: '#00267F' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-semibold text-gray-900">Account settings</span>
            </div>
            <svg
              className="w-5 h-5 text-gray-400 transition-transform"
              style={{ transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {settingsOpen && (
            <div className="px-6 sm:px-8 pb-8 pt-2 flex flex-col gap-8 border-t border-gray-100">

              {/* Change email */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 mt-6">Change email</h3>
                <p className="text-sm text-gray-500 mb-4">We'll send a confirmation link to your new address.</p>
                <form onSubmit={handleEmailUpdate} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={e => { setNewEmail(e.target.value); setEmailSuccess(false); setEmailError(null) }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                  />
                  {emailError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{emailError}</p>}
                  {emailSuccess && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Check your new email address for a confirmation link.</p>}
                  <button
                    type="submit"
                    disabled={emailSaving}
                    className="w-full sm:w-auto sm:self-start text-white px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    {emailSaving ? 'Updating...' : 'Update email'}
                  </button>
                </form>
              </div>

              <div className="border-t border-gray-100" />

              {/* Change password */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Change password</h3>
                <p className="text-sm text-gray-500 mb-4">Choose a new password for your account.</p>
                <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-3">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPasswordSuccess(false); setPasswordError(null) }}
                    placeholder="New password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                  />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setPasswordSuccess(false); setPasswordError(null) }}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                  />
                  {passwordError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{passwordError}</p>}
                  {passwordSuccess && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Password updated successfully.</p>}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full sm:w-auto sm:self-start text-white px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    {passwordSaving ? 'Updating...' : 'Update password'}
                  </button>
                </form>
              </div>

              {/* Danger zone — freelancers only */}
              {role !== 'client' && profile && (
                <>
                  <div className="border-t border-gray-100" />
                  <div>
                    <h3 className="font-semibold text-red-600 mb-1">Danger zone</h3>
                    <p className="text-sm text-gray-500 mb-4">Permanently delete your freelancer profile and all associated data.</p>

                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-5 py-2.5 rounded-full text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete my freelancer profile
                      </button>
                    ) : (
                      <div className="border border-red-200 rounded-xl p-5 bg-red-50">
                        <p className="text-sm font-semibold text-red-700 mb-1">Are you sure?</p>
                        <p className="text-sm text-red-600 mb-4">This will permanently delete your profile, services and reviews. This cannot be undone.</p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-colors bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteProfile}
                            disabled={deleting}
                            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting ? 'Deleting...' : 'Yes, delete everything'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          )}
        </div>

      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <p className="mt-1.5 text-xs">
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </p>
      </footer>
    </main>
  )
}
