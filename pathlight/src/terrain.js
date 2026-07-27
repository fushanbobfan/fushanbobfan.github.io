// Randomized terrain generation: scatters a handful of weighted "seed" points across the grid,
// each with its own random cost, then assigns every cell the cost of its nearest seed (Manhattan
// distance) — a coarse Voronoi partition that produces natural-looking patches of costly terrain
// instead of the single fixed-cost brush. Kept free of any DOM dependency, like the rest of the
// project's algorithms, and takes its random source as a parameter so it can be tested
// deterministically instead of depending on `Math.random` directly.

/**
 * Builds a `rows` x `cols` grid of integer weights (1 = cheapest to cross) by scattering
 * `seedCount` random points, each assigned a random weight in `[minWeight, maxWeight]`, and
 * giving every cell the weight of its nearest seed (ties broken by seed order, since every seed
 * before it in the array was checked with a strict `<` comparison).
 */
export function generateTerrain(rows, cols, randomFn = Math.random, options = {}) {
  const { seedCount = 8, minWeight = 1, maxWeight = 9 } = options;

  const seeds = Array.from({ length: seedCount }, () => ({
    row: Math.floor(randomFn() * rows),
    col: Math.floor(randomFn() * cols),
    weight: minWeight + Math.floor(randomFn() * (maxWeight - minWeight + 1)),
  }));

  const weights = Array.from({ length: rows }, () => Array(cols).fill(minWeight));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let nearestWeight = seeds[0].weight;
      let nearestDist = Infinity;
      for (const seed of seeds) {
        const dist = Math.abs(seed.row - row) + Math.abs(seed.col - col);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestWeight = seed.weight;
        }
      }
      weights[row][col] = nearestWeight;
    }
  }

  return weights;
}
