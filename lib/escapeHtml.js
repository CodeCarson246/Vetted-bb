/**
 * Escape a string for safe interpolation into HTML (email templates,
 * generated documents). Never render user-supplied text into HTML
 * without passing it through this.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
