// Walls on the dish: painted by hand or carved as a maze, and packed into
// share links as run lengths.

import { setWall, clearWalls } from './trail.js';

export function paintWalls(trail, x, y, radius, on) {
  const r = Math.ceil(radius);
  const { width: w, height: h } = trail;
  let changed = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const ix = Math.floor(x) + dx;
      const iy = Math.floor(y) + dy;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
      const i = iy * w + ix;
      if (trail.walls[i] !== (on ? 1 : 0)) {
        setWall(trail, i, on);
        changed++;
      }
    }
  }
  return changed;
}

// Carves a maze into the whole dish. Corridors are `corridor` cells wide and
// walls `thickness` cells thick. The maze starts as a perfect maze (one route
// between any two rooms, by a seeded depth-first search); `loops` is the
// share of the remaining inner walls knocked through afterwards to open
// alternative routes. Returns the room grid, the corner rooms used for food
// and the shortest route between them in rooms.
export function carveMaze(trail, { corridor = 10, thickness = 3, loops = 0 }, rng) {
  const { width: w, height: h } = trail;
  const pitch = corridor + thickness;
  const cols = Math.max(1, Math.floor((w - thickness) / pitch));
  const rows = Math.max(1, Math.floor((h - thickness) / pitch));
  const ox = Math.floor((w - (cols * pitch + thickness)) / 2);
  const oy = Math.floor((h - (rows * pitch + thickness)) / 2);

  clearWalls(trail);
  for (let i = 0; i < w * h; i++) setWall(trail, i, true);

  const open = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setWall(trail, y * w + x, false);
  };
  const roomX = (c) => ox + thickness + c * pitch;
  const roomY = (r) => oy + thickness + r * pitch;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) open(roomX(c), roomY(r), roomX(c) + corridor, roomY(r) + corridor);
  }

  // Passages: east[r][c] joins (r, c) to (r, c + 1); south joins it to (r + 1, c).
  const east = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const south = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = [];
    if (r > 0 && !seen[r - 1][c]) options.push([r - 1, c]);
    if (r < rows - 1 && !seen[r + 1][c]) options.push([r + 1, c]);
    if (c > 0 && !seen[r][c - 1]) options.push([r, c - 1]);
    if (c < cols - 1 && !seen[r][c + 1]) options.push([r, c + 1]);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nr, nc] = options[rng.int(options.length)];
    joinRooms(east, south, r, c, nr, nc);
    seen[nr][nc] = true;
    stack.push([nr, nc]);
  }

  if (loops > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1 && !east[r][c] && rng.next() < loops) east[r][c] = true;
        if (r < rows - 1 && !south[r][c] && rng.next() < loops) south[r][c] = true;
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (east[r][c]) open(roomX(c) + corridor, roomY(r), roomX(c + 1), roomY(r) + corridor);
      if (south[r][c]) open(roomX(c), roomY(r) + corridor, roomX(c) + corridor, roomY(r + 1));
    }
  }

  const centre = (r, c) => ({ x: roomX(c) + Math.floor(corridor / 2), y: roomY(r) + Math.floor(corridor / 2) });
  const start = [0, 0];
  const end = [rows - 1, cols - 1];
  return {
    rows,
    cols,
    east,
    south,
    roomCentre: centre,
    foods: [centre(...start), centre(...end)],
    route: shortestRoute(rows, cols, east, south, start, end),
  };
}

function joinRooms(east, south, r, c, nr, nc) {
  if (nr === r) east[r][Math.min(c, nc)] = true;
  else south[Math.min(r, nr)][c] = true;
}

// Breadth-first search over rooms; returns the list of [row, col] on one
// shortest route from start to end, both included.
export function shortestRoute(rows, cols, east, south, start, end) {
  const prev = new Map();
  const key = (r, c) => r * cols + c;
  const queue = [start];
  prev.set(key(...start), null);
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === end[0] && c === end[1]) break;
    const next = [];
    if (c < cols - 1 && east[r][c]) next.push([r, c + 1]);
    if (c > 0 && east[r][c - 1]) next.push([r, c - 1]);
    if (r < rows - 1 && south[r][c]) next.push([r + 1, c]);
    if (r > 0 && south[r - 1][c]) next.push([r - 1, c]);
    for (const [nr, nc] of next) {
      if (prev.has(key(nr, nc))) continue;
      prev.set(key(nr, nc), [r, c]);
      queue.push([nr, nc]);
    }
  }
  if (!prev.has(key(...end))) return [];
  const route = [];
  for (let at = end; at; at = prev.get(key(...at))) route.unshift(at);
  return route;
}

// Run-length code for the wall mask: alternating runs of open and wall cells,
// starting with open, in base 36, joined by '-'.
export function encodeWalls(trail) {
  if (!trail.wallCount) return '';
  const runs = [];
  let current = 0;
  let length = 0;
  for (let i = 0; i < trail.walls.length; i++) {
    if (trail.walls[i] === current) {
      length++;
    } else {
      runs.push(length);
      current = trail.walls[i];
      length = 1;
    }
  }
  runs.push(length);
  return runs.map((n) => n.toString(36)).join('-');
}

export function decodeWalls(trail, code) {
  clearWalls(trail);
  if (!code) return false;
  const runs = code.split('-').map((s) => parseInt(s, 36));
  if (runs.some((n) => !Number.isFinite(n) || n < 0)) return false;
  if (runs.reduce((a, b) => a + b, 0) !== trail.walls.length) return false;
  let i = 0;
  let on = false;
  for (const n of runs) {
    for (let k = 0; k < n; k++) setWall(trail, i++, on);
    on = !on;
  }
  return true;
}
