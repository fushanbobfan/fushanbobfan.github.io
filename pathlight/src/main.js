import { createGrid, setNodeType, setNodeWeight, findNodeOfType, EMPTY, WALL, START, END } from "./grid.js";
import { bfs } from "./algorithms/bfs.js";
import { dijkstra } from "./algorithms/dijkstra.js";
import { astar } from "./algorithms/astar.js";
import { greedyBestFirstSearch } from "./algorithms/greedy.js";
import { bidirectionalSearch } from "./algorithms/bidirectional.js";
import { generateMaze } from "./maze.js";
import { generateTerrain } from "./terrain.js";
import { compareAlgorithms } from "./compare.js";
import { compareResultsToCsv } from "./csvExport.js";
import { serializeGrid, deserializeGrid } from "./serialize.js";
import { buildShareUrl, extractShareFragment, decodeGridFromFragment } from "./shareLink.js";
import { totalFrames, frameState } from "./frames.js";
import { createHistory, pushHistory, popHistory, canPop } from "./history.js";

const ROWS = 15;
const COLS = 30;
const WEIGHTED_TERRAIN_COST = 5;
const UNDO_HISTORY_SIZE = 20;

const gridEl = document.getElementById("grid");
const algorithmSelect = document.getElementById("algorithm");
const runBtn = document.getElementById("run");
const clearPathBtn = document.getElementById("clear-path");
const clearWallsBtn = document.getElementById("clear-walls");
const generateMazeBtn = document.getElementById("generate-maze");
const generateTerrainBtn = document.getElementById("generate-terrain");
const compareBtn = document.getElementById("compare");
const comparisonEl = document.getElementById("comparison");
const downloadComparisonCsvBtn = document.getElementById("download-comparison-csv");
const saveGridBtn = document.getElementById("save-grid");
const loadGridInput = document.getElementById("load-grid");
const copyShareLinkBtn = document.getElementById("copy-share-link");
const setStartBtn = document.getElementById("set-start");
const setEndBtn = document.getElementById("set-end");
const brushWallBtn = document.getElementById("brush-wall");
const brushWeightBtn = document.getElementById("brush-weight");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const scrubInput = document.getElementById("scrub");
const scrubValue = document.getElementById("scrub-value");
const statusEl = document.getElementById("status");

const ALGORITHMS = {
  bfs: { label: "Breadth-First Search", run: bfs },
  dijkstra: { label: "Dijkstra's Algorithm", run: dijkstra },
  astar: { label: "A* Search", run: astar },
  greedy: { label: "Greedy Best-First Search", run: greedyBestFirstSearch },
  bidirectional: { label: "Bidirectional Search", run: bidirectionalSearch },
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
let lastRun = null; // {visitedOrder, path, found} from the most recently completed run, for scrubbing
let lastComparisonResults = null; // compareAlgorithms' output from the last "Compare all algorithms" click, for CSV download
let undoHistory = createHistory(UNDO_HISTORY_SIZE);
let redoHistory = createHistory(UNDO_HISTORY_SIZE);

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

function renderComparison(results) {
  const rows = results
    .map(
      (r) => `
        <tr>
          <th scope="row">${r.label}</th>
          <td>${r.visitedCount}</td>
          <td>${r.found ? r.steps : "unreachable"}</td>
          <td>${r.found ? r.cost : "unreachable"}</td>
        </tr>`
    )
    .join("");
  comparisonEl.innerHTML = `
    <table>
      <caption>Comparison for the current grid</caption>
      <thead>
        <tr>
          <th scope="col">Algorithm</th>
          <th scope="col">Cells explored</th>
          <th scope="col">Steps</th>
          <th scope="col">Cost</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function clearComparison() {
  comparisonEl.innerHTML = "";
  lastComparisonResults = null;
}

function cellFromEvent(event) {
  const el = event.target.closest("[role='gridcell']");
  if (!el) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
}

// A touchmove's own `target` stays whatever cell the touch started on, unlike a mouse's, so
// dragging a finger across the grid needs to look up whatever's actually under it by position
// instead.
function cellAtPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY)?.closest("[role='gridcell']");
  if (!el) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Forgets the last run and disables the scrubber — called any time the grid or highlighting
// changes in a way that would make scrubbing back through a stale run misleading.
function resetScrub() {
  lastRun = null;
  scrubInput.value = 0;
  scrubInput.max = 0;
  scrubInput.disabled = true;
  scrubValue.textContent = "no run yet";
}

function clearRunState() {
  visitedSet.clear();
  pathSet.clear();
  resetScrub();
}

function updateUndoButton() {
  undoBtn.disabled = !canPop(undoHistory);
}

function updateRedoButton() {
  redoBtn.disabled = !canPop(redoHistory);
}

// Records the current grid (reusing serialize.js's serializeGrid, so undo doesn't need its own
// notion of what a "state" is) before a discrete, reversible edit — drawing or erasing a wall or
// weighted-terrain cell, placing the start or end, clearing walls and terrain, or generating
// terrain. Skipped around actions that replace the grid from an external or generated source
// (Generate maze, Load grid, a share link), which clear the stack instead via
// resetHistory: undoing back into a grid the current one replaced would restore walls from
// an unrelated layout. A fresh edit also discards any pending redo history — once it diverges
// from what was undone, redoing back to it would restore a layout the edit just replaced.
function snapshotForUndo() {
  undoHistory = pushHistory(undoHistory, serializeGrid(grid));
  redoHistory = createHistory(UNDO_HISTORY_SIZE);
  updateUndoButton();
  updateRedoButton();
}

function resetHistory() {
  undoHistory = createHistory(UNDO_HISTORY_SIZE);
  redoHistory = createHistory(UNDO_HISTORY_SIZE);
  updateUndoButton();
  updateRedoButton();
}

function undo() {
  const { snapshot, history: after } = popHistory(undoHistory);
  if (!snapshot) return;
  undoHistory = after;
  redoHistory = pushHistory(redoHistory, serializeGrid(grid));
  grid = deserializeGrid(snapshot, ROWS, COLS);
  updateUndoButton();
  updateRedoButton();
  clearRunState();
  clearComparison();
  renderAll();
  setStatus("Undid the last edit.");
}

function redo() {
  const { snapshot, history: after } = popHistory(redoHistory);
  if (!snapshot) return;
  redoHistory = after;
  undoHistory = pushHistory(undoHistory, serializeGrid(grid));
  grid = deserializeGrid(snapshot, ROWS, COLS);
  updateUndoButton();
  updateRedoButton();
  clearRunState();
  clearComparison();
  renderAll();
  setStatus("Redid the last undone edit.");
}

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// Sets visitedSet/pathSet to exactly what `frameIndex` steps into `lastRun` should show, then
// re-renders only the cells whose highlighting actually changed. Used both by the live
// animation (stepping forward one frame at a time) and by dragging the scrub slider (jumping
// straight to an arbitrary frame).
function applyFrame(frameIndex) {
  const { visited, path } = frameState(lastRun.visitedOrder, lastRun.path, lastRun.found, frameIndex);
  const nextVisited = new Set(visited.map((n) => key(n.row, n.col)));
  const nextPath = new Set(path.map((n) => key(n.row, n.col)));
  const changed = new Set();

  for (const k of visitedSet) if (!nextVisited.has(k)) changed.add(k);
  for (const k of pathSet) if (!nextPath.has(k)) changed.add(k);
  for (const k of nextVisited) if (!visitedSet.has(k)) changed.add(k);
  for (const k of nextPath) if (!pathSet.has(k)) changed.add(k);

  visitedSet.clear();
  nextVisited.forEach((k) => visitedSet.add(k));
  pathSet.clear();
  nextPath.forEach((k) => pathSet.add(k));

  for (const k of changed) {
    const [row, col] = k.split(",").map(Number);
    renderCell(row, col);
  }

  scrubInput.value = frameIndex;
  const total = totalFrames(lastRun.visitedOrder, lastRun.path, lastRun.found);
  scrubValue.textContent = `${frameIndex} / ${total}`;
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
  clearRunState();
  clearComparison();
  renderAll();
  setStatus("Running…");

  const algorithm = ALGORITHMS[algorithmSelect.value];
  lastRun = algorithm.run(grid, start, end);
  const { visitedOrder, path, found } = lastRun;
  scrubInput.max = totalFrames(visitedOrder, path, found);
  scrubInput.disabled = false;

  const total = totalFrames(visitedOrder, path, found);
  for (let frame = 1; frame <= total; frame++) {
    applyFrame(frame);
    if (animationDelayMs > 0) await delay(animationDelayMs);
  }

  if (found) {
    setStatus(`Path found: ${path.length - 1} steps, ${visitedOrder.length} cells explored.`);
  } else {
    setStatus(`No path exists. ${visitedOrder.length} cells explored.`);
  }

  running = false;
  runBtn.disabled = false;
}

scrubInput.addEventListener("input", () => {
  if (!lastRun || running) return;
  applyFrame(Number(scrubInput.value));
  const { found, path } = lastRun;
  const atEnd = Number(scrubInput.value) === Number(scrubInput.max);
  if (atEnd) {
    setStatus(
      found
        ? `Path found: ${path.length - 1} steps, ${lastRun.visitedOrder.length} cells explored.`
        : `No path exists. ${lastRun.visitedOrder.length} cells explored.`
    );
  } else {
    setStatus("Scrubbing…");
  }
});

runBtn.addEventListener("click", run);

compareBtn.addEventListener("click", () => {
  const start = findNodeOfType(grid, START);
  const end = findNodeOfType(grid, END);
  if (!start || !end) {
    setStatus("Place both a start and an end before comparing.");
    return;
  }
  lastComparisonResults = compareAlgorithms(grid, start, end);
  renderComparison(lastComparisonResults);
  setStatus("Compared all algorithms on the current grid.");
});

downloadComparisonCsvBtn.addEventListener("click", () => {
  if (!lastComparisonResults) {
    setStatus("Compare all algorithms before downloading the comparison.");
    return;
  }
  const blob = new Blob([compareResultsToCsv(lastComparisonResults)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pathlight-comparison.csv";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded the comparison as CSV.");
});

clearPathBtn.addEventListener("click", () => {
  clearRunState();
  renderAll();
  setStatus("");
});

clearWallsBtn.addEventListener("click", () => {
  snapshotForUndo();
  grid = grid.map((row) =>
    row.map((cell) => (cell.type === WALL ? { ...cell, type: EMPTY, weight: 1 } : { ...cell, weight: 1 }))
  );
  clearRunState();
  clearComparison();
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

  resetHistory();
  clearRunState();
  clearComparison();
  renderAll();
  setStatus("");
});

// Only touches EMPTY cells — same rule the weighted-terrain brush follows — so it layers costly
// patches onto whatever walls (hand-drawn or from Generate maze) are already on the grid instead
// of overwriting them, and leaves the start/end markers at their default weight.
generateTerrainBtn.addEventListener("click", () => {
  snapshotForUndo();
  const weights = generateTerrain(ROWS, COLS);
  grid = grid.map((row, r) =>
    row.map((cell, c) => (cell.type === EMPTY ? { ...cell, weight: weights[r][c] } : cell))
  );

  clearRunState();
  clearComparison();
  renderAll();
  setStatus("");
});

saveGridBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(serializeGrid(grid), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pathlight-grid.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Saved the current grid.");
});

loadGridInput.addEventListener("change", () => {
  const file = loadGridInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = deserializeGrid(JSON.parse(reader.result), ROWS, COLS);
      grid = loaded;
      resetHistory();
      clearRunState();
      clearComparison();
      renderAll();
      setStatus(`Loaded "${file.name}".`);
    } catch (error) {
      setStatus(`Couldn't load "${file.name}": ${error.message}`);
    }
    loadGridInput.value = "";
  };
  reader.onerror = () => {
    setStatus(`Couldn't read "${file.name}".`);
    loadGridInput.value = "";
  };
  reader.readAsText(file);
});

copyShareLinkBtn.addEventListener("click", async () => {
  const url = buildShareUrl(grid, window.location.href);
  try {
    await navigator.clipboard.writeText(url);
    setStatus("Share link copied to clipboard.");
  } catch {
    // Clipboard access can be denied (permissions, insecure context, older browsers); falling
    // back to showing the link in the status line still lets it be copied by hand.
    setStatus(`Copy this link to share: ${url}`);
  }
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
    snapshotForUndo();
    drawValue = cell.type === WALL ? EMPTY : WALL;
    grid = setNodeType(grid, row, col, drawValue);
  } else {
    if (cell.type !== EMPTY) return false;
    snapshotForUndo();
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
    snapshotForUndo();
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

// { passive: false } so preventDefault can stop the touch from panning/zooming the page while
// drawing on the grid — the same reason gravity-garden's canvas sets touch-action: none.
gridEl.addEventListener(
  "touchstart",
  (event) => {
    const touch = event.touches[0];
    const pos = cellAtPoint(touch.clientX, touch.clientY);
    if (!pos) return;
    event.preventDefault();
    focusCell(pos.row, pos.col);
    isDrawing = activateCell(pos.row, pos.col);
  },
  { passive: false }
);

gridEl.addEventListener(
  "touchmove",
  (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const touch = event.touches[0];
    const pos = cellAtPoint(touch.clientX, touch.clientY);
    if (!pos) return;
    continueDraw(pos.row, pos.col);
  },
  { passive: false }
);

gridEl.addEventListener("touchend", () => {
  isDrawing = false;
});

gridEl.addEventListener("touchcancel", () => {
  isDrawing = false;
});

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

// If the page was opened from a share link, load the grid it encodes over the default empty
// one. A hand-edited or truncated link is rejected outright — same as "Load grid…" — rather
// than silently falling back to the default grid with no explanation.
const shareFragment = extractShareFragment(window.location.hash);
if (shareFragment !== null) {
  try {
    grid = decodeGridFromFragment(shareFragment, ROWS, COLS);
    resetHistory();
    setStatus("Loaded shared grid.");
  } catch (error) {
    setStatus(`Share link failed: ${error.message}`);
  }
  // The shared grid has now been applied (or its failure reported); clearing the hash means
  // refreshing the page afterward keeps whatever the grid has since become instead of
  // re-applying the same shared snapshot every reload.
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

buildGridDom();
renderAll();
speedValue.textContent = `${animationDelayMs}ms`;
