// An unbounded-looking square grid: a square array centred on the origin
// that doubles in size whenever something steps outside it, up to MAX_SIZE.

export const MAX_SIZE = 4096;

export class Grid {
  constructor(size = 128) {
    this.size = size;
    this.half = size >> 1;
    this.cells = new Uint8Array(size * size);
  }

  inside(x, y) {
    const h = this.half;
    return x >= -h && y >= -h && x < this.size - h && y < this.size - h;
  }

  index(x, y) {
    return (y + this.half) * this.size + (x + this.half);
  }

  get(x, y) {
    return this.inside(x, y) ? this.cells[this.index(x, y)] : 0;
  }

  set(x, y, c) {
    if (!this.ensure(x, y)) return false;
    this.cells[this.index(x, y)] = c;
    return true;
  }

  // Grow until (x, y) fits. False if that would pass MAX_SIZE.
  ensure(x, y) {
    while (!this.inside(x, y)) {
      if (!this.grow()) return false;
    }
    return true;
  }

  grow() {
    const size = this.size * 2;
    if (size > MAX_SIZE) return false;
    const cells = new Uint8Array(size * size);
    const shift = (size >> 1) - this.half;
    for (let row = 0; row < this.size; row++) {
      cells.set(this.cells.subarray(row * this.size, (row + 1) * this.size), (row + shift) * size + shift);
    }
    this.size = size;
    this.half = size >> 1;
    this.cells = cells;
    return true;
  }

  // Count of cells per colour (index = colour).
  census(colors) {
    const counts = new Array(colors).fill(0);
    for (const c of this.cells) counts[c]++;
    return counts;
  }
}
