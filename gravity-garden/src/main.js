import { stepSimulation, totalEnergy, mergeCollidingBodies } from "./physics.js";
import { PRESETS, listPresetNames } from "./presets.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const presetSelect = document.getElementById("preset");
const toggleBtn = document.getElementById("toggle-play");
const resetBtn = document.getElementById("reset");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const trailsCheckbox = document.getElementById("trails");
const statsEl = document.getElementById("stats");

const MAX_TRAIL_LENGTH = 400;
const BASE_DT = 0.05;

let currentPresetKey = "sun-and-planets";
let bodies = [];
let G = 1;
let softening = 4;
let running = true;
let speed = 1;
let showTrails = true;

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
  }

  draw();
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

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const sx = (event.clientX - rect.left) * scaleX;
  const sy = (event.clientY - rect.top) * scaleY;
  const { x, y } = screenToWorld(sx, sy);

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
});

loadPreset(currentPresetKey);
requestAnimationFrame(tick);
