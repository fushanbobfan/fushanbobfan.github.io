import {
  leadChanges, plainCourse, falseRows, bellPath, rowString, bellChar,
} from './changes.js';
import { METHODS, methodById, STAGE_NAMES } from './methods.js';
import {
  blowTime, blowAt, intervalForPealSpeed, bellFrequency, PARTIALS,
} from './striking.js';
import { sheetLayout, fitSheet, cellCentre } from './sheet.js';

const $ = (id) => document.getElementById(id);
const canvas = $('sheet');
const ctx = canvas.getContext('2d');

const state = {
  method: null,
  stage: 6,
  leadLength: 12,
  rows: [],
  complete: true,
  follow: 2,
  playing: false,
  startTime: 0,
  current: null,
};

let audio = null;
let master = null;
let scheduledUpTo = 0;
let frame = 0;

function colours() {
  const css = getComputedStyle(document.documentElement);
  return {
    ink: css.getPropertyValue('--ink').trim(),
    muted: css.getPropertyValue('--muted').trim(),
    rule: css.getPropertyValue('--rule').trim(),
    line: css.getPropertyValue('--accent').trim(),
    treble: '#c0392b',
    now: css.getPropertyValue('--rule').trim(),
  };
}

function setMethod(method) {
  stop();
  const changes = leadChanges(method.notation, method.stage);
  const course = plainCourse(changes, method.stage);
  state.method = method;
  state.stage = method.stage;
  state.leadLength = changes.length;
  state.rows = course.rows;
  state.complete = course.complete;
  state.leadHeads = course.leadHeads;
  state.current = null;
  fillFollow();
  $('method-note').textContent = method.note;
  describe();
  draw();
}

function fillFollow() {
  const sel = $('follow');
  const keep = Number(sel.value) || state.follow;
  sel.innerHTML = '';
  for (let b = 1; b <= state.stage; b++) {
    const label = b === 1 ? 'Treble (1)' : b === state.stage ? `Tenor (${bellChar(b)})` : `Bell ${bellChar(b)}`;
    sel.add(new Option(label, String(b)));
  }
  state.follow = Math.min(Math.max(keep, 1), state.stage);
  if (state.follow === 1 && state.stage > 1) state.follow = 2;
  sel.value = String(state.follow);
}

function describe() {
  const { rows, stage, leadLength, complete } = state;
  const changes = rows.length - 1;
  const repeats = falseRows(rows);
  const stageName = STAGE_NAMES[stage] ? `${stage} (${STAGE_NAMES[stage]})` : String(stage);
  const facts = [
    ['Bells', stageName],
    ['Rows in a lead', leadLength],
    ['Leads', complete ? Math.round(changes / leadLength) : 'more than shown'],
    ['Rows before rounds', complete ? changes : `over ${changes}`],
    ['True', repeats.length === 0 ? 'yes, no row comes twice' : `no, ${repeats.length} rows repeat`],
    ['Lead heads', state.leadHeads.slice(1).map(rowString).join(' ') || 'none'],
  ];
  const list = $('facts');
  list.innerHTML = '';
  for (const [k, v] of facts) {
    const li = document.createElement('li');
    const a = document.createElement('span');
    const b = document.createElement('span');
    a.textContent = k;
    b.textContent = v;
    li.append(a, b);
    list.append(li);
  }
  $('rows-text').textContent = rows.map((r, i) => {
    const mark = i > 0 && i % leadLength === 0 ? '  lead head' : '';
    return rowString(r) + mark;
  }).join('\n');
  $('now').textContent = complete ? '' : 'This course is longer than the 5040 rows shown; only the start is drawn.';
}

function draw() {
  const { rows, stage, leadLength } = state;
  const layout = sheetLayout(rows.length, leadLength);
  const box = canvas.parentElement.clientWidth || 640;
  const fit = fitSheet(layout, stage, box - 24);
  const dpr = window.devicePixelRatio || 1;
  const w = fit.width + 24;
  const h = fit.height + 12;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 12 * dpr, 6 * dpr);
  ctx.clearRect(-12, -6, w, h);
  const c = colours();
  const showNumbers = $('show-numbers').checked;

  if (state.current) {
    for (const cell of layout.cells.filter((x) => x.index === state.current.row)) {
      const [x0, y] = cellCentre(fit, stage, cell.column, cell.line, 0);
      ctx.fillStyle = c.now;
      ctx.fillRect(x0 - fit.cell / 2, y - fit.lineHeight / 2, stage * fit.cell, fit.lineHeight);
    }
  }

  const lines = [];
  if ($('show-treble').checked && state.follow !== 1) lines.push({ bell: 1, colour: c.treble, width: 1.5 });
  lines.push({ bell: state.follow, colour: c.line, width: 2.5 });

  ctx.font = `${Math.round(fit.cell * 0.95)}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const cell of layout.cells) {
    const row = rows[cell.index];
    const atHead = cell.line === 0 || cell.line === leadLength;
    for (let place = 0; place < stage; place++) {
      const bell = row[place];
      const onLine = lines.some((l) => l.bell === bell);
      if (onLine || (!showNumbers && !atHead)) continue;
      const [x, y] = cellCentre(fit, stage, cell.column, cell.line, place);
      ctx.fillStyle = atHead ? c.ink : c.muted;
      ctx.fillText(bellChar(bell), x, y);
    }
    if (cell.line === leadLength) {
      const [x0, y] = cellCentre(fit, stage, cell.column, cell.line, 0);
      ctx.strokeStyle = c.rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 - fit.cell / 2, y - fit.lineHeight / 2);
      ctx.lineTo(x0 - fit.cell / 2 + stage * fit.cell, y - fit.lineHeight / 2);
      ctx.stroke();
    }
  }

  for (const line of lines) {
    const path = bellPath(rows, line.bell);
    ctx.strokeStyle = line.colour;
    ctx.lineWidth = line.width;
    ctx.lineJoin = 'round';
    for (let col = 0; col < layout.columns; col++) {
      const cells = layout.cells.filter((x) => x.column === col);
      ctx.beginPath();
      cells.forEach((cell, k) => {
        const [x, y] = cellCentre(fit, stage, col, cell.line, path[cell.index]);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    // label the line with its bell at the top of each column
    ctx.fillStyle = line.colour;
    ctx.font = `bold ${Math.round(fit.cell * 0.95)}px ui-monospace, Consolas, monospace`;
    for (const cell of layout.cells.filter((x) => x.line === 0)) {
      const [x, y] = cellCentre(fit, stage, cell.column, 0, path[cell.index]);
      ctx.clearRect(x - fit.cell * 0.4, y - fit.lineHeight * 0.45, fit.cell * 0.8, fit.lineHeight * 0.9);
      ctx.fillText(bellChar(line.bell), x, y);
    }
    ctx.font = `${Math.round(fit.cell * 0.95)}px ui-monospace, Consolas, monospace`;
  }

  if (state.current) {
    const { row, place } = state.current;
    const cell = layout.cells.find((x) => x.index === row && (x.line < leadLength || row === rows.length - 1));
    if (cell) {
      const [x, y] = cellCentre(fit, stage, cell.column, cell.line, place);
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, fit.cell * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// --- sound -----------------------------------------------------------------

function ensureAudio() {
  if (audio) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  audio = new Ctor();
  master = audio.createGain();
  master.gain.value = $('sound').checked ? 0.5 : 0;
  master.connect(audio.destination);
}

function strike(bell, when) {
  const trebleHz = 1100 * 2 ** (-(12 - state.stage) / 24);
  const nominal = bellFrequency(bell, trebleHz);
  const level = 0.11;
  for (const p of PARTIALS) {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.frequency.value = nominal * p.ratio;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(p.gain * level, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + p.decay * 1.4);
    osc.connect(g).connect(master);
    osc.start(when);
    osc.stop(when + p.decay * 1.4 + 0.05);
  }
}

function interval() {
  return intervalForPealSpeed(Number($('speed').value), state.stage);
}

function now() {
  return audio ? audio.currentTime : performance.now() / 1000;
}

function schedule() {
  if (!audio) return;
  const horizon = now() + 0.4;
  const dt = interval();
  while (scheduledUpTo < state.rows.length * state.stage) {
    const row = Math.floor(scheduledUpTo / state.stage);
    const place = scheduledUpTo % state.stage;
    const t = state.startTime + blowTime(row, place, state.stage, dt);
    if (t > horizon) break;
    strike(state.rows[row][place], Math.max(t, audio.currentTime));
    scheduledUpTo += 1;
  }
}

function tick() {
  if (!state.playing) return;
  schedule();
  const elapsed = now() - state.startTime;
  const pos = blowAt(elapsed, state.stage, interval());
  if (pos.row >= state.rows.length) {
    stop();
    $('now').textContent = 'Rounds again: the plain course is complete.';
    return;
  }
  const changed = !state.current || state.current.row !== pos.row || state.current.place !== pos.place;
  if (changed) {
    state.current = { row: pos.row, place: pos.place };
    draw();
    const lead = Math.floor(Math.max(pos.row - 1, 0) / state.leadLength) + 1;
    $('now').textContent = `Row ${pos.row} of ${state.rows.length - 1}, lead ${lead}: ${rowString(state.rows[pos.row])}`;
  }
  frame = requestAnimationFrame(tick);
}

function play() {
  ensureAudio();
  if (audio && audio.state === 'suspended') audio.resume();
  state.playing = true;
  scheduledUpTo = 0;
  state.startTime = now() + 0.15;
  $('play').textContent = 'Stand';
  $('play').setAttribute('aria-pressed', 'true');
  frame = requestAnimationFrame(tick);
}

function stop() {
  state.playing = false;
  cancelAnimationFrame(frame);
  if (master && audio) {
    master.disconnect();
    master = audio.createGain();
    master.gain.value = $('sound').checked ? 0.5 : 0;
    master.connect(audio.destination);
  }
  $('play').textContent = 'Ring';
  $('play').setAttribute('aria-pressed', 'false');
}

// --- controls ----------------------------------------------------------------

function showSpeed() {
  const hours = Number($('speed').value);
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const perBlow = interval();
  $('speed-out').textContent = `${h} h ${String(m).padStart(2, '0')} min peal · ${(1 / perBlow).toFixed(1)} blows a second`;
}

function init() {
  const sel = $('method');
  for (const m of METHODS) sel.add(new Option(m.name, m.id));
  sel.value = 'plain-bob-minor';
  sel.addEventListener('change', () => setMethod(methodById(sel.value)));

  $('follow').addEventListener('change', () => {
    state.follow = Number($('follow').value);
    draw();
  });
  $('show-treble').addEventListener('change', draw);
  $('show-numbers').addEventListener('change', draw);

  $('play').addEventListener('click', () => (state.playing ? stop() : play()));
  $('sound').addEventListener('change', () => {
    if (master) master.gain.value = $('sound').checked ? 0.5 : 0;
  });
  $('speed').addEventListener('input', () => {
    showSpeed();
    if (state.playing) {
      // keep the current blow where it is when the pace changes
      const cur = state.current;
      if (cur) state.startTime = now() - blowTime(cur.row, cur.place, state.stage, interval());
      scheduledUpTo = cur ? cur.row * state.stage + cur.place + 1 : 0;
    }
  });

  $('custom-ring').addEventListener('click', ringCustom);
  $('custom-notation').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ringCustom();
  });

  window.addEventListener('resize', draw);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);

  showSpeed();
  setMethod(methodById(sel.value));
}

function ringCustom() {
  const stage = Number($('custom-stage').value);
  const notation = $('custom-notation').value;
  const err = $('custom-error');
  err.textContent = '';
  if (!Number.isInteger(stage) || stage < 3 || stage > 12) {
    err.textContent = 'Choose between 3 and 12 bells.';
    return;
  }
  try {
    leadChanges(notation, stage);
  } catch (e) {
    err.textContent = e.message;
    return;
  }
  const known = METHODS.find((m) => m.stage === stage && m.notation.replace(/\s/g, '') === notation.replace(/\s/g, ''));
  $('method').value = known ? known.id : '';
  setMethod(known ?? {
    id: 'custom',
    name: 'Your method',
    stage,
    notation,
    note: `Your method on ${stage} bells: ${notation}.`,
  });
}

init();
