// The road from the side: the eye on the left, the board on the right, the
// warm layer along the ground and a fan of rays between them. Heights are
// stretched many times over distances, or every ray would look flat.

import { trace } from './rays.js';
import { temperature } from './air.js';
import { BOARD, BOARD_HEIGHT, viewAngles, farDistance, treeHeight } from './view.js';

export function sideFrame(scene, width, height) {
  const xMax = scene.distance * 1.08;
  const zMax = Math.max(scene.eye, BOARD_HEIGHT) * 1.45;
  const pad = { left: 14, right: 10, top: 10, bottom: 18 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  return {
    xMax,
    zMax,
    px: (x) => pad.left + (x / xMax) * w,
    py: (z) => pad.top + h - (z / zMax) * h,
    ground: pad.top + h,
    // How many times heights are stretched compared with distances.
    stretch: (h / zMax) / (w / xMax),
  };
}

// The rays drawn: evenly spread over the angles the view shows.
export function sideRays(air, scene, count) {
  const { top, bottom } = viewAngles(air, scene);
  const far = farDistance(scene.distance);
  const rays = [];
  for (let i = 0; i < count; i++) {
    const angle = top + ((bottom - top) * i) / (count - 1);
    const r = trace(air, scene.eye, angle, { stops: [scene.distance, far], path: true, pathEvery: 2 });
    const cut = r.path.filter((p) => p[0] <= scene.distance * 1.08);
    let ends;
    if (r.groundX !== null && r.groundX < scene.distance) ends = 'road';
    else if (r.heights[0] !== null && r.heights[0] <= BOARD_HEIGHT) ends = 'board';
    else if (r.groundX !== null) ends = 'road';
    // Past the board, along the middle of the view, the ray meets the trees.
    else if (r.heights[1] <= treeHeight(0)) ends = 'trees';
    else ends = r.angles[1] < 0 ? 'road' : 'sky';
    // Rays that level out and climb again before the board are drawn heavier.
    rays.push({ angle, path: cut, ends, turned: angle < 0 && r.angles[0] !== null && r.angles[0] > 0 });
  }
  return rays;
}

export function drawSide(ctx, air, scene, palette, { highlight = null } = {}) {
  const { width, height } = ctx.canvas;
  const f = sideFrame(scene, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.panelSky;
  ctx.fillRect(0, 0, width, height);

  // The warm (or cool) layer, shaded by how far it is from the air temperature.
  const span = Math.abs(air.surface - air.air);
  if (span > 0.05) {
    const warm = air.surface > air.air;
    for (let y = Math.floor(f.ground); y > 0; y--) {
      const z = ((f.ground - y) / (f.ground - f.py(f.zMax))) * f.zMax;
      const t = Math.abs(temperature(air, z) - air.air) / span;
      if (t < 0.02) break;
      ctx.fillStyle = warm ? `rgba(226, 110, 40, ${0.45 * t})` : `rgba(60, 130, 220, ${0.45 * t})`;
      ctx.fillRect(f.px(0), y - 1, f.px(f.xMax) - f.px(0), 1);
    }
  }

  ctx.strokeStyle = palette.ground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, f.ground);
  ctx.lineTo(width, f.ground);
  ctx.stroke();

  // The board, drawn as its bands.
  let base = 0;
  const bx = f.px(scene.distance);
  for (const b of BOARD.bands) {
    ctx.fillStyle = palette.css[b.color];
    ctx.fillRect(bx - 3, f.py(b.top), 6, f.py(base) - f.py(b.top));
    base = b.top;
  }
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 3.5, f.py(BOARD_HEIGHT) - 0.5, 7, f.py(0) - f.py(BOARD_HEIGHT) + 0.5);

  const rays = sideRays(air, scene, 23);
  for (const r of rays) {
    ctx.strokeStyle = { board: palette.rayBoard, sky: palette.raySky, trees: palette.rayTree, road: palette.rayRoad }[r.ends];
    ctx.globalAlpha = highlight && highlight !== r.ends ? 0.25 : 0.9;
    ctx.lineWidth = r.turned && r.ends === 'board' ? 2 : 1.2;
    ctx.beginPath();
    r.path.forEach(([x, z], i) => (i ? ctx.lineTo(f.px(x), f.py(z)) : ctx.moveTo(f.px(x), f.py(z))));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The eye.
  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  ctx.arc(f.px(0), f.py(scene.eye), 4, 0, Math.PI * 2);
  ctx.fill();
  return { frame: f, rays };
}
