// Chart of how far the swing has turned against time, for the full pendulum,
// beside the Earth's share alone and the Earth's plus Airy's.

const GOLD = '#d9a35b';
const MUTED = '#9a9890';
const GRID = '#2c3036';
const BLUE = '#b7c3d6';

export function drawTurnChart(ctx, w, h, { points, duration, foucault, predicted }) {
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 46, r: 30, t: 12, b: 28 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const deg = (a) => (a * 180) / Math.PI;

  // turned angle in degrees, clockwise positive
  const ys = points.map((p) => -deg(p.angle - points[0].angle));
  const ends = [0, -deg(foucault * duration), -deg(predicted * duration), ...ys];
  let lo = Math.min(...ends), hi = Math.max(...ends);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const span = hi - lo;
  lo -= span * 0.06;
  hi += span * 0.06;
  const X = (t) => pad.l + (pw * t) / duration;
  const Y = (v) => pad.t + ph * (1 - (v - lo) / (hi - lo));

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of ticks(lo, hi, 5)) {
    ctx.beginPath();
    ctx.moveTo(pad.l, Y(v));
    ctx.lineTo(w - pad.r, Y(v));
    ctx.stroke();
    ctx.fillText(`${v}°`, pad.l - 6, Y(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const m of ticks(0, duration / 60, w < 500 ? 3 : 6)) {
    ctx.fillText(`${m} min`, X(m * 60), h - pad.b + 8);
  }

  const lineTo = (rate, colour, dash) => {
    ctx.save();
    ctx.setLineDash(dash);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(duration), Y(-deg(rate * duration)));
    ctx.stroke();
    ctx.restore();
  };
  lineTo(foucault, BLUE, [5, 4]);
  lineTo(predicted, MUTED, []);

  ctx.fillStyle = GOLD;
  const every = Math.max(1, Math.floor(points.length / 400));
  for (let i = 0; i < points.length; i += every) {
    ctx.beginPath();
    ctx.arc(X(points[i].t), Y(ys[i]), 1.6, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function ticks(lo, hi, n) {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toPrecision(6)));
  return out;
}
