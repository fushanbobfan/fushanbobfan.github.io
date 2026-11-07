// Line charts on a canvas, shared by every view. The scale and tick helpers are
// plain functions; only drawChart touches the canvas.

// Round tick positions covering [low, high], about `count` of them.
export function niceTicks(low, high, count = 5) {
  if (!(high > low)) return [low];
  const raw = (high - low) / Math.max(1, count);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / power;
  const spacing = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
  const ticks = [];
  for (let k = Math.ceil(low / spacing - 1e-9); k * spacing <= high + spacing * 1e-9; k++) {
    ticks.push(Math.round(k * spacing * 1e9) / 1e9 + 0);
  }
  return ticks;
}

// The range of several arrays, padded a little, never narrower than minSpan.
export function dataRange(arrays, { pad = 0.06, minSpan = 1 } = {}) {
  let low = Infinity;
  let high = -Infinity;
  for (const values of arrays) {
    for (const value of values) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
  }
  if (low === Infinity) return [0, minSpan];
  if (high - low < minSpan) {
    const middle = (high + low) / 2;
    low = middle - minSpan / 2;
    high = middle + minSpan / 2;
  }
  const margin = (high - low) * pad;
  return [low - margin, high + margin];
}

const tokens = new Map();

export function clearTokenCache() {
  tokens.clear();
}

export function token(name) {
  if (!tokens.has(name)) {
    tokens.set(name, getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim());
  }
  return tokens.get(name);
}

// Sizes the canvas's backing store to its displayed size and returns a context
// in CSS pixels.
export function prepare(canvas) {
  const scale = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const backingWidth = Math.round(width * scale);
  const backingHeight = Math.round(height * scale);
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

const MARGIN = { left: 50, right: 12, top: 10, bottom: 26 };

export function plotBox(width, height, compact = false) {
  return {
    left: MARGIN.left,
    top: MARGIN.top,
    right: width - MARGIN.right,
    bottom: height - (compact ? 8 : MARGIN.bottom),
  };
}

// Options: x, y (ranges); series [{ x, y, color, width, dash, count }];
// xLabel, yLabel; compact (no x axis); playhead (x value); level (extra rule);
// markers [{ x, y, color, radius }]; logX and logY for log scales, which need
// xTicks and yTicks given.
export function drawChart(canvas, options) {
  const { ctx, width, height } = prepare(canvas);
  const box = plotBox(width, height, options.compact);
  const [x0, x1] = options.x;
  const [y0, y1] = options.y;
  const toX = options.logX
    ? (x) => box.left + ((Math.log10(x) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))) * (box.right - box.left)
    : (x) => box.left + ((x - x0) / (x1 - x0)) * (box.right - box.left);
  const toY = options.logY
    ? (y) => box.bottom - ((Math.log10(y) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0))) * (box.bottom - box.top)
    : (y) => box.bottom - ((y - y0) / (y1 - y0)) * (box.bottom - box.top);

  ctx.font = '11px ui-monospace, Consolas, monospace';
  ctx.lineWidth = 1;
  ctx.strokeStyle = token('rule');
  ctx.fillStyle = token('muted');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yTicks = options.yTicks ?? niceTicks(y0, y1, options.yTickCount ?? 4);
  for (const tick of yTicks) {
    const y = toY(tick);
    ctx.beginPath();
    ctx.moveTo(box.left, y);
    ctx.lineTo(box.right, y);
    ctx.stroke();
    ctx.fillText(String(tick), box.left - 6, y);
  }
  if (!options.compact) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = options.xTicks ?? niceTicks(x0, x1, width < 460 ? 5 : 10);
    for (const tick of xTicks) {
      const x = toX(tick);
      ctx.beginPath();
      ctx.moveTo(x, box.top);
      ctx.lineTo(x, box.bottom);
      ctx.stroke();
      ctx.fillText(String(tick), x, box.bottom + 5);
    }
  }
  if (options.level !== undefined) {
    ctx.strokeStyle = token('muted');
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(box.left, toY(options.level));
    ctx.lineTo(box.right, toY(options.level));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.left, box.top - 2, box.right - box.left, box.bottom - box.top + 4);
  ctx.clip();
  ctx.lineJoin = 'round';
  for (const s of options.series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width ?? 1.6;
    ctx.setLineDash(s.dash ?? []);
    ctx.beginPath();
    const count = s.count ?? s.y.length;
    let moved = false;
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(s.y[i])) {
        moved = false;
        continue;
      }
      const px = toX(s.x[i]);
      const py = toY(s.y[i]);
      if (moved) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      moved = true;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const mark of options.markers ?? []) {
    ctx.fillStyle = mark.color;
    ctx.beginPath();
    ctx.arc(toX(mark.x), toY(mark.y), mark.radius ?? 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (options.playhead !== undefined) {
    ctx.strokeStyle = token('accent');
    ctx.lineWidth = 1.5;
    const x = toX(options.playhead);
    ctx.beginPath();
    ctx.moveTo(x, box.top);
    ctx.lineTo(x, box.bottom);
    ctx.stroke();
  }

  ctx.fillStyle = token('muted');
  ctx.textBaseline = 'alphabetic';
  if (options.xLabel && !options.compact) {
    ctx.textAlign = 'right';
    ctx.fillText(options.xLabel, box.right, height - 2);
  }
  if (options.yLabel) {
    ctx.save();
    ctx.translate(11, (box.top + box.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(options.yLabel, 0, 0);
    ctx.restore();
  }
  return { box, toX, toY };
}

// The x value under a pointer position, kept inside the plot.
export function xFromPointer(canvas, clientX, [x0, x1]) {
  const rect = canvas.getBoundingClientRect();
  const box = plotBox(rect.width, rect.height);
  const fraction = (clientX - rect.left - box.left) / (box.right - box.left);
  return x0 + Math.min(1, Math.max(0, fraction)) * (x1 - x0);
}
