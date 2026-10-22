// Vector export: dots as circles or the tour as one path, in the picture's
// pixel units scaled by `scale`, ready for a pen plotter or a print.

import { colourGroups } from './colour.js';

const num = (v) => {
  const s = (Math.round(v * 100) / 100).toString();
  return s === '-0' ? '0' : s;
};

function frame(width, height, scale, paper, body) {
  const w = num(width * scale);
  const h = num(height * scale);
  const bg = paper ? `<rect width="100%" height="100%" fill="${paper}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    bg +
    body +
    '</svg>\n'
  );
}

// With `colours` (RGB per dot), circles are grouped by exact colour, one <g>
// per colour, instead of all taking the ink colour.
export function dotsSvg(points, radii, count, width, height, { scale = 1, ink = '#000', paper = '#fff', colours = null } = {}) {
  const groups = colours ? colourGroups(colours, count, 8) : [{ colour: ink, dots: [...Array(count).keys()] }];
  const parts = [];
  for (const g of groups) {
    parts.push(`<g fill="${g.colour}">`);
    for (const i of g.dots) {
      const r = radii[i] * scale;
      if (r <= 0) continue;
      parts.push(`<circle cx="${num(points[2 * i] * scale)}" cy="${num(points[2 * i + 1] * scale)}" r="${num(r)}"/>`);
    }
    parts.push('</g>');
  }
  return frame(width, height, scale, paper, parts.join(''));
}

export function tourSvg(points, tour, width, height, { scale = 1, ink = '#000', paper = '#fff', stroke = 1 } = {}) {
  if (tour.length === 0) return frame(width, height, scale, paper, '');
  const d = ['M'];
  for (let n = 0; n < tour.length; n++) {
    const i = tour[n];
    if (n === 1) d.push('L');
    d.push(`${num(points[2 * i] * scale)} ${num(points[2 * i + 1] * scale)}`);
  }
  d.push('Z');
  const path = `<path d="${d.join(' ')}" fill="none" stroke="${ink}" stroke-width="${num(stroke)}" stroke-linejoin="round"/>`;
  return frame(width, height, scale, paper, path);
}
