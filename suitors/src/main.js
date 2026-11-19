import { deferredAcceptance, flip, replay } from './matching.js';
import { SCENES, sceneById, LEFT_NAMES, RIGHT_NAMES } from './scenes.js';
import { renderBoard, narrate, boardHeight, WIDTH } from './board.js';
import { compareProposers, summarize, renderComparison } from './results.js';

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
};

const names = () => ({ left: LEFT_NAMES.slice(0, state.n), right: RIGHT_NAMES.slice(0, state.n) });

function deal() {
  state.prefs = sceneById(state.sceneId).make(state.n, state.seed);
  rerun();
  renderResults();
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

function renderResults() {
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
    state.sceneId = sceneSelect.value;
    $('scene-blurb').textContent = sceneById(state.sceneId).blurb;
    deal();
  });
  $('size').addEventListener('input', () => {
    state.n = Number($('size').value);
    $('size-out').textContent = state.n;
    deal();
  });
  $('deal').addEventListener('click', () => {
    state.seed = (state.seed * 7919 + 13) % 1000003;
    if (sceneById(state.sceneId).id === 'agree' || sceneById(state.sceneId).id === 'cyclic') {
      state.sceneId = 'random';
      sceneSelect.value = 'random';
      $('scene-blurb').textContent = sceneById('random').blurb;
    }
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

  deal();
}

setup();
