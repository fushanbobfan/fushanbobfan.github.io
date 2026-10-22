// Page wiring: two planes rendered progressively, pointer and keyboard
// controls, the readout for the chosen c, and the share link.

import { makeView, toComplex, toPixel, zoomAt, panBy, precisionLimited, suggestedIterations } from './view.js';
import { renderRows } from './render.js';
import { PALETTES, buildLut } from './palette.js';
import { orbit, sample, SAMPLE_SIZE, ESCAPED, SMOOTH } from './dynamics.js';
import { attractingCycle, nucleus } from './cycle.js';
import { fractions, bulbNucleus, bulbRadiusEstimate } from './bulbs.js';
import { PLACES, findPlace } from './places.js';
import { DEFAULTS, encodeSettings, decodeSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const FRAME_BUDGET_MS = 14;
const PASSES = [8, 1];
const ACCENT = '#ffbe3c';

let state = decodeSettings(location.hash);
let lut = buildLut(PALETTES[state.palette]);
let hoverZ = null; // dynamical-plane point whose orbit is traced, null = critical orbit
let dpr = 1;

function makePlane(prefix, julia) {
  const canvas = $(`${prefix}-canvas`);
  const overlay = $(`${prefix}-overlay`);
  return {
    julia,
    canvas,
    overlay,
    ctx: canvas.getContext('2d'),
    octx: overlay.getContext('2d'),
    status: $(`${prefix}-status`),
    width: 0,
    height: 0,
    image: null,
    job: null,
    onDone: null,
  };
}

const M = makePlane('m', false);
const J = makePlane('j', true);
const planes = [M, J];

// ---- views and render jobs ----

function viewOf(p) {
  const v = p.julia ? state.jview : state.mview;
  return makeView(v[0], v[1], v[2] / Math.max(1, p.width));
}

function setView(p, view) {
  const stored = [view.cx, view.cy, view.scale * p.width];
  if (p.julia) state.jview = stored;
  else state.mview = stored;
  restart(p);
  drawOverlay(p);
  saveHashSoon();
}

function iterationsFor(p, view) {
  return state.iterations || suggestedIterations(view, p.width);
}

function restart(p) {
  if (!p.image) return;
  const view = viewOf(p);
  const opts = {
    julia: p.julia,
    c: state.c.slice(),
    maxIter: iterationsFor(p, view),
    colouring: state.colouring,
    interior: state.interior,
    lut,
    density: state.density,
    offset: state.offset,
  };
  p.job = { view, opts, pass: 0, row: 0, started: performance.now() };
  showStatus(p, 'rendering');
  requestFrame();
}

let frameRequested = false;
function requestFrame() {
  if (!frameRequested) {
    frameRequested = true;
    requestAnimationFrame(frame);
  }
}

function frame() {
  frameRequested = false;
  const deadline = performance.now() + FRAME_BUDGET_MS;
  // alternate between the planes so neither starves the other
  let busy = true;
  while (busy && performance.now() < deadline) {
    busy = false;
    for (const p of planes) {
      if (p.job && performance.now() < deadline) {
        step(p);
        busy = busy || p.job !== null;
      }
    }
  }
  if (planes.some((p) => p.job)) requestFrame();
}

function step(p) {
  const job = p.job;
  const size = PASSES[job.pass];
  const y0 = job.row;
  const y1 = Math.min(p.height, y0 + size);
  renderRows(p.image.data, p.width, p.height, job.view, job.opts, y0, y1, size);
  p.ctx.putImageData(p.image, 0, 0, 0, y0, p.width, y1 - y0);
  job.row = y1;
  if (job.row >= p.height) {
    job.pass++;
    job.row = 0;
    if (job.pass >= PASSES.length) {
      const ms = performance.now() - job.started;
      p.job = null;
      showStatus(p, `${Math.round(ms)} ms`);
      if (p.onDone) {
        const done = p.onDone;
        p.onDone = null;
        done();
      }
    }
  }
}

function showStatus(p, phase) {
  const view = viewOf(p);
  const width = view.scale * p.width;
  const parts = [`width ${width.toPrecision(3)}`, `${iterationsFor(p, view)} iterations`, phase];
  const limited = precisionLimited(view);
  if (limited) parts.push('past double precision: pixels start to repeat');
  p.status.textContent = parts.join(' · ');
  p.status.classList.toggle('warn', limited);
}

// ---- overlays ----

function drawOverlay(p) {
  const g = p.octx;
  g.clearRect(0, 0, p.width, p.height);
  const view = viewOf(p);
  const px = (x, y) => toPixel(view, p.width, p.height, x, y);
  g.lineWidth = 1.5 * dpr;
  if (!p.julia) {
    const [x, y] = px(state.c[0], state.c[1]);
    g.strokeStyle = '#000';
    g.beginPath();
    g.arc(x, y, 7 * dpr, 0, 2 * Math.PI);
    g.stroke();
    g.strokeStyle = ACCENT;
    g.beginPath();
    g.arc(x, y, 5.5 * dpr, 0, 2 * Math.PI);
    g.stroke();
    return;
  }
  const start = hoverZ || [0, 0];
  const pts = orbit(start[0], start[1], state.c[0], state.c[1], 400, 4);
  g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  g.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = px(pts[i], pts[i + 1]);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#fff';
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = px(pts[i], pts[i + 1]);
    const r = (i === 0 ? 3.5 : 2) * dpr;
    g.beginPath();
    g.arc(x, y, r, 0, 2 * Math.PI);
    g.fill();
  }
  if (cycle) {
    g.strokeStyle = ACCENT;
    g.lineWidth = 2 * dpr;
    for (let i = 0; i < cycle.points.length; i += 2) {
      const [x, y] = px(cycle.points[i], cycle.points[i + 1]);
      g.beginPath();
      g.arc(x, y, 6 * dpr, 0, 2 * Math.PI);
      g.stroke();
    }
  }
}

// ---- the chosen parameter ----

let cycle = null;
const probe = new Float64Array(SAMPLE_SIZE);

function digitsFor(scale) {
  return Math.min(16, Math.max(4, Math.ceil(-Math.log10(scale)) + 1));
}

function formatComplex(x, y, digits) {
  const sign = y < 0 ? '−' : '+';
  return `${x.toFixed(digits)} ${sign} ${Math.abs(y).toFixed(digits)}i`;
}

function updateReadout() {
  const [cx, cy] = state.c;
  const digits = digitsFor(viewOf(M).scale);
  $('r-c').textContent = formatComplex(cx, cy, digits);
  const budget = 100000;
  sample(probe, 0, 0, cx, cy, budget, false);
  cycle = probe[ESCAPED] ? null : attractingCycle(cx, cy, budget);
  if (probe[ESCAPED]) {
    $('r-fate').textContent = `escapes after ${Math.floor(probe[SMOOTH])} steps`;
    $('r-cycle').textContent = 'none';
    $('r-mult').textContent = '–';
    $('r-julia').textContent = 'dust: c is outside the Mandelbrot set';
  } else if (cycle) {
    $('r-fate').textContent = `settles within ${cycle.settledAfter} steps`;
    $('r-cycle').textContent = `period ${cycle.period}`;
    const { abs, arg } = cycle.multiplier;
    const turn = ((arg / (2 * Math.PI)) + 1) % 1;
    // at a nucleus lambda = 0 and its angle carries no information
    $('r-mult').textContent = abs < 1e-9
      ? 'λ = 0 (superattracting: the centre of its component)'
      : `|λ| = ${abs.toFixed(4)}, angle ${turn.toFixed(4)} turn`;
    $('r-julia').textContent = 'connected: c is in the Mandelbrot set';
  } else {
    $('r-fate').textContent = `bounded for ${budget.toLocaleString('en-US')} steps`;
    $('r-cycle').textContent = 'no attracting cycle found';
    $('r-mult').textContent = '–';
    $('r-julia').textContent = 'connected, with c on or near the boundary';
  }
}

// Moves c to the centre of the hyperbolic component it lies in, where the
// critical point is itself periodic.
function snapToCentre() {
  const button = $('snap');
  const flash = (text) => {
    button.textContent = text;
    setTimeout(() => { button.textContent = "Move c to its component's centre"; }, 1800);
  };
  if (!cycle) {
    flash('c has no attracting cycle');
    return;
  }
  const n = nucleus(state.c[0], state.c[1], cycle.period);
  const check = n && attractingCycle(n.re, n.im);
  if (!check || check.period !== cycle.period) {
    flash('Newton did not converge here');
    return;
  }
  setC(n.re, n.im);
  flash(`centre of a period-${cycle.period} component`);
}

function goToBulb(p, q) {
  const n = bulbNucleus(p, q);
  if (!n) return;
  const r = bulbRadiusEstimate(p, q);
  state.mview = [n.re, n.im, Math.max(12 * r, 0.002)];
  state.jview = DEFAULTS.jview.slice();
  $('place').value = '';
  $('place-note').textContent = `The ${p}/${q} bulb, period ${q}. In its Julia set ${q} arms meet at the fixed point, and each step of the map turns them ${p}/${q} of a turn.`;
  restart(M);
  setC(n.re, n.im);
}

function setC(x, y) {
  state.c = [x, y];
  updateReadout();
  restart(J);
  drawOverlay(M);
  drawOverlay(J);
  saveHashSoon();
}

// ---- pointer and keyboard ----

function pointerPlanePoint(p, e) {
  const r = p.overlay.getBoundingClientRect();
  const px = (e.clientX - r.left) * (p.width / r.width);
  const py = (e.clientY - r.top) * (p.height / r.height);
  return { px, py, z: toComplex(viewOf(p), p.width, p.height, px, py) };
}

function attachPointer(p) {
  let drag = null;
  const el = p.overlay;
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const { px, py } = pointerPlanePoint(p, e);
    drag = { px, py, moved: false };
  });
  el.addEventListener('pointermove', (e) => {
    const at = pointerPlanePoint(p, e);
    if (drag) {
      const dx = at.px - drag.px;
      const dy = at.py - drag.py;
      if (drag.moved || Math.hypot(dx, dy) > 4 * dpr) {
        drag.moved = true;
        drag.px = at.px;
        drag.py = at.py;
        setView(p, panBy(viewOf(p), dx, dy));
      }
      return;
    }
    if (!p.julia && $('follow').checked) setC(at.z[0], at.z[1]);
    if (p.julia) {
      hoverZ = at.z;
      drawOverlay(J);
    }
  });
  el.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && !p.julia) {
      const { z } = pointerPlanePoint(p, e);
      setC(z[0], z[1]);
    }
    drag = null;
  });
  el.addEventListener('pointerleave', () => {
    if (p.julia && !drag) {
      hoverZ = null;
      drawOverlay(J);
    }
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { px, py } = pointerPlanePoint(p, e);
    const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    setView(p, zoomAt(viewOf(p), p.width, p.height, px, py, factor));
  }, { passive: false });
  el.addEventListener('dblclick', (e) => {
    const { px, py } = pointerPlanePoint(p, e);
    setView(p, zoomAt(viewOf(p), p.width, p.height, px, py, e.shiftKey ? 0.5 : 2));
  });
  el.addEventListener('keydown', (e) => {
    const v = viewOf(p);
    const stepPx = p.width / 10;
    const moves = {
      ArrowLeft: () => panBy(v, stepPx, 0),
      ArrowRight: () => panBy(v, -stepPx, 0),
      ArrowUp: () => panBy(v, 0, stepPx),
      ArrowDown: () => panBy(v, 0, -stepPx),
      '+': () => zoomAt(v, p.width, p.height, p.width / 2, p.height / 2, 1.5),
      '=': () => zoomAt(v, p.width, p.height, p.width / 2, p.height / 2, 1.5),
      '-': () => zoomAt(v, p.width, p.height, p.width / 2, p.height / 2, 1 / 1.5),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setView(p, moves[e.key]());
    } else if (e.key === 'Enter' && !p.julia) {
      setC(v.cx, v.cy);
    }
  });
}

function typingInControl(e) {
  return e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement;
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || typingInControl(e)) return;
  const key = e.key.toLowerCase();
  if (key === 'f') {
    $('follow').checked = !$('follow').checked;
  } else if (key === 'n') {
    snapToCentre();
  } else if (key === 'b') {
    state.colouring = state.colouring === 'bands' ? 'boundary' : 'bands';
    syncControls();
    restartAll();
  } else if (key === 'p') {
    const names = Object.keys(PALETTES);
    state.palette = names[(names.indexOf(state.palette) + 1) % names.length];
    lut = buildLut(PALETTES[state.palette]);
    syncControls();
    restartAll();
  } else if (key === 'r') {
    resetViews();
  }
});

// ---- controls ----

function syncControls() {
  $('iterations').value = String(state.iterations);
  if ($('iterations').value !== String(state.iterations)) {
    const opt = new Option(String(state.iterations), String(state.iterations));
    $('iterations').add(opt);
    $('iterations').value = String(state.iterations);
  }
  $('colouring').value = state.colouring;
  $('interior').value = state.interior;
  $('palette').value = state.palette;
  $('density').value = String(state.density);
  $('offset').value = String(state.offset);
  $('density-out').textContent = state.density.toFixed(1);
  $('offset-out').textContent = state.offset.toFixed(2);
}

function restartAll() {
  restart(M);
  restart(J);
  saveHashSoon();
}

function resetViews() {
  state.mview = DEFAULTS.mview.slice();
  state.jview = DEFAULTS.jview.slice();
  restartAll();
  updateReadout();
  drawOverlay(M);
  drawOverlay(J);
}

function bindControls() {
  for (const name of Object.keys(PALETTES)) $('palette').add(new Option(name, name));
  for (const place of PLACES) $('place').add(new Option(place.name, place.id));
  for (const [p, q] of fractions(10)) $('bulb').add(new Option(`${p}/${q} (period ${q})`, `${p}/${q}`));

  $('iterations').addEventListener('change', (e) => {
    state.iterations = Number(e.target.value);
    restartAll();
  });
  $('colouring').addEventListener('change', (e) => {
    state.colouring = e.target.value;
    restartAll();
  });
  $('interior').addEventListener('change', (e) => {
    state.interior = e.target.value;
    restartAll();
  });
  $('palette').addEventListener('change', (e) => {
    state.palette = e.target.value;
    lut = buildLut(PALETTES[state.palette]);
    restartAll();
  });
  $('density').addEventListener('input', (e) => {
    state.density = Number(e.target.value);
    $('density-out').textContent = state.density.toFixed(1);
    restartAll();
  });
  $('offset').addEventListener('input', (e) => {
    state.offset = Number(e.target.value);
    $('offset-out').textContent = state.offset.toFixed(2);
    restartAll();
  });
  $('place').addEventListener('change', (e) => {
    const place = findPlace(e.target.value);
    $('place-note').textContent = place ? place.note : '';
    if (!place) return;
    $('bulb').value = '';
    state.mview = place.view.slice();
    state.jview = DEFAULTS.jview.slice();
    restart(M);
    setC(place.c[0], place.c[1]);
  });
  $('bulb').addEventListener('change', (e) => {
    if (!e.target.value) return;
    const [p, q] = e.target.value.split('/').map(Number);
    goToBulb(p, q);
  });
  $('snap').addEventListener('click', snapToCentre);
  $('reset').addEventListener('click', resetViews);
  $('share').addEventListener('click', async () => {
    saveHashNow();
    const button = $('share');
    try {
      await navigator.clipboard.writeText(location.href);
      button.textContent = 'Link copied';
    } catch {
      button.textContent = 'Link is in the address bar';
    }
    setTimeout(() => { button.textContent = 'Copy share link'; }, 1600);
  });
  $('png-m').addEventListener('click', () => savePng(M, 'fatou-mandelbrot.png'));
  $('png-j').addEventListener('click', () => {
    const tag = state.c.map((v) => v.toFixed(6)).join('_');
    savePng(J, `fatou-julia-${tag}.png`);
  });
}

function savePng(p, name) {
  const write = () => p.canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
  // wait for the full-resolution pass if the picture is still refining
  if (p.job) p.onDone = write;
  else write();
}

// ---- share link ----

let hashTimer = 0;
function saveHashNow() {
  clearTimeout(hashTimer);
  history.replaceState(null, '', encodeSettings(state));
}

function saveHashSoon() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(saveHashNow, 300);
}

window.addEventListener('hashchange', () => {
  state = decodeSettings(location.hash);
  lut = buildLut(PALETTES[state.palette]);
  syncControls();
  updateReadout();
  restart(M);
  restart(J);
  drawOverlay(M);
  drawOverlay(J);
});

// ---- sizing ----

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const p of planes) {
    const box = p.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(64, Math.round(box.width * dpr));
    const h = Math.max(64, Math.round(box.height * dpr));
    if (w === p.width && h === p.height) continue;
    p.width = w;
    p.height = h;
    p.canvas.width = p.overlay.width = w;
    p.canvas.height = p.overlay.height = h;
    p.image = p.ctx.createImageData(w, h);
    restart(p);
    drawOverlay(p);
  }
}

bindControls();
syncControls();
attachPointer(M);
attachPointer(J);
new ResizeObserver(resize).observe(document.querySelector('.planes'));
resize();
updateReadout();
drawOverlay(M);
drawOverlay(J);
