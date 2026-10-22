// Food: fixed points that keep releasing attractant, the way oat flakes do
// for a real plasmodium. Each source paints a small disc every step.

import { deposit } from './trail.js';

export const FOOD_RADIUS = 2;

export function addFood(foods, x, y) {
  foods.push({ x, y });
  return foods;
}

// Removes the source nearest to (x, y) if it lies within `reach` cells.
export function removeFoodNear(foods, x, y, reach) {
  let best = -1;
  let bestD = reach * reach;
  for (let i = 0; i < foods.length; i++) {
    const dx = foods[i].x - x;
    const dy = foods[i].y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best >= 0) foods.splice(best, 1);
  return best >= 0;
}

export function feed(trail, foods, strength, wrap) {
  if (strength <= 0) return;
  const r = FOOD_RADIUS;
  for (const f of foods) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        deposit(trail, f.x + dx, f.y + dy, strength, wrap);
      }
    }
  }
}

// Food layouts in fractions of the world, so they fit any size.
export const FOOD_LAYOUTS = {
  none: [],
  pair: [[0.25, 0.5], [0.75, 0.5]],
  triangle: [[0.5, 0.2], [0.24, 0.75], [0.76, 0.75]],
  square: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]],
  pentagon: Array.from({ length: 5 }, (_, i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [0.5 + 0.3 * Math.cos(t), 0.5 + 0.38 * Math.sin(t)];
  }),
  grid: [0.2, 0.4, 0.6, 0.8].flatMap((x) => [0.25, 0.5, 0.75].map((y) => [x, y])),
};

export function placeFoodLayout(name, width, height) {
  const pts = FOOD_LAYOUTS[name] || [];
  return pts.map(([u, v]) => ({ x: Math.round(u * width), y: Math.round(v * height) }));
}
