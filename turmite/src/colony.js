// Ants on a grid, stepping together under one rule.
//
// Square directions: 0 up, 1 right, 2 down, 3 left (screen coordinates,
// y down), so a right turn adds one.
//
// Hexagonal cells use axial coordinates (q, r) stored in the same grid:
// cell (q, r) sits at x = q + r / 2, y = r * sqrt(3) / 2 on screen. The six
// directions run clockwise from east: 0 east, 1 south-east, 2 south-west,
// 3 west, 4 north-west, 5 north-east.

import { Grid } from './grid.js';
import { PeriodWatch } from './period.js';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const HEX_DX = [1, 0, -1, -1, 0, 1];
export const HEX_DY = [0, 1, 1, 0, -1, -1];

export function moves(lattice) {
  return lattice === 'hex' ? { dx: HEX_DX, dy: HEX_DY } : { dx: DX, dy: DY };
}

const CHECK_EVERY = 4096;

export class Colony {
  constructor(rule, ants) {
    this.rule = rule;
    const n = rule.directions ?? 4;
    this.start = ants.map(({ x, y, dir }) => ({ x, y, dir: ((dir % n) + n) % n }));
    this.reset();
  }

  reset() {
    this.grid = new Grid();
    this.ants = this.start.map((a) => ({ ...a }));
    this.steps = 0;
    this.painted = 0;
    this.halted = null;
    this.highway = null;
    this.stretchBox = null;
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
    const n = this.rule.directions ?? 4;
    const { dx, dy } = moves(this.rule.lattice);
    const grid = this.grid;
    for (const a of this.ants) {
      const i = grid.index(a.x, a.y);
      const c = grid.cells[i];
      if (this.watch) this.watch.push(c * 8 + a.dir, a.x, a.y);
      a.dir = (a.dir + turns[c] + n) % n;
      const next = c + 1 === colors ? 0 : c + 1;
      grid.cells[i] = next;
      if (c === 0) this.painted++;
      else if (next === 0) this.painted--;
      a.x += dx[a.dir];
      a.y += dy[a.dir];
      this.#settle(a);
    }
    this.steps++;
    if (this.watch && this.steps % CHECK_EVERY === 0) this.#recheck();
    return true;
  }

  // A repeating stretch can end: an ant walking along a straight edge of its
  // own pattern repeats until it reaches the corner. So look again at every
  // check. If the same period carries on across the previous check, it is
  // the same stretch and keeps its first known start step.
  //
  // A moving stretch only counts as a highway once the ant has escaped: it
  // stands further outside the pattern's box at the time the stretch was
  // found than that box is wide. An ant circling the rim of its own pattern
  // never gets that far out.
  #recheck() {
    const found = this.watch.detect();
    const prev = this.highway;
    const continuing =
      found && prev && found.period === prev.period && found.dx === prev.dx && found.dy === prev.dy &&
      found.onset <= this.steps - CHECK_EVERY;
    if (!continuing) {
      this.highway = found ? { ...found, escaped: false } : null;
      this.stretchBox = found ? { ...this.box } : null;
      return;
    }
    if (!prev.escaped && (prev.dx || prev.dy)) {
      const b = this.stretchBox;
      const a = this.ants[0];
      const out = Math.max(b.minX - a.x, a.x - b.maxX, b.minY - a.y, a.y - b.maxY);
      if (out > Math.max(b.maxX - b.minX + 1, b.maxY - b.minY + 1)) this.highway = { ...prev, escaped: true };
    }
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
