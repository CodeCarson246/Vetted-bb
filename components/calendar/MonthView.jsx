'use client'
import { getMonthWeeks, blockCoversDay, isToday } from './calUtils'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function MonthView({ year, month, blocks, isPublic, onDayClick }) {
  const weeks = getMonthWeeks(year, month)

  function getDayBlocks(day) {
    return blocks.filter(b => blockCoversDay(b, day))
  }

  return (
    <div>
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid rgba(0,38,127,0.08)',
      }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{
            padding: '8px 4px',
            textAlign: 'center',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#9CA3AF',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {week.map((day, di) => {
            const dayBlocks = getDayBlocks(day)
            const hasBlocks = dayBlocks.length > 0
            const inMonth = day.getMonth() === month
            const today = isToday(day)

            return (
              <div
                key={di}
                onClick={() => onDayClick && onDayClick(day)}
                style={{
                  minHeight: '68px',
                  border: '1px solid rgba(0,38,127,0.06)',
                  backgroundColor: today
                    ? 'rgba(249,192,0,0.07)'
                    : hasBlocks ? 'rgba(239,68,68,0.06)' : 'white',
                  padding: '6px',
                  cursor: onDayClick ? 'pointer' : 'default',
                  opacity: inMonth ? 1 : 0.35,
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => {
                  if (onDayClick)
                    e.currentTarget.style.backgroundColor = today
                      ? 'rgba(249,192,0,0.12)'
                      : 'rgba(0,38,127,0.04)'
                }}
                onMouseLeave={e => {
                  if (onDayClick)
                    e.currentTarget.style.backgroundColor = today
                      ? 'rgba(249,192,0,0.07)'
                      : hasBlocks ? 'rgba(239,68,68,0.06)' : 'white'
                }}
              >
                {/* Day number */}
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: today ? '#F9C000' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: today ? 700 : 500,
                  color: today ? '#00267F' : (inMonth ? '#374151' : '#9CA3AF'),
                  marginBottom: '4px',
                }}>
                  {day.getDate()}
                </div>

                {/* Block indicators */}
                {hasBlocks && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    {dayBlocks.slice(0, 4).map((_, bi) => (
                      <div
                        key={bi}
                        style={{
                          height: 5,
                          flex: '1 1 auto',
                          minWidth: 5,
                          maxWidth: 16,
                          backgroundColor: '#EF4444',
                          borderRadius: '2px',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
