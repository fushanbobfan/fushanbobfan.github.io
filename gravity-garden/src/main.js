import { stepSimulation, totalEnergy, totalMomentum, mergeCollidingBodies } from "./physics.js";
import { PRESETS, listPresetNames } from "./presets.js";
import { createDiagnosticsHistory, resetDiagnosticsHistory, recordSample } from "./diagnostics.js";
import { predictTrajectory } from "./trajectory.js";
import { findBodyAtPoint, describeBody, adjacentBodyId, removeBody, parseMassInput } from "./inspector.js";
import { serializeScenario, deserializeScenario } from "./scenario.js";
import { createHistory, pushHistory, popHistory, canUndo } from "./history.js";
import {
  listSavedScenarioNames,
  saveScenarioToStorage,
  loadScenarioFromStorage,
  deleteScenarioFromStorage,
} from "./storage.js";
import { launchVelocityFrom } from "./launch.js";
import { buildShareUrl, extractShareFragment, decodeScenarioFromFragment } from "./shareLink.js";
import { describeMerge, describeRemoval } from "./announcements.js";
import {
  createViewport,
  worldToScreen as vpWorldToScreen,
  screenToWorld as vpScreenToWorld,
  panBy,
  zoomAt,
  resetViewport,
  touchDistance,
  touchMidpoint,
  frameBodies,
} from "./viewport.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const presetSelect = document.getElementById("preset");
const toggleBtn = document.getElementById("toggle-play");
const resetBtn = document.getElementById("reset");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const gravityInput = document.getElementById("gravity");
const gravityValue = document.getElementById("gravity-value");
const softeningInput = document.getElementById("softening");
const softeningValue = document.getElementById("softening-value");
const trailsCheckbox = document.getElementById("trails");
const statsEl = document.getElementById("stats");
const diagnosticsCheckbox = document.getElementById("show-diagnostics");
const diagnosticsPanel = document.getElementById("diagnostics-panel");
const diagnosticsChart = document.getElementById("diagnostics-chart");
const diagnosticsCtx = diagnosticsChart.getContext("2d");
const diagnosticsReadout = document.getElementById("diagnostics-readout");
const predictCheckbox = document.getElementById("predict");
const inspectorPanel = document.getElementById("inspector-panel");
const inspectorReadout = document.getElementById("inspector-readout");
const massInput = document.getElementById("mass-input");
const deselectBtn = document.getElementById("deselect");
const removeBodyBtn = document.getElementById("remove-body");
const resetViewBtn = document.getElementById("reset-view");
const frameBodiesBtn = document.getElementById("frame-bodies");
const zoomValue = document.getElementById("zoom-value");
const followCheckbox = document.getElementById("follow-selected");
const exportBtn = document.getElementById("export-scenario");
const importBtn = document.getElementById("import-scenario");
const importFileInput = document.getElementById("import-scenario-file");
const copyShareLinkBtn = document.getElementById("copy-share-link");
const scenarioIoStatus = document.getElementById("scenario-io-status");
const saveNameInput = document.getElementById("save-name");
const saveScenarioBtn = document.getElementById("save-scenario");
const savedScenariosSelect = document.getElementById("saved-scenarios");
const loadScenarioBtn = document.getElementById("load-scenario");
const deleteScenarioBtn = document.getElementById("delete-scenario");
const announcer = document.getElementById("sim-announcer");
const undoBtn = document.getElementById("undo");

const MAX_TRAIL_LENGTH = 400;
const UNDO_HISTORY_SIZE = 20;
const PAN_STEP = 40;
const BASE_DT = 0.05;
const PREDICTION_STEPS = 150;
// Recomputing every tick is cheap even for the largest preset, but throttling avoids
// wasted work if someone clicks a burst of new bodies into the scene in one frame.
const PREDICTION_RECOMPUTE_INTERVAL = 10;

let currentPresetKey = "sun-and-planets";
let bodies = [];
let G = 1;
let softening = 4;
let running = true;
let speed = 1;
let showTrails = true;
let showDiagnostics = true;
let showPrediction = false;
let predictedPaths = [];
let ticksSincePrediction = Infinity;
let lastPredictedBodyCount = -1;
let nextBodyId = 1;
let selectedBodyId = null;
let followSelected = false;
let viewport = createViewport();
let undoHistory = createHistory(UNDO_HISTORY_SIZE);
// While set, a mouse or touch drag that started on this body previews a launch velocity
// (see the mousedown/touchstart handlers below) instead of panning the view.
let aimingBodyId = null;
let aimPointerWorld = null;
const diagnosticsHistory = createDiagnosticsHistory();

for (const key of listPresetNames()) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = PRESETS[key].label;
  presetSelect.appendChild(option);
}
presetSelect.value = currentPresetKey;

// Keeps the G and softening sliders (and their readouts) in sync whenever those values
// change from somewhere other than dragging the slider itself — loading a preset, resetting,
// importing a file, or restoring an undo snapshot. Setting `.value` past a slider's min/max
// clamps to that bound (a browser range input's native behavior), so an out-of-range imported
// value is visually pinned at the extreme without altering the actual running G/softening.
function updateGravityReadouts() {
  gravityInput.value = G;
  gravityValue.textContent = G.toFixed(1);
  softeningInput.value = softening;
  softeningValue.textContent = softening.toFixed(1);
}

function loadPreset(key) {
  const preset = PRESETS[key];
  currentPresetKey = key;
  G = preset.G;
  softening = preset.softening;
  bodies = preset.build().map((b) => ({ ...b, trail: [], id: nextBodyId++ }));
  resetDiagnosticsHistory(diagnosticsHistory);
  predictedPaths = [];
  lastPredictedBodyCount = -1;
  selectedBodyId = null;
  viewport = resetViewport();
  undoHistory = createHistory(UNDO_HISTORY_SIZE);
  updateUndoButton();
  updateGravityReadouts();
}

function worldToScreen(x, y) {
  return vpWorldToScreen(viewport, canvas.width, canvas.height, x, y);
}

function screenToWorld(sx, sy) {
  return vpScreenToWorld(viewport, canvas.width, canvas.height, sx, sy);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (showTrails) {
    for (const body of bodies) {
      if (body.trail.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = body.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      const start = worldToScreen(body.trail[0].x, body.trail[0].y);
      ctx.moveTo(start.sx, start.sy);
      for (let i = 1; i < body.trail.length; i++) {
        const p = worldToScreen(body.trail[i].x, body.trail[i].y);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  if (showPrediction && predictedPaths.length === bodies.length) {
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.5;
    bodies.forEach((body, i) => {
      const path = predictedPaths[i];
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = body.color;
      ctx.lineWidth = 1;
      const start = worldToScreen(path[0].x, path[0].y);
      ctx.moveTo(start.sx, start.sy);
      for (let j = 1; j < path.length; j++) {
        const p = worldToScreen(path[j].x, path[j].y);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  for (const body of bodies) {
    const { sx, sy } = worldToScreen(body.x, body.y);
    const screenRadius = body.radius * viewport.zoom;
    ctx.beginPath();
    ctx.fillStyle = body.color;
    ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
    ctx.fill();

    if (body.id === selectedBodyId) {
      ctx.beginPath();
      ctx.strokeStyle = "#e8ecf4";
      ctx.lineWidth = 1.5;
      ctx.arc(sx, sy, screenRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (aimingBodyId !== null && aimPointerWorld) {
    const body = bodies.find((b) => b.id === aimingBodyId);
    if (body) drawAimLine(body);
  }
}

// A dashed line from the grabbed body to the pointer, with a dot at the pointer end,
// mirroring the dashed predicted-path styling used elsewhere so it reads as a preview
// rather than something already part of the simulation.
function drawAimLine(body) {
  const from = worldToScreen(body.x, body.y);
  const to = worldToScreen(aimPointerWorld.x, aimPointerWorld.y);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#e8ecf4";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(from.sx, from.sy);
  ctx.lineTo(to.sx, to.sy);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = "#e8ecf4";
  ctx.beginPath();
  ctx.arc(to.sx, to.sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrace(samples, key, color, scale) {
  if (samples.length < 2) return;
  const w = diagnosticsChart.width;
  const h = diagnosticsChart.height;
  const midY = h / 2;

  diagnosticsCtx.beginPath();
  diagnosticsCtx.strokeStyle = color;
  diagnosticsCtx.lineWidth = 1.5;
  samples.forEach((sample, i) => {
    const x = (i / (diagnosticsHistory.maxLength - 1)) * w;
    const y = midY - (sample[key] / scale) * midY;
    if (i === 0) diagnosticsCtx.moveTo(x, y);
    else diagnosticsCtx.lineTo(x, y);
  });
  diagnosticsCtx.stroke();
}

function drawDiagnostics() {
  const w = diagnosticsChart.width;
  const h = diagnosticsChart.height;
  diagnosticsCtx.clearRect(0, 0, w, h);

  // Zero line, since "no drift" is the whole point of the chart.
  diagnosticsCtx.strokeStyle = "#232a3d";
  diagnosticsCtx.lineWidth = 1;
  diagnosticsCtx.beginPath();
  diagnosticsCtx.moveTo(0, h / 2);
  diagnosticsCtx.lineTo(w, h / 2);
  diagnosticsCtx.stroke();

  const samples = diagnosticsHistory.samples;
  if (samples.length === 0) return;

  // Auto-scale each trace to its own largest magnitude so slow drift is still visible,
  // with a small floor so a perfectly flat trace doesn't divide by zero.
  const energyScale = Math.max(...samples.map((s) => Math.abs(s.energyDriftPct)), 1e-6);
  const momentumScale = Math.max(...samples.map((s) => Math.abs(s.momentumDrift)), 1e-6);

  drawTrace(samples, "energyDriftPct", "#f8961e", energyScale);
  drawTrace(samples, "momentumDrift", "#4cc9f0", momentumScale);
}

function updateInspectorPanel() {
  const selected = bodies.find((b) => b.id === selectedBodyId);
  inspectorPanel.hidden = !selected;
  if (!selected) return;

  const info = describeBody(selected);
  inspectorReadout.textContent =
    `position: (${info.x.toFixed(1)}, ${info.y.toFixed(1)})\n` +
    `speed: ${info.speed.toFixed(2)}\n` +
    `kinetic energy: ${info.kineticEnergy.toFixed(1)}`;

  // Leave the field alone while the user is actively editing it, so a tick landing between
  // keystrokes doesn't stomp on a value they haven't finished typing yet.
  if (document.activeElement !== massInput) {
    massInput.value = info.mass;
  }
}

function tick() {
  if (running) {
    const dt = BASE_DT * speed;
    stepSimulation(bodies, dt, G, softening);
    const countBeforeMerge = bodies.length;
    bodies = mergeCollidingBodies(bodies);
    const mergeAnnouncement = describeMerge(countBeforeMerge, bodies.length);
    if (mergeAnnouncement) announcer.textContent = mergeAnnouncement;

    // Merging fuses two bodies into a new one with no id of its own, so a
    // selection pointed at either parent no longer resolves to anything.
    if (selectedBodyId !== null && !bodies.some((b) => b.id === selectedBodyId)) {
      selectedBodyId = null;
    }

    for (const body of bodies) {
      if (showTrails) {
        body.trail.push({ x: body.x, y: body.y });
        if (body.trail.length > MAX_TRAIL_LENGTH) body.trail.shift();
      } else if (body.trail.length) {
        body.trail.length = 0;
      }
    }

    const energy = totalEnergy(bodies, G, softening);
    const { px, py } = totalMomentum(bodies);
    const sample = recordSample(diagnosticsHistory, energy, Math.hypot(px, py));

    if (showDiagnostics) {
      diagnosticsReadout.textContent =
        `energy drift: ${sample.energyDriftPct.toFixed(2)}%\n` +
        `momentum drift: ${sample.momentumDrift.toFixed(3)}`;
    }
  }

  if (showPrediction) {
    ticksSincePrediction++;
    if (bodies.length !== lastPredictedBodyCount || ticksSincePrediction >= PREDICTION_RECOMPUTE_INTERVAL) {
      predictedPaths = predictTrajectory(bodies, PREDICTION_STEPS, BASE_DT * speed, G, softening);
      lastPredictedBodyCount = bodies.length;
      ticksSincePrediction = 0;
    }
  }

  if (followSelected && selectedBodyId !== null) {
    const selected = bodies.find((b) => b.id === selectedBodyId);
    if (selected) viewport = { ...viewport, panX: selected.x, panY: selected.y };
  }

  updateInspectorPanel();
  draw();
  if (showDiagnostics) drawDiagnostics();
  statsEl.textContent =
    `bodies: ${bodies.length}\n` + `energy: ${totalEnergy(bodies, G, softening).toFixed(1)}`;

  requestAnimationFrame(tick);
}

presetSelect.addEventListener("change", () => {
  loadPreset(presetSelect.value);
});

toggleBtn.addEventListener("click", () => {
  running = !running;
  toggleBtn.textContent = running ? "Pause" : "Play";
  toggleBtn.setAttribute("aria-pressed", String(!running));
});

resetBtn.addEventListener("click", () => {
  loadPreset(currentPresetKey);
});

speedInput.addEventListener("input", () => {
  speed = Number(speedInput.value);
  speedValue.textContent = `${speed.toFixed(1)}×`;
});

gravityInput.addEventListener("input", () => {
  G = Number(gravityInput.value);
  gravityValue.textContent = G.toFixed(1);
});

softeningInput.addEventListener("input", () => {
  softening = Number(softeningInput.value);
  softeningValue.textContent = softening.toFixed(1);
});

trailsCheckbox.addEventListener("change", () => {
  showTrails = trailsCheckbox.checked;
});

diagnosticsCheckbox.addEventListener("change", () => {
  showDiagnostics = diagnosticsCheckbox.checked;
  diagnosticsPanel.hidden = !showDiagnostics;
});

predictCheckbox.addEventListener("change", () => {
  showPrediction = predictCheckbox.checked;
  ticksSincePrediction = Infinity;
});

followCheckbox.addEventListener("change", () => {
  followSelected = followCheckbox.checked;
});

deselectBtn.addEventListener("click", () => {
  selectedBodyId = null;
});

// Records the current bodies/G/softening (reusing scenario.js's serialization, so undo
// doesn't need its own notion of what a "state" is) before a discrete, reversible action —
// adding, removing, launching, or editing a body's mass. Skipped around actions that replace
// the whole scenario (loadPreset, applyScenario), which clear the stack instead: undoing back
// into a scenario the current one replaced would restore bodies from a different simulation.
function snapshotForUndo() {
  undoHistory = pushHistory(undoHistory, serializeScenario({ bodies, G, softening, viewport }));
  updateUndoButton();
}

function updateUndoButton() {
  undoBtn.disabled = !canUndo(undoHistory);
}

function undo() {
  const { snapshot, history: after } = popHistory(undoHistory);
  if (!snapshot) return;
  undoHistory = after;
  const restored = deserializeScenario(snapshot);
  G = restored.G;
  softening = restored.softening;
  bodies = restored.bodies.map((b) => ({ ...b, trail: [], id: nextBodyId++ }));
  selectedBodyId = null;
  updateUndoButton();
  updateGravityReadouts();
}

undoBtn.addEventListener("click", undo);

function removeSelectedBody() {
  if (selectedBodyId == null) return;
  snapshotForUndo();
  bodies = removeBody(bodies, selectedBodyId);
  selectedBodyId = null;
  announcer.textContent = describeRemoval(bodies.length);
}

removeBodyBtn.addEventListener("click", removeSelectedBody);

// Fires on blur/Enter rather than every keystroke, so a value like "150" doesn't get rejected
// (or momentarily applied) partway through typing it.
massInput.addEventListener("change", () => {
  const body = bodies.find((b) => b.id === selectedBodyId);
  if (!body) return;
  const mass = parseMassInput(massInput.value);
  if (mass === null) {
    massInput.value = body.mass;
    return;
  }
  snapshotForUndo();
  body.mass = mass;
});

function updateZoomReadout() {
  zoomValue.textContent = `${viewport.zoom.toFixed(1)}×`;
}

resetViewBtn.addEventListener("click", () => {
  viewport = resetViewport();
  updateZoomReadout();
});

// Framing all bodies would otherwise be immediately undone by "keep centered"
// re-panning to the selected body on the very next tick, so this turns that
// off first, the same way manualPanBy does for a drag or arrow-key pan.
frameBodiesBtn.addEventListener("click", () => {
  followSelected = false;
  followCheckbox.checked = false;
  viewport = frameBodies(bodies, canvas.width, canvas.height);
  updateZoomReadout();
});

exportBtn.addEventListener("click", () => {
  const snapshot = serializeScenario({ bodies, G, softening, viewport });
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gravity-garden-scenario.json";
  link.click();
  URL.revokeObjectURL(url);
  scenarioIoStatus.textContent = `Exported ${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}.`;
});

importBtn.addEventListener("click", () => {
  importFileInput.click();
});

// Replaces the running simulation with a validated scenario (from an imported file or a
// local save), shared by both since they only differ in where the raw JSON came from.
function applyScenario(restored) {
  G = restored.G;
  softening = restored.softening;
  bodies = restored.bodies.map((b) => ({ ...b, trail: [], id: nextBodyId++ }));
  viewport = restored.viewport;
  resetDiagnosticsHistory(diagnosticsHistory);
  predictedPaths = [];
  lastPredictedBodyCount = -1;
  selectedBodyId = null;
  undoHistory = createHistory(UNDO_HISTORY_SIZE);
  updateUndoButton();
  updateZoomReadout();
  updateGravityReadouts();
}

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyScenario(deserializeScenario(JSON.parse(reader.result)));
      scenarioIoStatus.textContent = `Imported ${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}.`;
    } catch (err) {
      scenarioIoStatus.textContent = `Import failed: ${err.message}`;
    }
  };
  reader.onerror = () => {
    scenarioIoStatus.textContent = "Import failed: could not read the file.";
  };
  reader.readAsText(file);

  // Reset so choosing the same file again still fires a "change" event.
  importFileInput.value = "";
});

copyShareLinkBtn.addEventListener("click", async () => {
  const url = buildShareUrl({ bodies, G, softening, viewport }, window.location.href);
  try {
    await navigator.clipboard.writeText(url);
    scenarioIoStatus.textContent = "Share link copied to clipboard.";
  } catch {
    // Clipboard access can be denied (permissions, insecure context, older browsers); fall
    // back to putting the link itself in the status line so it can still be copied by hand.
    scenarioIoStatus.textContent = `Copy this link to share: ${url}`;
  }
});

// Repopulates the saved-scenarios dropdown from storage, preserving the previous
// selection if it still exists, and enables/disables Load and Delete accordingly.
function refreshSavedScenariosList(selectName) {
  const names = listSavedScenarioNames(window.localStorage);
  savedScenariosSelect.innerHTML = "";

  if (names.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saves yet";
    savedScenariosSelect.appendChild(option);
  } else {
    for (const name of names) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      savedScenariosSelect.appendChild(option);
    }
    if (selectName && names.includes(selectName)) {
      savedScenariosSelect.value = selectName;
    }
  }

  loadScenarioBtn.disabled = names.length === 0;
  deleteScenarioBtn.disabled = names.length === 0;
}

saveScenarioBtn.addEventListener("click", () => {
  try {
    const name = saveNameInput.value;
    saveScenarioToStorage(window.localStorage, name, serializeScenario({ bodies, G, softening, viewport }));
    scenarioIoStatus.textContent = `Saved "${name.trim()}" in this browser.`;
    saveNameInput.value = "";
    refreshSavedScenariosList(name.trim());
  } catch (err) {
    scenarioIoStatus.textContent = `Save failed: ${err.message}`;
  }
});

loadScenarioBtn.addEventListener("click", () => {
  const name = savedScenariosSelect.value;
  if (!name) return;
  try {
    applyScenario(deserializeScenario(loadScenarioFromStorage(window.localStorage, name)));
    scenarioIoStatus.textContent = `Loaded "${name}" (${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}).`;
  } catch (err) {
    scenarioIoStatus.textContent = `Load failed: ${err.message}`;
  }
});

deleteScenarioBtn.addEventListener("click", () => {
  const name = savedScenariosSelect.value;
  if (!name) return;
  deleteScenarioFromStorage(window.localStorage, name);
  scenarioIoStatus.textContent = `Deleted "${name}".`;
  refreshSavedScenariosList();
});

refreshSavedScenariosList();

// If the page was opened from a share link, load the scenario it encodes over the default
// preset. Runs after the rest of the scenario I/O wiring above so applyScenario is ready, and
// clears the hash afterward so refreshing the page doesn't reapply it over further edits.
const shareFragment = extractShareFragment(window.location.hash);
if (shareFragment !== null) {
  try {
    applyScenario(decodeScenarioFromFragment(shareFragment));
    scenarioIoStatus.textContent = `Loaded shared scenario (${bodies.length} ${bodies.length === 1 ? "body" : "bodies"}).`;
  } catch (err) {
    scenarioIoStatus.textContent = `Share link failed: ${err.message}`;
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

function addBodyAt(x, y) {
  snapshotForUndo();
  bodies.push({
    mass: 40,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 5,
    color: "#f8961e",
    trail: [],
    id: nextBodyId++,
  });
}

function selectBody(id) {
  selectedBodyId = selectedBodyId === id ? null : id;
}

const DRAG_THRESHOLD = 4;
let isPointerDown = false;
let dragMoved = false;
let lastDragPoint = null;

let isTouchDown = false;
let touchDragMoved = false;
let lastTouchPoint = null;
let pinching = false;
let lastPinchDistance = null;

function canvasScale() {
  const rect = canvas.getBoundingClientRect();
  return { rect, scaleX: canvas.width / rect.width, scaleY: canvas.height / rect.height };
}

// Manual panning and "keep centered" both drive the same viewport, and would
// otherwise fight each other every tick, so taking the wheel manually turns
// auto-follow back off.
function manualPanBy(dxScreen, dyScreen) {
  if (followSelected) {
    followSelected = false;
    followCheckbox.checked = false;
  }
  viewport = panBy(viewport, dxScreen, dyScreen);
}

// Converts a client-space point (from a mouse or touch event) to world coordinates.
function clientPointToWorld(clientX, clientY) {
  const { rect, scaleX, scaleY } = canvasScale();
  const sx = (clientX - rect.left) * scaleX;
  const sy = (clientY - rect.top) * scaleY;
  return screenToWorld(sx, sy);
}

canvas.addEventListener("mousedown", (event) => {
  isPointerDown = true;
  dragMoved = false;
  lastDragPoint = { x: event.clientX, y: event.clientY };

  // Starting the drag on an existing body aims a launch instead of panning the view,
  // so grabbing a body always affects that body rather than whatever's under the
  // pointer when the drag ends.
  const { x, y } = clientPointToWorld(event.clientX, event.clientY);
  const hit = findBodyAtPoint(bodies, x, y);
  aimingBodyId = hit ? hit.id : null;
});

window.addEventListener("mousemove", (event) => {
  if (!isPointerDown) return;
  const dx = event.clientX - lastDragPoint.x;
  const dy = event.clientY - lastDragPoint.y;
  if (!dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

  dragMoved = true;
  lastDragPoint = { x: event.clientX, y: event.clientY };

  if (aimingBodyId !== null) {
    aimPointerWorld = clientPointToWorld(event.clientX, event.clientY);
    canvas.classList.add("aiming");
    return;
  }

  const { scaleX, scaleY } = canvasScale();
  manualPanBy(dx * scaleX, dy * scaleY);
  canvas.classList.add("panning");
});

window.addEventListener("mouseup", () => {
  applyAimedLaunch(dragMoved);
  isPointerDown = false;
  canvas.classList.remove("panning");
  canvas.classList.remove("aiming");
});

// If the drag that's ending was an aim (not a plain click/tap), sets the grabbed body's
// velocity from where it was released and selects it so the inspector reflects the new
// speed immediately. A click or tap that never crossed the drag threshold leaves `moved`
// false, so it falls through to tapAt's normal select/drop handling instead. `moved` is
// passed in rather than read from module state because mouse and touch track it in
// separate flags (dragMoved vs. touchDragMoved).
function applyAimedLaunch(moved) {
  if (aimingBodyId === null || !moved || !aimPointerWorld) {
    aimingBodyId = null;
    aimPointerWorld = null;
    return;
  }

  const body = bodies.find((b) => b.id === aimingBodyId);
  if (body) {
    snapshotForUndo();
    const { vx, vy } = launchVelocityFrom(body.x, body.y, aimPointerWorld.x, aimPointerWorld.y);
    body.vx = vx;
    body.vy = vy;
    selectedBodyId = body.id;
  }

  aimingBodyId = null;
  aimPointerWorld = null;
}

// Shared by mouse clicks and touch taps: selects the body under the point,
// or drops a new one if the point is empty space.
function tapAt(clientX, clientY) {
  const { x, y } = clientPointToWorld(clientX, clientY);

  const hit = findBodyAtPoint(bodies, x, y);
  if (hit) {
    selectBody(hit.id);
  } else {
    addBodyAt(x, y);
  }
}

canvas.addEventListener("click", (event) => {
  // A click that ended a drag pans the view; it shouldn't also select or
  // drop a body under the pointer's final position.
  if (dragMoved) {
    dragMoved = false;
    return;
  }

  tapAt(event.clientX, event.clientY);
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const { rect, scaleX, scaleY } = canvasScale();
    const sx = (event.clientX - rect.left) * scaleX;
    const sy = (event.clientY - rect.top) * scaleY;
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    viewport = zoomAt(viewport, canvas.width, canvas.height, sx, sy, factor);
    updateZoomReadout();
  },
  { passive: false }
);

function touchPoint(touch) {
  return { x: touch.clientX, y: touch.clientY };
}

// One finger pans and taps (mirroring mousedown/mousemove/click); two fingers pinch-zoom
// around their midpoint (mirroring wheel). `{ passive: false }` plus preventDefault keeps
// the browser from scrolling the page or firing synthetic mouse events for the same
// gesture, since #stage already sets `touch-action: none`.
canvas.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    if (event.touches.length === 1) {
      isTouchDown = true;
      touchDragMoved = false;
      pinching = false;
      lastTouchPoint = touchPoint(event.touches[0]);

      const { x, y } = clientPointToWorld(lastTouchPoint.x, lastTouchPoint.y);
      const hit = findBodyAtPoint(bodies, x, y);
      aimingBodyId = hit ? hit.id : null;
    } else if (event.touches.length === 2) {
      isTouchDown = false;
      pinching = true;
      aimingBodyId = null;
      aimPointerWorld = null;
      lastPinchDistance = touchDistance(touchPoint(event.touches[0]), touchPoint(event.touches[1]));
    }
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
    if (pinching && event.touches.length >= 2) {
      const a = touchPoint(event.touches[0]);
      const b = touchPoint(event.touches[1]);
      const distance = touchDistance(a, b);
      const mid = touchMidpoint(a, b);
      const { rect, scaleX, scaleY } = canvasScale();
      const sx = (mid.x - rect.left) * scaleX;
      const sy = (mid.y - rect.top) * scaleY;
      viewport = zoomAt(viewport, canvas.width, canvas.height, sx, sy, distance / lastPinchDistance);
      updateZoomReadout();
      lastPinchDistance = distance;
    } else if (isTouchDown && event.touches.length === 1) {
      const point = touchPoint(event.touches[0]);
      const dx = point.x - lastTouchPoint.x;
      const dy = point.y - lastTouchPoint.y;
      if (!touchDragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      touchDragMoved = true;
      lastTouchPoint = point;

      if (aimingBodyId !== null) {
        aimPointerWorld = clientPointToWorld(point.x, point.y);
        canvas.classList.add("aiming");
        return;
      }

      const { scaleX, scaleY } = canvasScale();
      manualPanBy(dx * scaleX, dy * scaleY);
      canvas.classList.add("panning");
    }
  },
  { passive: false }
);

function endTouch(event) {
  event.preventDefault();
  // A single touch that never moved past the drag threshold is a tap; drop or select a
  // body at it. A pinch ending, or a pan/aim that already moved, isn't a tap.
  if (isTouchDown && !touchDragMoved && !pinching && event.changedTouches.length > 0) {
    const point = touchPoint(event.changedTouches[0]);
    tapAt(point.x, point.y);
  }
  applyAimedLaunch(touchDragMoved);

  // Lifting one finger of a two-finger pinch, or ending a pan early, just ends the
  // current gesture rather than trying to hand off into the other mode mid-touch.
  isTouchDown = false;
  touchDragMoved = false;
  pinching = false;
  lastTouchPoint = null;
  canvas.classList.remove("panning");
  canvas.classList.remove("aiming");
}

canvas.addEventListener("touchend", endTouch, { passive: false });
canvas.addEventListener("touchcancel", endTouch, { passive: false });

// Dropping a body by clicking the canvas has no keyboard equivalent otherwise, so Enter/Space
// on the focused canvas drops one at a random point within its bounds. Stops the event from
// reaching the document-level shortcut handler below, since Space is also the play/pause key.
canvas.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  const { x, y } = screenToWorld(Math.random() * canvas.width, Math.random() * canvas.height);
  addBodyAt(x, y);
});

const FORM_CONTROL_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);

// Global shortcuts for the transport controls, so the simulation can be driven without a
// mouse. Skipped while a form control has focus so arrow keys keep working on the speed
// slider and Enter/Space keep working on buttons and the canvas handler above.
document.addEventListener("keydown", (event) => {
  if (FORM_CONTROL_TAGS.has(document.activeElement?.tagName)) return;

  switch (event.key) {
    case " ":
      event.preventDefault();
      toggleBtn.click();
      break;
    case "r":
    case "R":
      resetBtn.click();
      break;
    case "f":
    case "F":
      frameBodiesBtn.click();
      break;
    case "u":
    case "U":
      undoBtn.click();
      break;
    case "t":
    case "T":
      trailsCheckbox.checked = !trailsCheckbox.checked;
      trailsCheckbox.dispatchEvent(new Event("change"));
      break;
    case "c":
    case "C":
      diagnosticsCheckbox.checked = !diagnosticsCheckbox.checked;
      diagnosticsCheckbox.dispatchEvent(new Event("change"));
      break;
    case "p":
    case "P":
      predictCheckbox.checked = !predictCheckbox.checked;
      predictCheckbox.dispatchEvent(new Event("change"));
      break;
    case "]":
      selectedBodyId = adjacentBodyId(bodies, selectedBodyId, 1);
      break;
    case "[":
      selectedBodyId = adjacentBodyId(bodies, selectedBodyId, -1);
      break;
    case "Escape":
      selectedBodyId = null;
      break;
    case "Delete":
    case "Backspace":
      // Backspace's default action is "navigate back" outside a text field, which would
      // otherwise leave the page when removing a body with nothing focused.
      event.preventDefault();
      removeSelectedBody();
      break;
    case "ArrowUp":
      event.preventDefault();
      if (event.shiftKey) {
        manualPanBy(0, PAN_STEP);
      } else {
        speedInput.value = Math.min(Number(speedInput.max), speed + 0.1).toFixed(1);
        speedInput.dispatchEvent(new Event("input"));
      }
      break;
    case "ArrowDown":
      event.preventDefault();
      if (event.shiftKey) {
        manualPanBy(0, -PAN_STEP);
      } else {
        speedInput.value = Math.max(Number(speedInput.min), speed - 0.1).toFixed(1);
        speedInput.dispatchEvent(new Event("input"));
      }
      break;
    case "ArrowLeft":
      event.preventDefault();
      manualPanBy(PAN_STEP, 0);
      break;
    case "ArrowRight":
      event.preventDefault();
      manualPanBy(-PAN_STEP, 0);
      break;
    case "+":
    case "=":
      viewport = zoomAt(viewport, canvas.width, canvas.height, canvas.width / 2, canvas.height / 2, 1.2);
      updateZoomReadout();
      break;
    case "-":
      viewport = zoomAt(viewport, canvas.width, canvas.height, canvas.width / 2, canvas.height / 2, 1 / 1.2);
      updateZoomReadout();
      break;
    case "0":
      viewport = resetViewport();
      updateZoomReadout();
      break;
    default:
      break;
  }
});

loadPreset(currentPresetKey);
updateZoomReadout();
requestAnimationFrame(tick);
