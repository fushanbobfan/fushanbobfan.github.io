// The pile game on the page: stones are buttons, so the board works by keyboard
// and screen reader. All game rules live in match.js and nim.js.

import { createMatch, deal } from './match.js';
import { blocks, nimSum, oddBlockSizes } from './nim.js';
import { chooseMove, playMove, takeBack, turningPoints, winningMoves } from './turns.js';
import { formatPiles, parsePiles } from './share.js';

const $ = (id) => document.getElementById(id);
const COLUMNS = [8, 4, 2, 1];
const THINK_MS = 650;
const LEAVE_MS = 460;

export function mountPiles() {
  let match;
  let hinted = null;
  let timer = null;
  let cursor = { pile: 0, stone: 0 };
  let focusAfterRender = false;
  const score = { you: 0, computer: 0 };

  const skill = () => Number($('skill').value);

  function startMatch(config) {
    clearTimeout(timer);
    hinted = null;
    match = createMatch(config);
    cursor = { pile: match.position.findIndex((h) => h > 0), stone: 0 };
    render();
    scheduleComputer();
  }

  function newGame() {
    const misere = $('rule').value === 'misere';
    const kind = $('position').value;
    const heaps = kind === 'classic'
      ? [3, 4, 5]
      : deal(Math.random, {
        piles: Number($('pile-count').value),
        largest: Number($('largest').value),
        kind,
        misere,
      });
    startMatch({ heaps, misere, first: $('computer-first').checked ? 'computer' : 'you' });
  }

  function scheduleComputer() {
    if (match.winner || match.turn !== 'computer') return;
    timer = setTimeout(() => {
      const move = chooseMove(match.rules, match.position, { skill: skill() });
      document.querySelectorAll(`.stone[data-pile="${move.heap}"]`).forEach((el) => {
        if (Number(el.dataset.stone) >= move.to) el.classList.add('leaving');
      });
      timer = setTimeout(() => advance(move), LEAVE_MS);
    }, THINK_MS);
  }

  function advance(move) {
    hinted = null;
    match = playMove(match, move);
    if (match.winner) score[match.winner] += 1;
    render();
    scheduleComputer();
  }

  function blockOf(size, stone) {
    let base = 0;
    for (const b of blocks(size)) {
      if (stone < base + b) return { block: b, start: stone === base };
      base += b;
    }
    return { block: 1, start: false };
  }

  function renderPiles() {
    const root = $('piles');
    root.classList.toggle('show-blocks', $('show-blocks').checked);
    root.replaceChildren();
    // Room for the tallest starting pile, so the board keeps its height as stones leave.
    const stoneHeight = window.matchMedia('(max-width: 800px)').matches ? 21 : 27;
    root.style.minHeight = `${Math.max(...match.start) * stoneHeight + 100}px`;
    const yourTurn = match.turn === 'you' && !match.winner;
    const odd = oddBlockSizes(match.position);
    match.position.forEach((size, pile) => {
      const column = document.createElement('div');
      column.className = 'pile';
      const stack = document.createElement('div');
      stack.className = 'stack';
      for (let stone = 0; stone < size; stone++) {
        const el = document.createElement('button');
        const { block, start } = blockOf(size, stone);
        const taken = size - stone;
        el.type = 'button';
        el.className = `stone v${(pile * 7 + stone * 5) % 3}${start ? ' block-start' : ''}`;
        el.dataset.pile = pile;
        el.dataset.stone = stone;
        el.dataset.block = block;
        el.disabled = !yourTurn;
        el.tabIndex = cursor.pile === pile && cursor.stone === stone ? 0 : -1;
        el.setAttribute('aria-label', `Pile ${pile + 1}: take ${taken}, leaving ${stone}`);
        if (hinted && hinted.heap === pile && stone >= hinted.to) el.classList.add('hinted');
        stack.append(el);
      }
      const label = document.createElement('div');
      label.className = 'pile-label';
      label.textContent = size;
      const parts = document.createElement('small');
      if ($('show-blocks').checked) {
        blocks(size).forEach((b, i) => {
          if (i) parts.append('+');
          const span = document.createElement('span');
          span.textContent = b;
          if (odd.includes(b)) span.className = 'odd';
          parts.append(span);
        });
      }
      label.append(parts);
      column.append(stack, label);
      root.append(column);
    });
    if (focusAfterRender) {
      focusAfterRender = false;
      root.querySelector('.stone[tabindex="0"]:not(:disabled)')?.focus();
    }
  }

  function renderTable() {
    const wrap = $('table-wrap');
    wrap.hidden = !$('show-table').checked;
    if (wrap.hidden) return;
    const sum = nimSum(match.position);
    const rows = match.position.map((size, i) => `
      <tr><th scope="row">Pile ${i + 1}: ${size}</th>${COLUMNS.map((c) => `<td class="${size & c ? '' : 'off'}">${size & c ? 1 : 0}</td>`).join('')}</tr>`);
    wrap.innerHTML = `
      <table class="binary">
        <caption class="visually-hidden">Each pile in binary, with the parity of every column</caption>
        <thead><tr><th scope="col">Blocks of</th>${COLUMNS.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot><tr><th scope="row">Nim-sum: ${sum}</th>${COLUMNS.map((c) => `<td class="${sum & c ? 'odd' : 'even'}">${sum & c ? 'odd' : 'even'}</td>`).join('')}</tr></tfoot>
      </table>`;
  }

  function statusText() {
    if (match.winner) {
      const last = match.history[match.history.length - 1].who;
      const taker = last === 'you' ? 'You took' : 'The computer took';
      return `${taker} the last stone. ${match.winner === 'you' ? 'You win.' : 'The computer wins.'}`;
    }
    if (match.turn === 'computer') return 'The computer is moving.';
    const goal = match.misere ? 'Do not take the last stone.' : 'Take the last stone.';
    return `Your move. ${goal} Pick a stone: it and every stone above it leave the pile.`;
  }

  const moveText = ({ move, before }) => `pile ${move.heap + 1}, ${before[move.heap]} to ${move.to}`;

  function renderLog() {
    const log = $('log');
    log.replaceChildren();
    for (const entry of match.history) {
      const li = document.createElement('li');
      const name = entry.who === 'you' ? 'You' : 'Computer';
      li.textContent = `${name}: ${moveText(entry)}`;
      if (match.winner && entry.quality === 'slip') {
        li.className = 'slip';
        li.textContent += ' (gave the game away)';
      }
      log.append(li);
    }
    log.scrollTop = log.scrollHeight;
    $('verdict').textContent = match.winner ? verdictText() : '';
  }

  function verdictText() {
    const turns = turningPoints(match);
    if (!turns.length) {
      const opener = match.first === 'you' ? 'You' : 'The computer';
      const won = match.winner === match.first;
      return `${opener} moved first from a position that was ${won ? 'won' : 'lost'} from the start, and nobody slipped.`;
    }
    const last = turns[turns.length - 1];
    const name = last.who === 'you' ? 'your' : "the computer's";
    return `The game last changed hands on ${name} move: ${moveText(last)}.`;
  }

  function render() {
    renderPiles();
    renderTable();
    renderLog();
    $('status').textContent = statusText();
    $('score').textContent = `You ${score.you} · Computer ${score.computer}`;
    $('hint').disabled = match.turn !== 'you' || Boolean(match.winner);
    $('take-back').disabled = !match.history.some((e) => e.who === 'you');
  }

  function showHint() {
    const good = winningMoves(match.rules, match.position);
    if (good.length) {
      hinted = good[0];
      const taken = match.position[hinted.heap] - hinted.to;
      $('status').textContent = `Take ${taken} from pile ${hinted.heap + 1}, leaving ${hinted.to}.`;
    } else {
      hinted = null;
      $('status').textContent = 'No move wins here: every move hands over a position your opponent can repair. Take one stone and hope for a slip.';
    }
    renderPiles();
  }

  function previewDoomed(target) {
    document.querySelectorAll('.stone.doomed').forEach((el) => el.classList.remove('doomed'));
    if (!target?.classList?.contains('stone') || target.disabled) return;
    const from = Number(target.dataset.stone);
    document.querySelectorAll(`.stone[data-pile="${target.dataset.pile}"]`).forEach((el) => {
      if (Number(el.dataset.stone) >= from) el.classList.add('doomed');
    });
  }

  function moveCursor(key) {
    const nonEmpty = match.position.map((h, i) => (h > 0 ? i : -1)).filter((i) => i >= 0);
    const at = nonEmpty.indexOf(cursor.pile);
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const step = key === 'ArrowLeft' ? -1 : 1;
      cursor.pile = nonEmpty[(at + step + nonEmpty.length) % nonEmpty.length];
    } else {
      cursor.stone += key === 'ArrowUp' ? 1 : -1;
    }
    cursor.stone = Math.max(0, Math.min(match.position[cursor.pile] - 1, cursor.stone));
    focusAfterRender = true;
    renderPiles();
  }

  $('piles').addEventListener('click', (event) => {
    const el = event.target.closest('.stone');
    if (!el || el.disabled) return;
    const move = { heap: Number(el.dataset.pile), to: Number(el.dataset.stone) };
    const remaining = match.position.map((h, i) => (i === move.heap ? move.to : h));
    const next = remaining.findIndex((h) => h > 0);
    cursor = {
      pile: remaining[cursor.pile] > 0 ? cursor.pile : Math.max(next, 0),
      stone: 0,
    };
    advance(move);
  });
  $('piles').addEventListener('mouseover', (event) => previewDoomed(event.target));
  $('piles').addEventListener('mouseleave', () => previewDoomed(null));
  $('piles').addEventListener('focusin', (event) => previewDoomed(event.target));
  $('piles').addEventListener('focusout', () => previewDoomed(null));
  $('piles').addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      moveCursor(event.key);
    }
  });

  $('new-game').addEventListener('click', newGame);
  $('hint').addEventListener('click', showHint);
  $('take-back').addEventListener('click', () => {
    clearTimeout(timer);
    hinted = null;
    const rewound = takeBack(match);
    if (match.winner) score[match.winner] -= 1;
    match = rewound;
    cursor = { pile: match.position.findIndex((h) => h > 0), stone: 0 };
    render();
    scheduleComputer();
  });
  $('copy-link').addEventListener('click', async () => {
    const hash = formatPiles({ heaps: match.start, misere: match.misere, first: match.first });
    const url = `${location.origin}${location.pathname}#${hash}`;
    history.replaceState(null, '', `#${hash}`);
    try {
      await navigator.clipboard.writeText(url);
      $('status').textContent = 'Link to this starting position copied.';
    } catch {
      $('status').textContent = 'Link to this starting position is now in the address bar.';
    }
  });
  $('show-blocks').addEventListener('change', renderPiles);
  $('show-table').addEventListener('change', renderTable);

  function syncSetup() {
    const random = $('position').value !== 'classic';
    document.querySelectorAll('[data-random]').forEach((el) => { el.hidden = !random; });
    $('pile-count-out').textContent = $('pile-count').value;
    $('largest-out').textContent = $('largest').value;
  }
  ['position', 'pile-count', 'largest'].forEach((id) => $(id).addEventListener('input', syncSetup));
  syncSetup();

  const shared = parsePiles(location.hash);
  if (shared) {
    $('rule').value = shared.misere ? 'misere' : 'normal';
    $('computer-first').checked = shared.first === 'computer';
    startMatch(shared);
  } else {
    newGame();
  }
}
