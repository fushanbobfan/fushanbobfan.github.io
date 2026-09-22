// Drawing: the speed colour ramp, ring-road geometry, the scrolling
// space–time diagram and the flow–density chart. The geometry and scale
// helpers are pure so they can be tested without a canvas.

import { deterministicFlow } from './traffic.js';

// Stopped cars glow red, crawling ones orange, cars at the limit pale yellow,
// so a jam reads as a red band on both the ring and the space–time diagram.
const RAMP = [
  [230, 57, 70],
  [244, 162, 97],
  [255, 232, 163],
];

/** RGB triple for a car moving at `v` out of `vmax`. */
export function speedRgb(v, vmax) {
  const t = vmax <= 0 ? 1 : Math.max(0, Math.min(1, v / vmax));
  const scaled = t * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** CSS colour for a car moving at `v` out of `vmax`. */
export function speedColor(v, vmax) {
  const [r, g, b] = speedRgb(v, vmax);
  return `rgb(${r}, ${g}, ${b})`;
}

export const EMPTY_RGB = [10, 15, 28];

/** Where the ring sits on a canvas of the given logical size. */
export function ringGeometry(width, height, cells) {
  const margin = 18;
  const radius = Math.max(10, Math.min(width, height) / 2 - margin);
  // Each cell gets an arc of 2πr / cells; the lane is as wide as a few cells
  // so a car drawn as a cell-long block stays visible on long roads.
  const cellArc = (2 * Math.PI * radius) / Math.max(1, cells);
  const laneWidth = Math.max(8, Math.min(radius * 0.18, cellArc * 3));
  return { cx: width / 2, cy: height / 2, radius, laneWidth, cellArc };
}

/** Angle of a cell's centre, clockwise from the top. */
export function cellAngle(cell, cells) {
  return -Math.PI / 2 + ((cell + 0.5) / cells) * 2 * Math.PI;
}

/** Cell under a point, or -1 if the point is off the lane. */
export function cellAtPoint(geom, cells, x, y) {
  const dx = x - geom.cx;
  const dy = y - geom.cy;
  const dist = Math.hypot(dx, dy);
  const half = geom.laneWidth / 2 + Math.max(6, geom.laneWidth * 0.5);
  if (dist < geom.radius - half || dist > geom.radius + half) return -1;
  let turn = (Math.atan2(dy, dx) + Math.PI / 2) / (2 * Math.PI);
  turn -= Math.floor(turn);
  return Math.min(cells - 1, Math.floor(turn * cells));
}

/** Largest flow the model can carry, used as the chart's vertical extent. */
export function flowAxisMax(vmax) {
  const peak = vmax / (vmax + 1);
  return Math.ceil(peak * 10) / 10;
}

/** Axis mapping for the flow–density chart. */
export function chartScales(width, height, vmax, padding = { left: 44, right: 12, top: 10, bottom: 22 }) {
  const innerW = Math.max(1, width - padding.left - padding.right);
  const innerH = Math.max(1, height - padding.top - padding.bottom);
  const flowMax = flowAxisMax(vmax);
  return {
    flowMax,
    padding,
    x: (density) => padding.left + Math.max(0, Math.min(1, density)) * innerW,
    y: (flow) => padding.top + innerH - (Math.max(0, Math.min(flowMax, flow)) / flowMax) * innerH,
  };
}

/** Draw the ring road and every car on it. */
export function drawRing(ctx, road, geom, { flash = null, flashAge = 0 } = {}) {
  const { cx, cy, radius, laneWidth } = geom;
  const { cells, vmax } = road;

  ctx.save();
  ctx.lineCap = 'butt';

  // Tarmac.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.lineWidth = laneWidth;
  ctx.strokeStyle = '#1c2436';
  ctx.stroke();

  // Kerbs.
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#2f3b56';
  for (const r of [radius - laneWidth / 2, radius + laneWidth / 2]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // Finish line at the boundary between the last cell and cell 0.
  const lineAngle = -Math.PI / 2;
  ctx.strokeStyle = '#7ee0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(lineAngle) * (radius - laneWidth / 2 - 4), cy + Math.sin(lineAngle) * (radius - laneWidth / 2 - 4));
  ctx.lineTo(cx + Math.cos(lineAngle) * (radius + laneWidth / 2 + 4), cy + Math.sin(lineAngle) * (radius + laneWidth / 2 + 4));
  ctx.stroke();

  // Cars: one arc segment per car, a cell long, coloured by speed.
  const arc = (2 * Math.PI) / cells;
  const carWidth = Math.min(laneWidth * 0.6, 14);
  ctx.lineWidth = carWidth;
  for (const car of road.cars) {
    const a0 = -Math.PI / 2 + car.pos * arc;
    ctx.strokeStyle = speedColor(car.vel, vmax);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, a0 + arc * 0.08, a0 + arc * 0.92);
    ctx.stroke();
  }

  if (flash && flashAge < 1) {
    const a = cellAngle(flash.pos, cells);
    ctx.strokeStyle = `rgba(255, 255, 255, ${1 - flashAge})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, laneWidth * (0.6 + flashAge * 0.8), 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * A scrolling space–time diagram: one pixel column per cell, one pixel row
 * per step, newest row at the bottom. Kept on an offscreen canvas so the
 * scroll is a single drawImage.
 */
export class SpaceTime {
  constructor(createCanvas, cells, rows) {
    this.createCanvas = createCanvas;
    this.reset(cells, rows);
  }

  reset(cells, rows) {
    this.cells = cells;
    this.rows = rows;
    this.canvas = this.createCanvas(cells, rows);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = `rgb(${EMPTY_RGB.join(',')})`;
    this.ctx.fillRect(0, 0, cells, rows);
    this.row = this.ctx.createImageData(cells, 1);
    this.filled = 0;
  }

  /** Append one occupancy row (-1 empty, otherwise speed). */
  push(occupancy, vmax) {
    const data = this.row.data;
    for (let i = 0; i < this.cells; i++) {
      const v = occupancy[i];
      const rgb = v < 0 ? EMPTY_RGB : speedRgb(v, vmax);
      const k = i * 4;
      data[k] = rgb[0];
      data[k + 1] = rgb[1];
      data[k + 2] = rgb[2];
      data[k + 3] = 255;
    }
    this.ctx.drawImage(this.canvas, 0, -1);
    this.ctx.putImageData(this.row, 0, this.rows - 1);
    this.filled = Math.min(this.rows, this.filled + 1);
  }

  /** Stretch the diagram over a target canvas without smoothing. */
  draw(ctx, width, height) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0, width, height);
    ctx.restore();
  }
}

/** Draw the flow–density chart with reference curves, measured points and the live reading. */
export function drawDiagram(ctx, width, height, { points, vmax, slow, live, sweepFraction = null }) {
  const scales = chartScales(width, height, vmax);
  const { x, y, flowMax, padding } = scales;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // Grid and axes.
  ctx.strokeStyle = '#263049';
  ctx.fillStyle = '#9aa5c0';
  ctx.lineWidth = 1;
  for (let d = 0; d <= 1; d += 0.25) {
    ctx.beginPath();
    ctx.moveTo(x(d), y(0));
    ctx.lineTo(x(d), y(flowMax));
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText(d.toFixed(2), x(d), height - padding.bottom / 2);
  }
  const flowStep = flowMax > 0.5 ? 0.2 : 0.1;
  for (let f = 0; f <= flowMax + 1e-9; f += flowStep) {
    ctx.beginPath();
    ctx.moveTo(x(0), y(f));
    ctx.lineTo(x(1), y(f));
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(f.toFixed(1), padding.left - 4, y(f));
  }

  // Deterministic triangle: exact when nobody dawdles.
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#4c5f8a';
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const d = i / 100;
    const f = deterministicFlow(d, vmax);
    if (i === 0) ctx.moveTo(x(d), y(f));
    else ctx.lineTo(x(d), y(f));
  }
  ctx.stroke();

  // Free-flow line for the current dawdling: mean speed vmax − slow while nobody interacts.
  if (slow > 0) {
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = '#7a8fbd';
    const dEnd = Math.min(1, flowMax / Math.max(1e-9, vmax - slow));
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    ctx.lineTo(x(dEnd), y(dEnd * (vmax - slow)));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Measured points.
  for (const p of points) {
    const r = 1.5 + Math.min(2.5, Math.log10(1 + p.n));
    ctx.fillStyle = 'rgba(255, 180, 84, 0.85)';
    ctx.beginPath();
    ctx.arc(x(p.density), y(p.flow), r, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Live reading.
  if (live) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x(live.density), y(live.flow), 5, 0, 2 * Math.PI);
    ctx.stroke();
  }

  if (sweepFraction !== null) {
    ctx.fillStyle = 'rgba(126, 224, 255, 0.25)';
    ctx.fillRect(x(0), padding.top, (x(1) - x(0)) * sweepFraction, 3);
  }

  ctx.fillStyle = '#9aa5c0';
  ctx.textAlign = 'right';
  ctx.fillText('density (cars per cell)', x(1), padding.top + 6);
  ctx.save();
  ctx.translate(12, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('flow (cars per step)', 0, 0);
  ctx.restore();

  ctx.restore();
  return scales;
}
