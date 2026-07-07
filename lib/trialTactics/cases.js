// ============================================================
// Trial Tactics — case content & statement options
//
// Scoring model (hidden from players):
//   - Each statement moves jurors toward the SPEAKER's side.
//   - `base` is the raw persuasive strength (points).
//   - `affects` maps a juror personality -> multiplier on that base.
//       multiplier > 1  : that personality is especially persuaded
//       multiplier < 1  : that personality barely moves
//       multiplier < 0  : it BACKFIRES (juror moves toward the opponent)
//   - Jurors with a personality not listed in `affects` use 1.0.
// ============================================================

export const PERSONALITIES = [
  'Logical',
  'Emotional',
  'Strict',
  'Suspicious',
  'Fair-Minded',
  'Impatient',
]

export const CATEGORIES = [
  'Evidence-based',
  'Emotional',
  'Logical',
  'Aggressive',
  'Technical',
  'Speculative',
]

// Objection -> the statement category it counters well.
export const OBJECTION_COUNTERS = {
  Speculation: 'Speculative',
  Irrelevant: 'Emotional',
  Misleading: 'Technical',
  Badgering: 'Aggressive',
  Hearsay: 'Evidence-based',
}

export const OBJECTION_TYPES = Object.keys(OBJECTION_COUNTERS)

// 10-turn standard trial. role = who acts on that turn.
export const TURNS = [
  { n: 1,  role: 'prosecution', phase: 'Opening Statement' },
  { n: 2,  role: 'defence',     phase: 'Opening Statement' },
  { n: 3,  role: 'prosecution', phase: 'Presents Evidence' },
  { n: 4,  role: 'defence',     phase: 'Challenges Evidence' },
  { n: 5,  role: 'prosecution', phase: 'Questions Witness' },
  { n: 6,  role: 'defence',     phase: 'Cross-Examines Witness' },
  { n: 7,  role: 'prosecution', phase: 'Builds Motive' },
  { n: 8,  role: 'defence',     phase: 'Creates Reasonable Doubt' },
  { n: 9,  role: 'prosecution', phase: 'Closing Argument' },
  { n: 10, role: 'defence',     phase: 'Closing Argument' },
]

export const CASES = {
  missing_laptop: {
    id: 'missing_laptop',
    title: 'The Missing Laptop',
    summary:
      'A laptop went missing from a shared office at approximately 5:30 p.m. Security footage shows the accused leaving the office shortly after the laptop disappeared. The accused claims they were only collecting their bag and did not see the laptop. One witness says they saw the accused near the desk earlier that day, but another employee says several people had access to the office.',
    prosecutionTheory:
      'The accused had opportunity, was seen near the desk, and left shortly after the laptop disappeared.',
    defenceTheory:
      'The evidence is circumstantial, no one saw the accused take the laptop, and several people had access.',
  },
}

// Statement options for every turn (4 each).
// id is "<turn>-<index>".
export const STATEMENTS = {
  // ---- Turn 1: Prosecution Opening ----
  1: [
    {
      id: '1-1',
      text: 'The accused was seen leaving the office shortly after the laptop disappeared. That timing matters.',
      category: 'Logical',
      base: 9,
      affects: { Logical: 1.6, Suspicious: 1.3, Impatient: 1.2 },
      reaction: 'The logical jurors lock onto the timeline.',
    },
    {
      id: '1-2',
      text: 'A theft in a shared office is a betrayal of everyone who works there. Someone broke that trust.',
      category: 'Emotional',
      base: 8,
      affects: { Emotional: 1.7, 'Fair-Minded': 1.1, Logical: 0.5 },
      reaction: 'The emotional jurors feel the breach of trust.',
    },
    {
      id: '1-3',
      text: 'The evidence will show opportunity, presence, and timing all pointing in one direction.',
      category: 'Evidence-based',
      base: 9,
      affects: { Strict: 1.4, Logical: 1.3, Suspicious: 1.2 },
      reaction: 'The strict jurors note the promise of hard evidence.',
    },
    {
      id: '1-4',
      text: 'Frankly, anyone can see the accused is guilty — the rest is just detail.',
      category: 'Aggressive',
      base: 7,
      affects: { 'Fair-Minded': -1.4, Strict: -0.6, Impatient: 1.1 },
      reaction: 'The fair-minded jurors recoil at the overreach.',
    },
  ],

  // ---- Turn 2: Defence Opening ----
  2: [
    {
      id: '2-1',
      text: 'The footage only shows the accused leaving. It does not show them taking anything.',
      category: 'Logical',
      base: 9,
      affects: { Logical: 1.6, Strict: 1.4, Suspicious: 0.8 },
      reaction: 'The logical jurors register the gap in the footage.',
    },
    {
      id: '2-2',
      text: 'Several people had access to the same room, so opportunity alone is not proof.',
      category: 'Evidence-based',
      base: 9,
      affects: { Strict: 1.5, Logical: 1.3, Suspicious: 1.1 },
      reaction: 'The strict jurors weigh the burden of proof.',
    },
    {
      id: '2-3',
      text: 'My client went to work, did their job, and went home. They are an ordinary person, not a thief.',
      category: 'Emotional',
      base: 8,
      affects: { Emotional: 1.7, 'Fair-Minded': 1.2, Logical: 0.5 },
      reaction: 'The emotional jurors warm to the human picture.',
    },
    {
      id: '2-4',
      text: 'The prosecution is desperate and twisting the facts.',
      category: 'Aggressive',
      base: 7,
      affects: { 'Fair-Minded': -1.5, Strict: -0.5, Impatient: 1.0 },
      reaction: 'The fair-minded jurors dislike the aggressive tone.',
    },
  ],

  // ---- Turn 3: Prosecution Presents Evidence ----
  3: [
    {
      id: '3-1',
      text: 'The footage does not show the theft, but it places the accused at the centre of the timeline.',
      category: 'Evidence-based',
      base: 10,
      affects: { Logical: 1.5, Strict: 1.3, Suspicious: 1.3 },
      reaction: 'The suspicious jurors fixate on the timeline placement.',
    },
    {
      id: '3-2',
      text: 'Access logs confirm the accused badged into the office at 5:28 p.m., minutes before the laptop vanished.',
      category: 'Technical',
      base: 10,
      affects: { Logical: 1.5, Strict: 1.4, Emotional: 0.6 },
      reaction: 'The logical jurors latch onto the badge record.',
    },
    {
      id: '3-3',
      text: 'Picture the victim returning to an empty desk, work gone, trust shattered.',
      category: 'Emotional',
      base: 8,
      affects: { Emotional: 1.7, 'Fair-Minded': 1.0, Logical: 0.5 },
      reaction: 'The emotional jurors picture the victim.',
    },
    {
      id: '3-4',
      text: 'Maybe the accused sold it online — that is exactly the kind of thing they would do.',
      category: 'Speculative',
      base: 6,
      affects: { Suspicious: 1.2, Strict: -1.2, 'Fair-Minded': -1.0, Logical: -0.5 },
      reaction: 'The strict jurors reject the unfounded guess.',
    },
  ],

  // ---- Turn 4: Defence Challenges Evidence ----
  4: [
    {
      id: '4-1',
      text: 'A badge record proves the accused was at work. It does not prove they touched the laptop.',
      category: 'Logical',
      base: 10,
      affects: { Logical: 1.6, Strict: 1.4, Suspicious: 0.8 },
      reaction: 'The logical jurors separate presence from theft.',
    },
    {
      id: '4-2',
      text: 'The footage has a four-minute gap during which any of six keyholders could have entered.',
      category: 'Technical',
      base: 10,
      affects: { Logical: 1.4, Strict: 1.4, Suspicious: 1.1 },
      reaction: 'The strict jurors note the unaccounted four minutes.',
    },
    {
      id: '4-3',
      text: 'The prosecution shows you a clock and asks you to imagine a crime. Imagination is not evidence.',
      category: 'Evidence-based',
      base: 9,
      affects: { Strict: 1.5, Logical: 1.3, 'Fair-Minded': 1.1 },
      reaction: 'The fair-minded jurors appreciate the restraint.',
    },
    {
      id: '4-4',
      text: 'The whole investigation is sloppy and the prosecutor knows it.',
      category: 'Aggressive',
      base: 7,
      affects: { 'Fair-Minded': -1.4, Strict: -0.6, Impatient: 1.0 },
      reaction: 'The fair-minded jurors bristle at the swipe.',
    },
  ],

  // ---- Turn 5: Prosecution Questions Witness ----
  5: [
    {
      id: '5-1',
      text: 'The witness confirms they saw the accused leaning over that exact desk earlier in the day.',
      category: 'Evidence-based',
      base: 10,
      affects: { Suspicious: 1.5, Logical: 1.2, Strict: 1.1 },
      reaction: 'The suspicious jurors note the accused at the desk.',
    },
    {
      id: '5-2',
      text: 'Walk us through it: badge in at 5:28, alone by the desk at 5:30, gone by 5:33. A clean sequence.',
      category: 'Logical',
      base: 10,
      affects: { Logical: 1.6, Impatient: 1.3, Emotional: 0.6 },
      reaction: 'The impatient jurors like the tight, clear sequence.',
    },
    {
      id: '5-3',
      text: 'The witness was shaken — they know what they saw, and it frightened them.',
      category: 'Emotional',
      base: 8,
      affects: { Emotional: 1.6, 'Fair-Minded': 0.9, Logical: 0.5 },
      reaction: 'The emotional jurors feel the witness’s unease.',
    },
    {
      id: '5-4',
      text: 'You were near the desk, so you must have taken it — just admit it.',
      category: 'Aggressive',
      base: 7,
      affects: { 'Fair-Minded': -1.5, Strict: -0.7, Suspicious: 1.0 },
      reaction: 'The fair-minded jurors dislike the badgering.',
    },
  ],

  // ---- Turn 6: Defence Cross-Examines Witness ----
  6: [
    {
      id: '6-1',
      text: 'You saw my client near a desk in a busy office. Did you ever see them hold a laptop? No.',
      category: 'Logical',
      base: 10,
      affects: { Logical: 1.6, Strict: 1.3, Suspicious: 0.9 },
      reaction: 'The logical jurors note the witness saw no laptop.',
    },
    {
      id: '6-2',
      text: 'You testified from memory weeks later, across a crowded room, at the end of a long day. Correct?',
      category: 'Technical',
      base: 9,
      affects: { Strict: 1.4, Logical: 1.3, Emotional: 0.7 },
      reaction: 'The strict jurors weigh the witness’s reliability.',
    },
    {
      id: '6-3',
      text: 'My client has sat here, accused, while their whole life is judged on a glance across an office.',
      category: 'Emotional',
      base: 9,
      affects: { Emotional: 1.7, 'Fair-Minded': 1.2, Logical: 0.5 },
      reaction: 'The emotional jurors feel for the accused.',
    },
    {
      id: '6-4',
      text: 'Isn’t it true you have a grudge against my client and would say anything?',
      category: 'Speculative',
      base: 6,
      affects: { Suspicious: 1.2, 'Fair-Minded': -1.2, Strict: -1.1 },
      reaction: 'The strict jurors dismiss the unsupported motive.',
    },
  ],

  // ---- Turn 7: Prosecution Builds Motive ----
  7: [
    {
      id: '7-1',
      text: 'The accused was passed over for a raise that week — resentment is a powerful motive.',
      category: 'Logical',
      base: 9,
      affects: { Suspicious: 1.5, Logical: 1.2, Emotional: 1.0 },
      reaction: 'The suspicious jurors seize on the motive.',
    },
    {
      id: '7-2',
      text: 'Opportunity, presence, and now motive. Each strand is thin; together they make a rope.',
      category: 'Logical',
      base: 10,
      affects: { Logical: 1.6, Strict: 1.2, Impatient: 1.2 },
      reaction: 'The logical jurors see the strands tie together.',
    },
    {
      id: '7-3',
      text: 'A hardworking team was robbed by one of their own. That betrayal deserves an answer.',
      category: 'Emotional',
      base: 8,
      affects: { Emotional: 1.7, 'Fair-Minded': 1.0, Logical: 0.5 },
      reaction: 'The emotional jurors want accountability.',
    },
    {
      id: '7-4',
      text: 'People like the accused always feel entitled to take what isn’t theirs.',
      category: 'Speculative',
      base: 6,
      affects: { Suspicious: 1.1, 'Fair-Minded': -1.4, Strict: -1.2 },
      reaction: 'The fair-minded jurors reject the sweeping claim.',
    },
  ],

  // ---- Turn 8: Defence Creates Reasonable Doubt ----
  8: [
    {
      id: '8-1',
      text: 'Six people held keys. The prosecution investigated one and ignored the other five.',
      category: 'Logical',
      base: 11,
      affects: { Logical: 1.6, Strict: 1.5, Suspicious: 1.1 },
      reaction: 'The strict jurors see the uninvestigated alternatives.',
    },
    {
      id: '8-2',
      text: 'There is no laptop, no fingerprints, no sale, no confession. There is a clock and a guess.',
      category: 'Evidence-based',
      base: 11,
      affects: { Strict: 1.6, Logical: 1.4, Impatient: 1.2 },
      reaction: 'The impatient jurors note how little there really is.',
    },
    {
      id: '8-3',
      text: 'If you have any reasonable doubt, the law — and your conscience — require acquittal.',
      category: 'Logical',
      base: 10,
      affects: { Strict: 1.6, 'Fair-Minded': 1.3, Emotional: 0.9 },
      reaction: 'The strict jurors respond to the burden of proof.',
    },
    {
      id: '8-4',
      text: 'My client is honest and would never steal.',
      category: 'Emotional',
      base: 5,
      affects: { Emotional: 1.2, Logical: -0.6, Strict: -0.8, Suspicious: -0.4 },
      reaction: 'The logical jurors shrug at the bare assertion.',
    },
  ],

  // ---- Turn 9: Prosecution Closing ----
  9: [
    {
      id: '9-1',
      text: 'Badge in, alone at the desk, gone in five minutes, and a motive. The timeline only fits one person.',
      category: 'Logical',
      base: 11,
      affects: { Logical: 1.6, Suspicious: 1.3, Impatient: 1.2 },
      reaction: 'The logical jurors find the timeline decisive.',
    },
    {
      id: '9-2',
      text: 'Every piece — access logs, the witness, the motive — points the same way. That is proof beyond reasonable doubt.',
      category: 'Evidence-based',
      base: 11,
      affects: { Strict: 1.5, Logical: 1.4, 'Fair-Minded': 1.0 },
      reaction: 'The strict jurors weigh the converging evidence.',
    },
    {
      id: '9-3',
      text: 'A team was hurt and they are counting on you to do what is right.',
      category: 'Emotional',
      base: 9,
      affects: { Emotional: 1.7, 'Fair-Minded': 1.1, Logical: 0.5 },
      reaction: 'The emotional jurors feel the weight of the verdict.',
    },
    {
      id: '9-4',
      text: 'Don’t let a slick defence lawyer trick you — convict.',
      category: 'Aggressive',
      base: 7,
      affects: { 'Fair-Minded': -1.5, Strict: -0.7, Impatient: 1.1 },
      reaction: 'The fair-minded jurors resent the manipulation.',
    },
  ],

  // ---- Turn 10: Defence Closing ----
  10: [
    {
      id: '10-1',
      text: 'They never put a laptop in my client’s hands. A timeline is not a theft.',
      category: 'Logical',
      base: 11,
      affects: { Logical: 1.6, Strict: 1.4, Impatient: 1.2 },
      reaction: 'The logical jurors hold the line on the missing proof.',
    },
    {
      id: '10-2',
      text: 'Five other keyholders, a four-minute gap, no physical evidence. That is reasonable doubt, plainly.',
      category: 'Evidence-based',
      base: 11,
      affects: { Strict: 1.6, Logical: 1.4, Suspicious: 1.0 },
      reaction: 'The strict jurors settle on reasonable doubt.',
    },
    {
      id: '10-3',
      text: 'To convict on a guess is to risk punishing an innocent person. Be sure — and you cannot be.',
      category: 'Logical',
      base: 10,
      affects: { Strict: 1.5, 'Fair-Minded': 1.4, Emotional: 1.1 },
      reaction: 'The fair-minded jurors take the warning to heart.',
    },
    {
      id: '10-4',
      text: 'The prosecutor should be ashamed of this flimsy case.',
      category: 'Aggressive',
      base: 7,
      affects: { 'Fair-Minded': -1.5, Strict: -0.6, Impatient: 1.0 },
      reaction: 'The fair-minded jurors dislike the parting jab.',
    },
  ],
}

export function getStatementById(id) {
  for (const turn of Object.keys(STATEMENTS)) {
    const found = STATEMENTS[turn].find((s) => s.id === id)
    if (found) return found
  }
  return null
}
