// Fitting a patch to the canvas and culling what falls outside it.

const segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
};

const pointKey = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;

// Edges that belong to only one triangle of the patch: its outline.
export function rimEdges(triangles) {
  const seen = new Map();
  for (const t of triangles) {
    for (const [p, q] of [
      [t.a, t.b],
      [t.b, t.c],
      [t.c, t.a],
    ]) {
      const kp = pointKey(p);
      const kq = pointKey(q);
      const key = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`;
      if (seen.has(key)) seen.delete(key);
      else seen.set(key, [p, q]);
    }
  }
  return [...seen.values()];
}

// Radius of the largest circle around the origin that the patch covers, and
// of the smallest one that covers the patch.
export function patchRadii(seedTriangles) {
  const rim = rimEdges(seedTriangles);
  const inner = Math.min(...rim.map(([p, q]) => segmentDistance([0, 0], p, q)));
  const outer = Math.max(...seedTriangles.flatMap((t) => [t.a, t.b, t.c].map((p) => Math.hypot(p[0], p[1]))));
  return { inner, outer };
}

// World to canvas: x' = cx + scale * x, y' = cy - scale * y (y up).
// 'patch' shows the whole patch, 'fill' zooms in until the patch covers
// the canvas, and `zoom` magnifies further about the centre.
export function fitView(seedTriangles, width, height, { fit = 'fill', zoom = 1, margin = 12 } = {}) {
  const { inner, outer } = patchRadii(seedTriangles);
  let scale;
  if (fit === 'patch') scale = (Math.min(width, height) / 2 - margin) / outer;
  else scale = Math.hypot(width, height) / 2 / inner;
  return { scale: scale * zoom, cx: width / 2, cy: height / 2, width, height };
}

export function toScreen(view, p) {
  return [view.cx + view.scale * p[0], view.cy - view.scale * p[1]];
}

export function toWorld(view, s) {
  return [(s[0] - view.cx) / view.scale, (view.cy - s[1]) / view.scale];
}

// Keep the items whose bounding box meets the canvas.
export function cull(items, view, pointsOf = (it) => it.points) {
  const [x0, y1] = toWorld(view, [0, 0]);
  const [x1, y0] = toWorld(view, [view.width, view.height]);
  return items.filter((it) => {
    const pts = pointsOf(it);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return maxX >= x0 && minX <= x1 && maxY >= y0 && minY <= y1;
  });
}

// A test for `grow` that keeps triangles within `margin` world units of the
// view. With a margin of one final tile, both halves of every tile that
// reaches the canvas survive, so no half tile shows at the edge.
export function nearView(view, margin) {
  const [x0, y1] = toWorld(view, [0, 0]);
  const [x1, y0] = toWorld(view, [view.width, view.height]);
  const lo = [x0 - margin, y0 - margin];
  const hi = [x1 + margin, y1 + margin];
  return (t) =>
    Math.max(t.a[0], t.b[0], t.c[0]) >= lo[0] &&
    Math.min(t.a[0], t.b[0], t.c[0]) <= hi[0] &&
    Math.max(t.a[1], t.b[1], t.c[1]) >= lo[1] &&
    Math.min(t.a[1], t.b[1], t.c[1]) <= hi[1];
}
