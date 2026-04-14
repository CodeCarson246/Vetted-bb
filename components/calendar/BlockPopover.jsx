'use client'
import { toAST } from './calUtils'

export default function BlockPopover({ block, onClose, onRemove, onEdit }) {
  if (!block) return null

  const start = toAST(new Date(block.start_time))
  const end = toAST(new Date(block.end_time))

  const dateLabel = start.toLocaleDateString('en-BB', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  const startTime = start.toLocaleTimeString('en-BB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const endTime = end.toLocaleTimeString('en-BB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 500 }}
      />

      {/* Popover card — centred on screen */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 600,
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        border: '1px solid rgba(0,38,127,0.1)',
        minWidth: '230px',
        maxWidth: '300px',
        width: 'calc(100vw - 48px)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{dateLabel}</p>
            {block.block_type === 'time_slot' && (
              <p style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                {startTime} – {endTime}
              </p>
            )}
            {block.block_type !== 'time_slot' && (
              <p style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '2px', textTransform: 'capitalize' }}>
                {block.block_type.replace('_', ' ')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              border: '1px solid #e5e7eb', background: 'white',
              cursor: 'pointer', fontSize: '16px', color: '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: '8px',
            }}
          >×</button>
        </div>

        {/* Private label */}
        {block.label && (
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #f3f4f6',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '14px',
            fontSize: '0.8rem',
            color: '#374151',
          }}>
            📝 {block.label}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onRemove}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px',
              border: '1.5px solid #fca5a5', background: 'white',
              color: '#dc2626', fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
          <button
            onClick={onEdit}
            style={{
              flex: 1, padding: '8px', borderRadius: '8px',
              border: '1.5px solid #e5e7eb', background: 'white',
              color: '#6B7280', fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </div>
      </div>
    </>
  )
}
