import {
  leadChanges, falseRows, bellPath, rowString, bellChar,
} from './changes.js';
import { METHODS, methodById, STAGE_NAMES } from './methods.js';
import {
  blowTime, blowAt, intervalForPealSpeed, bellFrequency, PARTIALS,
} from './striking.js';
import { sheetLayout, fitSheet, cellCentre, columnsThatFit } from './sheet.js';
import { bellBlowTimes, matchWindow, matchPresses, strikingReport } from './ringer.js';
import {
  parseCalling, callingString, leadVariants, ringTouch, judgeTouch, extentSearch, factorial,
} from './touches.js';

const $ = (id) => document.getElementById(id);
const canvas = $('sheet');
const ctx = canvas.getContext('2d');

const state = {
  method: null,
  stage: 6,
  leadLength: 12,
  rows: [],
  complete: true,
  variants: null,
  calls: ['p'],
  leads: [],
  repeats: [],
  self: false,
  presses: [],
  selfInterval: 0,
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
    treble: css.getPropertyValue('--treble').trim(),
    now: css.getPropertyValue('--rule').trim(),
  };
}

function setMethod(method) {
  stop();
  cancelSearch();
  const changes = leadChanges(method.notation, method.stage);
  state.method = method;
  state.stage = method.stage;
  state.leadLength = changes.length;
  state.variants = leadVariants(changes, method.calls, method.stage);
  fillFollow();
  $('method-note').textContent = method.note;
  const callable = Boolean(state.variants.b || state.variants.s);
  $('touch').disabled = !callable;
  $('touch-help').textContent = callable
    ? `Bob: ${method.calls?.bob ?? 'none'} · Single: ${method.calls?.single ?? 'none'} in place of the lead's last change.`
    : 'This method has no calls here; only its plain course can be rung.';
  $('extent').disabled = !callable || method.stage > 6;
  ringCalling(['p']);
}

// Ring a calling (['p'] is the plain course) and show it.
function ringCalling(calls) {
  stop();
  const touch = ringTouch(state.variants, calls, state.stage);
  state.calls = calls;
  state.rows = touch.rows;
  state.complete = touch.complete;
  state.leads = touch.leads;
  state.repeats = falseRows(touch.rows);
  state.current = null;
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
  sel.value = String(state.follow);
}

function describe() {
  const { rows, stage, leadLength, complete, repeats, leads } = state;
  const verdict = judgeTouch({ rows, leads, complete }, stage);
  const plain = state.calls.length === 1 && state.calls[0] === 'p';
  const stageName = STAGE_NAMES[stage] ? `${stage} (${STAGE_NAMES[stage]})` : String(stage);
  const bobs = leads.filter((l) => l.call === 'b').length;
  const singles = leads.filter((l) => l.call === 's').length;
  let truth = 'yes, no row comes twice';
  if (repeats.length) {
    const r = repeats[0];
    truth = `no: ${repeats.length} repeated ${repeats.length === 1 ? 'row' : 'rows'}, first ${r.row} at rows ${r.first} and ${r.again}`;
  }
  const facts = [
    ['Bells', stageName],
    ['Rows in a lead', leadLength],
    ['Leads', complete ? leads.length : `over ${leads.length}`],
    ['Rows before rounds', complete ? verdict.changes : `over ${verdict.changes}`],
    ['Calls', plain ? 'none: the plain course' : `${bobs} ${bobs === 1 ? 'bob' : 'bobs'}, ${singles} ${singles === 1 ? 'single' : 'singles'}`],
    ['True', truth],
    ['Every row once', verdict.extent ? `yes: all ${verdict.changes} rows, an extent` : `no (an extent is ${factorial(stage)} rows)`],
  ];
  $('readout-title').textContent = plain ? 'The plain course' : 'The touch';
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
  const callAt = new Map(leads.map((l) => [l.end, l.call]));
  const twice = new Set(repeats.flatMap((r) => [r.first, r.again]));
  $('rows-text').textContent = rows.map((r, i) => {
    let mark = '';
    if (callAt.has(i)) mark += callAt.get(i) === 'b' ? '  bob' : callAt.get(i) === 's' ? '  single' : '  lead head';
    if (twice.has(i)) mark += '  repeated';
    return rowString(r) + mark;
  }).join('\n');
  $('now').textContent = complete ? '' : 'Rounds had not come back after 5040 rows; only those rows are drawn.';
}

function draw() {
  const { rows, stage, leadLength } = state;
  const box = canvas.parentElement.clientWidth || 640;
  const layout = sheetLayout(rows.length, leadLength, columnsThatFit(stage, box - 24));
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
  const at = (cell, place) => cellCentre(fit, stage, cell.column, cell.line, place, cell.band);
  const rowBox = (cell) => {
    const [x0, y] = at(cell, 0);
    return [x0 - fit.cell / 2, y - fit.lineHeight / 2, stage * fit.cell, fit.lineHeight];
  };

  if (state.current) {
    for (const cell of layout.cells.filter((x) => x.index === state.current.row)) {
      ctx.fillStyle = c.now;
      ctx.fillRect(...rowBox(cell));
    }
  }

  // rows rung twice get a red frame in both places
  const twice = new Set(state.repeats.flatMap((r) => [r.first, r.again]));
  ctx.strokeStyle = c.treble;
  ctx.lineWidth = 1.5;
  for (const cell of layout.cells.filter((x) => twice.has(x.index))) ctx.strokeRect(...rowBox(cell));

  const lines = [];
  if ($('show-treble').checked && state.follow !== 1) lines.push({ bell: 1, colour: c.treble, width: 1.5 });
  lines.push({ bell: state.follow, colour: c.line, width: 2.5 });

  const font = `${Math.round(fit.cell * 0.95)}px ui-monospace, Consolas, monospace`;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const callAt = new Map(state.leads.map((l) => [l.end, l.call]));
  for (const cell of layout.cells) {
    const row = rows[cell.index];
    const atHead = cell.line === 0 || cell.line === leadLength;
    for (let place = 0; place < stage; place++) {
      const bell = row[place];
      const onLine = lines.some((l) => l.bell === bell);
      if (onLine || (!showNumbers && !atHead)) continue;
      const [x, y] = at(cell, place);
      ctx.fillStyle = atHead ? c.ink : c.muted;
      ctx.fillText(bellChar(bell), x, y);
    }
    if (cell.line === leadLength) {
      const [x0, y, width] = rowBox(cell);
      ctx.strokeStyle = c.rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + width, y);
      ctx.stroke();
      const call = callAt.get(cell.index);
      if (call === 'b' || call === 's') {
        const [xc, yc] = at(cell, stage);
        ctx.fillStyle = c.ink;
        ctx.font = `bold ${font}`;
        ctx.fillText(call === 'b' ? '–' : 's', xc - fit.cell * 0.1, yc);
        ctx.font = font;
      }
    }
  }

  for (const line of lines) {
    const path = bellPath(rows, line.bell);
    ctx.strokeStyle = line.colour;
    ctx.lineWidth = line.width;
    ctx.lineJoin = 'round';
    for (let lead = 0; lead < layout.leads; lead++) {
      const cells = layout.cells.filter((x) => x.lead === lead);
      ctx.beginPath();
      cells.forEach((cell, k) => {
        const [x, y] = at(cell, path[cell.index]);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    // label the line with its bell at the top of each column
    ctx.fillStyle = line.colour;
    ctx.font = `bold ${font}`;
    for (const cell of layout.cells.filter((x) => x.line === 0)) {
      const [x, y] = at(cell, path[cell.index]);
      ctx.clearRect(x - fit.cell * 0.4, y - fit.lineHeight * 0.45, fit.cell * 0.8, fit.lineHeight * 0.9);
      ctx.fillText(bellChar(line.bell), x, y);
    }
    ctx.font = font;
  }

  if (state.current) {
    const { row, place } = state.current;
    const cell = layout.cells.find((x) => x.index === row && (x.line < leadLength || row === rows.length - 1));
    if (cell) {
      const [x, y] = at(cell, place);
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, fit.cell * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// --- touches -------------------------------------------------------------------

let search = null;

function cancelSearch() {
  if (search) cancelAnimationFrame(search.frame);
  search = null;
  $('extent').textContent = 'Find a true extent';
}

function ringTouchFromInput() {
  const err = $('touch-error');
  err.textContent = '';
  try {
    const calls = parseCalling($('calling').value);
    if (calls.length === 0) throw new Error('Type a calling first, such as ppp- or -s.');
    ringCalling(calls);
  } catch (e) {
    err.textContent = e.message;
  }
}

function findExtent() {
  if (search) {
    cancelSearch();
    $('touch-error').textContent = 'Search stopped.';
    return;
  }
  stop();
  $('touch-error').textContent = '';
  const runner = extentSearch(state.variants, state.stage);
  search = { runner, frame: 0 };
  $('extent').textContent = 'Stop searching';
  const slice = () => {
    if (!search) return;
    const r = runner.step(4000);
    if (!r.done) {
      $('touch-error').textContent = `Searching: ${r.nodes} leads tried, ${r.depth} leads deep.`;
      search.frame = requestAnimationFrame(slice);
      return;
    }
    cancelSearch();
    if (r.found) {
      $('calling').value = callingString(r.found);
      $('touch-error').textContent = `Found after trying ${r.nodes} leads.`;
      ringCalling(r.found);
    } else {
      $('touch-error').textContent = 'No extent can be made from these leads and calls.';
    }
  };
  slice();
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
  // heavier rings sound lower: the tenor of eight is a fourth below that of six
  const tenorHz = 392 * 2 ** (-(state.stage - 5) * 2.5 / 12);
  const nominal = bellFrequency(bell, state.stage, tenorHz);
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
    const bell = state.rows[row][place];
    if (!(state.self && bell === state.follow)) strike(bell, Math.max(t, audio.currentTime));
    scheduledUpTo += 1;
  }
}

function tick() {
  if (!state.playing) return;
  schedule();
  const elapsed = now() - state.startTime;
  const pos = blowAt(elapsed, state.stage, interval());
  if (pos.row >= state.rows.length) {
    const wasSelf = state.self;
    stop();
    const plain = state.calls.length === 1 && state.calls[0] === 'p';
    $('now').textContent = state.complete
      ? `Rounds again: the ${plain ? 'plain course' : 'touch'} is complete.`
      : 'Stopped at the row limit before rounds came back.';
    if (wasSelf) {
      // the course is over: every blow not struck by now is missed
      showStriking(Infinity);
      $('striking-final').textContent = `Finished. ${$('striking').textContent}`;
    }
    return;
  }
  // in the handstroke gap the last blow rung stays marked
  if (pos.inGap) {
    frame = requestAnimationFrame(tick);
    return;
  }
  const changed = !state.current || state.current.row !== pos.row || state.current.place !== pos.place;
  if (changed) {
    state.current = { row: pos.row, place: pos.place };
    draw();
    const lead = Math.floor(Math.max(pos.row - 1, 0) / state.leadLength) + 1;
    $('now').textContent = `Row ${pos.row} of ${state.rows.length - 1}, lead ${lead}: ${rowString(state.rows[pos.row])}`;
    if (state.self) showStriking(elapsed);
  }
  frame = requestAnimationFrame(tick);
}

function play() {
  ensureAudio();
  if (audio && audio.state === 'suspended') audio.resume();
  state.playing = true;
  scheduledUpTo = 0;
  state.self = $('self').checked;
  state.presses = [];
  state.selfInterval = interval();
  $('speed').disabled = state.self;
  $('striking-final').textContent = '';
  if (state.self) showStriking(0);
  // ringing yourself gets a moment to get ready
  state.startTime = now() + (state.self ? 1.5 : 0.15);
  $('play').textContent = 'Stand';
  $('play').setAttribute('aria-pressed', 'true');
  frame = requestAnimationFrame(tick);
}

// Silence every blow already queued, by swapping in a fresh output.
function cutQueued() {
  if (!master || !audio) return;
  master.disconnect();
  master = audio.createGain();
  master.gain.value = $('sound').checked ? 0.5 : 0;
  master.connect(audio.destination);
}

function stop() {
  state.playing = false;
  cancelAnimationFrame(frame);
  cutQueued();
  $('speed').disabled = false;
  $('play').textContent = 'Ring';
  $('play').setAttribute('aria-pressed', 'false');
}

// --- ringing a bell yourself ---------------------------------------------------

function selfBlows() {
  return bellBlowTimes(state.rows, state.follow, state.selfInterval);
}

function showStriking(elapsed) {
  const dt = state.selfInterval;
  const window = matchWindow(state.stage, dt);
  const blows = selfBlows();
  const r = strikingReport(blows, matchPresses(blows, state.presses, window), dt, window, elapsed);
  const parts = [`${r.good} good`, `${r.early} early`, `${r.late} late`, `${r.missed} missed`];
  if (r.extras) parts.push(`${r.extras} extra`);
  const mean = r.meanError === null ? '' : ` · ${Math.round(r.meanError * 1000)} ms off on average`;
  $('striking').textContent = `Your blows: ${parts.join(', ')}${mean}.`;
}

let lastPull = -Infinity;

function pull() {
  if (!state.playing || !state.self) return;
  // one physical press can arrive as pointerdown, keydown and click; real
  // blows of one bell are always more than a second apart
  if (performance.now() - lastPull < 250) return;
  lastPull = performance.now();
  ensureAudio();
  if (audio) strike(state.follow, audio.currentTime);
  state.presses.push(now() - state.startTime);
  showStriking(now() - state.startTime);
}

function showSelfControls() {
  const on = $('self').checked;
  $('pull').hidden = !on;
  $('self-help').hidden = !on;
  $('striking').hidden = !on;
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
    if (state.playing && state.self) stop();
    state.follow = Number($('follow').value);
    draw();
  });
  $('show-treble').addEventListener('change', draw);
  $('show-numbers').addEventListener('change', draw);

  $('play').addEventListener('click', () => (state.playing ? stop() : play()));
  $('self').addEventListener('change', () => {
    if (state.playing) stop();
    showSelfControls();
  });
  $('pull').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pull();
  });
  $('pull').addEventListener('click', pull);
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || !state.playing || !state.self) return;
    if (e.target.matches?.('input[type="text"], input[type="number"], textarea, select')) return;
    e.preventDefault();
    if (!e.repeat) pull();
  });
  $('sound').addEventListener('change', () => {
    if (master) master.gain.value = $('sound').checked ? 0.5 : 0;
  });
  $('speed').addEventListener('input', () => {
    showSpeed();
    if (state.playing) {
      // keep the current blow where it is when the pace changes
      const cur = state.current;
      if (cur) state.startTime = now() - blowTime(cur.row, cur.place, state.stage, interval());
      cutQueued();
      scheduledUpTo = cur ? cur.row * state.stage + cur.place + 1 : 0;
    }
  });

  $('custom-ring').addEventListener('click', ringCustom);
  $('touch').addEventListener('click', ringTouchFromInput);
  $('calling').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ringTouchFromInput();
  });
  $('plain').addEventListener('click', () => {
    cancelSearch();
    $('touch-error').textContent = '';
    ringCalling(['p']);
  });
  $('extent').addEventListener('click', findExtent);
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
