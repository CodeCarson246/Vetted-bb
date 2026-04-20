const PARISH_MAP = {
  'saint andrew':  'St. Andrew',
  'saint george':  'St. George',
  'saint james':   'St. James',
  'saint john':    'St. John',
  'saint joseph':  'St. Joseph',
  'saint lucy':    'St. Lucy',
  'saint michael': 'St. Michael',
  'saint peter':   'St. Peter',
  'saint philip':  'St. Philip',
  'saint thomas':  'St. Thomas',
}

export function formatParish(parish) {
  if (!parish) return parish
  return PARISH_MAP[parish.toLowerCase()] ?? parish
}
