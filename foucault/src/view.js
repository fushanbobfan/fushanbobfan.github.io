// Drawing the floor from above. Floor coordinates: x east, y north, the
// swing's amplitude is 1. `rot` turns the whole floor anticlockwise on screen.

export const FLOOR = 1.18; // floor radius in amplitudes

export class Sand {
  constructor(px = 900) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = px;
    this.ctx = this.canvas.getContext('2d');
    this.k = px / (2 * FLOOR);
    this.clear();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // fade older track by a fraction of its opacity
  fade(amount) {
    if (amount <= 0) return;
    const c = this.ctx;
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = `rgba(0,0,0,${Math.min(1, amount)})`;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.globalCompositeOperation = 'source-over';
  }

  // a polyline of floor points
  stroke(points, colour) {
    if (points.length < 2) return;
    const c = this.ctx, k = this.k, h = this.canvas.width / 2;
    c.strokeStyle = colour;
    c.lineWidth = Math.max(1, this.canvas.width / 600);
    c.lineJoin = c.lineCap = 'round';
    c.beginPath();
    c.moveTo(h + k * points[0].x, h - k * points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(h + k * points[i].x, h - k * points[i].y);
    c.stroke();
  }
}

export function layout(w, h) {
  const R = (0.48 * Math.min(w, h)) / FLOOR;
  return { cx: w / 2, cy: h / 2, R };
}

// screen position of a floor point
export function toScreen(L, rot, x, y) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return { sx: L.cx + L.R * (c * x - s * y), sy: L.cy - L.R * (s * x + c * y) };
}

export function toFloor(L, rot, sx, sy) {
  const u = (sx - L.cx) / L.R, v = -(sy - L.cy) / L.R;
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x: c * u + s * v, y: -s * u + c * v };
}

export function drawScene(ctx, w, h, scene) {
  const L = layout(w, h);
  const { rot } = scene;
  ctx.clearRect(0, 0, w, h);

  // floor
  ctx.fillStyle = '#1c1d20';
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, L.R * FLOOR, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#34373d';
  ctx.lineWidth = 1;
  for (const r of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, L.R * r, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // compass ticks every 15°, longer at 45°
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI) / 12;
    const len = k % 6 === 0 ? 0.08 : k % 3 === 0 ? 0.05 : 0.025;
    const p = toScreen(L, rot, FLOOR * Math.cos(a), FLOOR * Math.sin(a));
    const q = toScreen(L, rot, (FLOOR - len) * Math.cos(a), (FLOOR - len) * Math.sin(a));
    ctx.strokeStyle = k % 6 === 0 ? '#8d8a82' : '#4a4d53';
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy);
    ctx.lineTo(q.sx, q.sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#9a9890';
  ctx.font = `${Math.max(11, L.R * 0.06)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [label, a] of [['E', 0], ['N', Math.PI / 2], ['W', Math.PI], ['S', -Math.PI / 2]]) {
    const p = toScreen(L, rot, (FLOOR - 0.15) * Math.cos(a), (FLOOR - 0.15) * Math.sin(a));
    ctx.fillText(label, p.sx, p.sy);
  }

  // track in the sand, turned with the floor
  if (scene.sand) {
    ctx.save();
    ctx.translate(L.cx, L.cy);
    ctx.rotate(-rot);
    const s = 2 * FLOOR * L.R;
    ctx.drawImage(scene.sand.canvas, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  // starting plane, and the plane now
  line(ctx, L, rot, scene.plane0, '#5b5e66', [4, 5]);
  line(ctx, L, rot, scene.planeNow, 'rgba(217,163,91,0.65)', []);

  if (scene.pins) drawPins(ctx, L, rot, scene.pins);

  // wire seen from above, then the bob
  const b = toScreen(L, rot, scene.bob.x, scene.bob.y);
  ctx.strokeStyle = 'rgba(233,230,223,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.cx, L.cy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(b.sx + L.R * 0.012, b.sy + L.R * 0.018, L.R * 0.05, 0, 2 * Math.PI);
  ctx.fill();
  const grad = ctx.createRadialGradient(b.sx - L.R * 0.015, b.sy - L.R * 0.015, L.R * 0.005, b.sx, b.sy, L.R * 0.05);
  grad.addColorStop(0, '#f6e2b8');
  grad.addColorStop(1, '#a8752f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(b.sx, b.sy, L.R * 0.05, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#5b5e66';
  ctx.beginPath();
  ctx.arc(L.cx, L.cy, 2.5, 0, 2 * Math.PI);
  ctx.fill();
}

function line(ctx, L, rot, angle, colour, dash) {
  const p = toScreen(L, rot, FLOOR * Math.cos(angle), FLOOR * Math.sin(angle));
  const q = toScreen(L, rot, -FLOOR * Math.cos(angle), -FLOOR * Math.sin(angle));
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.sx, p.sy);
  ctx.lineTo(q.sx, q.sy);
  ctx.stroke();
  ctx.restore();
}

function drawPins(ctx, L, rot, pins) {
  for (const p of pins) {
    const r = Math.hypot(p.x, p.y);
    if (p.down) {
      // tipped outward, lying on the floor
      const a = toScreen(L, rot, p.x, p.y);
      const tip = toScreen(L, rot, (p.x * (r + 0.07)) / r, (p.y * (r + 0.07)) / r);
      ctx.strokeStyle = '#6e5a3c';
      ctx.lineWidth = Math.max(2, L.R * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(tip.sx, tip.sy);
      ctx.stroke();
    } else {
      const a = toScreen(L, rot, p.x, p.y);
      ctx.fillStyle = '#e9d2a6';
      ctx.beginPath();
      ctx.arc(a.sx, a.sy, Math.max(2.5, L.R * 0.014), 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
