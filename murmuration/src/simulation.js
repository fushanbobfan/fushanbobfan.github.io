// The flock itself: owns the boids, advances them one frame at a time, and
// keeps the world bounds. Rendering lives elsewhere so this file can be
// tested headlessly.

import { SpatialHash } from './spatialHash.js';
import { DEFAULT_PARAMS, flockingForce, flee, avoidEdges } from './flock.js';
import { add, limit, fromAngle } from './vec.js';
import { createRng, randomRange } from './rng.js';

export const EDGE_MODES = Object.freeze(['avoid', 'wrap']);
export const EDGE_MARGIN = 40;
export const THREAT_RADIUS = 120;

export class Simulation {
  constructor({ width, height, count = 200, seed = 1, params = {}, edgeMode = 'avoid' } = {}) {
    if (!(width > 0) || !(height > 0)) throw new RangeError('width and height must be positive');
    this.width = width;
    this.height = height;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.edgeMode = edgeMode;
    this.threat = null;
    this.seed = seed;
    this.rng = createRng(seed);
    this.boids = [];
    this.hash = new SpatialHash(this.params.perception);
    this.tick = 0;
    this.nextId = 0;
    this.setCount(count);
  }

  setEdgeMode(mode) {
    if (!EDGE_MODES.includes(mode)) throw new RangeError(`unknown edge mode: ${mode}`);
    this.edgeMode = mode;
  }

  setParams(patch) {
    this.params = { ...this.params, ...patch };
    if (this.hash.cellSize !== this.params.perception) {
      this.hash = new SpatialHash(this.params.perception);
    }
  }

  // Set or clear the point the flock flees from (screen-space coordinates).
  setThreat(point) {
    this.threat = point ? { x: point.x, y: point.y } : null;
  }

  spawnBoid() {
    const speed = randomRange(this.rng, this.params.maxSpeed * 0.5, this.params.maxSpeed);
    return {
      id: this.nextId++,
      x: randomRange(this.rng, 0, this.width),
      y: randomRange(this.rng, 0, this.height),
      vel: fromAngle(randomRange(this.rng, 0, Math.PI * 2), speed),
    };
  }

  // Grow or shrink the flock in place so existing boids keep flying.
  setCount(count) {
    const n = Math.max(0, Math.floor(count));
    if (n < this.boids.length) this.boids.length = n;
    while (this.boids.length < n) this.boids.push(this.spawnBoid());
  }

  // Start over from the seed with the same size and settings.
  reset(seed = this.seed) {
    this.seed = seed;
    this.rng = createRng(seed);
    const n = this.boids.length;
    this.boids = [];
    this.tick = 0;
    this.nextId = 0;
    this.setCount(n);
  }

  resize(width, height) {
    if (!(width > 0) || !(height > 0)) throw new RangeError('width and height must be positive');
    const sx = width / this.width;
    const sy = height / this.height;
    for (const b of this.boids) {
      b.x *= sx;
      b.y *= sy;
    }
    this.width = width;
    this.height = height;
  }

  // Last resort for avoid mode: a boid that still crosses an edge is
  // reflected back inside so the flock can never leave the canvas.
  bounce(b) {
    if (b.x < 0) { b.x = -b.x; b.vel.x = Math.abs(b.vel.x); }
    else if (b.x > this.width) { b.x = 2 * this.width - b.x; b.vel.x = -Math.abs(b.vel.x); }
    if (b.y < 0) { b.y = -b.y; b.vel.y = Math.abs(b.vel.y); }
    else if (b.y > this.height) { b.y = 2 * this.height - b.y; b.vel.y = -Math.abs(b.vel.y); }
  }

  wrap(b) {
    if (b.x < 0) b.x += this.width;
    else if (b.x >= this.width) b.x -= this.width;
    if (b.y < 0) b.y += this.height;
    else if (b.y >= this.height) b.y -= this.height;
  }

  // Advance every boid by one frame. Forces are computed against the
  // positions at the start of the frame, then applied all at once, so the
  // outcome does not depend on the order boids are stored in.
  step() {
    const { params, boids } = this;
    this.hash.build(boids);
    const accelerations = new Array(boids.length);
    for (let i = 0; i < boids.length; i++) {
      const b = boids[i];
      const neighbours = this.hash.query(b.x, b.y, params.perception);
      let acc = flockingForce(b, neighbours, params);
      if (this.threat) acc = add(acc, flee(b, this.threat, THREAT_RADIUS, params));
      if (this.edgeMode === 'avoid') {
        acc = add(acc, avoidEdges(b, this.width, this.height, EDGE_MARGIN, params));
      }
      accelerations[i] = acc;
    }
    for (let i = 0; i < boids.length; i++) {
      const b = boids[i];
      b.vel = limit(add(b.vel, accelerations[i]), params.maxSpeed);
      b.x += b.vel.x;
      b.y += b.vel.y;
      if (this.edgeMode === 'wrap') this.wrap(b);
      else this.bounce(b);
    }
    this.tick++;
  }
}
