// Draws a road network as SVG markup: road widths follow the drivers on them, labels give each
// road's travel time rule and its time right now. Pure string building, so it can be tested without a page.

import { travelTime } from './network.js';

export const WIDTH = 720;
export const HEIGHT = 420;
const NODE_R = 19;

// Car colours, one per route, kept apart from the red and blue-green of the roads themselves.
export const ROUTE_COLORS = ['#e3a21a', '#7b5cd6', '#3f9a4a', '#e0679a', '#2f7fd8', '#9a6b3a'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

// "x/100", "45", "10 + x/50": the rule for a road's minutes with x drivers on it.
export function formula(road) {
  const parts = [];
  if (road.a > 0 || road.b === 0) parts.push(fmt(road.a));
  if (road.b > 0) {
    const k = 1 / road.b;
    parts.push(Math.abs(k - Math.round(k)) < 1e-9 ? `x/${Math.round(k)}` : `${road.b}x`);
  }
  return parts.join(' + ');
}

export function minutes(v) {
  return `${fmt(v)} min`;
}

export function drivers(v) {
  return Math.round(v).toLocaleString('en-US');
}

// Geometry: each road is a quadratic Bézier from its start node to its end node, pulled sideways by road.bend.
export function roadCurve(scene, road) {
  const p = scene.nodes.find((n) => n.id === road.from);
  const q = scene.nodes.find((n) => n.id === road.to);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = road.bend || 0;
  const c = { x: (p.x + q.x) / 2 - (dy / len) * bend, y: (p.y + q.y) / 2 + (dx / len) * bend };
  return { p: { x: p.x, y: p.y }, c, q: { x: q.x, y: q.y } };
}

export function pointOn(curve, t) {
  const u = 1 - t;
  return {
    x: u * u * curve.p.x + 2 * u * t * curve.c.x + t * t * curve.q.x,
    y: u * u * curve.p.y + 2 * u * t * curve.c.y + t * t * curve.q.y,
  };
}

function tangent(curve, t) {
  const x = 2 * (1 - t) * (curve.c.x - curve.p.x) + 2 * t * (curve.q.x - curve.c.x);
  const y = 2 * (1 - t) * (curve.c.y - curve.p.y) + 2 * t * (curve.q.y - curve.c.y);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

// view: { scene, open: Set of open optional road ids, flows: Map road id -> drivers (open roads only) }
export function renderNetwork(view) {
  const { scene, open, flows } = view;
  const parts = [];
  const widthFor = (x) => 3 + 17 * Math.min(1, x / scene.maxDemand);

  for (const road of scene.roads) {
    const isOpen = !road.optional || open.has(road.id);
    const curve = roadCurve(scene, road);
    const d = `M${curve.p.x} ${curve.p.y} Q${curve.c.x.toFixed(1)} ${curve.c.y.toFixed(1)} ${curve.q.x} ${curve.q.y}`;
    const x = isOpen ? flows.get(road.id) || 0 : 0;
    const t = travelTime(road, x);
    const crowd = road.b > 0 ? 'crowdable' : 'fixed';
    const mid = pointOn(curve, 0.5);
    const tan = tangent(curve, 0.5);
    const normal = { x: -tan.y, y: tan.x };
    const off = 22 + widthFor(x) / 2;
    const side = road.labelSide || 1;
    const lx = mid.x + normal.x * off * side;
    const ly = mid.y + normal.y * off * side;
    const anchor = Math.abs(normal.x) < 0.3 ? 'middle' : normal.x * side > 0 ? 'start' : 'end';
    const status = road.optional ? (isOpen ? 'open' : 'closed') : '';
    const label = road.optional
      ? `${road.name}, ${status}. ${isOpen ? `${drivers(x)} drivers, ${minutes(t)}` : 'Press to open'}`
      : null;

    parts.push(
      `<g class="road ${crowd}${road.optional ? ' optional' : ''}${isOpen ? '' : ' closed'}" data-road="${esc(road.id)}"` +
        (road.optional ? ` role="button" tabindex="0" aria-pressed="${isOpen}" aria-label="${esc(label)}"` : '') +
        '>'
    );
    if (road.optional) parts.push(`<path class="hit" d="${d}"/>`);
    parts.push(`<path class="casing" d="${d}" stroke-width="${(widthFor(x) + 4).toFixed(1)}"/>`);
    parts.push(`<path class="lane" d="${d}" stroke-width="${widthFor(x).toFixed(1)}"/>`);
    const a = pointOn(curve, 0.5);
    const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
    parts.push(`<path class="arrow" d="M-6 -5 L5 0 L-6 5" transform="translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${ang.toFixed(1)})"/>`);
    parts.push(
      `<text class="rule" x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" text-anchor="${anchor}">${esc(formula(road))} min</text>`
    );
    parts.push(
      `<text class="now" x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" text-anchor="${anchor}">${
        isOpen ? `${esc(minutes(t))} · ${esc(drivers(x))} cars` : 'closed'
      }</text>`
    );
    parts.push('</g>');
  }

  parts.push('<g id="cars" class="cars"></g>');

  for (const n of scene.nodes) {
    const role = n.id === scene.source ? ' source' : n.id === scene.sink ? ' sink' : '';
    parts.push(`<g class="node${role}"><circle cx="${n.x}" cy="${n.y}" r="${NODE_R}"/>`);
    parts.push(`<text x="${n.x}" y="${n.y + 5}" text-anchor="middle">${esc(n.label)}</text></g>`);
  }
  return parts.join('');
}

// A text table of every route: drivers on it and minutes it takes, for both outcomes.
export function routeTable(names, eq, opt) {
  const rows = names
    .map(
      (name, i) =>
        `<tr><th scope="row"><span class="swatch" style="background:${ROUTE_COLORS[i % ROUTE_COLORS.length]}"></span>${esc(name)}</th>` +
        `<td class="num">${drivers(eq.flows[i])}</td><td class="num">${esc(minutes(eq.times[i]))}</td>` +
        `<td class="num">${drivers(opt.flows[i])}</td><td class="num">${esc(minutes(opt.times[i]))}</td></tr>`
    )
    .join('');
  return (
    '<table class="routes"><thead><tr><th rowspan="2" scope="col">Route</th>' +
    '<th colspan="2" scope="colgroup">Everyone picks the fastest</th><th colspan="2" scope="colgroup">Best split for all</th></tr>' +
    '<tr><th scope="col" class="num">Drivers</th><th scope="col" class="num">Trip</th><th scope="col" class="num">Drivers</th><th scope="col" class="num">Trip</th></tr></thead>' +
    `<tbody>${rows}</tbody></table>`
  );
}
