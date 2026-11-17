import { latticeMoire, lineMoire, ringMoire } from './moire.js';

// Plain-language account of what the two sheets should show.

export function fmt(px) {
  if (!Number.isFinite(px)) return '∞';
  return px >= 100 ? String(Math.round(px)) : px.toFixed(1);
}

// A beat finer than about twice the coarser sheet reads as texture, not as
// broad fringes.
function tooFine(period, a, b) {
  return period < 2 * Math.max(a.period, b.period);
}

export function describe(a, b) {
  if (a.kind === 'lines' && b.kind === 'lines') {
    const m = lineMoire(a, b);
    if (m.period === Infinity) return 'The two sheets have the same spacing and direction, so they never fall out of step: no fringes.';
    if (tooFine(m.period, a, b)) return `The sheets fall out of step every ${fmt(m.period)} px, about as fine as the bars themselves, so no broad fringes form. Turn the top sheet back towards the bottom one.`;
    return `Fringes every ${fmt(m.period)} px, running at ${m.stripeAngle.toFixed(1)}° from horizontal. Slide the top sheet 1 px across its bars and the fringes move ${fmt(m.magnification)} px.`;
  }
  if (a.kind === 'dots' && b.kind === 'dots') {
    const m = latticeMoire(a, b);
    const side = Math.max(...m.sides);
    if (side === Infinity) return 'The two dot screens match exactly: no fringes.';
    if (tooFine(Math.min(...m.sides), a, b)) return `The screens beat on a lattice ${fmt(Math.min(...m.sides))} px across, too fine to stand out from the dots.`;
    const [s1, s2] = m.sides.map(fmt);
    const size = s1 === s2 ? `${s1} px` : `${s1} by ${s2} px`;
    return `A lattice of light and dark cells ${size} across, turned ${m.turnDegrees.toFixed(1)}°.`;
  }
  if (a.kind === 'rings' && b.kind === 'rings') {
    const r = ringMoire(a, b);
    if (r.concentric) {
      if (r.spacing === Infinity) return 'Identical rings on the same centre: no fringes. Drag the top sheet to separate the centres.';
      return `Same centre, different spacings: broad rings every ${fmt(r.spacing)} px.`;
    }
    return `Centres ${fmt(r.distance)} px apart. ${r.crossings} hyperbolic fringes cross the line between them, the way bright lines fan out between two wave sources. Close to the centres they give way to faint ellipses.`;
  }
  if (a.kind === 'dots' || b.kind === 'dots') {
    return 'Dots over bars or rings beat too, but the fringe prediction here covers dots over dots only.';
  }
  return 'No single fringe spacing: fringes gather where the rings run nearly parallel to the bars with nearly the same spacing.';
}
