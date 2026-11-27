import {
  MAX_N,
  BOHR_ANGSTROM,
  makeOrbital,
  radialTable,
  radialNodes,
  enclosingRadius,
  mostProbableRadius,
  meanRadius,
  energyEV,
} from './hydrogen.js';
import { sampleOrbital, peakDensity } from './sampler.js';
import { sliceValues, shadeSlice, PLANES } from './slice.js';
import { viewMatrix, project, renderCloud } from './cloud.js';
import { drawChart } from './chart.js';
import { SHELL_LETTERS, shapeLabel, orbitalName, describeNodes } from './names.js';

const $ = (id) => document.getElementById(id);
const els = {
  n: $('n'), l: $('l'), m: $('m'), name: $('name'), note: $('note'),
  count: $('count'), spin: $('spin'), resample: $('resample'),
  plane: $('plane'), shade: $('shade'),
  cloud: $('cloud'), slice: $('slice'), chart: $('chart'),
  hover: $('hover'), sliceCaption: $('slice-caption'), readouts: $('readouts'),
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) els.spin.checked = false;

const state = {
  n: 3, l: 2, m: 0,
  seed: 1,
  yaw: -0.6, pitch: 0.35,
  orbital: null, table: null, half: 1, sample: null, slice: null, densityPeak: 0, probe: null,
};

const SIZE = els.cloud.width;
const cloudCtx = els.cloud.getContext('2d');
const sliceCtx = els.slice.getContext('2d');
const chartCtx = els.chart.getContext('2d');
const cloudImage = cloudCtx.createImageData(SIZE, SIZE);
const sliceImage = sliceCtx.createImageData(SIZE, SIZE);

function fillSelect(select, items, value) {
  select.replaceChildren(...items.map(([v, text]) => {
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = text;
    return o;
  }));
  select.value = String(value);
}

function syncSelects() {
  fillSelect(els.n, Array.from({ length: MAX_N }, (_, i) => [i + 1, String(i + 1)]), state.n);
  if (state.l >= state.n) state.l = state.n - 1;
  fillSelect(els.l, Array.from({ length: state.n }, (_, l) => [l, `${l} (${SHELL_LETTERS[l]})`]), state.l);
  if (Math.abs(state.m) > state.l) state.m = 0;
  const ms = [];
  for (let m = -state.l; m <= state.l; m++) {
    const shape = shapeLabel(state.l, m);
    const sign = m < 0 ? '−' : '';
    ms.push([m, state.l === 0 ? '0' : `${sign}${Math.abs(m)} (${shape})`]);
  }
  fillSelect(els.m, ms, state.m);
}

const fmt = (x, d = 2) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function computeOrbital() {
  const { n, l, m } = state;
  state.orbital = makeOrbital(n, l, m);
  state.table = radialTable(n, l);
  state.half = enclosingRadius(state.table, 0.99) * 1.08;
  state.nodes = radialNodes(n, l);
  state.peakRadius = mostProbableRadius(n, l, state.table);
  state.densityPeak = peakDensity(n, l, m, state.table);
  els.name.textContent = orbitalName(n, l, m);
  els.note.textContent = describeNodes(n, l, m);
}

function computeSample() {
  const count = Number(els.count.value);
  state.sample = sampleOrbital(state.n, state.l, state.m, count, state.seed, state.table);
}

function drawSlice() {
  const plane = els.plane.value;
  state.slice = sliceValues(state.orbital.psi, plane, state.half, SIZE);
  // On a nodal plane psi is only rounding noise; shade it against the
  // orbital's own peak so it stays black.
  const nodal = state.slice.peak <= 1e-9 * state.densityPeak;
  const ref = nodal ? state.densityPeak : state.slice.peak;
  shadeSlice(state.slice, els.shade.value, sliceImage.data, ref);
  sliceCtx.putImageData(sliceImage, 0, 0);
  drawScaleBar(sliceCtx);
  const p = PLANES[plane];
  sliceCtx.fillStyle = 'rgba(255,255,255,0.75)';
  sliceCtx.font = '12px system-ui, sans-serif';
  sliceCtx.textAlign = 'right';
  sliceCtx.textBaseline = 'middle';
  sliceCtx.fillText(p.h + ' →', SIZE - 8, SIZE / 2 - 10);
  sliceCtx.textAlign = 'center';
  sliceCtx.textBaseline = 'top';
  sliceCtx.fillText('↑ ' + p.v, SIZE / 2 + 12, 6);
  const name = orbitalName(state.n, state.l, state.m);
  if (nodal) {
    els.sliceCaption.textContent = `The ${p.label} is a node of ${name}: ψ is zero everywhere on it, so the electron is never found there. Try another plane.`;
  } else {
    els.sliceCaption.textContent = `ψ on the ${p.label}, through the nucleus. Dark lines are nodes, where ψ is zero. Point at it, or tab to it and use the arrow keys, to read the density.`;
  }
  els.slice.setAttribute('aria-label',
    `${name} on the ${p.label}${nodal ? ', which is a node' : ''}. Arrow keys move a probe that reads the density.`);
  showProbe();
}

function drawScaleBar(ctx) {
  const pxPerBohr = SIZE / (2 * state.half);
  const target = state.half / 3;
  const mag = 10 ** Math.floor(Math.log10(target));
  let len = mag;
  for (const f of [1, 2, 5]) if (f * mag <= target) len = f * mag;
  const x0 = 14;
  const y0 = SIZE - 16;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + len * pxPerBohr, y0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const ang = len * BOHR_ANGSTROM;
  ctx.fillText(`${+len.toFixed(2)} a₀ = ${ang < 1 ? fmt(ang, 2) : fmt(ang, 1)} Å`, x0, y0 - 4);
}

function drawCloud() {
  const M = viewMatrix(state.yaw, state.pitch);
  renderCloud(state.sample, M, state.half, SIZE, cloudImage.data);
  cloudCtx.putImageData(cloudImage, 0, 0);
  drawAxes(M);
  drawScaleBar(cloudCtx);
}

function drawAxes(M) {
  const cx = SIZE - 44;
  const cy = SIZE - 44;
  const L = 26;
  const axes = [['x', 1, 0, 0], ['y', 0, 1, 0], ['z', 0, 0, 1]]
    .map(([name, x, y, z]) => ({ name, p: project(M, x, y, z) }))
    .sort((a, b) => a.p[2] - b.p[2]);
  cloudCtx.font = '12px system-ui, sans-serif';
  cloudCtx.textAlign = 'center';
  cloudCtx.textBaseline = 'middle';
  for (const { name, p } of axes) {
    const alpha = 0.45 + 0.4 * (p[2] + 1) / 2;
    cloudCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
    cloudCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    cloudCtx.lineWidth = 1.5;
    cloudCtx.beginPath();
    cloudCtx.moveTo(cx, cy);
    cloudCtx.lineTo(cx + L * p[0], cy - L * p[1]);
    cloudCtx.stroke();
    cloudCtx.fillText(name, cx + (L + 9) * p[0], cy - (L + 9) * p[1]);
  }
}

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawRadialChart() {
  drawChart(chartCtx, els.chart.width, els.chart.height, {
    table: state.table,
    rView: state.half,
    nodes: state.nodes,
    peakRadius: state.peakRadius,
    mean: meanRadius(state.n, state.l),
    sample: state.sample,
    colors: {
      grid: cssColor('--grid'),
      muted: cssColor('--muted'),
      curve: cssColor('--accent'),
      hist: cssColor('--hist'),
      node: cssColor('--node'),
      mean: cssColor('--mean'),
    },
  });
  const name = orbitalName(state.n, state.l, state.m);
  els.chart.setAttribute('aria-label',
    `Radial distribution of ${name}: most likely at ${fmt(state.peakRadius)} Bohr radii, mean ${fmt(meanRadius(state.n, state.l))}` +
    (state.nodes.length ? `, zero at ${state.nodes.map((r) => fmt(r)).join(', ')}` : ''));
}

function writeReadouts() {
  const { n, l } = state;
  const E = energyEV(n);
  const r90 = enclosingRadius(state.table, 0.9);
  const mean = meanRadius(n, l);
  const rows = [
    ['Energy', `${fmt(E, 3)} eV`, `${fmt(-E, 3)} eV frees the electron; every orbital of shell ${n} has this energy`],
    ['Most likely distance', `${fmt(state.peakRadius)} a₀`, `${fmt(state.peakRadius * BOHR_ANGSTROM, 3)} Å`],
    ['Mean distance', `${fmt(mean)} a₀`, `(3n² − l(l+1)) / 2, ${fmt(mean * BOHR_ANGSTROM, 3)} Å`],
    ['Nine times in ten within', `${fmt(r90)} a₀`, `${fmt(r90 * BOHR_ANGSTROM, 3)} Å`],
    ['Spherical nodes at', state.nodes.length ? state.nodes.map((r) => fmt(r)).join(', ') + ' a₀' : 'none', ''],
    ['Dots caught', state.sample.count.toLocaleString('en-US'), `${fmt(100 * state.sample.acceptance, 0)}% of directions tried were kept`],
  ];
  els.readouts.replaceChildren(...rows.map(([k, v, sub]) => {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      dd.append(small);
    }
    const box = document.createElement('div');
    box.append(dt, dd);
    return box;
  }));
  els.cloud.setAttribute('aria-label',
    `Point cloud of ${orbitalName(state.n, state.l, state.m)}: ${state.sample.count.toLocaleString('en-US')} sampled positions`);
}

function refreshAll() {
  computeOrbital();
  computeSample();
  drawCloud();
  drawSlice();
  drawRadialChart();
  writeReadouts();
}

function refreshSample() {
  computeSample();
  drawCloud();
  drawSlice();
  drawRadialChart();
  writeReadouts();
}

els.n.addEventListener('change', () => { state.n = Number(els.n.value); syncSelects(); refreshAll(); });
els.l.addEventListener('change', () => { state.l = Number(els.l.value); syncSelects(); refreshAll(); });
els.m.addEventListener('change', () => { state.m = Number(els.m.value); refreshAll(); });
els.count.addEventListener('change', refreshSample);
els.resample.addEventListener('click', () => { state.seed += 1; refreshSample(); });
els.plane.addEventListener('change', drawSlice);
els.shade.addEventListener('change', drawSlice);

// Turning the cloud.
let drag = null;
els.cloud.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch };
  els.cloud.setPointerCapture(e.pointerId);
});
els.cloud.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const k = 4 / els.cloud.clientWidth;
  state.yaw = drag.yaw - (e.clientX - drag.x) * k;
  state.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, drag.pitch + (e.clientY - drag.y) * k));
  drawCloud();
});
const endDrag = () => { drag = null; };
els.cloud.addEventListener('pointerup', endDrag);
els.cloud.addEventListener('pointercancel', endDrag);
els.cloud.addEventListener('keydown', (e) => {
  const step = 0.08;
  if (e.key === 'ArrowLeft') state.yaw += step;
  else if (e.key === 'ArrowRight') state.yaw -= step;
  else if (e.key === 'ArrowUp') state.pitch = Math.min(Math.PI / 2, state.pitch + step);
  else if (e.key === 'ArrowDown') state.pitch = Math.max(-Math.PI / 2, state.pitch - step);
  else return;
  e.preventDefault();
  drawCloud();
});

// A probe on the slice, moved by the pointer or by the arrow keys, that
// reports the position, the sign of psi and the density there. It is kept
// as grid indices and re-read whenever the slice is redrawn.
function showProbe() {
  const probe = state.probe;
  // Announce readings only for the keyboard probe, so pointer moves stay quiet.
  els.hover.setAttribute('aria-live', probe?.marked ? 'polite' : 'off');
  if (!probe || !state.slice) {
    els.hover.innerHTML = '&nbsp;';
    return;
  }
  const { i, j } = probe;
  const a = -state.half + ((i + 0.5) / SIZE) * 2 * state.half;
  const b = state.half - ((j + 0.5) / SIZE) * 2 * state.half;
  const p = PLANES[state.slice.plane];
  const v = state.slice.values[j * SIZE + i];
  const rel = state.densityPeak > 0 ? (v * v) / state.densityPeak : 0;
  const share = rel >= 0.01 ? `${fmt(100 * rel, 0)}%` : rel > 0 ? `1 in ${Math.round(1 / rel).toLocaleString('en-US')}` : '0';
  els.hover.textContent = `${p.h} = ${fmt(a, 1)}, ${p.v} = ${fmt(b, 1)} a₀ · ψ ${v >= 0 ? 'positive' : 'negative'} · density ${share} of the orbital's highest`;
  if (probe.marked) {
    sliceCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    sliceCtx.lineWidth = 1.5;
    const x = i + 0.5;
    const y = j + 0.5;
    sliceCtx.beginPath();
    sliceCtx.moveTo(x - 9, y); sliceCtx.lineTo(x - 3, y);
    sliceCtx.moveTo(x + 3, y); sliceCtx.lineTo(x + 9, y);
    sliceCtx.moveTo(x, y - 9); sliceCtx.lineTo(x, y - 3);
    sliceCtx.moveTo(x, y + 3); sliceCtx.lineTo(x, y + 9);
    sliceCtx.stroke();
  }
}

els.slice.addEventListener('pointermove', (e) => {
  const rect = els.slice.getBoundingClientRect();
  const i = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
  const j = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
  if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) return;
  const hadMark = state.probe?.marked;
  state.probe = { i, j, marked: false };
  if (hadMark) drawSlice();
  else showProbe();
});
els.slice.addEventListener('pointerleave', () => {
  if (state.probe && !state.probe.marked) {
    state.probe = null;
    showProbe();
  }
});
els.slice.addEventListener('focus', () => {
  if (!state.probe) state.probe = { i: SIZE / 2, j: SIZE / 2, marked: true };
  else state.probe.marked = true;
  drawSlice();
});
els.slice.addEventListener('blur', () => {
  state.probe = null;
  drawSlice();
});
els.slice.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 24 : 4;
  const probe = state.probe || { i: SIZE / 2, j: SIZE / 2 };
  let { i, j } = probe;
  if (e.key === 'ArrowLeft') i -= step;
  else if (e.key === 'ArrowRight') i += step;
  else if (e.key === 'ArrowUp') j -= step;
  else if (e.key === 'ArrowDown') j += step;
  else if (e.key === 'Home') { i = SIZE / 2; j = SIZE / 2; }
  else return;
  e.preventDefault();
  state.probe = { i: Math.max(0, Math.min(SIZE - 1, i)), j: Math.max(0, Math.min(SIZE - 1, j)), marked: true };
  drawSlice();
});

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (els.spin.checked && !drag && document.visibilityState === 'visible') {
    state.yaw += 0.25 * dt;
    drawCloud();
  }
  requestAnimationFrame(tick);
}

syncSelects();
refreshAll();
requestAnimationFrame(tick);
