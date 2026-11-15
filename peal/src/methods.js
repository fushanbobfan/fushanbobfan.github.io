// A small library of methods, with the place notation for one lead.
// stage: number of bells. hunt: the bell whose path repeats every lead.
// calls: the change a bob or a single puts in place of the lead's last change.

export const METHODS = [
  {
    id: 'plain-hunt-doubles',
    name: 'Plain Hunt Doubles',
    stage: 5,
    notation: '5.1.5.1.5.1.5.1.5.1',
    hunt: 1,
    note: 'Every bell weaves from the front to the back and down again, one place per row. No bell ever stops: the simplest pattern there is.',
  },
  {
    id: 'plain-hunt-minor',
    name: 'Plain Hunt Minor',
    stage: 6,
    notation: 'x16x16x16x16x16x16',
    hunt: 1,
    note: 'Plain hunting on six. Two bells meet and cross at the back, then at the front, and the pattern comes round after twelve rows.',
  },
  {
    id: 'plain-bob-doubles',
    name: 'Plain Bob Doubles',
    stage: 5,
    notation: '5.1.5.1.5,125',
    calls: { bob: '145', single: '123' },
    hunt: 1,
    note: 'The treble plain hunts. When it leads, the bell in second place makes a place and the others dodge, so the working bells swap jobs each lead.',
  },
  {
    id: 'grandsire-doubles',
    name: 'Grandsire Doubles',
    stage: 5,
    notation: '3,1.5.1.5.1',
    hunt: 1,
    note: 'Two bells hunt: the treble, and the second, which follows the same path two rows behind it. Thirds place is made at every lead end.',
  },
  {
    id: 'stedman-doubles',
    name: 'Stedman Doubles',
    stage: 5,
    notation: '3.1.5.3.1.3.1.3.5.1.3.1',
    hunt: null,
    note: 'Built from sixes: blocks of six rows in which the front three bells ring every order of themselves, alternately forwards and backwards, while the back bells dodge. No bell plain hunts.',
  },
  {
    id: 'plain-bob-minor',
    name: 'Plain Bob Minor',
    stage: 6,
    notation: 'x16x16x16,12',
    calls: { bob: '14', single: '1234' },
    hunt: 1,
    note: 'The method most ringers learn first on six bells: plain hunting, with seconds place and a dodge whenever the treble leads.',
  },
  {
    id: 'cambridge-surprise-minor',
    name: 'Cambridge Surprise Minor',
    stage: 6,
    notation: 'x36x14x12x36x14x56,12',
    calls: { bob: '14', single: '1234' },
    hunt: 1,
    note: 'Places made inside the row while the treble moves between them: the first surprise method most bands ring. The working bells make long runs of dodges and places.',
  },
  {
    id: 'plain-bob-major',
    name: 'Plain Bob Major',
    stage: 8,
    notation: 'x18x18x18x18,12',
    calls: { bob: '14', single: '1234' },
    hunt: 1,
    note: 'Plain Bob on eight bells: seven leads of sixteen rows, so 112 rows before rounds returns.',
  },
  {
    id: 'grandsire-triples',
    name: 'Grandsire Triples',
    stage: 7,
    notation: '3,1.7.1.7.1.7.1',
    hunt: 1,
    note: 'Grandsire on seven bells, usually rung with the tenor covering behind. The plain course has five leads of fourteen rows.',
  },
  {
    id: 'cambridge-surprise-major',
    name: 'Cambridge Surprise Major',
    stage: 8,
    notation: 'x38x14x1258x36x14x58x16x78,12',
    calls: { bob: '14', single: '1234' },
    hunt: 1,
    note: 'Cambridge extended to eight bells. Its plain course is 224 rows long.',
  },
];

export function methodById(id) {
  return METHODS.find((m) => m.id === id) ?? METHODS[0];
}

export const STAGE_NAMES = { 4: 'Minimus', 5: 'Doubles', 6: 'Minor', 7: 'Triples', 8: 'Major' };
