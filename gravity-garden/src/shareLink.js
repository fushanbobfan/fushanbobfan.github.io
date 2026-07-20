// Turns a running scenario into a URL that reproduces it when opened, so a scenario built up
// interactively can be shared with a link instead of a downloaded file. Builds on the same
// serializeScenario/deserializeScenario pair scenario export/import and local saves use, and
// stays DOM-free (only global URL/URLSearchParams/btoa/atob, available in both a browser and
// Node) so it can be tested without a File or Blob API.

import { serializeScenario, deserializeScenario } from "./scenario.js";

const HASH_KEY = "share";

// btoa/atob operate on Latin1 strings, so a JSON string containing non-Latin1 characters (e.g.
// a body color or emoji pasted into a future field) needs escaping to and from a byte sequence
// first, the same trick used to base64-encode arbitrary Unicode text in a browser.
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

/** Encodes a scenario (in the {bodies, G, softening, viewport} shape) as an opaque fragment. */
export function encodeScenarioToFragment(scenario) {
  return toBase64(JSON.stringify(serializeScenario(scenario)));
}

/**
 * Decodes a fragment produced by encodeScenarioToFragment back into a validated scenario,
 * throwing a descriptive Error on the first problem found — a hand-edited or truncated link
 * should be rejected outright rather than partially applied, same as scenario import.
 */
export function decodeScenarioFromFragment(fragment) {
  if (typeof fragment !== "string" || fragment.length === 0) {
    throw new Error("Share link has no scenario data.");
  }

  let json;
  try {
    json = fromBase64(fragment);
  } catch {
    throw new Error("Share link's scenario data is not valid base64.");
  }

  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Share link's scenario data is not valid JSON.");
  }

  return deserializeScenario(data);
}

/** Builds a full shareable URL for a scenario, replacing any existing hash on `baseUrl`. */
export function buildShareUrl(scenario, baseUrl) {
  const url = new URL(baseUrl);
  url.hash = `${HASH_KEY}=${encodeScenarioToFragment(scenario)}`;
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
