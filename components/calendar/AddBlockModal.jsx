'use client'
import { useState } from 'react'
import { astToUTC, toAST, getWeekStart, formatDurationMinutes } from './calUtils'

// 6:00am to 10:00pm in 30-min steps
const TIME_OPTIONS = []
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 22 && m > 0) break
    const period = h < 12 ? 'am' : 'pm'
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    const minStr = m === 0 ? '00' : String(m)
    TIME_OPTIONS.push({ hour: h, minute: m, label: `${display}:${minStr}${period}` })
  }
}

function todayStr() {
  const d = toAST(new Date())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const ws = getWeekStart(d)
  const we = new Date(ws); we.setDate(we.getDate() + 6)
  return `${ws.toLocaleDateString('en-BB', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-BB', { month: 'short', day: 'numeric' })}`
}

export default function AddBlockModal({
  open,
  onClose,
  defaultDate,
  freelancerId,
  services,
  blocks,
  onBlockAdd,
  onBlockRemove,
}) {
  const initDate = defaultDate
    ? `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`
    : todayStr()

  const [tab, setTab] = useState('time_slot')

  // Time slot tab
  const [date, setDate] = useState(initDate)
  const [startHour, setStartHour] = useState(9)
  const [startMinute, setStartMinute] = useState(0)
  const [endHour, setEndHour] = useState(10)
  const [endMinute, setEndMinute] = useState(0)
  const [label, setLabel] = useState('')
  const [serviceId, setServiceId] = useState('')

  // Full period tab
  const [periodScope, setPeriodScope] = useState('full_day')
  const [periodDate, setPeriodDate] = useState(initDate)
  const [periodLabel, setPeriodLabel] = useState('')

  // Clear tab
  const [clearConfirm, setClearConfirm] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const upcomingBlocks = [...(blocks || [])]
    .filter(b => new Date(b.end_time) > new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const servicesWithDuration = (services || []).filter(s => s.duration_minutes)

  function fillFromService(svcId) {
    setServiceId(svcId)
    const svc = (services || []).find(s => s.id === svcId)
    if (svc?.duration_minutes) {
      const total = startHour * 60 + startMinute + svc.duration_minutes
      setEndHour(Math.floor(total / 60) % 24)
      setEndMinute(total % 60)
    }
  }

  async function handleSaveTimeSlot() {
    setSaving(true); setError(null)
    const [y, mo, d] = date.split('-').map(Number)
    const startUTC = astToUTC(y, mo - 1, d, startHour, startMinute)
    const endUTC   = astToUTC(y, mo - 1, d, endHour,   endMinute)
    if (endUTC <= startUTC) {
      setError('End time must be after start time')
      setSaving(false)
      return
    }
    await onBlockAdd({
      freelancer_id: freelancerId,
      block_type: 'time_slot',
      start_time: startUTC.toISOString(),
      end_time:   endUTC.toISOString(),
      label:      label || null,
      service_id: serviceId || null,
    })
    setSaving(false)
    onClose()
  }

  async function handleSavePeriod() {
    setSaving(true); setError(null)
    const [y, mo, d] = periodDate.split('-').map(Number)
    let startUTC, endUTC, blockType

    if (periodScope === 'full_day') {
      blockType = 'full_day'
      startUTC = astToUTC(y, mo - 1, d, 0, 0)
      endUTC   = astToUTC(y, mo - 1, d, 23, 59)
    } else if (periodScope === 'full_week') {
      blockType = 'full_week'
      const base = new Date(periodDate + 'T12:00:00')
      const ws = getWeekStart(base)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      startUTC = astToUTC(ws.getFullYear(), ws.getMonth(), ws.getDate(), 0, 0)
      endUTC   = astToUTC(we.getFullYear(), we.getMonth(), we.getDate(), 23, 59)
    } else {
      blockType = 'full_month'
      startUTC = astToUTC(y, mo - 1, 1, 0, 0)
      const lastD = new Date(y, mo, 0).getDate()
      endUTC = astToUTC(y, mo - 1, lastD, 23, 59)
    }

    await onBlockAdd({
      freelancer_id: freelancerId,
      block_type: blockType,
      start_time: startUTC.toISOString(),
      end_time:   endUTC.toISOString(),
      label:      periodLabel || null,
    })
    setSaving(false)
    onClose()
  }

  async function handleClearAll() {
    if (!clearConfirm) { setClearConfirm(true); return }
    for (const b of upcomingBlocks) await onBlockRemove(b.id)
    setClearConfirm(false)
    onClose()
  }

  if (!open) return null

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid #e5e7eb', borderRadius: '8px',
    fontSize: '0.875rem', outline: 'none', color: '#374151',
    backgroundColor: 'white', boxSizing: 'border-box',
  }
  const labelStyle = {
    display: 'block', fontSize: '0.83rem',
    fontWeight: 600, color: '#374151', marginBottom: '6px',
  }
  const btnPrimary = {
    width: '100%', padding: '12px', borderRadius: '10px',
    backgroundColor: '#00267F', color: 'white',
    fontFamily: "'Sora', sans-serif", fontWeight: 600,
    fontSize: '0.9rem', border: 'none',
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.7 : 1,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px',
        maxWidth: '480px', width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
        padding: '28px 28px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        position: 'relative',
      }}>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: '50%',
            border: '1px solid #e5e7eb', background: 'white',
            cursor: 'pointer', fontSize: '18px', color: '#9CA3AF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        <h2 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700,
          fontSize: '1.05rem', color: '#00267F', marginBottom: '18px',
        }}>
          Add Availability Block
        </h2>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', flexWrap: 'wrap' }}>
          {[
            { id: 'time_slot',   label: 'Time slot' },
            { id: 'full_period', label: 'Day / Week / Month' },
            { id: 'clear',       label: 'Clear blocks' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px', borderRadius: '8px', fontSize: '0.8rem',
                fontWeight: 600, cursor: 'pointer', border: 'none',
                backgroundColor: tab === t.id ? '#00267F' : '#f3f4f6',
                color: tab === t.id ? 'white' : '#6B7280',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{
            color: '#dc2626', fontSize: '0.83rem',
            backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
          }}>{error}</p>
        )}

        {/* ── TIME SLOT TAB ── */}
        {tab === 'time_slot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Start time</label>
                <select
                  value={`${startHour}:${startMinute}`}
                  onChange={e => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    setStartHour(h); setStartMinute(m)
                  }}
                  style={inputStyle}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={`${t.hour}:${t.minute}`} value={`${t.hour}:${t.minute}`}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>End time</label>
                <select
                  value={`${endHour}:${endMinute}`}
                  onChange={e => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    setEndHour(h); setEndMinute(m)
                  }}
                  style={inputStyle}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={`${t.hour}:${t.minute}`} value={`${t.hour}:${t.minute}`}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {servicesWithDuration.length > 0 && (
              <div>
                <label style={labelStyle}>
                  Fill from a service{' '}
                  <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional — sets end time)</span>
                </label>
                <select value={serviceId} onChange={e => fillFromService(e.target.value)} style={inputStyle}>
                  <option value="">Select a service…</option>
                  {servicesWithDuration.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatDurationMinutes(s.duration_minutes)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>
                Private note{' '}
                <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(clients never see this)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="What's this for?"
                style={inputStyle}
              />
            </div>

            <button onClick={handleSaveTimeSlot} disabled={saving} style={btnPrimary}>
              {saving ? 'Saving…' : 'Block this time'}
            </button>
          </div>
        )}

        {/* ── FULL PERIOD TAB ── */}
        {tab === 'full_period' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Scope</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'full_day',   label: 'Full day' },
                  { id: 'full_week',  label: 'Full week' },
                  { id: 'full_month', label: 'Full month' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setPeriodScope(s.id)}
                    style={{
                      flex: 1, padding: '9px 4px', borderRadius: '8px',
                      border: periodScope === s.id ? '2px solid #00267F' : '1.5px solid #e5e7eb',
                      backgroundColor: periodScope === s.id ? '#EEF2FF' : 'white',
                      color: periodScope === s.id ? '#00267F' : '#6B7280',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                {periodScope === 'full_day'   ? 'Date' :
                 periodScope === 'full_week'  ? 'Any day in the week' :
                                               'Any day in the month'}
              </label>
              <input
                type="date"
                value={periodDate}
                onChange={e => setPeriodDate(e.target.value)}
                style={inputStyle}
              />
              {periodScope === 'full_week' && periodDate && (
                <p style={{ fontSize: '0.8rem', color: '#00267F', marginTop: '6px', fontWeight: 500 }}>
                  Week of {weekLabel(periodDate)}
                </p>
              )}
              {periodScope === 'full_month' && periodDate && (
                <p style={{ fontSize: '0.8rem', color: '#00267F', marginTop: '6px', fontWeight: 500 }}>
                  All of {new Date(periodDate + 'T12:00:00').toLocaleDateString('en-BB', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                Private note <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                placeholder="e.g. Holiday, Conference"
                style={inputStyle}
              />
            </div>

            <button onClick={handleSavePeriod} disabled={saving} style={btnPrimary}>
              {saving ? 'Saving…' : 'Block this period'}
            </button>
          </div>
        )}

        {/* ── CLEAR BLOCKS TAB ── */}
        {tab === 'clear' && (
          <div>
            {upcomingBlocks.length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', textAlign: 'center', padding: '28px 0' }}>
                No upcoming blocks to clear.
              </p>
            ) : (
              <>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  maxHeight: '280px', overflowY: 'auto', marginBottom: '16px',
                }}>
                  {upcomingBlocks.map(block => {
                    const start = toAST(new Date(block.start_time))
                    const end   = toAST(new Date(block.end_time))
                    return (
                      <div
                        key={block.id}
                        style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: '10px',
                          padding: '10px 12px', border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 500, color: '#374151' }}>
                            {start.toLocaleDateString('en-BB', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {block.block_type === 'time_slot' && (
                              <span style={{ color: '#6B7280', fontWeight: 400 }}>
                                {' '}· {start.toLocaleTimeString('en-BB', { hour: 'numeric', minute: '2-digit', hour12: true })}–{end.toLocaleTimeString('en-BB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </p>
                          {block.label && (
                            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '2px' }}>{block.label}</p>
                          )}
                          <p style={{ fontSize: '0.68rem', color: '#d1d5db', textTransform: 'capitalize' }}>
                            {block.block_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <button
                          onClick={() => onBlockRemove(block.id)}
                          style={{
                            padding: '6px 12px', borderRadius: '7px',
                            border: '1px solid #fecaca', backgroundColor: 'white',
                            color: '#dc2626', fontSize: '0.78rem', fontWeight: 600,
                            cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={handleClearAll}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '10px',
                    backgroundColor: clearConfirm ? '#dc2626' : 'white',
                    color: clearConfirm ? 'white' : '#dc2626',
                    border: `1.5px solid ${clearConfirm ? '#dc2626' : '#fca5a5'}`,
                    fontFamily: "'Sora', sans-serif", fontWeight: 600,
                    fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  {clearConfirm ? 'Confirm: clear all future blocks' : 'Clear all future blocks'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
