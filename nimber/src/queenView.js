// The queen game on a canvas, with a keyboard cursor, plus the sieve that finds
// the cold squares and the map of every nimber. Rules live in wythoff.js and turns.js.

import { renderMoves } from './movesLog.js';
import { formatQueen } from './share.js';
import { chooseMove, createGame, playMove, takeBack, winningMoves } from './turns.js';
import {
  dealQueen, isCold, isQueenMove, queenNimbers, queenRules, shadowOf, sieveColdSquares,
} from './wythoff.js';

const $ = (id) => document.getElementById(id);
const THINK_MS = 650;
const SHOW_MOVE_MS = 460;
const SIEVE_SIZE = 34;
const HEAT_SIZE = 256;
const rules = queenRules();

const tokens = () => {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => css.getPropertyValue(name).trim();
  return {
    panel: read('--panel'), rule: read('--rule'), ink: read('--ink'), muted: read('--muted'),
    accent: read('--accent'), hint: read('--hint'), good: read('--good'), slip: read('--slip'),
  };
};

// Column a counts from the left and row b from the bottom, so the corner is at (0, 0).
function prepareCanvas(canvas, size, maxWidth) {
  const available = Math.min(canvas.parentElement.clientWidth - 2, maxWidth);
  const cell = Math.max(10, Math.floor(available / size));
  const side = cell * size;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(side * ratio);
  canvas.height = Math.round(side * ratio);
  canvas.style.width = `${side}px`;
  canvas.style.height = `${side}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  return { ctx, cell, side };
}

function cellBox(cell, side, a, b) {
  return { x: a * cell, y: side - (b + 1) * cell };
}

function drawGrid(ctx, cell, side, size, colors) {
  ctx.fillStyle = colors.panel;
  ctx.fillRect(0, 0, side, side);
  ctx.strokeStyle = colors.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= size; i++) {
    ctx.moveTo(i * cell + 0.5, 0);
    ctx.lineTo(i * cell + 0.5, side);
    ctx.moveTo(0, i * cell + 0.5);
    ctx.lineTo(side, i * cell + 0.5);
  }
  ctx.stroke();
}

function drawCrown(ctx, x, y, cell, color) {
  const u = cell / 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 2 * u, y + 8 * u);
  ctx.lineTo(x + 1.2 * u, y + 3.2 * u);
  ctx.lineTo(x + 3.4 * u, y + 5.2 * u);
  ctx.lineTo(x + 5 * u, y + 2 * u);
  ctx.lineTo(x + 6.6 * u, y + 5.2 * u);
  ctx.lineTo(x + 8.8 * u, y + 3.2 * u);
  ctx.lineTo(x + 8 * u, y + 8 * u);
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(ctx, x, y, cell, color) {
  const mid = cell / 2;
  const r = cell * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + mid, y + mid - r);
  ctx.lineTo(x + mid + r, y + mid);
  ctx.lineTo(x + mid, y + mid + r);
  ctx.lineTo(x + mid - r, y + mid);
  ctx.closePath();
  ctx.stroke();
}

function fillCell(ctx, x, y, cell, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, cell - 1, cell - 1);
  ctx.globalAlpha = 1;
}

export function mountQueen() {
  let game = null;
  let size = 16;
  let hinted = null;
  let pending = null;
  let timer = null;
  let cursor = null;
  let hover = null;
  let nimbers = null;
  const score = { you: 0, computer: 0 };

  const moveText = ({ move }) => `to column ${move.a}, row ${move.b}`;
  const nimberTable = () => {
    nimbers ??= queenNimbers(HEAT_SIZE);
    return nimbers;
  };

  function start({ square, boardSize, first }) {
    clearTimeout(timer);
    hinted = null;
    pending = null;
    size = boardSize;
    game = createGame(rules, square, first);
    cursor = { a: square[0], b: square[1] };
    render();
    schedule();
  }

  function newGame() {
    const boardSize = Number($('queen-size').value);
    start({
      square: dealQueen(Math.random, { size: boardSize, kind: $('queen-position').value }),
      boardSize,
      first: $('queen-computer-first').checked ? 'computer' : 'you',
    });
  }

  function schedule() {
    if (game.winner || game.turn !== 'computer') return;
    timer = setTimeout(() => {
      pending = chooseMove(rules, game.position, { skill: Number($('queen-skill').value) });
      drawBoard();
      timer = setTimeout(() => {
        const move = pending;
        pending = null;
        advance(move);
      }, SHOW_MOVE_MS);
    }, THINK_MS);
  }

  function advance(move) {
    hinted = null;
    game = playMove(game, move);
    if (game.winner) score[game.winner] += 1;
    cursor = { a: move.a, b: move.b };
    render();
    schedule();
  }

  function drawBoard() {
    const canvas = $('queen-board');
    if (!canvas.parentElement.clientWidth) return;
    const colors = tokens();
    const { ctx, cell, side } = prepareCanvas(canvas, size, 620);
    drawGrid(ctx, cell, side, size, colors);
    const [qa, qb] = game.position;
    const yours = game.turn === 'you' && !game.winner;
    const reveal = $('queen-reveal').value;
    const table = reveal === 'nimbers' ? nimberTable() : null;
    if (yours) {
      for (const m of rules.legalMoves(game.position)) {
        const { x, y } = cellBox(cell, side, m.a, m.b);
        fillCell(ctx, x, y, cell, colors.accent, 0.14);
      }
    }
    const corner = cellBox(cell, side, 0, 0);
    fillCell(ctx, corner.x, corner.y, cell, colors.good, 0.28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(cell * 0.46)}px Georgia, serif`;
    for (let a = 0; a < size; a++) {
      for (let b = 0; b < size; b++) {
        const { x, y } = cellBox(cell, side, a, b);
        if (reveal === 'cold' && isCold(a, b)) drawDiamond(ctx, x, y, cell, colors.ink);
        if (table && !(a === qa && b === qb)) {
          ctx.fillStyle = table[a][b] === 0 ? colors.slip : colors.muted;
          ctx.fillText(table[a][b], x + cell / 2, y + cell / 2 + 1);
        }
      }
    }
    const ring = (square, color) => {
      if (!square) return;
      const { x, y } = cellBox(cell, side, square.a, square.b);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, cell - 3, cell - 3);
    };
    if (yours && hover && isQueenMove(game.position, hover.a, hover.b)) ring(hover, colors.accent);
    ring(hinted, colors.hint);
    ring(pending, colors.accent);
    if (document.activeElement === canvas) ring(cursor, colors.ink);
    const q = cellBox(cell, side, qa, qb);
    drawCrown(ctx, q.x, q.y, cell, colors.ink);
  }

  function statusText() {
    if (game.winner) {
      const who = game.winner === 'you' ? 'You' : 'The computer';
      return `${who} reached the corner. ${game.winner === 'you' ? 'You win.' : 'The computer wins.'}`;
    }
    return game.turn === 'computer' ? 'The computer is moving.' : 'Your move. Pick a shaded square.';
  }

  function render() {
    drawBoard();
    renderMoves($('queen-log'), $('queen-verdict'), game, moveText, 'square');
    $('queen-status').textContent = statusText();
    $('queen-score').textContent = `You ${score.you} · Computer ${score.computer}`;
    $('queen-hint').disabled = game.turn !== 'you' || Boolean(game.winner);
    $('queen-back').disabled = !game.history.some((e) => e.who === 'you');
  }

  function tryMove(a, b) {
    if (game.turn !== 'you' || game.winner || !isQueenMove(game.position, a, b)) return;
    advance({ a, b });
  }

  const board = $('queen-board');
  const squareAt = (event) => {
    const box = board.getBoundingClientRect();
    const cell = box.width / size;
    const a = Math.floor((event.clientX - box.left) / cell);
    const b = size - 1 - Math.floor((event.clientY - box.top) / cell);
    return a >= 0 && a < size && b >= 0 && b < size ? { a, b } : null;
  };
  board.addEventListener('pointermove', (event) => {
    hover = squareAt(event);
    drawBoard();
  });
  board.addEventListener('pointerleave', () => {
    hover = null;
    drawBoard();
  });
  board.addEventListener('click', (event) => {
    const square = squareAt(event);
    if (square) tryMove(square.a, square.b);
  });
  board.addEventListener('focus', drawBoard);
  board.addEventListener('blur', drawBoard);
  board.addEventListener('keydown', (event) => {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (steps[event.key]) {
      event.preventDefault();
      const [da, db] = steps[event.key];
      cursor = {
        a: Math.max(0, Math.min(size - 1, cursor.a + da)),
        b: Math.max(0, Math.min(size - 1, cursor.b + db)),
      };
      const legal = isQueenMove(game.position, cursor.a, cursor.b);
      $('queen-cursor').textContent = `Column ${cursor.a}, row ${cursor.b}: ${legal ? 'the queen can move here' : 'out of reach'}.`;
      drawBoard();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      tryMove(cursor.a, cursor.b);
    }
  });

  $('queen-new').addEventListener('click', newGame);
  $('queen-reveal').addEventListener('change', drawBoard);
  $('queen-hint').addEventListener('click', () => {
    const good = winningMoves(rules, game.position);
    hinted = good[0] ?? null;
    $('queen-status').textContent = hinted
      ? `Winning move: ${moveText({ move: hinted })}.`
      : 'No move wins here: the queen is on a cold square, and every move leaves it. Play on and hope for a slip.';
    drawBoard();
  });
  $('queen-back').addEventListener('click', () => {
    clearTimeout(timer);
    hinted = null;
    pending = null;
    if (game.winner) score[game.winner] -= 1;
    game = takeBack(game);
    render();
    schedule();
  });
  $('queen-copy').addEventListener('click', async () => {
    const hash = formatQueen({ square: game.start, size, first: game.first });
    history.replaceState(null, '', `#${hash}`);
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${hash}`);
      $('queen-status').textContent = 'Link to this game copied.';
    } catch {
      $('queen-status').textContent = 'Link to this game is now in the address bar.';
    }
  });
  $('queen-size').addEventListener('input', () => {
    $('queen-size-out').textContent = $('queen-size').value;
  });
  $('queen-size-out').textContent = $('queen-size').value;

  // Sieve
  const coldSquares = sieveColdSquares(SIEVE_SIZE);
  const step = $('sieve-step');
  step.max = coldSquares.length;

  function drawSieve() {
    const canvas = $('sieve');
    const available = canvas.parentElement.clientWidth;
    if (!available) return;
    const colors = tokens();
    const { ctx, cell, side } = prepareCanvas(canvas, SIEVE_SIZE, 510);
    drawGrid(ctx, cell, side, SIEVE_SIZE, colors);
    const steps = Number(step.value);
    const inShadow = shadowOf(coldSquares, steps);
    for (let a = 0; a < SIEVE_SIZE; a++) {
      for (let b = 0; b < SIEVE_SIZE; b++) {
        if (inShadow(a, b)) {
          const { x, y } = cellBox(cell, side, a, b);
          fillCell(ctx, x, y, cell, colors.muted, 0.28);
        }
      }
    }
    coldSquares.slice(0, steps).forEach(([a, b]) => {
      const { x, y } = cellBox(cell, side, a, b);
      fillCell(ctx, x, y, cell, colors.ink);
    });
    const next = coldSquares[steps];
    if (next) {
      const { x, y } = cellBox(cell, side, next[0], next[1]);
      fillCell(ctx, x, y, cell, colors.hint);
    }
    $('sieve-step-out').textContent = steps;
    $('sieve-next').disabled = steps >= coldSquares.length;
    $('sieve-note').textContent = next
      ? `Dark squares are cold, and everything they reach is shaded. The first square left unshaded, marked in gold at column ${next[0]}, row ${next[1]}, has no move to a cold square, so it is the next one.`
      : `Every cold square on this ${SIEVE_SIZE} by ${SIEVE_SIZE} board is found. They stay close to two lines through the corner, with slopes of the golden ratio and its inverse.`;
    drawSieveTable(steps);
  }

  function drawSieveTable(steps) {
    const known = coldSquares.slice(0, steps).filter(([a, b]) => a < b);
    const body = $('sieve-table').querySelector('tbody');
    body.replaceChildren();
    known.forEach(([a, b], i) => {
      const row = document.createElement('tr');
      if (i === known.length - 1) row.className = 'latest';
      for (const text of [i + 1, a, b, (a / (i + 1)).toFixed(4)]) {
        const td = document.createElement('td');
        td.textContent = text;
        row.append(td);
      }
      body.append(row);
    });
  }

  step.addEventListener('input', drawSieve);
  $('sieve-next').addEventListener('click', () => {
    step.value = Number(step.value) + 1;
    drawSieve();
  });

  // Map of every nimber
  function heatValue(a, b) {
    return $('heat-kind').value === 'nim' ? a ^ b : nimberTable()[a][b];
  }

  function drawHeat() {
    const ctx = $('heat').getContext('2d');
    const image = ctx.createImageData(HEAT_SIZE, HEAT_SIZE);
    for (let b = 0; b < HEAT_SIZE; b++) {
      for (let a = 0; a < HEAT_SIZE; a++) {
        const v = heatValue(a, b);
        const i = 4 * (b * HEAT_SIZE + a);
        const t = Math.min(1, v / HEAT_SIZE);
        // warm low values through to cool high ones, with 0 left black
        image.data[i] = v === 0 ? 0 : 250 - 190 * t;
        image.data[i + 1] = v === 0 ? 0 : 190 - 60 * Math.abs(2 * t - 1) - 30 * t;
        image.data[i + 2] = v === 0 ? 0 : 70 + 170 * t;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  $('heat-kind').addEventListener('change', drawHeat);
  $('heat').addEventListener('pointermove', (event) => {
    const box = $('heat').getBoundingClientRect();
    const a = Math.floor(((event.clientX - box.left) / box.width) * HEAT_SIZE);
    const b = Math.floor(((event.clientY - box.top) / box.height) * HEAT_SIZE);
    if (a < 0 || b < 0 || a >= HEAT_SIZE || b >= HEAT_SIZE) return;
    $('heat-readout').textContent = `Column ${a}, row ${b} is worth ${heatValue(a, b)}.`;
  });

  let heatDrawn = false;
  window.addEventListener('resize', () => {
    if (game && !$('tab-queen').hidden) {
      drawBoard();
      drawSieve();
    }
  });

  return {
    show() {
      if (!game) newGame();
      drawBoard();
      drawSieve();
      if (!heatDrawn) {
        drawHeat();
        heatDrawn = true;
      }
    },
    load({ square, size: boardSize, first }) {
      $('queen-size').value = boardSize;
      $('queen-size-out').textContent = boardSize;
      $('queen-computer-first').checked = first === 'computer';
      start({ square, boardSize, first });
    },
  };
}
