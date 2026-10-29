import { solve, cycle, step, crankArc, ground, couplerOffsets, branchOf, wrap } from './linkage.js';
import { classify, closes } from './grashof.js';
import { PRESETS } from './presets.js';
import { cognatePose, cognateLinks, couplerRatio } from './cognates.js';
import { velocities, speedColor, speedRange } from './velocity.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const COLORS = {
  grid: '#1a1a26',
  ground: '#6f6c82',
  crank: '#ffbe3c',
  coupler: '#ff7a59',
  rocker: '#9fb4ff',
  curve: '#6bd3ff',
  other: '#3d6a80',
  joint: '#e6e4ee',
  label: '#9a97ab',
  cognate1: '#7ee08a',
  cognate2: '#c792ea',
};

const state = {
  link: null,
  theta: 0,
  branch: 1,
  dir: 1,
  running: false,
  view: { cx: 0, cy: 0, scale: 50 },
  drag: null,
  hover: null,
  curve: null,
  other: null,
};

function loadPreset(id) {
  const p = PRESETS.find((q) => q.id === id) || PRESETS[0];
  state.link = structuredClone(p.link);
  state.theta = p.theta;
  state.branch = p.branch;
  state.dir = 1;
  $('preset').value = p.id;
  $('preset-note').textContent = p.note;
  $('caption').textContent = p.name;
  rebuild();
  fit();
}

function pose() {
  return solve(state.link, state.theta, state.branch);
}

// Recompute everything that depends on the shape of the linkage.
function rebuild() {
  state.curve = cycle(state.link, state.theta, state.branch, 900);
  state.other = state.curve && state.curve.full ? cycle(state.link, state.theta, -state.branch, 900) : null;
  state.speeds = state.curve ? state.curve.poses.map((p) => velocities(state.link, p)?.speed ?? Infinity) : [];
  state.range = speedRange(state.speeds);
  syncInputs();
  updateReadout();
}

// Try a new shape, keeping the current crank angle and assembly if possible.
// Returns false and leaves the linkage alone when the loop cannot close.
function tryLink(next, theta = state.theta, branch = state.branch) {
  const g = ground(next).g;
  if (!closes({ a: next.a, b: next.b, c: next.c, g }) || g < 1e-6) return false;
  for (const br of [branch, -branch]) {
    if (solve(next, theta, br)) {
      commit(next, theta, br);
      return true;
    }
  }
  // Move the crank to the nearest angle where the loop closes.
  for (let k = 1; k <= 180; k++) {
    for (const t of [theta + (k * Math.PI) / 180, theta - (k * Math.PI) / 180]) {
      if (solve(next, t, branch)) {
        commit(next, t, branch);
        return true;
      }
    }
  }
  return false;
}

function commit(link, theta, branch) {
  state.link = link;
  state.theta = theta;
  state.branch = branch;
  rebuild();
}

// ---- view ----------------------------------------------------------------

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function fit() {
  const pts = [state.link.A, state.link.D];
  for (const c of [state.curve, state.other]) {
    if (!c) continue;
    for (const p of c.poses) pts.push(p.B, p.C, p.P);
  }
  if (showingCognates() && state.curve) {
    for (const p of state.curve.poses) {
      const k = cognatePose(state.link, p);
      pts.push(k.O, k.E, k.F, k.G, k.H);
    }
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 450;
  const pad = 36;
  state.view.scale = Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-3), (h - 2 * pad) / Math.max(y1 - y0, 1e-3));
  state.view.cx = (x0 + x1) / 2;
  state.view.cy = (y0 + y1) / 2;
}

function toScreen(p) {
  const { cx, cy, scale } = state.view;
  return { x: canvas.clientWidth / 2 + (p.x - cx) * scale, y: canvas.clientHeight / 2 - (p.y - cy) * scale };
}

function toWorld(sx, sy) {
  const { cx, cy, scale } = state.view;
  return { x: cx + (sx - canvas.clientWidth / 2) / scale, y: cy - (sy - canvas.clientHeight / 2) / scale };
}

function offScreen(p) {
  const s = toScreen(p);
  return s.x < 8 || s.y < 8 || s.x > canvas.clientWidth - 8 || s.y > canvas.clientHeight - 8;
}

// ---- drawing ---------------------------------------------------------------

function drawGrid() {
  const { scale } = state.view;
  let unit = 1;
  while (unit * scale < 24) unit *= 2;
  while (unit * scale > 96) unit /= 2;
  const tl = toWorld(0, 0);
  const br = toWorld(canvas.clientWidth, canvas.clientHeight);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor(tl.x / unit) * unit; x <= br.x; x += unit) {
    const s = toScreen({ x, y: 0 }).x;
    ctx.moveTo(s, 0); ctx.lineTo(s, canvas.clientHeight);
  }
  for (let y = Math.floor(br.y / unit) * unit; y <= tl.y; y += unit) {
    const s = toScreen({ x: 0, y }).y;
    ctx.moveTo(0, s); ctx.lineTo(canvas.clientWidth, s);
  }
  ctx.stroke();
}

function polyline(points, closed) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const s = toScreen(p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  if (closed) ctx.closePath();
}

function bar(p, q, color, width) {
  const s = toScreen(p);
  const t = toScreen(q);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(t.x, t.y);
  ctx.stroke();
}

function pivot(p) {
  const s = toScreen(p);
  ctx.fillStyle = COLORS.ground;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x - 10, s.y + 16);
  ctx.lineTo(s.x + 10, s.y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.ground;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = -12; i <= 8; i += 5) {
    ctx.moveTo(s.x + i, s.y + 22);
    ctx.lineTo(s.x + i + 5, s.y + 17);
  }
  ctx.moveTo(s.x - 14, s.y + 17);
  ctx.lineTo(s.x + 14, s.y + 17);
  ctx.stroke();
}

function joint(p, r, fill, active) {
  const s = toScreen(p);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(s.x, s.y, active ? r + 2 : r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#101018';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function label(p, text, dx = 10, dy = -10) {
  const s = toScreen(p);
  ctx.fillStyle = COLORS.label;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(text, s.x + dx, s.y + dy);
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (!state.link) return;
  drawGrid();

  if (state.other && $('show-other').checked) {
    ctx.strokeStyle = COLORS.other;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    polyline(state.other.poses.map((p) => p.P), true);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (state.curve && $('speed-color').checked) {
    drawSpeedCurve();
  } else if (state.curve) {
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2;
    polyline(state.curve.poses.map((p) => p.P), true);
    ctx.stroke();
  }

  const { A, D } = state.link;
  const p = pose();
  if (p && showingCognates()) drawCognates(p);
  bar(A, D, COLORS.ground, 1.5);
  if (p) {
    const tri = [p.B, p.C, p.P];
    ctx.fillStyle = 'rgba(255, 122, 89, 0.18)';
    polyline(tri, true);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 122, 89, 0.55)';
    ctx.lineWidth = 2;
    polyline(tri, true);
    ctx.stroke();
    bar(p.B, p.P, COLORS.coupler, 3);
    bar(p.C, p.P, COLORS.coupler, 3);
    bar(p.B, p.C, COLORS.coupler, 6);
    bar(A, p.B, COLORS.crank, 6);
    bar(D, p.C, COLORS.rocker, 6);
  }
  pivot(A);
  pivot(D);
  const hv = state.drag?.what ?? state.hover;
  joint(A, 6, COLORS.joint, hv === 'A');
  joint(D, 6, COLORS.joint, hv === 'D');
  label(A, 'A', -20, -8);
  label(D, 'D', 10, -8);
  if (p) {
    joint(p.B, 5, COLORS.joint, hv === 'B');
    joint(p.C, 5, COLORS.joint, hv === 'C');
    if ($('show-velocity').checked) {
      const v = velocities(state.link, p, state.dir);
      if (v) arrow(p.P, v.vP.x, v.vP.y, COLORS.joint);
    }
    joint(p.P, 6, COLORS.curve, hv === 'P');
    label(p.B, 'B');
    label(p.C, 'C');
    label(p.P, 'P');
  }
}

// Each piece of the curve takes the colour of the coupler point's speed
// there, for a crank turning at a steady rate.
function drawSpeedCurve() {
  const { poses } = state.curve;
  const { lo, hi } = state.range;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < poses.length; i++) {
    const j = (i + 1) % poses.length;
    const s = toScreen(poses[i].P);
    const t = toScreen(poses[j].P);
    ctx.strokeStyle = speedColor((state.speeds[i] + state.speeds[j]) / 2, lo, hi);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }
}

function arrow(from, vx, vy, color) {
  const s = toScreen(from);
  const len = Math.hypot(vx, vy);
  if (len < 1e-9) return;
  // screen y points down
  const px = Math.min(120, (60 * len) / Math.max(state.range.hi, 1e-9));
  const ux = vx / len;
  const uy = -vy / len;
  const tx = s.x + ux * px;
  const ty = s.y + uy * px;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - ux * 9 - uy * 5, ty - uy * 9 + ux * 5);
  ctx.lineTo(tx - ux * 9 + uy * 5, ty - uy * 9 - ux * 5);
  ctx.closePath();
  ctx.fill();
}

// The cognates collapse when P sits on B or C: one of their bars has no length.
function cognatesExist() {
  const z = couplerRatio(state.link);
  return Math.hypot(z.x, z.y) > 1e-3 && Math.hypot(1 - z.x, z.y) > 1e-3;
}

function showingCognates() {
  return $('show-cognates').checked && cognatesExist();
}

function drawCognates(p) {
  const { A, D } = state.link;
  const k = cognatePose(state.link, p);
  bar(A, k.O, COLORS.ground, 1);
  bar(D, k.O, COLORS.ground, 1);
  for (const [B, C, piv, color, fill] of [
    [k.E, k.G, A, COLORS.cognate1, 'rgba(126, 224, 138, 0.12)'],
    [k.F, k.H, D, COLORS.cognate2, 'rgba(199, 146, 234, 0.12)'],
  ]) {
    ctx.fillStyle = fill;
    polyline([B, C, p.P], true);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    bar(B, C, color, 3);
    bar(C, p.P, color, 3);
    bar(B, p.P, color, 3);
    bar(piv, B, color, 3);
    bar(k.O, C, color, 3);
    ctx.globalAlpha = 1;
    joint(B, 4, color, false);
    joint(C, 4, color, false);
  }
  pivot(k.O);
  joint(k.O, 6, COLORS.joint, false);
  label(k.O, 'O', 10, -8);
  label(k.E, 'E');
  label(k.G, 'G');
  label(k.F, 'F');
  label(k.H, 'H');
}

function updateCognates() {
  const ok = cognatesExist();
  $('use-1').disabled = !ok;
  $('use-2').disabled = !ok;
  const p = pose();
  const out = $('cognate-list');
  out.textContent = '';
  if (!ok || !p) {
    $('cognate-note').textContent = 'P sits on a joint of the coupler, so the cognates collapse.';
    return;
  }
  $('cognate-note').textContent = 'Three different linkages, one curve. The third pivot O makes a triangle with A and D similar to the coupler triangle BCP.';
  const g = (q, r) => Math.hypot(q.x - r.x, q.y - r.y);
  const rows = [['Original', 'A, D', state.link.a, state.link.b, state.link.c, g(state.link.A, state.link.D)]];
  cognateLinks(state.link, p).forEach((cog, i) => {
    rows.push([`Cognate ${i + 1}`, i === 0 ? 'A, O' : 'D, O', cog.link.a, cog.link.b, cog.link.c, g(cog.link.A, cog.link.D)]);
  });
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const [j, v] of r.entries()) {
      const td = document.createElement('td');
      td.textContent = j < 2 ? v : v.toFixed(2);
      tr.append(td);
    }
    out.append(tr);
  }
}

function useCognate(i) {
  const p = pose();
  if (!p || !cognatesExist()) return;
  const cog = cognateLinks(state.link, p)[i];
  const link = { ...cog.link, A: { ...cog.link.A }, D: { ...cog.link.D } };
  const theta = Math.atan2(cog.B.y - link.A.y, cog.B.x - link.A.x);
  commit(link, theta, branchOf(cog.B, cog.C, link.D));
  state.dir = 1;
  $('caption').textContent = `Cognate ${i + 1} of the last linkage`;
  fit();
  draw();
}

// ---- readout ---------------------------------------------------------------

const deg = (r) => `${((r * 180) / Math.PI).toFixed(1)}°`;
const fmt = (x) => x.toFixed(2);

function syncInputs(force = false) {
  const { a, b, c } = state.link;
  const g = ground(state.link).g;
  for (const [id, v] of [['len-a', a], ['len-b', b], ['len-c', c], ['len-g', g]]) {
    const el = $(id);
    if (force || document.activeElement !== el) el.value = v.toFixed(2);
  }
}

function updateReadout() {
  const { a, b, c } = state.link;
  const g = ground(state.link).g;
  const info = classify({ a, b, c, g });
  $('r-type').textContent = info.name;
  const bars = [a, b, c, g].sort((x, y) => x - y);
  const sl = bars[0] + bars[3];
  const pq = bars[1] + bars[2];
  const rel = Math.abs(info.margin) < 1e-9 ? '=' : sl < pq ? '<' : '>';
  $('r-sl').textContent = `${fmt(sl)} ${rel} p + q = ${fmt(pq)}`;

  const arc = crankArc(state.link, state.theta);
  $('r-range').textContent = !arc ? '—' : arc.full ? 'full turn' : `${deg(wrapSigned(arc.lo))} to ${deg(wrapSigned(arc.lo) + arc.hi - arc.lo)} (${deg(arc.hi - arc.lo)})`;

  let worst = Infinity;
  if (state.curve) for (const q of state.curve.poses) worst = Math.min(worst, q.mu, Math.PI - q.mu);
  $('r-mu-min').textContent = Number.isFinite(worst) ? deg(worst) : '—';

  const notes = [];
  if (info.outputTurns && !info.inputTurns) notes.push('The rocker DC turns fully while the crank only rocks.');
  if (info.type === 'double-crank') notes.push('Both AB and DC turn fully.');
  if (arc && !arc.full) notes.push('The crank rocks between two toggles, where coupler and rocker line up, and the loop changes assembly at each one; the curve includes both.');
  if (info.type === 'change-point') notes.push('s + l = p + q: the bars can line up flat, and there the linkage can switch assembly.');
  $('note').textContent = notes.join(' ');
  const finite = state.speeds.filter(Number.isFinite);
  $('r-speed-range').textContent = finite.length
    ? `${Math.min(...finite).toFixed(2)} to ${state.curve.full ? Math.max(...finite).toFixed(2) : 'unbounded'}`
    : '—';
  updateCognates();
  updateLive();
}

function wrapSigned(r) {
  const x = wrap(r);
  return x > Math.PI ? x - 2 * Math.PI : x;
}

function updateLive() {
  const p = pose();
  $('r-crank').textContent = deg(wrapSigned(state.theta));
  $('r-mu').textContent = p ? deg(p.mu) : '—';
  const v = p && velocities(state.link, p);
  $('r-speed').textContent = v ? `${v.speed.toFixed(2)} per radian` : 'at a toggle';
  $('r-ratio').textContent = v ? v.w4.toFixed(2) : '—';
}

// ---- interaction -----------------------------------------------------------

function handles() {
  const p = pose();
  const list = [['P', p?.P], ['B', p?.B], ['C', p?.C], ['A', state.link.A], ['D', state.link.D]];
  return list.filter(([, q]) => q);
}

function hit(sx, sy) {
  let best = null;
  let bestD = 14;
  for (const [what, q] of handles()) {
    const s = toScreen(q);
    const d = Math.hypot(s.x - sx, s.y - sy);
    if (d < bestD) {
      best = what;
      bestD = d;
    }
  }
  return best;
}

function local(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function dragTo(what, w) {
  const link = structuredClone(state.link);
  const p = pose();
  if (what === 'A' || what === 'D') {
    link[what] = w;
    if (!tryLink(link)) setStatus('The loop cannot close with the pivot there.');
    return;
  }
  if (!p) return;
  if (what === 'B') {
    const a = Math.hypot(w.x - link.A.x, w.y - link.A.y);
    if (a < 0.05) return;
    link.a = a;
    if (!tryLink(link, Math.atan2(w.y - link.A.y, w.x - link.A.x))) setStatus('The coupler and rocker cannot reach B there.');
  } else if (what === 'C') {
    const b = Math.hypot(w.x - p.B.x, w.y - p.B.y);
    const c = Math.hypot(w.x - link.D.x, w.y - link.D.y);
    if (b < 0.05 || c < 0.05) return;
    link.b = b;
    link.c = c;
    // keep P where it sits relative to B and the new C
    Object.assign(link, couplerOffsets(p.B, w, p.P));
    tryLink(link, state.theta, branchOf(p.B, w, link.D));
  } else if (what === 'P') {
    Object.assign(link, couplerOffsets(p.B, p.C, w));
    tryLink(link);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  const s = local(e);
  const what = hit(s.x, s.y);
  if (!what) return;
  state.drag = { what };
  canvas.setPointerCapture(e.pointerId);
  setStatus('');
  e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
  const s = local(e);
  if (state.drag) {
    dragTo(state.drag.what, toWorld(s.x, s.y));
    draw();
    return;
  }
  const h = hit(s.x, s.y);
  if (h !== state.hover) {
    state.hover = h;
    canvas.style.cursor = h ? 'grab' : 'default';
    draw();
  }
});

function endDrag() {
  if (!state.drag) return;
  state.drag = null;
  const p = pose();
  const pts = [state.link.A, state.link.D, ...(state.curve ? state.curve.poses.map((q) => q.P) : [])];
  if (p) pts.push(p.B, p.C);
  if (pts.some(offScreen)) fit();
  draw();
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function setStatus(text) {
  $('status').textContent = text;
}

function setLength(key, value) {
  if (!(value > 0.05)) return;
  const link = structuredClone(state.link);
  if (key === 'g') {
    const { g, phi } = ground(link);
    if (g < 1e-9) return;
    link.D = { x: link.A.x + value * Math.cos(phi), y: link.A.y + value * Math.sin(phi) };
  } else {
    link[key] = value;
  }
  if (tryLink(link)) {
    setStatus('');
    fit();
  } else {
    setStatus('The longest bar must be shorter than the other three together.');
    syncInputs(true);
  }
  draw();
}

for (const key of ['a', 'b', 'c', 'g']) {
  $(`len-${key}`).addEventListener('change', (e) => setLength(key, Number(e.target.value)));
}

function setRunning(on) {
  state.running = on;
  $('play').textContent = on ? 'Stop ' : 'Run ';
  const k = document.createElement('kbd');
  k.textContent = 'Space';
  $('play').append(k);
  if (on) {
    last = performance.now();
    requestAnimationFrame(tick);
  }
}

function turn(dtheta) {
  const next = step(state.link, { theta: state.theta, branch: state.branch, dir: state.dir }, dtheta);
  state.theta = next.theta;
  state.branch = next.branch;
  state.dir = next.dir;
  updateLive();
}

function flip() {
  if (solve(state.link, state.theta, -state.branch)) {
    state.branch = -state.branch;
    rebuild();
    draw();
  }
}

$('play').addEventListener('click', () => setRunning(!state.running));
$('reverse').addEventListener('click', () => { state.dir = -state.dir; });
$('flip').addEventListener('click', flip);
$('show-other').addEventListener('change', draw);
$('speed-color').addEventListener('change', draw);
$('show-velocity').addEventListener('change', draw);
$('show-cognates').addEventListener('change', () => {
  fit();
  draw();
});
$('use-1').addEventListener('click', () => useCognate(0));
$('use-2').addEventListener('click', () => useCognate(1));
$('preset').addEventListener('change', (e) => {
  loadPreset(e.target.value);
  draw();
});

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const sign = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1;
    if (sign !== state.dir) state.dir = -state.dir;
    turn((e.shiftKey ? 0.5 : 3) * (Math.PI / 180));
    draw();
    e.preventDefault();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === ' ') {
    setRunning(!state.running);
    e.preventDefault();
  } else if (e.key === 'r' || e.key === 'R') {
    state.dir = -state.dir;
  } else if (e.key === 'f' || e.key === 'F') {
    flip();
  } else if (e.key === 'g' || e.key === 'G') {
    $('show-cognates').checked = !$('show-cognates').checked;
    fit();
    draw();
  }
});

let last = 0;
function tick(now) {
  if (!state.running) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.drag) turn(Number($('speed').value) * dt * 1.5);
  draw();
  requestAnimationFrame(tick);
}

for (const p of PRESETS) {
  const o = document.createElement('option');
  o.value = p.id;
  o.textContent = p.name;
  $('preset').append(o);
}

new ResizeObserver(() => {
  fit();
  resize();
}).observe(canvas);
loadPreset('loop');
resize();
