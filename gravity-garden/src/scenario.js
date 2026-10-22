// Save/load the simulation state as plain JSON, so a scenario built up by dropping and
// nudging bodies interactively can be exported to a file and loaded back later. Kept
// DOM-free, like physics.js and viewport.js, so serialization and validation can be
// tested without a File/Blob API.

const CURRENT_VERSION = 1;
const BODY_NUMERIC_FIELDS = ["mass", "x", "y", "vx", "vy", "radius"];

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Builds a plain, JSON-serializable snapshot of the simulation. Deliberately omits each
 * body's `id` and `trail`: those are session-specific bookkeeping (selection identity,
 * drawn history) that a freshly loaded scenario should regenerate rather than replay.
 */
export function serializeScenario({ bodies, G, softening, viewport }) {
  return {
    version: CURRENT_VERSION,
    G,
    softening,
    viewport: { panX: viewport.panX, panY: viewport.panY, zoom: viewport.zoom },
    bodies: bodies.map((b) => ({
      mass: b.mass,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      radius: b.radius,
      color: b.color,
    })),
  };
}

/**
 * Validates and normalizes a parsed scenario object (e.g. from JSON.parse on a
 * user-supplied file), throwing a descriptive Error on the first problem found rather
 * than letting a malformed file silently corrupt the running simulation.
 */
export function deserializeScenario(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Scenario file must contain a JSON object.");
  }
  if (!isFiniteNumber(data.G) || data.G <= 0) {
    throw new Error("Scenario's G must be a positive number.");
  }
  if (!isFiniteNumber(data.softening) || data.softening < 0) {
    throw new Error("Scenario's softening must be a non-negative number.");
  }
  if (!Array.isArray(data.bodies) || data.bodies.length === 0) {
    throw new Error("Scenario must include at least one body.");
  }

  const bodies = data.bodies.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Body ${index} must be an object.`);
    }
    for (const field of BODY_NUMERIC_FIELDS) {
      if (!isFiniteNumber(raw[field])) {
        throw new Error(`Body ${index}'s "${field}" must be a finite number.`);
      }
    }
    if (raw.mass <= 0) throw new Error(`Body ${index}'s mass must be positive.`);
    if (raw.radius <= 0) throw new Error(`Body ${index}'s radius must be positive.`);
    if (typeof raw.color !== "string" || raw.color.length === 0) {
      throw new Error(`Body ${index}'s color must be a non-empty string.`);
    }
    return {
      mass: raw.mass,
      x: raw.x,
      y: raw.y,
      vx: raw.vx,
      vy: raw.vy,
      radius: raw.radius,
      color: raw.color,
    };
  });

  const rawViewport = data.viewport;
  const viewport =
    typeof rawViewport === "object" && rawViewport !== null
      ? {
          panX: isFiniteNumber(rawViewport.panX) ? rawViewport.panX : 0,
          panY: isFiniteNumber(rawViewport.panY) ? rawViewport.panY : 0,
          zoom: isFiniteNumber(rawViewport.zoom) ? rawViewport.zoom : 1,
        }
      : { panX: 0, panY: 0, zoom: 1 };

  return { G: data.G, softening: data.softening, bodies, viewport };
}
