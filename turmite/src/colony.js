// Ants on a grid, stepping together under one rule.
//
// Directions: 0 up, 1 right, 2 down, 3 left (screen coordinates, y down),
// so a right turn adds one.

import { Grid } from './grid.js';
import { PeriodWatch } from './period.js';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

const CHECK_EVERY = 4096;

export class Colony {
  constructor(rule, ants) {
    this.rule = rule;
    this.start = ants.map(({ x, y, dir }) => ({ x, y, dir: dir & 3 }));
    this.reset();
  }

  reset() {
    this.grid = new Grid();
    this.ants = this.start.map((a) => ({ ...a }));
    this.steps = 0;
    this.halted = null;
    this.highway = null;
    this.watch = this.ants.length === 1 ? new PeriodWatch() : null;
    this.box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    if (this.ants.length) {
      const { x, y } = this.ants[0];
      this.box = { minX: x, maxX: x, minY: y, maxY: y };
    }
    for (const a of this.ants) this.#settle(a);
  }

  // Advance up to n steps; returns the number taken (fewer if halted).
  run(n) {
    let done = 0;
    while (done < n && this.tick()) done++;
    return done;
  }

  tick() {
    if (this.halted || this.ants.length === 0) return false;
    const { turns, colors } = this.rule;
    const grid = this.grid;
    for (const a of this.ants) {
      const i = grid.index(a.x, a.y);
      const c = grid.cells[i];
      if (this.watch) this.watch.push(c * 4 + a.dir, a.x, a.y);
      a.dir = (a.dir + turns[c] + 4) & 3;
      grid.cells[i] = c + 1 === colors ? 0 : c + 1;
      a.x += DX[a.dir];
      a.y += DY[a.dir];
      this.#settle(a);
    }
    this.steps++;
    if (this.watch && !this.highway && this.steps % CHECK_EVERY === 0) {
      this.highway = this.watch.detect();
    }
    return true;
  }

  // Keep a one-cell margin around every ant so the next move stays inside;
  // halt when the grid can no longer grow.
  #settle(a) {
    const b = this.box;
    if (a.x < b.minX) b.minX = a.x;
    if (a.x > b.maxX) b.maxX = a.x;
    if (a.y < b.minY) b.minY = a.y;
    if (a.y > b.maxY) b.maxY = a.y;
    if (!this.grid.ensure(a.x - 1, a.y - 1) || !this.grid.ensure(a.x + 1, a.y + 1)) {
      this.halted = 'edge';
    }
  }
}
