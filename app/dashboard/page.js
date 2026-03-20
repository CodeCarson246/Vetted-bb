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
  const [createSvcDescription, setCreateSvcDescription] = useState('')
  const [createSvcDuration, setCreateSvcDuration] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

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
    } else {
      if (createServices.length > 0) {
        await supabase.from('services').insert(
          createServices.map(svc => ({
            freelancer_id: data.id,
            name: svc.name,
            price: svc.price,
            description: svc.description || null,
            duration: svc.duration || null,
          }))
        )
      }
      setProfile(data)
      setBio(data.bio || '')
      setHourlyRate(data.hourly_rate || '')
      setAvailable(data.available || false)
      setSkillsInput((data.skills || []).join(', '))
      setShowCreateForm(false)
    }
    setCreating(false)
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

  function openServiceForm(svc = null) {
    setEditingService(svc)
    setServiceName(svc?.name || '')
    setServicePrice(svc?.price || '')
    setServiceDescription(svc?.description || '')
    setServiceDuration(svc?.duration || '')
    setServiceError(null)
    setShowServiceForm(true)
  }

  function closeServiceForm() {
    setShowServiceForm(false)
    setEditingService(null)
    setServiceName('')
    setServicePrice('')
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
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
                {user?.user_metadata?.full_name || user?.email}
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
              <span className="text-gray-600 text-sm font-medium">{user?.email}</span>
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
                {user?.user_metadata?.full_name || user?.email}
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
              <span className="text-gray-600 text-sm font-medium">{user?.email}</span>
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

            {/* Welcome card */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}!
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
                </div>
                <a
                  href="/search"
                  className="flex-shrink-0 text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity text-center"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Find a freelancer
                </a>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
                <p className="text-3xl font-bold text-gray-900">{clientReviewsLeft.length}</p>
                <p className="text-sm text-gray-500 mt-1">Reviews left</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
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
            {/* Profile card */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 mb-6 border border-gray-100">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
                      <p className="font-medium" style={{ color: '#00267F' }}>{profile.trade}</p>
                      <p className="text-gray-500 text-sm">{profile.location}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <StarRating rating={profile.rating} />
                        <span className="text-sm font-medium text-gray-700">{profile.rating}</span>
                        <span className="text-xs text-gray-400">({profile.review_count} reviews)</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.available ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {profile.available ? 'Available' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap sm:flex-col sm:items-end">
                      <a
                        href={`/freelancers/${profile.id}`}
                        className="px-4 py-2 border border-gray-200 rounded-full text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
                      >
                        View public profile
                      </a>
                      <button
                        onClick={() => setShowEditForm(v => !v)}
                        className="px-4 py-2 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        {showEditForm ? 'Cancel' : 'Edit profile'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit form */}
              {showEditForm && (
                <form onSubmit={handleSave} className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-5">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate (used to show price range)</label>
                    <p className="text-xs text-gray-400 mb-2">This number is never shown publicly — it's used to display a price range indicator ($, $$, $$$, $$$$) on your profile.</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input
                        type="text"
                        value={hourlyRate}
                        onChange={e => setHourlyRate(e.target.value)}
                        placeholder="60"
                        className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                    </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <input
                          type="text"
                          required
                          value={servicePrice}
                          onChange={e => setServicePrice(e.target.value)}
                          placeholder='e.g. $150, From $80, Price on request'
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                        />
                      </div>
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
                      <input
                        type="text"
                        value={serviceDuration}
                        onChange={e => setServiceDuration(e.target.value)}
                        placeholder="e.g. 2–4 hours, 1 day"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
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
                        <p className="font-semibold text-gray-900">{svc.name}</p>
                        {svc.description && <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{svc.description}</p>}
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
              <div className="flex border-b border-gray-100">
                {['overview', 'reviews', 'leave-a-review'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
                    style={activeTab === tab ? { color: '#00267F', borderColor: '#00267F' } : {}}
                  >
                    {tab === 'overview' ? 'Overview' : tab === 'reviews' ? 'Reviews' : 'Leave a review'}
                  </button>
                ))}
              </div>

              <div className="p-6 sm:p-8">

                {/* Overview tab */}
                {activeTab === 'overview' && (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-xl p-5 text-center">
                        <p className="text-3xl font-bold text-gray-900">{profile.rating}</p>
                        <div className="flex justify-center mt-1 mb-1">
                          <StarRating rating={profile.rating} />
                        </div>
                        <p className="text-sm text-gray-500">Average rating</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-5 text-center">
                        <p className="text-3xl font-bold text-gray-900">{profile.review_count}</p>
                        <p className="text-sm text-gray-500 mt-2">Total reviews</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-5 text-center">
                        <p className="text-3xl font-bold text-gray-900">${profile.hourly_rate}</p>
                        <p className="text-sm text-gray-500 mt-2">Per hour</p>
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
                            <div key={i} className="border border-gray-100 rounded-xl p-5">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                                    {displayName(review.author)[0]}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{displayName(review.author)}</p>
                                    <p className="text-xs text-gray-400">{review.date}</p>
                                  </div>
                                </div>
                                <StarRating rating={review.rating} />
                              </div>
                              <p className="text-gray-600 text-sm">{review.comment}</p>
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
                            <div key={i} className="border border-gray-100 rounded-xl p-5">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-sm font-semibold" style={{ color: '#00267F' }}>
                                    {displayName(review.author)[0]}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{displayName(review.author)}</p>
                                    <p className="text-xs text-gray-400">{review.date}</p>
                                  </div>
                                </div>
                                <StarRating rating={review.rating} />
                              </div>
                              <p className="text-gray-600 text-sm">{review.comment}</p>
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
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            {!showCreateForm ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-4">🛠️</p>
                <h2 className="text-xl font-bold text-gray-900 mb-2">You don't have a freelancer profile yet</h2>
                <p className="text-gray-500 text-sm mb-8">Create a profile to start getting discovered by clients across Barbados.</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Create your freelancer profile
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-6">Create your freelancer profile</h2>
                <form onSubmit={handleCreate} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input type="text" required value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Jane Smith" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company name <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" value={createCompanyName} onChange={e => setCreateCompanyName(e.target.value)} placeholder="e.g. Santana's Plumbing (optional)" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trade / profession</label>
                    <input type="text" required value={createTrade} onChange={e => setCreateTrade(e.target.value)} placeholder="e.g. Plumber, Graphic Designer" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input type="text" required value={createLocation} onChange={e => setCreateLocation(e.target.value)} placeholder="e.g. Bridgetown, Barbados" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea required value={createBio} onChange={e => setCreateBio(e.target.value)} rows={4} placeholder="Tell clients about your experience and what you do..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate (used to show price range)</label>
                    <p className="text-xs text-gray-400 mb-2">This number is never shown publicly — it's used to display a price range indicator ($, $$, $$$, $$$$) on your profile.</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input type="text" required value={createRate} onChange={e => setCreateRate(e.target.value)} placeholder="60" className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skills <span className="text-gray-400 font-normal">(comma separated)</span></label>
                    <input type="text" value={createSkills} onChange={e => setCreateSkills(e.target.value)} placeholder="e.g. Plumbing, Pipe fitting, Drain repair" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setCreateAvailable(true)} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${createAvailable ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>Available</button>
                      <button type="button" onClick={() => setCreateAvailable(false)} className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${!createAvailable ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>Unavailable</button>
                    </div>
                  </div>

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

                    {/* Added service cards */}
                    {createServices.length > 0 && (
                      <div className="flex flex-col gap-2 mb-4">
                        {createServices.map((svc, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{svc.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm font-semibold" style={{ color: '#00267F' }}>{svc.price}</span>
                                {svc.duration && <span className="text-xs text-gray-400">{svc.duration}</span>}
                              </div>
                              {svc.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{svc.description}</p>}
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

                    {/* Inline add-service form */}
                    {showCreateSvcForm && (
                      <div className="flex flex-col gap-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Service name</label>
                            <input
                              type="text"
                              value={createSvcName}
                              onChange={e => setCreateSvcName(e.target.value)}
                              placeholder="e.g. Full house rewire"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-gray-400 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Price</label>
                            <input
                              type="text"
                              value={createSvcPrice}
                              onChange={e => setCreateSvcPrice(e.target.value)}
                              placeholder="e.g. $150, From $80"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-gray-400 bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                          <textarea
                            value={createSvcDescription}
                            onChange={e => setCreateSvcDescription(e.target.value)}
                            rows={2}
                            placeholder="Describe what's included..."
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-gray-400 bg-white resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Duration <span className="text-gray-400 font-normal">(optional)</span></label>
                          <input
                            type="text"
                            value={createSvcDuration}
                            onChange={e => setCreateSvcDuration(e.target.value)}
                            placeholder="e.g. 2–4 hours, 1 day"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-gray-400 bg-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowCreateSvcForm(false); setCreateSvcName(''); setCreateSvcPrice(''); setCreateSvcDescription(''); setCreateSvcDuration('') }}
                            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-colors bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={addCreateService}
                            disabled={!createSvcName.trim() || !createSvcPrice.trim()}
                            className="flex-1 text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#00267F' }}
                          >
                            Add service
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {createError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{createError}</p>}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:border-gray-300">Cancel</button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#00267F' }}
                    >
                      {creating ? 'Creating...' : 'Create profile'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* Account settings — shown for all roles */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-6">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center justify-between px-6 sm:px-8 py-5 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900">Account settings</span>
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

            </div>
          )}
        </div>

      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
