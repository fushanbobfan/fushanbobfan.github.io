// The page: wires controls to a Colony and draws it on the canvas.

import { parseRule } from './rules.js';
import { Colony, moves } from './colony.js';
import { PRESETS } from './presets.js';
import { LAYOUTS, toggleAnt } from './ants.js';
import { encodeState, decodeState, SPEEDS, MAX_STEPS, DEFAULT_RULES } from './share.js';
import {
  makePalette, packRgb, fitView, cellAt, cellCentre, paintPixels, worldBox, worldCentre, SCHEMES, MAX_SCALE,
} from './render.js';
import { describePattern, describeHalt } from './describe.js';
import { looksLikeMachine } from './machine.js';

const $ = (id) => document.getElementById(id);
const board = $('board');
const ctx = board.getContext('2d');
const fmt = (n) => n.toLocaleString('en-US');

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const state = decodeState(location.hash);
let colony = null;
let palette = null;
let palette32 = null;
let line32 = 0;
let view = { cx: 0, cy: 0, scale: 16 };
let playing = false;
let jumping = false;
let dirty = true;
let carry = 0;
let lastTime = 0;

// ---------- setup ----------

const PRESET_GROUPS = [
  ['Square grid', (p) => p.lattice === 'square' && !looksLikeMachine(p.rule)],
  ['Square grid, state machines', (p) => looksLikeMachine(p.rule)],
  ['Hexagonal grid', (p) => p.lattice === 'hex'],
];
for (const [label, belongs] of PRESET_GROUPS) {
  const group = document.createElement('optgroup');
  group.label = label;
  for (const p of PRESETS.filter(belongs)) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.rule})`;
    group.append(opt);
  }
  $('preset').append(group);
}
const custom = document.createElement('option');
custom.value = '';
custom.textContent = 'Your own rule';
$('preset').append(custom);

function scheme() {
  return darkQuery.matches ? 'dark' : 'light';
}

function rebuildPalette() {
  palette = makePalette(colony.rule.colors, scheme());
  palette32 = Uint32Array.from(palette, packRgb);
  line32 = packRgb(SCHEMES[scheme()].line);
  renderSwatches();
  dirty = true;
}

const TURN_WORDS = {
  L: 'turn left',
  R: 'turn right',
  N: 'straight on',
  U: 'turn around',
  L1: 'turn 60° left',
  L2: 'turn 120° left',
  R1: 'turn 60° right',
  R2: 'turn 120° right',
};

const RULE_HELP = {
  square:
    'L left · R right · N straight on · U turn around. Or a state machine: {write, turn, next state} per state and ' +
    'colour, as {{{1,8,1},{1,8,1}},{{1,2,1},{0,1,0}}} or 181181121010, with turns 1 straight, 2 right, 4 around, 8 left.',
  hex: 'L1 / R1 60° left / right · L2 / R2 120° · N straight on · U turn around',
};

function renderSwatches() {
  const list = $('swatches');
  list.replaceChildren();
  const machine = colony.rule.kind === 'machine';
  colony.rule.tokens.forEach((letter, i) => {
    const li = document.createElement('li');
    const [r, g, b] = palette[i];
    li.style.background = `rgb(${r} ${g} ${b})`;
    li.style.color = r * 0.299 + g * 0.587 + b * 0.114 > 140 ? '#1f2328' : '#f7f5f0';
    li.textContent = letter;
    li.title = machine ? `Colour ${i}` : `Colour ${i}: ${TURN_WORDS[letter]}`;
    list.append(li);
  });
  list.setAttribute(
    'aria-label',
    machine ? `${colony.rule.colors} colours` : `Colours and their turns: ${colony.rule.tokens.join(', ')}`,
  );
  renderMachineTable();
}

const TURN_LETTERS = { 0: 'N', 1: 'R', 2: 'U', [-1]: 'L' };

// For a state machine, one row per state and one column per colour, each
// cell reading "paint, turn, next state".
function renderMachineTable() {
  const table = $('machine-table');
  const rule = colony.rule;
  table.hidden = rule.kind !== 'machine';
  table.replaceChildren();
  if (table.hidden) return;
  const caption = document.createElement('caption');
  caption.textContent = 'Paint · turn · next state';
  const head = document.createElement('tr');
  head.append(document.createElement('th'));
  for (let c = 0; c < rule.colors; c++) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = `on ${c}`;
    head.append(th);
  }
  table.append(caption, head);
  for (let s = 0; s < rule.states; s++) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = `state ${s}`;
    tr.append(th);
    for (let c = 0; c < rule.colors; c++) {
      const k = s * rule.colors + c;
      const td = document.createElement('td');
      td.textContent = `${rule.write[k]} ${TURN_LETTERS[rule.turn[k]]} ${rule.next[k]}`;
      tr.append(td);
    }
    table.append(tr);
  }
}

// A new rule, grid or layout gets a fresh view; ants placed by clicking
// keep the view where it is so the next click lands where expected.
function startColony({ refit = true } = {}) {
  const parsed = parseRule(state.rule, state.lattice);
  colony = new Colony(parsed.rule, state.ants);
  carry = 0;
  rebuildPalette();
  if (refit) {
    $('follow').checked = true;
    fit();
  }
  updateReadout();
}

function syncControls() {
  $('rule').value = state.rule;
  $('lattice').value = state.lattice;
  $('rule-help').textContent = RULE_HELP[state.lattice];
  $('rule-label').textContent =
    state.lattice === 'hex' ? 'Turns, one per colour' : 'Turns, one letter per colour, or a state machine';
  $('lines-option').hidden = state.lattice === 'hex';
  const preset = PRESETS.find((p) => p.rule === state.rule && p.lattice === state.lattice);
  $('preset').value = preset ? preset.id : '';
  $('preset-note').textContent = preset ? preset.note : 'Every rule is a different ant.';
  $('speed').value = state.speed;
  $('speed-out').textContent = `${fmt(SPEEDS[state.speed])} steps/s`;
  $('ant-count-out').textContent = $('ant-count').value;
}

function writeHash() {
  const h = encodeState({ ...state, steps: colony.steps });
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

// ---------- view ----------

function canvasSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = board.getBoundingClientRect();
  return { w: Math.max(1, Math.round(rect.width * dpr)), h: Math.max(1, Math.round(rect.height * dpr)), dpr };
}

function resize() {
  const { w, h } = canvasSize();
  if (board.width !== w || board.height !== h) {
    board.width = w;
    board.height = h;
    if (follow()) fit();
    dirty = true;
  }
}

function follow() {
  return $('follow').checked;
}

function fit() {
  const b = colony.box;
  view = fitView(
    { minX: b.minX - 2, maxX: b.maxX + 2, minY: b.minY - 2, maxY: b.maxY + 2 },
    board.width,
    board.height,
    0.1,
    state.lattice,
  );
  dirty = true;
}

// Keep following without jitter: refit only when the pattern leaves the
// framed area or shrinks well inside it.
function keepInView() {
  const { w, h } = { w: board.width, h: board.height };
  const b = colony.box;
  const wb = worldBox(state.lattice, b);
  const left = w / 2 + (wb.minX - view.cx) * view.scale;
  const right = w / 2 + (wb.maxX - view.cx) * view.scale;
  const top = h / 2 + (wb.minY - view.cy) * view.scale;
  const bottom = h / 2 + (wb.maxY - view.cy) * view.scale;
  const margin = view.scale;
  if (left < margin || top < margin || right > w - margin || bottom > h - margin) {
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    // Leave room to grow so the view is not refitted every frame.
    const grow = Math.max(4, Math.round(Math.max(bw, bh) * 0.25));
    view = fitView(
      { minX: b.minX - grow, maxX: b.maxX + grow, minY: b.minY - grow, maxY: b.maxY + grow },
      w,
      h,
      0,
      state.lattice,
    );
  }
}

function draw() {
  const w = board.width;
  const h = board.height;
  if (follow()) keepInView();
  const image = ctx.createImageData(w, h);
  const line = $('lines').checked ? line32 : null;
  paintPixels(new Uint32Array(image.data.buffer), w, h, colony.grid, view, palette32, line, state.lattice);
  ctx.putImageData(image, 0, 0);
  drawAnts(w, h);
}

// Unit vector on screen for a direction on the current lattice.
function heading(dir) {
  const { dx, dy } = moves(state.lattice);
  const o = worldCentre(state.lattice, 0, 0);
  const n = worldCentre(state.lattice, dx[dir], dy[dir]);
  const len = Math.hypot(n.wx - o.wx, n.wy - o.wy);
  return [(n.wx - o.wx) / len, (n.wy - o.wy) / len];
}

function drawAnts(w, h) {
  const size = Math.max(view.scale * 0.9, 12 * canvasSize().dpr);
  const accent = scheme() === 'dark' ? '#e0775c' : '#b4442c';
  const edge = scheme() === 'dark' ? '#111316' : '#ffffff';
  ctx.lineWidth = Math.max(1, size / 8);
  for (const a of colony.ants) {
    const { px, py } = cellCentre(view, w, h, a.x, a.y, state.lattice);
    if (px < -size || py < -size || px > w + size || py > h + size) continue;
    const [fx, fy] = heading(a.dir);
    const r = size / 2;
    ctx.beginPath();
    ctx.moveTo(px + fx * r, py + fy * r);
    ctx.lineTo(px - fx * r * 0.7 - fy * r * 0.75, py - fy * r * 0.7 + fx * r * 0.75);
    ctx.lineTo(px - fx * r * 0.7 + fy * r * 0.75, py - fy * r * 0.7 - fx * r * 0.75);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.strokeStyle = edge;
    ctx.fill();
    ctx.stroke();
  }
}

// ---------- readout ----------

function updateReadout() {
  const b = colony.box;
  $('r-steps').textContent = fmt(colony.steps);
  $('r-ants').textContent = fmt(colony.ants.length);
  $('r-extent').textContent = `${fmt(b.maxX - b.minX + 1)} × ${fmt(b.maxY - b.minY + 1)}`;
  $('r-painted').textContent = fmt(colony.painted);
  $('r-pattern').textContent = describePattern({
    highway: colony.highway,
    ants: colony.ants.length,
    steps: colony.steps,
    lattice: state.lattice,
  });
  const halt = describeHalt(colony.halted, colony.grid.size);
  if (halt) {
    setStatus(halt);
    if (playing) setPlaying(false);
  }
}

function setStatus(text) {
  $('status').textContent = text;
}

// ---------- running ----------

function setPlaying(on) {
  playing = on && !colony.halted && colony.ants.length > 0;
  $('play').textContent = playing ? 'Pause' : 'Play';
  $('play').setAttribute('aria-pressed', String(playing));
  lastTime = 0;
  carry = 0;
  if (!playing) writeHash();
}

function frame(time) {
  resize();
  if (playing && !jumping) {
    const dt = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 1 / 60;
    carry += SPEEDS[state.speed] * dt;
    const want = Math.floor(carry);
    carry -= want;
    if (want > 0) {
      // Spend at most ~12 ms per frame stepping; drop the rest.
      const deadline = performance.now() + 12;
      let left = want;
      while (left > 0 && performance.now() < deadline) {
        const n = Math.min(left, 20000);
        if (colony.run(n) < n) break;
        left -= n;
      }
      updateReadout();
      dirty = true;
    }
  }
  lastTime = time;
  if (dirty) {
    draw();
    dirty = false;
  }
  requestAnimationFrame(frame);
}

async function runTo(target) {
  target = Math.min(MAX_STEPS, Math.max(0, Math.floor(target)));
  setPlaying(false);
  if (target < colony.steps) colony.reset();
  jumping = true;
  const started = performance.now();
  while (colony.steps < target && !colony.halted) {
    const deadline = performance.now() + 30;
    while (colony.steps < target && performance.now() < deadline) {
      if (colony.run(Math.min(50000, target - colony.steps)) === 0) break;
    }
    if (performance.now() - started > 200) {
      setStatus(`Running to step ${fmt(target)}: ${Math.round((100 * colony.steps) / target)}%`);
    }
    updateReadout();
    dirty = true;
    await new Promise((r) => setTimeout(r));
  }
  jumping = false;
  if (!colony.halted) setStatus('');
  if (follow()) fit();
  updateReadout();
  writeHash();
}

// ---------- controls ----------

function applyRule(text) {
  const parsed = parseRule(text, state.lattice);
  const input = $('rule');
  if (!parsed.ok) {
    input.setAttribute('aria-invalid', 'true');
    $('rule-error').textContent = parsed.error;
    return;
  }
  input.removeAttribute('aria-invalid');
  $('rule-error').textContent = '';
  if (parsed.rule.text === state.rule && colony.steps === 0) return;
  state.rule = parsed.rule.text;
  const wasPlaying = playing;
  setPlaying(false);
  setStatus('');
  startColony();
  syncControls();
  $('rule').value = text.toUpperCase();
  writeHash();
  if (wasPlaying) setPlaying(true);
}

function setAnts(ants, refit = true) {
  state.ants = ants;
  setPlaying(false);
  setStatus('');
  startColony({ refit });
  writeHash();
}

// Switching grids starts over with one ant, since directions differ.
function setLattice(lattice, rule = DEFAULT_RULES[lattice]) {
  setPlaying(false);
  setStatus('');
  state.lattice = lattice;
  state.rule = rule;
  state.ants = LAYOUTS.single();
  $('rule').removeAttribute('aria-invalid');
  $('rule-error').textContent = '';
  startColony();
  syncControls();
  writeHash();
}

$('preset').addEventListener('change', (e) => {
  const p = PRESETS.find((q) => q.id === e.target.value);
  if (!p) return;
  if (p.lattice !== state.lattice) {
    setLattice(p.lattice, p.rule);
  } else {
    applyRule(p.rule);
    $('rule').value = p.rule;
  }
});

$('lattice').addEventListener('change', (e) => setLattice(e.target.value));

$('rule').addEventListener('input', (e) => applyRule(e.target.value));

document.querySelectorAll('[data-layout]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const n = Number($('ant-count').value);
    setAnts(LAYOUTS[btn.dataset.layout](n, state.lattice));
  }),
);

$('ant-count').addEventListener('input', () => {
  $('ant-count-out').textContent = $('ant-count').value;
});

$('play').addEventListener('click', () => setPlaying(!playing));

$('step').addEventListener('click', () => {
  setPlaying(false);
  colony.run(1);
  updateReadout();
  dirty = true;
  writeHash();
});

$('reset').addEventListener('click', () => {
  setPlaying(false);
  colony.reset();
  setStatus('');
  if (follow()) fit();
  updateReadout();
  dirty = true;
  writeHash();
});

$('speed').addEventListener('input', (e) => {
  state.speed = Number(e.target.value);
  syncControls();
  writeHash();
});

$('jump-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = Number($('jump').value);
  if (Number.isFinite(v) && !jumping) runTo(v);
});

$('follow').addEventListener('change', () => {
  if (follow()) fit();
});
$('lines').addEventListener('change', () => (dirty = true));
$('fit').addEventListener('click', () => {
  $('follow').checked = true;
  fit();
});

$('copy').addEventListener('click', async () => {
  writeHash();
  try {
    await navigator.clipboard.writeText(location.href);
    setStatus('Link copied. It replays this run to the same step.');
  } catch {
    setStatus('Copy failed; the link is in the address bar.');
  }
});

$('png').addEventListener('click', () => {
  const b = colony.box;
  const wb = worldBox(state.lattice, { minX: b.minX - 1, maxX: b.maxX + 1, minY: b.minY - 1, maxY: b.maxY + 1 });
  const bw = wb.maxX - wb.minX;
  const bh = wb.maxY - wb.minY;
  const scale = Math.max(1, Math.min(16, Math.floor(4000 / Math.max(bw, bh))));
  const w = Math.ceil(bw * scale);
  const h = Math.ceil(bh * scale);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const image = octx.createImageData(w, h);
  const v = { cx: (wb.minX + wb.maxX) / 2, cy: (wb.minY + wb.maxY) / 2, scale };
  paintPixels(new Uint32Array(image.data.buffer), w, h, colony.grid, v, palette32, null, state.lattice);
  octx.putImageData(image, 0, 0);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turmite-${colony.rule.text}-${colony.steps}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

// Pointer: drag pans (and stops following), a click at step 0 edits ants.
let drag = null;
board.addEventListener('pointerdown', (e) => {
  board.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
});
board.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { dpr } = canvasSize();
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  board.classList.add('panning');
  $('follow').checked = false;
  view = { ...view, cx: drag.cx - (dx * dpr) / view.scale, cy: drag.cy - (dy * dpr) / view.scale };
  dirty = true;
});
board.addEventListener('pointerup', (e) => {
  const wasDrag = drag?.moved;
  drag = null;
  board.classList.remove('panning');
  if (wasDrag) return;
  if (colony.steps > 0) {
    setStatus('Ants can be placed at step 0. Reset first.');
    return;
  }
  const rect = board.getBoundingClientRect();
  const { dpr } = canvasSize();
  const px = (e.clientX - rect.left) * dpr;
  const py = (e.clientY - rect.top) * dpr;
  const { x, y } = cellAt(view, board.width, board.height, px, py, state.lattice);
  setAnts(toggleAnt(state.ants, x, y, colony.rule.directions), false);
});
board.addEventListener('pointercancel', () => {
  drag = null;
  board.classList.remove('panning');
});

board.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const rect = board.getBoundingClientRect();
    const { dpr } = canvasSize();
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const scale = Math.min(MAX_SCALE * 2, Math.max(0.05, view.scale * factor));
    // Keep the point under the cursor fixed.
    const wx = view.cx + (px - board.width / 2) / view.scale;
    const wy = view.cy + (py - board.height / 2) / view.scale;
    view = { scale, cx: wx - (px - board.width / 2) / scale, cy: wy - (py - board.height / 2) / scale };
    $('follow').checked = false;
    dirty = true;
  },
  { passive: false },
);

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === ' ') {
    e.preventDefault();
    setPlaying(!playing);
  } else if (key === 's' || key === 'arrowright') {
    $('step').click();
  } else if (key === 'r') {
    $('reset').click();
  } else if (key === 'f') {
    $('fit').click();
  } else if (key === '[' || key === ']') {
    state.speed = Math.min(SPEEDS.length - 1, Math.max(0, state.speed + (key === ']' ? 1 : -1)));
    syncControls();
    writeHash();
  }
});

darkQuery.addEventListener('change', rebuildPalette);
window.addEventListener('resize', () => (dirty = true));
window.addEventListener('hashchange', () => {
  const next = decodeState(location.hash);
  if (encodeState(next) === encodeState({ ...state, steps: colony.steps })) return;
  Object.assign(state, next);
  setPlaying(false);
  startColony();
  syncControls();
  if (next.steps) runTo(next.steps);
});

// ---------- start ----------

syncControls();
startColony();
resize();
if (state.steps) runTo(state.steps);
requestAnimationFrame(frame);
