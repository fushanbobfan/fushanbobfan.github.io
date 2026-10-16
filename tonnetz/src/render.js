// Draws the lattice, the traced path and the highlights onto a 2D canvas
// context. Pure drawing: everything it needs arrives in `state`.

import { pcName } from './pitch.js';
import { chordName, sameTriad, pitchClasses } from './chords.js';
import { pcAt, toScreen, triangleVertices, triangleTriad, triangleCentroid, sameTriangle, toLattice } from './lattice.js';
import { worldToScreen, visibleBox } from './view.js';

export const PALETTE = {
  dark: {
    bg: '#0f1115', edge: 'rgba(200, 210, 230, 0.16)', node: '#1b1f27', nodeRing: 'rgba(200, 210, 230, 0.35)',
    text: '#d9dee8', faint: 'rgba(217, 222, 232, 0.5)',
    major: [240, 160, 70], minor: [70, 170, 230], path: '#f3f5f9', sounding: '#ffd166',
  },
  light: {
    bg: '#fbfaf7', edge: 'rgba(40, 50, 70, 0.18)', node: '#ffffff', nodeRing: 'rgba(40, 50, 70, 0.4)',
    text: '#1d2230', faint: 'rgba(29, 34, 48, 0.5)',
    major: [214, 120, 30], minor: [30, 120, 175], path: '#1d2230', sounding: '#c27c00',
  },
};

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

// Lattice index ranges that cover the visible box.
export function visibleRange(view, w, h) {
  const box = visibleBox(view, w, h, 1);
  const cs = [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].map(([x, y]) => toLattice(x, y));
  return {
    q0: Math.floor(Math.min(...cs.map((c) => c.q))) - 1,
    q1: Math.ceil(Math.max(...cs.map((c) => c.q))) + 1,
    r0: Math.floor(Math.min(...cs.map((c) => c.r))) - 1,
    r1: Math.ceil(Math.max(...cs.map((c) => c.r))) + 1,
  };
}

const triKey = (tri) => `${tri.q},${tri.r},${tri.up ? 1 : 0}`;

// How strongly a triangle is filled: 1 for the current chord's triangle,
// 0.55 for other copies of it, 0.35 along the traced path, 0.3 under the
// pointer, otherwise a faint wash.
export function emphasis(tri, triadOfTri, state) {
  if (state.current && sameTriangle(tri, state.current)) return 1;
  if (state.currentTriad && sameTriad(triadOfTri, state.currentTriad)) return 0.55;
  if (state.pathKeys?.has(triKey(tri))) return 0.35;
  if (state.hover && sameTriangle(tri, state.hover)) return 0.3;
  return 0.1;
}

export function draw(ctx, input) {
  const path = input.path ?? [];
  const head = Math.min(path.length - 1, input.pathHead ?? path.length - 1);
  const state = { ...input, pathKeys: new Set(path.slice(0, head + 1).map(triKey)) };
  const { view, w, h } = state;
  const pal = PALETTE[state.theme] ?? PALETTE.dark;
  const S = (q, r) => {
    const p = toScreen(q, r);
    return worldToScreen(view, w, h, p.x, p.y);
  };
  const W = (p) => worldToScreen(view, w, h, p.x, p.y);
  const { q0, q1, r0, r1 } = visibleRange(view, w, h);
  const showNotes = state.labels !== 'chords';
  const showChords = state.labels !== 'notes' && view.scale >= 44;
  const sounding = new Set(state.sounding ?? []);

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w, h);

  // Triangles.
  for (let r = r0; r <= r1; r++) {
    for (let q = q0; q <= q1; q++) {
      for (const up of [true, false]) {
        const tri = { q, r, up };
        const t = triangleTriad(tri);
        const e = emphasis(tri, t, state);
        const v = triangleVertices(tri).map(([a, b]) => S(a, b));
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        ctx.lineTo(v[1].x, v[1].y);
        ctx.lineTo(v[2].x, v[2].y);
        ctx.closePath();
        ctx.fillStyle = rgba(up ? pal.major : pal.minor, (state.theme === 'dark' && e < 0.3 ? e * 1.6 : e) * 0.75);
        ctx.fill();
      }
    }
  }

  // Edges: fifths, major thirds and minor thirds from every node.
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = r0; r <= r1; r++) {
    for (let q = q0; q <= q1; q++) {
      const a = S(q, r);
      for (const [dq, dr] of [[1, 0], [0, 1], [1, -1]]) {
        const b = S(q + dq, r + dr);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
  }
  ctx.stroke();

  // Outline of the current triangle.
  if (state.current) {
    const v = triangleVertices(state.current).map(([a, b]) => S(a, b));
    ctx.strokeStyle = pal.path;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(v[0].x, v[0].y);
    ctx.lineTo(v[1].x, v[1].y);
    ctx.lineTo(v[2].x, v[2].y);
    ctx.closePath();
    ctx.stroke();
  }

  // Path through centroids, up to pathHead.
  if (head >= 1) {
    const pts = path.slice(0, head + 1).map((tri) => W(triangleCentroid(tri)));
    ctx.strokeStyle = pal.path;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash?.([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash?.([]);
    ctx.globalAlpha = 1;
  }

  // Chord names at centroids.
  const fontPx = Math.round(Math.max(10, Math.min(16, view.scale * 0.17)));
  if (showChords) {
    ctx.font = `${fontPx - 1}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = r0; r <= r1; r++) {
      for (let q = q0; q <= q1; q++) {
        for (const up of [true, false]) {
          const tri = { q, r, up };
          const t = triangleTriad(tri);
          const c = W(triangleCentroid(tri));
          ctx.fillStyle = emphasis(tri, t, state) >= 0.35 ? pal.text : pal.faint;
          ctx.fillText(chordName(t, state.spelling), c.x, c.y);
        }
      }
    }
  }

  // Nodes.
  const radius = Math.max(7, Math.min(17, view.scale * 0.19));
  const currentPcs = state.currentTriad ? pitchClasses(state.currentTriad) : [];
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = r0; r <= r1; r++) {
    for (let q = q0; q <= q1; q++) {
      const pc = pcAt(q, r);
      const p = S(q, r);
      const lit = sounding.has(pc);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = lit ? pal.sounding : pal.node;
      ctx.fill();
      ctx.lineWidth = currentPcs.includes(pc) ? 2 : 1;
      ctx.strokeStyle = currentPcs.includes(pc) ? pal.path : pal.nodeRing;
      ctx.stroke();
      if (showNotes && radius >= 9) {
        ctx.fillStyle = lit ? pal.bg : pal.text;
        ctx.fillText(pcName(pc, state.spelling), p.x, p.y + 0.5);
      }
    }
  }
}
