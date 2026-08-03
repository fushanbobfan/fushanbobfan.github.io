// Turns the current grid into a URL that reproduces it when opened, so a hand-drawn maze or
// terrain layout can be shared with a link instead of a downloaded file. Builds on the same
// serializeGrid/deserializeGrid pair "Save grid" / "Load grid…" already use, and stays DOM-free
// (only global URL/URLSearchParams/btoa/atob, available in both a browser and Node) so it can
// be tested without a File or Blob API.

import { serializeGrid, deserializeGrid } from "./serialize.js";

const HASH_KEY = "share";

// btoa/atob operate on Latin1 strings; a JSON string is plain ASCII here (grid cell types and
// numbers only), but escaping through encodeURIComponent first keeps this correct even if a
// future cell field ever added non-Latin1 text, the same trick used to base64-encode arbitrary
// Unicode text in a browser.
function toBase64(text) {
  const bytes = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return btoa(bytes);
}

function fromBase64(base64) {
  const bytes = atob(base64);
  const percentEncoded = Array.prototype.map
    .call(bytes, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return decodeURIComponent(percentEncoded);
}

/** Encodes a grid as an opaque, URL-safe base64 fragment. */
export function encodeGridToFragment(grid) {
  return toBase64(JSON.stringify(serializeGrid(grid)));
}

/**
 * Decodes a fragment produced by encodeGridToFragment back into a validated grid, throwing a
 * descriptive Error on the first problem found — a hand-edited or truncated link should be
 * rejected outright rather than partially applied, same as "Load grid…".
 */
export function decodeGridFromFragment(fragment, expectedRows, expectedCols) {
  if (typeof fragment !== "string" || fragment.length === 0) {
    throw new Error("Share link has no grid data.");
  }

  let json;
  try {
    json = fromBase64(fragment);
  } catch {
    throw new Error("Share link's grid data is not valid base64.");
  }

  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Share link's grid data is not valid JSON.");
  }

  return deserializeGrid(data, expectedRows, expectedCols);
}

/** Builds a full shareable URL for a grid, replacing any existing hash on `baseUrl`. */
export function buildShareUrl(grid, baseUrl) {
  const url = new URL(baseUrl);
  url.hash = `${HASH_KEY}=${encodeGridToFragment(grid)}`;
  return url.toString();
}

/**
 * Pulls the share fragment out of a location.hash-style string (leading "#" optional),
 * returning null if it has no share parameter rather than throwing — the common case of
 * opening the app with no hash at all is not an error.
 */
export function extractShareFragment(hash) {
  if (typeof hash !== "string" || hash.length === 0) {
    return null;
  }
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return params.get(HASH_KEY);
}
