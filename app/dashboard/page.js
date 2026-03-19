'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Edit form state
  const [bio, setBio] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [available, setAvailable] = useState(false)
  const [skillsInput, setSkillsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

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

      const { data: profile } = await supabase
        .from('freelancers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        setProfile(profile)
        setBio(profile.bio || '')
        setHourlyRate(profile.hourly_rate || '')
        setAvailable(profile.available || false)
        setSkillsInput((profile.skills || []).join(', '))
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
      setTimeout(() => setSaveSuccess(false), 3000)
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        <a href="/" className="text-2xl font-bold text-blue-600">Vetted.bb</a>
        <div className="flex gap-4 items-center">
          <span className="text-gray-600 text-sm font-medium">{user?.email}</span>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700"
          >
            Log out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {profile ? (
          <>
            {/* Current profile summary */}
            <div className="bg-white rounded-2xl p-8 mb-6 border border-gray-100">
              <div className="flex gap-6 items-start">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600 flex-shrink-0">
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                      <p className="text-blue-600 font-medium">{profile.trade}</p>
                      <p className="text-gray-500 text-sm mt-1">{profile.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">${profile.hourly_rate}<span className="text-sm text-gray-500 font-normal">/hr</span></p>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium mt-1 inline-block ${profile.available ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {profile.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {(profile.skills || []).map(skill => (
                      <span key={skill} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <a href={`/freelancers/${profile.id}`} className="text-sm text-blue-600 font-medium hover:underline">View public profile →</a>
              </div>
            </div>

            {/* Edit form */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Edit your profile</h2>
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={4}
                    placeholder="Tell clients about your experience and what you do..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white resize-none"
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
                      className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAvailable(true)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${available ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      Available
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvailable(false)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${!available ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      Unavailable
                    </button>
                  </div>
                </div>

                {saveError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{saveError}</p>
                )}
                {saveSuccess && (
                  <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Profile updated successfully.</p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            {!showCreateForm ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-4">🛠️</p>
                <h2 className="text-xl font-bold text-gray-900 mb-2">You don't have a freelancer profile yet</h2>
                <p className="text-gray-500 text-sm mb-8">Create a profile to start getting discovered by clients across Barbados.</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 text-white px-8 py-3 rounded-full font-medium hover:bg-blue-700"
                >
                  Create your freelancer profile
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-6">Create your freelancer profile</h2>
                <form onSubmit={handleCreate} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                      <input
                        type="text"
                        required
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trade / profession</label>
                      <input
                        type="text"
                        required
                        value={createTrade}
                        onChange={e => setCreateTrade(e.target.value)}
                        placeholder="e.g. Plumber, Graphic Designer"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      required
                      value={createLocation}
                      onChange={e => setCreateLocation(e.target.value)}
                      placeholder="e.g. Bridgetown, Barbados"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea
                      required
                      value={createBio}
                      onChange={e => setCreateBio(e.target.value)}
                      rows={4}
                      placeholder="Tell clients about your experience and what you do..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly rate</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                      <input
                        type="text"
                        required
                        value={createRate}
                        onChange={e => setCreateRate(e.target.value)}
                        placeholder="60"
                        className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skills <span className="text-gray-400 font-normal">(comma separated)</span></label>
                    <input
                      type="text"
                      value={createSkills}
                      onChange={e => setCreateSkills(e.target.value)}
                      placeholder="e.g. Plumbing, Pipe fitting, Drain repair"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCreateAvailable(true)}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${createAvailable ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        Available
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateAvailable(false)}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${!createAvailable ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        Unavailable
                      </button>
                    </div>
                  </div>

                  {createError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{createError}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:border-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
