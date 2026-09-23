import { normalizeDesign, normalizePendulum, sampleCurve, bounds, fitTransform, envelope } from './harmonograph.js';
import { PRESETS, findPreset, randomDesign } from './presets.js';
import { PALETTES, drawRange, toSvg } from './render.js';
import { SPEEDS, planDrawing, pointIndexAt, formatSpeed } from './playback.js';
import { encodeDesign, decodeDesign } from './share.js';

const $ = (id) => document.getElementById(id);
const paper = $('paper');
const pen = $('pen');
const paperCtx = paper.getContext('2d');
const penCtx = pen.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  design: PRESETS[0].design,
  paletteId: 'ink',
  lineWidth: 0.6,
  speed: SPEEDS[2],
  paused: false,
  // Derived drawing data, rebuilt whenever the design or size changes.
  points: new Float64Array(),
  plan: { duration: 1, samplesPerSecond: 120 },
  fit: null,
  size: 0,
  // Playback progress in drawing seconds and the last point already inked.
  elapsed: 0,
  drawnTo: 0,
};

// ---------- layout ----------

function resize() {
  const rect = paper.getBoundingClientRect();
  const size = Math.max(1, Math.round(rect.width));
  const dpr = window.devicePixelRatio || 1;
  for (const canvas of [paper, pen]) {
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  state.size = size;
  rebuild({ restart: false });
}

// ---------- drawing ----------

function palette() {
  return PALETTES[state.paletteId];
}

function rebuild({ restart = true } = {}) {
  state.plan = planDrawing(state.design);
  state.points = sampleCurve(state.design, state.plan);
  state.fit = fitTransform(bounds(state.points), state.size, state.size, state.size * 0.06);
  if (restart) state.elapsed = 0;
  repaint();
}

function clearPaper() {
  paperCtx.fillStyle = palette().paper;
  paperCtx.fillRect(0, 0, state.size, state.size);
}

// Redraw everything up to the current playback position.
function repaint() {
  clearPaper();
  const upTo = pointIndexAt(state.elapsed, state.plan.samplesPerSecond, state.points.length / 2);
  if (upTo > 0) drawRange(paperCtx, state.points, 0, upTo, state.fit, palette(), state.lineWidth);
  state.drawnTo = Math.max(0, upTo);
  drawPen();
  updateStatus();
}

function drawPen() {
  penCtx.clearRect(0, 0, state.size, state.size);
  const total = state.points.length / 2;
  if (!total || finished() || state.drawnTo >= total - 1) return;
  const i = state.drawnTo;
  const [x, y] = state.fit.toScreen(state.points[2 * i], state.points[2 * i + 1]);
  penCtx.fillStyle = '#e0a458';
  penCtx.beginPath();
  penCtx.arc(x, y, Math.max(2.5, state.lineWidth * 1.8), 0, Math.PI * 2);
  penCtx.fill();
}

function finished() {
  return state.elapsed >= state.plan.duration;
}

let lastFrame = null;
function frame(now) {
  if (lastFrame !== null && !state.paused && !finished()) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    state.elapsed = Math.min(state.plan.duration, state.elapsed + dt * state.speed);
    const upTo = pointIndexAt(state.elapsed, state.plan.samplesPerSecond, state.points.length / 2);
    if (upTo > state.drawnTo) {
      drawRange(paperCtx, state.points, state.drawnTo, upTo, state.fit, palette(), state.lineWidth);
      state.drawnTo = upTo;
    }
    drawPen();
    updateStatus();
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}

function updateStatus() {
  const reach = envelope(state.design, state.elapsed) / Math.max(envelope(state.design, 0), 1e-9);
  const pct = Math.round((state.elapsed / state.plan.duration) * 100);
  const label = finished() ? 'Finished' : state.paused ? 'Paused' : 'Drawing';
  $('status').textContent =
    `${label} · t = ${state.elapsed.toFixed(1)} s of ${state.plan.duration.toFixed(0)} s (${pct}%) · swing at ${Math.round(reach * 100)}%`;
  $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  $('pause').disabled = finished();
}

// ---------- design changes ----------

function setDesign(design, { presetId = null } = {}) {
  state.design = normalizeDesign(design);
  $('preset').value = presetId ?? '';
  const preset = presetId ? findPreset(presetId) : null;
  $('preset-description').textContent = preset ? preset.description : 'Custom design.';
  renderPendulumList();
  writeHash();
  state.paused = false;
  rebuild();
  if (reducedMotion) finish();
}

function writeHash() {
  history.replaceState(null, '', '#' + encodeDesign(state.design));
}

function replay() {
  state.elapsed = 0;
  state.paused = false;
  repaint();
}

function finish() {
  state.elapsed = state.plan.duration;
  repaint();
}

function togglePause() {
  if (finished()) return;
  state.paused = !state.paused;
  updateStatus();
}

function surprise() {
  const seed = Math.floor(Math.random() * 1e6);
  $('seed').textContent = `seed ${seed}`;
  setDesign(randomDesign(seed));
}

// ---------- pendulum editor ----------

const FORMAT = {
  amp: (v) => v.toFixed(2),
  freq: (v) => v.toFixed(3),
  phase: (v) => `${Math.round((v * 180) / Math.PI)}°`,
  damp: (v) => v.toFixed(3),
};

function renderPendulumList() {
  const list = $('pendulum-list');
  const template = $('pendulum-template');
  list.replaceChildren();
  state.design.pendulums.forEach((p, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.setAttribute('aria-label', `Pendulum ${index + 1}`);
    for (const input of node.querySelectorAll('[data-field]')) {
      input.value = String(p[input.dataset.field]);
    }
    for (const out of node.querySelectorAll('[data-out]')) {
      out.textContent = FORMAT[out.dataset.out](p[out.dataset.out]);
    }
    list.append(node);
  });
  $('add-pendulum').disabled = state.design.pendulums.length >= 6;
}

function editPendulum(index, field, value) {
  const pendulums = state.design.pendulums.slice();
  pendulums[index] = normalizePendulum({ ...pendulums[index], [field]: field === 'axis' ? value : Number(value) });
  state.design = { pendulums };
  const node = $('pendulum-list').children[index];
  const out = node?.querySelector(`[data-out="${field}"]`);
  if (out) out.textContent = FORMAT[field](pendulums[index][field]);
  $('preset').value = '';
  $('preset-description').textContent = 'Custom design.';
  writeHash();
  // Keep the playback position so a finished drawing updates in place.
  rebuild({ restart: false });
}

$('pendulum-list').addEventListener('input', (event) => {
  const field = event.target.dataset.field;
  const node = event.target.closest('.pendulum');
  if (field && node) editPendulum(Number(node.dataset.index), field, event.target.value);
});

$('pendulum-list').addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'remove') return;
  const index = Number(event.target.closest('.pendulum').dataset.index);
  setDesign({ pendulums: state.design.pendulums.filter((_, i) => i !== index) });
});

$('add-pendulum').addEventListener('click', () => {
  const axis = state.design.pendulums.filter((p) => p.axis === 'x').length <= state.design.pendulums.filter((p) => p.axis === 'y').length ? 'x' : 'y';
  setDesign({ pendulums: [...state.design.pendulums, { axis, amp: 0.2, freq: 3.002, phase: 0, damp: 0.01 }] });
});

// ---------- export ----------

function download(name, href) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

function savePng() {
  // The paper canvas already holds the drawing at device resolution.
  download('harmonograph.png', paper.toDataURL('image/png'));
}

function saveSvg() {
  const size = 1000;
  const fit = fitTransform(bounds(state.points), size, size, size * 0.06);
  const svg = toSvg(state.points, fit, { width: size, height: size, palette: palette(), lineWidth: state.lineWidth });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  download('harmonograph.svg', url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyLink() {
  const button = $('copy-link');
  try {
    await navigator.clipboard.writeText(location.href);
    button.textContent = 'Link copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => { button.textContent = 'Copy link'; }, 1500);
}

// ---------- controls ----------

function initControls() {
  const presetSelect = $('preset');
  presetSelect.append(new Option('Custom', ''));
  for (const preset of PRESETS) presetSelect.append(new Option(preset.name, preset.id));
  presetSelect.addEventListener('change', () => {
    const preset = findPreset(presetSelect.value);
    if (preset) setDesign(preset.design, { presetId: preset.id });
  });

  const paletteSelect = $('palette');
  for (const [id, p] of Object.entries(PALETTES)) paletteSelect.append(new Option(p.label, id));
  paletteSelect.value = state.paletteId;
  paletteSelect.addEventListener('change', () => {
    state.paletteId = paletteSelect.value;
    repaint();
  });

  const width = $('line-width');
  width.addEventListener('input', () => {
    state.lineWidth = Number(width.value);
    $('line-width-value').textContent = state.lineWidth.toFixed(1);
    repaint();
  });

  const speed = $('speed');
  speed.addEventListener('input', () => {
    state.speed = SPEEDS[Number(speed.value)];
    $('speed-value').textContent = formatSpeed(state.speed);
  });
  $('speed-value').textContent = formatSpeed(state.speed);

  $('pause').addEventListener('click', togglePause);
  $('replay').addEventListener('click', replay);
  $('finish').addEventListener('click', finish);
  $('surprise').addEventListener('click', surprise);
  $('save-png').addEventListener('click', savePng);
  $('save-svg').addEventListener('click', saveSvg);
  $('copy-link').addEventListener('click', copyLink);

  window.addEventListener('keydown', (event) => {
    if (event.target.closest('input, select, textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === ' ') {
      event.preventDefault();
      togglePause();
    } else if (key === 'r') replay();
    else if (key === 'f') finish();
    else if (key === 'n') surprise();
  });

  window.addEventListener('hashchange', loadFromHash);
  new ResizeObserver(resize).observe(paper);
}

function loadFromHash() {
  const design = decodeDesign(location.hash);
  if (!design || !design.pendulums.length) return false;
  if (encodeDesign(design) === encodeDesign(state.design) && state.points.length) return true;
  const match = PRESETS.find((p) => encodeDesign(p.design) === encodeDesign(design));
  setDesign(design, { presetId: match?.id ?? null });
  return true;
}

initControls();
state.size = Math.max(1, Math.round(paper.getBoundingClientRect().width));
if (!loadFromHash()) setDesign(PRESETS[0].design, { presetId: PRESETS[0].id });
requestAnimationFrame(frame);
