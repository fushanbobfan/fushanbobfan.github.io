import { waterIndex } from './water.js';
import { deviation, rainbowAngle, descartesImpact, bowAngle, orderWeights, tracePath } from './optics.js';
import { angularProfile, colourProfile } from './scatter.js';
import { wavelengthColor, encode } from './color.js';
import { antisolarAngle, bowTop, project, unproject } from './sky.js';
import { radialAngle, filterWeights, polarizationDegree } from './polarizer.js';

const $ = (id) => document.getElementById(id);
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

const D_LINE = 589.3;
const SPLIT = [700, 530, 400].map((l) => ({ l, color: wavelengthColor(l) }));
const WHITE = '#f4f1e8';

const COLORS = {
  drop: 'rgba(120, 170, 255, 0.10)',
  dropEdge: '#4d6a99',
  grid: '#1b2030',
  axis: '#5d6478',
  label: '#9a9fb3',
  band: 'rgba(255, 255, 255, 0.05)',
  marker: '#ffd23c',
};

const state = {
  sun: 12,
  show: { 1: true, 2: true },
  fromAir: false,
  filter: false,
  axis: 0,
  exposure: 1,
  order: 1,
  x: 0.6,
  fan: false,
  spread: true,
  tables: null,
  base: 1,
};

const canvases = {
  sky: $('sky'),
  drop: $('drop'),
  plot: $('plot'),
};

function fitCanvas(c) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return dpr;
}

// ---------- sky ----------

const skyBuffer = document.createElement('canvas');

// The view is a stereographic projection: its width spans a fixed angle of
// sky, and from the ground it is aimed so the horizon sits low in the frame.
function skyFrame(w, h) {
  const across = (w > 1.6 * h ? 120 : 140) * RAD;
  const s = w / 2 / (2 * Math.tan(across / 4));
  const el0 = state.fromAir ? -state.sun * RAD : 2 * Math.atan((0.34 * h) / (2 * s));
  return { s, el0, w, h };
}

function toSky(f, az, el) {
  const [x, y] = project(az, el, f.el0);
  return [f.w / 2 + x * f.s, f.h / 2 - y * f.s];
}

function background(el) {
  if (state.fromAir) return [0.075, 0.085, 0.105];
  if (el < 0) return [0.03, 0.045, 0.03];
  const t = Math.min(1, el / (60 * RAD));
  return [0.11 - 0.07 * t, 0.125 - 0.07 * t, 0.16 - 0.07 * t];
}

function renderSky() {
  const c = canvases.sky;
  const dpr = fitCanvas(c);
  const ctx = c.getContext('2d');
  const W = Math.min(800, c.width);
  const H = Math.max(1, Math.round((W * c.height) / c.width));
  const f = skyFrame(W, H);
  const sun = state.sun * RAD;
  skyBuffer.width = W;
  skyBuffer.height = H;
  const bctx = skyBuffer.getContext('2d');
  const img = bctx.createImageData(W, H);
  const t = state.tables;
  const gain = state.base * state.exposure;
  // Any linear polarizer removes half of unpolarized light; the exposure is
  // doubled under the filter so the plain sky keeps its brightness.
  const axis = state.axis * RAD;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const [az, el] = unproject((px + 0.5 - W / 2) / f.s, (H / 2 - py - 0.5) / f.s, f.el0);
      const bg = background(el);
      const lit = state.fromAir || el >= 0;
      let r = bg[0];
      let g = bg[1];
      let b = bg[2];
      if (t && lit) {
        const a = antisolarAngle(az, el, sun) * DEG;
        const bin = Math.floor(a / t[1].binDeg);
        let ws = 1;
        let wp = 1;
        if (state.filter && bin < t[1].bins) {
          const w = filterWeights(radialAngle(az, el, sun, f.el0), axis);
          ws = 2 * w.s;
          wp = 2 * w.p;
        }
        if (bin < t[1].bins) {
          for (const k of [1, 2]) {
            if (!state.show[k]) continue;
            const { rgbS, rgbP } = t[k];
            r += gain * (ws * rgbS[3 * bin] + wp * rgbP[3 * bin]);
            g += gain * (ws * rgbS[3 * bin + 1] + wp * rgbP[3 * bin + 1]);
            b += gain * (ws * rgbS[3 * bin + 2] + wp * rgbP[3 * bin + 2]);
          }
        }
      }
      const o = 4 * (py * W + px);
      img.data[o] = encode(r);
      img.data[o + 1] = encode(g);
      img.data[o + 2] = encode(b);
      img.data[o + 3] = 255;
    }
  }
  bctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(skyBuffer, 0, 0, c.width, c.height);

  // Overlay in full-resolution pixels.
  const F = skyFrame(c.width, c.height);
  ctx.save();
  ctx.font = `${11 * dpr}px system-ui, sans-serif`;
  if (!state.fromAir) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = dpr;
    ctx.beginPath();
    let labelY = 0;
    for (let j = 0; j <= 120; j++) {
      const [hx, hy] = toSky(F, ((j / 120) * 2 - 1) * 1.5, 0);
      if (j) ctx.lineTo(hx, hy);
      else ctx.moveTo(hx, hy);
      if (hx < 40 * dpr) labelY = hy;
    }
    ctx.stroke();
    const hy = labelY;
    ctx.fillStyle = COLORS.label;
    ctx.fillText('horizon', 8 * dpr, hy - 5 * dpr);
  }
  const [ax, ay] = toSky(F, 0, -sun);
  if (ay < c.height) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5 * dpr;
    const s = 6 * dpr;
    ctx.beginPath();
    ctx.moveTo(ax - s, ay);
    ctx.lineTo(ax + s, ay);
    ctx.moveTo(ax, ay - s);
    ctx.lineTo(ax, ay + s);
    ctx.stroke();
  }
  // The ring that the current ray belongs to.
  const n = waterIndex(D_LINE);
  const alpha = rainbowAngle(state.x, n, state.order);
  if (alpha < 85 * RAD) {
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeStyle = 'rgba(255, 210, 60, 0.7)';
    ctx.lineWidth = dpr;
    ring(ctx, F, -sun, alpha);
    ctx.setLineDash([]);
    const top = toSky(F, 0, -sun + alpha);
    ctx.fillStyle = COLORS.marker;
    ctx.fillText(`your ray: ${(alpha * DEG).toFixed(1)}°`, top[0] + 6 * dpr, top[1] - 6 * dpr);
  }
  if (state.filter) drawFilterDial(ctx, c.width - 34 * dpr, 34 * dpr, 22 * dpr, dpr);
  if (!state.tables) {
    ctx.fillStyle = COLORS.label;
    ctx.font = `${13 * dpr}px system-ui, sans-serif`;
    ctx.fillText('Following a few million rays through the drop…', 12 * dpr, 22 * dpr);
  }
  ctx.restore();
}

// The filter's transmission axis, drawn as a line across a ring.
function drawFilterDial(ctx, x, y, r, dpr) {
  const a = state.axis * RAD;
  ctx.fillStyle = 'rgba(10, 12, 18, 0.55)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = COLORS.marker;
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
  ctx.lineTo(x + Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8);
  ctx.stroke();
}

// A circle on the sky of angular radius alpha about the antisolar point,
// which sits at elevation a.
function ring(ctx, F, a, alpha) {
  ctx.beginPath();
  let pen = false;
  let lastX = 0;
  for (let j = 0; j <= 240; j++) {
    const psi = (j / 240) * 2 * Math.PI;
    const x = Math.cos(a) * Math.cos(alpha) - Math.sin(a) * Math.sin(alpha) * Math.cos(psi);
    const y = Math.sin(alpha) * Math.sin(psi);
    const z = Math.sin(a) * Math.cos(alpha) + Math.cos(a) * Math.sin(alpha) * Math.cos(psi);
    const el = Math.asin(Math.max(-1, Math.min(1, z)));
    const az = Math.atan2(y, x);
    const [px, py] = toSky(F, az, el);
    const hidden = !state.fromAir && el < 0;
    if (hidden || (pen && Math.abs(px - lastX) > F.w / 3)) {
      pen = false;
      if (hidden) continue;
    }
    if (pen) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    pen = true;
    lastX = px;
  }
  ctx.stroke();
}

// ---------- drop ----------

function dropFrame() {
  const c = canvases.drop;
  return { cx: 0.6 * c.width, cy: 0.5 * c.height, R: 0.28 * Math.min(c.width, c.height) };
}

function renderDrop() {
  const c = canvases.drop;
  const dpr = fitCanvas(c);
  const ctx = c.getContext('2d');
  const { cx, cy, R } = dropFrame();
  const P = (p) => [cx + p[0] * R, cy - p[1] * R];
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = COLORS.drop;
  ctx.strokeStyle = COLORS.dropEdge;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(c.width, cy);
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  const k = state.order;
  if (state.fan) {
    const n = waterIndex(D_LINE);
    ctx.strokeStyle = 'rgba(244, 241, 232, 0.28)';
    ctx.lineWidth = dpr;
    for (let j = 0; j < 32; j++) drawRay(ctx, P, (j + 0.5) / 32, n, k, 6);
  }
  const rays = state.spread ? SPLIT : [{ l: D_LINE, color: WHITE }];
  ctx.lineWidth = 2 * dpr;
  for (const ray of rays) {
    ctx.strokeStyle = ray.color;
    drawRay(ctx, P, state.x, waterIndex(ray.l), k, 6);
  }
  ctx.restore();

  // The angle between the way back to the sun and the outgoing ray.
  const n = waterIndex(D_LINE);
  const { points, out } = tracePath(state.x, n, k);
  const exit = P(points[points.length - 1]);
  const a0 = Math.PI;
  const a1 = Math.atan2(-out[1], out[0]);
  const alpha = rainbowAngle(state.x, n, k);
  if (alpha < Math.PI - 0.02) {
    ctx.strokeStyle = COLORS.marker;
    ctx.lineWidth = dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(exit[0], exit[1]);
    ctx.lineTo(exit[0] - 1.1 * R, exit[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    let turn = a1 - a0;
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn <= -Math.PI) turn += 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(exit[0], exit[1], 0.42 * R, a0, a1, turn < 0);
    ctx.stroke();
    const bx = -1 + out[0];
    const by = -out[1];
    const bl = Math.hypot(bx, by) || 1;
    const lx = exit[0] + (bx / bl) * 0.62 * R - 14 * dpr;
    const ly = exit[1] + (by / bl) * 0.62 * R + 4 * dpr;
    ctx.fillStyle = COLORS.marker;
    ctx.font = `${12 * dpr}px system-ui, sans-serif`;
    ctx.fillText(`${(alpha * DEG).toFixed(1)}°`, lx, ly);
  }

  ctx.fillStyle = COLORS.label;
  ctx.font = `${11 * dpr}px system-ui, sans-serif`;
  ctx.fillText('sunlight →', 8 * dpr, cy - state.x * R - 6 * dpr);
}

function drawRay(ctx, P, x, n, k, reach) {
  const { points, out } = tracePath(x, n, k);
  const last = points[points.length - 1];
  ctx.beginPath();
  const start = P(points[0]);
  ctx.moveTo(start[0], start[1]);
  for (const p of points.slice(1)) {
    const q = P(p);
    ctx.lineTo(q[0], q[1]);
  }
  const end = P([last[0] + reach * out[0], last[1] + reach * out[1]]);
  ctx.lineTo(end[0], end[1]);
  ctx.stroke();
}

function setImpactFromPointer(e) {
  const c = canvases.drop;
  const rect = c.getBoundingClientRect();
  const y = ((e.clientY - rect.top) / rect.height) * c.height;
  const { cy, R } = dropFrame();
  setImpact((cy - y) / R);
}

// ---------- plot ----------

function plotFrame() {
  const c = canvases.plot;
  const dpr = window.devicePixelRatio || 1;
  const left = 38 * dpr;
  const right = 46 * dpr;
  const top = 12 * dpr;
  const bottom = 30 * dpr;
  const w = c.width - left - right;
  const h = c.height - top - bottom;
  return {
    X: (x) => left + x * w,
    Y: (deg) => top + h - (deg / 90) * h,
    left, top, w, h, dpr,
  };
}

function renderPlot() {
  const c = canvases.plot;
  fitCanvas(c);
  const ctx = c.getContext('2d');
  const F = plotFrame();
  const { X, Y, dpr } = F;
  ctx.clearRect(0, 0, c.width, c.height);

  // Alexander's band: no ray of any colour leaves between the outer edge of
  // the primary and the inner edge of the secondary.
  const red = waterIndex(700);
  const b1 = bowAngle(red, 1) * DEG;
  const b2 = bowAngle(red, 2) * DEG;
  ctx.fillStyle = COLORS.band;
  ctx.fillRect(X(0), Y(b2), F.w, Y(b1) - Y(b2));
  ctx.fillStyle = COLORS.label;
  ctx.font = `${10.5 * dpr}px system-ui, sans-serif`;
  ctx.fillText("Alexander's dark band", X(0.03), Y((b1 + b2) / 2) + 4 * dpr);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = dpr;
  ctx.beginPath();
  for (let d = 0; d <= 90; d += 10) {
    ctx.moveTo(X(0), Y(d));
    ctx.lineTo(X(1), Y(d));
  }
  for (let x = 0; x <= 1.0001; x += 0.25) {
    ctx.moveTo(X(x), Y(0));
    ctx.lineTo(X(x), Y(90));
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.label;
  ctx.textAlign = 'right';
  for (let d = 0; d <= 90; d += 30) ctx.fillText(`${d}°`, X(0) - 5 * dpr, Y(d) + 4 * dpr);
  ctx.textAlign = 'center';
  for (const x of [0, 0.5, 1]) ctx.fillText(String(x), X(x), Y(0) + 14 * dpr);
  ctx.fillText('impact parameter', X(0.5), Y(0) + 26 * dpr);
  ctx.textAlign = 'left';

  const rays = state.spread ? SPLIT : [{ l: D_LINE, color: WHITE }];
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(0), Y(90), F.w, F.h);
  ctx.clip();
  for (const k of [1, 2]) {
    for (const ray of rays) {
      const n = waterIndex(ray.l);
      ctx.strokeStyle = ray.color;
      ctx.globalAlpha = k === state.order ? 1 : 0.35;
      ctx.lineWidth = (k === state.order ? 1.8 : 1) * dpr;
      ctx.beginPath();
      for (let j = 0; j <= 400; j++) {
        const x = Math.min(0.9999, j / 400);
        const y = Y(rainbowAngle(x, n, k) * DEG);
        if (j) ctx.lineTo(X(x), y);
        else ctx.moveTo(X(x), y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Where rays of yellow light end up, for an evenly lit drop.
  const n = waterIndex(D_LINE);
  const counts = new Array(90).fill(0);
  const samples = 6000;
  for (let j = 0; j < samples; j++) {
    const a = rainbowAngle(Math.sqrt((j + 0.5) / samples), n, state.order) * DEG;
    if (a < 90) counts[Math.floor(a)]++;
  }
  const peak = Math.max(...counts);
  ctx.fillStyle = 'rgba(255, 210, 60, 0.55)';
  for (let d = 0; d < 90; d++) {
    const len = (counts[d] / peak) * 38 * dpr;
    ctx.fillRect(X(1) + 4 * dpr, Y(d + 1), len, Y(d) - Y(d + 1) - 0.5);
  }
  ctx.fillStyle = COLORS.label;
  ctx.save();
  ctx.translate(X(1) + 30 * dpr, Y(85));
  ctx.fillText('rays', -18 * dpr, 0);
  ctx.restore();

  // The current ray.
  ctx.strokeStyle = COLORS.marker;
  ctx.lineWidth = dpr;
  ctx.setLineDash([3 * dpr, 3 * dpr]);
  ctx.beginPath();
  ctx.moveTo(X(state.x), Y(0));
  ctx.lineTo(X(state.x), Y(90));
  ctx.stroke();
  ctx.setLineDash([]);
  const a = rainbowAngle(state.x, n, state.order) * DEG;
  if (a <= 90) {
    ctx.fillStyle = COLORS.marker;
    ctx.beginPath();
    ctx.arc(X(state.x), Y(a), 4 * dpr, 0, 2 * Math.PI);
    ctx.fill();
  }
  const xd = descartesImpact(n, state.order);
  const ad = bowAngle(n, state.order) * DEG;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2 * dpr;
  ctx.beginPath();
  ctx.arc(X(xd), Y(ad), 6 * dpr, 0, 2 * Math.PI);
  ctx.stroke();
}

// ---------- readout ----------

function fmt(v, d = 1) {
  return `${v.toFixed(d)}°`;
}

function updateReadout() {
  const n = waterIndex(D_LINE);
  const k = state.order;
  const i = Math.asin(state.x);
  const r = Math.asin(state.x / n);
  const D = deviation(state.x, n, k);
  const alpha = rainbowAngle(state.x, n, k);
  const w = orderWeights(state.x, n, k);
  $('r-i').textContent = fmt(i * DEG);
  $('r-r').textContent = fmt(r * DEG);
  $('r-d').textContent = fmt(D * DEG);
  $('r-a').textContent = fmt(alpha * DEG);
  $('r-w').textContent = `${(((w.s + w.p) / 2) * 100).toFixed(2)}%`;
  const edges = (kk) => [bowAngle(waterIndex(400), kk) * DEG, bowAngle(waterIndex(700), kk) * DEG];
  const [v1, r1] = edges(1);
  const [v2, r2] = edges(2);
  $('r-b1').textContent = `${fmt(v1)} to ${fmt(r1)}`;
  $('r-b2').textContent = `${fmt(r2)} to ${fmt(v2)}`;
  $('r-band').textContent = `${fmt(r2 - r1)} wide`;
  const top = bowTop(r1, state.sun);
  $('r-top').textContent = top > 0 ? `${fmt(top)} up` : 'below the horizon';
  $('impact-out').textContent = state.x.toFixed(3);
  $('sun-out').textContent = fmt(state.sun);

  const xd = descartesImpact(n, k);
  let note;
  if (Math.abs(state.x - xd) < 0.02) {
    note = `This is Descartes' rainbow ray. Its neighbours leave at almost the same angle, ${fmt(bowAngle(n, k) * DEG)}, so light from a wide strip of the drop piles up there.`;
  } else if (k === 1) {
    note = `No ray with one reflection leaves more than ${fmt(bowAngle(n, 1) * DEG)} from the antisolar point, so the sky inside the primary is lit and the sky just outside it is not.`;
  } else {
    note = `With two reflections no ray comes back closer than ${fmt(bowAngle(n, 2) * DEG)} to the antisolar point, and the colours run the other way: red inside, violet outside.`;
  }
  if (top <= 0 && !state.fromAir) {
    note += ' With the sun this high, the primary bow is below the horizon from the ground.';
  }
  $('r-pol').textContent = state.bowPolarization === undefined ? '…' : `${Math.round(state.bowPolarization * 100)}% along the bow`;
  if (state.filter) {
    note += ' Through the filter the bow fades where the axis points at the antisolar point and brightens where it runs along the bow.';
  }
  $('note').textContent = note;
}

// ---------- state changes ----------

function renderAll() {
  updateReadout();
  renderDrop();
  renderPlot();
  renderSky();
}

function setImpact(x) {
  state.x = Math.max(0, Math.min(0.999, x));
  $('impact').value = state.x;
  renderAll();
}

function setOrder(k) {
  state.order = k;
  $('order-1').setAttribute('aria-pressed', String(k === 1));
  $('order-2').setAttribute('aria-pressed', String(k === 2));
  renderAll();
}

function goDescartes() {
  setImpact(descartesImpact(waterIndex(D_LINE), state.order));
}

function computeTables() {
  const t = {
    1: colourProfile(angularProfile({ orders: [1] })),
    2: colourProfile(angularProfile({ orders: [2] })),
  };
  // Scale so that the brightest part of the primary comes out just below full.
  let peak = 0;
  const { bins, binDeg, rgbS, rgbP } = t[1];
  for (let b = Math.round(30 / binDeg); b < Math.min(bins, Math.round(46 / binDeg)); b++) {
    const lum = 0.2126 * (rgbS[3 * b] + rgbP[3 * b]) + 0.7152 * (rgbS[3 * b + 1] + rgbP[3 * b + 1]) + 0.0722 * (rgbS[3 * b + 2] + rgbP[3 * b + 2]);
    peak = Math.max(peak, lum);
  }
  state.base = 0.55 / peak;
  let best = 0;
  let at = 0;
  for (let b = Math.round(38 / binDeg); b < Math.round(44 / binDeg); b++) {
    const lum = 0.7152 * (rgbS[3 * b + 1] + rgbP[3 * b + 1]);
    if (lum > best) {
      best = lum;
      at = b;
    }
  }
  state.bowPolarization = polarizationDegree(rgbS.slice(3 * at, 3 * at + 3), rgbP.slice(3 * at, 3 * at + 3));
  state.tables = t;
}

$('sun').addEventListener('input', (e) => {
  state.sun = Number(e.target.value);
  renderAll();
});
$('exposure').addEventListener('input', (e) => {
  state.exposure = Number(e.target.value);
  renderSky();
});
$('show-1').addEventListener('change', (e) => {
  state.show[1] = e.target.checked;
  renderSky();
});
$('show-2').addEventListener('change', (e) => {
  state.show[2] = e.target.checked;
  renderSky();
});
function setFilter(on) {
  state.filter = on;
  $('filter').checked = on;
  renderSky();
  updateReadout();
}

$('filter').addEventListener('change', (e) => setFilter(e.target.checked));
$('axis').addEventListener('input', (e) => {
  state.axis = Number(e.target.value);
  $('axis-out').textContent = `${state.axis}°`;
  if (state.filter) renderSky();
  else setFilter(true);
});
$('from-air').addEventListener('change', (e) => {
  state.fromAir = e.target.checked;
  renderAll();
});
$('impact').addEventListener('input', (e) => setImpact(Number(e.target.value)));
$('order-1').addEventListener('click', () => setOrder(1));
$('order-2').addEventListener('click', () => setOrder(2));
$('descartes').addEventListener('click', goDescartes);
$('fan').addEventListener('change', (e) => {
  state.fan = e.target.checked;
  renderDrop();
});
$('spread').addEventListener('change', (e) => {
  state.spread = e.target.checked;
  renderDrop();
  renderPlot();
});

const drop = canvases.drop;
drop.addEventListener('pointerdown', (e) => {
  drop.setPointerCapture(e.pointerId);
  setImpactFromPointer(e);
});
drop.addEventListener('pointermove', (e) => {
  if (drop.hasPointerCapture(e.pointerId)) setImpactFromPointer(e);
});
drop.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 0.001 : 0.01;
  if (e.key === 'ArrowUp') setImpact(state.x + step);
  else if (e.key === 'ArrowDown') setImpact(state.x - step);
  else return;
  e.preventDefault();
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '1') setOrder(1);
  else if (e.key === '2') setOrder(2);
  else if (e.key === 'd' || e.key === 'D') goDescartes();
  else if (e.key === 'p' || e.key === 'P') setFilter(!state.filter);
});

let pending = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(renderAll);
}).observe(document.querySelector('.views'));

renderAll();
setTimeout(() => {
  computeTables();
  renderAll();
}, 30);
