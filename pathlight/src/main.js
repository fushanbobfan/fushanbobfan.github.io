import { createGrid, setNodeType, setNodeWeight, findNodeOfType, EMPTY, WALL, START, END } from "./grid.js";
import { bfs } from "./algorithms/bfs.js";
import { dijkstra } from "./algorithms/dijkstra.js";
import { astar } from "./algorithms/astar.js";
import { generateMaze } from "./maze.js";

const ROWS = 15;
const COLS = 30;
const WEIGHTED_TERRAIN_COST = 5;

const gridEl = document.getElementById("grid");
const algorithmSelect = document.getElementById("algorithm");
const runBtn = document.getElementById("run");
const clearPathBtn = document.getElementById("clear-path");
const clearWallsBtn = document.getElementById("clear-walls");
const generateMazeBtn = document.getElementById("generate-maze");
const setStartBtn = document.getElementById("set-start");
const setEndBtn = document.getElementById("set-end");
const brushWallBtn = document.getElementById("brush-wall");
const brushWeightBtn = document.getElementById("brush-weight");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const statusEl = document.getElementById("status");

const ALGORITHMS = {
  bfs: { label: "Breadth-First Search", run: bfs },
  dijkstra: { label: "Dijkstra's Algorithm", run: dijkstra },
  astar: { label: "A* Search", run: astar },
};

let grid = createGrid(ROWS, COLS);
grid = setNodeType(grid, Math.floor(ROWS / 2), 2, START);
grid = setNodeType(grid, Math.floor(ROWS / 2), COLS - 3, END);

let cellEls = [];
let focusedRow = 0;
let focusedCol = 0;
const visitedSet = new Set();
const pathSet = new Set();

let placementMode = null; // null | "start" | "end"
let brush = "wall"; // "wall" | "weight" — which tool click-drag applies to empty cells
let isDrawing = false;
let drawValue = null; // for the wall brush: WALL/EMPTY; for the weight brush: a weight number
let running = false;
let animationDelayMs = Number(speedInput.value);

function key(row, col) {
  return `${row},${col}`;
}

function cellLabel(cell) {
  switch (cell.type) {
    case WALL:
      return "wall";
    case START:
      return "start";
    case END:
      return "end";
    default:
      return cell.weight > 1 ? `weighted terrain, cost ${cell.weight}` : "empty";
  }
}

function cellClassName(row, col, cell) {
  let className = `cell ${cell.type}`;
  if (cell.type === EMPTY) {
    const k = key(row, col);
    if (pathSet.has(k)) className += " path";
    else if (visitedSet.has(k)) className += " visited";
    else if (cell.weight > 1) className += " weighted";
  }
  return className;
}

function buildGridDom() {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  cellEls = [];
  for (let row = 0; row < ROWS; row++) {
    const rowEls = [];
    for (let col = 0; col < COLS; col++) {
      const el = document.createElement("div");
      // No intervening role="row" wrapper — the CSS grid layout is a flat list of cells, and
      // adding row elements would need `display: contents` to keep the visual grid intact.
      // Screen reader support for a flat grid > gridcell hierarchy without rows is inconsistent,
      // so each cell's own aria-label spells out its row and column instead of relying on
      // structure alone to convey position.
      el.setAttribute("role", "gridcell");
      el.tabIndex = row === 0 && col === 0 ? 0 : -1;
      el.dataset.row = String(row);
      el.dataset.col = String(col);
      gridEl.appendChild(el);
      rowEls.push(el);
    }
    cellEls.push(rowEls);
  }
  focusedRow = 0;
  focusedCol = 0;
}

function renderCell(row, col) {
  const cell = grid[row][col];
  const el = cellEls[row][col];
  el.className = cellClassName(row, col, cell);
  el.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}: ${cellLabel(cell)}`);
}

function renderAll() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) renderCell(row, col);
  }
}

function updatePlacementButtons() {
  setStartBtn.setAttribute("aria-pressed", String(placementMode === "start"));
  setEndBtn.setAttribute("aria-pressed", String(placementMode === "end"));
}

function setStatus(text) {
  statusEl.textContent = text;
}

function cellFromEvent(event) {
  const el = event.target.closest("[role='gridcell']");
  if (!el) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (running) return;
  const start = findNodeOfType(grid, START);
  const end = findNodeOfType(grid, END);
  if (!start || !end) {
    setStatus("Place both a start and an end before running.");
    return;
  }

  running = true;
  runBtn.disabled = true;
  visitedSet.clear();
  pathSet.clear();
  renderAll();
  setStatus("Running…");

  const algorithm = ALGORITHMS[algorithmSelect.value];
  const { visitedOrder, path, found } = algorithm.run(grid, start, end);

  for (const node of visitedOrder) {
    visitedSet.add(key(node.row, node.col));
    renderCell(node.row, node.col);
    if (animationDelayMs > 0) await delay(animationDelayMs);
  }

  if (found) {
    for (const node of path) {
      pathSet.add(key(node.row, node.col));
      renderCell(node.row, node.col);
      if (animationDelayMs > 0) await delay(animationDelayMs);
    }
    setStatus(`Path found: ${path.length - 1} steps, ${visitedOrder.length} cells explored.`);
  } else {
    setStatus(`No path exists. ${visitedOrder.length} cells explored.`);
  }

  running = false;
  runBtn.disabled = false;
}

runBtn.addEventListener("click", run);

clearPathBtn.addEventListener("click", () => {
  visitedSet.clear();
  pathSet.clear();
  renderAll();
  setStatus("");
});

clearWallsBtn.addEventListener("click", () => {
  grid = grid.map((row) =>
    row.map((cell) => (cell.type === WALL ? { ...cell, type: EMPTY, weight: 1 } : { ...cell, weight: 1 }))
  );
  visitedSet.clear();
  pathSet.clear();
  renderAll();
  setStatus("");
});

// The maze generator only carves passages between even (row, col) cells, so the start and end
// land on the first and last even cells rather than wherever they happened to be before —
// anywhere else risks landing on a wall the generator just drew.
generateMazeBtn.addEventListener("click", () => {
  const wallGrid = generateMaze(ROWS, COLS);
  grid = wallGrid.map((row) => row.map((isWall) => ({ type: isWall ? WALL : EMPTY, weight: 1 })));

  const endRow = 2 * Math.floor((ROWS - 1) / 2);
  const endCol = 2 * Math.floor((COLS - 1) / 2);
  grid = setNodeType(grid, 0, 0, START);
  grid = setNodeType(grid, endRow, endCol, END);

  visitedSet.clear();
  pathSet.clear();
  renderAll();
  setStatus("");
});

setStartBtn.addEventListener("click", () => {
  placementMode = placementMode === "start" ? null : "start";
  updatePlacementButtons();
});

setEndBtn.addEventListener("click", () => {
  placementMode = placementMode === "end" ? null : "end";
  updatePlacementButtons();
});

function setBrush(next) {
  brush = next;
  brushWallBtn.setAttribute("aria-pressed", String(brush === "wall"));
  brushWeightBtn.setAttribute("aria-pressed", String(brush === "weight"));
}

brushWallBtn.addEventListener("click", () => setBrush("wall"));
brushWeightBtn.addEventListener("click", () => setBrush("weight"));

speedInput.addEventListener("input", () => {
  animationDelayMs = Number(speedInput.value);
  speedValue.textContent = `${animationDelayMs}ms`;
});

// A drag needs to know, from the first cell's own state, whether the drag as a whole is adding
// (a wall, or weighted terrain) or erasing it — otherwise dragging back over already-toggled
// cells would flip them straight back. `drawValue` records that decision for the rest of the
// drag; which property it's applied to (type or weight) depends on the active brush.
function beginDraw(row, col) {
  const cell = grid[row][col];
  if (brush === "wall") {
    if (cell.type !== EMPTY && cell.type !== WALL) return false;
    drawValue = cell.type === WALL ? EMPTY : WALL;
    grid = setNodeType(grid, row, col, drawValue);
  } else {
    if (cell.type !== EMPTY) return false;
    drawValue = cell.weight > 1 ? 1 : WEIGHTED_TERRAIN_COST;
    grid = setNodeWeight(grid, row, col, drawValue);
  }
  renderCell(row, col);
  return true;
}

function continueDraw(row, col) {
  const cell = grid[row][col];
  if (brush === "wall") {
    if (cell.type !== EMPTY && cell.type !== WALL) return;
    if (cell.type === drawValue) return;
    grid = setNodeType(grid, row, col, drawValue);
  } else {
    if (cell.type !== EMPTY) return;
    if (cell.weight === drawValue) return;
    grid = setNodeWeight(grid, row, col, drawValue);
  }
  renderCell(row, col);
}

// Shared by a mouse click and a keyboard Enter/Space: places the start/end if placement mode
// is armed, otherwise applies the active brush to a single cell. Returns whether the action
// can be extended by dragging (only true for a fresh wall/terrain stroke, not a placement).
function activateCell(row, col) {
  if (placementMode) {
    grid = setNodeType(grid, row, col, placementMode === "start" ? START : END);
    placementMode = null;
    updatePlacementButtons();
    renderAll();
    return false;
  }
  return beginDraw(row, col);
}

// Roving tabindex (the standard keyboard pattern for a grid of same-role cells): exactly one
// cell is a Tab stop at a time, and arrow keys move that one cell rather than requiring Tab to
// step through all 450 of them individually.
function focusCell(row, col) {
  cellEls[focusedRow][focusedCol].tabIndex = -1;
  focusedRow = row;
  focusedCol = col;
  cellEls[focusedRow][focusedCol].tabIndex = 0;
}

function moveFocus(dRow, dCol) {
  const nextRow = Math.min(ROWS - 1, Math.max(0, focusedRow + dRow));
  const nextCol = Math.min(COLS - 1, Math.max(0, focusedCol + dCol));
  if (nextRow === focusedRow && nextCol === focusedCol) return;
  focusCell(nextRow, nextCol);
  cellEls[focusedRow][focusedCol].focus();
}

gridEl.addEventListener("mousedown", (event) => {
  const pos = cellFromEvent(event);
  if (!pos) return;
  event.preventDefault();
  focusCell(pos.row, pos.col);
  isDrawing = activateCell(pos.row, pos.col);
});

gridEl.addEventListener("mousemove", (event) => {
  if (!isDrawing) return;
  const pos = cellFromEvent(event);
  if (!pos) return;
  continueDraw(pos.row, pos.col);
});

window.addEventListener("mouseup", () => {
  isDrawing = false;
});

gridEl.addEventListener("dragstart", (event) => event.preventDefault());

gridEl.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      moveFocus(-1, 0);
      break;
    case "ArrowDown":
      event.preventDefault();
      moveFocus(1, 0);
      break;
    case "ArrowLeft":
      event.preventDefault();
      moveFocus(0, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      moveFocus(0, 1);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      activateCell(focusedRow, focusedCol);
      break;
    default:
      break;
  }
});

buildGridDom();
renderAll();
speedValue.textContent = `${animationDelayMs}ms`;
