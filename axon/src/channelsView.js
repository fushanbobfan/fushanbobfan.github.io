// The picture of the membrane: a row of sodium channels and a row of potassium
// channels at one moment of the trace.

import { makeChannels, potassiumState, sodiumState } from './gates.js';
import { prepare, token } from './chart.js';

const SODIUM = 9;
const POTASSIUM = 9;
const crowd = makeChannels(SODIUM, POTASSIUM);

function drawPore(ctx, x, y, h, open, colour) {
  const half = 9;
  ctx.fillStyle = open ? colour : token('closed');
  ctx.beginPath();
  ctx.roundRect(x - half - 4, y - h / 2, 8, h, 3);
  ctx.roundRect(x + half - 4, y - h / 2, 8, h, 3);
  ctx.fill();
}

function drawIons(ctx, x, top, bottom, inward, colour, phase) {
  ctx.fillStyle = colour;
  for (let i = 0; i < 3; i++) {
    const f = ((i / 3 + phase) % 1 + 1) % 1;
    const along = inward ? f : 1 - f;
    ctx.beginPath();
    ctx.arc(x, top + along * (bottom - top), 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGateDots(ctx, x, y, gates, colour) {
  const spacing = 6.5;
  const start = x - ((gates.length - 1) * spacing) / 2;
  gates.forEach((open, i) => {
    ctx.beginPath();
    ctx.arc(start + i * spacing, y, 2.4, 0, Math.PI * 2);
    if (open) {
      ctx.fillStyle = colour;
      ctx.fill();
    } else {
      ctx.strokeStyle = token('muted');
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });
}

function drawBand(ctx, width, y, h) {
  ctx.fillStyle = token('band');
  ctx.fillRect(0, y - h / 2, width, h);
}

function rowCentres(width, count) {
  const gap = width / count;
  return Array.from({ length: count }, (_, i) => gap * (i + 0.5));
}

// `state` holds v, m, h, n at the playhead; `phase` moves the ions along.
export function drawMembrane(canvas, state, phase) {
  const { ctx, width, height } = prepare(canvas);
  const rowHeight = height / 2;
  const bandHeight = 26;
  const naColour = token('sodium');
  const kColour = token('potassium');
  const plug = token('plug');

  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const yNa = rowHeight * 0.56;
  drawBand(ctx, width, yNa, bandHeight);
  rowCentres(width, SODIUM).forEach((x, i) => {
    const channel = sodiumState(crowd.sodium[i], state.m, state.h);
    drawPore(ctx, x, yNa, bandHeight + 8, channel.open, naColour);
    drawGateDots(ctx, x, yNa - bandHeight / 2 - 11, channel.gates, naColour);
    if (!channel.ball) {
      ctx.fillStyle = plug;
      ctx.beginPath();
      ctx.arc(x, yNa + bandHeight / 2 + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = plug;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x + 15, yNa + bandHeight / 2 + 10, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (channel.open && state.v !== 50) {
      drawIons(ctx, x, yNa - bandHeight / 2 - 2, yNa + bandHeight / 2 + 2, state.v < 50, naColour, phase);
    }
  });

  const yK = rowHeight + rowHeight * 0.56;
  drawBand(ctx, width, yK, bandHeight);
  rowCentres(width, POTASSIUM).forEach((x, i) => {
    const channel = potassiumState(crowd.potassium[i], state.n);
    drawPore(ctx, x, yK, bandHeight + 8, channel.open, kColour);
    drawGateDots(ctx, x, yK + bandHeight / 2 + 11, channel.gates, kColour);
    if (channel.open && state.v !== -77) {
      drawIons(ctx, x, yK - bandHeight / 2 - 2, yK + bandHeight / 2 + 2, state.v < -77, kColour, phase);
    }
  });

  ctx.fillStyle = token('muted');
  ctx.fillText('outside', 4, 11);
  ctx.fillText('inside', 4, rowHeight - 4);
  ctx.fillText('outside', 4, rowHeight + 13);
  ctx.fillText('inside', 4, height - 3);
  ctx.textAlign = 'right';
  ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = naColour;
  ctx.fillText('sodium', width - 4, 11);
  ctx.fillStyle = kColour;
  ctx.fillText('potassium', width - 4, rowHeight + 13);
}
