// Bidirectional search: runs BFS outward from the start and, at the same time, from the end,
// one full ring of distance at a time, stopping the instant a cell discovered by one side turns
// out to already be discovered by the other. Like plain BFS it treats every step as equally
// costly and so ignores weighted terrain, but meeting in the middle instead of expanding a
// single circle out from the start tends to explore far fewer cells to find the same guaranteed
// shortest path — two circles of radius D/2 cover a much smaller area than one circle of
// radius D.

import { neighbors } from "../grid.js";

const key = (row, col) => `${row},${col}`;

function reconstructForward(cameFrom, start, meet) {
  const path = [meet];
  let current = meet;
  while (current.row !== start.row || current.col !== start.col) {
    current = cameFrom.get(key(current.row, current.col));
    path.unshift(current);
  }
  return path;
}

function reconstructBackward(cameFrom, end, meet) {
  const path = [];
  let current = meet;
  while (current.row !== end.row || current.col !== end.col) {
    current = cameFrom.get(key(current.row, current.col));
    path.push(current);
  }
  return path;
}

/**
 * Runs bidirectional BFS from `start` to `end` over `grid`.
 * @returns {{visitedOrder: {row:number,col:number}[], path: {row:number,col:number}[], found: boolean}}
 * `visitedOrder` interleaves one full ring expanded from the start with one full ring expanded
 * from the end, round by round — the sequence a step-by-step animation should reveal. `path` is
 * the shortest route found (assembled from the two halves at the meeting cell), empty if `end`
 * is unreachable. Expanding a full ring per side per round — rather than checking for a meeting
 * cell after every single expansion — is what keeps the result the true shortest path: after
 * `k` rounds each side has gone exactly `k` cells deep, so a cell first shared between them is
 * reached at the sum of the two sides' depths, which is the real shortest distance.
 */
export function bidirectionalSearch(grid, start, end) {
  const visitedOrder = [];

  if (start.row === end.row && start.col === end.col) {
    visitedOrder.push(start);
    return { visitedOrder, path: [start], found: true };
  }

  const startKey = key(start.row, start.col);
  const endKey = key(end.row, end.col);
  const globalVisited = new Set([startKey, endKey]);
  visitedOrder.push(start, end);

  const frontVisited = new Set([startKey]);
  const backVisited = new Set([endKey]);
  const frontCameFrom = new Map();
  const backCameFrom = new Map();
  let frontQueue = [start];
  let backQueue = [end];

  const expandRing = (queue, ownVisited, otherVisited, cameFrom) => {
    const nextQueue = [];
    for (const current of queue) {
      for (const next of neighbors(grid, current.row, current.col)) {
        const nk = key(next.row, next.col);
        if (ownVisited.has(nk)) continue;
        ownVisited.add(nk);
        cameFrom.set(nk, current);
        if (!globalVisited.has(nk)) {
          globalVisited.add(nk);
          visitedOrder.push(next);
        }
        nextQueue.push(next);
        if (otherVisited.has(nk)) {
          return { nextQueue, meet: next };
        }
      }
    }
    return { nextQueue, meet: null };
  };

  while (frontQueue.length > 0 && backQueue.length > 0) {
    const front = expandRing(frontQueue, frontVisited, backVisited, frontCameFrom);
    if (front.meet) {
      const forward = reconstructForward(frontCameFrom, start, front.meet);
      const backward = reconstructBackward(backCameFrom, end, front.meet);
      return { visitedOrder, path: [...forward, ...backward], found: true };
    }
    frontQueue = front.nextQueue;

    const back = expandRing(backQueue, backVisited, frontVisited, backCameFrom);
    if (back.meet) {
      const forward = reconstructForward(frontCameFrom, start, back.meet);
      const backward = reconstructBackward(backCameFrom, end, back.meet);
      return { visitedOrder, path: [...forward, ...backward], found: true };
    }
    backQueue = back.nextQueue;
  }

  return { visitedOrder, path: [], found: false };
}
