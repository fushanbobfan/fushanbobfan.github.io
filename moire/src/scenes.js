import { makeLayer } from './gratings.js';

// Positions are offsets from the middle of the view, in CSS pixels, so a scene
// looks the same on any screen. Angles are in degrees here for readability.
export const SCENES = [
  {
    id: 'turned',
    name: 'Two gratings, one turned',
    note: 'Equal bars, the top sheet turned by 5°. The fringes run almost at right angles to the bars, and turning the sheet further packs them closer.',
    layers: [
      { kind: 'lines', period: 8, angle: 0, duty: 0.5 },
      { kind: 'lines', period: 8, angle: 5, duty: 0.5 },
    ],
  },
  {
    id: 'vernier',
    name: 'Vernier: slightly different spacings',
    note: 'Bars 10 px and 10.5 px apart, parallel. Slide the top sheet sideways with the arrow keys: the fringes travel twenty times as far.',
    layers: [
      { kind: 'lines', period: 10, angle: 0, duty: 0.5 },
      { kind: 'lines', period: 10.5, angle: 0, duty: 0.5 },
    ],
  },
  {
    id: 'two-centres',
    name: 'Two sets of rings',
    note: 'Rings around two centres 80 px apart. Hyperbolas fan out on both sides like the bright lines of two-source interference; ellipses wrap the space between the centres.',
    layers: [
      { kind: 'rings', period: 10, dx: -40, dy: 0, duty: 0.5 },
      { kind: 'rings', period: 10, dx: 40, dy: 0, duty: 0.5 },
    ],
  },
  {
    id: 'concentric',
    name: 'Rings in rings',
    note: 'Rings 10 px and 11 px apart around the same centre beat into broad rings 110 px apart. Drag the top sheet off centre and they turn into a pattern of crescents.',
    layers: [
      { kind: 'rings', period: 10, duty: 0.5 },
      { kind: 'rings', period: 11, duty: 0.5 },
    ],
  },
  {
    id: 'rings-lines',
    name: 'Rings over straight bars',
    note: 'The fringes gather where the rings run nearly parallel to the bars with nearly the same spacing, the way a zone plate focuses light.',
    layers: [
      { kind: 'lines', period: 10, angle: 0, duty: 0.5 },
      { kind: 'rings', period: 10, duty: 0.5 },
    ],
  },
  {
    id: 'dots-turned',
    name: 'Dot screens, one turned',
    note: 'Two square screens of dots, the top one turned by 4°: a square lattice of light and dark appears, about 129 px across and turned by half the angle. Colour printers set their ink screens 30° apart so that this beat stays too fine to notice.',
    layers: [
      { kind: 'dots', period: 9, angle: 0, duty: 0.35 },
      { kind: 'dots', period: 9, angle: 4, duty: 0.35 },
    ],
  },
  {
    id: 'dots-stretched',
    name: 'Dot screens, slightly different spacings',
    note: 'Dots 9 px and 9.5 px apart with no turn. The beat lattice lines up with the dots and is 171 px across.',
    layers: [
      { kind: 'dots', period: 9, angle: 0, duty: 0.35 },
      { kind: 'dots', period: 9.5, angle: 0, duty: 0.35 },
    ],
  },
];

export function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

// Build the two layers of a scene for a view of the given size.
export function sceneLayers(scene, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  return scene.layers.map(({ dx = 0, dy = 0, angle = 0, ...rest }) =>
    makeLayer({ ...rest, angle: (angle * Math.PI) / 180, x: cx + dx, y: cy + dy }),
  );
}
