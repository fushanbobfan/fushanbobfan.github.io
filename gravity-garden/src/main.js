import { stepSimulation, totalEnergy, totalMomentum, mergeCollidingBodies } from "./physics.js";
import { PRESETS, listPresetNames } from "./presets.js";
import { createDiagnosticsHistory, resetDiagnosticsHistory, recordSample } from "./diagnostics.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const presetSelect = document.getElementById("preset");
const toggleBtn = document.getElementById("toggle-play");
const resetBtn = document.getElementById("reset");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const trailsCheckbox = document.getElementById("trails");
const statsEl = document.getElementById("stats");
const diagnosticsCheckbox = document.getElementById("show-diagnostics");
const diagnosticsPanel = document.getElementById("diagnostics-panel");
const diagnosticsChart = document.getElementById("diagnostics-chart");
const diagnosticsCtx = diagnosticsChart.getContext("2d");
const diagnosticsReadout = document.getElementById("diagnostics-readout");

const MAX_TRAIL_LENGTH = 400;
const BASE_DT = 0.05;

let currentPresetKey = "sun-and-planets";
let bodies = [];
let G = 1;
let softening = 4;
let running = true;
let speed = 1;
let showTrails = true;
let showDiagnostics = true;
const diagnosticsHistory = createDiagnosticsHistory();

for (const key of listPresetNames()) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = PRESETS[key].label;
  presetSelect.appendChild(option);
}
presetSelect.value = currentPresetKey;

function loadPreset(key) {
  const preset = PRESETS[key];
  currentPresetKey = key;
  G = preset.G;
  softening = preset.softening;
  bodies = preset.build().map((b) => ({ ...b, trail: [] }));
  resetDiagnosticsHistory(diagnosticsHistory);
}

function worldToScreen(x, y) {
  return { sx: canvas.width / 2 + x, sy: canvas.height / 2 + y };
}

function screenToWorld(sx, sy) {
  return { x: sx - canvas.width / 2, y: sy - canvas.height / 2 };
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

  for (const body of bodies) {
    const { sx, sy } = worldToScreen(body.x, body.y);
    ctx.beginPath();
    ctx.fillStyle = body.color;
    ctx.arc(sx, sy, body.radius, 0, Math.PI * 2);
    ctx.fill();
  }
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

function tick() {
  if (running) {
    const dt = BASE_DT * speed;
    stepSimulation(bodies, dt, G, softening);
    bodies = mergeCollidingBodies(bodies);

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

trailsCheckbox.addEventListener("change", () => {
  showTrails = trailsCheckbox.checked;
});

diagnosticsCheckbox.addEventListener("change", () => {
  showDiagnostics = diagnosticsCheckbox.checked;
  diagnosticsPanel.hidden = !showDiagnostics;
});

function addBodyAt(x, y) {
  bodies.push({
    mass: 40,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 5,
    color: "#f8961e",
    trail: [],
  });
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const sx = (event.clientX - rect.left) * scaleX;
  const sy = (event.clientY - rect.top) * scaleY;
  const { x, y } = screenToWorld(sx, sy);
  addBodyAt(x, y);
});

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
    case "ArrowUp":
      event.preventDefault();
      speedInput.value = Math.min(Number(speedInput.max), speed + 0.1).toFixed(1);
      speedInput.dispatchEvent(new Event("input"));
      break;
    case "ArrowDown":
      event.preventDefault();
      speedInput.value = Math.max(Number(speedInput.min), speed - 0.1).toFixed(1);
      speedInput.dispatchEvent(new Event("input"));
      break;
    default:
      break;
  }
});

loadPreset(currentPresetKey);
requestAnimationFrame(tick);
