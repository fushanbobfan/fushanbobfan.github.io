// Pure math for a map-style scale bar: given the main viewport's zoom, picks a "nice" round
// world-unit length (from the standard 1-2-5-10-20-50... sequence cartographers use) whose
// on-screen length is close to a target pixel width. Kept DOM-free like viewport.js and
// minimap.js so the picking logic can be tested without a canvas.

const NICE_MANTISSAS = [1, 2, 5];

/**
 * The nice round number (mantissa 1, 2, or 5 times a power of ten) closest to `target` on a
 * log scale, so the bar reads "50" or "100" rather than an arbitrary value like "73.4". Log
 * scale (rather than plain difference) keeps the choice symmetric across decades: 3 is as far
 * from "2" as 30 is from "20", not swamped by the absolute gap growing with magnitude.
 */
export function pickNiceLength(target) {
  if (!(target > 0)) return NICE_MANTISSAS[0];

  const exponent = Math.floor(Math.log10(target));
  const logTarget = Math.log(target);

  let best = NICE_MANTISSAS[0];
  let bestDiff = Infinity;
  for (const e of [exponent - 1, exponent, exponent + 1]) {
    for (const mantissa of NICE_MANTISSAS) {
      const candidate = mantissa * 10 ** e;
      const diff = Math.abs(Math.log(candidate) - logTarget);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate;
      }
    }
  }
  return best;
}

/**
 * A scale bar's world-unit length and its resulting on-screen pixel length at the given zoom,
 * aiming for roughly `targetPixels` wide (default 100, a size that reads clearly without
 * dominating the corner it's drawn in). The world length is always a nice round number; the
 * pixel length follows from it, so it won't land on `targetPixels` exactly.
 */
export function computeScaleBar(zoom, targetPixels = 100) {
  const worldLength = pickNiceLength(targetPixels / zoom);
  return { worldLength, pixelLength: worldLength * zoom };
}
