// Log-log scatter of avalanche-size densities with the fitted line.

// Whole decades covering [lo, hi], at least `minSpan` decades wide.
export function decadeRange(lo, hi, minSpan = 1) {
  let a = Math.floor(Math.log10(lo));
  let b = Math.ceil(Math.log10(hi));
  if (b - a < minSpan) b = a + minSpan;
  return [a, b];
}

export function makeScale(points, w, h, pad) {
  const xs = points.map((p) => p.size);
  const ys = points.map((p) => p.density);
  const [x0, x1] = decadeRange(Math.min(1, ...xs), Math.max(10, ...xs), 2);
  const [y0, y1] = decadeRange(Math.min(...ys), Math.max(...ys), 2);
  const px = (v) => pad.left + ((Math.log10(v) - x0) / (x1 - x0)) * (w - pad.left - pad.right);
  const py = (v) => h - pad.bottom - ((Math.log10(v) - y0) / (y1 - y0)) * (h - pad.top - pad.bottom);
  return { x0, x1, y0, y1, px, py };
}

const PAD = { left: 64, right: 16, top: 16, bottom: 64 };

export function drawChart(ctx, points, fit, colors) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = colors.muted;
  if (points.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillText('Avalanches will appear here', w / 2, h / 2);
    return;
  }
  const s = makeScale(points, w, h, PAD);
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let d = s.x0; d <= s.x1; d++) {
    const x = s.px(10 ** d);
    ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, h - PAD.bottom); ctx.stroke();
    ctx.fillText(`10${superscript(d)}`, x, h - PAD.bottom + 8);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const every = Math.max(1, Math.ceil((s.y1 - s.y0) / 6));
  for (let d = s.y0; d <= s.y1; d += every) {
    const y = s.py(10 ** d);
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
    ctx.fillText(`10${superscript(d)}`, PAD.left - 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('avalanche size (topplings)', (PAD.left + w - PAD.right) / 2, h - 4);

  if (fit) {
    const a = 10 ** s.x0;
    const b = 10 ** s.x1;
    ctx.strokeStyle = colors.fit;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(s.px(a), s.py(10 ** (fit.intercept + fit.slope * s.x0)));
    ctx.lineTo(s.px(b), s.py(10 ** (fit.intercept + fit.slope * s.x1)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = colors.point;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(s.px(p.size), s.py(p.density), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export function superscript(n) {
  return String(n).split('').map((c) => SUP[c]).join('');
}
