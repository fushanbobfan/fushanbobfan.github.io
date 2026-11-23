// The propeller and the rolling-shutter sensor that photographs it.
//
// Scene coordinates have the propeller hub at the origin, blade tips at radius
// 1 and y pointing up. The sensor covers the square [-EXTENT, EXTENT]² and
// reads its rows from the top down: row i is sampled at one instant, a fixed
// fraction of the readout time after the first row.

export const EXTENT = 1.15;
export const HUB = 0.12;

export function makeProp({ blades = 3, rpm = 3000, direction = 1, width = 0.07, phase = Math.PI / 2 } = {}) {
  return { blades, rpm, direction: direction < 0 ? -1 : 1, width, phase };
}

// Angle of blade 0 at scene time t (seconds), counter-clockwise from +x.
export function bladeAngle(prop, t) {
  return prop.phase + prop.direction * 2 * Math.PI * (prop.rpm / 60) * t;
}

// Scene time at which row `row` of `rows` is read, measured from the moment the
// top row is read. The last row is read `readout` seconds after the first.
export function rowTime(row, rows, readout) {
  return rows > 1 ? (row / (rows - 1)) * readout : 0;
}

// Degrees the propeller turns while the sensor reads from top to bottom.
export function turnDuringReadout(prop, readout) {
  return (prop.rpm / 60) * readout * 360;
}

// Is the scene point (x, y) covered by the propeller when blade 0 points at `angle`?
export function onBlade(prop, x, y, angle) {
  const r = Math.hypot(x, y);
  if (r > 1) return false;
  if (r <= HUB) return true;
  const sector = (2 * Math.PI) / prop.blades;
  let phi = Math.atan2(y, x) - angle;
  phi -= sector * Math.round(phi / sector);
  if (Math.cos(phi) <= 0) return false;
  return r * Math.abs(Math.sin(phi)) <= prop.width;
}

// Centre of pixel (col, row) of a size × size sensor, in scene coordinates.
export function pixelToScene(col, row, size) {
  const step = (2 * EXTENT) / size;
  return { x: -EXTENT + (col + 0.5) * step, y: EXTENT - (row + 0.5) * step };
}

export const SKY = [223, 233, 241];
export const BLADE = [43, 47, 54];

// Fraction of pixel (col, row) covered by the propeller at blade angle `angle`,
// from an ss × ss grid of samples inside the pixel.
export function coverage(prop, col, row, size, angle, ss = 2) {
  const step = (2 * EXTENT) / size;
  let hit = 0;
  for (let a = 0; a < ss; a++) {
    const y = EXTENT - (row + (a + 0.5) / ss) * step;
    for (let b = 0; b < ss; b++) {
      const x = -EXTENT + (col + (b + 0.5) / ss) * step;
      if (onBlade(prop, x, y, angle)) hit++;
    }
  }
  return hit / (ss * ss);
}

// Expose rows [rowFrom, rowTo) of a photo into the RGBA buffer `out`.
// `start` is the scene time at which the top row is read.
export function exposeRows(prop, { size, readout, start = 0 }, rowFrom, rowTo, out, ss = 2) {
  for (let row = rowFrom; row < rowTo; row++) {
    const angle = bladeAngle(prop, start + rowTime(row, size, readout));
    for (let col = 0; col < size; col++) {
      const c = coverage(prop, col, row, size, angle, ss);
      const k = (row * size + col) * 4;
      out[k] = SKY[0] + (BLADE[0] - SKY[0]) * c;
      out[k + 1] = SKY[1] + (BLADE[1] - SKY[1]) * c;
      out[k + 2] = SKY[2] + (BLADE[2] - SKY[2]) * c;
      out[k + 3] = 255;
    }
  }
  return out;
}

// A whole photo as an RGBA buffer.
export function photograph(prop, { size, readout, start = 0 }, ss = 2) {
  const out = new Uint8ClampedArray(size * size * 4);
  return exposeRows(prop, { size, readout, start }, 0, size, out, ss);
}

// Outline of each blade at angle `angle`, as scene-coordinate polygons, for
// drawing the propeller itself.
export function bladePolygons(prop, angle) {
  const polys = [];
  for (let k = 0; k < prop.blades; k++) {
    const a = angle + (2 * Math.PI * k) / prop.blades;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const w = prop.width;
    const inner = Math.sqrt(Math.max(HUB * HUB - w * w, 0));
    const outer = Math.sqrt(1 - w * w);
    polys.push([
      { x: ux * inner - uy * w, y: uy * inner + ux * w },
      { x: ux * outer - uy * w, y: uy * outer + ux * w },
      { x: ux * outer + uy * w, y: uy * outer - ux * w },
      { x: ux * inner + uy * w, y: uy * inner - ux * w },
    ]);
  }
  return polys;
}
