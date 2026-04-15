'use client'
import { useState, useEffect } from 'react'
import { formatDayHeader, formatHour, blockCoversCell, isToday } from './calUtils'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7am–9pm
const GRID_MINUTES = 14 * 60 // 7am–9pm = 840 min

export default function WeekView({ weekDays, blocks, isPublic, onCellClick }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  function getCellBlocks(day, hour) {
    return blocks.filter(b => blockCoversCell(b, day, hour))
  }

  // Current time line — AST = UTC-4
  const isCurrentWeek = weekDays.some(d => isToday(d))
  const astHour = (now.getUTCHours() - 4 + 24) % 24
  const astMinute = now.getUTCMinutes()
  const minutesSince7am = (astHour - 7) * 60 + astMinute
  const showTimeLine = isCurrentWeek && minutesSince7am >= 0 && minutesSince7am <= GRID_MINUTES
  const timeLineTop = (minutesSince7am / GRID_MINUTES) * 100

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

        {/* Hour rows — wrapped in relative container for the time line */}
        <div style={{ position: 'relative' }}>

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
                      borderLeft: hasBlock
                        ? '3px solid #EF4444'
                        : '1px solid rgba(0,38,127,0.06)',
                      backgroundColor: hasBlock
                        ? '#FEE2E2'
                        : today ? 'rgba(249,192,0,0.04)' : 'white',
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
                          today ? 'rgba(249,192,0,0.04)' : 'white'
                    }}
                  >
                    {hasBlock && !isPublic && topBlock?.label && (
                      <span style={{
                        fontSize: '0.62rem',
                        color: '#991B1B',
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

          {/* Current time line */}
          {showTimeLine && (
            <div
              style={{
                position: 'absolute',
                top: `${timeLineTop}%`,
                left: 0,
                right: 0,
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              {/* Dot on the left at the time-label boundary */}
              <div style={{
                position: 'absolute',
                left: 52,
                top: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#EF4444',
              }} />
              {/* Horizontal line spanning all day columns */}
              <div style={{
                marginLeft: 56,
                height: 2,
                backgroundColor: '#EF4444',
              }} />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
