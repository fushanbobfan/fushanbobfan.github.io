// Uniform grid that buckets points by cell so neighbour queries only touch
// the cells overlapping the search radius instead of every boid.

export class SpatialHash {
  constructor(cellSize) {
    if (!(cellSize > 0)) throw new RangeError('cellSize must be positive');
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  key(cx, cy) {
    return `${cx},${cy}`;
  }

  cellOf(value) {
    return Math.floor(value / this.cellSize);
  }

  clear() {
    this.cells.clear();
  }

  insert(item) {
    const k = this.key(this.cellOf(item.x), this.cellOf(item.y));
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(item);
  }

  // Rebuild from scratch; cheaper than tracking moves for a flock that
  // changes every frame anyway.
  build(items) {
    this.clear();
    for (const item of items) this.insert(item);
  }

  // Every stored item within `radius` of (x, y). Items are compared by
  // true Euclidean distance, so the result is exact, not just cell-coarse.
  query(x, y, radius) {
    const minX = this.cellOf(x - radius);
    const maxX = this.cellOf(x + radius);
    const minY = this.cellOf(y - radius);
    const maxY = this.cellOf(y + radius);
    const r2 = radius * radius;
    const out = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= r2) out.push(item);
        }
      }
    }
    return out;
  }
}
