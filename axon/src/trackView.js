// One axon on the page: the voltage along it, the fibre itself, and a chart of
// space against time that scrolls down as the spike travels.

import { prepare, token } from './chart.js';
import { patchAt, voltageColour } from './axonScene.js';

const PROFILE = 74;
const TUBE = 24;
const GAP = 6;
const LABEL = 15;
const TOP_V = 50;
const BOTTOM_V = -90;

export function makeTrack(canvas, name) {
  return { canvas, name, raster: document.createElement('canvas'), image: null };
}

// Moves every row of an RGBA buffer down by one, leaving the top row to rewrite.
export function shiftDown(pixels, width, height) {
  pixels.copyWithin(width * 4, 0, (height - 1) * width * 4);
}

export function resetRaster(track) {
  const { canvas, raster } = track;
  raster.width = Math.max(1, canvas.clientWidth);
  raster.height = Math.max(1, canvas.clientHeight - PROFILE - TUBE - GAP * 2 - LABEL);
  track.image = raster.getContext('2d').createImageData(raster.width, raster.height);
  const [r, g, b] = voltageColour(-65);
  const pixels = track.image.data;
  for (let at = 0; at < pixels.length; at += 4) {
    pixels[at] = r;
    pixels[at + 1] = g;
    pixels[at + 2] = b;
    pixels[at + 3] = 255;
  }
  raster.getContext('2d').putImageData(track.image, 0, 0);
}

// Adds the current moment as a new top row and moves the older rows down.
export function pushRow(track, cable, length) {
  const { raster } = track;
  if (!track.image || track.image.width !== raster.width) resetRaster(track);
  const { data, width, height } = track.image;
  shiftDown(data, width, height);
  for (let x = 0; x < width; x++) {
    const [r, g, b] = voltageColour(cable.v[patchAt(cable, x / (width - 1 || 1), length)]);
    const at = x * 4;
    data[at] = r;
    data[at + 1] = g;
    data[at + 2] = b;
    data[at + 3] = 255;
  }
  track.dirty = true;
}

function drawSheath(ctx, cable, length, width, top) {
  const internodes = Math.floor((cable.count - 1) / cable.nodeEvery);
  const toX = (patch) => ((patch * cable.dx) / length) * width;
  ctx.fillStyle = token('sheath');
  ctx.strokeStyle = token('muted');
  ctx.lineWidth = 1;
  for (let k = 0; k < internodes; k++) {
    const first = k * cable.nodeEvery;
    if (cable.cm[first + 1] === 1) continue;
    const x0 = toX(first) + 1.5;
    const x1 = toX(first + cable.nodeEvery) - 1.5;
    if (x1 - x0 < 1) continue;
    ctx.beginPath();
    ctx.roundRect(x0, top, x1 - x0, TUBE, Math.min(5, (x1 - x0) / 2));
    ctx.fill();
    ctx.stroke();
  }
}

export function drawTrack(track, cable, length, label) {
  const { ctx, width, height } = prepare(track.canvas);
  const toY = (v) => LABEL + ((TOP_V - v) / (TOP_V - BOTTOM_V)) * PROFILE;

  ctx.strokeStyle = token('rule');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, toY(0));
  ctx.lineTo(width, toY(0));
  ctx.moveTo(0, toY(-65));
  ctx.lineTo(width, toY(-65));
  ctx.stroke();

  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = token('ink');
  ctx.fillText(label, 0, 12);
  ctx.font = '10px ui-monospace, Consolas, monospace';
  ctx.fillStyle = token('muted');
  ctx.textAlign = 'right';
  ctx.fillText('0 mV', width, toY(0) - 2);
  ctx.fillText('rest', width, toY(-65) - 2);

  ctx.strokeStyle = token('accent');
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const y = toY(cable.v[patchAt(cable, x / (width - 1 || 1), length)]);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tubeTop = LABEL + PROFILE + GAP;
  const coreTop = cable.nodeEvery ? tubeTop + 7 : tubeTop + 3;
  const coreHeight = cable.nodeEvery ? TUBE - 14 : TUBE - 6;
  for (let x = 0; x < width; x++) {
    const v = cable.v[patchAt(cable, x / (width - 1 || 1), length)];
    ctx.fillStyle = `rgb(${voltageColour(v).join(',')})`;
    ctx.fillRect(x, coreTop, 1.5, coreHeight);
  }
  if (cable.nodeEvery) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawSheath(ctx, cable, length, width, tubeTop);
    ctx.restore();
  }

  if (track.raster.width !== Math.max(1, width)) resetRaster(track);
  if (track.dirty) {
    track.raster.getContext('2d').putImageData(track.image, 0, 0);
    track.dirty = false;
  }
  ctx.drawImage(track.raster, 0, tubeTop + TUBE + GAP, width, height - (tubeTop + TUBE + GAP));
}

// Fraction along the fibre for a pointer position.
export function fractionAt(canvas, clientX) {
  const rect = canvas.getBoundingClientRect();
  return Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
}
