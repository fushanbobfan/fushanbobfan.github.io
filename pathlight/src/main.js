import { createGrid, setNodeType, findNodeOfType, EMPTY, WALL, START, END } from "./grid.js";
import { bfs } from "./algorithms/bfs.js";

const ROWS = 15;
const COLS = 30;

const gridEl = document.getElementById("grid");
const algorithmSelect = document.getElementById("algorithm");
const runBtn = document.getElementById("run");
const clearPathBtn = document.getElementById("clear-path");
const clearWallsBtn = document.getElementById("clear-walls");
const setStartBtn = document.getElementById("set-start");
const setEndBtn = document.getElementById("set-end");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const statusEl = document.getElementById("status");

const ALGORITHMS = {
  bfs: { label: "Breadth-First Search", run: bfs },
};

let grid = createGrid(ROWS, COLS);
grid = setNodeType(grid, Math.floor(ROWS / 2), 2, START);
grid = setNodeType(grid, Math.floor(ROWS / 2), COLS - 3, END);

let cellEls = [];
const visitedSet = new Set();
const pathSet = new Set();

let placementMode = null; // null | "start" | "end"
let isDrawing = false;
let drawType = EMPTY;
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
      return "empty";
  }
}

function cellClassName(row, col, cell) {
  let className = `cell ${cell.type}`;
  if (cell.type === EMPTY) {
    const k = key(row, col);
    if (pathSet.has(k)) className += " path";
    else if (visitedSet.has(k)) className += " visited";
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
      el.setAttribute("role", "gridcell");
      el.dataset.row = String(row);
      el.dataset.col = String(col);
      gridEl.appendChild(el);
      rowEls.push(el);
    }
    cellEls.push(rowEls);
  }
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
  grid = grid.map((row) => row.map((cell) => (cell.type === WALL ? { ...cell, type: EMPTY } : cell)));
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

speedInput.addEventListener("input", () => {
  animationDelayMs = Number(speedInput.value);
  speedValue.textContent = `${animationDelayMs}ms`;
});

// Drawing walls with a drag needs to know, from the first cell's own state, whether the drag
// as a whole is adding walls or erasing them — otherwise dragging back over already-toggled
// cells would flip them straight back.
gridEl.addEventListener("mousedown", (event) => {
  const pos = cellFromEvent(event);
  if (!pos) return;
  event.preventDefault();

  if (placementMode) {
    grid = setNodeType(grid, pos.row, pos.col, placementMode === "start" ? START : END);
    placementMode = null;
    updatePlacementButtons();
    renderAll();
    return;
  }

  const cell = grid[pos.row][pos.col];
  if (cell.type !== EMPTY && cell.type !== WALL) return;
  drawType = cell.type === WALL ? EMPTY : WALL;
  isDrawing = true;
  grid = setNodeType(grid, pos.row, pos.col, drawType);
  renderCell(pos.row, pos.col);
});

gridEl.addEventListener("mousemove", (event) => {
  if (!isDrawing) return;
  const pos = cellFromEvent(event);
  if (!pos) return;
  const cell = grid[pos.row][pos.col];
  if (cell.type !== EMPTY && cell.type !== WALL) return;
  if (cell.type === drawType) return;
  grid = setNodeType(grid, pos.row, pos.col, drawType);
  renderCell(pos.row, pos.col);
});

window.addEventListener("mouseup", () => {
  isDrawing = false;
});

gridEl.addEventListener("dragstart", (event) => event.preventDefault());

buildGridDom();
renderAll();
speedValue.textContent = `${animationDelayMs}ms`;
