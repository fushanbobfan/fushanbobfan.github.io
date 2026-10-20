import { World } from './world.js';
import { SPECIES } from './species.js';
import { speciesById, speciesRule, speciesPattern } from './patterns.js';
import { soup, brush } from './seed.js';
import { PALETTES, DIVERGING, buildLut, paint, viewRange } from './render.js';
import { parseRings, formatRings } from './rules.js';
import { normalize, toHash, fromHash, ruleOf } from './settings.js';
import { runSteps, smoothStepTime } from './pace.js';
import { drawInspector } from './inspector.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const ctx = canvas.getContext('2d');

let settings = fromHash(location.hash);
let world = null;
let image = null;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let tool = 'stamp';
const luts = {};
const divergingLut = buildLut(DIVERGING);

function lut(name) {
  if (!luts[name]) luts[name] = buildLut(PALETTES[name]);
  return luts[name];
}

function species() {
  return speciesById(settings.species);
}

// ---- world lifecycle ----

function makeWorld() {
  world = new World(settings.size, ruleOf(settings));
  canvas.width = canvas.height = settings.size;
  image = ctx.createImageData(settings.size, settings.size);
}

function placeSpecies(cx, cy) {
  const p = speciesPattern(species(), settings.scale);
  world.place(p, Math.round(cx - p.width / 2), Math.round(cy - p.height / 2));
}

function loadAlone() {
  world.clear();
  placeSpecies(settings.size / 2, settings.size / 2);
  settings.start = 'species';
  draw();
}

function loadSoup(newSeed) {
  if (newSeed) settings.seed = Math.floor(Math.random() * 2 ** 31);
  world.clear();
  const area = (settings.size / 256) ** 2;
  soup(world, { seed: settings.seed, count: Math.max(4, Math.round(10 * area)), size: 2 * settings.R });
  settings.start = 'soup';
  draw();
}

function start() {
  makeWorld();
  if (settings.start === 'soup') loadSoup(false);
  else loadAlone();
}

// ---- drawing ----

function draw() {
  const { view } = settings;
  const field = view === 'potential' ? world.potential : view === 'growth' ? world.change : world.cells;
  if (view !== 'cells' && world.time === 0) {
    world.sense();
    if (view === 'growth') {
      const { mu, sigma } = world.rule;
      for (let i = 0; i < world.change.length; i++) {
        const z = (world.potential[i] - mu) / sigma;
        world.change[i] = 2 * Math.exp(-0.5 * z * z) - 1;
      }
    }
  }
  const [lo, hi] = viewRange(view, world.rule);
  paint(field, image.data, view === 'growth' ? divergingLut : lut(settings.palette), lo, hi);
  ctx.putImageData(image, 0, 0);
}

function inspect() {
  if (world.time === 0 || !playing) world.sense();
  $('inspector-text').textContent = drawInspector($('inspector'), world.rule, world.potential);
}

// ---- controls ----

function fillSpecies() {
  const sel = $('species');
  for (const s of SPECIES) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.name} (${s.code})`;
    sel.append(o);
  }
}

const RULE_KEYS = ['R', 'T', 'mu', 'sigma'];

function syncControls() {
  $('species').value = settings.species;
  $('species-note').textContent = species().note;
  $('scale').value = String(settings.scale);
  for (const k of RULE_KEYS) {
    $(k).value = String(settings[k]);
    $(`${k}-out`).textContent = String(settings[k]);
  }
  $('rings').value = settings.rings;
  $('rings').removeAttribute('aria-invalid');
  $('view').value = settings.view;
  $('palette').value = settings.palette;
  $('size').value = String(settings.size);
}

function useSpeciesRule() {
  const r = speciesRule(species(), settings.scale);
  settings = normalize({ ...settings, R: r.R, T: r.T, mu: r.mu, sigma: r.sigma, rings: formatRings(r.rings) });
  world.setRule(ruleOf(settings));
  syncControls();
  inspect();
}

function applyRule() {
  world.setRule(ruleOf(settings));
  if (!playing) draw();
  inspect();
}

function setStatus(text) {
  $('status').textContent = text;
}

function bindControls() {
  $('species').addEventListener('change', (e) => {
    settings.species = e.target.value;
    useSpeciesRule();
    loadAlone();
  });
  $('scale').addEventListener('change', (e) => {
    settings.scale = Number(e.target.value);
    useSpeciesRule();
    loadAlone();
  });
  $('load').addEventListener('click', () => {
    useSpeciesRule();
    loadAlone();
  });
  $('soup').addEventListener('click', () => loadSoup(true));
  $('clear').addEventListener('click', () => {
    world.clear();
    draw();
  });
  $('reset-rule').addEventListener('click', () => {
    useSpeciesRule();
    if (!playing) draw();
  });

  for (const k of RULE_KEYS) {
    $(k).addEventListener('input', (e) => {
      settings[k] = Number(e.target.value);
      $(`${k}-out`).textContent = e.target.value;
      applyRule();
    });
  }
  $('rings').addEventListener('change', (e) => {
    try {
      settings.rings = formatRings(parseRings(e.target.value));
      e.target.value = settings.rings;
      e.target.removeAttribute('aria-invalid');
      applyRule();
      setStatus('');
    } catch (err) {
      e.target.setAttribute('aria-invalid', 'true');
      setStatus(err.message);
    }
  });

  $('view').addEventListener('change', (e) => {
    settings.view = e.target.value;
    draw();
  });
  $('palette').addEventListener('change', (e) => {
    settings.palette = e.target.value;
    draw();
  });
  $('size').addEventListener('change', (e) => {
    settings.size = Number(e.target.value);
    start();
  });

  for (const r of document.querySelectorAll('input[name="tool"]')) {
    r.addEventListener('change', (e) => {
      tool = e.target.value;
    });
  }
  $('brush').addEventListener('input', (e) => {
    $('brush-out').textContent = e.target.value;
  });

  $('play').addEventListener('click', () => setPlaying(!playing));
  $('step').addEventListener('click', () => {
    setPlaying(false);
    world.step();
    draw();
    readouts();
  });
  $('speed').addEventListener('input', (e) => {
    $('speed-out').textContent = e.target.value;
  });

  $('share').addEventListener('click', share);
  $('png').addEventListener('click', savePng);

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'text') return;
    if (t instanceof HTMLSelectElement) return;
    if (e.key === ' ' && !(t instanceof HTMLButtonElement)) {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === 's' || e.key === 'S') {
      $('step').click();
    } else if (e.key === 'c' || e.key === 'C') {
      $('clear').click();
    }
  });
}

function setPlaying(on) {
  playing = on;
  $('play').textContent = on ? 'Pause' : 'Play';
  $('play').setAttribute('aria-pressed', String(on));
}

// ---- pointer tools ----

function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * settings.size, ((e.clientY - r.top) / r.height) * settings.size];
}

function applyTool(e, first) {
  const [x, y] = cellAt(e);
  if (tool === 'stamp') {
    if (first) placeSpecies(x, y);
  } else {
    const radius = Number($('brush').value) * (settings.size / 256);
    brush(world, x, y, radius, tool === 'erase' ? -1 : 0.35);
  }
  if (!playing) draw();
}

function bindPointer() {
  let down = false;
  canvas.addEventListener('pointerdown', (e) => {
    down = true;
    canvas.setPointerCapture(e.pointerId);
    applyTool(e, true);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) applyTool(e, false);
  });
  const up = () => {
    down = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

// ---- sharing ----

async function share() {
  const hash = toHash(settings);
  history.replaceState(null, '', hash);
  try {
    await navigator.clipboard.writeText(location.href);
    setStatus('Link copied. It restarts this creature or soup with the current rule.');
  } catch {
    setStatus('Link is in the address bar.');
  }
}

function savePng() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orbium-${settings.start === 'soup' ? `soup-${settings.seed}` : settings.species}-t${Math.round(world.time)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

// ---- loop ----

let frames = 0;
let stepsDone = 0;
let lastRate = performance.now();
let msPerStep = 0;
const clock = () => performance.now();
const stepOnce = () => world.step();

function readouts() {
  $('r-time').textContent = world.time.toFixed(1);
  $('r-mass').textContent = world.mass().toFixed(0);
}

function frame(now) {
  if (playing) {
    const ran = runSteps(Number($('speed').value), stepOnce, clock);
    msPerStep = smoothStepTime(msPerStep, ran);
    stepsDone += ran.done;
    draw();
  }
  if (++frames % 10 === 0) {
    readouts();
    inspect();
  }
  if (now - lastRate > 1000) {
    $('r-rate').textContent = String(Math.round((stepsDone * 1000) / (now - lastRate)));
    $('r-cost').textContent = msPerStep > 0 ? msPerStep.toFixed(1) : '–';
    stepsDone = 0;
    lastRate = now;
  }
  requestAnimationFrame(frame);
}

fillSpecies();
syncControls();
bindControls();
bindPointer();
start();
setPlaying(playing);
readouts();
inspect();
requestAnimationFrame(frame);
