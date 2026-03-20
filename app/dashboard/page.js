'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEditForm, setShowEditForm] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

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
  const [createTrade, setCreateTrade] = useState('')
  const [createLocation, setCreateLocation] = useState('')
  const [createBio, setCreateBio] = useState('')
  const [createRate, setCreateRate] = useState('')
  const [createSkills, setCreateSkills] = useState('')
  const [createAvailable, setCreateAvailable] = useState(true)
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

        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', p.id).eq('read', false)
        setUnreadCount(count || 0)
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
      setProfile(data)
      setBio(data.bio || '')
      setHourlyRate(data.hourly_rate || '')
      setAvailable(data.available || false)
      setSkillsInput((data.skills || []).join(', '))
      setShowCreateForm(false)
    }
    setCreating(false)
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
            {profile ? (
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
            {profile && (
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
            {profile ? (
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
            {profile && (
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

        {profile ? (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly rate</label>
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
                                    {review.author[0]}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{review.author}</p>
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
                                    {review.author[0]}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">{review.author}</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                      <input type="text" required value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Jane Smith" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trade / profession</label>
                      <input type="text" required value={createTrade} onChange={e => setCreateTrade(e.target.value)} placeholder="e.g. Plumber, Graphic Designer" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white" />
                    </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly rate</label>
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
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
