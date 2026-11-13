import {
  createString, step, setParams, positions, velocities, modeEnergies, totalEnergy,
  modeFrequency, continuumFrequency, overtoneRatios, beatPeriod, pluckShape, nudgeShape, modeOnly,
} from './model.js';
import { PRESETS, SLIDERS, BEADS, initialShape, initialVelocity } from './presets.js';
import { partials, amplitudeSum, createVoice } from './sound.js';

const $ = (id) => document.getElementById(id);

const stringCanvas = $('string');
const sctx = stringCanvas.getContext('2d');
const strip = $('strip');
const tctx = strip.getContext('2d');
const spectrum = $('spectrum');
const bctx = spectrum.getContext('2d');
const dispersion = $('dispersion');
const dctx = dispersion.getContext('2d');

const TIME_PER_SECOND = 6;   // model time units per second at 1x
const MAX_FRAME = 0.1;       // seconds; longer gaps (a hidden tab) are clipped
const ROW = 1;               // strip pixels per row
const ROW_DT = 0.3;          // model time per strip row: 200 rows span 60 units
const MARGIN = 28;           // room for the walls in the string and strip views
const MODE_AMP = 0.6;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  preset: PRESETS[0],
  n: PRESETS[0].n,
  params: { ...PRESETS[0].params },
  start: null,
  startVelocity: null,
  string: null,
  eRef: 0,
  aRef: 0,
  voice: null,
  listening: false,
  smoothTune: false,
  playing: !reducedMotion,
  speed: 1,
  held: null,
  pointer: null,
  grab: 'pluck',
  sinceRow: 0,
};

let colors = {};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toRgb(color) {
  tctx.fillStyle = '#000';
  tctx.fillStyle = color;
  const hex = tctx.fillStyle;
  if (!hex.startsWith('#')) return [128, 128, 128];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function readColors() {
  colors = {
    panel: cssVar('--panel'), ink: cssVar('--ink'), muted: cssVar('--muted'),
    rule: cssVar('--rule'), grid: cssVar('--grid'), string: cssVar('--string'),
    bead: cssVar('--bead'), held: cssVar('--bead-held'), bar: cssVar('--bar'),
    smooth: cssVar('--smooth'), up: toRgb(cssVar('--up')), down: toRgb(cssVar('--down')),
  };
}

// ---- state changes -------------------------------------------------------

// The bars and the sound level are measured against the motion at its
// start, so damping visibly and audibly fades it.
function resetScale() {
  const e = modeEnergies(state.string);
  state.eRef = Math.max(...e, 0);
  state.aRef = amplitudeSum(e, state.string.omega);
}

function growScale() {
  const e = modeEnergies(state.string);
  state.eRef = Math.max(state.eRef, ...e);
  state.aRef = Math.max(state.aRef, amplitudeSum(e, state.string.omega));
}

// A held or paused string is silent; otherwise every mode sounds.
function updateSound() {
  if (!state.voice || !state.listening) return;
  const s = state.string;
  const moving = state.playing && state.held === null;
  const list = partials(modeEnergies(s), s.omega, state.aRef, { smooth: state.smoothTune });
  state.voice.set(moving ? list : list.map((p) => ({ ...p, gain: 0 })));
}

async function setListening(on) {
  if (on && !state.voice) state.voice = createVoice();
  if (!state.voice) {
    $('listen').checked = false;
    $('listen').disabled = true;
    $('listen-hint').textContent = 'This browser cannot play sound from a page.';
    return;
  }
  state.listening = on;
  $('smooth-tune').disabled = !on;
  if (on) {
    updateSound();
    await state.voice.on();
  } else {
    state.voice.off();
  }
}

function startFrom(shape, velocity = null) {
  state.start = Float64Array.from(shape);
  state.startVelocity = velocity ? Float64Array.from(velocity) : null;
  state.string = createString(state.n, state.params, shape, velocity);
  resetScale();
  clearStrip();
  if (reducedMotion && !state.playing) prefillStrip();
  updateReadout();
}

function applyPreset(preset) {
  state.preset = preset;
  state.n = preset.n;
  state.params = { ...preset.params };
  syncControls();
  showNote();
  startFrom(initialShape(preset.init, state.n), initialVelocity(preset.init, state.n));
}

function showNote() {
  const p = state.preset;
  const changed = state.n === p.n ? '' : ` This setup was written for ${p.n} ${p.n === 1 ? 'bead' : 'beads'}; the string now has ${state.n}.`;
  $('preset-note').textContent = p.note + changed;
}

function setBeadCount(n) {
  state.n = n;
  syncControls();
  showNote();
  startFrom(initialShape(state.preset.init, n), initialVelocity(state.preset.init, n));
}

function restart() {
  startFrom(state.start, state.startVelocity);
}

// A strike knocks one bead sideways from rest at the given speed.
function strike(bead, speed) {
  startFrom(new Float64Array(state.n), nudgeShape(state.n, bead, speed));
}

function grabShape(bead, height) {
  return state.grab === 'nudge'
    ? nudgeShape(state.n, bead, height)
    : pluckShape(state.n, bead, height);
}

function playMode(k, add) {
  const fresh = modeOnly(state.n, k, MODE_AMP);
  if (!add) {
    startFrom(fresh);
    return;
  }
  const y = positions(state.string);
  const v = velocities(state.string);
  for (let j = 0; j < state.n; j++) y[j] += fresh[j];
  const t = state.string.t;
  state.start = Float64Array.from(y);
  state.startVelocity = Float64Array.from(v);
  state.string = createString(state.n, state.params, y, v);
  state.string.t = t;
  growScale();
  updateReadout();
}

function setPlaying(on) {
  state.playing = on;
  const button = $('play');
  button.textContent = on ? 'Pause' : 'Play';
  button.setAttribute('aria-pressed', String(on));
}

// ---- controls ------------------------------------------------------------

function fmtSlider(key, v) {
  return v.toFixed(2);
}

function buildControls() {
  const select = $('preset');
  for (const p of PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.append(opt);
  }
  select.addEventListener('change', () => applyPreset(PRESETS.find((p) => p.id === select.value)));

  const box = $('sliders');
  for (const s of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    const label = document.createElement('label');
    label.htmlFor = `p-${s.key}`;
    label.textContent = s.label;
    const input = document.createElement('input');
    Object.assign(input, { id: `p-${s.key}`, type: 'range', min: s.min, max: s.max, step: s.step });
    const out = document.createElement('output');
    out.id = `p-${s.key}-out`;
    out.htmlFor = input.id;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      state.params[s.key] = v;
      out.textContent = fmtSlider(s.key, v);
      setParams(state.string, { [s.key]: v });
      growScale();
      updateReadout();
    });
    wrap.append(label, input, out);
    box.append(wrap);
  }

  const beads = $('beads');
  beads.min = BEADS.min;
  beads.max = BEADS.max;
  beads.addEventListener('input', () => {
    $('beads-out').textContent = beads.value;
    setBeadCount(Number(beads.value));
  });

  $('play').addEventListener('click', () => setPlaying(!state.playing));
  $('restart').addEventListener('click', restart);
  $('still').addEventListener('click', () => startFrom(new Float64Array(state.n)));
  $('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });

  $('listen').addEventListener('change', (e) => setListening(e.target.checked));
  $('smooth-tune').addEventListener('change', (e) => { state.smoothTune = e.target.checked; });

  for (const radio of document.querySelectorAll('input[name="grab"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.grab = radio.value;
      const striking = radio.value === 'strike';
      $('pluck').textContent = striking ? 'Strike' : 'Pluck';
      $('pluck-size-label').textContent = striking ? 'Speed' : 'Height';
    });
  }

  $('pluck').addEventListener('click', () => {
    const bead = clampInt($('pluck-bead').value, 1, state.n);
    const height = Math.max(-1, Math.min(1, Number($('pluck-height').value) || 0));
    $('pluck-bead').value = bead;
    if (state.grab === 'strike') strike(bead, height);
    else startFrom(grabShape(bead, height));
  });
  $('mode-play').addEventListener('click', () => {
    const k = clampInt($('mode-k').value, 1, state.n);
    $('mode-k').value = k;
    playMode(k, false);
  });

  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.key === 'r') {
      restart();
    }
  });
}

function clampInt(v, lo, hi) {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo;
}

function syncControls() {
  $('preset').value = state.preset.id;
  $('beads').value = state.n;
  $('beads-out').textContent = state.n;
  for (const s of SLIDERS) {
    $(`p-${s.key}`).value = state.params[s.key];
    $(`p-${s.key}-out`).textContent = fmtSlider(s.key, state.params[s.key]);
  }
  $('pluck-bead').max = state.n;
  $('mode-k').max = state.n;
  if (Number($('pluck-bead').value) > state.n) $('pluck-bead').value = state.n;
  if (Number($('mode-k').value) > state.n) $('mode-k').value = state.n;
}

// ---- geometry ------------------------------------------------------------

function beadX(j, width) {
  return MARGIN + (j * (width - 2 * MARGIN)) / (state.n + 1);
}

function stringScale() {
  return stringCanvas.height / 2 - 24;
}

function canvasPoint(canvas, event) {
  const r = canvas.getBoundingClientRect();
  return [((event.clientX - r.left) * canvas.width) / r.width, ((event.clientY - r.top) * canvas.height) / r.height];
}

function nearestBead(x) {
  const spacing = (stringCanvas.width - 2 * MARGIN) / (state.n + 1);
  return clampInt((x - MARGIN) / spacing, 1, state.n);
}

function heightAt(y) {
  const h = (stringCanvas.height / 2 - y) / stringScale();
  return Math.max(-1, Math.min(1, h));
}

// ---- pointer -------------------------------------------------------------

// One pointer at a time holds a bead; a second finger is ignored.
stringCanvas.addEventListener('pointerdown', (e) => {
  if (state.held !== null) return;
  const [x, y] = canvasPoint(stringCanvas, e);
  if (state.grab === 'strike') {
    strike(nearestBead(x), heightAt(y));
    return;
  }
  state.pointer = e.pointerId;
  state.held = nearestBead(x);
  stringCanvas.setPointerCapture(e.pointerId);
  stringCanvas.classList.add('held');
  state.string = createString(state.n, state.params, grabShape(state.held, heightAt(y)));
});

stringCanvas.addEventListener('pointermove', (e) => {
  if (state.held === null || e.pointerId !== state.pointer) return;
  const [, y] = canvasPoint(stringCanvas, e);
  state.string = createString(state.n, state.params, grabShape(state.held, heightAt(y)));
});

function release(e) {
  if (state.held === null || e.pointerId !== state.pointer) return;
  state.held = null;
  state.pointer = null;
  stringCanvas.classList.remove('held');
  startFrom(positions(state.string));
}

stringCanvas.addEventListener('pointerup', release);
stringCanvas.addEventListener('pointercancel', release);

spectrum.addEventListener('click', (e) => {
  const [x] = canvasPoint(spectrum, e);
  const g = spectrumGeometry();
  if (x < g.left || x > g.left + g.width) return;
  const k = clampInt(Math.floor((x - g.left) / g.barW) + 1, 1, state.n);
  playMode(k, e.shiftKey);
});

// ---- drawing -------------------------------------------------------------

function drawString() {
  const { width: W, height: H } = stringCanvas;
  const mid = H / 2;
  const scale = stringScale();
  const y = positions(state.string);
  sctx.fillStyle = colors.panel;
  sctx.fillRect(0, 0, W, H);

  sctx.strokeStyle = colors.grid;
  sctx.lineWidth = 1;
  sctx.setLineDash([4, 5]);
  sctx.beginPath();
  sctx.moveTo(MARGIN, mid);
  sctx.lineTo(W - MARGIN, mid);
  sctx.stroke();
  sctx.setLineDash([]);

  sctx.strokeStyle = colors.muted;
  sctx.lineWidth = 4;
  sctx.beginPath();
  sctx.moveTo(MARGIN, mid - scale - 10);
  sctx.lineTo(MARGIN, mid + scale + 10);
  sctx.moveTo(W - MARGIN, mid - scale - 10);
  sctx.lineTo(W - MARGIN, mid + scale + 10);
  sctx.stroke();

  // Each bead's own spring, when there is one, as a tie to the axis.
  if (state.params.anchor > 0) {
    sctx.strokeStyle = colors.smooth;
    sctx.lineWidth = 1;
    sctx.setLineDash([2, 3]);
    sctx.beginPath();
    for (let j = 1; j <= state.n; j++) {
      sctx.moveTo(beadX(j, W), mid);
      sctx.lineTo(beadX(j, W), mid - y[j - 1] * scale);
    }
    sctx.stroke();
    sctx.setLineDash([]);
  }

  sctx.strokeStyle = colors.string;
  sctx.lineWidth = 1.5;
  sctx.beginPath();
  sctx.moveTo(MARGIN, mid);
  for (let j = 1; j <= state.n; j++) sctx.lineTo(beadX(j, W), mid - y[j - 1] * scale);
  sctx.lineTo(W - MARGIN, mid);
  sctx.stroke();

  const r = Math.max(3.5, Math.min(10, 180 / state.n));
  for (let j = 1; j <= state.n; j++) {
    sctx.fillStyle = j === state.held ? colors.held : colors.bead;
    sctx.beginPath();
    sctx.arc(beadX(j, W), mid - y[j - 1] * scale, r, 0, 2 * Math.PI);
    sctx.fill();
  }
}

function clearStrip() {
  state.sinceRow = 0;
  tctx.fillStyle = colors.panel;
  tctx.fillRect(0, 0, strip.width, strip.height);
}

function stripRow(y) {
  const W = strip.width;
  const H = strip.height;
  tctx.drawImage(strip, 0, -ROW);
  tctx.fillStyle = colors.panel;
  tctx.fillRect(0, H - ROW, W, ROW);
  const spacing = (W - 2 * MARGIN) / (state.n + 1);
  for (let j = 1; j <= state.n; j++) {
    const v = y[j - 1];
    const a = Math.min(1, Math.abs(v) / 0.5);
    if (a < 0.02) continue;
    const [r, g, b] = v > 0 ? colors.up : colors.down;
    tctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    tctx.fillRect(beadX(j, W) - spacing / 2, H - ROW, spacing + 0.5, ROW);
  }
}

// With motion reduced the page starts paused, so run the first stretch at
// once and draw it, leaving the string where that stretch ends.
function prefillStrip() {
  const rows = Math.floor(strip.height / ROW);
  for (let i = 0; i < rows; i++) {
    if (i > 0) step(state.string, ROW_DT);
    stripRow(positions(state.string));
  }
}

function spectrumGeometry() {
  const left = 10;
  const right = 8;
  const top = 10;
  const bottom = 24;
  const width = spectrum.width - left - right;
  const height = spectrum.height - top - bottom;
  return { left, top, width, height, barW: width / state.n };
}

function drawSpectrum() {
  const g = spectrumGeometry();
  const e = modeEnergies(state.string);
  bctx.fillStyle = colors.panel;
  bctx.fillRect(0, 0, spectrum.width, spectrum.height);
  bctx.strokeStyle = colors.rule;
  bctx.lineWidth = 1;
  bctx.beginPath();
  bctx.moveTo(g.left, g.top + g.height + 0.5);
  bctx.lineTo(g.left + g.width, g.top + g.height + 0.5);
  bctx.stroke();

  const gap = g.barW > 6 ? 2 : 0.5;
  bctx.fillStyle = colors.bar;
  for (let k = 0; k < state.n; k++) {
    const h = state.eRef > 0 ? Math.min(1, e[k] / state.eRef) * g.height : 0;
    if (h < 0.5) continue;
    bctx.fillRect(g.left + k * g.barW + gap / 2, g.top + g.height - h, g.barW - gap, h);
  }

  bctx.fillStyle = colors.muted;
  bctx.font = '12px Georgia, serif';
  bctx.textBaseline = 'top';
  bctx.textAlign = 'center';
  const labelY = g.top + g.height + 6;
  bctx.fillText('1', g.left + g.barW / 2, labelY);
  if (state.n > 1) bctx.fillText(String(state.n), g.left + g.width - g.barW / 2, labelY);
  if (state.n > 4) bctx.fillText('mode', g.left + g.width / 2, labelY);
}

function drawDispersion() {
  const W = dispersion.width;
  const H = dispersion.height;
  const left = 30;
  const right = 10;
  const top = 12;
  const bottom = 24;
  const pw = W - left - right;
  const ph = H - top - bottom;
  const n = state.n;
  const p = state.params;
  const latticeAt = (kk) => Math.sqrt(p.anchor ** 2 + 4 * p.coupling ** 2 * Math.sin((kk * Math.PI) / (2 * (n + 1))) ** 2);
  const smoothAt = (kk) => Math.sqrt(p.anchor ** 2 + ((p.coupling * kk * Math.PI) / (n + 1)) ** 2);
  const top0 = Math.max(latticeAt(n + 1), smoothAt(n) * 0.75, 0.1) * 1.12;
  const X = (kk) => left + (kk / (n + 1)) * pw;
  const Y = (w) => top + ph - (w / top0) * ph;

  dctx.fillStyle = colors.panel;
  dctx.fillRect(0, 0, W, H);
  dctx.strokeStyle = colors.rule;
  dctx.lineWidth = 1;
  dctx.beginPath();
  dctx.moveTo(left, top);
  dctx.lineTo(left, top + ph);
  dctx.lineTo(left + pw, top + ph);
  dctx.stroke();

  dctx.save();
  dctx.beginPath();
  dctx.rect(left, top, pw, ph);
  dctx.clip();

  const ceiling = latticeAt(n + 1);
  dctx.strokeStyle = colors.grid;
  dctx.setLineDash([2, 4]);
  dctx.beginPath();
  dctx.moveTo(left, Y(ceiling));
  dctx.lineTo(left + pw, Y(ceiling));
  dctx.stroke();

  dctx.strokeStyle = colors.smooth;
  dctx.setLineDash([5, 4]);
  dctx.lineWidth = 1.5;
  dctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const kk = (i / 100) * (n + 1);
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    dctx[fn](X(kk), Y(smoothAt(kk)));
  }
  dctx.stroke();
  dctx.setLineDash([]);

  dctx.strokeStyle = colors.bar;
  dctx.lineWidth = 1;
  dctx.globalAlpha = 0.5;
  dctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const kk = (i / 100) * (n + 1);
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    dctx[fn](X(kk), Y(latticeAt(kk)));
  }
  dctx.stroke();
  dctx.globalAlpha = 1;
  dctx.restore();

  const e = modeEnergies(state.string);
  dctx.fillStyle = colors.bar;
  for (let k = 1; k <= n; k++) {
    const share = state.eRef > 0 ? Math.min(1, e[k - 1] / state.eRef) : 0;
    const r = 2 + 4 * Math.sqrt(share);
    dctx.beginPath();
    dctx.arc(X(k), Y(modeFrequency(n, k, p)), r, 0, 2 * Math.PI);
    dctx.fill();
  }

  dctx.fillStyle = colors.muted;
  dctx.font = '12px Georgia, serif';
  dctx.textAlign = 'right';
  dctx.textBaseline = 'middle';
  dctx.fillText(ceiling.toFixed(2), left - 4, Y(ceiling));
  dctx.fillText('0', left - 4, top + ph);
  dctx.textAlign = 'center';
  dctx.textBaseline = 'top';
  dctx.fillText('mode', left + pw / 2, top + ph + 6);
  dctx.save();
  dctx.translate(10, top + ph / 2);
  dctx.rotate(-Math.PI / 2);
  dctx.textBaseline = 'middle';
  dctx.fillText('frequency', 0, 0);
  dctx.restore();
}

// ---- readout -------------------------------------------------------------

function fmt(v, digits = 3) {
  if (!Number.isFinite(v)) return '∞';
  if (v === 0) return '0';
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(digits);
}

function updateReadout() {
  const s = state.string;
  const n = state.n;
  const p = state.params;
  const w1 = modeFrequency(n, 1, p);
  $('r-time').textContent = s.t.toFixed(1);
  $('r-low').textContent = w1 > 0 ? `${fmt(w1)} (period ${fmt((2 * Math.PI) / w1)})` : '0';
  const ratios = overtoneRatios(n, p, 3);
  $('r-ratios').textContent = w1 > 0 && ratios.length ? ratios.map((r) => r.toFixed(2)).join(', ') : '—';
  const s1 = continuumFrequency(n, 1, p);
  const smooth = [];
  for (let k = 2; k <= Math.min(n, 4); k++) smooth.push(continuumFrequency(n, k, p) / s1);
  $('r-smooth').textContent = s1 > 0 && smooth.length ? smooth.map((r) => r.toFixed(2)).join(', ') : '—';
  $('r-high').textContent = fmt(modeFrequency(n, n, p));
  $('r-energy').textContent = fmt(totalEnergy(s));
  $('r-beat').textContent = n === 2 ? fmt(beatPeriod(p)) : 'only with 2 beads';
}

// ---- loop ----------------------------------------------------------------

// Step to each strip row's exact time so the strip has an even time axis
// whatever the frame rate.
function advance(dt) {
  let left = dt;
  while (left > 1e-12) {
    const h = Math.min(left, ROW_DT - state.sinceRow);
    step(state.string, h);
    state.sinceRow += h;
    left -= h;
    if (state.sinceRow >= ROW_DT - 1e-9) {
      stripRow(positions(state.string));
      state.sinceRow = 0;
    }
  }
}

let last = performance.now();
let sinceReadout = 0;

function frame(now) {
  const seconds = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  if (state.playing && state.held === null) advance(seconds * state.speed * TIME_PER_SECOND);
  drawString();
  drawSpectrum();
  drawDispersion();
  updateSound();
  sinceReadout += seconds;
  if (sinceReadout > 0.1) {
    sinceReadout = 0;
    updateReadout();
  }
  requestAnimationFrame(frame);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  readColors();
  clearStrip();
});

readColors();
buildControls();
setPlaying(state.playing);
applyPreset(PRESETS[0]);
requestAnimationFrame(frame);
