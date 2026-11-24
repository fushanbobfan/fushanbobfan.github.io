import { makeAir } from './air.js';
import { criticalAngle, shineStart } from './rays.js';
import { renderView, describeView } from './view.js';
import { drawSide, sideFrame } from './side.js';
import { rows, verdict, tempLabel, layerLabel, heightLabel, distanceLabel } from './readout.js';
import { foldChart, profileChart } from './charts.js';
import { nextDistance, NEAREST } from './drive.js';

const $ = (id) => document.getElementById(id);
const viewCanvas = $('view');
const sideCanvas = $('side');
const viewCtx = viewCanvas.getContext('2d');
const sideCtx = sideCanvas.getContext('2d');
const image = viewCtx.createImageData(viewCanvas.width, viewCanvas.height);


function hex(c) {
  const m = c.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? m.slice(1).map((v) => parseInt(v, 16)) : [128, 128, 128];
}

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const names = ['post', 'red', 'white', 'blue', 'road', 'verge', 'paint', 'haze', 'horizon', 'zenith', 'tree'];
  const view = Object.fromEntries(names.map((k) => [k, hex(v(`--scene-${k}`))]));
  return {
    view,
    side: {
      panelSky: v('--side-sky'),
      ground: v('--muted'),
      ink: v('--ink'),
      rayBoard: v('--ray-board'),
      raySky: v('--ray-sky'),
      rayTree: v('--ray-tree'),
      rayRoad: v('--ray-road'),
      css: Object.fromEntries(['post', 'red', 'white', 'blue'].map((k) => [k, v(`--scene-${k}`)])),
    },
  };
}
let palette = readPalette();

const sliders = {
  surface: { el: $('surface'), out: $('surface-value'), label: tempLabel, scale: 1 },
  air: { el: $('air'), out: $('air-value'), label: tempLabel, scale: 1 },
  layer: { el: $('layer'), out: $('layer-value'), label: layerLabel, scale: 0.01 },
  eye: { el: $('eye'), out: $('eye-value'), label: heightLabel, scale: 1 },
  distance: { el: $('distance'), out: $('distance-value'), label: distanceLabel, scale: 1 },
};

function read() {
  const v = Object.fromEntries(Object.entries(sliders).map(([k, s]) => [k, Number(s.el.value) * s.scale]));
  for (const [k, s] of Object.entries(sliders)) s.out.textContent = s.label(v[k]);
  return {
    air: makeAir({ surface: v.surface, air: v.air, layer: v.layer }),
    scene: { eye: v.eye, distance: v.distance },
  };
}

function render() {
  const { air, scene } = read();
  const out = renderView(air, scene, viewCanvas.width, viewCanvas.height, palette.view);
  image.data.set(out.data);
  viewCtx.putImageData(image, 0, 0);

  // A tick on each edge at eye level, where the horizon would be over flat ground.
  const y = (out.top / (out.top - out.bottom)) * viewCanvas.height;
  viewCtx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  viewCtx.lineWidth = 2;
  viewCtx.beginPath();
  viewCtx.moveTo(0, y);
  viewCtx.lineTo(10, y);
  viewCtx.moveTo(viewCanvas.width - 10, y);
  viewCtx.lineTo(viewCanvas.width, y);
  viewCtx.stroke();

  drawSide(sideCtx, air, scene, palette.side);
  $('fold-chart').innerHTML = foldChart(out.rows, out, scene);
  $('profile-chart').innerHTML = profileChart(air, scene);

  const critical = criticalAngle(air, scene.eye);
  const shine = shineStart(air, scene.eye);
  const view = describeView(out.rows);
  const { stretch } = sideFrame(scene, sideCanvas.width, sideCanvas.height);
  const vanish = vanishFor(air, scene.eye);
  $('verdict').textContent = verdict(air, scene, { critical, shine, view });
  const dl = $('readouts');
  dl.replaceChildren();
  for (const [k, v] of rows(air, scene, { critical, shine, top: out.top, bottom: out.bottom, stretch, vanish })) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
}

// Where the copy vanishes depends on the air and the eye only. Finding it
// takes a few dozen traced pictures, so it is worked out once per setting,
// a moment after the sliders come to rest, and the readout says so meanwhile.
const vanish = { key: '', value: undefined, timer: 0 };
const worker = new Worker(new URL('./vanish-worker.js', import.meta.url), { type: 'module' });
worker.onmessage = (e) => {
  if (e.data.key !== vanish.key) return;
  vanish.value = e.data.value;
  if (!drive.on) render();
};
function vanishFor(air, eye) {
  const key = `${air.surface}|${air.air}|${air.layer}|${eye}`;
  if (key !== vanish.key) {
    vanish.key = key;
    vanish.value = undefined;
    clearTimeout(vanish.timer);
    vanish.timer = setTimeout(() => {
      worker.postMessage({ key, surface: air.surface, air: air.air, layer: air.layer, eye });
    }, 250);
  }
  return vanish.value;
}

// Each start of the car gets a new number; a frame left queued from an
// earlier drive sees a different number and stops.
const drive = { on: false, last: 0, distance: 0, run: 0 };
function setDriving(on) {
  const was = drive.on;
  drive.on = on;
  drive.run++;
  $('drive').setAttribute('aria-pressed', String(on));
  $('drive').textContent = on ? 'Stop the car' : 'Drive towards the board';
  if (on) {
    drive.distance = Number(sliders.distance.el.value);
    drive.last = performance.now();
    const run = drive.run;
    requestAnimationFrame((now) => driveFrame(now, run));
  } else if (was) {
    render();
  }
}
function driveFrame(now, run) {
  if (!drive.on || run !== drive.run) return;
  // Long gaps (a hidden tab) count as one frame, so the car never jumps.
  const seconds = Math.min((now - drive.last) / 1000, 0.25);
  drive.last = now;
  drive.distance = nextDistance(drive.distance, seconds);
  sliders.distance.el.value = String(Math.round(drive.distance));
  if (drive.distance <= NEAREST) {
    setDriving(false);
    return;
  }
  // Every frame is the full picture, so the words and the readout always
  // match what is drawn; a frame takes a few tens of milliseconds.
  render();
  requestAnimationFrame((t) => driveFrame(t, run));
}
$('drive').addEventListener('click', () => {
  if (!drive.on && Number(sliders.distance.el.value) <= NEAREST) sliders.distance.el.value = '300';
  setDriving(!drive.on);
});
sliders.distance.el.addEventListener('input', () => setDriving(false));

let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    render();
  });
}

for (const s of Object.values(sliders)) s.el.addEventListener('input', schedule);

$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  setDriving(false);
  for (const k of Object.keys(sliders)) if (b.dataset[k] !== undefined) sliders[k].el.value = b.dataset[k];
  render();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  palette = readPalette();
  render();
});

render();
