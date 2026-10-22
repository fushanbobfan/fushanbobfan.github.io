// Abelian sandpile on a width x height square grid with an open boundary:
// a cell holding four or more grains topples, sending one grain to each of
// its four neighbours, and grains pushed past the edge leave the system.
// An optional mask switches cells off; they act like the edge, so the pile
// can live on a disc, a ring or any other region of the grid.

export const THRESHOLD = 4;

export function createPile(width, height, mask = null) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('grid size must be positive integers');
  }
  if (mask && mask.length !== width * height) throw new RangeError('mask does not match the grid');
  return {
    width,
    height,
    // 1 for cells that hold sand, 0 for cells that behave like the edge.
    active: mask ? Uint8Array.from(mask, (v) => (v ? 1 : 0)) : new Uint8Array(width * height).fill(1),
    cells: new Uint32Array(width * height),
    // How many times each cell has toppled since the last clear.
    odometer: new Float64Array(width * height),
    // Work queue of cells that may be unstable, with a membership flag so a
    // cell is never queued twice.
    queue: new Int32Array(width * height),
    queued: new Uint8Array(width * height),
    head: 0,
    tail: 0,
    pending: 0,
    lost: 0,
  };
}

export function index(pile, x, y) {
  return y * pile.width + x;
}

function enqueue(pile, i) {
  if (pile.queued[i]) return;
  pile.queued[i] = 1;
  pile.queue[pile.tail] = i;
  pile.tail = (pile.tail + 1) % pile.queue.length;
  pile.pending += 1;
}

// Grains dropped on a switched-off cell fall straight into the sink.
export function addGrains(pile, i, n = 1) {
  if (!pile.active[i]) {
    pile.lost += n;
    return;
  }
  pile.cells[i] += n;
  if (pile.cells[i] >= THRESHOLD) enqueue(pile, i);
}

function push(pile, i, n) {
  pile.cells[i] += n;
  if (pile.cells[i] >= THRESHOLD) enqueue(pile, i);
}

export function isStable(pile) {
  return pile.pending === 0;
}

export function totalGrains(pile) {
  let sum = 0;
  for (let i = 0; i < pile.cells.length; i++) sum += pile.cells[i];
  return sum;
}

// Topple queued cells until the pile is stable or `budget` topplings have
// been done. A cell with h grains fires floor(h / 4) times at once, which
// gives the same final state (the Abelian property) far faster for tall
// piles. If `touched` ({ mark, gen, count }) is given, each cell that fires
// for the first time in generation `gen` is stamped and counted. Returns a
// record of what happened in this call.
export function relax(pile, budget = Infinity, touched = null) {
  const {
    width, height, cells, queue, queued, active,
  } = pile;
  let topplings = 0;
  let lost = 0;
  while (pile.pending > 0 && topplings < budget) {
    const i = queue[pile.head];
    pile.head = (pile.head + 1) % queue.length;
    pile.pending -= 1;
    queued[i] = 0;
    const h = cells[i];
    if (h < THRESHOLD) continue;
    const fires = Math.floor(h / THRESHOLD);
    cells[i] = h - fires * THRESHOLD;
    pile.odometer[i] += fires;
    topplings += fires;
    if (touched && touched.mark[i] !== touched.gen) {
      touched.mark[i] = touched.gen;
      touched.count += 1;
    }
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0 && active[i - 1]) push(pile, i - 1, fires); else lost += fires;
    if (x < width - 1 && active[i + 1]) push(pile, i + 1, fires); else lost += fires;
    if (y > 0 && active[i - width]) push(pile, i - width, fires); else lost += fires;
    if (y < height - 1 && active[i + width]) push(pile, i + width, fires); else lost += fires;
  }
  pile.lost += lost;
  return { topplings, lost, stable: pile.pending === 0 };
}

export function stabilize(pile) {
  return relax(pile, Infinity);
}

export function clear(pile) {
  pile.cells.fill(0);
  pile.odometer.fill(0);
  pile.queued.fill(0);
  pile.head = 0;
  pile.tail = 0;
  pile.pending = 0;
  pile.lost = 0;
}

export function activeCount(pile) {
  let n = 0;
  for (let i = 0; i < pile.active.length; i++) n += pile.active[i];
  return n;
}

// Replace the whole configuration, queueing every unstable cell. Values on
// switched-off cells are discarded rather than counted as lost.
export function setCells(pile, values) {
  clear(pile);
  for (let i = 0; i < values.length; i++) if (pile.active[i]) push(pile, i, values[i]);
}

// Synchronous alternative to relax for tall piles: scan the whole grid up to
// `maxPasses` times, firing every unstable cell floor(h / 4) times on each
// visit. Scanning batches the enormous heights near a dropped tower far
// better than the queue does. The queue is rebuilt afterwards so relax and
// isStable stay correct.
export function sweep(pile, maxPasses = Infinity) {
  const {
    width, height, cells, odometer, active,
  } = pile;
  pile.queued.fill(0);
  pile.head = 0;
  pile.tail = 0;
  pile.pending = 0;
  let topplings = 0;
  let lost = 0;
  let passes = 0;
  let unstable = true;
  while (unstable && passes < maxPasses) {
    unstable = false;
    passes += 1;
    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i++) {
        const h = cells[i];
        if (h < THRESHOLD) continue;
        const fires = h >>> 2;
        cells[i] = h & 3;
        odometer[i] += fires;
        topplings += fires;
        if (x > 0 && active[i - 1]) cells[i - 1] += fires; else lost += fires;
        if (x < width - 1 && active[i + 1]) cells[i + 1] += fires; else lost += fires;
        if (y > 0 && active[i - width]) cells[i - width] += fires; else lost += fires;
        if (y < height - 1 && active[i + width]) cells[i + width] += fires; else lost += fires;
        unstable = true;
      }
    }
  }
  pile.lost += lost;
  for (let i = 0; i < cells.length; i++) if (cells[i] >= THRESHOLD) enqueue(pile, i);
  return { topplings, lost, passes, stable: pile.pending === 0 };
}
