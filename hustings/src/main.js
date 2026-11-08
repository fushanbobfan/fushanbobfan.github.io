import { voterCloud, castBallots, electorateAt } from './voters.js';
import { METHODS } from './methods.js';
import { createMap, fillRows, shares, condorcetMisses } from './map.js';
import {
  COLORS, LETTERS, MAX_CANDIDATES, SCENES,
  sceneCandidates, clampPoint, placeNewCandidate, encodeState, decodeState,
} from './scenes.js';
import { renderProbe } from './probe.js';

const $ = (id) => document.getElementById(id);

const COARSE = 48;
const FINE = 160;
const ROWS_PER_FRAME = 10;
const cloud = voterCloud(151, 1);
const RGB = COLORS.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));

const state = {
  candidates: sceneCandidates(SCENES[0]),
  spread: SCENES[0].spread,
  method: 0,
  showMisses: false,
  showVoters: false,
  probe: { x: 0.5, y: 0.5 },
};

const restored = decodeState(location.hash);
if (restored) Object.assign(state, restored);

let map = null;
let job = 0;

// ---- controls --------------------------------------------------------------

for (const s of SCENES) $('scene').append(new Option(s.name, s.id));
if (restored) $('scene').append(new Option('From the link', 'link'));
$('scene').value = restored ? 'link' : SCENES[0].id;

METHODS.forEach((m, i) => {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'method';
  input.value = String(i);
  input.checked = i === state.method;
  input.addEventListener('change', () => selectMethod(i));
  label.append(input, ' ', m.name);
  $('method-list').append(label);
});

const thumbs = METHODS.map((m, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'thumb';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FINE;
  canvas.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.textContent = m.name;
  const note = document.createElement('small');
  button.append(canvas, name, note);
  button.addEventListener('click', () => selectMethod(i));
  $('thumbs').append(button);
  return { button, canvas, note };
});

$('spread').value = String(state.spread);
$('spread').addEventListener('input', () => {
  state.spread = Number($('spread').value);
  changed();
});

$('show-misses').addEventListener('change', () => {
  state.showMisses = $('show-misses').checked;
  draw();
});

$('show-voters').addEventListener('change', () => {
  state.showVoters = $('show-voters').checked;
  drawOverlay();
});

$('scene').addEventListener('change', () => {
  const s = SCENES.find((x) => x.id === $('scene').value);
  if (!s) return;
  state.candidates = sceneCandidates(s);
  state.spread = s.spread;
  $('spread').value = String(s.spread);
  buildHandles();
  changed();
});

$('add').addEventListener('click', () => {
  if (state.candidates.length >= MAX_CANDIDATES) return;
  state.candidates.push(placeNewCandidate(state.candidates));
  buildHandles();
  changed();
  handles.at(-1).focus();
});

$('remove').addEventListener('click', () => {
  if (state.candidates.length <= 2) return;
  state.candidates.pop();
  buildHandles();
  changed();
});

// The address bar already holds the positions; this puts it on the clipboard.
$('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('copy-status').textContent = 'Link copied.';
  } catch {
    $('copy-status').textContent = 'Copy the address bar to share this picture.';
  }
  setTimeout(() => { $('copy-status').textContent = ''; }, 4000);
});

function selectMethod(i) {
  state.method = i;
  document.querySelector(`input[name="method"][value="${i}"]`).checked = true;
  draw();
  showProbe();
}

// ---- candidate handles -----------------------------------------------------

let handles = [];

function buildHandles() {
  $('handles').replaceChildren();
  handles = state.candidates.map((_, i) => {
    const h = document.createElement('button');
    h.type = 'button';
    h.className = 'handle';
    h.textContent = LETTERS[i];
    h.style.background = COLORS[i];
    h.addEventListener('pointerdown', (e) => startDrag(e, i));
    h.addEventListener('keydown', (e) => nudge(e, (dx, dy) => {
      const c = state.candidates[i];
      c.x = clampPoint(c.x + dx);
      c.y = clampPoint(c.y + dy);
      changed();
    }));
    $('handles').append(h);
    return h;
  });
  placeHandles();
  $('add').disabled = state.candidates.length >= MAX_CANDIDATES;
  $('remove').disabled = state.candidates.length <= 2;
}

function placeHandles() {
  state.candidates.forEach((c, i) => {
    const h = handles[i];
    h.style.left = `${c.x * 100}%`;
    h.style.top = `${c.y * 100}%`;
    h.setAttribute('aria-label', `Candidate ${LETTERS[i]}, ${Math.round(c.x * 100)}% across, ${Math.round(c.y * 100)}% down`);
  });
}

function boardPoint(e) {
  const r = $('board').getBoundingClientRect();
  return { x: clampPoint((e.clientX - r.left) / r.width), y: clampPoint((e.clientY - r.top) / r.height) };
}

function startDrag(e, i) {
  e.preventDefault();
  const h = handles[i];
  h.setPointerCapture(e.pointerId);
  h.focus();
  const move = (ev) => {
    Object.assign(state.candidates[i], boardPoint(ev));
    changed();
  };
  const end = () => {
    h.removeEventListener('pointermove', move);
    h.removeEventListener('pointerup', end);
    h.removeEventListener('pointercancel', end);
  };
  h.addEventListener('pointermove', move);
  h.addEventListener('pointerup', end);
  h.addEventListener('pointercancel', end);
}

function nudge(e, apply) {
  const step = e.shiftKey ? 0.05 : 0.01;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  const m = moves[e.key];
  if (!m) return;
  e.preventDefault();
  apply(...m);
}

// ---- the probe: one election shown in full ---------------------------------

$('map').addEventListener('pointerdown', (e) => {
  state.probe = boardPoint(e);
  drawOverlay();
  showProbe();
});

$('map').addEventListener('keydown', (e) => nudge(e, (dx, dy) => {
  state.probe = { x: clampPoint(state.probe.x + dx), y: clampPoint(state.probe.y + dy) };
  drawOverlay();
  showProbe();
}));

function showProbe() {
  renderProbe($('probe'), {
    point: state.probe,
    candidates: state.candidates,
    spread: state.spread,
    cloud,
    method: state.method,
    onSelect: selectMethod,
  });
}

// ---- computing and drawing the maps ----------------------------------------

// Every change draws a coarse map at once, then refines it a few rows per frame.
function changed() {
  placeHandles();
  history.replaceState(null, '', '#' + encodeState(state.candidates, state.spread));
  $('spread-out').textContent = state.spread.toFixed(2);
  const options = { candidates: state.candidates.map((c) => ({ ...c })), cloud, spread: state.spread, methods: METHODS };
  map = fillRows(createMap({ res: COARSE, ...options }), 0, COARSE);
  draw();
  showProbe();
  const mine = ++job;
  const fine = createMap({ res: FINE, ...options });
  const step = () => {
    if (mine !== job) return;
    fillRows(fine, fine.done, fine.done + ROWS_PER_FRAME);
    $('progress').textContent = fine.done < FINE ? `Refining the map… ${Math.round((100 * fine.done) / FINE)}%` : '';
    if (fine.done >= FINE) {
      map = fine;
      draw();
    } else {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

function paint(canvas, m, misses) {
  const res = map.res;
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(res, res);
  const w = map.winners[m];
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const cell = y * res + x;
      let [r, g, b] = RGB[w[cell]];
      const cw = map.condorcet[cell];
      if (misses && cw >= 0 && cw !== w[cell] && (x + y) % 4 < 2) {
        [r, g, b] = RGB[cw];
      }
      const o = cell * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function draw() {
  const m = METHODS[state.method];
  $('method-name').textContent = m.name;
  $('method-rule').textContent = m.rule;
  paint($('map'), state.method, state.showMisses);
  thumbs.forEach((t, i) => {
    paint(t.canvas, i, false);
    t.button.setAttribute('aria-pressed', String(i === state.method));
    const miss = condorcetMisses(map, i);
    t.note.textContent = miss < 0.005 ? 'Never passes over the Condorcet winner here'
      : `Passes over the Condorcet winner on ${Math.round(miss * 100)}% of the map`;
  });
  const s = shares(map, state.method);
  $('shares').innerHTML = s.map((v, i) =>
    `<span class="swatch" style="background:${COLORS[i]}"></span>${LETTERS[i]} ${Math.round(v * 100)}%`).join(' &nbsp; ')
    + '<br>Share of the map each candidate wins.';
  drawOverlay();
}

// The voter cloud around the probe: rings at one and two standard deviations.
function drawOverlay() {
  const c = $('overlay');
  const size = c.clientWidth || 560;
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(size * dpr)) c.width = c.height = Math.round(size * dpr);
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const px = state.probe.x * size, py = state.probe.y * size;
  for (const [k, alpha] of [[1, 0.9], [2, 0.5]]) {
    ctx.beginPath();
    ctx.arc(px, py, state.spread * k * size, 0, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.setLineDash(k === 1 ? [] : [5, 5]);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.8})`;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (state.showVoters) drawVoters(ctx, size);
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

// One dot per voter in the probe's electorate, filled with the colour of their first choice.
function drawVoters(ctx, size) {
  const { x, y } = state.probe;
  const { xs, ys } = electorateAt(cloud, x, y, state.spread);
  const ballots = castBallots(cloud, x, y, state.spread, state.candidates);
  const r = Math.max(3.5, size / 120);
  for (let v = 0; v < cloud.n; v++) {
    ctx.beginPath();
    ctx.arc(xs[v] * size, ys[v] * size, r, 0, 2 * Math.PI);
    ctx.fillStyle = COLORS[ballots.order[v * ballots.k]];
    ctx.fill();
    // A dark ring keeps a dot visible on a region of its own colour.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(20,18,15,0.9)';
    ctx.stroke();
  }
}

window.addEventListener('resize', drawOverlay);

buildHandles();
changed();
