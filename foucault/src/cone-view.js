// The tangent cone on the globe, and the same cone cut open and laid flat.

import { tangentCone, onSheet } from './cone.js';

const TILT = (20 * Math.PI) / 180; // we look down on the globe a little
const PAPER = 'rgba(233,210,166,0.10)';
const EDGE = '#6b665c';
const GOLD = '#d9a35b';
const NORTH = '#b7c3d6';

export function drawGlobe(ctx, w, h, latDeg, dayFraction) {
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w, h) * 0.24;
  const north = latDeg >= 0;
  const cx = w / 2, cy = north ? h * 0.66 : h * 0.34;
  const sb = Math.sin(TILT), cb = Math.cos(TILT);
  const X = (x) => cx + x, Y = (y) => cy - y; // world y up

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // globe
  ctx.fillStyle = '#1f2a36';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#3b4a5b';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * sb, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X(0), Y(-r * 1.25 * cb));
  ctx.lineTo(X(0), Y(r * 1.25 * cb));
  ctx.stroke();
  ctx.setLineDash([]);

  const cone = tangentCone(latDeg, r);
  const rho = cone.ring.radius, yc = cone.ring.height * cb;

  // the cone's outline: from the apex to the two points where it grazes the parallel
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = EDGE;
  if (cone.kind === 'cylinder') {
    ctx.fillRect(X(-rho), 0, 2 * rho, h);
    for (const s of [-1, 1]) line(ctx, X(s * rho), 0, X(s * rho), h);
  } else {
    const yA = cone.apex * cb;
    const d = yc - yA;
    const s = (-rho * sb) / d;
    if (Math.abs(s) <= 1) {
      const t1 = Math.asin(s), t2 = Math.PI - t1;
      const p1 = { x: rho * Math.cos(t1), y: yc + rho * sb * Math.sin(t1) };
      const p2 = { x: rho * Math.cos(t2), y: yc + rho * sb * Math.sin(t2) };
      ctx.beginPath();
      ctx.moveTo(X(0), Y(yA));
      ctx.lineTo(X(p1.x), Y(p1.y));
      ctx.ellipse(cx, Y(yc), rho, rho * sb, 0, -t1, -t2, latDeg < 0);
      ctx.closePath();
      ctx.fill();
      line(ctx, X(0), Y(yA), X(p1.x), Y(p1.y));
      line(ctx, X(0), Y(yA), X(p2.x), Y(p2.y));
    }
    ctx.fillStyle = EDGE;
    ctx.beginPath();
    ctx.arc(X(0), Y(yA), 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  // the parallel, its near half drawn stronger
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(cx, Y(yc), rho, rho * sb, 0, Math.PI, 2 * Math.PI);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, Y(yc), rho, rho * sb, 0, 0, Math.PI);
  ctx.stroke();

  // the pendulum, carried east around its parallel by the Earth's turn
  const th = -Math.PI / 2 + 2 * Math.PI * dayFraction;
  const front = Math.sin(th) < 0;
  ctx.fillStyle = front ? '#f6e2b8' : 'rgba(246,226,184,0.4)';
  ctx.beginPath();
  ctx.arc(X(rho * Math.cos(th)), Y(yc + rho * sb * Math.sin(th)), 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

export function drawSheet(ctx, w, h, latDeg, dayFraction) {
  ctx.clearRect(0, 0, w, h);
  const sheet = onSheet(latDeg, dayFraction);
  const { cone } = sheet;
  const arrow = Math.min(w, h) * 0.1;

  if (cone.kind === 'cylinder') {
    const k = (w * 0.9) / (2 * Math.PI);
    const y0 = h / 2;
    ctx.fillStyle = PAPER;
    ctx.fillRect(w * 0.05, y0 - h * 0.3, w * 0.9, h * 0.6);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    line(ctx, w * 0.05, y0, w * 0.95, y0);
    for (let i = 0; i <= 8; i++) {
      const x = w * 0.05 + (w * 0.9 * i) / 8;
      arrows(ctx, x, y0, { x: 0, y: 1 }, { x: 0, y: 1 }, arrow * 0.7, 0.35);
    }
    const x = w / 2 + k * sheet.x;
    dot(ctx, x, y0);
    arrows(ctx, x, y0, sheet.north, sheet.swing, arrow, 1);
    return;
  }

  const S = cone.sector;
  let k, ax, ay;
  if (S >= Math.PI) {
    k = (Math.min(w, h) * 0.42) / cone.slant;
    ax = w / 2;
    ay = h / 2;
  } else {
    k = Math.min((h * 0.84) / cone.slant, (w * 0.45) / (cone.slant * Math.sin(S / 2)));
    ax = w / 2;
    ay = Math.max(h * 0.06, (h - cone.slant * k) / 2);
  }
  const P = (q) => ({ x: ax + k * q.x, y: ay - k * q.y });
  const R = cone.slant * k;
  const start = sheet.a0, sweep = sheet.sign * S;

  // the sheet, and the wedge that is missing when it is rolled into a cone
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.arc(ax, ay, R, -start, -(start + sweep), sweep > 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (S < 2 * Math.PI - 1e-6) {
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(ax, ay, R, -start, -(start + sweep), sweep < 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, R, -start, -(start + sweep * dayFraction), sweep > 0);
  ctx.stroke();

  for (let i = 0; i <= 8; i++) {
    const s = onSheet(latDeg, i / 8);
    const p = P(s);
    arrows(ctx, p.x, p.y, s.north, s.swing, arrow * 0.7, 0.3);
  }
  const p = P(sheet);
  dot(ctx, p.x, p.y);
  arrows(ctx, p.x, p.y, sheet.north, sheet.swing, arrow, 1);
  ctx.fillStyle = EDGE;
  ctx.beginPath();
  ctx.arc(ax, ay, 2.5, 0, 2 * Math.PI);
  ctx.fill();
}

// north as a thin arrow, the swing as a gold bar through the point
function arrows(ctx, x, y, north, swing, len, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  line(ctx, x - swing.x * len * 0.8, y + swing.y * len * 0.8, x + swing.x * len * 0.8, y - swing.y * len * 0.8);
  ctx.strokeStyle = NORTH;
  ctx.lineWidth = 1.5;
  const tx = x + north.x * len, ty = y - north.y * len;
  line(ctx, x, y, tx, ty);
  const a = Math.atan2(-north.y, north.x);
  for (const d of [2.6, -2.6]) line(ctx, tx, ty, tx + 6 * Math.cos(a + d), ty + 6 * Math.sin(a + d));
  ctx.restore();
}

function dot(ctx, x, y) {
  ctx.fillStyle = '#f6e2b8';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, 2 * Math.PI);
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
