// Canvas drawing for the two panels. Takes a 2D context; no other DOM access.

import { EXTENT, HUB, bladePolygons } from './shutter.js';

const toPx = (v, px) => ((v + EXTENT) / (2 * EXTENT)) * px;
const toPy = (v, px) => ((EXTENT - v) / (2 * EXTENT)) * px;

// The propeller as it really is at blade angle `angle`, with the line the
// sensor is reading. `scan` is the fraction of rows already read (0..1), or
// null when no photo is being taken.
export function drawScene(ctx, px, prop, angle, scan, colors) {
  ctx.clearRect(0, 0, px, px);
  ctx.fillStyle = colors.sky;
  ctx.fillRect(0, 0, px, px);

  ctx.fillStyle = colors.blade;
  for (const poly of bladePolygons(prop, angle)) {
    ctx.beginPath();
    poly.forEach((q, i) => {
      const x = toPx(q.x, px);
      const y = toPy(q.y, px);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, (HUB / (2 * EXTENT)) * px, 0, 2 * Math.PI);
  ctx.fill();

  if (scan !== null) drawScanLine(ctx, px, scan, colors, true);
}

// The photo so far: rows already read come from `image`, the rest is blank.
export function drawPhoto(ctx, px, image, scan, colors) {
  ctx.putImageData(image, 0, 0);
  if (scan !== null && scan < 1) {
    const y = Math.round(scan * px);
    ctx.fillStyle = colors.unread;
    ctx.fillRect(0, y, px, px - y);
    drawScanLine(ctx, px, scan, colors, false);
  }
}

function drawScanLine(ctx, px, scan, colors, shadeRead) {
  const y = scan * px;
  if (shadeRead) {
    ctx.fillStyle = colors.read;
    ctx.fillRect(0, 0, px, y);
  }
  ctx.strokeStyle = colors.scan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(px, y);
  ctx.stroke();
}
