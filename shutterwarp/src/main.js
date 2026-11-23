import { makeProp, bladeAngle, exposeRows, photograph } from './shutter.js';
import { drawScene, drawPhoto } from './scene.js';
import { rows, verdict, speedLabel, WALL_SECONDS_PER_READOUT } from './readout.js';

const SIZE = 360;
const PAUSE_WALL_SECONDS = 1.2;

const $ = (id) => document.getElementById(id);
const sceneCanvas = $('scene');
const photoCanvas = $('photo');
const sceneCtx = sceneCanvas.getContext('2d');
const photoCtx = photoCanvas.getContext('2d');
const image = photoCtx.createImageData(SIZE, SIZE);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  prop: makeProp(),
  readout: 0.03,
  time: 0,
  playing: !reducedMotion.matches,
  announce: false,
  photoStart: 0,
  rowsDone: 0,
  pauseLeft: 0,
};

function colors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return { sky: v('--sky'), blade: v('--blade'), scan: v('--scan'), read: v('--read'), unread: v('--unread') };
}
let palette = colors();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  palette = colors();
  render();
});

function readControls() {
  const angle = bladeAngle(state.prop, state.time);
  state.prop = makeProp({
    rpm: Number($('rpm').value),
    blades: Number($('blades').value),
    direction: Number(document.querySelector('input[name="direction"]:checked').value),
    phase: angle,
  });
  state.readout = Number($('readout').value) / 1000;
  state.time = 0;
  newPhoto();
  if (!state.playing) finishPhotoNow();
  updateText();
}

function newPhoto() {
  if (state.announce) $('status').textContent = '';
  state.announce = false;
  state.photoStart = state.time;
  state.rowsDone = 0;
  state.pauseLeft = 0;
}

function finishPhotoNow() {
  image.data.set(photograph(state.prop, { size: SIZE, readout: state.readout, start: state.photoStart }));
  state.rowsDone = SIZE;
  photoDone();
}

// Only a photo the reader asked for is announced, once when it starts and once
// when it is finished; the automatic repeats stay quiet.
function photoDone() {
  if (state.announce) {
    $('status').textContent = 'Photo taken.';
    state.announce = false;
  }
}

function updateText() {
  $('rpm-value').textContent = speedLabel(state.prop.rpm);
  $('blades-value').textContent = String(state.prop.blades);
  $('readout-value').textContent = `${Math.round(state.readout * 1000)} ms`;
  $('verdict').textContent = verdict(state.prop, state.readout);
  const dl = $('readouts');
  dl.replaceChildren();
  for (const [k, v] of rows(state.prop, state.readout)) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
}

function advance(wallDt) {
  state.time += (wallDt * state.readout) / WALL_SECONDS_PER_READOUT;
  if (state.rowsDone >= SIZE) {
    state.pauseLeft -= wallDt;
    if (state.pauseLeft <= 0) newPhoto();
    return;
  }
  const elapsed = state.time - state.photoStart;
  const target = Math.min(SIZE, Math.floor((elapsed / state.readout) * (SIZE - 1)) + 1);
  if (target > state.rowsDone) {
    exposeRows(state.prop, { size: SIZE, readout: state.readout, start: state.photoStart }, state.rowsDone, target, image.data);
    state.rowsDone = target;
    if (state.rowsDone >= SIZE) {
      state.pauseLeft = PAUSE_WALL_SECONDS;
      photoDone();
    }
  }
}

function render() {
  const scan = state.rowsDone < SIZE ? state.rowsDone / SIZE : null;
  drawScene(sceneCtx, SIZE, state.prop, bladeAngle(state.prop, state.time), scan, palette);
  drawPhoto(photoCtx, SIZE, image, state.rowsDone / SIZE, palette);
}

// Elapsed time is used in full so a slow device still sweeps in four seconds;
// the clock restarts after the tab has been hidden.
const MAX_STEP_SECONDS = 1;
let last = null;
document.addEventListener('visibilitychange', () => {
  last = null;
});
function frame(now) {
  if (last !== null && state.playing) advance(Math.min((now - last) / 1000, MAX_STEP_SECONDS));
  last = now;
  render();
  requestAnimationFrame(frame);
}

function setPlaying(on) {
  state.playing = on;
  $('play').textContent = on ? 'Pause' : 'Play';
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) setPlaying(false);
});

for (const id of ['rpm', 'blades', 'readout']) $(id).addEventListener('input', readControls);
for (const r of document.querySelectorAll('input[name="direction"]')) r.addEventListener('change', readControls);
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('rpm').value = b.dataset.rpm;
  $('blades').value = b.dataset.blades;
  readControls();
});
$('play').addEventListener('click', () => setPlaying(!state.playing));
$('shoot').addEventListener('click', () => {
  newPhoto();
  state.announce = true;
  $('status').textContent = 'Taking a photo.';
  if (!state.playing) finishPhotoNow();
});

image.data.fill(255);
setPlaying(state.playing);
readControls();
requestAnimationFrame(frame);
