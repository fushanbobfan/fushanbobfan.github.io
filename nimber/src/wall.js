// The table of nimbers as a wall of coloured cells. Set the line width to a game's
// period and the repeating part falls into straight columns.

const MAX_CELL = 34;
const MIN_LINES = 14;
const MAX_LINES = 40;
const MIN_CELLS = 168;

export function wallLayout(width, wrap, tableLength) {
  const cell = Math.max(3, Math.min(MAX_CELL, Math.floor(width / wrap)));
  const wanted = Math.max(MIN_LINES, Math.ceil(MIN_CELLS / wrap));
  const lines = Math.min(MAX_LINES, wanted, Math.ceil(tableLength / wrap));
  return { cell, lines, columns: wrap, shown: Math.min(lines * wrap, tableLength) - 1 };
}

// Cells read left to right, top to bottom, starting from a run of 0.
export function cellToN(column, line, { columns, shown }) {
  if (column < 0 || column >= columns || line < 0) return null;
  const n = line * columns + column;
  return n <= shown ? n : null;
}

export function exceptionalCells(table, proof) {
  if (!proof) return [];
  const out = [];
  for (let n = 0; n < proof.start; n++) {
    let m = n;
    while (m < proof.start) m += proof.period;
    if (table[n] !== table[m]) out.push(n);
  }
  return out;
}

function fillFor(value, dark) {
  if (value === 0) return dark ? '#f0ebdd' : '#1f1c16';
  const hue = (28 + value * 47) % 360;
  return `hsl(${hue} ${dark ? 48 : 52}% ${dark ? 42 : 62}%)`;
}

const isDark = () => getComputedStyle(document.body).backgroundColor
  .match(/\d+/g).slice(0, 3).reduce((a, b) => a + Number(b), 0) < 300;

export function drawWall(canvas, { table, wrap, proof, current }) {
  const width = canvas.clientWidth;
  if (!width) return;
  const layout = wallLayout(width, wrap, table.length);
  const { cell, lines, columns, shown } = layout;
  const ratio = window.devicePixelRatio || 1;
  canvas.height = Math.round(lines * cell * ratio);
  canvas.width = Math.round(width * ratio);
  canvas.style.height = `${lines * cell}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  const dark = isDark();
  const gap = cell >= 6 ? 1 : 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(cell * 0.46)}px Georgia, serif`;
  const exceptions = new Set(exceptionalCells(table, proof));
  const runs = new Set(current);
  for (let n = 0; n <= shown; n++) {
    const line = Math.floor(n / columns);
    if (line >= lines) break;
    const x = (n % columns) * cell;
    const y = line * cell;
    ctx.fillStyle = fillFor(table[n], dark);
    ctx.fillRect(x, y, cell - gap, cell - gap);
    if (cell >= 18) {
      ctx.fillStyle = table[n] === 0 ? (dark ? '#1d1b16' : '#f4efe4') : (dark ? '#f7f3e8' : '#1f1c16');
      ctx.fillText(table[n], x + (cell - gap) / 2, y + (cell - gap) / 2 + 1);
    }
    if (exceptions.has(n) && cell >= 6) {
      ctx.fillStyle = dark ? '#ffffff' : '#000000';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cell * 0.32, y);
      ctx.lineTo(x, y + cell * 0.32);
      ctx.fill();
    }
    if (runs.has(n) && cell >= 6) {
      ctx.strokeStyle = dark ? '#ffffff' : '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cell - gap - 2, cell - gap - 2);
    }
  }
}

export function wallCellAt(canvas, { table, wrap }, event) {
  const box = canvas.getBoundingClientRect();
  const layout = wallLayout(canvas.clientWidth, wrap, table.length);
  const column = Math.floor((event.clientX - box.left) / layout.cell);
  const line = Math.floor((event.clientY - box.top) / layout.cell);
  return cellToN(column, line, layout);
}
