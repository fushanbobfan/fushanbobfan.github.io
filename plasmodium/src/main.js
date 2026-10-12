// The page: wires the simulation to the canvas and the controls.
// Everything else in src/ is plain logic covered by the Node tests.

import { createSim, stepSim, resetSim, retune, normalizeSettings } from './sim.js';
import { PRESETS, DEFAULT_PRESET, presetSettings } from './presets.js';
import { LAYOUTS } from './spawn.js';
import { FOOD_LAYOUTS, placeFoodLayout, addFood, removeFoodNear, FOOD_RADIUS } from './food.js';
import { PALETTES, buildLut, paintTrail } from './render.js';
import { analyse } from './network.js';
import { stamp } from './trail.js';
import { encodeState, decodeState } from './share.js';
import { randomSeed } from './rng.js';

const $ = (id) => document.getElementById(id);
const canvas = $('dish');
const ctx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');

const LIVE_KEYS = ['sensorAngle', 'turnAngle', 'sensorDistance', 'stepSize', 'depositAmount', 'decay', 'spread', 'foodStrength'];
const RESET_KEYS = ['population'];
const FOOD_LABELS = {
  none: 'None',
  pair: 'Two flakes',
  triangle: 'Three flakes',
  square: 'Four flakes',
  pentagon: 'Five flakes',
  grid: 'Twelve flakes in a grid',
};
const DISPLAY_SCALE = 3;

let sim;
let image;
let lut = buildLut(PALETTES.slime.stops);
let view = { palette: 'slime', exposure: 1 };
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let speed = 2;
let frame = 0;
let painting = false;

function fillSelect(select, entries) {
  select.replaceChildren(
    ...entries.map(([value, label]) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      return o;
    }),
  );
}

fillSelect($('preset'), [['', 'Custom'], ...Object.entries(PRESETS).map(([k, p]) => [k, p.label])]);
fillSelect($('layout'), Object.entries(LAYOUTS));
fillSelect($('food'), Object.keys(FOOD_LAYOUTS).map((k) => [k, FOOD_LABELS[k] || k]));
fillSelect($('palette'), Object.entries(PALETTES).map(([k, p]) => [k, p.label]));

function formatValue(input) {
  const v = Number(input.value);
  if (input.hasAttribute('data-percent')) return `${Math.round(v * 100)}%`;
  if (input.id === 'population') return v.toLocaleString('en-US');
  if (input.id === 'exposure') return `${v}×`;
  const unit = input.dataset.unit || '';
  return `${v}${v === 1 && unit === ' cells' ? ' cell' : unit}`;
}

function showOutput(input) {
  const out = document.querySelector(`output[for="${input.id}"]`);
  if (out) out.textContent = formatValue(input);
}

function syncControls() {
  const s = sim.settings;
  for (const key of [...LIVE_KEYS, ...RESET_KEYS]) {
    $(key).value = s[key];
    showOutput($(key));
  }
  $('layout').value = s.layout;
  $('wrap').checked = s.wrap;
  $('palette').value = view.palette;
  $('exposure').value = view.exposure;
  showOutput($('exposure'));
  $('speed').value = speed;
  showOutput($('speed'));
  $('play').textContent = playing ? 'Pause' : 'Play';
}

function build(settings, foods) {
  sim = createSim(settings);
  sim.foods = foods.map((f) => ({ ...f }));
  const { width, height } = sim.settings;
  offscreen.width = width;
  offscreen.height = height;
  image = offCtx.createImageData(width, height);
  canvas.width = width * DISPLAY_SCALE;
  canvas.height = height * DISPLAY_SCALE;
  canvas.style.aspectRatio = `${width} / ${height}`;
  frame = 0;
}

function loadPreset(name) {
  const p = PRESETS[name] || PRESETS[DEFAULT_PRESET];
  const settings = { ...presetSettings(name), seed: sim ? sim.settings.seed : 1 };
  const s = normalizeSettings(settings);
  build(s, placeFoodLayout(p.food, s.width, s.height));
  $('preset').value = name;
  $('food').value = p.food;
  $('preset-note').textContent = p.note;
  syncControls();
  render(true);
}

function markCustom() {
  $('preset').value = '';
  $('preset-note').textContent = 'Your own settings. Pick a preset to start over from a named one.';
}

function render(full) {
  paintTrail(sim.trail, image.data, lut, view.exposure);
  offCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

  const dark = view.palette !== 'ink';
  ctx.lineWidth = 2;
  ctx.strokeStyle = dark ? 'rgba(255, 244, 200, 0.95)' : 'rgba(120, 60, 20, 0.95)';
  for (const f of sim.foods) {
    ctx.beginPath();
    ctx.arc((f.x + 0.5) * DISPLAY_SCALE, (f.y + 0.5) * DISPLAY_SCALE, (FOOD_RADIUS + 2) * DISPLAY_SCALE, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (full || frame % 15 === 0) updateReadout();
}

function updateReadout() {
  const r = analyse(sim.trail, sim.foods, sim.settings.wrap);
  $('r-steps').textContent = sim.steps.toLocaleString('en-US');
  $('r-cover').textContent = sim.steps ? `${(r.coverage * 100).toFixed(1)}%` : '–';
  $('r-pieces').textContent = sim.steps ? String(r.pieces) : '–';
  $('r-food').textContent = r.foodTotal ? `${r.foodLinked} of ${r.foodTotal} on one piece` : 'no food';
  $('status').textContent =
    `${sim.agents.count.toLocaleString('en-US')} particles on a ${sim.settings.width} × ${sim.settings.height} dish` +
    `${sim.settings.wrap ? ' with wrapping edges' : ''}, seed ${sim.settings.seed}` +
    (playing ? '' : ' · paused');
}

let hashTimer = 0;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const hash = encodeState({ settings: sim.settings, foods: sim.foods, view });
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
  }, 250);
}

function tick() {
  if (playing) {
    stepSim(sim, speed);
    frame++;
    render(false);
  }
  requestAnimationFrame(tick);
}

function setPlaying(on) {
  playing = on;
  $('play').textContent = playing ? 'Pause' : 'Play';
  updateReadout();
}

function reset() {
  build(
    normalizeSettings({
      ...sim.settings,
      population: Number($('population').value),
      layout: $('layout').value,
      wrap: $('wrap').checked,
    }),
    sim.foods,
  );
  render(true);
  writeHash();
}

// Controls

for (const key of LIVE_KEYS) {
  $(key).addEventListener('input', (e) => {
    showOutput(e.target);
    retune(sim, { [key]: Number(e.target.value) });
    markCustom();
    writeHash();
  });
}

$('population').addEventListener('input', (e) => {
  showOutput(e.target);
  markCustom();
});
$('layout').addEventListener('change', markCustom);
$('wrap').addEventListener('change', markCustom);

$('food').addEventListener('change', (e) => {
  sim.foods = placeFoodLayout(e.target.value, sim.settings.width, sim.settings.height);
  markCustom();
  render(true);
  writeHash();
});

$('preset').addEventListener('change', (e) => {
  if (e.target.value) {
    loadPreset(e.target.value);
    writeHash();
  }
});

$('palette').addEventListener('change', (e) => {
  view.palette = e.target.value;
  lut = buildLut(PALETTES[view.palette].stops);
  render(true);
  writeHash();
});

$('exposure').addEventListener('input', (e) => {
  view.exposure = Number(e.target.value);
  showOutput(e.target);
  render(true);
  writeHash();
});

$('speed').addEventListener('input', (e) => {
  speed = Number(e.target.value);
  showOutput(e.target);
});

$('play').addEventListener('click', () => setPlaying(!playing));
$('step').addEventListener('click', () => {
  setPlaying(false);
  stepSim(sim, 1);
  render(true);
});
$('reset').addEventListener('click', reset);
$('reseed').addEventListener('click', () => {
  sim.settings.seed = randomSeed();
  reset();
});

$('png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plasmodium-${sim.settings.seed}-step${sim.steps}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

$('copy').addEventListener('click', async () => {
  const hash = encodeState({ settings: sim.settings, foods: sim.foods, view });
  const url = `${location.origin}${location.pathname}${hash ? `#${hash}` : ''}`;
  try {
    await navigator.clipboard.writeText(url);
    $('status').textContent = 'Link copied.';
  } catch {
    $('status').textContent = url;
  }
});

// Dish: click for food, drag with the brush for attractant

function dishPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * sim.settings.width,
    y: ((e.clientY - rect.top) / rect.height) * sim.settings.height,
  };
}

function brushAt(e) {
  const p = dishPoint(e);
  stamp(sim.trail, p.x, p.y, 3, 40, sim.settings.wrap);
  if (!playing) render(true);
}

canvas.addEventListener('pointerdown', (e) => {
  if ($('brush').checked) {
    painting = true;
    canvas.setPointerCapture(e.pointerId);
    brushAt(e);
    return;
  }
  const p = dishPoint(e);
  if (!removeFoodNear(sim.foods, p.x, p.y, FOOD_RADIUS + 4)) addFood(sim.foods, Math.floor(p.x), Math.floor(p.y));
  $('food').value = '';
  markCustom();
  render(true);
  writeHash();
});
canvas.addEventListener('pointermove', (e) => {
  if (painting) brushAt(e);
});
canvas.addEventListener('pointerup', () => {
  painting = false;
});
canvas.addEventListener('pointercancel', () => {
  painting = false;
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, button') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') {
    e.preventDefault();
    setPlaying(!playing);
  } else if (e.key === 's' || e.key === 'S') {
    setPlaying(false);
    stepSim(sim, 1);
    render(true);
  } else if (e.key === 'r' || e.key === 'R') {
    reset();
  } else if (e.key === 'n' || e.key === 'N') {
    sim.settings.seed = randomSeed();
    reset();
  }
});

// Start: a share link if there is one, the default preset otherwise.

if (location.hash.length > 1) {
  const state = decodeState(location.hash);
  view = state.view;
  build(state.settings, state.foods);
  $('food').value = '';
  markCustom();
  syncControls();
} else {
  sim = null;
  loadPreset(DEFAULT_PRESET);
}
lut = buildLut(PALETTES[view.palette].stops);
render(true);
requestAnimationFrame(tick);
