// Drawing helpers shared by the live canvas and the SVG export.

export const PALETTES = {
  ink: { label: 'Ink', paper: '#f4efe4', mode: 'solid', color: '#1d2a44' },
  sepia: { label: 'Sepia', paper: '#f2e6cf', mode: 'solid', color: '#6b3d1f' },
  night: { label: 'Night', paper: '#0d1220', mode: 'spectrum', hue: [190, 320] },
  ember: { label: 'Ember', paper: '#150b09', mode: 'spectrum', hue: [10, 60] },
  spectrum: { label: 'Spectrum', paper: '#fbfaf7', mode: 'spectrum', hue: [0, 300] },
};

// Colour of the pen at progress u ∈ [0, 1] along the drawing.
export function colorAt(palette, u) {
  if (palette.mode === 'solid') return palette.color;
  const [h0, h1] = palette.hue;
  const t = Math.min(1, Math.max(0, u));
  const hue = h0 + (h1 - h0) * t;
  const light = palette.paper && isDark(palette.paper) ? 62 : 42;
  return `hsl(${hue.toFixed(1)} 80% ${light}%)`;
}

export function isDark(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

// Split point indices [from, to] into runs that share one colour, each run
// overlapping the next by one point so the line stays continuous.
export function colorRuns(from, to, total, palette, runs = 48) {
  if (to <= from) return [];
  if (palette.mode === 'solid') return [{ from, to, color: palette.color }];
  const step = Math.max(1, Math.ceil((total - 1) / runs));
  const out = [];
  let start = from;
  while (start < to) {
    const bucket = Math.floor(start / step);
    const end = Math.min(to, (bucket + 1) * step);
    out.push({ from: start, to: end, color: colorAt(palette, (bucket + 0.5) / Math.ceil((total - 1) / step)) });
    start = end;
  }
  return out;
}

// Stroke points[from..to] (inclusive point indices) onto a 2D context.
export function drawRange(ctx, points, from, to, fit, palette, lineWidth = 1) {
  const total = points.length / 2;
  const last = Math.min(to, total - 1);
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const run of colorRuns(from, last, total, palette)) {
    ctx.strokeStyle = run.color;
    ctx.beginPath();
    const [x0, y0] = fit.toScreen(points[2 * run.from], points[2 * run.from + 1]);
    ctx.moveTo(x0, y0);
    for (let i = run.from + 1; i <= run.to; i++) {
      const [x, y] = fit.toScreen(points[2 * i], points[2 * i + 1]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Build a standalone SVG document of the whole drawing.
export function toSvg(points, fit, { width, height, palette, lineWidth = 1 }) {
  const total = points.length / 2;
  const paths = colorRuns(0, total - 1, total, palette).map((run) => {
    let d = '';
    for (let i = run.from; i <= run.to; i++) {
      const [x, y] = fit.toScreen(points[2 * i], points[2 * i + 1]);
      d += `${i === run.from ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return `<path d="${d}" stroke="${run.color}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${palette.paper}"/>`,
    `<g fill="none" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    ...paths,
    '</g>',
    '</svg>',
  ].join('\n');
}
