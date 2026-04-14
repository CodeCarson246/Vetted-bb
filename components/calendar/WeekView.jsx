'use client'
import { formatDayHeader, formatHour, blockCoversCell, isToday } from './calUtils'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7am–9pm

export default function WeekView({ weekDays, blocks, isPublic, onCellClick }) {
  function getCellBlocks(day, hour) {
    return blocks.filter(b => blockCoversCell(b, day, hour))
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: '560px' }}>

        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '56px repeat(7, 1fr)',
          borderBottom: '1px solid rgba(0,38,127,0.08)',
        }}>
          <div /> {/* empty time label column */}
          {weekDays.map((day, i) => {
            const today = isToday(day)
            return (
              <div
                key={i}
                style={{
                  padding: '10px 4px',
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: today ? '#00267F' : '#6B7280',
                  borderLeft: today
                    ? '3px solid #F9C000'
                    : '1px solid rgba(0,38,127,0.06)',
                  backgroundColor: today ? 'rgba(249,192,0,0.05)' : 'transparent',
                }}
              >
                {formatDayHeader(day)}
              </div>
            )
          })}
        </div>

        {/* Hour rows */}
        {HOURS.map(hour => (
          <div
            key={hour}
            style={{
              display: 'grid',
              gridTemplateColumns: '56px repeat(7, 1fr)',
              borderBottom: '1px solid rgba(0,38,127,0.04)',
            }}
          >
            {/* Time label */}
            <div style={{
              padding: '0 8px 0 0',
              display: 'flex',
              alignItems: 'flex-start',
              paddingTop: '3px',
              justifyContent: 'flex-end',
              minHeight: '38px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#9CA3AF', lineHeight: 1 }}>
                {formatHour(hour)}
              </span>
            </div>

            {/* Day cells */}
            {weekDays.map((day, i) => {
              const cellBlocks = getCellBlocks(day, hour)
              const hasBlock = cellBlocks.length > 0
              const topBlock = cellBlocks[0]
              const today = isToday(day)

              return (
                <div
                  key={i}
                  onClick={() => !isPublic && onCellClick && onCellClick(day, hour, topBlock || null)}
                  style={{
                    minHeight: '38px',
                    borderLeft: '1px solid rgba(0,38,127,0.06)',
                    backgroundColor: hasBlock
                      ? '#9CA3AF'
                      : today ? 'rgba(249,192,0,0.03)' : 'white',
                    cursor: isPublic ? 'default' : (hasBlock ? 'pointer' : 'cell'),
                    padding: '3px 5px',
                    transition: 'background-color 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!isPublic && !hasBlock)
                      e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.05)'
                  }}
                  onMouseLeave={e => {
                    if (!isPublic && !hasBlock)
                      e.currentTarget.style.backgroundColor =
                        today ? 'rgba(249,192,0,0.03)' : 'white'
                  }}
                >
                  {hasBlock && !isPublic && topBlock?.label && (
                    <span style={{
                      fontSize: '0.62rem',
                      color: 'white',
                      lineHeight: 1.3,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {topBlock.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
