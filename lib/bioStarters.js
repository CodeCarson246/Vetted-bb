/**
 * Opening lines offered under the bio box in the guided setup, so nobody
 * faces an empty textarea. Tapping one drops it in; they finish the sentence.
 *
 * Kept out of the component so the grammar can be tested: "an electrician"
 * reads as care, "a electrician" reads as a bug, and the trade is whatever
 * the professional typed a moment earlier.
 */
export const BIO_STARTERS = [
  'I have been working as {a} {trade} in Barbados for',
  'I take on both small jobs and bigger projects, and I pride myself on',
  'Clients come to me for',
]

export function fillStarter(line, trade) {
  const word = (trade || 'professional').trim().toLowerCase()
  const article = /^[aeiou]/.test(word) ? 'an' : 'a'
  return line.replace('{a}', article).replace('{trade}', word)
}
