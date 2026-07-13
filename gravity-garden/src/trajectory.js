// Forecasts where each body is headed by re-running the same integrator used for the live
// simulation on a throwaway copy of the current state. This has no notion of rendering or
// timing beyond what it's handed, so it can run on a snapshot taken at any point (paused or
// not) without touching the real simulation.

import { stepSimulation } from "./physics.js";

/**
 * @param {{mass:number,x:number,y:number,vx:number,vy:number}[]} bodies current state,
 *   left untouched
 * @param {number} steps how many integration steps to forecast
 * @param {number} dt
 * @param {number} G
 * @param {number} softening
 * @returns {{x:number,y:number}[][]} one path per body (index-aligned with `bodies`),
 *   each starting with the body's current position and holding `steps + 1` points
 *
 * Note: this does not run collision merging, so a forecast through a close encounter shows
 * the bodies' unmerged gravitational paths rather than predicting the merge itself.
 */
export function predictTrajectory(bodies, steps, dt, G, softening) {
  const clones = bodies.map((b) => ({ mass: b.mass, x: b.x, y: b.y, vx: b.vx, vy: b.vy }));
  const paths = clones.map((b) => [{ x: b.x, y: b.y }]);

  for (let i = 0; i < steps; i++) {
    stepSimulation(clones, dt, G, softening);
    clones.forEach((b, idx) => paths[idx].push({ x: b.x, y: b.y }));
  }

  return paths;
}
