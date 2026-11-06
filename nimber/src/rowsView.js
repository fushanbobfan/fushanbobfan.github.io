// The row games on the page. Pins and the gaps between them are buttons, so the
// board works by keyboard and screen reader. The rules live in octal.js and turns.js.

import {
  freshRow, GAMES, gapMove, pinMove, provePeriod, rowRules, rowValue, runsOf, tableFor,
} from './octal.js';
import { renderMoves } from './movesLog.js';
import { formatRows } from './share.js';
import { chooseMove, createGame, playMove, takeBack, winningMoves } from './turns.js';
import { drawWall, wallCellAt } from './wall.js';

const $ = (id) => document.getElementById(id);
const THINK_MS = 650;
const LEAVE_MS = 460;
const PIN = '<svg viewBox="0 0 30 100" aria-hidden="true" preserveAspectRatio="xMidYMax meet"><path fill="currentColor" d="M15 2c5 0 7 4 7 8 0 5-3 8-3 13 0 8 8 18 8 36 0 15-3 27-5 39H8C6 86 3 74 3 59c0-18 8-28 8-36 0-5-3-8-3-13 0-4 2-8 7-8z"/></svg>';

const moveText = ({ start, take }) => (take === 1
  ? `pin ${start + 1}`
  : `pins ${start + 1} to ${start + take}`);

export function mountRows() {
  let game;
  let key;
  let hinted = null;
  let timer = null;
  const score = { you: 0, computer: 0 };

  const table = () => tableFor(key);
  const wallOptions = () => ({
    table: table(),
    wrap: Number($('wall-wrap').value),
    proof: provePeriod(GAMES[key].code, table()),
    current: game ? runsOf(game.position).map((r) => r.length) : [],
  });

  function start({ gameKey, length, first }) {
    clearTimeout(timer);
    hinted = null;
    const changed = gameKey !== key;
    key = gameKey;
    game = createGame(rowRules(key), freshRow(length), first);
    if (changed) resetWall();
    render();
    schedule();
  }

  function newGame() {
    start({
      gameKey: $('row-game').value,
      length: Number($('row-length').value),
      first: $('row-computer-first').checked ? 'computer' : 'you',
    });
  }

  function schedule() {
    if (game.winner || game.turn !== 'computer') return;
    timer = setTimeout(() => {
      const move = chooseMove(game.rules, game.position, { skill: Number($('row-skill').value) });
      document.querySelectorAll('.pin').forEach((el) => {
        const i = Number(el.dataset.pin);
        if (i >= move.start && i < move.start + move.take) el.classList.add('leaving');
      });
      timer = setTimeout(() => advance(move), LEAVE_MS);
    }, THINK_MS);
  }

  function advance(move) {
    hinted = null;
    game = playMove(game, move);
    if (game.winner) score[game.winner] += 1;
    render();
    schedule();
  }

  function renderBoard() {
    const root = $('row-board');
    const focused = document.activeElement?.dataset?.focusKey;
    root.replaceChildren();
    const yours = game.turn === 'you' && !game.winner;
    const inHint = (i) => hinted && i >= hinted.start && i < hinted.start + hinted.take;
    game.position.forEach((up, i) => {
      const move = pinMove(key, game.position, i);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `pin${up ? '' : ' down'}${up && !move && !game.rules.legalMoves(game.position).some((m) => i >= m.start && i < m.start + m.take) ? ' alone' : ''}${inHint(i) ? ' hinted' : ''}`;
      pin.dataset.pin = i;
      pin.dataset.focusKey = `pin${i}`;
      pin.innerHTML = up ? PIN : '';
      pin.disabled = !yours || !move;
      if (GAMES[key].pin === null || !up) pin.tabIndex = -1;
      pin.setAttribute('aria-label', up
        ? (move ? `Pin ${i + 1}: ${moveText(move)} fall` : `Pin ${i + 1}, standing`)
        : `Pin ${i + 1}, down`);
      root.append(pin);
      if (GAMES[key].gap && i + 1 < game.position.length) {
        const pair = gapMove(key, game.position, i);
        const gap = document.createElement('button');
        gap.type = 'button';
        gap.className = `gap${pair ? '' : ' inert'}${hinted && hinted.take === 2 && hinted.start === i ? ' hinted' : ''}`;
        gap.dataset.gap = i;
        gap.dataset.focusKey = `gap${i}`;
        gap.disabled = !yours || !pair;
        gap.setAttribute('aria-label', `Pins ${i + 1} and ${i + 2} fall`);
        root.append(gap);
      }
    });
    if (focused) root.querySelector(`[data-focus-key="${focused}"]:not(:disabled)`)?.focus();
  }

  function renderValues() {
    const wrap = $('row-values');
    wrap.hidden = !$('row-show-values').checked;
    if (wrap.hidden) return;
    const g = table();
    const list = document.createElement('ul');
    list.className = 'run-chips';
    for (const run of runsOf(game.position)) {
      const value = g[run.length];
      const chip = document.createElement('li');
      chip.className = 'run-chip';
      chip.textContent = `${run.length} ${run.length === 1 ? 'pin' : 'pins'}: pile of ${value}`;
      const mini = document.createElement('span');
      mini.className = 'mini-pile';
      mini.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < value; i++) mini.append(document.createElement('i'));
      chip.append(mini);
      list.append(chip);
    }
    const sum = document.createElement('p');
    sum.className = 'row-sum';
    const total = rowValue(game.position, g);
    sum.textContent = total === 0
      ? 'Nim-sum 0: whoever moves now is losing.'
      : `Nim-sum ${total}: whoever moves now has a winning move.`;
    wrap.replaceChildren(list, sum);
  }

  function statusText() {
    if (game.winner) {
      const noMove = game.winner === 'you' ? 'The computer has no move.' : 'You have no move.';
      return `${noMove} ${game.winner === 'you' ? 'You win.' : 'The computer wins.'}`;
    }
    if (game.turn === 'computer') return 'The computer is moving.';
    return 'Your move. Whoever has no move left loses.';
  }

  function render() {
    $('row-rule').textContent = GAMES[key].rule;
    renderBoard();
    renderValues();
    renderMoves($('row-log'), $('row-verdict'), game, ({ move }) => moveText(move), 'row');
    $('row-status').textContent = statusText();
    $('row-score').textContent = `You ${score.you} · Computer ${score.computer}`;
    $('row-hint').disabled = game.turn !== 'you' || Boolean(game.winner);
    $('row-back').disabled = !game.history.some((e) => e.who === 'you');
    redrawWall();
  }

  function redrawWall() {
    drawWall($('wall'), wallOptions());
    $('wall-wrap-out').textContent = $('wall-wrap').value;
  }

  function resetWall() {
    const proof = provePeriod(GAMES[key].code, table());
    $('wall-wrap').value = proof ? proof.period : 12;
    $('wall-readout').textContent = 'Point at a cell to read it. Click one to set up a row of that length.';
    $('wall-proof').textContent = proof
      ? `${GAMES[key].name}: from ${proof.start} pins on, the value repeats every ${proof.period} pins, forever. The last exception is the marked cell at ${proof.start - 1}. With ${proof.period} cells per line, the repeating part falls into straight columns.`
      : `${GAMES[key].name}: this page computes ${table().length - 1} values and finds no repeat it can prove. A cell showing 0 is a row length that is lost for whoever moves first.`;
  }

  const moveOf = (el) => {
    if (el.dataset.pin !== undefined) return pinMove(key, game.position, Number(el.dataset.pin));
    if (el.dataset.gap !== undefined) return gapMove(key, game.position, Number(el.dataset.gap));
    return null;
  };

  function preview(el) {
    document.querySelectorAll('.pin.doomed').forEach((pin) => pin.classList.remove('doomed'));
    if (!el || el.disabled) return;
    const move = moveOf(el);
    if (!move) return;
    document.querySelectorAll('.pin').forEach((pin) => {
      const i = Number(pin.dataset.pin);
      if (i >= move.start && i < move.start + move.take) pin.classList.add('doomed');
    });
  }

  const board = $('row-board');
  board.addEventListener('click', (event) => {
    const el = event.target.closest('.pin, .gap');
    if (!el || el.disabled) return;
    const move = moveOf(el);
    if (move) advance(move);
  });
  board.addEventListener('mouseover', (event) => preview(event.target.closest('.pin, .gap')));
  board.addEventListener('mouseleave', () => preview(null));
  board.addEventListener('focusin', (event) => preview(event.target.closest('.pin, .gap')));
  board.addEventListener('focusout', () => preview(null));

  $('row-new').addEventListener('click', newGame);
  $('row-game').addEventListener('change', newGame);
  $('row-hint').addEventListener('click', () => {
    const good = winningMoves(game.rules, game.position);
    hinted = good[0] ?? null;
    $('row-status').textContent = hinted
      ? `Winning move: ${moveText(hinted)}.`
      : 'No move wins here: the nim-sum is 0, and every move breaks it. Play on and hope for a slip.';
    renderBoard();
  });
  $('row-back').addEventListener('click', () => {
    clearTimeout(timer);
    hinted = null;
    if (game.winner) score[game.winner] -= 1;
    game = takeBack(game);
    render();
    schedule();
  });
  $('row-copy').addEventListener('click', async () => {
    const hash = formatRows({ game: key, length: game.start.length, first: game.first });
    history.replaceState(null, '', `#${hash}`);
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${hash}`);
      $('row-status').textContent = 'Link to this game copied.';
    } catch {
      $('row-status').textContent = 'Link to this game is now in the address bar.';
    }
  });
  $('row-show-values').addEventListener('change', renderValues);
  $('row-length').addEventListener('input', () => {
    $('row-length-out').textContent = $('row-length').value;
  });
  $('wall-wrap').addEventListener('input', redrawWall);

  const wall = $('wall');
  wall.addEventListener('pointermove', (event) => {
    const n = wallCellAt(wall, wallOptions(), event);
    if (n !== null) $('wall-readout').textContent = `A run of ${n} is worth ${table()[n]}.`;
  });
  wall.addEventListener('click', (event) => {
    const n = wallCellAt(wall, wallOptions(), event);
    if (n === null) return;
    const max = Number($('row-length').max);
    if (n < 2 || n > max) {
      $('wall-readout').textContent = `A run of ${n} is worth ${table()[n]}. The board holds 2 to ${max} pins.`;
      return;
    }
    $('row-length').value = n;
    $('row-length-out').textContent = n;
    newGame();
  });
  window.addEventListener('resize', () => {
    if (game && !$('tab-rows').hidden) redrawWall();
  });

  $('row-length-out').textContent = $('row-length').value;

  return {
    show: () => {
      if (!game) newGame();
      redrawWall();
    },
    load({ game: gameKey, length, first }) {
      $('row-game').value = gameKey;
      $('row-length').value = length;
      $('row-length-out').textContent = length;
      $('row-computer-first').checked = first === 'computer';
      start({ gameKey, length, first });
    },
  };
}
