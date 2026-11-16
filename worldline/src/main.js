import { clampBeta, rapidity, betaFromRapidity, relativeVelocity } from './lorentz.js';
import {
  makeView, toView, fromView, frameGrid, frameAxes, simultaneityLine, invariantHyperbola, pick, labelFor,
} from './diagram.js';
import { describePair, fmt, fmtBeta } from './readout.js';
import { selectIndex, afterRemoval, focusAfterRemoval } from './selection.js';

const $ = (id) => document.getElementById(id);

const HALF = 5; // light-seconds from the centre to each edge
const MAX_EVENTS = 12;
const NUDGE = 0.1;
const START = {
  rocket: 0.5,
  events: [{ t: 0, x: -2 }, { t: 1, x: 2.5 }, { t: 3, x: 0.5 }],
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const canvas = $('diagram');
const ctx = canvas.getContext('2d');
const view = makeView(canvas.width, HALF);

const state = {
  viewBeta: 0,
  rocketBeta: START.rocket,
  events: START.events.map((e) => ({ ...e })),
  selected: [0, 1], // up to two event indices, the most recent last
  drag: null,
  tween: null,
};

function colors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    paper: v('--panel'), ink: v('--ink'), muted: v('--muted'), rule: v('--rule'),
    lab: v('--lab'), rocket: v('--rocket'), light: v('--light'), accent: v('--accent'),
  };
}

function frames() {
  return [
    { name: 'Lab', beta: 0, color: 'lab', grid: $('show-lab-grid').checked, labels: ['t', 'x'] },
    { name: 'Rocket', beta: state.rocketBeta, color: 'rocket', grid: $('show-rocket-grid').checked, labels: ['t′', 'x′'] },
  ];
}

// --- drawing ---------------------------------------------------------------

function line(a, b) {
  const [x1, y1] = view.toCanvas(a);
  const [x2, y2] = view.toCanvas(b);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function polyline(points) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = view.toCanvas(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// Where a line from the origin along `dir` leaves the view, pulled in a little for a label.
function edgePoint(dir, inset = 0.45) {
  const k = (HALF - inset) / Math.max(Math.abs(dir.t), Math.abs(dir.x));
  return { t: dir.t * k, x: dir.x * k };
}

function draw() {
  const c = colors();
  const W = canvas.width;
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, W, W);
  const vb = state.viewBeta;
  const fs = frames();

  ctx.lineWidth = 1;
  for (const f of fs) {
    if (!f.grid) continue;
    ctx.strokeStyle = c[f.color];
    ctx.globalAlpha = 0.18;
    for (const l of frameGrid(f.beta, vb, HALF)) if (l.value !== 0) line(l.a, l.b);
  }
  ctx.globalAlpha = 1;

  // light lines through the origin
  ctx.strokeStyle = c.light;
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.2;
  line({ t: -HALF * 2, x: -HALF * 2 }, { t: HALF * 2, x: HALF * 2 });
  line({ t: -HALF * 2, x: HALF * 2 }, { t: HALF * 2, x: -HALF * 2 });
  ctx.setLineDash([]);

  if ($('show-hyper').checked) {
    ctx.strokeStyle = c.muted;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([2, 4]);
    for (const s2 of [1, 4, 9, -1, -4, -9]) for (const b of invariantHyperbola(s2, HALF * 1.5)) polyline(b);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  ctx.font = '15px Georgia, serif';
  for (const f of fs) {
    const ax = frameAxes(f.beta, vb, HALF * 3);
    ctx.strokeStyle = c[f.color];
    ctx.fillStyle = c[f.color];
    ctx.lineWidth = 2;
    line(ax.time[0], ax.time[1]);
    line(ax.space[0], ax.space[1]);
    drawLabel(f.labels[0], edgePoint(ax.time[1]), c[f.color], 'time');
    drawLabel(f.labels[1], edgePoint(ax.space[1]), c[f.color], 'space');
  }

  const active = state.selected[state.selected.length - 1];
  if (active !== undefined && state.events[active]) {
    const e = state.events[active];
    const at = toView(e, vb);
    if ($('show-cone').checked) {
      ctx.fillStyle = c.light;
      ctx.globalAlpha = 0.1;
      cone(at, 1);
      cone(at, -1);
      ctx.globalAlpha = 1;
    }
    if ($('show-sim').checked) {
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      for (const f of fs) {
        ctx.strokeStyle = c[f.color];
        const [a, b] = simultaneityLine(e, f.beta, vb, HALF * 6);
        line(a, b);
      }
      ctx.setLineDash([]);
    }
  }

  if (state.selected.length === 2) {
    const [i, j] = state.selected;
    ctx.strokeStyle = c.ink;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    line(toView(state.events[i], vb), toView(state.events[j], vb));
    ctx.globalAlpha = 1;
  }

  state.events.forEach((e, i) => {
    const [x, y] = view.toCanvas(toView(e, vb));
    const chosen = state.selected.includes(i);
    ctx.beginPath();
    ctx.arc(x, y, chosen ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fillStyle = c.ink;
    ctx.fill();
    if (chosen) {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = c.ink;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText(labelFor(i), x + 10, y - 9);
  });
}

function cone(at, dir) {
  const far = Math.abs(at.t) + Math.abs(at.x) + HALF * 3; // reaches every corner of the view
  const pts = [at, { t: at.t + dir * far, x: at.x - far }, { t: at.t + dir * far, x: at.x + far }];
  ctx.beginPath();
  pts.forEach((p, k) => {
    const [x, y] = view.toCanvas(p);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

function drawLabel(text, p, color, which) {
  const [x, y] = view.toCanvas(p);
  ctx.fillStyle = color;
  ctx.font = 'italic 16px Georgia, serif';
  const dx = which === 'time' ? 8 : -6;
  const dy = which === 'time' ? 4 : -8;
  ctx.textAlign = which === 'time' ? 'left' : 'right';
  ctx.fillText(text, x + dx, y + dy);
  ctx.textAlign = 'left';
}

// --- panels ----------------------------------------------------------------

function frameName(beta) {
  if (Math.abs(beta) < 0.005) return 'the lab';
  if (Math.abs(beta - state.rocketBeta) < 0.005) return 'the rocket';
  return `an observer moving at ${fmtBeta(beta)} relative to the lab`;
}

function updateNote() {
  const vb = state.viewBeta;
  const rel = relativeVelocity(state.rocketBeta, vb);
  const labRel = relativeVelocity(0, vb);
  const parts = [`Looking from ${frameName(vb)}.`];
  if (Math.abs(vb) >= 0.005) parts.push(`The lab moves at ${fmtBeta(labRel)} here.`);
  if (Math.abs(vb - state.rocketBeta) >= 0.005) parts.push(`The rocket moves at ${fmtBeta(rel)} here.`);
  if (Math.abs(vb) < 0.005 && Math.abs(state.rocketBeta) < 0.005) parts.push('The rocket is parked in the lab.');
  $('frame-note').textContent = parts.join(' ');
}

function updateEventList() {
  const list = $('event-list');
  list.replaceChildren();
  state.events.forEach((e, i) => {
    const p = toView(e, state.viewBeta);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.setAttribute('aria-pressed', String(state.selected.includes(i)));
    b.textContent = `${labelFor(i)}   t = ${fmt(p.t)} s,  x = ${fmt(p.x)} ls`;
    b.addEventListener('click', () => {
      select(i);
      refresh();
      focusRow(i);
    });
    const r = document.createElement('button');
    r.type = 'button';
    r.className = 'remove';
    r.textContent = '×';
    r.setAttribute('aria-label', `Remove event ${labelFor(i)}`);
    r.addEventListener('click', () => {
      removeEvent(i);
      refresh();
      focusRow(focusAfterRemoval(state.events.length, i));
    });
    li.append(b, r);
    list.append(li);
  });
  if (!state.events.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No events. Click the diagram or use the fields below to add one.';
    list.append(li);
  }
}

// The list is rebuilt on every change, so put keyboard focus back where the user was.
function focusRow(i) {
  const rows = $('event-list').querySelectorAll('.pick');
  if (i >= 0 && rows[i]) rows[i].focus();
  else $('add-t').focus();
}

function updatePair() {
  const tbody = $('pair-table').querySelector('tbody');
  const facts = $('pair-facts');
  const boostBtn = $('boost-to');
  tbody.replaceChildren();
  facts.replaceChildren();
  boostBtn.hidden = true;
  if (state.selected.length < 2) {
    $('pair-title').textContent = 'Two events';
    $('pair-table').hidden = true;
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Select two events to compare them.';
    facts.append(p);
    return;
  }
  const [i, j] = state.selected;
  const names = [labelFor(i), labelFor(j)];
  $('pair-title').textContent = `${names[0]} and ${names[1]}`;
  $('pair-table').hidden = false;
  const fs = frames().map(({ name, beta }) => ({ name: `${name} (${fmtBeta(beta)})`, beta }));
  const vb = state.viewBeta;
  const nearOne = fs.some((f) => Math.abs(f.beta - vb) < 0.005);
  if (!nearOne) fs.push({ name: `This view (${fmtBeta(vb)})`, beta: vb });
  const { rows, facts: info } = describePair(state.events[i], state.events[j], fs, names);
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const text of [r.name, `${fmt(Math.abs(r.dt))} s`, `${fmt(Math.abs(r.dx))} ls`, r.when]) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    tbody.append(tr);
  }
  const s = document.createElement('p');
  s.textContent = `Interval: ${fmt(info.s2)} s² (time apart squared minus distance apart squared), the same in every row.`;
  facts.append(s);
  for (const sentence of info.sentences) {
    const p = document.createElement('p');
    p.textContent = sentence;
    facts.append(p);
  }
  const target = info.kind === 'spacelike' ? info.simultaneousBeta : info.kind === 'timelike' ? info.colocatedBeta : null;
  if (target !== null && Math.abs(target) <= 0.9) {
    boostBtn.hidden = false;
    boostBtn.dataset.beta = String(target);
    boostBtn.textContent = info.kind === 'spacelike'
      ? `Look from the frame where they happen together (${fmtBeta(target)})`
      : `Look from the frame where they happen at one place (${fmtBeta(target)})`;
  } else if (target !== null) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = `That frame moves at ${fmtBeta(target)}, faster than the slider reaches.`;
    facts.append(p);
  }
}

function updateSliders() {
  $('view-beta').value = String(state.viewBeta);
  $('view-beta-out').textContent = fmtBeta(state.viewBeta);
  $('rocket-beta').value = String(state.rocketBeta);
  $('rocket-beta-out').textContent = fmtBeta(state.rocketBeta);
}

function refresh() {
  updateSliders();
  updateNote();
  updateEventList();
  updatePair();
  draw();
}

// --- events ----------------------------------------------------------------

function select(i) {
  state.selected = selectIndex(state.selected, i);
}

function removeEvent(i) {
  state.events.splice(i, 1);
  const next = afterRemoval(state, i);
  state.selected = next.selected;
  if (state.drag && !next.drag) {
    if (canvas.hasPointerCapture(state.drag.id)) canvas.releasePointerCapture(state.drag.id);
    canvas.classList.remove('dragging');
  }
  state.drag = next.drag;
}

function addEvent(point) {
  if (state.events.length >= MAX_EVENTS) return -1;
  state.events.push(fromView(clampToView(point), state.viewBeta));
  const i = state.events.length - 1;
  select(i);
  return i;
}

function clampToView(p) {
  const lim = HALF - 0.1;
  return { t: Math.max(-lim, Math.min(lim, p.t)), x: Math.max(-lim, Math.min(lim, p.x)) };
}

function pointerToCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
}

canvas.addEventListener('pointerdown', (e) => {
  const [px, py] = pointerToCanvas(e);
  let i = pick(state.events, state.viewBeta, view, px, py, 14);
  if (i < 0) i = addEvent(view.fromCanvas(px, py));
  if (i < 0) return;
  select(i);
  state.drag = { index: i, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  refresh();
});

canvas.addEventListener('pointermove', (e) => {
  const [px, py] = pointerToCanvas(e);
  if (!state.drag) {
    canvas.classList.toggle('over-event', pick(state.events, state.viewBeta, view, px, py, 14) >= 0);
    return;
  }
  state.events[state.drag.index] = fromView(clampToView(view.fromCanvas(px, py)), state.viewBeta);
  updatePair();
  updateEventList();
  draw();
});

function endDrag() {
  if (!state.drag) return;
  state.drag = null;
  canvas.classList.remove('dragging');
  refresh();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('keydown', (e) => {
  const active = state.selected[state.selected.length - 1];
  if (active === undefined) return;
  const moves = { ArrowUp: [NUDGE, 0], ArrowDown: [-NUDGE, 0], ArrowLeft: [0, -NUDGE], ArrowRight: [0, NUDGE] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dt, dx] = moves[e.key];
    const p = toView(state.events[active], state.viewBeta);
    state.events[active] = fromView(clampToView({ t: p.t + dt, x: p.x + dx }), state.viewBeta);
    refresh();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removeEvent(active);
    refresh();
  }
});

// Change of view: ease in rapidity, which is what adds up linearly between frames.
function lookFrom(beta) {
  const target = clampBeta(Math.max(-0.9, Math.min(0.9, beta)));
  if (state.tween) cancelAnimationFrame(state.tween.raf);
  if (reduceMotion.matches) {
    state.viewBeta = target;
    refresh();
    return;
  }
  const from = rapidity(state.viewBeta);
  const to = rapidity(target);
  const start = performance.now();
  const duration = 700;
  const tick = (now) => {
    const u = Math.min(1, (now - start) / duration);
    const ease = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    state.viewBeta = betaFromRapidity(from + (to - from) * ease);
    if (u < 1) {
      state.tween = { raf: requestAnimationFrame(tick) };
      refresh();
    } else {
      state.viewBeta = target;
      state.tween = null;
      refresh();
    }
  };
  state.tween = { raf: requestAnimationFrame(tick) };
}

$('view-beta').addEventListener('input', (e) => {
  if (state.tween) cancelAnimationFrame(state.tween.raf);
  state.tween = null;
  state.viewBeta = Number(e.target.value);
  refresh();
});
$('rocket-beta').addEventListener('input', (e) => {
  state.rocketBeta = Number(e.target.value);
  refresh();
});
$('view-lab').addEventListener('click', () => lookFrom(0));
$('view-rocket').addEventListener('click', () => lookFrom(state.rocketBeta));
$('boost-to').addEventListener('click', (e) => lookFrom(Number(e.currentTarget.dataset.beta)));
for (const id of ['show-lab-grid', 'show-rocket-grid', 'show-cone', 'show-sim', 'show-hyper']) {
  $(id).addEventListener('change', draw);
}
$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = Number($('add-t').value);
  const x = Number($('add-x').value);
  if (!Number.isFinite(t) || !Number.isFinite(x)) return;
  const i = addEvent({ t, x });
  $('add-status').textContent = i < 0
    ? `At most ${MAX_EVENTS} events; remove one first.`
    : `Added ${labelFor(i)}.`;
  refresh();
});
$('clear-events').addEventListener('click', () => {
  state.events = [];
  state.selected = [];
  refresh();
});
$('reset').addEventListener('click', () => {
  state.events = START.events.map((e) => ({ ...e }));
  state.selected = [0, 1];
  state.rocketBeta = START.rocket;
  lookFrom(0);
  refresh();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

refresh();
