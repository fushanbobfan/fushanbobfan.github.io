// What the observer sees: a narrow view straight down the road, like a long
// lens. Because the air changes only with height, every row of the picture is
// one ray, and the columns only decide which part of the scene that ray meets.

import { trace, criticalAngle } from './rays.js';

// A striped board standing on the road, so that an upside-down copy is easy
// to tell from the upright one. Bands run from the ground up, in metres.
export const BOARD = {
  width: 2.4,
  bands: [
    { top: 0.25, color: 'post' },
    { top: 0.8, color: 'red' },
    { top: 1.25, color: 'white' },
    { top: 1.6, color: 'blue' },
  ],
};
export const BOARD_HEIGHT = BOARD.bands[BOARD.bands.length - 1].top;
export const ROAD_HALF_WIDTH = 3.5;

export function boardBand(z) {
  if (z < 0 || z > BOARD_HEIGHT) return null;
  for (const b of BOARD.bands) if (z <= b.top) return b.color;
  return null;
}

// The vertical angles shown, in radians from eye level: from a little below
// the shine (or the foot of the board) to a little above the top of the board.
export function viewAngles(air, { eye, distance }) {
  const c = criticalAngle(air, eye) ?? 0;
  const bottom = -Math.max((1.5 * eye) / distance, 1.25 * c, 0.002);
  const top = Math.max((1.4 * BOARD_HEIGHT - eye) / distance, 0.3 * Math.abs(bottom));
  return { top, bottom };
}

export function farDistance(distance) {
  return Math.max(4 * distance, 3000);
}

// One traced ray per row, top row first. Each row says what the ray meets in
// the board's columns and in the open columns beside it.
export function viewRows(air, { eye, distance }, count) {
  const { top, bottom } = viewAngles(air, { eye, distance });
  const far = farDistance(distance);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const angle = top + ((bottom - top) * (i + 0.5)) / count;
    const r = trace(air, eye, angle, { stops: [distance, far] });
    const zAtBoard = r.heights[0];
    const turned = angle < 0 && r.angles[0] !== null && r.angles[0] > 0;
    let open;
    if (r.groundX !== null) open = { kind: 'ground', x: r.groundX };
    // A ray still heading down at the far stop meets ground too distant to matter.
    else if (r.angles[1] < 0) open = { kind: 'ground', x: far };
    else open = { kind: 'sky', angle: r.angles[1] };
    let board;
    if (r.groundX !== null && r.groundX < distance) board = open;
    else if (boardBand(zAtBoard) !== null) board = { kind: 'board', z: zAtBoard, band: boardBand(zAtBoard), turned };
    else board = open;
    rows.push({ angle, zAtBoard, turned, open, board });
  }
  return rows;
}

function mix(a, b, t) {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
}

// Colour of the ground at distance x and sideways offset y.
function groundColor(palette, x, y) {
  let c;
  if (Math.abs(y) < 0.08 && x % 12 < 4) c = palette.paint;
  else if (Math.abs(y) < ROAD_HALF_WIDTH) c = palette.road;
  else c = palette.verge;
  return mix(c, palette.haze, 1 - Math.exp(-x / 2500));
}

function skyColor(palette, angle) {
  // Brightest at the horizon, deeper blue higher up.
  const t = Math.min(1, Math.max(0, angle / 0.02));
  return mix(palette.horizon, palette.zenith, t);
}

// Renders the view into an RGBA buffer of width x height pixels.
export function renderView(air, scene, width, height, palette) {
  const rows = viewRows(air, scene, height);
  const { top, bottom } = viewAngles(air, scene);
  const perPixel = (top - bottom) / height;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let j = 0; j < height; j++) {
    const row = rows[j];
    for (let i = 0; i < width; i++) {
      const azimuth = (i + 0.5 - width / 2) * perPixel;
      const onBoard = Math.abs(azimuth * scene.distance) <= BOARD.width / 2;
      const hit = onBoard ? row.board : row.open;
      let c;
      if (hit.kind === 'board') c = mix(palette[hit.band], palette.haze, 1 - Math.exp(-scene.distance / 2500));
      else if (hit.kind === 'ground') c = groundColor(palette, hit.x, azimuth * hit.x);
      else c = skyColor(palette, hit.angle);
      const k = (j * width + i) * 4;
      data[k] = c[0];
      data[k + 1] = c[1];
      data[k + 2] = c[2];
      data[k + 3] = 255;
    }
  }
  return { data, rows, top, bottom };
}

// Summary of the picture: whether the road shows sky, and how much of the
// board appears upside down underneath it.
export function describeView(rows) {
  const skyBelowHorizon = rows.some((r) => r.angle < 0 && r.open.kind === 'sky');
  const inverted = rows.filter((r) => r.board.kind === 'board' && r.board.turned);
  const upright = rows.filter((r) => r.board.kind === 'board' && !r.board.turned);
  return {
    skyBelowHorizon,
    invertedRows: inverted.length,
    uprightRows: upright.length,
    invertedTop: inverted.length ? Math.max(...inverted.map((r) => r.board.z)) : 0,
  };
}
