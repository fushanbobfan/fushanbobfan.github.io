import { deferredAcceptance, flip, replay } from './matching.js';
import { SCENES, sceneById, LEFT_NAMES, RIGHT_NAMES } from './scenes.js';
import { renderBoard, narrate, boardHeight, WIDTH, preferenceTable } from './board.js';
import { compareProposers, summarize, renderComparison } from './results.js';
import { emptyHand, setPair, handVerdict, stableTable } from './hand.js';
import { moveChoice, encodeLink, decodeLink } from './link.js';

const $ = (id) => document.getElementById(id);
const board = $('board');

const state = {
  sceneId: 'random',
  n: 6,
  seed: 1,
  proposer: 'left',
  prefs: null,
  events: [],
  step: 0,
  timer: 0,
  mode: 'watch',
  hand: [],
  selected: null,
  stable: [],
};

const names = () => ({ left: LEFT_NAMES.slice(0, state.n), right: RIGHT_NAMES.slice(0, state.n) });

const CUSTOM = 'custom';

function deal() {
  if (state.sceneId === CUSTOM) chooseScene('random');
  useLists(sceneById(state.sceneId).make(state.n, state.seed));
}

// Install a set of lists: the run, the hand pairing, the tables and the link all start from them.
function useLists(prefs, keepHand = false) {
  state.prefs = prefs;
  state.n = prefs.left.length;
  $('size').value = state.n;
  $('size-out').textContent = state.n;
  $('pref-table').innerHTML = preferenceTable(names(), state.prefs);
  if (!keepHand) state.hand = emptyHand(state.n);
  state.selected = null;
  rerun();
  renderResults();
}

function chooseScene(id) {
  state.sceneId = id;
  $('scene').value = id;
  $('scene-blurb').textContent = id === CUSTOM
    ? 'Lists you have edited or opened from a link. Pick a scene or deal to start again.'
    : sceneById(id).blurb;
}

function markCustom() {
  const select = $('scene');
  if (![...select.options].some((o) => o.value === CUSTOM)) select.add(new Option('Your own lists', CUSTOM));
  chooseScene(CUSTOM);
}

function writeLink() {
  const link = encodeLink({ prefs: state.prefs, proposer: state.proposer, mode: state.mode });
  history.replaceState(null, '', `#${link}`);
}

function rerun() {
  stop();
  // Events are numbered in the proposing side's terms; prefs stay in left/right terms everywhere else.
  const prefs = state.proposer === 'left' ? state.prefs : flip(state.prefs);
  state.events = deferredAcceptance(prefs).events;
  state.step = 0;
  draw();
}

function draw() {
  writeLink();
  if (state.mode === 'hand') { drawHand(); return; }
  if (state.mode === 'edit') { drawEdit(); return; }
  board.setAttribute('role', 'img');
  board.setAttribute('aria-labelledby', 'narration');
  board.removeAttribute('aria-label');
  const { holding, asked } = replay(state.n, state.events, state.step);
  const current = state.step > 0 ? state.events[state.step - 1] : null;
  const { height, markup } = renderBoard({
    names: names(),
    prefs: state.prefs,
    proposer: state.proposer,
    holding,
    asked,
    current,
  });
  board.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
  board.innerHTML = markup;

  const done = state.step >= state.events.length;
  let text = narrate(current, names(), state.proposer, state.prefs);
  if (done) text += ` Everyone is held, so the held offers are the pairing. It took ${state.events.length} proposals.`;
  $('narration').textContent = text;
  $('counter').textContent = `Proposal ${state.step} of ${state.events.length}`;
  $('back').disabled = state.step === 0;
  $('reset').disabled = state.step === 0;
  $('step').disabled = done;
  $('finish').disabled = done;
  $('play').disabled = done;
  $('play').textContent = state.timer ? 'Pause' : 'Play';
}

function drawHand() {
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('#board [data-side]');
  const keep = focused ? `[data-side="${focused.dataset.side}"][data-k="${focused.dataset.k}"]` : null;
  const verdict = handVerdict(state.prefs, state.hand, names());
  const holding = new Array(state.n).fill(-1);
  state.hand.forEach((r, i) => { if (r >= 0) holding[r] = i; });
  const { height, markup } = renderBoard({
    names: names(),
    prefs: state.prefs,
    proposer: 'left',
    holding,
    asked: new Array(state.n).fill(0),
    current: null,
    blocking: verdict.pairs,
    titles: { left: 'Left', right: 'Right' },
    selected: state.selected,
    interactive: true,
  });
  board.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
  board.setAttribute('role', 'group');
  board.removeAttribute('aria-labelledby');
  board.setAttribute('aria-label', 'Everyone on both sides. Pick one person on each side to pair them.');
  board.innerHTML = markup;
  if (keep) board.querySelector(keep)?.focus();
  $('narration').textContent = verdict.text;
  const paired = state.hand.filter((r) => r >= 0).length;
  $('hand-count').textContent = `${paired} of ${state.n} pairs made`;
  $('clear-hand').disabled = paired === 0;
}

function drawEdit() {
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('#board [data-chip-side]');
  const keep = focused ? { side: focused.dataset.chipSide, row: focused.dataset.row, pos: state.keepPos ?? focused.dataset.pos } : null;
  state.keepPos = null;
  const { holding } = replay(state.n, state.events, state.events.length);
  const { height, markup } = renderBoard({
    names: names(),
    prefs: state.prefs,
    proposer: state.proposer,
    holding,
    asked: new Array(state.n).fill(0),
    current: null,
    editable: true,
  });
  board.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
  board.setAttribute('role', 'group');
  board.removeAttribute('aria-labelledby');
  board.setAttribute('aria-label', "Everyone's preference lists. Each name is a button that moves it along the list.");
  board.innerHTML = markup;
  if (keep) board.querySelector(`[data-chip-side="${keep.side}"][data-row="${keep.row}"][data-pos="${keep.pos}"]`)?.focus();
  $('narration').textContent = `The lines show the pairing when the ${state.proposer} side proposes, `
    + `found in ${state.events.length} proposals. Change a list and watch it update.`;
}

function edit(side, row, pos, delta) {
  const moved = moveChoice(state.prefs, side, row, pos, delta);
  if (moved.prefs === state.prefs) return;
  state.keepPos = moved.pos;
  state.customPrefs = moved.prefs;
  markCustom();
  useLists(moved.prefs, true);
}

function pick(side, k) {
  if (!state.selected || state.selected.side === side) {
    state.selected = state.selected && state.selected.side === side && state.selected.k === k ? null : { side, k };
  } else {
    const l = side === 'left' ? k : state.selected.k;
    const r = side === 'right' ? k : state.selected.k;
    state.hand = setPair(state.hand, l, r);
    state.selected = null;
  }
  drawHand();
}

function setMode(mode) {
  stop();
  state.mode = mode;
  for (const radio of document.querySelectorAll('input[name="mode"]')) radio.checked = radio.value === mode;
  $('transport').hidden = mode !== 'watch';
  $('hand-tools').hidden = mode !== 'hand';
  $('edit-tools').hidden = mode !== 'edit';
  $('watch-legend').hidden = mode !== 'watch';
  $('hand-legend').hidden = mode !== 'hand';
  $('proposer-set').disabled = mode === 'hand';
  draw();
}

function renderStable() {
  state.stable = stableTable(state.prefs);
  const count = state.stable.length;
  $('stable-summary').textContent = count === 1
    ? 'These lists allow only one stable pairing.'
    : `These lists allow ${count} stable pairings, from best for the left (top) to best for the right (bottom), ordered by the left side's average.`;
  const n = names();
  $('stable-list').innerHTML = state.stable.map((row, k) => {
    const pairs = row.match.map((r, i) => `${n.left[i]}–${n.right[r]}`).join(', ');
    let tag = '';
    if (count > 1 && k === 0) tag = ' <strong>Left proposing finds this one.</strong>';
    if (count > 1 && k === count - 1) tag = ' <strong>Right proposing finds this one.</strong>';
    if (count === 1) tag = ' <strong>Either side proposing finds it.</strong>';
    return `<li><span class="pairs">${pairs}</span>`
      + `<span class="averages">Average choice: left ${row.leftAverage.toFixed(2)}, right ${row.rightAverage.toFixed(2)}.${tag}</span>`
      + `<button type="button" data-stable="${k}">Show on the board</button></li>`;
  }).join('');
}

function renderResults() {
  renderStable();
  const cmp = compareProposers(state.prefs);
  $('results-summary').textContent = summarize(cmp);
  $('results').innerHTML = renderComparison(cmp, names(), state.proposer);
}

function delay() {
  const speed = Number($('speed').value);
  return Math.round(1600 / speed);
}

function tick() {
  if (state.step >= state.events.length) { stop(); draw(); return; }
  state.step++;
  draw();
  state.timer = setTimeout(tick, delay());
}

function stop() {
  clearTimeout(state.timer);
  state.timer = 0;
}

function play() {
  if (state.timer) { stop(); draw(); return; }
  if (state.step >= state.events.length) state.step = 0;
  state.timer = setTimeout(tick, 0);
  draw();
}

function setup() {
  const sceneSelect = $('scene');
  for (const s of SCENES) sceneSelect.add(new Option(s.name, s.id));
  sceneSelect.value = state.sceneId;
  $('scene-blurb').textContent = sceneById(state.sceneId).blurb;
  $('size').value = state.n;
  $('size-out').textContent = state.n;
  board.setAttribute('viewBox', `0 0 ${WIDTH} ${boardHeight(state.n)}`);

  sceneSelect.addEventListener('change', () => {
    if (sceneSelect.value === CUSTOM) {
      // Back to the lists last edited or opened from a link.
      chooseScene(CUSTOM);
      useLists(state.customPrefs);
      return;
    }
    chooseScene(sceneSelect.value);
    deal();
  });
  $('size').addEventListener('input', () => {
    state.n = Number($('size').value);
    $('size-out').textContent = state.n;
    deal();
  });
  $('deal').addEventListener('click', () => {
    state.seed = (state.seed * 7919 + 13) % 1000003;
    if (state.sceneId === 'agree' || state.sceneId === 'cyclic') chooseScene('random');
    deal();
  });
  for (const radio of document.querySelectorAll('input[name="proposer"]')) {
    radio.addEventListener('change', () => {
      state.proposer = radio.value;
      rerun();
      renderResults();
    });
  }
  $('step').addEventListener('click', () => { stop(); state.step++; draw(); });
  $('back').addEventListener('click', () => { stop(); state.step = Math.max(0, state.step - 1); draw(); });
  $('reset').addEventListener('click', () => { stop(); state.step = 0; draw(); });
  $('finish').addEventListener('click', () => { stop(); state.step = state.events.length; draw(); });
  $('play').addEventListener('click', play);

  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener('change', () => setMode(radio.value));
  }
  board.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip-side]');
    if (chip) { edit(chip.dataset.chipSide, Number(chip.dataset.row), Number(chip.dataset.pos), -1); return; }
    const g = e.target.closest('[data-side]');
    if (g) pick(g.dataset.side, Number(g.dataset.k));
  });
  board.addEventListener('keydown', (e) => {
    const chip = e.target.closest('[data-chip-side]');
    if (chip) {
      const delta = { ArrowLeft: -1, Enter: -1, ' ': -1, ArrowRight: 1 }[e.key];
      if (!delta) return;
      e.preventDefault();
      edit(chip.dataset.chipSide, Number(chip.dataset.row), Number(chip.dataset.pos), delta);
      return;
    }
    const g = e.target.closest('[data-side]');
    if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    pick(g.dataset.side, Number(g.dataset.k));
  });
  $('clear-hand').addEventListener('click', () => {
    state.hand = emptyHand(state.n);
    state.selected = null;
    drawHand();
  });
  $('stable-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stable]');
    if (!b) return;
    state.hand = state.stable[Number(b.dataset.stable)].match.slice();
    state.selected = null;
    setMode('hand');
    board.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  $('copy-link').addEventListener('click', async () => {
    writeLink();
    try {
      await navigator.clipboard.writeText(location.href);
      $('copy-status').textContent = 'Link copied.';
    } catch {
      $('copy-status').textContent = 'Copy the address bar to share these lists.';
    }
  });
  window.addEventListener('hashchange', () => openLink(location.hash));

  if (!openLink(location.hash)) deal();
}

// Open lists from a link; returns false when the link does not hold valid lists.
function openLink(hash) {
  const opened = decodeLink(hash);
  if (!opened) return false;
  state.customPrefs = opened.prefs;
  markCustom();
  state.proposer = opened.proposer;
  for (const radio of document.querySelectorAll('input[name="proposer"]')) radio.checked = radio.value === opened.proposer;
  state.mode = opened.mode;
  useLists(opened.prefs);
  setMode(opened.mode);
  return true;
}

setup();
