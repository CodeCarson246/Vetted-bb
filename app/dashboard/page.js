'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import AvailabilitySettings from '@/components/calendar/AvailabilitySettings'
import { DURATION_OPTIONS } from '@/components/calendar/calUtils'

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 18px', borderRadius: '12px',
        backgroundColor: type === 'success' ? '#00267F' : '#dc2626',
        color: 'white', fontSize: '14px', fontWeight: '500',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.2s ease'
      }}
    >
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
      <button onClick={onClose} style={{ marginLeft: '8px', opacity: 0.7, background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
    </div>
  )
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
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEditForm, setShowEditForm] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [clientMessages, setClientMessages] = useState([])
  const [clientThreadReplies, setClientThreadReplies] = useState({})
  const [clientThreadQuotes, setClientThreadQuotes] = useState({})
  const [expandedClientMsg, setExpandedClientMsg] = useState(null)
  const [viewingClientQuote, setViewingClientQuote] = useState(null)
  const [clientReviewsLeft, setClientReviewsLeft] = useState([])
  const [topFreelancers, setTopFreelancers] = useState([])
  const [copied, setCopied] = useState(false)

  // Portfolio state
  const [portfolioItems, setPortfolioItems] = useState([])
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  const [editingPortfolio, setEditingPortfolio] = useState(null)
  const [portfolioTitle, setPortfolioTitle] = useState('')
  const [portfolioDescription, setPortfolioDescription] = useState('')
  const [portfolioImageUrl, setPortfolioImageUrl] = useState('')
  const [portfolioImageUploading, setPortfolioImageUploading] = useState(false)
  const [portfolioSaving, setPortfolioSaving] = useState(false)
  const [portfolioError, setPortfolioError] = useState(null)
  const [portfolioLightbox, setPortfolioLightbox] = useState(null)

  // Services state
  const [services, setServices] = useState([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState('')
  const [servicePriceType, setServicePriceType] = useState('fixed')
  const [serviceDescription, setServiceDescription] = useState('')
  const [serviceDuration, setServiceDuration] = useState('')
  const [serviceDurationMinutes, setServiceDurationMinutes] = useState(null)
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceError, setServiceError] = useState(null)
  const [serviceImages, setServiceImages] = useState([])
  const [serviceImagesUploading, setServiceImagesUploading] = useState(false)
  const [existingServiceImages, setExistingServiceImages] = useState([])

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
  const [yearsExperience, setYearsExperience] = useState('')
  const [qualifications, setQualifications] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [available, setAvailable] = useState(false)
  const [skillsInput, setSkillsInput] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
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
  const [createCategory, setCreateCategory] = useState('')
  const [createSkills, setCreateSkills] = useState('')
  const [createAvailable, setCreateAvailable] = useState(true)
  const [createServices, setCreateServices] = useState([])
  const [showCreateSvcForm, setShowCreateSvcForm] = useState(false)
  const [createSvcName, setCreateSvcName] = useState('')
  const [createSvcPrice, setCreateSvcPrice] = useState('')
  const [createSvcPriceType, setCreateSvcPriceType] = useState('fixed')
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
          supabase.from('messages').select('*, freelancers(id, name, avatar_url, trade, company_name, email, location)').eq('sender_email', user.email).order('created_at', { ascending: false }),
          supabase.from('reviews').select('*').eq('author_email', user.email).order('date', { ascending: false }),
          supabase.from('freelancers').select('id, name, trade, avatar_url, rating, min_price').order('rating', { ascending: false }).limit(3),
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
          setYearsExperience(p.years_experience ?? '')
          setQualifications(p.qualifications || '')
          setHourlyRate(p.hourly_rate || '')
          setAvailable(p.available || false)
          setSkillsInput((p.skills || []).join(', '))
          setCategory(p.category || '')
          setAvatarUrl(p.avatar_url || '')

          const { data: r } = await supabase
            .from('reviews')
            .select('*')
            .eq('freelancer_id', p.id)
            .order('date', { ascending: false })
          setReviews(r || [])

          const [{ count }, { data: svc }, { data: portfolio }] = await Promise.all([
            supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', p.id).eq('read', false),
            supabase.from('services').select('*, service_images(id, url)').eq('freelancer_id', p.id).order('created_at', { ascending: true }),
            supabase.from('portfolio_items').select('*').eq('freelancer_id', p.id).order('created_at', { ascending: true }),
          ])
          setUnreadCount(count || 0)
          setServices(svc || [])
          setPortfolioItems(portfolio || [])
        }
      }

      setLoading(false)
    }
    init()
  }, [router])

  async function expandClientMessage(msg) {
    if (expandedClientMsg === msg.id) {
      setExpandedClientMsg(null)
      return
    }
    setExpandedClientMsg(msg.id)
    const { data: r } = await supabase
      .from('message_replies')
      .select('*')
      .eq('message_id', msg.id)
      .order('created_at', { ascending: true })
    setClientThreadReplies(prev => ({ ...prev, [msg.id]: r || [] }))
    const quoteIds = (r || [])
      .filter(rep => rep.body.startsWith('__QUOTE__'))
      .map(rep => rep.body.replace('__QUOTE__', ''))
    if (quoteIds.length > 0) {
      const { data: qs } = await supabase
        .from('quotes')
        .select('*')
        .in('id', quoteIds)
      if (qs) {
        const map = {}
        qs.forEach(q => { map[q.id] = q })
        setClientThreadQuotes(prev => ({ ...prev, ...map }))
      }
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean)

    const { error } = await supabase
      .from('freelancers')
      .update({
        bio,
        years_experience: yearsExperience === '' ? null : Number(yearsExperience),
        qualifications: qualifications.trim() || null,
        hourly_rate: hourlyRate,
        available,
        skills,
        category,
      })
      .eq('user_id', user.id)

    if (error) {
      setToast({ message: 'Something went wrong. Please try again.', type: 'error' })
    } else {
      setProfile(prev => ({
        ...prev,
        bio,
        years_experience: yearsExperience === '' ? null : Number(yearsExperience),
        qualifications: qualifications.trim() || null,
        hourly_rate: hourlyRate,
        available,
        skills,
        category,
      }))
      setShowEditForm(false)
      setToast({ message: 'Profile updated successfully', type: 'success' })
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
        hourly_rate: createRate || null,
        available: createAvailable,
        skills,
        category: createCategory || null,
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
            price_type: svc.price_type || 'fixed',
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
      price_type: createSvcPriceType,
      description: createSvcDescription.trim(),
      duration: createSvcDuration.trim(),
    }])
    setCreateSvcName('')
    setCreateSvcPrice('')
    setCreateSvcPriceType('fixed')
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
    setServiceDescription(svc?.description || '')
    setServiceDuration(svc?.duration || '')
    setServiceDurationMinutes(svc?.duration_minutes ?? null)
    setServiceError(null)
    setServiceImages([])
    setExistingServiceImages([])
    // Strip any legacy formatting ($, +) to get the raw number
    const rawPrice = svc?.price ? String(svc.price).replace(/[$+]/g, '') : ''
    setServicePrice(rawPrice)
    setServicePriceType(svc?.price_type || 'fixed')
    if (svc?.id) {
      supabase.from('service_images').select('*').eq('service_id', svc.id).then(({ data }) => {
        setExistingServiceImages(data || [])
      })
    }
    setShowServiceForm(true)
  }

  function closeServiceForm() {
    setShowServiceForm(false)
    setEditingService(null)
    setServiceName('')
    setServicePrice('')
    setServicePriceType('fixed')
    setServiceDescription('')
    setServiceDuration('')
    setServiceDurationMinutes(null)
    setServiceError(null)
    setServiceImages([])
    setExistingServiceImages([])
  }

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024  // 5 MB
  const MIN_IMAGE_DIM = 200                 // 200×200 px

  function validateImageFile(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return false
    if (file.size > MAX_IMAGE_BYTES) return false
    return true
  }

  function checkImageDimensions(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img.width >= MIN_IMAGE_DIM && img.height >= MIN_IMAGE_DIM)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
      img.src = url
    })
  }

  async function handleServiceImageUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (existingServiceImages.length + serviceImages.length + files.length > 6) {
      setServiceError('Maximum 6 images per service.')
      return
    }
    setServiceImagesUploading(true)
    const uploaded = []
    for (const file of files) {
      // Type + size check
      if (!validateImageFile(file)) {
        setServiceError('Please upload a proper photo of your work. Minimum 200×200px, max 5MB, JPG or PNG only.')
        setServiceImagesUploading(false)
        return
      }
      // Dimension check (requires reading the image)
      const dimsOk = await checkImageDimensions(file)
      if (!dimsOk) {
        setServiceError('Please upload a proper photo of your work. Minimum 200×200px, max 5MB, JPG or PNG only.')
        setServiceImagesUploading(false)
        return
      }
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(path, file, { upsert: false })
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(path)
        uploaded.push({ url: publicUrl, path })
      }
    }
    setServiceImages(prev => [...prev, ...uploaded])
    setServiceImagesUploading(false)
  }

  async function handleRemoveExistingImage(img) {
    await supabase.from('service_images').delete().eq('id', img.id)
    setExistingServiceImages(prev => prev.filter(i => i.id !== img.id))
  }

  function handleRemoveNewImage(index) {
    setServiceImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleServiceSubmit(e) {
    e.preventDefault()
    setServiceSaving(true)
    setServiceError(null)

    const payload = {
      name: serviceName,
      price: servicePrice,
      price_type: servicePriceType,
      description: serviceDescription,
      duration: serviceDuration || null,
      duration_minutes: serviceDurationMinutes,
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
      setServiceSaving(false)
      return
    }
    let savedServiceId = editingService?.id
    if (!savedServiceId) {
      const { data: newest } = await supabase
        .from('services')
        .select('id')
        .eq('freelancer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      savedServiceId = newest?.id
    }
    // Filter out any partial uploads — only save images with a valid URL
    const validImages = serviceImages.filter(img => img.url && img.url.startsWith('http'))
    if (validImages.length > 0 && savedServiceId) {
      await Promise.all(
        validImages.map(img =>
          supabase.from('service_images').insert({ service_id: savedServiceId, url: img.url })
        )
      )
    }
    const { data: updatedSvc } = await supabase
      .from('services')
      .select('*, service_images(id, url)')
      .eq('freelancer_id', profile.id)
      .order('created_at', { ascending: true })
    setServices(updatedSvc || [])

    // Recalculate min_price on the freelancer row
    const prices = (updatedSvc || [])
      .map(s => parseFloat(String(s.price).replace(/[^0-9.]/g, '')))
      .filter(n => !isNaN(n) && n > 0)
    if (prices.length > 0) {
      await supabase.from('freelancers').update({ min_price: Math.min(...prices) }).eq('id', profile.id)
    }

    closeServiceForm()
    setToast({ message: editingService ? 'Service updated' : 'Service added', type: 'success' })
    setServiceSaving(false)
  }

  async function handleServiceDelete(id) {
    await supabase.from('services').delete().eq('id', id)
    const remaining = services.filter(s => s.id !== id)
    setServices(remaining)
    const prices = remaining
      .map(s => parseFloat(String(s.price).replace(/[^0-9.]/g, '')))
      .filter(n => !isNaN(n) && n > 0)
    const newMin = prices.length > 0 ? Math.min(...prices) : null
    await supabase.from('freelancers').update({ min_price: newMin }).eq('id', profile.id)
  }

  function openPortfolioForm(item = null) {
    setEditingPortfolio(item)
    setPortfolioTitle(item?.title || '')
    setPortfolioDescription(item?.description || '')
    setPortfolioImageUrl(item?.image_url || '')
    setPortfolioError(null)
    setShowPortfolioForm(true)
  }

  function closePortfolioForm() {
    setShowPortfolioForm(false)
    setEditingPortfolio(null)
    setPortfolioTitle('')
    setPortfolioDescription('')
    setPortfolioImageUrl('')
    setPortfolioError(null)
  }

  async function handlePortfolioImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateImageFile(file)) {
      setPortfolioError('Please upload a JPG or PNG image, max 5MB.')
      return
    }
    const dimsOk = await checkImageDimensions(file)
    if (!dimsOk) {
      setPortfolioError('Image must be at least 200×200px.')
      return
    }
    setPortfolioImageUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('portfolio')
      .upload(path, file, { upsert: false })
    if (uploadError) {
      setPortfolioError('Upload failed. Please try again.')
    } else {
      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path)
      setPortfolioImageUrl(publicUrl)
    }
    setPortfolioImageUploading(false)
  }

  async function handlePortfolioSubmit(e) {
    e.preventDefault()
    if (!portfolioImageUrl) { setPortfolioError('Please upload a photo.'); return }
    if (!portfolioTitle.trim()) { setPortfolioError('Please enter a title.'); return }
    setPortfolioSaving(true)
    setPortfolioError(null)

    const payload = {
      freelancer_id: profile.id,
      title: portfolioTitle.trim(),
      description: portfolioDescription.trim() || null,
      image_url: portfolioImageUrl,
    }

    if (editingPortfolio) {
      const { error } = await supabase.from('portfolio_items').update(payload).eq('id', editingPortfolio.id)
      if (error) {
        setPortfolioError('Failed to save. Please try again.')
      } else {
        setPortfolioItems(prev => prev.map(p => p.id === editingPortfolio.id ? { ...p, ...payload } : p))
        closePortfolioForm()
      }
    } else {
      const { data, error } = await supabase.from('portfolio_items').insert(payload).select().single()
      if (error) {
        setPortfolioError('Failed to save. Please try again.')
      } else {
        setPortfolioItems(prev => [...prev, data])
        closePortfolioForm()
      }
    }
    setPortfolioSaving(false)
  }

  async function handlePortfolioDelete(id) {
    await supabase.from('portfolio_items').delete().eq('id', id)
    setPortfolioItems(prev => prev.filter(p => p.id !== id))
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
      setToast({ message: 'Check your new email for a confirmation link', type: 'success' })
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
      setNewPassword('')
      setConfirmPassword('')
      setToast({ message: 'Password updated successfully', type: 'success' })
    }
    setPasswordSaving(false)
  }

  async function handleDeleteProfile() {
    setDeleting(true)
    const freelancerId = profile.id
    console.log('[delete-profile] starting deletion for freelancer_id:', freelancerId)
    try {
      // Step 1: Delete storage files (portfolio images + display picture) — non-fatal, log and continue
      const allImages = services.flatMap(s => s.service_images || [])
      if (allImages.length > 0) {
        const paths = allImages
          .map(img => {
            const parts = img.url.split('/public/service-images/')
            return parts.length > 1 ? decodeURIComponent(parts[1]) : null
          })
          .filter(Boolean)
        if (paths.length > 0) {
          const { error: storageErr } = await supabase.storage.from('service-images').remove(paths)
          if (storageErr) console.error('[delete-profile] step 1 portfolio storage error (non-fatal):', storageErr)
          else console.log('[delete-profile] step 1 complete: removed', paths.length, 'portfolio image(s) from storage')
        }
      } else {
        console.log('[delete-profile] step 1 complete: no portfolio images in storage')
      }
      if (profile.avatar_url) {
        const parts = profile.avatar_url.split('/public/avatars/')
        if (parts.length > 1) {
          const avatarPath = decodeURIComponent(parts[1])
          const { error: avatarErr } = await supabase.storage.from('avatars').remove([avatarPath])
          if (avatarErr) console.error('[delete-profile] step 1 display picture storage error (non-fatal):', avatarErr)
          else console.log('[delete-profile] step 1 complete: display picture removed from storage')
        }
      }

      // Step 2: Delete service_images rows
      const serviceIds = services.map(s => s.id)
      if (serviceIds.length > 0) {
        const { error: siErr } = await supabase.from('service_images').delete().in('service_id', serviceIds)
        if (siErr) throw new Error(`step 2 service_images: ${siErr.message}`)
      }
      console.log('[delete-profile] step 2 complete: service_images rows deleted')

      // Step 3: Delete services rows
      const { error: svcErr } = await supabase.from('services').delete().eq('freelancer_id', freelancerId)
      if (svcErr) throw new Error(`step 3 services: ${svcErr.message}`)
      console.log('[delete-profile] step 3 complete: services rows deleted')

      // Step 4: Fetch message IDs, then delete message_replies (child must go before parent)
      const { data: msgs, error: msgFetchErr } = await supabase.from('messages').select('id').eq('freelancer_id', freelancerId)
      if (msgFetchErr) throw new Error(`step 4 messages fetch: ${msgFetchErr.message}`)
      const msgIds = (msgs || []).map(m => m.id)
      if (msgIds.length > 0) {
        const { error: repErr } = await supabase.from('message_replies').delete().in('message_id', msgIds)
        if (repErr) throw new Error(`step 4 message_replies: ${repErr.message}`)
      }
      console.log('[delete-profile] step 4 complete: message_replies deleted (', msgIds.length, 'thread(s))')

      // Step 5: Delete quotes rows
      const { error: quotesErr } = await supabase.from('quotes').delete().eq('freelancer_id', freelancerId)
      if (quotesErr) throw new Error(`step 5 quotes: ${quotesErr.message}`)
      console.log('[delete-profile] step 5 complete: quotes deleted')

      // Step 6: Delete messages rows
      const { error: msgsErr } = await supabase.from('messages').delete().eq('freelancer_id', freelancerId)
      if (msgsErr) throw new Error(`step 6 messages: ${msgsErr.message}`)
      console.log('[delete-profile] step 6 complete: messages deleted')

      // Step 7: Delete the freelancers row — reviews are handled automatically by ON DELETE SET NULL
      const { error: profileErr } = await supabase.from('freelancers').delete().eq('user_id', user.id)
      if (profileErr) throw new Error(`step 7 freelancers: ${profileErr.message}`)
      console.log('[delete-profile] step 7 complete: freelancer profile deleted')

      // Clear local state — dashboard will show the create-profile onboarding automatically
      setProfile(null)
      setServices([])
      setReviews([])
      setShowDeleteConfirm(false)
      setDeleting(false)
      setToast({ message: 'Your profile has been deleted. You can create a new one any time.', type: 'success' })
    } catch (err) {
      console.error('[delete-profile] FAILED —', err.message)
      setDeleting(false)
      setShowDeleteConfirm(false)
      setToast({ message: 'Something went wrong deleting your profile. Please contact us at hello@vetted.bb', type: 'error' })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
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

  const completenessItems = profile ? [
    { label: 'Profile photo', done: !!profile.avatar_url, weight: 30, action: () => setShowEditForm(true) },
    { label: 'Bio (min. 100 characters)', done: !!profile.bio && profile.bio.length >= 100, weight: 20, action: () => setShowEditForm(true) },
    { label: 'Add a service', done: services.some(s => s.name?.trim() && s.description?.trim()), weight: 20, action: () => setShowServiceForm(true) },
    { label: 'Location set', done: !!(profile.location?.trim()), weight: 10, action: () => setShowEditForm(true) },
    { label: 'Add 3+ skill tags', done: (profile.skills || []).length >= 3, weight: 10, action: () => setShowEditForm(true) },
    { label: 'Confirm availability', done: profile.available !== null && profile.available !== undefined, weight: 10, action: () => setShowEditForm(true) },
  ] : []
  const completenessScore = completenessItems.length > 0
    ? completenessItems.filter(i => i.done).reduce((sum, i) => sum + i.weight, 0)
    : 0
  const completenessBarColor = completenessScore >= 80 ? '#16a34a' : completenessScore >= 40 ? '#F9C000' : '#ef4444'
  const completenessLabel = completenessScore === 100 ? 'Profile complete'
    : completenessScore >= 80 ? 'Almost there!'
    : completenessScore >= 40 ? 'Getting there, a few more steps'
    : 'Incomplete: clients may not contact you'

  const clientReviews = reviews.filter(r => r.type === 'client')
  const freelancerReviews = reviews.filter(r => r.type === 'freelancer')

  return (
    <main className="min-h-screen bg-gray-50">
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
                      {f.min_price != null && (
                        <span className="text-xs font-medium text-gray-400">
                          From ${Number.isInteger(f.min_price) ? f.min_price : parseFloat(f.min_price).toFixed(0)}
                        </span>
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
                <h2 className="font-semibold text-gray-900">My messages <span className="text-gray-400 font-normal text-sm">({clientMessages.length})</span></h2>
              </div>
              <div className="divide-y divide-gray-50">
                {clientMessages.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-400">No messages yet. <a href="/search" style={{ color: '#00267F' }} className="font-medium hover:opacity-80">Browse freelancers →</a></p>
                  </div>
                ) : clientMessages.map(msg => (
                  <div key={msg.id}>
                    {/* Message row */}
                    <div
                      className="px-6 sm:px-8 py-5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => expandClientMessage(msg)}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                        {msg.freelancers?.avatar_url
                          ? <img src={msg.freelancers.avatar_url} alt={msg.freelancers.name} className="w-full h-full object-cover" />
                          : (msg.freelancers?.name || '?').split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{msg.freelancers?.name || 'Freelancer'}</p>
                          <span className="text-xs text-gray-400">{msg.freelancers?.trade}</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-0.5">{msg.subject}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        <span className="text-gray-300 text-sm">{expandedClientMsg === msg.id ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded thread */}
                    {expandedClientMsg === msg.id && (
                      <div className="px-6 sm:px-8 pb-6 border-t border-gray-50">

                        {/* Original message */}
                        <div className="mt-4 bg-gray-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your message</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-xs text-gray-400 mt-2">{new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        {/* Replies and quotes */}
                        {(clientThreadReplies[msg.id] || []).length > 0 && (
                          <div className="mt-3 flex flex-col gap-3">
                            {(clientThreadReplies[msg.id] || []).map(r => {
                              const isQuote = r.body.startsWith('__QUOTE__')
                              const quoteId = isQuote ? r.body.replace('__QUOTE__', '') : null
                              const quoteData = quoteId ? (clientThreadQuotes[quoteId] || null) : null

                              if (isQuote && quoteData) {
                                return (
                                  <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#00267F' }}>
                                      <div>
                                        <p className="text-white font-semibold text-sm">Quote {quoteData.quote_number}</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#93b8ff' }}>From {msg.freelancers?.name} · {new Date(quoteData.quote_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                      </div>
                                      <button
                                        onClick={() => setViewingClientQuote({ quote: quoteData, freelancer: msg.freelancers })}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                                        style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                                      >
                                        View & download
                                      </button>
                                    </div>
                                    <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                                      <div className="flex items-center gap-4">
                                        <div>
                                          <p className="text-xs text-gray-400">Total</p>
                                          <p className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(quoteData.total).toFixed(2)}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-400">Payment due</p>
                                          <p className="text-sm font-semibold text-gray-700">{new Date(quoteData.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                      </div>
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                                        {quoteData.status}
                                      </span>
                                    </div>
                                  </div>
                                )
                              }

                              return (
                                <div key={r.id} className="flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                                    {msg.freelancers?.avatar_url
                                      ? <img src={msg.freelancers.avatar_url} alt={msg.freelancers.name} className="w-full h-full object-cover" />
                                      : (msg.freelancers?.name || '?')[0]?.toUpperCase()}
                                  </div>
                                  <div className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3">
                                    <p className="text-xs font-semibold text-gray-700 mb-1">{r.sender_name}</p>
                                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                                    <p className="text-xs text-gray-400 mt-1.5">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {(clientThreadReplies[msg.id] || []).length === 0 && (
                          <p className="text-xs text-gray-400 mt-3 text-center">No replies yet</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : profile ? (
          <>
            {/* Profile completeness — first thing freelancers see */}
            {completenessScore < 100 && (
              <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <p className="text-sm font-semibold text-gray-900">Profile strength</p>
                  <p className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: completenessBarColor }}>{completenessScore}%</p>
                </div>
                <p className="text-xs mb-3 font-medium" style={{ color: completenessBarColor }}>{completenessLabel}</p>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${completenessScore}%`, backgroundColor: completenessBarColor }}
                  />
                </div>
                <div className="flex flex-col gap-2.5">
                  {completenessItems.filter(i => !i.done).map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="flex items-center gap-3 text-left w-full group"
                    >
                      <span className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: '#d1d5db' }} />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors flex-1">{item.label}</span>
                      <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-5 pt-4 border-t border-gray-100">
                  Complete profiles receive <span className="font-semibold text-gray-600">4× more client inquiries.</span>
                </p>
              </div>
            )}

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
                    onClick={async () => {
                      const newVal = !profile.available
                      const { error } = await supabase
                        .from('freelancers')
                        .update({ available: newVal })
                        .eq('user_id', user.id)
                      if (!error) {
                        setProfile(prev => ({ ...prev, available: newVal }))
                        setAvailable(newVal)
                        setToast({ message: newVal ? 'You are now available for work' : 'You are now marked as unavailable', type: 'success' })
                      }
                    }}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all text-center"
                    style={{
                      backgroundColor: profile.available ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.1)',
                      color: profile.available ? '#4ade80' : 'rgba(255,255,255,0.5)',
                      border: '1.5px solid',
                      borderColor: profile.available ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.2)'
                    }}
                  >
                    {profile.available ? '● Available' : '○ Unavailable'}
                  </button>
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

                  {/* Experience & Qualifications */}
                  <div className="flex flex-col gap-4 pt-1 pb-1">
                    <p className="text-sm font-semibold text-gray-700 -mb-1">Experience &amp; Qualifications</p>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Years of experience <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={yearsExperience}
                        onChange={e => setYearsExperience(e.target.value)}
                        placeholder="e.g. 8"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea
                        value={qualifications}
                        onChange={e => setQualifications(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder={"e.g. City & Guilds Electrical Installation, BSc Computer Science, Certified Personal Trainer (ACE)"}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">List any relevant certifications, diplomas, or degrees. Leave blank if not applicable.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                    >
                      <option value="">Select a category</option>
                      {["Trades & Construction","AC & Solar","Landscaping & Outdoors","Automotive","Cleaning & Domestic","Beauty & Wellness","Food & Catering","Sports & Fitness","Creative & Design","Technology","Events & Entertainment","Education & Tutoring","Business & Professional","Health & Care","Other"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5">This helps clients find you when browsing categories.</p>
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

            {/* Share profile */}
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 mb-0.5">Share your profile</p>
                <p className="text-xs text-gray-400 truncate">vetted-bb.vercel.app/freelancers/{profile.id}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://vetted-bb.vercel.app/freelancers/${profile.id}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="text-xs px-4 py-2 rounded-full border border-gray-200 font-medium text-gray-600 hover:border-gray-400 transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy link'}
                </button>
                <a
                  href={`https://wa.me/?text=Check out my profile on Vetted.bb: https://vetted-bb.vercel.app/freelancers/${profile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-4 py-2 rounded-full font-medium text-white"
                  style={{ backgroundColor: '#25D366' }}
                >
                  WhatsApp
                </a>
              </div>
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
                      {/* Price type toggle */}
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
                        <button
                          type="button"
                          onClick={() => setServicePriceType('fixed')}
                          className="flex-1 py-2.5 text-sm font-medium transition-colors"
                          style={servicePriceType === 'fixed'
                            ? { backgroundColor: '#00267F', color: 'white' }
                            : { backgroundColor: 'white', color: '#6b7280' }}
                        >
                          Fixed price
                        </button>
                        <button
                          type="button"
                          onClick={() => setServicePriceType('starting_from')}
                          className="flex-1 py-2.5 text-sm font-medium transition-colors border-l border-gray-200"
                          style={servicePriceType === 'starting_from'
                            ? { backgroundColor: '#00267F', color: 'white' }
                            : { backgroundColor: 'white', color: '#6b7280' }}
                        >
                          Starting from
                        </button>
                      </div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {servicePriceType === 'fixed' ? 'Price (BBD $)' : 'Starting from (BBD $)'}
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={servicePrice}
                        onChange={e => setServicePrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                      {servicePriceType === 'starting_from' && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          This tells clients your base price. The final cost may be higher depending on the job.
                        </p>
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
                        onChange={e => {
                          const opt = DURATION_OPTIONS.find(o => o.text === e.target.value)
                          setServiceDuration(e.target.value)
                          setServiceDurationMinutes(opt?.minutes ?? null)
                        }}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        {DURATION_OPTIONS.map(opt => (
                          <option key={opt.label} value={opt.text}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Work photos <span className="text-gray-400 font-normal">(optional, max 6)</span>
                      </label>
                      {(existingServiceImages.length > 0 || serviceImages.length > 0) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {existingServiceImages.map(img => (
                            <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                              <img src={img.url} alt="Work photo" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => handleRemoveExistingImage(img)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none hover:bg-red-600">×</button>
                            </div>
                          ))}
                          {serviceImages.map((img, i) => (
                            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                              <img src={img.url} alt="Work photo" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => handleRemoveNewImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none hover:bg-red-600">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {existingServiceImages.length + serviceImages.length < 6 && (
                        <label className={`flex items-center gap-2 cursor-pointer w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 transition-colors ${serviceImagesUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {serviceImagesUploading ? 'Uploading...' : 'Add photos of your work'}
                          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={serviceImagesUploading} onChange={handleServiceImageUpload} />
                        </label>
                      )}
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
                        {svc.description && <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{svc.description}</p>}
                        {svc.service_images?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">📷 {svc.service_images.length} photo{svc.service_images.length > 1 ? 's' : ''}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm font-bold" style={{ color: svc.price_type === 'starting_from' ? '#F59E0B' : '#00267F' }}>
                            {(() => {
                              const n = parseFloat(String(svc.price).replace(/[^0-9.]/g, ''))
                              if (isNaN(n)) return svc.price
                              const fmt = `$${Number.isInteger(n) ? n : n.toFixed(2)}`
                              return svc.price_type === 'starting_from' ? `${fmt}+` : fmt
                            })()}
                          </span>
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

            {/* Previous Work */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 sm:px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Previous Work</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Show examples of your past work to attract clients.</p>
                </div>
                {!showPortfolioForm && portfolioItems.length < 8 && (
                  <button
                    onClick={() => openPortfolioForm()}
                    className="text-white px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    + Add previous work
                  </button>
                )}
              </div>

              {/* Add / edit form */}
              {showPortfolioForm && (
                <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">{editingPortfolio ? 'Edit item' : 'New item'}</h3>
                  <form onSubmit={handlePortfolioSubmit} className="flex flex-col gap-4">

                    {/* Image upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Photo <span className="text-red-400">*</span></label>
                      {portfolioImageUrl ? (
                        <div className="relative inline-block">
                          <img src={portfolioImageUrl} alt="Preview" className="w-32 h-24 object-cover rounded-xl border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => setPortfolioImageUrl('')}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                          >×</button>
                        </div>
                      ) : (
                        <label className={`flex items-center gap-2 cursor-pointer w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 transition-colors ${portfolioImageUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {portfolioImageUploading ? 'Uploading...' : 'Upload a photo of your work'}
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={portfolioImageUploading} onChange={handlePortfolioImageUpload} />
                        </label>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={portfolioTitle}
                        onChange={e => setPortfolioTitle(e.target.value)}
                        placeholder="e.g. Kitchen renovation, St. James"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                      <textarea
                        maxLength={300}
                        value={portfolioDescription}
                        onChange={e => setPortfolioDescription(e.target.value)}
                        rows={2}
                        placeholder="e.g. Full kitchen fit-out including tiling, cabinets and electrical"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                      />
                    </div>

                    {portfolioError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{portfolioError}</p>}

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={portfolioSaving || portfolioImageUploading}
                        className="flex-1 text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        {portfolioSaving ? 'Saving...' : editingPortfolio ? 'Save changes' : 'Add item'}
                      </button>
                      <button
                        type="button"
                        onClick={closePortfolioForm}
                        className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Item list */}
              {portfolioItems.length === 0 && !showPortfolioForm ? (
                <div className="px-6 sm:px-8 py-8 text-center">
                  <p className="text-sm text-gray-400">No items yet. Add photos of your past work to help clients trust you.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {portfolioItems.map(item => (
                    <div key={item.id} className="px-6 sm:px-8 py-4 flex items-center gap-4">
                      <img src={item.image_url} alt={item.title} className="w-16 h-12 object-cover rounded-lg border border-gray-100 flex-shrink-0 cursor-pointer" onClick={() => setPortfolioLightbox(item)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openPortfolioForm(item)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handlePortfolioDelete(item.id)}
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

            {/* Availability */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 sm:px-8 py-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Availability calendar</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manage your busy blocks and control what clients see on your profile.</p>
              </div>
              <div className="px-6 sm:px-8 py-6">
                {profile && (
                  <AvailabilitySettings
                    freelancerId={profile.id}
                    services={services}
                    onToast={setToast}
                  />
                )}
              </div>
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
                        <p className="text-3xl font-bold text-gray-900">
                          {profile.min_price != null ? `$${Number.isInteger(profile.min_price) ? profile.min_price : parseFloat(profile.min_price).toFixed(0)}` : '—'}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">Starting from</p>
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
                                    {formatDisplayName(review.author)[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm">{formatDisplayName(review.author)}</p>
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
                                    {formatDisplayName(review.author)[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 text-sm">{formatDisplayName(review.author)}</p>
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
                      {clientReviewSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Review submitted. Thank you!</p>}

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

                      {/* Category */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
                        <select
                          value={createCategory}
                          onChange={e => setCreateCategory(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none bg-white"
                          onFocus={e => e.target.style.borderColor = '#00267F'}
                          onBlur={e => e.target.style.borderColor = ''}
                        >
                          <option value="">Select a category</option>
                          {["Trades & Construction","AC & Solar","Landscaping & Outdoors","Automotive","Cleaning & Domestic","Beauty & Wellness","Food & Catering","Sports & Fitness","Creative & Design","Technology","Events & Entertainment","Education & Tutoring","Business & Professional","Health & Care","Other"].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1.5">This helps clients find you when browsing categories.</p>
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
                                    <span className="text-sm font-semibold" style={{ color: svc.price_type === 'starting_from' ? '#F59E0B' : '#00267F' }}>
                                      {(() => {
                                        const n = parseFloat(String(svc.price).replace(/[^0-9.]/g, ''))
                                        if (isNaN(n)) return svc.price
                                        const fmt = `$${Number.isInteger(n) ? n : n.toFixed(2)}`
                                        return svc.price_type === 'starting_from' ? `${fmt}+` : fmt
                                      })()}
                                    </span>
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

                        {showCreateSvcForm && (
                          <div className="flex flex-col gap-3 pt-1">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Service name</label>
                              <input type="text" value={createSvcName} onChange={e => setCreateSvcName(e.target.value)} placeholder="e.g. Full house rewire" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white" onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''} />
                            </div>
                            <div>
                              {/* Price type toggle */}
                              <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2">
                                <button
                                  type="button"
                                  onClick={() => setCreateSvcPriceType('fixed')}
                                  className="flex-1 py-2 text-xs font-medium transition-colors"
                                  style={createSvcPriceType === 'fixed'
                                    ? { backgroundColor: '#00267F', color: 'white' }
                                    : { backgroundColor: 'white', color: '#6b7280' }}
                                >
                                  Fixed price
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCreateSvcPriceType('starting_from')}
                                  className="flex-1 py-2 text-xs font-medium transition-colors border-l border-gray-200"
                                  style={createSvcPriceType === 'starting_from'
                                    ? { backgroundColor: '#00267F', color: 'white' }
                                    : { backgroundColor: 'white', color: '#6b7280' }}
                                >
                                  Starting from
                                </button>
                              </div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {createSvcPriceType === 'fixed' ? 'Price (BBD $)' : 'Starting from (BBD $)'}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={createSvcPrice}
                                onChange={e => setCreateSvcPrice(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none bg-white"
                                onFocus={e => e.target.style.borderColor = '#00267F'} onBlur={e => e.target.style.borderColor = ''}
                              />
                              {createSvcPriceType === 'starting_from' && (
                                <p className="text-xs text-gray-500 mt-1">
                                  This tells clients your base price. The final cost may be higher depending on the job.
                                </p>
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
                              <button type="button" onClick={() => { setShowCreateSvcForm(false); setCreateSvcName(''); setCreateSvcPrice(''); setCreateSvcPriceType('fixed'); setCreateSvcDescription(''); setCreateSvcDuration('') }} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition-colors bg-white">Cancel</button>
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
                        <p className="text-sm font-semibold text-red-700 mb-1">Are you sure you want to delete your profile?</p>
                        <p className="text-sm text-red-600 mb-4">This cannot be undone. Your profile, services, messages, quotes, and reviews will all be permanently removed.</p>
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
                            {deleting ? 'Deleting...' : 'Yes, delete my profile'}
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Portfolio lightbox */}
      {portfolioLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPortfolioLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={portfolioLightbox.image_url}
              alt={portfolioLightbox.title}
              className="w-full rounded-xl object-contain max-h-[80vh]"
            />
            <div className="mt-3 text-center">
              <p className="text-white font-semibold">{portfolioLightbox.title}</p>
              {portfolioLightbox.description && <p className="text-gray-300 text-sm mt-1">{portfolioLightbox.description}</p>}
            </div>
            <button
              onClick={() => setPortfolioLightbox(null)}
              className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-white text-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}

      {/* Client quote viewer modal */}
      {viewingClientQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setViewingClientQuote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-screen overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {viewingClientQuote.freelancer?.avatar_url ? (
                  <img src={viewingClientQuote.freelancer.avatar_url} alt={viewingClientQuote.freelancer.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                    {(viewingClientQuote.freelancer?.name || '?').split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{viewingClientQuote.freelancer?.company_name || viewingClientQuote.freelancer?.name}</p>
                  <p className="text-sm text-gray-500">{viewingClientQuote.freelancer?.trade}</p>
                  <p className="text-xs text-gray-400">{viewingClientQuote.freelancer?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: '#00267F' }}>QUOTE</p>
                <p className="text-xs text-gray-400 mt-1">{viewingClientQuote.quote.quote_number}</p>
                <p className="text-xs text-gray-400">{new Date(viewingClientQuote.quote.quote_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="h-0.5 mb-6 rounded-full" style={{ backgroundColor: '#F9C000' }} />
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Billed to</p>
              <p className="font-semibold text-gray-900">{viewingClientQuote.quote.client_name}</p>
              <p className="text-sm text-gray-500">{viewingClientQuote.quote.client_email}</p>
            </div>
            <table className="w-full mb-6 text-sm">
              <thead>
                <tr style={{ backgroundColor: '#00267F' }}>
                  <th className="text-left px-3 py-2 text-white font-medium rounded-tl-lg text-xs">Description</th>
                  <th className="text-center px-3 py-2 text-white font-medium text-xs w-12">Qty</th>
                  <th className="text-right px-3 py-2 text-white font-medium text-xs w-20">Unit price</th>
                  <th className="text-right px-3 py-2 text-white font-medium rounded-tr-lg text-xs w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewingClientQuote.quote.items || []).map((item, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                    <td className="px-3 py-2 text-gray-700">{item.description || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{item.qty}</td>
                    <td className="px-3 py-2 text-gray-700 text-right">{item.price ? `$${parseFloat(item.price).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 text-right">
                      {item.price ? `$${((parseFloat(item.price)||0) * (parseInt(item.qty)||1)).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mb-6">
              <div className="w-48">
                <div className="flex justify-between py-2 border-t border-gray-200">
                  <span className="text-sm text-gray-500">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900">${Number(viewingClientQuote.quote.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-gray-900 mt-1">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(viewingClientQuote.quote.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#EEF2FF' }}>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">Payment due</p>
              <p className="text-sm font-bold" style={{ color: '#00267F' }}>{new Date(viewingClientQuote.quote.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            {viewingClientQuote.quote.notes && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-gray-600 leading-relaxed">{viewingClientQuote.quote.notes}</p>
              </div>
            )}
            <div className="border-t border-gray-100 pt-4 text-center mb-6">
              <p className="text-xs text-gray-400">Generated via <span className="font-semibold" style={{ color: '#00267F' }}>Vetted.bb</span> · Connecting Barbados</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setViewingClientQuote(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">
                Close
              </button>
              <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
