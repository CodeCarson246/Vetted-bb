'use client'
import { useState, useEffect, useRef } from 'react'
import { CATEGORIES } from '@/lib/categories'
import { PARISHES } from '@/lib/parishes'
import { formatParish } from '@/lib/formatParish'
import CategoryIcon from '@/components/CategoryIcon'
import { parsePrice } from '@/lib/price'
import { MIN_BIO_CHARS } from '@/lib/profileCompleteness'
import { BIO_STARTERS, fillStarter } from '@/lib/bioStarters'

/**
 * Guided profile setup.
 *
 * Replaces the old two-step create form, which asked for name, trade and
 * parish and let everything else be skipped — so most of the first profiles
 * went live with no bio and no priced service, which is no use to a client
 * and gets the professional no enquiries.
 *
 * Here each of the six essentials is its own screen, and Next stays disabled
 * until that one is answered. The point is not to nag: a live preview card
 * builds up beside the question as they type, so they can see the listing
 * they are making. Anyone who wants out can still "finish later" — the
 * profile is created from whatever they gave and the dashboard banner picks
 * it up — but the path of least resistance is now a complete profile.
 *
 * Used for a new profile (mode="create") and to fill the gaps in an existing
 * one (mode="finish"), which opens on the first unanswered question.
 */

const NAVY = '#00267F'
const GOLD = '#F9C000'



export default function ProfileSetup({
  mode = 'create',
  initial = {},
  startAt = null,
  onSave,
  onClose,
  saving = false,
  error = null,
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initial.name || '')
  const [companyName, setCompanyName] = useState(initial.company_name || '')
  const [trade, setTrade] = useState(initial.trade || '')
  const [category, setCategory] = useState(initial.category || '')
  const [location, setLocation] = useState(initial.location || '')
  const [bio, setBio] = useState(initial.bio || '')
  const [svcName, setSvcName] = useState('')
  const [svcPrice, setSvcPrice] = useState('')
  const [svcType, setSvcType] = useState('fixed')
  const [leaving, setLeaving] = useState(false)
  const liveRef = useRef(null)

  // In "finish" mode, open on the first thing still missing rather than
  // making someone page through answers they already gave.
  useEffect(() => {
    if (startAt != null) setStep(startAt)
  }, [startAt])

  const priced = parsePrice(svcPrice)
  const alreadyHasPricedService = !!initial.hasPricedService

  const steps = [
    {
      key: 'name',
      eyebrow: 'First things first',
      question: 'What is your name?',
      why: 'Clients hire people. Your name sits at the top of your profile.',
      valid: () => name.trim().length > 1,
      nudge: 'Pop your name in to carry on.',
    },
    {
      key: 'trade',
      eyebrow: 'Your work',
      question: 'What do you do?',
      why: 'Two or three words. This is the line under your name everywhere on the site.',
      valid: () => trade.trim().length > 1,
      nudge: 'Tell us your trade to carry on.',
    },
    {
      key: 'category',
      eyebrow: 'Your work',
      question: 'Which of these fits best?',
      why: 'It decides which browse page you turn up on.',
      valid: () => !!category,
      nudge: 'Pick the one closest to what you do.',
    },
    {
      key: 'location',
      eyebrow: 'Where you are',
      question: 'Which parish?',
      why: 'Most people look for someone near them.',
      valid: () => !!location,
      nudge: 'Choose your parish to carry on.',
    },
    {
      key: 'bio',
      eyebrow: 'Your story',
      question: 'Tell clients about your work',
      why: 'A few honest lines. How long you have done this, and what you are good at.',
      valid: () => bio.trim().length >= MIN_BIO_CHARS,
      nudge: `A little more detail. ${MIN_BIO_CHARS} characters at least.`,
    },
    {
      key: 'service',
      eyebrow: 'The important one',
      question: 'What is one thing you do, and what does it cost?',
      why: 'A price is the difference between an enquiry and a scroll past. You can add more services later.',
      valid: () => alreadyHasPricedService || (svcName.trim().length > 1 && priced !== null && priced > 0),
      nudge: 'A name and a price above zero.',
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1
  const canAdvance = current.valid()
  const answered = steps.filter(s => s.valid()).length
  const percent = Math.round((answered / steps.length) * 100)

  // Move focus to the question on each step so a screen reader and a keyboard
  // user both land in the right place.
  useEffect(() => { liveRef.current?.focus() }, [step])

  function next() {
    if (!canAdvance) return
    if (isLast) return submit(true)
    setStep(s => Math.min(s + 1, steps.length - 1))
  }

  function submit(complete) {
    onSave({
      name: name.trim(),
      company_name: companyName.trim() || null,
      trade: trade.trim(),
      category: category || null,
      location: location || '',
      bio: bio.trim(),
      service: (svcName.trim() && priced !== null && priced > 0)
        ? { name: svcName.trim(), price: svcPrice.trim(), price_type: svcType }
        : null,
      complete,
    })
  }

  function applyStarter(line) {
    const text = fillStarter(line, trade)
    setBio(b => (b.trim() ? `${b.trim()} ${text} ` : `${text} `))
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 400, backgroundColor: 'rgba(0,16,54,0.72)', backdropFilter: 'blur(3px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Set up your profile"
    >
      <style>{`
        @keyframes psIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes psPop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .ps-step { animation: psIn 0.28s ease both; }
        .ps-chip { transition: transform 0.12s ease, border-color 0.12s ease, background-color 0.12s ease; }
        .ps-chip:hover { transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) {
          .ps-step, .ps-chip { animation: none; transition: none; }
        }
      `}</style>

      <div className="min-h-full flex items-start sm:items-center justify-center p-0 sm:p-6">
        <div
          className="w-full sm:rounded-3xl overflow-hidden shadow-2xl"
          style={{ maxWidth: 980, minHeight: '100vh', maxHeight: 'none', backgroundColor: 'var(--surface-card)' }}
        >
          <div className="flex flex-col lg:flex-row" style={{ minHeight: '100vh' }}>

            {/* ── Left: the question ── */}
            <div className="flex-1 flex flex-col p-6 sm:p-10 lg:p-12">

              {/* Progress */}
              <div className="flex items-center gap-3 mb-8">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-card)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percent}%`, backgroundColor: GOLD }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color: '#6B7280' }}>
                  {answered} of {steps.length}
                </span>
                <button
                  type="button"
                  onClick={() => setLeaving(true)}
                  className="text-xs font-medium px-2 py-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>

              <div key={step} className="ps-step flex-1 flex flex-col justify-center py-4">
                <span className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
                  {current.eyebrow}
                </span>
                <h2
                  ref={liveRef}
                  tabIndex={-1}
                  className="text-2xl sm:text-3xl font-bold mb-2 outline-none"
                  style={{ fontFamily: "'Sora', sans-serif", color: 'var(--accent)', textWrap: 'balance' }}
                >
                  {current.question}
                </h2>
                <p className="text-sm mb-7 leading-relaxed" style={{ color: 'var(--muted)', maxWidth: '48ch' }}>
                  {current.why}
                </p>

                <div className="flex flex-col gap-4">
                  {current.key === 'name' && (
                    <>
                      <Field
                        label="Your name"
                        value={name}
                        onChange={setName}
                        placeholder="e.g. Jeremy Foster"
                        autoFocus
                        onEnter={next}
                      />
                      <Field
                        label="Business name"
                        optional
                        value={companyName}
                        onChange={setCompanyName}
                        placeholder="e.g. Foster's Landscaping"
                        onEnter={next}
                      />
                    </>
                  )}

                  {current.key === 'trade' && (
                    <Field
                      label="Your trade"
                      value={trade}
                      onChange={setTrade}
                      placeholder="e.g. Landscaper"
                      autoFocus
                      onEnter={next}
                    />
                  )}

                  {current.key === 'category' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {CATEGORIES.map(cat => {
                        const on = category === cat.name
                        return (
                          <button
                            key={cat.slug}
                            type="button"
                            onClick={() => setCategory(cat.name)}
                            aria-pressed={on}
                            className="ps-chip flex flex-col items-center gap-2 px-3 py-4 rounded-2xl text-center"
                            style={{
                              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-card)'}`,
                              backgroundColor: on ? 'var(--selected-fill)' : 'var(--surface-card)',
                              color: on ? 'var(--accent)' : 'var(--muted)',
                              cursor: 'pointer',
                            }}
                          >
                            <CategoryIcon slug={cat.slug} size={26} />
                            <span
                              className="text-xs font-semibold leading-snug"
                              style={{ color: on ? 'var(--accent)' : 'var(--muted)' }}
                            >
                              {cat.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {current.key === 'location' && (
                    <div className="flex flex-wrap gap-2">
                      {PARISHES.map(p => {
                        const on = location === p
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setLocation(p)}
                            aria-pressed={on}
                            className="ps-chip px-4 py-2.5 rounded-full text-sm font-semibold"
                            style={{
                              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-card)'}`,
                              backgroundColor: on ? NAVY : 'var(--surface-card)',
                              color: on ? '#fff' : 'var(--foreground)',
                              cursor: 'pointer',
                            }}
                          >
                            {formatParish(p)}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {current.key === 'bio' && (
                    <>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        rows={6}
                        autoFocus
                        spellCheck="true"
                        placeholder="What you do, how long you have been doing it, and what clients can expect."
                        className="w-full px-4 py-3.5 rounded-xl outline-none resize-none leading-relaxed"
                        style={{ border: '1.5px solid var(--border-card)', backgroundColor: 'var(--surface-card)', color: 'var(--foreground)' }}
                        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border-card)' }}
                      />
                      <div className="flex items-center justify-between gap-3 -mt-1">
                        <span className="text-xs tabular-nums" style={{ color: bio.trim().length >= MIN_BIO_CHARS ? '#16a34a' : 'var(--muted)' }}>
                          {bio.trim().length >= MIN_BIO_CHARS
                            ? 'That works'
                            : `${MIN_BIO_CHARS - bio.trim().length} more characters`}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Stuck? Tap one to start a sentence</p>
                        <div className="flex flex-wrap gap-2">
                          {BIO_STARTERS.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => applyStarter(s)}
                              className="ps-chip text-xs px-3 py-2 rounded-full text-left"
                              style={{ border: '1px solid var(--border-card)', backgroundColor: 'var(--row-stripe)', color: 'var(--muted)', cursor: 'pointer' }}
                            >
                              {fillStarter(s, trade)}…
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {current.key === 'service' && (
                    <>
                      {alreadyHasPricedService ? (
                        <div className="rounded-xl px-4 py-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-sm font-semibold" style={{ color: '#166534' }}>You already have a priced service listed.</p>
                          <p className="text-xs mt-1" style={{ color: '#15803d' }}>Add another here if you like, or finish and manage them all from your dashboard.</p>
                        </div>
                      ) : null}
                      <Field
                        label="Service"
                        value={svcName}
                        onChange={setSvcName}
                        placeholder="e.g. Lawn maintenance"
                        autoFocus={!alreadyHasPricedService}
                      />
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>Price</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none"
                              style={{ color: 'var(--muted)' }}
                            >
                              Bds$
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={svcPrice}
                              onChange={e => setSvcPrice(e.target.value)}
                              placeholder="50"
                              className="w-full pl-14 pr-4 py-3 rounded-xl outline-none"
                              style={{ border: '1.5px solid var(--border-card)', backgroundColor: 'var(--surface-card)', color: 'var(--foreground)' }}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border-card)' }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-1">
                          {[
                            { v: 'fixed', label: 'Fixed price', hint: 'It costs this' },
                            { v: 'starting_from', label: 'Starting from', hint: 'It starts here' },
                          ].map(opt => {
                            const on = svcType === opt.v
                            return (
                              <button
                                key={opt.v}
                                type="button"
                                onClick={() => setSvcType(opt.v)}
                                aria-pressed={on}
                                className="ps-chip flex-1 px-4 py-3 rounded-xl text-left"
                                style={{
                                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-card)'}`,
                                  backgroundColor: on ? 'var(--selected-fill)' : 'var(--surface-card)',
                                  cursor: 'pointer',
                                }}
                              >
                                <span className="block text-sm font-semibold" style={{ color: on ? 'var(--accent)' : 'var(--muted)' }}>{opt.label}</span>
                                <span className="block text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{opt.hint}</span>
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                          Not sure? Use “Starting from”. You can change it any time, and every job is quoted properly anyway.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-6">{error}</p>
              )}

              {/* Nav */}
              <div className="flex items-center gap-3 mt-8 pt-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    className="px-5 py-3 rounded-xl font-medium"
                    style={{ border: '1.5px solid var(--border-card)', backgroundColor: 'var(--surface-card)', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  disabled={!canAdvance || saving}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white transition-opacity"
                  style={{
                    backgroundColor: NAVY,
                    opacity: canAdvance && !saving ? 1 : 0.35,
                    cursor: canAdvance && !saving ? 'pointer' : 'not-allowed',
                  }}
                >
                  {saving ? 'Saving…' : isLast ? (mode === 'finish' ? 'Save and finish ✓' : 'Publish my profile ✓') : 'Next →'}
                </button>
              </div>
              {!canAdvance && (
                <p className="text-xs mt-3 text-center" style={{ color: 'var(--muted)' }}>{current.nudge}</p>
              )}
            </div>

            {/* ── Right: live preview ── */}
            {/* Watching the card fill in is the point, so on a phone it sits
                ABOVE the question rather than below the fold. */}
            <div
              className="ps-preview-col order-first lg:order-none lg:w-[360px] flex-shrink-0 px-6 py-5 sm:p-8 flex flex-col gap-4"
              style={{ backgroundColor: 'var(--page-bg)', borderBottom: '1px solid var(--border-card)' }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Live preview</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>How you will look in search.</p>
              </div>

              <PreviewCard
                name={name}
                companyName={companyName}
                trade={trade}
                location={location}
                bio={bio}
                svcName={svcName}
                svcPrice={svcPrice}
                svcType={svcType}
              />

              <ul className="hidden lg:flex flex-col gap-1.5 mt-1">
                {steps.map((s, i) => {
                  const ok = s.valid()
                  return (
                    <li key={s.key} className="flex items-center gap-2.5">
                      <span
                        className="flex items-center justify-center rounded-full flex-shrink-0 text-[11px] font-bold"
                        style={{
                          width: 18, height: 18,
                          backgroundColor: ok ? '#16a34a' : 'var(--border-card)',
                          color: ok ? '#fff' : 'var(--muted)',
                          animation: ok ? 'psPop 0.3s ease' : 'none',
                        }}
                      >
                        {ok ? '✓' : i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(i)}
                        className="text-xs font-medium text-left hover:opacity-70 transition-opacity"
                        style={{
                          color: ok ? 'var(--foreground)' : 'var(--muted)',
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        }}
                      >
                        {s.key === 'name' ? 'Name' : s.key === 'trade' ? 'Trade'
                          : s.key === 'category' ? 'Category' : s.key === 'location' ? 'Parish'
                          : s.key === 'bio' ? 'About you' : 'A priced service'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Leaving early. Not a guilt trip: say what is missing and let them go. */}
      {leaving && (
        <div className="fixed inset-0 z-10 flex items-center justify-center p-5" style={{ backgroundColor: 'rgba(0,16,54,0.5)' }}>
          <div className="rounded-2xl p-6 w-full" style={{ maxWidth: 420, backgroundColor: 'var(--surface-card)' }}>
            <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--accent)' }}>
              Leave setup for now?
            </h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--muted)' }}>
              {answered < steps.length
                ? 'Your profile will go live with what you have given so far, and your dashboard will show what is left. Profiles without a price get far fewer enquiries, so it is worth coming back.'
                : 'Everything is answered. You can save it now.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setLeaving(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-white"
                style={{ backgroundColor: NAVY, cursor: 'pointer' }}
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => { setLeaving(false); mode === 'finish' ? onClose() : submit(false) }}
                className="flex-1 py-3 rounded-xl font-medium"
                style={{ border: '1.5px solid var(--border-card)', backgroundColor: 'var(--surface-card)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                {mode === 'finish' ? 'Close' : 'Finish later'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, optional, value, onChange, placeholder, autoFocus, onEnter }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
        {label}{optional && <span className="font-normal" style={{ color: 'var(--muted)' }}> (optional)</span>}
      </label>
      <input
        type="text"
        value={value}
        spellCheck="true"
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 rounded-xl outline-none"
        style={{ border: '1.5px solid var(--border-card)', backgroundColor: 'var(--surface-card)', color: 'var(--foreground)' }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border-card)' }}
      />
    </div>
  )
}

/** The search-result card, drawn from what they have typed so far. */
function PreviewCard({ name, companyName, trade, location, bio, svcName, svcPrice, svcType }) {
  const initials = (name || '?').trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const price = parsePrice(svcPrice)
  const shown = price !== null && price > 0

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-card)', borderTop: `4px solid ${NAVY}`, boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
          style={{ width: 44, height: 44, backgroundColor: GOLD, color: NAVY }}
        >
          {initials === '?' ? '' : initials}
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate" style={{ color: 'var(--foreground)' }}>
            {name.trim() || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>Your name</span>}
          </p>
          {companyName.trim() && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{companyName.trim()}</p>}
          <p className="text-xs truncate capitalize" style={{ color: 'var(--muted)' }}>
            {trade.trim() || <span style={{ color: 'var(--muted)', opacity: 0.5 }}>Your trade</span>}
            {location ? ` · ${formatParish(location)}` : ''}
          </p>
        </div>
      </div>

      <span
        className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: 'var(--row-stripe)', color: 'var(--muted)' }}
      >
        No reviews yet
      </span>

      {bio.trim()
        ? <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {bio.trim().slice(0, 140)}{bio.trim().length > 140 ? '…' : ''}
          </p>
        : <p className="text-xs italic" style={{ color: 'var(--muted)', opacity: 0.5 }}>Your description appears here.</p>}

      <div className="pt-2.5 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border-card)' }}>
        <span className="text-xs truncate" style={{ color: 'var(--muted)', opacity: svcName.trim() ? 1 : 0.5 }}>
          {svcName.trim() || 'Your first service'}
        </span>
        {shown
          ? <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>
              From Bds${Number.isInteger(price) ? price : price.toFixed(2)}{svcType === 'starting_from' ? '+' : ''}
            </span>
          : <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--muted)', opacity: 0.5 }}>No price</span>}
      </div>
    </div>
  )
}
