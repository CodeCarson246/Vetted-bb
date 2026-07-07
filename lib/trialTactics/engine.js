// ============================================================
// Trial Tactics — pure game engine
// No React, no Supabase. Deterministic helpers the UI calls and
// then persists. Keeping this isolated makes the rules testable.
// ============================================================

import { PERSONALITIES, OBJECTION_COUNTERS, TURNS } from './cases.js'

// Juror score is a continuous value from -100 (Strongly Defence)
// to +100 (Strongly Prosecution). Positive = prosecution.
export const LEANINGS = [
  { key: 'strong_def', label: 'Strongly Defence',  max: -60, color: '#1e3a8a' }, // dark blue
  { key: 'lean_def',   label: 'Leaning Defence',    max: -20, color: '#60a5fa' }, // light blue
  { key: 'undecided',  label: 'Undecided',          max:  20, color: '#9ca3af' }, // grey
  { key: 'lean_pro',   label: 'Leaning Prosecution', max:  60, color: '#f87171' }, // light red
  { key: 'strong_pro', label: 'Strongly Prosecution', max: 101, color: '#b91c1c' }, // dark red
]

export function leaningOf(score) {
  for (const l of LEANINGS) {
    if (score < l.max) return l
  }
  return LEANINGS[LEANINGS.length - 1]
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

// Build the balanced starting jury:
// 2 leaning prosecution, 2 leaning defence, 8 undecided.
// Personalities are spread evenly (2 of each of the 6 types).
export function createInitialJurors() {
  const personalities = []
  for (const p of PERSONALITIES) personalities.push(p, p) // 12 total
  // light shuffle by a fixed pattern so it looks varied but stays balanced
  const order = [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11]

  const startScores = [
    35, 35, // 2 leaning prosecution
    -35, -35, // 2 leaning defence
    0, 0, 0, 0, 0, 0, 0, 0, // 8 undecided
  ]

  return Array.from({ length: 12 }, (_, i) => {
    const score = startScores[i]
    return {
      id: i + 1,
      personality: personalities[order[i]],
      score,
      confidence: Math.round(Math.abs(score)),
    }
  })
}

// Apply a statement to the jury. `direction` is +1 for prosecution,
// -1 for defence. `weight` scales the whole effect (used to dampen a
// statement that was successfully objected to). Returns a new jurors
// array plus a `swing` = net movement toward the speaker (signed).
export function applyStatement(jurors, statement, role, weight = 1) {
  const direction = role === 'prosecution' ? 1 : -1
  let swing = 0
  const next = jurors.map((j) => {
    const mult = statement.affects?.[j.personality] ?? 1
    const delta = direction * statement.base * mult * weight
    const newScore = clamp(j.score + delta, -100, 100)
    swing += direction * (newScore - j.score) // toward speaker
    return { ...j, score: newScore, confidence: Math.round(Math.abs(newScore)) }
  })
  return { jurors: next, swing: Math.round(swing) }
}

// Evaluate an objection against the pending statement.
// Returns { effective, weight, credibilityHit, message }.
//   effective    : true if the objection counters the statement's category
//   weight       : multiplier to apply to the statement's impact (1 = full)
//   credibilityHit: small jury shift toward the OPPONENT of the objector
export function evaluateObjection(objectionType, statement) {
  const counters = OBJECTION_COUNTERS[objectionType]
  const effective = counters === statement.category
  if (effective) {
    return {
      effective: true,
      weight: 0.4, // sustained: opponent's statement loses 60% of its punch
      credibilityHit: 0,
      message: `Objection — ${objectionType}! Sustained. The argument loses much of its force.`,
    }
  }
  return {
    effective: false,
    weight: 1,
    credibilityHit: 4, // overruled: objector looks rash, small shift away
    message: `Objection — ${objectionType}? Overruled. The interruption costs the objector a little credibility.`,
  }
}

// A weak/overruled objection nudges a few jurors toward the opponent
// of the objector (objectorRole is who objected).
export function applyCredibilityHit(jurors, objectorRole, amount) {
  const direction = objectorRole === 'prosecution' ? -1 : 1 // toward opponent
  return jurors.map((j, i) => {
    if (i % 3 !== 0) return j // only nudge ~a third of the jury
    const newScore = clamp(j.score + direction * amount, -100, 100)
    return { ...j, score: newScore, confidence: Math.round(Math.abs(newScore)) }
  })
}

export function countLeanings(jurors) {
  let pro = 0
  let def = 0
  let undecided = 0
  for (const j of jurors) {
    if (j.score >= 20) pro++
    else if (j.score <= -20) def++
    else undecided++
  }
  return { pro, def, undecided }
}

// Final verdict from the jury at the end of turn 10.
export function computeVerdict(jurors) {
  const { pro, def, undecided } = countLeanings(jurors)
  let verdict
  let winner
  if (pro >= 9) {
    verdict = 'Guilty'
    winner = 'prosecution'
  } else if (pro >= 7) {
    verdict = 'Hung Jury'
    winner = 'none'
  } else {
    verdict = 'Not Guilty'
    winner = 'defence'
  }
  return { verdict, winner, pro, def, undecided }
}

// Strongest / weakest move from statement history.
// Each history entry carries { role, playerName, statementText, swing }.
export function analyzeMoves(history) {
  if (!history || history.length === 0) {
    return { strongest: null, weakest: null }
  }
  let strongest = history[0]
  let weakest = history[0]
  for (const h of history) {
    if (h.swing > strongest.swing) strongest = h
    if (h.swing < weakest.swing) weakest = h
  }
  return { strongest, weakest }
}

export function roleForTurn(turn) {
  const t = TURNS.find((x) => x.n === turn)
  return t ? t.role : 'prosecution'
}

export function otherRole(role) {
  return role === 'prosecution' ? 'defence' : 'prosecution'
}
