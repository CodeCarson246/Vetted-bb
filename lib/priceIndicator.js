export function getPriceIndicator(rate) {
  const r = parseFloat(rate)
  if (!rate || r === 0) return ''
  if (r < 30) return '$'
  if (r < 60) return '$$'
  if (r < 100) return '$$$'
  return '$$$$'
}
