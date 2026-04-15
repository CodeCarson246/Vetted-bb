'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { nowAST, getWeekStart, getWeekDays, MONTHS } from './calUtils'
import WeekView from './WeekView'
import MonthView from './MonthView'
import AddBlockModal from './AddBlockModal'
import BlockPopover from './BlockPopover'

export default function AvailabilitySettings({ freelancerId, services, onToast }) {
  const [settings, setSettings] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)

  // Calendar UI state
  const [calView, setCalView] = useState('week')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(nowAST()))
  const [calMonth, setCalMonth] = useState(() => {
    const n = nowAST()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const weekDays = getWeekDays(weekStart)

  // Modal / popover state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(null)
  const [popoverBlock, setPopoverBlock] = useState(null)
  const [editingBlock, setEditingBlock] = useState(null)

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => {
    if (!freelancerId) return
    async function load() {
      setLoading(true)

      // Upsert default settings on first visit
      const { data: existing } = await supabase
        .from('availability_settings')
        .select('*')
        .eq('freelancer_id', freelancerId)
        .single()

      if (existing) {
        setSettings(existing)
      } else {
        const { data: created } = await supabase
          .from('availability_settings')
          .upsert(
            { freelancer_id: freelancerId, mode: 'calendar', show_on_profile: true },
            { onConflict: 'freelancer_id' },
          )
          .select()
          .single()
        setSettings(created)
      }

      const { data: b } = await supabase
        .from('availability_blocks')
        .select('*')
        .eq('freelancer_id', freelancerId)
        .order('start_time', { ascending: true })
      console.log('[AvailabilitySettings] blocks fetched:', b)
      setBlocks(b || [])

      setLoading(false)
    }
    load()
  }, [freelancerId])

  // ── Settings persistence ────────────────────────────────────
  async function updateSettings(patch) {
    const optimistic = { ...settings, ...patch }
    setSettings(optimistic)
    const { error } = await supabase
      .from('availability_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('freelancer_id', freelancerId)
    if (error) onToast?.({ message: 'Failed to save settings', type: 'error' })
  }

  // ── Block mutations (optimistic) ────────────────────────────
  async function handleBlockAdd(payload) {
    const tempId = `temp-${Date.now()}`
    setBlocks(prev => [...prev, { ...payload, id: tempId }])

    const { data, error } = await supabase
      .from('availability_blocks')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setBlocks(prev => prev.filter(b => b.id !== tempId))
      onToast?.({ message: 'Failed to add block: ' + error.message, type: 'error' })
    } else {
      setBlocks(prev => prev.map(b => b.id === tempId ? data : b))
      onToast?.({ message: 'Block added', type: 'success' })
    }
  }

  async function handleBlockRemove(blockId) {
    const removed = blocks.find(b => b.id === blockId)
    setBlocks(prev => prev.filter(b => b.id !== blockId))
    setPopoverBlock(null)

    const { error } = await supabase
      .from('availability_blocks')
      .delete()
      .eq('id', blockId)

    if (error) {
      if (removed) setBlocks(prev => [...prev, removed].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)))
      onToast?.({ message: 'Failed to remove block', type: 'error' })
    } else {
      onToast?.({ message: 'Block removed', type: 'success' })
    }
  }

  // ── Cell / day click handlers ───────────────────────────────
  function handleCellClick(day, _hour, existingBlock) {
    if (existingBlock) {
      setPopoverBlock(existingBlock)
    } else {
      setModalDate(day)
      setModalOpen(true)
    }
  }

  function handleDayClickMonth(day) {
    setWeekStart(getWeekStart(day))
    setCalView('week')
  }

  // ── Navigation ──────────────────────────────────────────────
  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d)
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d)
  }
  function prevMonth() {
    setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 })
  }
  function nextMonth() {
    setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 })
  }

  // ── Skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[160, 60, 360].map((h, i) => (
          <div
            key={i}
            style={{
              height: h, borderRadius: '12px', backgroundColor: '#f3f4f6',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    )
  }

  const navLabel = calView === 'week'
    ? `Week of ${weekDays[0].toLocaleDateString('en-BB', { month: 'short', day: 'numeric' })}`
    : `${MONTHS[calMonth.month]} ${calMonth.year}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Mode switcher ────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        border: '1px solid rgba(0,38,127,0.08)', padding: '20px',
      }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
          Availability mode
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { id: 'available', title: 'Just show me as available',  desc: 'Clients see a green badge. No calendar shown.' },
            { id: 'calendar',  title: 'Manage my calendar',         desc: 'Add busy blocks so clients see your real availability.' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => updateSettings({ mode: opt.id })}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                border: settings?.mode === opt.id ? '2px solid #00267F' : '1.5px solid #e5e7eb',
                backgroundColor: settings?.mode === opt.id ? '#EEF2FF' : 'white',
                textAlign: 'left', width: '100%',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                border: `2px solid ${settings?.mode === opt.id ? '#00267F' : '#d1d5db'}`,
                backgroundColor: settings?.mode === opt.id ? '#00267F' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {settings?.mode === opt.id && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'white' }} />
                )}
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: settings?.mode === opt.id ? '#00267F' : '#374151' }}>
                  {opt.title}
                </p>
                <p style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {settings?.mode === 'available' && (
          <div style={{
            marginTop: '14px', padding: '12px 16px',
            backgroundColor: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
            <p style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 500 }}>
              You are currently showing as available to all clients.
            </p>
          </div>
        )}
      </div>

      {/* ── Show on profile toggle ───────────────────────────── */}
      {settings?.mode === 'calendar' && (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          border: '1px solid rgba(0,38,127,0.08)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Show my calendar on my public profile
            </p>
            <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px' }}>
              Clients see busy/free blocks — never your private notes
            </p>
          </div>
          <button
            onClick={() => updateSettings({ show_on_profile: !settings.show_on_profile })}
            aria-label="Toggle public calendar"
            style={{
              width: 44, height: 24, borderRadius: '999px', flexShrink: 0,
              cursor: 'pointer', border: 'none',
              backgroundColor: settings.show_on_profile ? '#00267F' : '#d1d5db',
              position: 'relative', transition: 'background-color 0.2s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', backgroundColor: 'white',
              position: 'absolute', top: 3,
              left: settings.show_on_profile ? 23 : 3,
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }} />
          </button>
        </div>
      )}

      {/* ── Calendar ─────────────────────────────────────────── */}
      {settings?.mode === 'calendar' && (
        <div style={{
          backgroundColor: 'white', borderRadius: '16px',
          borderTop: '4px solid #00267F',
          boxShadow: '0 2px 12px rgba(0,38,127,0.08)',
          overflow: 'hidden',
        }}>

          {/* Calendar toolbar */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(0,38,127,0.08)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
          }}>
            {/* Week / Month toggle */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['week', 'month'].map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  style={{
                    padding: '6px 14px', borderRadius: '7px', fontSize: '0.8rem',
                    fontWeight: 600, cursor: 'pointer', border: 'none',
                    backgroundColor: calView === v ? '#00267F' : '#f3f4f6',
                    color: calView === v ? 'white' : '#6B7280',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Prev / label / Next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={calView === 'week' ? prevWeek : prevMonth}
                style={{
                  width: 30, height: 30, borderRadius: '7px',
                  border: '1.5px solid #e5e7eb', background: 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.9rem', color: '#374151',
                }}
              >←</button>
              <span style={{
                fontSize: '0.82rem', fontWeight: 600, color: '#374151',
                minWidth: '150px', textAlign: 'center',
              }}>
                {navLabel}
              </span>
              <button
                onClick={calView === 'week' ? nextWeek : nextMonth}
                style={{
                  width: 30, height: 30, borderRadius: '7px',
                  border: '1.5px solid #e5e7eb', background: 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.9rem', color: '#374151',
                }}
              >→</button>
            </div>

            {/* Add block button */}
            <button
              onClick={() => { setModalDate(null); setModalOpen(true) }}
              style={{
                padding: '7px 14px', borderRadius: '8px',
                backgroundColor: '#F9C000', color: '#00267F',
                fontFamily: "'Sora', sans-serif", fontWeight: 600,
                fontSize: '0.8rem', border: 'none', cursor: 'pointer',
              }}
            >
              + Add block
            </button>
          </div>

          {/* Legend */}
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(0,38,127,0.06)',
            display: 'flex', gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Busy</span>
            </div>
          </div>

          {/* Grid */}
          {calView === 'week' ? (
            <WeekView
              weekDays={weekDays}
              blocks={blocks}
              isPublic={false}
              onCellClick={handleCellClick}
            />
          ) : (
            <MonthView
              year={calMonth.year}
              month={calMonth.month}
              blocks={blocks}
              isPublic={false}
              onDayClick={handleDayClickMonth}
            />
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      <AddBlockModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingBlock(null) }}
        defaultDate={modalDate}
        freelancerId={freelancerId}
        services={services}
        blocks={blocks}
        onBlockAdd={handleBlockAdd}
        onBlockRemove={handleBlockRemove}
      />

      {popoverBlock && (
        <BlockPopover
          block={popoverBlock}
          onClose={() => setPopoverBlock(null)}
          onRemove={() => handleBlockRemove(popoverBlock.id)}
          onEdit={() => {
            setEditingBlock(popoverBlock)
            setModalDate(null)
            setModalOpen(true)
            setPopoverBlock(null)
          }}
        />
      )}
    </div>
  )
}
