import { harmonicAmplitude, latticeMoire, lineMoire, ringMoire, visibleBeat } from './moire.js';

// Plain-language account of what the two sheets should show.

export function fmt(px) {
  if (!Number.isFinite(px)) return '∞';
  return px >= 100 ? String(Math.round(px)) : px.toFixed(1);
}

const HARMONICS = 'A weaker, slower beat can still show when one spacing is close to a whole multiple of the other.';

// A beat finer than about twice the coarser sheet reads as texture, not as
// broad fringes.
function tooFine(period, a, b) {
  return period < 2 * Math.max(a.period, b.period);
}

export function describe(a, b) {
  if (a.kind === 'lines' && b.kind === 'lines') {
    const m = lineMoire(a, b);
    if (m.period === Infinity) return 'The two sheets have the same spacing and direction, so they never fall out of step: no fringes.';
    const beat = visibleBeat(a, b);
    if (!beat) {
      return `The main beat repeats every ${fmt(m.period)} px, about as fine as the bars themselves, so it makes no broad fringes, and no beat between the bars' harmonics up to the fourth is broad either.`;
    }
    const fringes = `fringes every ${fmt(beat.period)} px, running at ${beat.stripeAngle.toFixed(1)}° from horizontal. Slide the top sheet 1 px across its bars and the fringes move ${fmt(beat.magnification)} px.`;
    if (beat.m === 1 && Math.abs(beat.n) === 1) return fringes[0].toUpperCase() + fringes.slice(1);
    const n = Math.abs(beat.n);
    const main = Math.abs(harmonicAmplitude(1, a.duty) * harmonicAmplitude(1, b.duty)) / 2;
    const share = Math.round((100 * beat.contrast) / main);
    return `The main beat repeats every ${fmt(m.period)} px, too fine to see. But ${n} ${n === 1 ? 'bar' : 'bars'} of the bottom sheet span about as far as ${beat.m} of the top, and that beat between the bars' harmonics gives fainter ${fringes} These fringes have about ${share}% of a main beat's contrast.`;
  }
  if (a.kind === 'dots' && b.kind === 'dots') {
    const m = latticeMoire(a, b);
    const side = Math.max(...m.sides);
    if (side === Infinity) return 'The two dot screens match exactly: no fringes.';
    if (tooFine(Math.min(...m.sides), a, b)) return `The main beat is a lattice ${fmt(Math.min(...m.sides))} px across, too fine to stand out from the dots. ${HARMONICS}`;
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
    if (r.equalSpacing) {
      return `Centres ${fmt(r.distance)} px apart. ${r.crossings} hyperbolic fringes cross the line between them, the way bright lines fan out between two wave sources. Close to the centres they give way to faint ellipses.`;
    }
    return `Centres ${fmt(r.distance)} px apart, spacings ${fmt(a.period)} and ${fmt(b.period)} px. ${r.crossings} fringes cross the line between the centres, on curves that are no longer hyperbolas.`;
  }
  if (a.kind === 'dots' || b.kind === 'dots') {
    return 'Dots over bars or rings beat too, but the fringe prediction here covers dots over dots only.';
  }
  return 'No single fringe spacing: fringes gather where the rings run nearly parallel to the bars with nearly the same spacing.';
}
