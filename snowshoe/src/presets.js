// Starting setups. Each sets the four rates and the orbits to release.

export const PRESETS = [
  {
    id: 'family',
    name: 'Nested orbits',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.5 },
    starts: [[28, 20], [36, 20], [50, 20], [70, 20], [95, 20]],
    note: 'Five populations that differ only in how many prey they start with. Each loops forever on its own closed orbit, and none of them settles down or spirals out. The outer loops swing harder and take longer to come round.',
  },
  {
    id: 'balance',
    name: 'Near the balance point',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.5 },
    starts: [[30, 20]],
    note: 'A small push away from the balance point gives a gentle, nearly elliptical loop with the period of the linearised equations, 2π over the square root of r·m. Predators peak a quarter cycle after prey.',
  },
  {
    id: 'boom',
    name: 'Boom and bust',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.5 },
    starts: [[5, 5]],
    note: 'Start with few of either. The prey explode before the predators catch up, then the predators crash the prey and starve in turn. Both spend most of the cycle near zero and recover from very small numbers.',
  },
  {
    id: 'hare-lynx',
    name: 'A ten-year cycle',
    params: { r: 0.6, a: 0.025, e: 0.5, m: 0.73 },
    starts: [[40, 10]],
    note: 'Rates chosen so that, with time in years, small swings take about nine and a half years, close to the roughly ten-year rise and fall of snowshoe hares and the lynx that hunt them in Canadian fur records.',
  },
  {
    id: 'slow-predators',
    name: 'Long-lived predators',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.2 },
    starts: [[30, 10]],
    note: 'Predators that die slowly keep eating long after the prey have collapsed, so the prey sit near zero for most of the cycle and the orbit hugs both axes.',
  },
  {
    id: 'adriatic',
    name: 'Fishing and the war',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.5, f: 0.3 },
    starts: [[45, 10]],
    note: "Fishing takes the same share of prey and predators. Drag the fishing effort down to zero, as when the First World War kept Adriatic boats in port: the balance point moves to fewer prey and more predators, and the predators' share of the catch rises. The hollow ring marks the unfished balance point.",
  },
  {
    id: 'crowded',
    name: 'Crowded prey',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.5, K: 100 },
    starts: [[60, 8], [10, 30]],
    note: 'Give the prey a carrying capacity of 100 and the closed loops become spirals that wind into the balance point. The endless cycles of the classical equations rely on prey that could grow without limit.',
  },
  {
    id: 'starved',
    name: 'Too little room',
    params: { r: 1, a: 0.05, e: 0.4, m: 0.5, K: 20 },
    starts: [[15, 10]],
    note: 'Predators need 25 prey to replace their deaths, but there is room for only 20. The predators dwindle away and the prey settle at their carrying capacity, marked on the axis.',
  },
];

export const RATE_SLIDERS = [
  { key: 'r', label: 'Prey birth rate', symbol: 'r', min: 0.1, max: 2, step: 0.01 },
  { key: 'a', label: 'Attack rate', symbol: 'a', min: 0.005, max: 0.1, step: 0.001 },
  { key: 'e', label: 'Prey eaten that become predators', symbol: 'e', min: 0.05, max: 1, step: 0.01 },
  { key: 'm', label: 'Predator death rate', symbol: 'm', min: 0.05, max: 1.5, step: 0.01 },
  { key: 'f', label: 'Fishing effort', symbol: 'f', min: 0, max: 1.2, step: 0.01 },
];
