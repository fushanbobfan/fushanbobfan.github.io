// Mapping between world metres and canvas pixels, and the strain palette.

export function fit(world, width, height, margin = 8) {
  const scale = Math.min((width - 2 * margin) / world.width, (height - 2 * margin) / world.height);
  return {
    scale,
    ox: (width - world.width * scale) / 2,
    oy: (height - world.height * scale) / 2,
  };
}

export function toWorld(v, sx, sy) {
  return [(sx - v.ox) / v.scale, (sy - v.oy) / v.scale];
}

export function toScreen(v, x, y) {
  return [v.ox + x * v.scale, v.oy + y * v.scale];
}

// Slack threads are pale; taut ones run through amber to red as they approach
// the stretch at which they tear. The square root spreads the few-percent
// stretch of a hanging cloth over the lower colours instead of leaving it pale.
export const PALETTE = [
  '#c9d4e3', '#d9d2b8', '#e6c98f', '#f0b968', '#f7a247', '#fb8634', '#f6662c', '#e8432a',
];

export function strainBucket(strain, tearAt) {
  const limit = Number.isFinite(tearAt) ? tearAt - 1 : 0.5;
  if (strain <= 0) return 0;
  const t = Math.sqrt(Math.min(strain / limit, 1));
  return Math.min(PALETTE.length - 1, Math.floor(t * PALETTE.length));
}
