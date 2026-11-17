import { makeLayer, MAX_DOT_DUTY } from './gratings.js';
import { boxBlur, composite, renderInks, toRGBA } from './render.js';
import { fringeMask } from './moire.js';
import { SCENES, sceneById, sceneLayers } from './scenes.js';
import { describe } from './readout.js';
import { decodeState, encodeState } from './permalink.js';

const $ = (id) => document.getElementById(id);

const canvas = $('sheets');
const overlay = $('fringes');
const ctx = canvas.getContext('2d');
const octx = overlay.getContext('2d');

const LIGHT_BOX = [250, 248, 242];
const PLAIN_INK = [[34, 32, 28], [34, 32, 28]];
const TINTED_INK = [[47, 100, 168], [214, 108, 48]];
const FRINGE_COLOUR = [200, 20, 110];

const DEG = Math.PI / 180;
const SPIN_PER_SECOND = 1.2 * DEG;

const state = {
  scene: SCENES[0],
  layers: [],
  css: 0,
  scale: 1,
  moving: 1,
  blur: false,
  predict: false,
  tint: false,
  spinning: false,
};

const sheetControls = [0, 1].map((k) => ({
  kind: $(`kind-${k}`),
  period: $(`period-${k}`),
  periodOut: $(`period-${k}-out`),
  angle: $(`angle-${k}`),
  angleOut: $(`angle-${k}-out`),
  duty: $(`duty-${k}`),
  dutyOut: $(`duty-${k}-out`),
}));

// Each sheet's ink only changes when that sheet changes, so dragging the top
// sheet leaves the bottom one's pixels alone.
const inkCache = [null, null];

function inkFor(k, w) {
  const l = state.layers[k];
  const key = [l.kind, l.period, l.angle, l.x, l.y, l.duty, w, state.scale].join('|');
  if (inkCache[k]?.key !== key) {
    inkCache[k] = { key, ink: renderInks(w, w, [l], state.scale)[0] };
  }
  return inkCache[k].ink;
}

function fitCanvas() {
  const css = Math.max(1, Math.round(canvas.clientWidth));
  const scale = Math.min(2, window.devicePixelRatio || 1);
  if (css === state.css && scale === state.scale) return;
  // Keep the sheets where they were relative to the middle of the view.
  if (state.css) {
    const shift = (css - state.css) / 2;
    for (const l of state.layers) {
      l.x += shift;
      l.y += shift;
    }
  }
  state.css = css;
  state.scale = scale;
  canvas.width = canvas.height = Math.round(css * scale);
  overlay.width = overlay.height = css;
}

let frameQueued = false;
function requestDraw() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(draw);
}

let lastFrame = 0;
function draw(now) {
  frameQueued = false;
  if (state.spinning) {
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    const top = state.layers[1];
    // Folding the angle back by 180° would flip the bars' phase about their
    // anchor and make the pattern jump, so the angle keeps growing and only
    // the slider shows it folded.
    top.angle += SPIN_PER_SECOND * dt;
    syncControls();
    requestDraw();
  }
  const w = canvas.width;
  const n = w * w;
  const inks = [inkFor(0, w), inkFor(1, w)];
  let rgb = composite(inks, state.tint ? TINTED_INK : PLAIN_INK, LIGHT_BOX, n);
  if (state.blur) {
    const coarsest = Math.max(state.layers[0].period, state.layers[1].period);
    rgb = boxBlur(rgb, w, w, Math.max(1, Math.round((coarsest * state.scale) / 2)), 3);
  }
  const image = ctx.createImageData(w, w);
  toRGBA(rgb, n, image.data);
  ctx.putImageData(image, 0, 0);
  $('readout').textContent = describe(state.layers[0], state.layers[1]);
  scheduleFringes();
  scheduleLink();
}

// Keep the address bar in step with the view, so copying it shares the view.
function currentLink() {
  const half = state.css / 2;
  return encodeState({
    scene: state.scene.id,
    sheets: state.layers.map((l) => ({
      kind: l.kind,
      period: l.period,
      angleDeg: l.angle / DEG,
      duty: l.duty,
      dx: l.x - half,
      dy: l.y - half,
    })),
    blur: state.blur,
    predict: state.predict,
    tint: state.tint,
  });
}

let linkTimer = 0;
function scheduleLink() {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(() => {
    history.replaceState(null, '', `#${currentLink()}`);
  }, 250);
}

// Open the view a link describes. Returns false when it describes no sheets.
function applyLink(hash) {
  if (!hash || hash === '#') return false;
  const link = decodeState(hash);
  state.blur = link.blur;
  state.predict = link.predict;
  state.tint = link.tint;
  $('show-blur').checked = link.blur;
  $('show-predict').checked = link.predict;
  $('show-tint').checked = link.tint;
  const known = SCENES.some((s) => s.id === link.scene);
  if (!link.sheets) {
    loadScene(known ? sceneById(link.scene) : SCENES[0]);
    return true;
  }
  state.scene = known ? sceneById(link.scene) : SCENES[0];
  fitCanvas();
  const half = state.css / 2;
  state.layers = link.sheets.map((s) =>
    makeLayer({ kind: s.kind, period: s.period, angle: s.angleDeg * DEG, duty: s.duty, x: half + s.dx, y: half + s.dy }),
  );
  $('scene').value = state.scene.id;
  $('scene-note').textContent = state.scene.note;
  syncControls();
  requestDraw();
  return true;
}

// The fringe prediction costs a few phase evaluations per pixel, so it waits
// until the sheets stop moving and is drawn at CSS resolution.
let fringeTimer = 0;
function scheduleFringes() {
  clearTimeout(fringeTimer);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (!state.predict) return;
  fringeTimer = setTimeout(drawFringes, state.spinning ? 400 : 120);
}

function drawFringes() {
  const w = overlay.width;
  const [a, b] = state.layers;
  const mask = fringeMask(w, w, a, b, 1);
  const image = octx.createImageData(w, w);
  for (let p = 0; p < mask.length; p++) {
    image.data[p * 4] = FRINGE_COLOUR[0];
    image.data[p * 4 + 1] = FRINGE_COLOUR[1];
    image.data[p * 4 + 2] = FRINGE_COLOUR[2];
    image.data[p * 4 + 3] = mask[p] * 0.9;
  }
  octx.putImageData(image, 0, 0);
}

// The slider runs from −90° to 90°; bars and dot screens look alike every 180°.
function foldDegrees(deg) {
  return deg - 180 * Math.round(deg / 180);
}

function syncControls() {
  state.layers.forEach((l, k) => {
    const c = sheetControls[k];
    c.kind.value = l.kind;
    c.period.value = l.period;
    c.periodOut.textContent = `${l.period.toFixed(1)} px`;
    const deg = foldDegrees(l.angle / DEG);
    c.angle.value = deg.toFixed(1);
    c.angleOut.textContent = l.kind === 'rings' ? 'rings look the same at any turn' : `${deg.toFixed(1)}°`;
    c.angle.disabled = l.kind === 'rings';
    c.duty.value = l.duty;
    // Dots wider than MAX_DOT_DUTY would touch, so the model caps them there.
    const shown = l.kind === 'dots' ? Math.min(l.duty, MAX_DOT_DUTY) : l.duty;
    c.dutyOut.textContent = `${Math.round(shown * 100)}% of each ${l.kind === 'dots' ? 'cell' : 'period'}`;
  });
  // Turning rings changes nothing, so there is nothing to animate.
  const spinnable = state.layers[1].kind !== 'rings';
  if (!spinnable && state.spinning) {
    state.spinning = false;
    $('spin').setAttribute('aria-pressed', 'false');
  }
  $('spin').disabled = !spinnable;
}

function loadScene(scene) {
  state.scene = scene;
  fitCanvas();
  state.layers = sceneLayers(scene, state.css, state.css);
  $('scene').value = scene.id;
  $('scene-note').textContent = scene.note;
  syncControls();
  requestDraw();
}

function bindSheet(k) {
  const c = sheetControls[k];
  c.kind.addEventListener('change', () => {
    const l = state.layers[k];
    state.layers[k] = makeLayer({ ...l, kind: c.kind.value });
    syncControls();
    requestDraw();
  });
  c.period.addEventListener('input', () => {
    state.layers[k].period = Number(c.period.value);
    syncControls();
    requestDraw();
  });
  c.angle.addEventListener('input', () => {
    // Apply the slider's change to the unfolded angle, so a sheet turned past
    // 90° keeps turning smoothly instead of jumping by half a turn.
    const l = state.layers[k];
    l.angle += (Number(c.angle.value) - foldDegrees(l.angle / DEG)) * DEG;
    syncControls();
    requestDraw();
  });
  c.duty.addEventListener('input', () => {
    state.layers[k].duty = Number(c.duty.value);
    syncControls();
    requestDraw();
  });
}

function moveSheet(dx, dy) {
  const l = state.layers[state.moving];
  l.x += dx;
  l.y += dy;
  requestDraw();
}

function turnTop(deltaDeg) {
  const top = state.layers[1];
  if (top.kind === 'rings') return;
  top.angle += deltaDeg * DEG;
  syncControls();
  requestDraw();
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const k = state.css / Math.max(1, canvas.clientWidth);
  moveSheet((e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
  drag.x = e.clientX;
  drag.y = e.clientY;
});
function endDrag(e) {
  if (!drag || drag.id !== e.pointerId) return;
  drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 10 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    moveSheet(...moves[e.key]);
  } else if (e.key === '[' || e.key === '{') {
    turnTop(e.shiftKey ? -1 : -0.1);
  } else if (e.key === ']' || e.key === '}') {
    turnTop(e.shiftKey ? 1 : 0.1);
  } else {
    return;
  }
  e.preventDefault();
});

for (const radio of document.querySelectorAll('input[name="moving"]')) {
  radio.addEventListener('change', () => {
    if (radio.checked) state.moving = Number(radio.value);
  });
}

$('show-blur').addEventListener('change', (e) => {
  state.blur = e.target.checked;
  requestDraw();
});
$('show-predict').addEventListener('change', (e) => {
  state.predict = e.target.checked;
  scheduleFringes();
  scheduleLink();
});
$('show-tint').addEventListener('change', (e) => {
  state.tint = e.target.checked;
  requestDraw();
});

$('spin').addEventListener('click', () => {
  state.spinning = !state.spinning;
  lastFrame = 0;
  $('spin').setAttribute('aria-pressed', String(state.spinning));
  requestDraw();
});

$('reset').addEventListener('click', () => loadScene(state.scene));

$('save').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `moire-${state.scene.id}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
});

$('copy-link').addEventListener('click', async () => {
  clearTimeout(linkTimer);
  history.replaceState(null, '', `#${currentLink()}`);
  const status = $('link-status');
  try {
    await navigator.clipboard.writeText(location.href);
    status.textContent = 'Link copied. Opening it shows these two sheets as they are now.';
  } catch {
    status.textContent = `Copy this link: ${location.href}`;
  }
});

window.addEventListener('hashchange', () => applyLink(location.hash));

const sceneSelect = $('scene');
for (const scene of SCENES) sceneSelect.add(new Option(scene.name, scene.id));
sceneSelect.addEventListener('change', () => loadScene(sceneById(sceneSelect.value)));

bindSheet(0);
bindSheet(1);

new ResizeObserver(() => {
  const before = [state.css, state.scale];
  fitCanvas();
  if (before[0] !== state.css || before[1] !== state.scale) requestDraw();
}).observe(canvas);

if (!applyLink(location.hash)) loadScene(SCENES[0]);
