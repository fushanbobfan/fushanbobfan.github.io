// Page wiring: the animation loop, pointer and keyboard input, controls,
// readouts, sound, share links and PNG export.

import { SOUND_SPEED, WORLD } from './path.js';
import { createSim, stepSim, heard, windVelocity, STEP } from './sim.js';
import { machAngle, dopplerRatio } from './doppler.js';
import { makeView, toWorld, toScreen, airMotion, drawWorld, drawPitch, drawTrace } from './render.js';
import { PRESETS, applyPreset, encode, decode } from './settings.js';
import { pressure, Trace, BoomLog } from './signal.js';
import { Tone } from './audio.js';

const $ = (id) => document.getElementById(id);
const worldCanvas = $('world');
const pitchCanvas = $('pitch');
const micCanvas = $('mic');
const wctx = worldCanvas.getContext('2d');
const pctx = pitchCanvas.getContext('2d');
const mctx = micCanvas.getContext('2d');

let settings = decode(location.hash);
const listenerFromSettings = () => ({ x: settings.lx * WORLD.width, y: settings.ly * WORLD.height });
let sim = createSim({ ...settings, listener: listenerFromSettings() });
let playing = true;
let samples = [];
let view = makeView(1, 1, sim.world);
let lastFrame = null;
let found = [];
const tone = new Tone();

const CHART_WINDOW = 10;
const MIC_WINDOW = 4;
// How long the listener's ring flashes after a boom, in seconds.
const FLASH = 0.6;
const trace = new Trace(MIC_WINDOW);
const booms = new BoomLog(CHART_WINDOW);

// A restart keeps the listener where it is unless the settings say otherwise.
function restart(listener = { x: sim.listener.x, y: sim.listener.y }) {
  sim = createSim({ ...settings, listener });
  samples = [];
  trace.clear();
  booms.times = [];
  booms.count = null;
  found = [];
  lastFrame = null;
}

function writeHash() {
  settings.lx = sim.listener.x / sim.world.width;
  settings.ly = sim.listener.y / sim.world.height;
  const text = encode(settings);
  history.replaceState(null, '', text ? `#${text}` : location.pathname + location.search);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  for (const c of [worldCanvas, pitchCanvas, micCanvas]) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
  }
  view = makeView(worldCanvas.width, worldCanvas.height, sim.world);
}

const windText = (w) => (w === 0 ? 'calm' : `${fmt(Math.abs(w))} c to the ${w > 0 ? 'right' : 'left'}`);
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const ratioText = (r) => (Math.abs(r) > 50 ? '≫ 1' : `×${fmt(Math.abs(r))}${r < 0 ? ' (backwards)' : ''}`);

function updateReadouts() {
  const wind = windVelocity(sim);
  const air = airMotion(sim.src, wind, sim.c);
  const m = air.mach;
  const v = Math.hypot(sim.src.vx, sim.src.vy);
  // Along the line of motion, or along x for a source at rest.
  const ux = v > 0 ? sim.src.vx / v : 1;
  const uy = v > 0 ? sim.src.vy / v : 0;
  const ahead = dopplerRatio(sim.src.vx, sim.src.vy, ux, uy, sim.c, wind);
  const behind = dopplerRatio(sim.src.vx, sim.src.vy, -ux, -uy, sim.c, wind);
  $('speed').textContent = `${fmt(v, 1)} u/s`;
  $('ahead').textContent = ahead < 0 || !Number.isFinite(ahead) ? 'silent' : `×${fmt(ahead)}`;
  $('behind').textContent = `×${fmt(behind)}`;
  $('air-mach').textContent = fmt(m);
  $('walk-speed').textContent = `${fmt(sim.walk * SOUND_SPEED, 1)} u/s`;
  const mu = machAngle(m);
  $('angle').textContent = mu === null ? 'none below Mach 1' : `${fmt((mu * 180) / Math.PI, 1)}°`;
  $('count').textContent = String(found.length);
  $('ratios').textContent = found.length ? found.map((im) => ratioText(im.ratio)).join(', ') : 'silence';
  $('delay').textContent = found.length ? found.map((im) => `${fmt(sim.t - im.tau, 1)} s`).join(', ') : '–';
  $('booms').textContent = String(booms.times.length);
  $('last-boom').textContent = booms.last === null ? 'none yet' : `${fmt(sim.t - booms.last, 1)} s ago`;
  let status = playing ? '' : 'Paused. ';
  if (found.length === 0) status += m > 1 ? 'The listener is outside the cone: nothing has arrived yet.' : 'Waiting for the first sound.';
  else if (found.length > 1) status += 'Inside the cone: sound from the approach and from the retreat arrive together.';
  else status += 'One image: the listener hears the source once.';
  $('status').textContent = status;
}

function frame(now) {
  if (playing) {
    const dt = lastFrame === null ? STEP : Math.min(0.1, (now - lastFrame) / 1000);
    const steps = Math.max(1, Math.round(dt / STEP));
    // The microphone and the boom detector need every step, not every frame.
    for (let i = 0; i < steps; i++) {
      stepSim(sim);
      found = heard(sim);
      trace.push(sim.t, pressure(found, sim.rate));
      booms.update(sim.t, found.length);
    }
    samples.push({ t: sim.t, images: found.map((im) => ({ ratio: im.ratio })) });
    while (samples.length && samples[0].t < sim.t - CHART_WINDOW) samples.shift();
    tone.update(found);
  }
  lastFrame = now;
  const since = booms.last === null ? Infinity : sim.t - booms.last;
  const flash = since < FLASH ? 1 - since / FLASH : 0;
  drawWorld(wctx, view, sim, { cone: settings.cone && sim.path === 'line', tint: settings.tint, images: found, flash });
  drawPitch(pctx, samples, sim.t, CHART_WINDOW, booms.times);
  drawTrace(mctx, trace, booms.times, sim.t, MIC_WINDOW);
  updateReadouts();
  requestAnimationFrame(frame);
}

// Pointer: grab the listener when close to it, otherwise steer the source
// (in "Follow the pointer") or drop the listener where the pointer is.
let dragging = null;

// Jumping the listener into the cone is not a boom, so the detector starts
// counting afresh from wherever it lands.
function moveListener(p) {
  sim.listener.x = p.x;
  sim.listener.y = p.y;
  booms.count = null;
}

function pointerWorld(ev) {
  const r = worldCanvas.getBoundingClientRect();
  const sx = worldCanvas.width / r.width;
  const [x, y] = toWorld(view, (ev.clientX - r.left) * sx, (ev.clientY - r.top) * sx);
  return {
    x: Math.min(sim.world.width, Math.max(0, x)),
    y: Math.min(sim.world.height, Math.max(0, y)),
  };
}

worldCanvas.addEventListener('pointerdown', (ev) => {
  const p = pointerWorld(ev);
  const [lx, ly] = toScreen(view, sim.listener.x, sim.listener.y);
  const [px, py] = toScreen(view, p.x, p.y);
  const grab = Math.hypot(px - lx, py - ly) < Math.max(18, view.scale * 5);
  dragging = grab || settings.path !== 'drag' ? 'listener' : 'source';
  if (dragging === 'listener') moveListener(p);
  else sim.target = p;
  worldCanvas.setPointerCapture(ev.pointerId);
});

worldCanvas.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  const p = pointerWorld(ev);
  if (dragging === 'listener') moveListener(p);
  else sim.target = p;
});

const endDrag = () => {
  if (dragging === 'listener') writeHash();
  dragging = null;
};
worldCanvas.addEventListener('pointerup', endDrag);
worldCanvas.addEventListener('pointercancel', endDrag);

worldCanvas.addEventListener('keydown', (ev) => {
  const d = ev.shiftKey ? 8 : 2;
  const moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
  const m = moves[ev.key];
  if (!m) return;
  ev.preventDefault();
  moveListener({
    x: Math.min(sim.world.width, Math.max(0, sim.listener.x + m[0])),
    y: Math.min(sim.world.height, Math.max(0, sim.listener.y + m[1])),
  });
  writeHash();
});

// Controls.
function syncControls() {
  $('path').value = settings.path;
  $('mach').value = settings.mach;
  $('mach-out').textContent = fmt(settings.mach);
  $('rate').value = settings.rate;
  $('rate-out').textContent = fmt(settings.rate, 1);
  $('wind').value = settings.wind;
  $('wind-out').textContent = windText(settings.wind);
  $('walk').value = settings.walk;
  $('walk-out').textContent = `Mach ${fmt(settings.walk)}`;
  $('tint').checked = settings.tint;
  $('cone').checked = settings.cone;
}

$('path').addEventListener('change', (ev) => {
  settings.path = ev.target.value;
  restart();
  writeHash();
});

$('mach').addEventListener('input', (ev) => {
  settings.mach = Number(ev.target.value);
  sim.mach = settings.mach;
  $('mach-out').textContent = fmt(settings.mach);
  writeHash();
});

$('rate').addEventListener('input', (ev) => {
  settings.rate = Number(ev.target.value);
  sim.rate = settings.rate;
  sim.nextEmit = Math.min(sim.nextEmit, sim.t + 1 / sim.rate);
  $('rate-out').textContent = fmt(settings.rate, 1);
  writeHash();
});

$('wind').addEventListener('input', (ev) => {
  settings.wind = Number(ev.target.value);
  sim.wind = settings.wind;
  $('wind-out').textContent = windText(settings.wind);
  writeHash();
});

$('walk').addEventListener('input', (ev) => {
  settings.walk = Number(ev.target.value);
  sim.walk = settings.walk;
  $('walk-out').textContent = `Mach ${fmt(settings.walk)}`;
  writeHash();
});

for (const key of ['tint', 'cone']) {
  $(key).addEventListener('change', (ev) => {
    settings[key] = ev.target.checked;
    writeHash();
  });
}

for (const [key, preset] of Object.entries(PRESETS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = preset.label;
  b.dataset.preset = key;
  b.addEventListener('click', () => {
    settings = applyPreset(settings, key);
    syncControls();
    restart();
    writeHash();
  });
  $('presets').append(b);
}

function setPlaying(on) {
  playing = on;
  $('play').textContent = on ? 'Pause' : 'Play';
  $('play').setAttribute('aria-pressed', String(on));
  lastFrame = null;
  if (!on) tone.update([]);
}

async function toggleSound() {
  const on = !tone.running;
  if (on) {
    if (!(await tone.start())) {
      $('status').textContent = 'This browser has no Web Audio.';
      return;
    }
  } else {
    await tone.stop();
  }
  $('sound').textContent = on ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-pressed', String(on));
}

$('play').addEventListener('click', () => setPlaying(!playing));
$('restart').addEventListener('click', () => restart());
$('sound').addEventListener('click', toggleSound);

$('share').addEventListener('click', async () => {
  writeHash();
  try {
    await navigator.clipboard.writeText(location.href);
    $('share').textContent = 'Link copied';
  } catch {
    $('share').textContent = 'Copy failed: use the address bar';
  }
  setTimeout(() => ($('share').textContent = 'Copy share link'), 1600);
});

$('png').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `bowshock-${settings.path}-mach-${fmt(settings.mach)}.png`;
  a.href = worldCanvas.toDataURL('image/png');
  a.click();
});

document.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
  if (ev.key === ' ' && (ev.target === document.body || ev.target === worldCanvas)) {
    ev.preventDefault();
    setPlaying(!playing);
  } else if (ev.key === 'r' || ev.key === 'R') {
    restart();
  } else if (ev.key === 'm' || ev.key === 'M') {
    toggleSound();
  }
});

window.addEventListener('hashchange', () => {
  settings = decode(location.hash);
  syncControls();
  restart(listenerFromSettings());
});

window.addEventListener('resize', resize);
syncControls();
resize();
requestAnimationFrame(frame);
