// Page wiring: canvas interaction, the chord panel, progression playback,
// share links and export. Everything musical lives in the other modules.

import { pitchClasses, chordName, chordLongName, spellTriad, parseChord, parseProgression, sameTriad } from './chords.js';
import { TRANSFORM_NAMES, movingVoice, voiceLead, closeVoicing } from './plr.js';
import { pcName } from './pitch.js';
import { neighbour, triangleTriad, triangleAt, nodeAt, nearestTriangleOf, triangleCentroid, pcAt } from './lattice.js';
import { PRESETS, tracePath, pathBounds, describe } from './progression.js';
import { timeline, eventAt } from './player.js';
import { createView, screenToWorld, pan, zoomAt, fitBox, keepInView } from './view.js';
import { draw } from './render.js';
import { createSynth } from './audio.js';
import { decode, encode, heldFromText, heldToText } from './settings.js';
import { describeSet, parseNotes, toggle } from './chordset.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const ctx = canvas.getContext('2d');
const synth = createSynth();

const settings = decode(location.hash || location.search);
const state = {
  view: createView(),
  current: null,
  path: [],
  pathHead: 0,
  history: [],
  hover: null,
  sounding: [],
  voicing: null,
  trace: null,
  playing: null,
  held: [],
};

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let size = { w: 0, h: 0 };

// ---------- drawing ----------

let frameQueued = false;
function requestDraw() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => {
    frameQueued = false;
    render();
  });
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(ctx, {
    view: state.view,
    w: size.w,
    h: size.h,
    theme: darkQuery.matches ? 'dark' : 'light',
    spelling: settings.spelling,
    labels: settings.labels,
    current: state.current,
    currentTriad: state.current ? triangleTriad(state.current) : null,
    hover: state.hover,
    sounding: state.sounding,
    path: state.path,
    pathHead: state.pathHead,
    held: state.held,
  });
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const refit = size.w > 0 && Math.abs(rect.width - size.w) / size.w > 0.25;
  size = { w: rect.width, h: rect.height };
  if (refit) fitPath();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  render();
}

new ResizeObserver(resize).observe(canvas);
darkQuery.addEventListener?.('change', requestDraw);

// ---------- sound ----------

let soundingTimer = 0;
function sound(notes, duration = 1.2) {
  synth.play(notes, duration);
  state.sounding = [...new Set(notes.map((n) => ((n % 12) + 12) % 12))];
  clearTimeout(soundingTimer);
  soundingTimer = setTimeout(() => {
    state.sounding = [];
    requestDraw();
  }, duration * 1000 + 150);
  requestDraw();
}

function soundChord(t) {
  state.voicing = state.voicing ? voiceLead(state.voicing, t) : closeVoicing(t, 62);
  sound(state.voicing);
}

// ---------- chord panel ----------

function setStatus(text) {
  $('status').textContent = text;
}

function describeMove(from, to, move) {
  const mv = movingVoice(from, to);
  if (!mv) return '';
  const dir = mv.semitones > 0 ? 'rises' : 'falls';
  const step = Math.abs(mv.semitones) === 1 ? 'a semitone' : 'a whole tone';
  const kept = pitchClasses(from).filter((p) => p !== mv.from).map((p) => pcName(p, settings.spelling)).join(' and ');
  const label = move ? `${move} (${TRANSFORM_NAMES[move]}): ` : '';
  return `${label}${pcName(mv.from, settings.spelling)} ${dir} ${step} to ${pcName(mv.to, settings.spelling)}; ${kept} stay.`;
}

function updateChordPanel(move, previous) {
  const t = state.current ? triangleTriad(state.current) : null;
  if (!t) return;
  $('chord-name').textContent = chordName(t, settings.spelling);
  $('chord-notes').textContent = spellTriad(t, settings.spelling).join(' ');
  $('voice').textContent = previous ? describeMove(previous, t, move) : 'Press P, L or R to move to a neighbouring chord.';
  canvas.setAttribute('aria-label', `Tonnetz lattice, current chord ${chordLongName(t, settings.spelling)}`);
  settings.chord = chordName(t);
}

function setCurrent(tri, { move = null, record = true, play = true, follow = true } = {}) {
  const previous = state.current ? triangleTriad(state.current) : null;
  if (record && state.current) state.history.push(state.current);
  state.current = tri;
  const t = triangleTriad(tri);
  if (play) soundChord(t);
  if (follow) {
    const c = triangleCentroid(tri);
    state.view = keepInView(state.view, size.w, size.h, c.x, c.y);
  }
  updateChordPanel(move, previous && !sameTriad(previous, t) ? previous : null);
  setStatus(chordLongName(t, settings.spelling) + (move ? ` after ${move}` : ''));
  requestDraw();
}

function applyMove(move) {
  if (!state.current) return;
  stopPlayback();
  const next = neighbour(state.current, move);
  // Free moves extend a walk drawn on the lattice.
  if (state.trace) {
    state.trace = null;
    state.path = [state.current];
  }
  if (!state.path.length) state.path = [state.current];
  state.path.push(next);
  state.pathHead = state.path.length - 1;
  setCurrent(next, { move });
}

function stepBack() {
  stopPlayback();
  const prev = state.history.pop();
  if (!prev) return;
  if (state.path.length > 1 && !state.trace) {
    state.path.pop();
    state.pathHead = state.path.length - 1;
  }
  setCurrent(prev, { record: false });
}

for (const b of document.querySelectorAll('[data-move]')) {
  b.addEventListener('click', () => applyMove(b.dataset.move));
}
$('undo').addEventListener('click', stepBack);
$('replay').addEventListener('click', () => state.current && soundChord(triangleTriad(state.current)));

// ---------- canvas interaction ----------

const pointers = new Map();
let drag = null;

function localPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = localPoint(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) drag = { start: p, last: p, moved: false };
  else drag = { pinch: pinchInfo(), moved: true };
});

function pinchInfo() {
  const [a, b] = [...pointers.values()];
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
}

canvas.addEventListener('pointermove', (e) => {
  const p = localPoint(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  if (drag && pointers.size >= 2 && drag.pinch) {
    const now = pinchInfo();
    state.view = zoomAt(state.view, size.w, size.h, now.mid.x, now.mid.y, now.dist / Math.max(1, drag.pinch.dist));
    state.view = pan(state.view, now.mid.x - drag.pinch.mid.x, now.mid.y - drag.pinch.mid.y);
    drag.pinch = now;
    requestDraw();
    return;
  }
  if (drag && pointers.has(e.pointerId)) {
    if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 5) {
      drag.moved = true;
      canvas.classList.add('dragging');
    }
    if (drag.moved) {
      state.view = pan(state.view, p.x - drag.last.x, p.y - drag.last.y);
      drag.last = p;
      requestDraw();
    }
    return;
  }
  const w = screenToWorld(state.view, size.w, size.h, p.x, p.y);
  const tri = triangleAt(w.x, w.y);
  if (!state.hover || tri.q !== state.hover.q || tri.r !== state.hover.r || tri.up !== state.hover.up) {
    state.hover = tri;
    requestDraw();
  }
});

function endPointer(e) {
  const p = localPoint(e);
  const wasClick = drag && !drag.moved && pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    canvas.classList.remove('dragging');
    if (wasClick) clickAt(p, e.shiftKey);
    drag = null;
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) drag = null;
});
canvas.addEventListener('pointerleave', () => {
  state.hover = null;
  requestDraw();
});

function clickAt(p, shift = false) {
  const w = screenToWorld(state.view, size.w, size.h, p.x, p.y);
  const node = nodeAt(w.x, w.y);
  if (shift && node.distance < 0.35) {
    setHeld(toggle(state.held, pcAt(node.q, node.r)));
    playHeld(0.9);
    return;
  }
  if (node.distance < 0.2) {
    const pc = pcAt(node.q, node.r);
    const midi = 60 + pc;
    sound([midi], 0.9);
    setStatus(`${pcName(pc, settings.spelling)}`);
    return;
  }
  stopPlayback();
  const tri = triangleAt(w.x, w.y);
  state.trace = null;
  state.path = [tri];
  state.pathHead = 0;
  setCurrent(tri, { follow: false });
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = localPoint(e);
  state.view = zoomAt(state.view, size.w, size.h, p.x, p.y, Math.exp(-e.deltaY * 0.0015));
  requestDraw();
}, { passive: false });

function zoomCentre(factor) {
  state.view = zoomAt(state.view, size.w, size.h, size.w / 2, size.h / 2, factor);
  requestDraw();
}

function fitPath() {
  const path = state.path.length ? state.path : state.current ? [state.current] : [];
  if (!path.length) return;
  state.view = fitBox(pathBounds(path, 1.2), size.w, size.h);
  requestDraw();
}

$('zoom-in').addEventListener('click', () => zoomCentre(1.25));
$('zoom-out').addEventListener('click', () => zoomCentre(0.8));
$('fit').addEventListener('click', fitPath);

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  const step = 60;
  if (/^[plr]$/i.test(k)) applyMove(k.toUpperCase());
  else if (k === 'Backspace') stepBack();
  else if (k === ' ' && e.target !== document.querySelector('button:focus')) togglePlayback();
  else if (k === 'ArrowLeft') state.view = pan(state.view, step, 0);
  else if (k === 'ArrowRight') state.view = pan(state.view, -step, 0);
  else if (k === 'ArrowUp') state.view = pan(state.view, 0, step);
  else if (k === 'ArrowDown') state.view = pan(state.view, 0, -step);
  else if (k === '+' || k === '=') zoomCentre(1.25);
  else if (k === '-' || k === '_') zoomCentre(0.8);
  else if (k === 'f' || k === 'F') fitPath();
  else return;
  e.preventDefault();
  requestDraw();
});

// ---------- progression ----------

const progInput = $('progression');

for (const p of PRESETS) {
  const o = document.createElement('option');
  o.value = p.key;
  o.textContent = p.name;
  $('preset').append(o);
}

$('preset').addEventListener('change', () => {
  const p = PRESETS.find((x) => x.key === $('preset').value);
  if (!p) return;
  progInput.value = p.text;
  loadProgression({ fit: true, play: false });
});

function loadProgression({ fit = false, play = false } = {}) {
  stopPlayback();
  settings.progression = progInput.value;
  const { chords, errors } = parseProgression(progInput.value);
  const err = $('prog-error');
  err.hidden = errors.length === 0;
  err.textContent = errors.length ? `Not a major or minor triad: ${errors.join(', ')}` : '';
  if (!chords.length) {
    state.trace = null;
    renderSteps();
    return;
  }
  const origin = state.current ? triangleCentroid(state.current) : undefined;
  state.trace = tracePath(chords, origin);
  state.path = state.trace.path;
  state.pathHead = state.path.length - 1;
  state.history = [];
  state.voicing = null;
  setCurrent(state.path[0], { record: false, play: false, follow: false });
  renderSteps();
  if (fit) fitPath();
  if (play) startPlayback();
}

function renderSteps(active = -1) {
  const ol = $('steps');
  ol.textContent = '';
  const tr = state.trace;
  $('summary').textContent = tr ? `${describe(tr, settings.spelling)}` : '';
  if (!tr) return;
  tr.steps.forEach((st, i) => {
    const li = document.createElement('li');
    if (i > 0) {
      const w = document.createElement('span');
      w.className = 'word';
      w.textContent = st.word || '=';
      w.setAttribute('aria-label', st.word ? `moves ${st.word.split('').join(' ')}` : 'same chord');
      li.append(w);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = chordName(st.chord, settings.spelling);
    if (st.chord.quality === 'm') b.classList.add('minor');
    if (i === active) b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => {
      stopPlayback();
      state.pathHead = st.to;
      setCurrent(state.path[st.to], { record: false });
      renderSteps(i);
    });
    li.append(b);
    ol.append(li);
  });
}

$('trace').addEventListener('click', () => loadProgression({ fit: true }));
progInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    loadProgression({ fit: true });
  }
});

function startPlayback() {
  if (!state.trace) loadProgression({ fit: true });
  if (!state.trace) return;
  const tl = timeline(state.trace, { tempo: settings.tempo, beats: 2 });
  state.voicing = null;
  const t0 = performance.now();
  let lastIndex = -1;
  state.playing = { tl, t0, raf: 0 };
  $('play').textContent = 'Stop';
  $('play').classList.add('playing');
  const tick = () => {
    if (!state.playing) return;
    const t = (performance.now() - t0) / 1000;
    const idx = tl.events.findIndex((e) => e === eventAt(tl, t));
    if (idx !== lastIndex && idx >= 0) {
      for (let i = lastIndex + 1; i <= idx; i++) {
        const ev = tl.events[i];
        state.pathHead = ev.pathIndex;
        state.current = state.path[ev.pathIndex];
        if (ev.sound) {
          state.voicing = ev.notes;
          sound(ev.notes, ev.duration);
          updateChordPanel(null, null);
          setStatus(chordLongName(state.trace.steps[ev.step].chord, settings.spelling));
          renderSteps(ev.step);
        }
      }
      const c = triangleCentroid(state.current);
      state.view = keepInView(state.view, size.w, size.h, c.x, c.y);
      lastIndex = idx;
      requestDraw();
    }
    if (t >= tl.duration) {
      stopPlayback();
      return;
    }
    state.playing.raf = requestAnimationFrame(tick);
  };
  state.pathHead = 0;
  tick();
}

function stopPlayback() {
  if (!state.playing) return;
  cancelAnimationFrame(state.playing.raf);
  state.playing = null;
  $('play').textContent = 'Play';
  $('play').classList.remove('playing');
  if (state.trace) state.pathHead = state.path.length - 1;
  requestDraw();
}

function togglePlayback() {
  if (state.playing) stopPlayback();
  else startPlayback();
}

$('play').addEventListener('click', togglePlayback);

const tempo = $('tempo');
tempo.addEventListener('input', () => {
  settings.tempo = Number(tempo.value);
  $('tempo-out').textContent = `${settings.tempo} bpm`;
});

// ---------- held notes ----------

const heldInput = $('held');

function setHeld(pcs, { fromInput = false } = {}) {
  state.held = pcs.slice(0, 12);
  settings.held = heldToText(state.held);
  if (!fromInput) heldInput.value = state.held.map((pc) => pcName(pc, settings.spelling)).join(' ');
  $('held-name').textContent = describeSet(state.held, { spelling: settings.spelling, bass: state.held[0] ?? null });
  requestDraw();
}

// Held notes sound upward from the first one, each above the last.
function heldVoicing() {
  const out = [];
  for (const pc of state.held) {
    let m = 48 + pc;
    if (out.length) while (m <= out[out.length - 1]) m += 12;
    out.push(m);
  }
  return out;
}

function playHeld(duration = 1.4) {
  if (state.held.length) sound(heldVoicing(), duration);
}

heldInput.addEventListener('input', () => {
  const { errors } = parseNotes(heldInput.value);
  const err = $('held-error');
  err.hidden = errors.length === 0;
  err.textContent = errors.length ? `Not a note name: ${errors.join(', ')}` : '';
  setHeld(heldFromText(heldInput.value), { fromInput: true });
});
heldInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') playHeld();
});
$('held-play').addEventListener('click', () => playHeld());
$('held-clear').addEventListener('click', () => {
  setHeld([]);
  $('held-error').hidden = true;
});

// ---------- display, sound, share ----------

$('spelling').addEventListener('change', () => {
  settings.spelling = $('spelling').value;
  updateChordPanel(null, null);
  setHeld(state.held);
  renderSteps();
  requestDraw();
});

$('labels').addEventListener('change', () => {
  settings.labels = $('labels').value;
  requestDraw();
});

$('volume').addEventListener('input', () => synth.setVolume(Number($('volume').value)));
$('mute').addEventListener('change', () => synth.setMuted($('mute').checked));

$('share').addEventListener('click', async () => {
  settings.progression = progInput.value;
  const q = encode(settings);
  const url = `${location.origin}${location.pathname}${q ? '#' + q : ''}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Share link copied.');
  } catch {
    setStatus('Share link is in the address bar.');
  }
});

$('png').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tonnetz.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

// ---------- start ----------

progInput.value = settings.progression;
tempo.value = String(settings.tempo);
$('tempo-out').textContent = `${settings.tempo} bpm`;
$('spelling').value = settings.spelling;
$('labels').value = settings.labels;
if (!synth.available) $('voice').textContent = 'This browser has no Web Audio, so chords are shown but not played.';

resize();
setHeld(heldFromText(settings.held));
loadProgression({ play: false });
const startChord = parseChord(settings.chord);
if (startChord && state.current && !sameTriad(triangleTriad(state.current), startChord)) {
  const c = triangleCentroid(state.current);
  setCurrent(nearestTriangleOf(startChord, c.x, c.y), { record: false, play: false, follow: false });
}
fitPath();
