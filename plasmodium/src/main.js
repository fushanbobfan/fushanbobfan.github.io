// The page: wires the simulation to the canvas and the controls.
// Everything else in src/ is plain logic covered by the Node tests.

import { createSim, stepSim, resetSim, retune, normalizeSettings, buildMaze } from './sim.js';
import { PRESETS, DEFAULT_PRESET, presetSettings } from './presets.js';
import { LAYOUTS } from './spawn.js';
import { FOOD_LAYOUTS, placeFoodLayout, addFood, removeFoodNear, FOOD_RADIUS } from './food.js';
import { PALETTES, buildLut, paintTrail, paintColonies, hexToRgb } from './render.js';
import { analyse, routeContrast, combineLayers, territories } from './network.js';
import { stamp, clearWalls, setWall } from './trail.js';
import { paintWalls, encodeWalls, decodeWalls } from './walls.js';
import { encodeState, decodeState } from './share.js';
import { randomSeed } from './rng.js';

const $ = (id) => document.getElementById(id);
const canvas = $('dish');
const ctx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');

const LIVE_KEYS = ['sensorAngle', 'turnAngle', 'sensorDistance', 'stepSize', 'depositAmount', 'repel', 'decay', 'spread', 'foodStrength'];
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
let wallRgb = hexToRgb(PALETTES.slime.wall);
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
  $('colonies').value = String(s.colonies);
  $('wrap').checked = s.wrap;
  $('palette').value = view.palette;
  $('exposure').value = view.exposure;
  showOutput($('exposure'));
  $('speed').value = speed;
  showOutput($('speed'));
  $('play').textContent = playing ? 'Pause' : 'Play';
}

const HINTS = {
  food: 'Click the dish to drop food; click a food source to take it away.',
  attract: 'Drag across the dish to paint attractant and lure the particles.',
  wall: 'Drag across the dish to build walls. Particles turn away from them and no trail crosses them.',
  erase: 'Drag across the dish to erase walls.',
};

// walls: { maze } to carve a maze from its recipe, { mask } to copy a wall
// mask of the same size, or { code } for a run-length code from a link.
// foods: null keeps whatever the maze placed.
function build(settings, foods, walls = null) {
  sim = createSim(settings);
  if (walls && walls.maze) {
    buildMaze(sim, walls.maze);
  } else if (walls && walls.mask && walls.mask.length === sim.trail.walls.length) {
    walls.mask.forEach((v, i) => v && setWall(sim.trail, i, true));
    resetSim(sim);
  } else if (walls && walls.code && decodeWalls(sim.trail, walls.code)) {
    resetSim(sim);
  }
  if (foods) sim.foods = foods.map((f) => ({ ...f }));
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
  if (p.maze) {
    build(s, null, { maze: { ...p.maze, seed: s.seed } });
    $('corridor').value = p.maze.corridor;
    $('loops').checked = p.maze.loops > 0;
  } else {
    build(s, placeFoodLayout(p.food, s.width, s.height));
  }
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
  if (sim.layers.length > 1) paintColonies(sim.layers, image.data, PALETTES[view.palette], view.exposure, wallRgb);
  else paintTrail(sim.trail, image.data, lut, view.exposure, wallRgb);
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

let combined = null;

function updateReadout() {
  combined = combineLayers(sim.layers, combined);
  const r = analyse(combined, sim.foods, sim.settings.wrap);
  const multi = sim.layers.length > 1;
  $('r-colonies-label').hidden = !multi;
  $('r-colonies').hidden = !multi;
  if (multi) {
    const cols = PALETTES[view.palette].colonies;
    $('r-colonies').replaceChildren(
      ...territories(sim.layers).map((share, k) => {
        const span = document.createElement('span');
        span.className = 'share';
        span.style.setProperty('--swatch', cols[k]);
        span.textContent = sim.steps ? `${Math.round(share * 100)}%` : '–';
        return span;
      }),
    );
  }
  $('r-steps').textContent = sim.steps.toLocaleString('en-US');
  $('r-cover').textContent = sim.steps ? `${(r.coverage * 100).toFixed(1)}%` : '–';
  $('r-pieces').textContent = sim.steps ? String(r.pieces) : '–';
  $('r-food').textContent = r.foodTotal ? `${r.foodLinked} of ${r.foodTotal} on one piece` : 'no food';
  const contrast = sim.maze && sim.steps ? routeContrast(sim.trail, sim.maze) : null;
  $('r-route-label').hidden = !sim.maze;
  $('r-route').hidden = !sim.maze;
  $('r-route').textContent = contrast === null ? '–' : `${contrast.toFixed(1)}× the trail`;
  $('status').textContent =
    `${sim.agents.count.toLocaleString('en-US')} particles` +
    `${sim.layers.length > 1 ? ` in ${sim.layers.length} colonies` : ''} on a ${sim.settings.width} × ${sim.settings.height} dish` +
    `${sim.settings.wrap ? ' with wrapping edges' : ''}, seed ${sim.settings.seed}` +
    (playing ? '' : ' · paused');
}

function shareState() {
  return {
    settings: sim.settings,
    foods: sim.foods,
    view,
    maze: sim.maze ? sim.maze.spec : null,
    walls: sim.maze ? '' : encodeWalls(sim.trail),
  };
}

function currentWalls() {
  if (sim.maze) return { maze: sim.maze.spec };
  return sim.trail.wallCount ? { mask: Uint8Array.from(sim.trail.walls) } : null;
}

let hashTimer = 0;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const hash = encodeState(shareState());
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
      colonies: Number($('colonies').value),
      wrap: $('wrap').checked,
    }),
    sim.foods,
    currentWalls(),
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
$('colonies').addEventListener('change', markCustom);
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
  wallRgb = hexToRgb(PALETTES[view.palette].wall);
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
  const hash = encodeState(shareState());
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

let lastBrush = null;

// Stamps along the segment from the previous pointer position, one cell
// apart, so a quick drag leaves a solid wall instead of a row of dots.
function brushAt(e) {
  const p = dishPoint(e);
  const from = lastBrush || p;
  const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y)));
  const tool = $('tool').value;
  let changed = 0;
  for (let k = lastBrush ? 1 : 0; k <= steps; k++) {
    const x = from.x + ((p.x - from.x) * k) / steps;
    const y = from.y + ((p.y - from.y) * k) / steps;
    if (tool === 'attract') stamp(sim.trail, x, y, 3, 40 / steps, sim.settings.wrap);
    else changed += paintWalls(sim.trail, x, y, 2.5, tool === 'wall');
  }
  lastBrush = p;
  if (changed) {
    sim.maze = null;
    markCustom();
    writeHash();
  }
  if (!playing) render(true);
}

canvas.addEventListener('pointerdown', (e) => {
  if ($('tool').value !== 'food') {
    painting = true;
    lastBrush = null;
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

$('tool').addEventListener('change', (e) => {
  $('hint').textContent = HINTS[e.target.value];
});

$('corridor').addEventListener('input', (e) => showOutput(e.target));

$('maze').addEventListener('click', () => {
  const spec = { seed: randomSeed(), corridor: Number($('corridor').value), thickness: 4, loops: $('loops').checked ? 0.15 : 0 };
  if (sim.settings.wrap) {
    $('wrap').checked = false;
    build(normalizeSettings({ ...sim.settings, wrap: false }), null, { maze: spec });
  } else {
    buildMaze(sim, spec);
  }
  $('food').value = '';
  markCustom();
  render(true);
  writeHash();
});

$('clear-walls').addEventListener('click', () => {
  clearWalls(sim.trail);
  sim.maze = null;
  markCustom();
  render(true);
  writeHash();
});

// Start: a share link if there is one, the default preset otherwise.

if (location.hash.length > 1) {
  const state = decodeState(location.hash);
  view = state.view;
  build(state.settings, state.foods, { maze: state.maze, code: state.walls });
  $('food').value = '';
  markCustom();
  syncControls();
} else {
  sim = null;
  loadPreset(DEFAULT_PRESET);
}
lut = buildLut(PALETTES[view.palette].stops);
wallRgb = hexToRgb(PALETTES[view.palette].wall);
$('hint').textContent = HINTS[$('tool').value];
showOutput($('corridor'));
render(true);
requestAnimationFrame(tick);
