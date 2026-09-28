// Ready-made benches. Each scene is laid out in a 900 × 600 design space
// centred on the origin, then moved to the canvas centre and shrunk if the
// canvas is smaller. They never grow, so element sizes stay within range.

import { makeElement } from './elements.js';

const DESIGN = { width: 900, height: 600 };
const SIZE_KEYS = ['side', 'width', 'height', 'radius', 'aperture', 'length'];

export const SCENES = [
  {
    id: 'tour',
    name: 'Bench tour',
    note: 'A lens focusing a beam, a curved mirror, and white light split by a flint prism.',
    build: () => [
      makeElement('beam', -360, -108, 0, { width: 70, count: 9 }),
      makeElement('convexLens', -108, -108),
      makeElement('prism', 18, 96, 0, { side: 150, material: 'sf10' }),
      makeElement('laser', -232, 207, -0.56, { light: 'white' }),
      makeElement('curvedMirror', 360, -60, Math.PI, { radius: 360, aperture: 110 }),
    ],
  },
  {
    id: 'prism',
    name: "Newton's prism",
    note: 'A narrow white beam through a dense flint prism near minimum deviation. Turn the prism to find the turning point.',
    build: () => [
      makeElement('beam', -330, 150, -0.56, { width: 10, count: 3, light: 'white', samples: 18 }),
      makeElement('prism', -40, 0, 0, { side: 220, material: 'sf10' }),
    ],
  },
  {
    id: 'rainbow',
    name: 'Rainbow in a glass ball',
    note: 'White light enters the upper half of a ball. Light reflected once inside comes back out, red at a wider angle than violet.',
    build: () => [
      makeElement('beam', -400, -60, 0, { width: 118, count: 16, light: 'white', samples: 9 }),
      makeElement('ball', 150, 0, 0, { radius: 130, material: 'bk7' }),
    ],
  },
  {
    id: 'periscope',
    name: 'Prism periscope',
    note: 'Two right-angle prisms turn a laser twice by total internal reflection, with no mirror coating.',
    build: () => [
      makeElement('laser', -380, 180, 0, { wavelength: 635 }),
      makeElement('prism', 60, 180, -Math.PI / 4, { apex: 90, side: 150 }),
      makeElement('prism', 60, -180, (3 * Math.PI) / 4, { apex: 90, side: 150 }),
    ],
  },
  {
    id: 'pipe',
    name: 'Light pipe',
    note: 'A laser enters the end of a long glass rod and is trapped by total internal reflection, the principle of an optical fibre.',
    build: () => [
      makeElement('laser', -300, -30, 0.6, { wavelength: 532 }),
      makeElement('block', 20, 0, 0, { width: 500, height: 40, material: 'sf10' }),
    ],
  },
  {
    id: 'lenses',
    name: 'Lenses and aberration',
    note: 'A wide beam through a convex lens: edge rays focus closer than central ones. Below, a concave lens spreads a beam.',
    build: () => [
      makeElement('beam', -380, -130, 0, { width: 140, count: 15 }),
      makeElement('convexLens', -200, -130, 0, { radius: 160, aperture: 80 }),
      makeElement('beam', -380, 170, 0, { width: 80, count: 7, wavelength: 460 }),
      makeElement('concaveLens', -200, 170, 0, { radius: 160, aperture: 60 }),
    ],
  },
  {
    id: 'caustic',
    name: 'Mirror caustic',
    note: 'Parallel light on a deep curved mirror. The reflected rays crowd onto a bright cusped curve, the one seen in a coffee cup.',
    build: () => [
      makeElement('beam', -380, 0, 0, { width: 380, count: 59, wavelength: 580 }),
      makeElement('curvedMirror', 260, 0, 0, { radius: 240, aperture: 200 }),
    ],
  },
  {
    id: 'gallery',
    name: 'Whispering gallery',
    note: 'A lamp near the rim of a flint glass ball. Rays that meet the surface past the critical angle meet every later surface at the same angle, so they circle the rim and never get out.',
    build: () => [
      makeElement('ball', 0, 0, 0, { radius: 200, material: 'sf10' }),
      makeElement('point', 0, -150, 0, { count: 72, spread: 360, wavelength: 600 }),
    ],
  },
];

export function sceneScale(width, height) {
  return Math.min(1, Math.max(0.4, Math.min(width / DESIGN.width, height / DESIGN.height)));
}

// Build a scene and fit it to a canvas of the given size.
export function buildScene(id, width, height) {
  const scene = SCENES.find((s) => s.id === id);
  if (!scene) return null;
  const k = sceneScale(width, height);
  return scene.build().map((el) => {
    const out = { ...el, x: width / 2 + el.x * k, y: height / 2 + el.y * k };
    for (const key of SIZE_KEYS) if (typeof el[key] === 'number') out[key] = el[key] * k;
    return out;
  });
}
