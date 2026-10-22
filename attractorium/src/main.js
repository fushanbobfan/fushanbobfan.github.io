import { SYSTEMS, SYSTEM_KEYS, defaultParams } from './systems.js';
import { sampleOrbit, bounds, createLyapunov, successiveMaxima, sectionCrossings } from './integrate.js';
import { createCamera, fitCamera, orbitCamera, zoomCamera } from './camera.js';
import { createCloud, growthRate } from './cloud.js';
import { drawOrbit, drawCloud, drawEquilibria, drawAxes, drawReturnMap, drawSpread, drawSection, drawBifurcation, bifurcationValueAt } from './render.js';
import { createSweep } from './bifurcation.js';
import { GENERAL, decodeSettings, encodeSettings } from './settings.js';
import { randomSeed } from './rng.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const spreadCanvas = $('spread');
const mapCanvas = $('map');
const bifCanvas = $('bifurcation');

// Long enough for orbits in the periodic windows quoted in the notes to settle.
const TRANSIENT_TIME = 300;
const ORBIT_TIME = 250;

let settings = decodeSettings(location.hash);
let system = SYSTEMS[settings.system];
let cam = createCamera();
let orbit = null;
let cloud = null;
let lyap = null;
let maxima = [];
let mapAxis = system.mapAxis ?? system.up;
let running = true;
let backdrop = null;
let backdropKey = '';
let sweep = null;
let mapMode = 'map';
let levelFraction = 0.5;
let cuts = [];
let sectionLevel = 0;
let sweepKey = system.sweepKey;
let sweepSignature = '';

function colours() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    panel: get('--panel'),
    grid: get('--grid'),
    muted: get('--muted'),
    accent: get('--accent'),
    orbit: get('--orbit'),
    view: get('--view'),
    ink: get('--ink'),
    equilibrium: get('--equilibrium'),
  };
}
let palette = colours();

// ---------- building the system ----------

function rebuild() {
  system = SYSTEMS[settings.system];
  const p = settings.params;
  orbit = sampleOrbit(system, p, {
    transient: Math.round(TRANSIENT_TIME / system.dt),
    count: Math.round((system.orbitTime ?? ORBIT_TIME) / system.dt / 2),
    every: 2,
  });
  const warning = $('warning');
  if (orbit.escaped || orbit.length < 10) {
    warning.hidden = false;
    warning.textContent = 'With these parameters the orbit from the usual start runs off to infinity. Move a slider back or choose Default parameters.';
  } else {
    warning.hidden = true;
  }
  const box = orbit.length ? bounds(orbit.points, orbit.length) : { min: [-1, -1, -1], max: [1, 1, 1], center: [0, 0, 0] };
  cam.up = system.up;
  fitCamera(cam, box, orbit.points, orbit.length);
  cam.yaw = settings.yaw;
  cam.pitch = settings.pitch;
  cam.zoom = settings.zoom;
  updateMapData();
  const start = orbit.length ? Array.from(orbit.state) : system.start;
  lyap = createLyapunov(system, p, { start });
  backdropKey = '';
  restartSweepIfStale();
  release(false);
}

// Return-map maxima and section crossings for the chosen coordinate. The
// section plane sits at a fraction of the way across the attractor's extent.
function updateMapData() {
  if (!orbit || !orbit.length) {
    maxima = [];
    cuts = [];
    return;
  }
  maxima = successiveMaxima(orbit.points, orbit.length, mapAxis);
  const box = bounds(orbit.points, orbit.length);
  sectionLevel = box.min[mapAxis] + levelFraction * (box.max[mapAxis] - box.min[mapAxis]);
  cuts = sectionCrossings(orbit.points, orbit.length, mapAxis, sectionLevel);
}

// The diagram depends on every parameter except the swept one, so moving the
// swept parameter's own slider keeps the finished sweep.
function restartSweepIfStale() {
  const others = Object.entries(settings.params).filter(([k]) => k !== sweepKey);
  const signature = JSON.stringify([settings.system, sweepKey, mapAxis, others]);
  if (signature === sweepSignature && sweep) return;
  sweepSignature = signature;
  sweep = createSweep(system, settings.params, { key: sweepKey, axis: mapAxis, columns: 220 });
}

function buildSweepOptions() {
  const sel = $('sweep-key');
  sel.replaceChildren(
    ...system.params.map((q) => {
      const o = document.createElement('option');
      o.value = q.key;
      o.textContent = q.label;
      return o;
    }),
  );
  sel.value = sweepKey;
}

function release(newSeed = true) {
  if (newSeed) settings.seed = randomSeed();
  const center = orbit && orbit.length ? Array.from(orbit.state) : system.start;
  cloud = createCloud(system, settings.params, {
    center,
    count: settings.count,
    radius: settings.radius,
    tail: settings.tail,
    seed: settings.seed,
  });
  writeHash();
}

// ---------- controls ----------

function fmtParam(v, step) {
  const digits = Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
  return v.toFixed(digits);
}

function buildSystemControls() {
  $('equations').replaceChildren(
    ...system.equations.map((e) => {
      const li = document.createElement('li');
      li.textContent = e;
      return li;
    }),
  );
  const box = $('params');
  box.replaceChildren();
  for (const q of system.params) {
    const id = `param-${q.key}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = q.label + ' ';
    const out = document.createElement('output');
    out.id = `${id}-out`;
    out.textContent = fmtParam(settings.params[q.key], q.step);
    label.append(out);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', id, min: q.min, max: q.max, step: q.step, value: settings.params[q.key] });
    input.addEventListener('input', () => {
      settings.params[q.key] = Number(input.value);
      out.textContent = fmtParam(settings.params[q.key], q.step);
      scheduleRebuild();
    });
    box.append(label, input);
  }
  const year = system.year ? ` (${system.year})` : '';
  $('note').textContent = `${system.name}${year}. ${system.note}`;
  $('map-axis').value = String(mapAxis);
  buildSweepOptions();
}

let rebuildTimer = 0;
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => rebuild(), 60);
}

const radiusLabel = (r) => `10^${Math.round(Math.log10(r))}`;

function syncGeneralControls() {
  $('count').value = settings.count;
  $('count-out').textContent = settings.count;
  $('radius').value = Math.round(Math.log10(settings.radius));
  $('radius-out').textContent = radiusLabel(settings.radius);
  $('tail').value = settings.tail;
  $('tail-out').textContent = settings.tail;
  $('speed').value = settings.speed;
  $('speed-out').textContent = `${settings.speed} steps/frame`;
  $('orbit').checked = settings.orbit;
}

function initControls() {
  const sel = $('system');
  for (const key of SYSTEM_KEYS) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = SYSTEMS[key].name;
    sel.append(o);
  }
  sel.value = settings.system;
  sel.addEventListener('change', () => {
    settings.system = sel.value;
    settings.params = defaultParams(sel.value);
    settings.yaw = GENERAL.yaw.value;
    settings.pitch = GENERAL.pitch.value;
    settings.zoom = GENERAL.zoom.value;
    system = SYSTEMS[sel.value];
    mapAxis = system.mapAxis ?? system.up;
    sweepKey = system.sweepKey;
    buildSystemControls();
    rebuild();
  });
  $('reset-params').addEventListener('click', () => {
    settings.params = defaultParams(settings.system);
    buildSystemControls();
    rebuild();
  });
  $('map-axis').addEventListener('change', (e) => {
    mapAxis = Number(e.target.value);
    updateMapData();
    restartSweepIfStale();
  });
  $('map-mode').addEventListener('change', (e) => {
    mapMode = e.target.value;
    $('level-row').hidden = mapMode !== 'section';
    $('map-help').textContent =
      mapMode === 'section' ? 'Points where the orbit crosses the plane going up.' : 'Each maximum against the one before.';
  });
  $('level').addEventListener('input', (e) => {
    levelFraction = Number(e.target.value);
    updateMapData();
  });
  $('sweep-key').addEventListener('change', (e) => {
    sweepKey = e.target.value;
    restartSweepIfStale();
  });
  bifCanvas.addEventListener('click', (e) => {
    const r = bifCanvas.getBoundingClientRect();
    const v = bifurcationValueAt(sweep, e.clientX - r.left, r.width);
    if (v === null) return;
    const q = system.params.find((p) => p.key === sweepKey);
    settings.params[sweepKey] = Math.round(v / q.step) * q.step;
    buildSystemControls();
    rebuild();
  });
  $('count').addEventListener('input', (e) => {
    settings.count = Number(e.target.value);
    $('count-out').textContent = settings.count;
  });
  $('count').addEventListener('change', () => release(false));
  $('radius').addEventListener('input', (e) => {
    settings.radius = 10 ** Number(e.target.value);
    $('radius-out').textContent = radiusLabel(settings.radius);
    release(false);
  });
  $('tail').addEventListener('input', (e) => {
    settings.tail = Number(e.target.value);
    $('tail-out').textContent = settings.tail;
  });
  $('tail').addEventListener('change', () => release(false));
  $('speed').addEventListener('input', (e) => {
    settings.speed = Number(e.target.value);
    $('speed-out').textContent = `${settings.speed} steps/frame`;
    writeHash();
  });
  $('orbit').addEventListener('change', (e) => {
    settings.orbit = e.target.checked;
    writeHash();
  });
  $('release').addEventListener('click', () => release(true));
  $('run').addEventListener('click', toggleRun);
  $('reset-view').addEventListener('click', () => {
    settings.yaw = GENERAL.yaw.value;
    settings.pitch = GENERAL.pitch.value;
    settings.zoom = GENERAL.zoom.value;
    applyView();
  });
  $('copy').addEventListener('click', copyLink);
  $('png').addEventListener('click', savePng);
}

function toggleRun() {
  running = !running;
  $('run').textContent = running ? 'Pause' : 'Run';
  $('run').setAttribute('aria-pressed', String(running));
}

function applyView() {
  cam.yaw = settings.yaw;
  cam.pitch = settings.pitch;
  cam.zoom = settings.zoom;
  writeHash();
}

function storeView() {
  settings.yaw = cam.yaw;
  settings.pitch = cam.pitch;
  settings.zoom = cam.zoom;
  writeHash();
}

let hashTimer = 0;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const h = encodeSettings(settings);
    history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
  }, 150);
}

async function copyLink() {
  const h = encodeSettings(settings);
  const url = location.origin + location.pathname + (h ? `#${h}` : '');
  try {
    await navigator.clipboard.writeText(url);
    flash('Link copied.');
  } catch {
    flash(url);
  }
}

function savePng() {
  const a = document.createElement('a');
  a.download = `attractorium-${settings.system}.png`;
  a.href = view.toDataURL('image/png');
  a.click();
}

let flashText = '';
let flashUntil = 0;
function flash(text) {
  flashText = text;
  flashUntil = performance.now() + 2500;
}

// ---------- pointer and keyboard ----------

function initPointer() {
  const pointers = new Map();
  let pinch = 0;
  view.addEventListener('pointerdown', (e) => {
    view.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinch = pinchDistance(pointers);
  });
  view.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      orbitCamera(cam, now.x - prev.x, now.y - prev.y);
    }
    pointers.set(e.pointerId, now);
    if (pointers.size === 2) {
      const d = pinchDistance(pointers);
      if (pinch > 0) zoomCamera(cam, d / pinch);
      pinch = d;
    }
  });
  const end = (e) => {
    if (pointers.delete(e.pointerId)) storeView();
    pinch = 0;
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomCamera(cam, Math.exp(-e.deltaY * 0.0015));
      storeView();
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    const turn = 0.08;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        toggleRun();
        break;
      case 'r':
      case 'R':
        release(true);
        break;
      case 'o':
      case 'O':
        settings.orbit = !settings.orbit;
        $('orbit').checked = settings.orbit;
        writeHash();
        break;
      case 'ArrowLeft':
        orbitCamera(cam, -turn / 0.01, 0);
        storeView();
        break;
      case 'ArrowRight':
        orbitCamera(cam, turn / 0.01, 0);
        storeView();
        break;
      case 'ArrowUp':
        e.preventDefault();
        orbitCamera(cam, 0, -turn / 0.01);
        storeView();
        break;
      case 'ArrowDown':
        e.preventDefault();
        orbitCamera(cam, 0, turn / 0.01);
        storeView();
        break;
      case '+':
      case '=':
        zoomCamera(cam, 1.15);
        storeView();
        break;
      case '-':
      case '_':
        zoomCamera(cam, 1 / 1.15);
        storeView();
        break;
      default:
        return;
    }
  });
}

function pinchDistance(pointers) {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------- drawing ----------

function sizeCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { width: w, height: h, dpr };
}

// The long orbit only changes with the view, so it is drawn once into an
// offscreen canvas and copied each frame.
function drawBackdrop(width, height) {
  const key = [width, height, cam.yaw, cam.pitch, cam.zoom, cam.radius, settings.orbit, palette.orbit].join('|');
  if (key === backdropKey && backdrop) return backdrop;
  backdropKey = key;
  backdrop = backdrop || document.createElement('canvas');
  backdrop.width = width;
  backdrop.height = height;
  const ctx = backdrop.getContext('2d');
  ctx.fillStyle = palette.view;
  ctx.fillRect(0, 0, width, height);
  if (settings.orbit && orbit.length) drawOrbit(ctx, cam, orbit, { width, height, colour: palette.orbit, alpha: 0.3 });
  return backdrop;
}

function draw() {
  const { width, height, dpr } = sizeCanvas(view);
  const ctx = view.getContext('2d');
  ctx.drawImage(drawBackdrop(width, height), 0, 0);
  // Equilibria far outside the attractor (such as Rössler's outer one) would
  // only be clipped at the edge, so they are left out.
  const eq = (system.equilibria ? system.equilibria(settings.params) : []).filter(
    (e) => Math.hypot(e[0] - cam.center[0], e[1] - cam.center[1], e[2] - cam.center[2]) < 1.2 * cam.radius,
  );
  drawEquilibria(ctx, cam, eq, { width, height, colour: palette.equilibrium });
  drawCloud(ctx, cam, cloud, { width, height });
  ctx.save();
  ctx.scale(dpr, dpr);
  drawAxes(ctx, cam, { width: width / dpr, height: height / dpr, colour: palette.muted });
  ctx.restore();

  const lambda = lyap.value;
  const s1 = sizeCanvas(spreadCanvas);
  const sctx = spreadCanvas.getContext('2d');
  sctx.save();
  sctx.scale(s1.dpr, s1.dpr);
  drawSpread(sctx, cloud.history, { width: s1.width / s1.dpr, height: s1.height / s1.dpr, colours: palette, lambda, radius: settings.radius });
  sctx.restore();
  const m1 = sizeCanvas(mapCanvas);
  const mctx = mapCanvas.getContext('2d');
  mctx.save();
  mctx.scale(m1.dpr, m1.dpr);
  const mapSize = { width: m1.width / m1.dpr, height: m1.height / m1.dpr, colours: palette };
  if (mapMode === 'section') drawSection(mctx, cuts, { ...mapSize, axis: mapAxis, level: sectionLevel });
  else drawReturnMap(mctx, maxima, { ...mapSize, axisName: 'xyz'[mapAxis] });
  mctx.restore();
  const b1 = sizeCanvas(bifCanvas);
  const bctx = bifCanvas.getContext('2d');
  bctx.save();
  bctx.scale(b1.dpr, b1.dpr);
  const q = system.params.find((p) => p.key === sweepKey);
  drawBifurcation(bctx, sweep, {
    width: b1.width / b1.dpr,
    height: b1.height / b1.dpr,
    colours: palette,
    current: settings.params[sweepKey],
    label: q.label,
    axisName: 'xyz'[mapAxis],
  });
  bctx.restore();
}

function updateReadouts() {
  const lambda = lyap.value;
  $('lyap').textContent = Number.isFinite(lambda) ? `${lambda.toFixed(3)} (t = ${lyap.time.toFixed(0)})` : '–';
  const g = growthRate(cloud.history, Math.max(settings.radius * 3, 1e-12), Math.max(cam.radius * 0.05, settings.radius * 10));
  // Early on the spread wobbles while the cloud lines up with the stretching
  // direction, so the fit is only shown once the cloud has grown a hundredfold.
  const grown = cloud.history.some((h) => h.spread > 100 * cloud.history[0].spread);
  $('growth').textContent = !grown ? 'waiting for the cloud to grow' : Number.isFinite(g.rate) && g.samples >= 40 ? `${g.rate.toFixed(3)} per unit time` : '–';
  $('doubling').textContent = Number.isFinite(lambda) && lambda > 0.005 ? `${(Math.LN2 / lambda).toFixed(2)} time units` : 'none (no exponential growth)';
  $('alive').textContent = `${cloud.aliveCount()} of ${cloud.count}`;
  const spread = cloud.history[cloud.history.length - 1].spread;
  const text =
    performance.now() < flashUntil
      ? flashText
      : `${system.name} · t = ${cloud.time.toFixed(1)} · cloud spread ${spread.toExponential(2)}${running ? '' : ' · paused'}`;
  $('status').textContent = text;
}

let lastReadout = 0;
function frame(now) {
  if (running) {
    cloud.advance(settings.speed);
    lyap.advance(Math.max(1, Math.round(settings.speed / 2)));
  }
  if (!sweep.done) sweep.advance(8, Infinity, () => performance.now());
  draw();
  if (now - lastReadout > 200) {
    updateReadouts();
    lastReadout = now;
  }
  requestAnimationFrame(frame);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  palette = colours();
  backdropKey = '';
});

window.addEventListener('hashchange', () => {
  const next = decodeSettings(location.hash);
  if (encodeSettings(next) === encodeSettings(settings)) return;
  settings = next;
  system = SYSTEMS[settings.system];
  mapAxis = system.mapAxis ?? system.up;
  sweepKey = system.sweepKey;
  $('system').value = settings.system;
  buildSystemControls();
  syncGeneralControls();
  rebuild();
});

initControls();
buildSystemControls();
syncGeneralControls();
initPointer();
rebuild();
requestAnimationFrame(frame);
