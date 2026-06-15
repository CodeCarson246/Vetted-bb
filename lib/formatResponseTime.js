// Human "Typically replies within X" label from a median minutes value.
// Returns null when there's no usable number so callers can hide the badge.
export function formatResponseTime(minutes) {
  if (minutes == null || isNaN(Number(minutes))) return null
  const m = Number(minutes)
  if (m < 60) return `Typically replies within ${Math.max(1, Math.round(m))} min`
  if (m < 1440) return `Typically replies within ${Math.round(m / 60)} hr`
  const d = Math.round(m / 1440)
  return `Typically replies within ${d} day${d === 1 ? '' : 's'}`
}
