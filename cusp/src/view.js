// Canvas drawing. Everything here reads state and paints; nothing here decides physics.

import { energy, pinPosition, wrapAngle } from './machine.js';
import { countWells } from './equilibria.js';

const COLORS = {
  grid: '#20252a',
  axis: '#2d3237',
  wheel: '#d9c9a3',
  wheelFill: '#22262a',
  band: '#c9605a',
  slack: '#6d6a64',
  set: '#6fd3c7',
  shade: [111, 211, 199],
  snap: '#f2a65a',
  control: '#f4efe4',
  text: '#9b9a92',
  ball: '#f2a65a',
  curve: '#d9c9a3',
};

export function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return ratio;
}

// A window on the control plane that holds the wheel, A and the whole diamond.
export function makeView(canvas, m, chains) {
  let minX = -3.2;
  let maxY = 1.35;
  for (const chain of chains) {
    for (const p of chain.points) {
      if (p.x - 0.7 < minX) minX = p.x - 0.7;
      if (Math.abs(p.y) + 0.5 > maxY) maxY = Math.abs(p.y) + 0.5;
    }
  }
  const maxX = m.a + 0.6;
  const scale = Math.min(canvas.width / (maxX - minX), canvas.height / (2 * maxY));
  const cx = canvas.width / 2 - (scale * (minX + maxX)) / 2;
  const cy = canvas.height / 2;
  return {
    scale,
    toScreen: (x, y) => [cx + scale * x, cy - scale * y],
    toWorld: (px, py) => ({ x: (px - cx) / scale, y: (cy - py) / scale }),
    left: (0 - cx) / scale,
    right: (canvas.width - cx) / scale,
    top: cy / scale,
  };
}

// The wells counted over the visible plane, kept as a small image scaled up smoothly.
export function shadeWells(m, view, width, height) {
  const image = document.createElement('canvas');
  const cols = 150;
  const rows = Math.max(40, Math.round((cols * height) / width));
  image.width = cols;
  image.height = rows;
  const ctx = image.getContext('2d');
  const data = ctx.createImageData(cols, rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const p = view.toWorld(((i + 0.5) / cols) * width, ((j + 0.5) / rows) * height);
      const wells = countWells(m, p.x, p.y);
      const k = 4 * (j * cols + i);
      data.data[k] = COLORS.shade[0];
      data.data[k + 1] = COLORS.shade[1];
      data.data[k + 2] = COLORS.shade[2];
      data.data[k + 3] = wells >= 2 ? 34 * (wells - 1) : 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return image;
}

function drawGrid(ctx, view, w, h) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(view.left); x <= view.right; x += 1) {
    const [px] = view.toScreen(x, 0);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
  }
  for (let y = -Math.floor(view.top); y <= view.top; y += 1) {
    const [, py] = view.toScreen(0, y);
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.axis;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  const [, axis] = view.toScreen(0, 0);
  ctx.moveTo(0, axis);
  ctx.lineTo(w, axis);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFoldSet(ctx, view, chains, cusps, ratio) {
  ctx.strokeStyle = COLORS.set;
  ctx.lineWidth = 1.6 * ratio;
  ctx.lineJoin = 'round';
  for (const { points, closed } of chains) {
    ctx.beginPath();
    points.forEach((p, i) => {
      const [x, y] = view.toScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (closed) ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.set;
  for (const c of cusps) {
    const [x, y] = view.toScreen(c.x, c.y);
    ctx.beginPath();
    ctx.arc(x, y, 3 * ratio, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrail(ctx, view, trail, snaps, ratio) {
  if (trail.length > 1) {
    ctx.lineWidth = 1.4 * ratio;
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.28)';
    ctx.beginPath();
    trail.forEach((p, i) => {
      const [x, y] = view.toScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.snap;
  ctx.lineWidth = 2 * ratio;
  const size = 5 * ratio;
  for (const s of snaps) {
    const [x, y] = view.toScreen(s.x, s.y);
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
  }
}

// A taut band is a straight line that reddens and thins with stretch; a slack one sags.
function drawBand(ctx, x0, y0, x1, y1, stretch, sag, ratio) {
  ctx.lineCap = 'round';
  if (stretch <= 0) {
    ctx.strokeStyle = COLORS.slack;
    ctx.lineWidth = 2.6 * ratio;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1);
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = COLORS.band;
  ctx.globalAlpha = Math.min(1, 0.65 + 0.3 * stretch);
  ctx.lineWidth = Math.max(1.3, 3 - stretch) * ratio;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function label(ctx, text, x, y, ratio) {
  ctx.fillStyle = COLORS.control;
  ctx.font = `${12 * ratio}px system-ui, sans-serif`;
  ctx.fillText(text, x, y);
}

export function drawMachine(ctx, canvas, ratio, scene) {
  const { view, machine: m, control, theta, wells, chains, cusps, trail, snaps, options, shade } = scene;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, view, w, h);
  if (options.shade && shade) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shade, 0, 0, w, h);
  }
  if (options.set) drawFoldSet(ctx, view, chains, cusps, ratio);
  if (options.trail) drawTrail(ctx, view, trail, snaps, ratio);

  const [ox, oy] = view.toScreen(0, 0);
  const radius = m.r * view.scale;
  const pin = pinPosition(m, theta);
  const [px, py] = view.toScreen(pin.x, pin.y);
  const [ax, ay] = view.toScreen(m.a, 0);
  const [cx, cy] = view.toScreen(control.x, control.y);

  // The wheel, with spokes that turn so a small rotation can be seen.
  ctx.fillStyle = COLORS.wheelFill;
  ctx.strokeStyle = COLORS.wheel;
  ctx.lineWidth = 2.2 * ratio;
  ctx.beginPath();
  ctx.arc(ox, oy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1 * ratio;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  for (let i = 1; i < 6; i += 1) {
    const a = theta + (i * Math.PI) / 3;
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + radius * Math.cos(a), oy - radius * Math.sin(a));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(px, py);
  ctx.stroke();

  const stretchA = Math.hypot(m.a - pin.x, pin.y) - m.l;
  const stretchC = Math.hypot(control.x - pin.x, control.y - pin.y) - m.l;
  drawBand(ctx, px, py, ax, ay, stretchA, 0, ratio);
  drawBand(ctx, px, py, cx, cy, stretchC, 14 * ratio, ratio);

  // Other places the pin could rest.
  ctx.strokeStyle = COLORS.wheel;
  ctx.lineWidth = 1.5 * ratio;
  for (const well of wells) {
    if (Math.abs(wrapAngle(well.theta - theta)) < 0.08) continue;
    const q = pinPosition(m, well.theta);
    const [qx, qy] = view.toScreen(q.x, q.y);
    ctx.beginPath();
    ctx.arc(qx, qy, 4.5 * ratio, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.wheel;
  ctx.beginPath();
  ctx.arc(ox, oy, 3 * ratio, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.control;
  ctx.beginPath();
  ctx.arc(px, py, 5 * ratio, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.beginPath();
  ctx.arc(ax, ay, 4.5 * ratio, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, 'A', ax + 8 * ratio, ay - 8 * ratio, ratio);

  // The handle: wide enough to see and grab.
  ctx.strokeStyle = COLORS.control;
  ctx.lineWidth = 2 * ratio;
  ctx.fillStyle = 'rgba(244, 239, 228, 0.16)';
  ctx.beginPath();
  ctx.arc(cx, cy, 11 * ratio, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.control;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.6 * ratio, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, 'C', cx + 14 * ratio, cy - 10 * ratio, ratio);
}

export function drawSlice(ctx, canvas, ratio, scene) {
  const { line, range, segments, folds, history, control, theta } = scene.slice;
  const w = canvas.width;
  const h = canvas.height;
  const pad = { left: 36 * ratio, right: 10 * ratio, top: 10 * ratio, bottom: 22 * ratio };
  const xOf = (s) => pad.left + ((s - range[0]) / (range[1] - range[0])) * (w - pad.left - pad.right);
  const yOf = (t) => pad.top + ((Math.PI - wrapAngle(t)) / (2 * Math.PI)) * (h - pad.top - pad.bottom);
  ctx.clearRect(0, 0, w, h);

  ctx.font = `${11 * ratio}px system-ui, sans-serif`;
  ctx.fillStyle = COLORS.text;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  for (const deg of [-180, -90, 0, 90, 180]) {
    const y = pad.top + ((180 - deg) / 360) * (h - pad.top - pad.bottom);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(`${deg}°`, pad.left - 4 * ratio, y + 4 * ratio);
  }
  ctx.textAlign = 'center';
  const tick = range[1] - range[0] > 4 ? 1 : 0.5;
  for (let s = Math.ceil(range[0] / tick) * tick; s <= range[1]; s += tick) {
    const x = xOf(s);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, h - pad.bottom);
    ctx.stroke();
    ctx.fillText(`${line.axis} = ${Number(s.toFixed(1))}`, x, h - 7 * ratio);
  }
  ctx.textAlign = 'start';

  // The band where two wells exist on this line, between its folds.
  ctx.fillStyle = 'rgba(111, 211, 199, 0.09)';
  for (let i = 0; i + 1 < folds.length; i += 2) {
    ctx.fillRect(xOf(folds[i]), pad.top, xOf(folds[i + 1]) - xOf(folds[i]), h - pad.top - pad.bottom);
  }

  // Wells as a solid line, hills as dots, so the two kinds differ without colour.
  ctx.beginPath();
  ctx.fillStyle = COLORS.text;
  for (const seg of segments) {
    if (Math.abs(wrapAngle(seg.ta) - wrapAngle(seg.tb)) > Math.PI) continue;
    if (seg.stable) {
      ctx.moveTo(xOf(seg.sa), yOf(seg.ta));
      ctx.lineTo(xOf(seg.sb), yOf(seg.tb));
    } else {
      ctx.fillRect(xOf(seg.sa) - 0.8 * ratio, yOf(seg.ta) - 0.8 * ratio, 1.6 * ratio, 1.6 * ratio);
    }
  }
  ctx.strokeStyle = COLORS.curve;
  ctx.lineWidth = 2 * ratio;
  ctx.stroke();

  if (history.length > 1) {
    ctx.strokeStyle = COLORS.snap;
    ctx.lineWidth = 1.6 * ratio;
    ctx.beginPath();
    let drawing = false;
    history.forEach((p, i) => {
      const x = xOf(p.s);
      const y = yOf(p.theta);
      const wrapped = i > 0 && Math.abs(wrapAngle(p.theta) - wrapAngle(history[i - 1].theta)) > Math.PI;
      if (!drawing || wrapped) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      drawing = true;
    });
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(xOf(line.axis === 'y' ? control.y : control.x), yOf(theta), 5 * ratio, 0, Math.PI * 2);
  ctx.fill();
}

export function drawEnergy(ctx, canvas, ratio, scene) {
  const { machine: m, control, theta, wells, hills } = scene;
  const w = canvas.width;
  const h = canvas.height;
  const pad = { left: 10 * ratio, right: 10 * ratio, top: 12 * ratio, bottom: 20 * ratio };
  ctx.clearRect(0, 0, w, h);

  const samples = 360;
  const values = new Array(samples + 1);
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const v = energy(m, control.x, control.y, -Math.PI + (i * 2 * Math.PI) / samples);
    values[i] = v;
    if (v < low) low = v;
    if (v > high) high = v;
  }
  const range = Math.max(high - low, 1e-6);
  const xOf = (t) => pad.left + ((wrapAngle(t) + Math.PI) / (2 * Math.PI)) * (w - pad.left - pad.right);
  const yOf = (v) => h - pad.bottom - ((v - low) / range) * (h - pad.top - pad.bottom);

  ctx.font = `${11 * ratio}px system-ui, sans-serif`;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (const deg of [-180, -90, 0, 90, 180]) {
    const x = pad.left + ((deg + 180) / 360) * (w - pad.left - pad.right);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, h - pad.bottom);
    ctx.stroke();
    ctx.textAlign = deg === -180 ? 'left' : deg === 180 ? 'right' : 'center';
    ctx.fillText(`${deg}°`, x, h - 5 * ratio);
  }
  ctx.textAlign = 'start';

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad.left + (i / samples) * (w - pad.left - pad.right);
    if (i === 0) ctx.moveTo(x, yOf(v));
    else ctx.lineTo(x, yOf(v));
  });
  ctx.strokeStyle = COLORS.curve;
  ctx.lineWidth = 2 * ratio;
  ctx.stroke();
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = 'rgba(217, 201, 163, 0.07)';
  ctx.fill();

  ctx.strokeStyle = COLORS.set;
  ctx.lineWidth = 1.5 * ratio;
  for (const p of wells) {
    ctx.beginPath();
    ctx.arc(xOf(p.theta), yOf(p.energy), 3.5 * ratio, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.text;
  for (const p of hills) {
    ctx.beginPath();
    ctx.arc(xOf(p.theta), yOf(p.energy) - 7 * ratio, 2 * ratio, 0, Math.PI * 2);
    ctx.fill();
  }

  const ballY = yOf(energy(m, control.x, control.y, theta)) - 6 * ratio;
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(xOf(theta), ballY, 6 * ratio, 0, Math.PI * 2);
  ctx.fill();
}
