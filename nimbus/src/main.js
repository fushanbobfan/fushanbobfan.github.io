import {
  MAX_N,
  BOHR_ANGSTROM,
  makeOrbital,
  radial,
  radialTable,
  radialNodes,
  radialDensity,
  enclosingRadius,
  mostProbableRadius,
  meanRadius,
  energyEV,
} from './hydrogen.js';
import { sampleOrbital, peakDensity } from './sampler.js';
import { sliceValues, shadeSlice, shadeDensity, PLANES } from './slice.js';
import { viewMatrix, project, renderCloud, splat, exposureLevel } from './cloud.js';
import { drawChart } from './chart.js';
import { SHELL_LETTERS, shapeLabel, orbitalName, describeNodes } from './names.js';
import { transition, bandOf, mixedSample, weightsAt, mixedDensity } from './superposition.js';

const $ = (id) => document.getElementById(id);
const els = {
  n: $('n'), l: $('l'), m: $('m'), name: $('name'), note: $('note'),
  mix: $('mix'), mixControls: $('mix-controls'), n2: $('n2'), l2: $('l2'), m2: $('m2'),
  play: $('play'), phase: $('phase'), time: $('time'),
  count: $('count'), spin: $('spin'), resample: $('resample'),
  plane: $('plane'), shade: $('shade'),
  cloud: $('cloud'), slice: $('slice'), chart: $('chart'),
  hover: $('hover'), sliceCaption: $('slice-caption'), cloudCaption: $('cloud-caption'),
  chartNote: $('chart-note'), readouts: $('readouts'), legend: $('legend'),
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) els.spin.checked = false;

// One beat of the mix takes this long on screen, whatever its real period.
const BEAT_SECONDS = 2.5;

const state = {
  a: { n: 3, l: 2, m: 0 },
  b: { n: 2, l: 1, m: 0 },
  mixing: false,
  phase: 0,
  playing: false,
  seed: 1,
  yaw: -0.6, pitch: 0.35,
  orbital: null, orbitalB: null, table: null, half: 1,
  sample: null, weights: null, ones: null,
  slice: null, sliceB: null, sliceKey: '', density: null, densityPeak: 0,
  probe: null, info: null,
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

function syncSelects(q, nEl, lEl, mEl) {
  fillSelect(nEl, Array.from({ length: MAX_N }, (_, i) => [i + 1, String(i + 1)]), q.n);
  if (q.l >= q.n) q.l = q.n - 1;
  fillSelect(lEl, Array.from({ length: q.n }, (_, l) => [l, `${l} (${SHELL_LETTERS[l]})`]), q.l);
  if (Math.abs(q.m) > q.l) q.m = 0;
  const ms = [];
  for (let m = -q.l; m <= q.l; m++) {
    const shape = shapeLabel(q.l, m);
    const sign = m < 0 ? '−' : '';
    ms.push([m, q.l === 0 ? '0' : `${sign}${Math.abs(m)} (${shape})`]);
  }
  fillSelect(mEl, ms, q.m);
}

const syncAll = () => {
  syncSelects(state.a, els.n, els.l, els.m);
  syncSelects(state.b, els.n2, els.l2, els.m2);
};

const fmt = (x, d = 2) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const nameOf = (q) => orbitalName(q.n, q.l, q.m);
const beats = () => state.mixing && !state.info.sameShell;

function computeOrbital() {
  const { n, l, m } = state.a;
  state.orbital = makeOrbital(n, l, m);
  state.table = radialTable(n, l);
  state.half = enclosingRadius(state.table, 0.99) * 1.08;
  state.nodes = radialNodes(n, l);
  state.peakRadius = mostProbableRadius(n, l, state.table);
  state.densityPeak = peakDensity(n, l, m, state.table);
  if (state.mixing) {
    const b = state.b;
    state.orbitalB = makeOrbital(b.n, b.l, b.m);
    state.tableB = radialTable(b.n, b.l);
    state.half = Math.max(state.half, enclosingRadius(state.tableB, 0.99) * 1.08);
    state.info = transition(state.a, b);
    if (state.info.sameShell) state.phase = 0;
    els.name.textContent = `${nameOf(state.a)} + ${nameOf(b)}`;
    els.note.textContent = mixNote();
  } else {
    els.name.textContent = nameOf(state.a);
    els.note.textContent = describeNodes(n, l, m);
  }
  const still = state.mixing && state.info.sameShell;
  els.play.disabled = still;
  els.phase.disabled = still;
}

function mixNote() {
  const t = state.info;
  if (t.sameShell) {
    return 'Both orbitals have the same energy, so this mix does not change in time: it is just another orbital of the same shell.';
  }
  const slow = (BEAT_SECONDS * 1e15) / t.periodFs;
  return `An electron half in each orbital. Its cloud swings back and forth every ${fmt(t.periodFs, t.periodFs < 10 ? 3 : 1)} fs, shown here about ${slow.toExponential(0).replace('e+', ' × 10^')} times slower.`;
}

function computeSample() {
  const count = Number(els.count.value);
  if (state.mixing) {
    state.sample = mixedSample(state.a, state.b, count, state.seed);
    state.weights = new Float32Array(count);
    state.ones = new Float32Array(count).fill(1);
  } else {
    state.sample = sampleOrbital(state.a.n, state.a.l, state.a.m, count, state.seed, state.table);
    state.weights = null;
  }
}

function drawSlice() {
  const plane = els.plane.value;
  const key = [plane, state.half, state.mixing, state.a.n, state.a.l, state.a.m, state.b.n, state.b.l, state.b.m].join();
  if (key !== state.sliceKey) {
    state.slice = sliceValues(state.orbital.psi, plane, state.half, SIZE);
    state.sliceB = state.mixing ? sliceValues(state.orbitalB.psi, plane, state.half, SIZE) : null;
    if (state.mixing) {
      // The highest the density ever gets on this plane, (|a| + |b|)^2 / 2.
      let top = 0;
      const A = state.slice.values;
      const B = state.sliceB.values;
      for (let k = 0; k < A.length; k++) top = Math.max(top, 0.5 * (Math.abs(A[k]) + Math.abs(B[k])) ** 2);
      state.mixPeak = top;
    }
    state.sliceKey = key;
  }
  const p = PLANES[plane];
  let nodal = false;
  if (state.mixing) {
    state.density = mixedDensity(state.slice.values, state.sliceB.values, state.phase, state.density || undefined);
    nodal = state.mixPeak === 0;
    shadeDensity(state.density, els.shade.value, state.mixPeak || 1, sliceImage.data);
  } else {
    // On a nodal plane psi is only rounding noise; shade it against the
    // orbital's own peak so it stays black.
    nodal = state.slice.peak <= 1e-9 * state.densityPeak;
    const ref = nodal ? state.densityPeak : state.slice.peak;
    shadeSlice(state.slice, els.shade.value, sliceImage.data, ref);
  }
  sliceCtx.putImageData(sliceImage, 0, 0);
  drawScaleBar(sliceCtx);
  sliceCtx.fillStyle = 'rgba(255,255,255,0.75)';
  sliceCtx.font = '12px system-ui, sans-serif';
  sliceCtx.textAlign = 'right';
  sliceCtx.textBaseline = 'middle';
  sliceCtx.fillText(p.h + ' →', SIZE - 8, SIZE / 2 - 10);
  sliceCtx.textAlign = 'center';
  sliceCtx.textBaseline = 'top';
  sliceCtx.fillText('↑ ' + p.v, SIZE / 2 + 12, 6);
  if (state.mixing && state.info.allowed) drawChargeCentre(p);

  const name = els.name.textContent;
  const reading = 'Point at it, or tab to it and use the arrow keys, to read the density.';
  if (nodal) {
    els.sliceCaption.textContent = `The ${p.label} is a node of ${name}: ψ is zero everywhere on it, so the electron is never found there. Try another plane.`;
  } else if (state.mixing) {
    els.sliceCaption.textContent = `Density of the mix on the ${p.label}.` +
      (!state.info.allowed ? ''
        : state.info.sameShell ? ' The ring is the centre of the electron\'s charge, held off the nucleus.'
          : ' The ring is the centre of the electron\'s charge; as it swings, the atom gives out light.') + ` ${reading}`;
  } else {
    els.sliceCaption.textContent = `ψ on the ${p.label}, through the nucleus. Dark lines are nodes, where ψ is zero. ${reading}`;
  }
  els.slice.setAttribute('aria-label',
    `${name} on the ${p.label}${nodal ? ', which is a node' : ''}. Arrow keys move a probe that reads the density.`);
  showProbe();
}

// The mean position of the charge is d cos(omega t), d = <a| r |b>.
function drawChargeCentre(p) {
  const d = state.info.dipole;
  const c = Math.cos(state.phase);
  const axis = { x: 0, y: 1, z: 2 };
  const h = d[axis[p.h]] * c;
  const v = d[axis[p.v]] * c;
  const scale = SIZE / (2 * state.half);
  const x = SIZE / 2 + h * scale;
  const y = SIZE / 2 - v * scale;
  sliceCtx.strokeStyle = 'rgba(255,255,255,0.95)';
  sliceCtx.lineWidth = 2;
  sliceCtx.beginPath();
  sliceCtx.arc(x, y, 6, 0, 2 * Math.PI);
  sliceCtx.stroke();
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
  if (state.mixing) {
    weightsAt(state.sample, state.phase, state.weights);
    const { pos, neg } = splat(state.sample, M, state.half, SIZE, state.ones);
    renderCloud(state.sample, M, state.half, SIZE, cloudImage.data, state.weights, exposureLevel(pos, neg));
  } else {
    renderCloud(state.sample, M, state.half, SIZE, cloudImage.data);
  }
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

// The mix's radial distribution at this moment: the average of the two, plus
// a beating cross term when both orbitals have the same l and m (otherwise
// the angular parts are orthogonal and the cross term averages out over
// every sphere).
function mixedRadialTable() {
  const { a, b } = state;
  const steps = 1200;
  const r = new Float64Array(steps);
  const p = new Float64Array(steps);
  const crossing = a.l === b.l && a.m === b.m;
  const c = Math.cos(state.phase);
  for (let i = 0; i < steps; i++) {
    const x = (state.half * i) / (steps - 1);
    r[i] = x;
    p[i] = 0.5 * (radialDensity(a.n, a.l, x) + radialDensity(b.n, b.l, x));
    if (crossing) p[i] += x * x * radial(a.n, a.l, x) * radial(b.n, b.l, x) * c;
  }
  return { r, p };
}

function drawRadialChart() {
  const colors = {
    grid: cssColor('--grid'),
    muted: cssColor('--muted'),
    curve: cssColor('--accent'),
    hist: cssColor('--hist'),
    node: cssColor('--node'),
    mean: cssColor('--mean'),
  };
  if (state.mixing) {
    drawChart(chartCtx, els.chart.width, els.chart.height, {
      table: mixedRadialTable(),
      rView: state.half,
      nodes: [],
      peakRadius: null,
      mean: null,
      sample: state.sample,
      weights: state.weights,
      colors,
    });
    const breathes = state.a.l === state.b.l && state.a.m === state.b.m && !state.info.sameShell;
    els.chartNote.textContent = breathes
      ? 'Both orbitals have the same shape, so the mix breathes: the curve and the bars move in and out together as it beats.'
      : 'The two orbitals have different shapes, so the mix only moves sideways: how far the electron sits from the nucleus stays the average of the two.';
    els.chart.setAttribute('aria-label', `Radial distribution of the mix ${els.name.textContent}`);
    return;
  }
  drawChart(chartCtx, els.chart.width, els.chart.height, {
    table: state.table,
    rView: state.half,
    nodes: state.nodes,
    peakRadius: state.peakRadius,
    mean: meanRadius(state.a.n, state.a.l),
    sample: state.sample,
    colors,
  });
  els.chartNote.textContent = 'The curve is r²R(r)², the chance per unit distance of finding the electron at radius r; it takes the r² because a shell at radius r has more room in it than one near the centre. The bars count the dots in the cloud by distance.';
  const name = nameOf(state.a);
  els.chart.setAttribute('aria-label',
    `Radial distribution of ${name}: most likely at ${fmt(state.peakRadius)} Bohr radii, mean ${fmt(meanRadius(state.a.n, state.a.l))}` +
    (state.nodes.length ? `, zero at ${state.nodes.map((r) => fmt(r)).join(', ')}` : ''));
}

function axisWords(d) {
  const names = ['x', 'y', 'z'];
  const parts = names.filter((_, i) => Math.abs(d[i]) > 1e-9 * Math.hypot(...d));
  return parts.length === 1 ? `along ${parts[0]}` : `in the ${parts.join('')} directions`;
}

function mixRows() {
  const t = state.info;
  const rows = [];
  if (t.sameShell) {
    rows.push(['Energy gap', '0 eV', 'both orbitals are in the same shell, so nothing beats']);
    if (t.allowed) rows.push(['Lopsided charge', `${fmt(t.dipoleSize, 3)} a₀ × e`, `a fixed dipole ${axisWords(t.dipole)}; an electric field picks out mixes like this (the Stark effect)`]);
    return rows;
  }
  const nm = t.wavelengthNm;
  if (t.allowed) {
    rows.push(['Light given out', `${fmt(nm, nm < 1000 ? 2 : 1)} nm`, `${bandOf(nm)}; a ${t.series} line, ending in shell ${t.lower.n}`]);
  } else {
    const dl = Math.abs(state.a.l - state.b.l);
    const why = dl === 1
      ? 'the two orbitals do not line up along any axis'
      : `l changes by ${dl}, and light needs a change of exactly 1`;
    rows.push(['Light given out', 'none (to first order)', `the charge reshapes but its centre stays at the nucleus: ${why}`]);
  }
  rows.push(['Energy gap', `${fmt(t.photonEV, 4)} eV`, 'with the proton\'s own small motion included']);
  rows.push(['One beat', `${fmt(t.periodFs, 3)} fs`, `${fmt(t.frequencyHz / 1e12, 0)} trillion beats a second`]);
  if (t.allowed) {
    rows.push(['Swing of the charge', `${fmt(t.dipoleSize, 3)} a₀ × e`, `the dipole, ${axisWords(t.dipole)}`]);
    const ns = 1e9 / t.rate;
    rows.push(['Drop rate', `${t.rate.toExponential(2).replace('e+', ' × 10^')} per second`,
      `the upper orbital would last ${ns < 1000 ? fmt(ns, ns < 10 ? 2 : 0) + ' ns' : fmt(ns / 1000, 1) + ' µs'} if this were its only way down`]);
  }
  return rows;
}

function writeReadouts() {
  let rows;
  if (state.mixing) {
    rows = mixRows();
  } else {
    const { n, l } = state.a;
    const E = energyEV(n);
    const r90 = enclosingRadius(state.table, 0.9);
    const mean = meanRadius(n, l);
    rows = [
      ['Energy', `${fmt(E, 3)} eV`, `${fmt(-E, 3)} eV frees the electron; every orbital of shell ${n} has this energy`],
      ['Most likely distance', `${fmt(state.peakRadius)} a₀`, `${fmt(state.peakRadius * BOHR_ANGSTROM, 3)} Å`],
      ['Mean distance', `${fmt(mean)} a₀`, `(3n² − l(l+1)) / 2, ${fmt(mean * BOHR_ANGSTROM, 3)} Å`],
      ['Nine times in ten within', `${fmt(r90)} a₀`, `${fmt(r90 * BOHR_ANGSTROM, 3)} Å`],
      ['Spherical nodes at', state.nodes.length ? state.nodes.map((r) => fmt(r)).join(', ') + ' a₀' : 'none', ''],
    ];
  }
  rows.push(['Dots caught', state.sample.count.toLocaleString('en-US'), `${fmt(100 * state.sample.acceptance, 0)}% of directions tried were kept`]);
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
    `Point cloud of ${els.name.textContent}: ${state.sample.count.toLocaleString('en-US')} sampled positions`);
  els.legend.innerHTML = state.mixing
    ? '<span class="swatch mixed"></span> density of the mix (its ψ is complex, so it has no single sign)'
    : '<span class="swatch pos"></span> ψ positive <span class="swatch neg"></span> ψ negative';
  els.cloudCaption.textContent = state.mixing
    ? 'Each dot is a place the electron could be found, brighter where the mix is denser at this moment. Drag, or use the arrow keys, to turn it.'
    : 'Each dot is one place the electron could be found. Drag, or use the arrow keys, to turn it.';
}

function writeTime() {
  if (!state.mixing || state.info.sameShell) {
    els.time.textContent = '';
    return;
  }
  const deg = ((state.phase * 180) / Math.PI) % 360;
  const fs = (deg / 360) * state.info.periodFs;
  els.time.textContent = `t = ${fmt(fs, 3)} fs into the beat`;
  els.phase.value = String(Math.round(deg));
}

function drawMoment() {
  drawCloud();
  drawSlice();
  drawRadialChart();
  writeTime();
}

function refreshAll() {
  computeOrbital();
  computeSample();
  drawMoment();
  writeReadouts();
}

function refreshSample() {
  computeSample();
  drawMoment();
  writeReadouts();
}

const pick = (q, key, el, all) => () => {
  q[key] = Number(el.value);
  if (all) syncAll();
  refreshAll();
};
els.n.addEventListener('change', pick(state.a, 'n', els.n, true));
els.l.addEventListener('change', pick(state.a, 'l', els.l, true));
els.m.addEventListener('change', pick(state.a, 'm', els.m, false));
els.n2.addEventListener('change', pick(state.b, 'n', els.n2, true));
els.l2.addEventListener('change', pick(state.b, 'l', els.l2, true));
els.m2.addEventListener('change', pick(state.b, 'm', els.m2, false));
els.mix.addEventListener('change', () => {
  state.mixing = els.mix.checked;
  els.mixControls.hidden = !state.mixing;
  if (!state.mixing) setPlaying(false);
  refreshAll();
});
els.count.addEventListener('change', refreshSample);
els.resample.addEventListener('click', () => { state.seed += 1; refreshSample(); });
els.plane.addEventListener('change', drawSlice);
els.shade.addEventListener('change', drawSlice);

function setPlaying(on) {
  state.playing = on;
  els.play.textContent = on ? 'Pause' : 'Play the beat';
  els.play.setAttribute('aria-pressed', String(on));
}
els.play.addEventListener('click', () => setPlaying(!state.playing));
els.phase.addEventListener('input', () => {
  setPlaying(false);
  state.phase = (Number(els.phase.value) * Math.PI) / 180;
  drawMoment();
});

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
  els.hover.setAttribute('aria-live', probe?.marked && !state.playing ? 'polite' : 'off');
  if (!probe || !state.slice) {
    els.hover.innerHTML = '&nbsp;';
    return;
  }
  const { i, j } = probe;
  const a = -state.half + ((i + 0.5) / SIZE) * 2 * state.half;
  const b = state.half - ((j + 0.5) / SIZE) * 2 * state.half;
  const p = PLANES[state.slice.plane];
  const k = j * SIZE + i;
  const where = `${p.h} = ${fmt(a, 1)}, ${p.v} = ${fmt(b, 1)} a₀`;
  const shareOf = (rel) => (rel >= 0.01 ? `${fmt(100 * rel, 0)}%` : rel > 0 ? `1 in ${Math.round(1 / rel).toLocaleString('en-US')}` : '0');
  if (state.mixing) {
    const rel = state.mixPeak > 0 ? state.density[k] / state.mixPeak : 0;
    els.hover.textContent = `${where} · density ${shareOf(rel)} of the highest it reaches on this plane`;
  } else {
    const v = state.slice.values[k];
    const rel = state.densityPeak > 0 ? (v * v) / state.densityPeak : 0;
    els.hover.textContent = `${where} · ψ ${v >= 0 ? 'positive' : 'negative'} · density ${shareOf(rel)} of the orbital's highest`;
  }
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
  if (document.visibilityState === 'visible') {
    const spinning = els.spin.checked && !drag;
    if (spinning) state.yaw += 0.25 * dt;
    if (state.playing && beats()) {
      state.phase = (state.phase + (2 * Math.PI * dt) / BEAT_SECONDS) % (2 * Math.PI);
      drawMoment();
    } else if (spinning) {
      drawCloud();
    }
  }
  requestAnimationFrame(tick);
}

syncAll();
setPlaying(false);
refreshAll();
requestAnimationFrame(tick);
