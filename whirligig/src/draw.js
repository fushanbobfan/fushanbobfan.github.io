// Canvas drawing for the three pictures. Geometry helpers are exported for tests.

import { effectivePotential, energyJoules } from './top.js';

// Body axes of the top: e3 along the axle, leaning towards phi; e1 and e2
// turn with the body through psi.
export function bodyAxes(theta, phi, psi) {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const e3 = [st * Math.cos(phi), st * Math.sin(phi), ct];
  const n = [-Math.sin(phi), Math.cos(phi), 0];
  const m = [e3[1] * n[2] - e3[2] * n[1], e3[2] * n[0] - e3[0] * n[2], e3[0] * n[1] - e3[1] * n[0]];
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return {
    e1: n.map((v, i) => c * v + s * m[i]),
    e2: n.map((v, i) => -s * v + c * m[i]),
    e3,
  };
}

// Orthographic camera looking down at `elev` from the side.
export function makeView(width, height, scale, elev = 0.38, yaw = -0.5) {
  const ce = Math.cos(elev);
  const se = Math.sin(elev);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ox = width / 2;
  const oy = height * 0.82;
  return {
    // Unit vector from the scene towards the camera.
    toward: [-sy * ce, -cy * ce, se],
    project([x, y, z]) {
      const right = x * cy - y * sy;
      const depth = x * sy + y * cy;
      return [ox + scale * right, oy - scale * (z * ce + depth * se)];
    },
  };
}

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

export function drawTop(ctx, width, height, st, top, trail, colours) {
  ctx.clearRect(0, 0, width, height);
  const scale = (height * 0.62) / (top.height * 1.9);
  const view = makeView(width, height, scale);
  const P = (p) => view.project(p);
  const { e1, e2, e3 } = bodyAxes(st.theta, st.phi, st.psi);
  const at = (k) => e3.map((v) => v * k);

  // Table: rings around the tip and the disc's shadow straight below it.
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.rule;
  for (const r of [0.025, 0.05, 0.075]) {
    const ring = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * 2 * Math.PI;
      ring.push(P([r * Math.cos(t), r * Math.sin(t), 0]));
    }
    poly(ctx, ring);
    ctx.stroke();
  }
  const centre = at(top.height);
  const rim = [];
  const shadow = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * 2 * Math.PI;
    const p = centre.map((v, k) => v + top.radius * (Math.cos(t) * e1[k] + Math.sin(t) * e2[k]));
    rim.push(p);
    shadow.push(P([p[0], p[1], 0]));
  }
  ctx.fillStyle = colours.shadow;
  poly(ctx, shadow);
  ctx.fill();

  // The path the end of the handle has drawn.
  if (trail.length > 1) {
    ctx.strokeStyle = colours.trail;
    ctx.lineWidth = 1.5;
    poly(ctx, trail.map((p) => P(p)));
    ctx.stroke();
  }

  const lower = () => {
    ctx.strokeStyle = colours.steel;
    ctx.lineWidth = 3;
    poly(ctx, [P([0, 0, 0]), P(centre)]);
    ctx.stroke();
  };
  const disc = () => {
    ctx.fillStyle = colours.body;
    ctx.strokeStyle = colours.bodyEdge;
    ctx.lineWidth = 1.5;
    poly(ctx, rim.map(P));
    ctx.fill();
    ctx.stroke();
    // Two painted stripes turn with the body so the spin can be seen.
    ctx.lineWidth = 3;
    for (const [axis, colour] of [[e1, colours.stripe], [e2, colours.stripe2]]) {
      ctx.strokeStyle = colour;
      const a = centre.map((v, k) => v - 0.92 * top.radius * axis[k]);
      const b = centre.map((v, k) => v + 0.92 * top.radius * axis[k]);
      poly(ctx, [P(a), P(b)]);
      ctx.stroke();
    }
  };
  const handle = () => {
    ctx.strokeStyle = colours.steel;
    ctx.lineWidth = 3;
    poly(ctx, [P(centre), P(at(top.height * 1.6))]);
    ctx.stroke();
  };
  // Seen from above, the disc hides the lower stalk; from below, the handle.
  const fromAbove = e3[0] * view.toward[0] + e3[1] * view.toward[1] + e3[2] * view.toward[2] >= 0;
  if (fromAbove) {
    lower();
    disc();
    handle();
  } else {
    handle();
    disc();
    lower();
  }
  ctx.fillStyle = colours.steel;
  const [tx, ty] = P([0, 0, 0]);
  ctx.beginPath();
  ctx.arc(tx, ty, 2.5, 0, 2 * Math.PI);
  ctx.fill();
}

// Top-down map of the axle's direction: distance from the centre is the tilt.
export function pathPoint(theta, phi, size, maxTilt) {
  const r = (theta / maxTilt) * (size / 2 - 14);
  return [size / 2 + r * Math.cos(phi), size / 2 - r * Math.sin(phi)];
}

export function drawPath(ctx, size, trail, band, floor, colours) {
  ctx.clearRect(0, 0, size, size);
  const maxTilt = Math.max(floor * 1.12, band.thetaMax * 1.05);
  const radius = (t) => (t / maxTilt) * (size / 2 - 14);
  const c = size / 2;
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.rule;
  ctx.fillStyle = colours.muted;
  ctx.font = '12px Georgia, serif';
  const tick = (Math.PI / 180) * 15;
  for (let t = tick; t < maxTilt; t += tick) {
    ctx.beginPath();
    ctx.arc(c, c, radius(t), 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillText(`${Math.round((t * 180) / Math.PI)}°`, c + 3, c - radius(t) + 13);
  }
  if (!band.touches) {
    ctx.fillStyle = colours.band;
    ctx.beginPath();
    ctx.arc(c, c, radius(band.thetaMax), 0, 2 * Math.PI);
    ctx.arc(c, c, radius(band.thetaMin), 0, 2 * Math.PI, true);
    ctx.fill('evenodd');
  }
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = colours.warn;
  ctx.beginPath();
  ctx.arc(c, c, radius(floor), 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colours.warn;
  ctx.fillText('rim meets the table', c - 52, c + radius(floor) - 10);
  if (trail.length > 1) {
    ctx.strokeStyle = colours.trail;
    ctx.lineWidth = 1.5;
    poly(ctx, trail.map(([t, p]) => pathPoint(t, p, size, maxTilt)));
    ctx.stroke();
    const [x, y] = pathPoint(...trail[trail.length - 1], size, maxTilt);
    ctx.fillStyle = colours.ink;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = colours.ink;
  ctx.beginPath();
  ctx.arc(c, c, 2, 0, 2 * Math.PI);
  ctx.fill();
}

// Energy picture for the tilt alone: the effective potential, the energy
// line, and the band between the walls where the nod is allowed.
export function potentialCurve(c, n = 240) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const theta = ((0.4 + (89.6 * i) / n) * Math.PI) / 180;
    pts.push([theta, effectivePotential(theta, c)]);
  }
  return pts;
}

export function drawPotential(ctx, width, height, c, band, theta, floor, colours) {
  ctx.clearRect(0, 0, width, height);
  const pad = { l: 56, r: 14, t: 14, b: 34 };
  const E = energyJoules(c);
  const pts = potentialCurve(c);
  const vmin = Math.min(...pts.map((p) => p[1]));
  const span = Math.max(E - vmin, 1e-9);
  const ylo = vmin - 0.25 * span;
  const yhi = E + 1.2 * span;
  const X = (t) => pad.l + ((t * 180) / Math.PI / 90) * (width - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - ylo) / (yhi - ylo)) * (height - pad.t - pad.b);
  ctx.font = '12px Georgia, serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.rule;
  ctx.fillStyle = colours.muted;
  for (let d = 0; d <= 90; d += 15) {
    const x = X((d * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, height - pad.b);
    ctx.stroke();
    ctx.fillText(`${d}°`, x - 8, height - pad.b + 16);
  }
  ctx.fillText('tilt of the axle from upright', width / 2 - 70, height - 4);
  if (!band.touches) {
    ctx.fillStyle = colours.band;
    ctx.fillRect(X(band.thetaMin), pad.t, Math.max(X(band.thetaMax) - X(band.thetaMin), 1.5), height - pad.t - pad.b);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, width - pad.l - pad.r, height - pad.t - pad.b);
  ctx.clip();
  ctx.strokeStyle = colours.ink;
  ctx.lineWidth = 2;
  poly(ctx, pts.map(([t, v]) => [X(t), Y(v)]));
  ctx.stroke();
  ctx.strokeStyle = colours.trail;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.l, Y(E));
  ctx.lineTo(width - pad.r, Y(E));
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = colours.warn;
  ctx.beginPath();
  ctx.moveTo(X(floor), pad.t);
  ctx.lineTo(X(floor), height - pad.b);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colours.warn;
  ctx.fillText('rim meets the table', X(floor) + 5, pad.t + 12);
  ctx.fillStyle = colours.trail;
  ctx.fillText('energy', width - pad.r - 44, Y(E) - 5);
  ctx.fillStyle = colours.ink;
  ctx.beginPath();
  ctx.arc(X(theta), Y(E), 4.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = colours.muted;
  ctx.save();
  ctx.translate(14, height / 2 + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('energy for nodding', 0, 0);
  ctx.restore();
  return { X, Y, E, ylo, yhi };
}
