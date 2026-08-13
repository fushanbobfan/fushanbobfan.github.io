// Turns a completed run's `visitedOrder` and `path` arrays into the state of the grid at any
// single point in time, so the UI can either animate forward through it a step at a time (the
// existing behavior) or jump straight to an arbitrary step via a scrubber, without re-running
// the algorithm. Kept free of any DOM dependency so the step arithmetic can be tested in
// isolation from rendering.

/**
 * The total number of steps a run can be scrubbed through: every visited cell, plus every path
 * cell if a path was found. A run that found no path has no path-reveal steps to add.
 */
export function totalFrames(visitedOrder, path, found) {
  return visitedOrder.length + (found ? path.length : 0);
}

/**
 * The cells that should be shown as visited/path at `frameIndex` steps into the run —
 * `frameIndex` clamped to `[0, totalFrames(...)]`. Cells reveal in the same order the live
 * animation uses: every visited cell first, in search order, then every path cell in path
 * order once all visited cells are shown.
 * @returns {{visited: {row:number,col:number}[], path: {row:number,col:number}[]}}
 */
export function frameState(visitedOrder, path, found, frameIndex) {
  const total = totalFrames(visitedOrder, path, found);
  const clamped = Math.max(0, Math.min(frameIndex, total));

  const visitedCount = Math.min(clamped, visitedOrder.length);
  const pathCount = clamped - visitedCount;

  return {
    visited: visitedOrder.slice(0, visitedCount),
    path: found ? path.slice(0, pathCount) : [],
  };
}
