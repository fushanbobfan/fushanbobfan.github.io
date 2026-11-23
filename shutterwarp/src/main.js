import { makeProp, bladeAngle, exposeRows, photograph } from './shutter.js';
import { drawScene, drawPhoto } from './scene.js';
import {
  rows, verdict, speedLabel, videoRows, nearestStandstill, playbackLabel, WALL_SECONDS_PER_READOUT,
} from './readout.js';
import { motionVerdict, maxReadout } from './video.js';
import { speedChart } from './speedchart.js';
import { photographPole, leanAngle, flashProfile, flashCoverage } from './others.js';
import { crossLabel, leanLabel, flashLabel } from './readout.js';

const SIZE = 360;
const PAUSE_WALL_SECONDS = 1.2;
const VIDEO_SIZE = 240;
const MAX_RPM = 9000;
const MAX_PLAYBACK_FPS = 30;

const $ = (id) => document.getElementById(id);
const sceneCanvas = $('scene');
const photoCanvas = $('photo');
const sceneCtx = sceneCanvas.getContext('2d');
const photoCtx = photoCanvas.getContext('2d');
const image = photoCtx.createImageData(SIZE, SIZE);
const videoCtx = $('video').getContext('2d');
const videoImage = videoCtx.createImageData(VIDEO_SIZE, VIDEO_SIZE);

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
  fps: 30,
  videoClock: 0,
  videoFrame: -1,
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
  drawOthers();
});

// "Make it hang still" can ask for a speed such as 187.5 rpm that the slider
// rounds; the exact value is kept while the slider still shows its rounding.
let exactRpm = null;
function rpmFromSlider() {
  const v = Number($('rpm').value);
  return exactRpm !== null && Math.abs(v - exactRpm) <= 0.5 ? exactRpm : v;
}

function readControls() {
  const angle = bladeAngle(state.prop, state.time);
  state.prop = makeProp({
    rpm: rpmFromSlider(),
    blades: Number($('blades').value),
    direction: Number(document.querySelector('input[name="direction"]:checked').value),
    phase: angle,
  });
  state.readout = Number($('readout').value) / 1000;
  state.time = 0;
  state.fps = Number($('fps').value);
  restartVideo();
  newPhoto();
  if (!state.playing) finishPhotoNow();
  updateText();
}

function restartVideo() {
  state.videoClock = 0;
  state.videoFrame = -1;
}

// Video frame m is a rolling-shutter photo whose top row is read at m / fps.
function showVideoFrame(m) {
  const readout = Math.min(state.readout, maxReadout(state.fps));
  videoImage.data.set(photograph(state.prop, { size: VIDEO_SIZE, readout, start: m / state.fps }, 1));
  videoCtx.putImageData(videoImage, 0, 0);
  state.videoFrame = m;
}

function fillList(dl, entries) {
  dl.replaceChildren();
  for (const [k, v] of entries) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
}

const OTHER_SIZE = 240;
const FLASH_SECONDS = 0.001;
const poleCtx = $('pole').getContext('2d');
const flashCtx = $('flash').getContext('2d');

// The flash slider runs from the moment the top row opens to the moment the
// bottom row closes.
function flashOptions() {
  const exposure = Number($('exposure').value) / 1000;
  const span = state.readout + exposure;
  const flashAt = (Number($('flash-at').value) / 100) * span - FLASH_SECONDS / 2;
  return { readout: state.readout, exposure, flashAt, flash: FLASH_SECONDS };
}

function drawOthers() {
  const cross = Number($('cross').value) / 1000;
  const pole = poleCtx.createImageData(OTHER_SIZE, OTHER_SIZE);
  pole.data.set(photographPole({ size: OTHER_SIZE, readout: state.readout, cross }));
  poleCtx.putImageData(pole, 0, 0);
  // Where the pole really stands halfway through the readout.
  poleCtx.strokeStyle = palette.scan;
  poleCtx.setLineDash([5, 4]);
  poleCtx.lineWidth = 1.5;
  poleCtx.beginPath();
  poleCtx.moveTo(OTHER_SIZE / 2, 0);
  poleCtx.lineTo(OTHER_SIZE / 2, OTHER_SIZE);
  poleCtx.stroke();
  poleCtx.setLineDash([]);
  $('cross-value').textContent = crossLabel(cross);
  $('pole-lean').textContent = `In the photo the pole is ${leanLabel(leanAngle(state.readout, cross))}. The dashed line is where it really stands halfway through the readout.`;

  const opts = flashOptions();
  const profile = flashProfile(OTHER_SIZE, opts);
  const img = flashCtx.createImageData(OTHER_SIZE, OTHER_SIZE);
  for (let row = 0; row < OTHER_SIZE; row++) {
    const v = profile[row];
    const r = 38 + (250 - 38) * v;
    const g = 36 + (240 - 36) * v;
    const b = 44 + (214 - 44) * v;
    for (let col = 0; col < OTHER_SIZE; col++) {
      const k = (row * OTHER_SIZE + col) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255;
    }
  }
  flashCtx.putImageData(img, 0, 0);
  $('exposure-value').textContent = `${Math.round(opts.exposure * 1000)} ms`;
  $('flash-at-value').textContent = `${Math.round((opts.flashAt + FLASH_SECONDS / 2) * 1000)} ms after the top row opens`;
  $('flash-text').textContent = flashLabel(flashCoverage(OTHER_SIZE, opts), opts.exposure, state.readout, FLASH_SECONDS);
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
  fillList($('readouts'), rows(state.prop, state.readout));

  $('video-caption').textContent = `The video, ${playbackLabel(state.fps)}.`;
  $('video-verdict').textContent = motionVerdict(state.prop, state.fps);
  fillList($('video-readouts'), videoRows(state.prop, state.readout, state.fps));
  $('speed-chart').innerHTML = speedChart({ blades: state.prop.blades, fps: state.fps, rpm: state.prop.rpm, maxRpm: MAX_RPM });
  $('hang').disabled = nearestStandstill(state.prop.rpm, state.prop.blades, state.fps, MAX_RPM) === null;
  drawOthers();
}

function advance(wallDt) {
  state.videoClock += wallDt;
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
  const m = Math.floor(state.videoClock * Math.min(state.fps, MAX_PLAYBACK_FPS));
  if (m !== state.videoFrame) showVideoFrame(m);
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

$('rpm').addEventListener('input', () => {
  exactRpm = null;
  readControls();
});
for (const id of ['blades', 'readout']) $(id).addEventListener('input', readControls);
for (const r of document.querySelectorAll('input[name="direction"]')) r.addEventListener('change', readControls);
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  exactRpm = null;
  $('rpm').value = b.dataset.rpm;
  $('blades').value = b.dataset.blades;
  readControls();
});
$('fps').addEventListener('change', readControls);
for (const id of ['cross', 'exposure', 'flash-at']) $(id).addEventListener('input', drawOthers);
$('hang').addEventListener('click', () => {
  const rpm = nearestStandstill(state.prop.rpm, state.prop.blades, state.fps, MAX_RPM);
  if (rpm === null) return;
  exactRpm = rpm;
  $('rpm').value = String(rpm);
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
