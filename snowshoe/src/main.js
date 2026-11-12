import {
  rk4Step, equilibrium, invariant, smallSwingPeriod, measureCycle, orbitExtent, niceCeil, rates,
  netRates, predatorShareOfCatch,
} from './model.js';
import { PRESETS, RATE_SLIDERS } from './presets.js';

const $ = (id) => document.getElementById(id);

const plane = $('plane');
const pctx = plane.getContext('2d');
const series = $('series');
const sctx = series.getContext('2d');

const DT = 0.01;              // integration step
const SAMPLE_EVERY = 2;       // keep one sample per 0.02 time units
const TRAIL_MAX = 6000;       // samples kept per orbit in the plane
const SERIES_MAX = 10000;      // samples kept for the time series
const MAX_ORBITS = 6;
const TIME_PER_SECOND = 2;    // model time units per second at 1x

const state = {
  params: { f: 0, ...PRESETS[0].params },
  orbits: [],
  playing: true,
  speed: 1,
  view: { maxX: 100, maxY: 50 },
  nextColor: 0,
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function makeOrbit(x0, y0, color) {
  return {
    x0, y0, x: x0, y: y0, t: 0, steps: 0, color,
    v0: invariant(state.params, x0, y0),
    trail: [[x0, y0]],
    ts: [0], xs: [x0], ys: [y0],
  };
}

function release(x0, y0) {
  if (!(x0 > 0 && y0 > 0)) return;
  if (state.orbits.length >= MAX_ORBITS) state.orbits.shift();
  state.orbits.push(makeOrbit(x0, y0, state.nextColor % MAX_ORBITS));
  state.nextColor++;
  updateReadout();
}

function restartOrbits() {
  state.orbits = state.orbits.map((o) => makeOrbit(o.x0, o.y0, o.color));
}

function advance(o, steps) {
  const p = state.params;
  for (let i = 0; i < steps; i++) {
    [o.x, o.y] = rk4Step(p, o.x, o.y, DT);
    o.steps++;
    o.t = o.steps * DT;
    if (o.steps % SAMPLE_EVERY === 0) {
      o.trail.push([o.x, o.y]);
      o.ts.push(o.t);
      o.xs.push(o.x);
      o.ys.push(o.y);
    }
  }
  if (o.trail.length > TRAIL_MAX) o.trail.splice(0, o.trail.length - TRAIL_MAX);
  if (o.ts.length > SERIES_MAX + 500) {
    const cut = o.ts.length - SERIES_MAX;
    o.ts.splice(0, cut);
    o.xs.splice(0, cut);
    o.ys.splice(0, cut);
  }
}

// Size the axes so every orbit and the balance point fit with a little room.
function fitView() {
  const p = state.params;
  const eq = equilibrium(p);
  let maxX = eq ? eq.x * 2 : 10;
  let maxY = eq ? eq.y * 2 : 10;
  const span = Math.min(60, 3 * smallSwingPeriod(p));
  for (const o of state.orbits) {
    const ext = orbitExtent(p, o.x0, o.y0, span);
    maxX = Math.max(maxX, ext.maxX, o.x0);
    maxY = Math.max(maxY, ext.maxY, o.y0);
  }
  state.view = { maxX: niceCeil(maxX * 1.08), maxY: niceCeil(maxY * 1.08) };
}

function fitCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: w / dpr, h: h / dpr };
}

const PAD = { left: 46, right: 14, top: 14, bottom: 38 };

function planeFrame() {
  const { w, h } = fitCanvas(plane, pctx);
  const iw = w - PAD.left - PAD.right;
  const ih = h - PAD.top - PAD.bottom;
  const { maxX, maxY } = state.view;
  return {
    w, h, iw, ih,
    px: (x) => PAD.left + (x / maxX) * iw,
    py: (y) => PAD.top + ih - (y / maxY) * ih,
    fromPx: (cx, cy) => [((cx - PAD.left) / iw) * maxX, ((PAD.top + ih - cy) / ih) * maxY],
  };
}

function ticks(max) {
  const step = niceCeil(max / 5);
  const out = [];
  for (let v = 0; v <= max * (1 + 1e-9); v += step) out.push(v);
  return out;
}

function fmt(v) {
  if (v === 0) return '0';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toPrecision(3);
}

// Axis labels: round numbers without trailing zeros.
function tickLabel(v) {
  return String(Number(v.toPrecision(6)));
}

function drawPlane() {
  const f = planeFrame();
  const p = state.params;
  const { maxX, maxY } = state.view;
  pctx.clearRect(0, 0, f.w, f.h);
  pctx.font = '12px Georgia, serif';
  pctx.lineWidth = 1;

  pctx.strokeStyle = cssVar('--grid');
  pctx.fillStyle = cssVar('--muted');
  pctx.textAlign = 'center';
  pctx.textBaseline = 'top';
  for (const v of ticks(maxX)) {
    const x = f.px(v);
    pctx.beginPath();
    pctx.moveTo(x, PAD.top);
    pctx.lineTo(x, PAD.top + f.ih);
    pctx.stroke();
    pctx.fillText(tickLabel(v), x, PAD.top + f.ih + 4);
  }
  pctx.textAlign = 'right';
  pctx.textBaseline = 'middle';
  for (const v of ticks(maxY)) {
    const y = f.py(v);
    pctx.beginPath();
    pctx.moveTo(PAD.left, y);
    pctx.lineTo(PAD.left + f.iw, y);
    pctx.stroke();
    pctx.fillText(tickLabel(v), PAD.left - 6, y);
  }
  pctx.textAlign = 'center';
  pctx.textBaseline = 'bottom';
  pctx.fillText('prey', PAD.left + f.iw / 2, f.h - 2);
  pctx.save();
  pctx.translate(12, PAD.top + f.ih / 2);
  pctx.rotate(-Math.PI / 2);
  pctx.textBaseline = 'middle';
  pctx.fillText('predators', 0, 0);
  pctx.restore();

  // Direction field: short arrows of equal length showing which way each point moves.
  pctx.strokeStyle = cssVar('--arrow');
  // Fewer arrows on a small screen so each stays readable.
  const cols = Math.max(8, Math.min(16, Math.round(f.iw / 34)));
  const rows = Math.max(8, Math.min(16, Math.round(f.ih / 34)));
  const len = Math.min(f.iw / cols, f.ih / rows) * 0.38;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = ((i + 0.5) / cols) * maxX;
      const y = ((j + 0.5) / rows) * maxY;
      const [dx, dy] = rates(p, x, y);
      const sx = (dx / maxX) * f.iw;
      const sy = -(dy / maxY) * f.ih;
      const norm = Math.hypot(sx, sy);
      if (norm === 0) continue;
      const ux = sx / norm;
      const uy = sy / norm;
      const cx = f.px(x);
      const cy = f.py(y);
      const tx = cx + ux * len;
      const ty = cy + uy * len;
      pctx.beginPath();
      pctx.moveTo(cx - ux * len, cy - uy * len);
      pctx.lineTo(tx, ty);
      pctx.moveTo(tx, ty);
      pctx.lineTo(tx - ux * 4 - uy * 3, ty - uy * 4 + ux * 3);
      pctx.moveTo(tx, ty);
      pctx.lineTo(tx - ux * 4 + uy * 3, ty - uy * 4 - ux * 3);
      pctx.stroke();
    }
  }

  // Nullclines and the balance point.
  const eq = equilibrium(p);
  const unfished = p.f > 0 ? equilibrium({ ...p, f: 0 }) : null;
  pctx.strokeStyle = cssVar('--muted');
  pctx.setLineDash([5, 4]);
  pctx.beginPath();
  if (eq && eq.x <= maxX) {
    pctx.moveTo(f.px(eq.x), PAD.top);
    pctx.lineTo(f.px(eq.x), PAD.top + f.ih);
  }
  if (eq && eq.y <= maxY) {
    pctx.moveTo(PAD.left, f.py(eq.y));
    pctx.lineTo(PAD.left + f.iw, f.py(eq.y));
  }
  pctx.stroke();
  pctx.setLineDash([]);

  pctx.save();
  pctx.beginPath();
  pctx.rect(PAD.left, PAD.top, f.iw, f.ih);
  pctx.clip();
  if (unfished) {
    // Where the balance point would sit without fishing.
    pctx.strokeStyle = cssVar('--ink');
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    pctx.arc(f.px(unfished.x), f.py(unfished.y), 5, 0, Math.PI * 2);
    pctx.stroke();
    pctx.lineWidth = 1;
  }
  if (eq && eq.x <= maxX && eq.y <= maxY) {
    pctx.fillStyle = cssVar('--ink');
    pctx.beginPath();
    pctx.arc(f.px(eq.x), f.py(eq.y), 3.5, 0, Math.PI * 2);
    pctx.fill();
  }

  state.orbits.forEach((o, k) => {
    const color = cssVar(`--orbit-${o.color + 1}`);
    const latest = k === state.orbits.length - 1;
    pctx.strokeStyle = color;
    pctx.lineWidth = latest ? 2 : 1.5;
    pctx.beginPath();
    o.trail.forEach(([x, y], i) => (i ? pctx.lineTo(f.px(x), f.py(y)) : pctx.moveTo(f.px(x), f.py(y))));
    pctx.lineTo(f.px(o.x), f.py(o.y));
    pctx.stroke();
    pctx.fillStyle = color;
    pctx.beginPath();
    pctx.arc(f.px(o.x), f.py(o.y), latest ? 5 : 4, 0, Math.PI * 2);
    pctx.fill();
    pctx.strokeStyle = cssVar('--panel');
    pctx.lineWidth = 1.5;
    pctx.stroke();
  });
  pctx.restore();
}

function drawSeries() {
  const { w, h } = fitCanvas(series, sctx);
  sctx.clearRect(0, 0, w, h);
  const o = state.orbits.at(-1);
  const left = 46;
  const right = 14;
  const top = 10;
  const bottom = 26;
  const iw = w - left - right;
  const ih = h - top - bottom;
  sctx.font = '12px Georgia, serif';
  sctx.lineWidth = 1;

  const span = Math.min(60, Math.max(20, 4 * smallSwingPeriod(state.params)));
  const eq = equilibrium(state.params);
  const tEnd = o ? Math.max(o.t, span) : span;
  const tStart = tEnd - span;
  let maxV = eq ? Math.max(eq.x, eq.y) * 1.5 : 10;
  if (o) {
    for (let i = 0; i < o.ts.length; i++) {
      if (o.ts[i] >= tStart) maxV = Math.max(maxV, o.xs[i], o.ys[i]);
    }
  }
  maxV = niceCeil(maxV * 1.05);
  const sx = (t) => left + ((t - tStart) / span) * iw;
  const sy = (v) => top + ih - (v / maxV) * ih;

  sctx.strokeStyle = cssVar('--grid');
  sctx.fillStyle = cssVar('--muted');
  sctx.textAlign = 'right';
  sctx.textBaseline = 'middle';
  for (const v of ticks(maxV)) {
    sctx.beginPath();
    sctx.moveTo(left, sy(v));
    sctx.lineTo(left + iw, sy(v));
    sctx.stroke();
    sctx.fillText(tickLabel(v), left - 6, sy(v));
  }
  sctx.textAlign = 'center';
  sctx.textBaseline = 'top';
  const tStep = niceCeil(span / 6);
  for (let t = Math.ceil(tStart / tStep) * tStep; t <= tEnd + 1e-9; t += tStep) {
    sctx.fillText(tickLabel(t), sx(t), top + ih + 4);
  }

  sctx.setLineDash([5, 4]);
  for (const [v, name] of eq ? [[eq.x, '--prey'], [eq.y, '--pred']] : []) {
    if (v > maxV) continue;
    sctx.strokeStyle = cssVar(name);
    sctx.globalAlpha = 0.7;
    sctx.beginPath();
    sctx.moveTo(left, sy(v));
    sctx.lineTo(left + iw, sy(v));
    sctx.stroke();
  }
  sctx.setLineDash([]);
  sctx.globalAlpha = 1;
  if (!o) return;

  sctx.save();
  sctx.beginPath();
  sctx.rect(left, top, iw, ih);
  sctx.clip();
  sctx.lineWidth = 2;
  for (const [vals, name] of [[o.xs, '--prey'], [o.ys, '--pred']]) {
    sctx.strokeStyle = cssVar(name);
    sctx.beginPath();
    let started = false;
    for (let i = 0; i < o.ts.length; i++) {
      if (o.ts[i] < tStart) continue;
      const X = sx(o.ts[i]);
      const Y = sy(vals[i]);
      if (started) sctx.lineTo(X, Y);
      else { sctx.moveTo(X, Y); started = true; }
    }
    sctx.stroke();
  }
  sctx.restore();
}

function updateReadout() {
  const p = state.params;
  const eq = equilibrium(p);
  const o = state.orbits.at(-1);
  $('r-eq').textContent = eq ? `${fmt(eq.x)} prey, ${fmt(eq.y)} predators` : 'none: predators die out';
  $('r-small').textContent = eq ? smallSwingPeriod(p).toFixed(2) : '–';
  $('r-share').textContent = !eq
    ? 'none in the long run'
    : p.f > 0
    ? `${(100 * predatorShareOfCatch(p)).toFixed(1)}% (unfished balance ${(100 * predatorShareOfCatch({ ...p, f: 0 })).toFixed(1)}%)`
    : `no fishing (balance ${(100 * predatorShareOfCatch(p)).toFixed(1)}%)`;
  if (!o) {
    for (const id of ['r-time', 'r-prey', 'r-pred', 'r-period', 'r-mean', 'r-v']) $(id).textContent = '–';
    return;
  }
  $('r-time').textContent = o.t.toFixed(1);
  $('r-prey').textContent = fmt(o.x);
  $('r-pred').textContent = fmt(o.y);
  const cycle = measureCycle(o.ts, o.xs, o.ys);
  $('r-period').textContent = cycle ? cycle.period.toFixed(2) : 'after two prey peaks';
  $('r-mean').textContent = cycle ? `${fmt(cycle.meanX)} prey, ${fmt(cycle.meanY)} predators` : '–';
  const v = invariant(p, o.x, o.y);
  if (!eq || !(o.x > 0 && o.y > 0)) {
    $('r-v').textContent = 'not conserved without a balance point';
    return;
  }
  const depth = o.v0 - invariant(p, eq.x, eq.y);
  const drift = depth > 1e-12 ? Math.abs(v - o.v0) / depth : 0;
  $('r-v').textContent = `${v.toFixed(4)} (drift ${drift.toExponential(1)})`;
}

let last = null;
let readoutClock = 0;
function frame(now) {
  if (last === null) last = now;
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.playing && state.orbits.length) {
    const steps = Math.max(1, Math.round((elapsed * TIME_PER_SECOND * state.speed) / DT));
    for (const o of state.orbits) advance(o, steps);
  }
  drawPlane();
  drawSeries();
  readoutClock += elapsed;
  if (readoutClock > 0.2) {
    readoutClock = 0;
    updateReadout();
  }
  requestAnimationFrame(frame);
}

// Controls

function buildSliders() {
  const box = $('sliders');
  for (const s of RATE_SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    const id = `rate-${s.key}`;
    wrap.innerHTML = `<label for="${id}">${s.label} <i>${s.symbol}</i></label>`
      + `<input id="${id}" type="range" min="${s.min}" max="${s.max}" step="${s.step}">`
      + `<output for="${id}"></output>`;
    box.append(wrap);
    const input = wrap.querySelector('input');
    const out = wrap.querySelector('output');
    input.addEventListener('input', () => {
      state.params[s.key] = Number(input.value);
      out.textContent = input.value;
      restartOrbits();
      updateReadout();
    });
    input.addEventListener('change', fitView);
    s.input = input;
    s.output = out;
  }
}

function syncSliders() {
  for (const s of RATE_SLIDERS) {
    s.input.value = state.params[s.key];
    s.output.textContent = s.input.value;
  }
}

function applyPreset(id) {
  const preset = PRESETS.find((q) => q.id === id) || PRESETS[0];
  state.params = { f: 0, ...preset.params };
  state.orbits = [];
  state.nextColor = 0;
  for (const [x, y] of preset.starts) release(x, y);
  syncSliders();
  fitView();
  $('preset-note').textContent = preset.note;
  updateReadout();
}

function setPlaying(on) {
  state.playing = on;
  $('play').textContent = on ? 'Pause' : 'Play';
  $('play').setAttribute('aria-pressed', String(on));
  updateReadout();
}

function init() {
  const select = $('preset');
  for (const preset of PRESETS) select.add(new Option(preset.name, preset.id));
  select.addEventListener('change', () => applyPreset(select.value));
  buildSliders();

  $('play').addEventListener('click', () => setPlaying(!state.playing));
  $('clear').addEventListener('click', () => {
    state.orbits = [];
    updateReadout();
  });
  $('fit').addEventListener('click', fitView);
  $('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });
  $('release').addEventListener('click', () => {
    release(Number($('start-x').value), Number($('start-y').value));
  });

  plane.addEventListener('click', (e) => {
    const rect = plane.getBoundingClientRect();
    const f = planeFrame();
    const [x, y] = f.fromPx(e.clientX - rect.left, e.clientY - rect.top);
    if (x <= 0 || y <= 0 || x > state.view.maxX || y > state.view.maxY) return;
    $('start-x').value = fmt(x);
    $('start-y').value = fmt(y);
    release(x, y);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.key === 'c') {
      state.orbits = [];
      updateReadout();
    }
  });

  applyPreset(PRESETS[0].id);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Draw a few finished loops instead of animating them.
    const steps = Math.round(Math.min(60, 3 * smallSwingPeriod(state.params)) / DT);
    for (const o of state.orbits) advance(o, steps);
    setPlaying(false);
    updateReadout();
  }
  requestAnimationFrame(frame);
}

init();
