// Canvas drawing for the flock. The colour helpers are pure so they can be
// tested; everything else takes a 2D context.

import { heading, length } from './vec.js';
import { THREAT_RADIUS } from './simulation.js';

export const COLOUR_MODES = Object.freeze(['heading', 'speed', 'plain']);

// Map an angle in radians to a hue in [0, 360).
export function hueFromHeading(theta) {
  const deg = (theta * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

// Map a speed fraction in [0, 1] to a hue from cool (220) to hot (0).
export function hueFromSpeed(fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  return 220 - 220 * f;
}

export function boidColour(boid, mode, maxSpeed) {
  if (mode === 'heading') return `hsl(${hueFromHeading(heading(boid.vel)).toFixed(0)} 85% 65%)`;
  if (mode === 'speed') return `hsl(${hueFromSpeed(length(boid.vel) / maxSpeed).toFixed(0)} 85% 62%)`;
  return '#d9e3ff';
}

export function drawBoid(ctx, boid, size, colour) {
  const angle = heading(boid.vel);
  ctx.save();
  ctx.translate(boid.x, boid.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, size * 0.55);
  ctx.lineTo(-size * 0.4, 0);
  ctx.lineTo(-size * 0.7, -size * 0.55);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();
}

export function drawThreat(ctx, threat) {
  if (!threat) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(threat.x, threat.y, THREAT_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 120, 120, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(threat.x, threat.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 120, 120, 0.9)';
  ctx.fill();
  ctx.restore();
}

// Draw one frame. With trails on, the previous frame is only partially
// cleared so each boid leaves a fading streak behind it.
export function drawFrame(ctx, sim, { boidSize = 6, trails = false, colourMode = 'heading', background = '#0b1020' } = {}) {
  const { width, height } = sim;
  ctx.save();
  if (trails) {
    ctx.fillStyle = 'rgba(11, 16, 32, 0.18)';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
  for (const b of sim.boids) {
    drawBoid(ctx, b, boidSize, boidColour(b, colourMode, sim.params.maxSpeed));
  }
  drawThreat(ctx, sim.threat);
}
