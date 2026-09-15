// Pure formatting and positioning for the mass-label overlay: the text each body's
// toggled-on label shows, and where it's anchored relative to the body's drawn screen
// radius. Kept DOM-free like scaleBar.js and velocityVectors.js so the formatting and
// layout math can be tested without a canvas.

/**
 * Formats a body's mass as a short label string. Masses in this simulation range from
 * single digits (a moon or asteroid) up into the tens of thousands (a sun), so large
 * values are abbreviated with a "k" suffix rather than printed with every digit, and
 * everything is rounded to at most one decimal place. A non-finite or non-positive mass
 * (which has no physical meaning here) formats as "0" rather than throwing or printing
 * "NaN".
 *
 * @param {number} mass
 * @returns {string}
 */
export function formatMassLabel(mass) {
  if (!Number.isFinite(mass) || mass <= 0) return "0";

  if (mass >= 1000) return `${trimToOneDecimal(mass / 1000)}k`;
  return trimToOneDecimal(mass);
}

// Rounds to one decimal place, then drops it again when it's exactly zero, so "20000"
// reads as "20k" rather than "20.0k" while "8000" still reads as "8k" and "8500" reads
// as "8.5k".
function trimToOneDecimal(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Where a mass label should be anchored on screen, given the body's own screen-space
 * center and drawn radius: centered horizontally on the body, and far enough below it
 * that the text clears the disc (plus a small fixed gap) even at the smallest radii.
 *
 * @param {number} sx screen x of the body's center
 * @param {number} sy screen y of the body's center
 * @param {number} screenRadius the body's drawn radius in screen pixels
 * @returns {{x:number,y:number}}
 */
export function massLabelPosition(sx, sy, screenRadius) {
  const gap = 4;
  const radius = Number.isFinite(screenRadius) ? Math.max(screenRadius, 0) : 0;
  return { x: sx, y: sy + radius + gap };
}
