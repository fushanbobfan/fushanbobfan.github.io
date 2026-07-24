// Converts a grid to and from a plain JSON-compatible shape, so a grid built by hand (walls,
// weighted terrain, start, and end) can be saved to a file and loaded back later, instead of
// having to be redrawn every session. Kept free of any DOM dependency, like grid.js itself —
// main.js is the only place that touches File/Blob.
import { EMPTY, WALL, START, END } from "./grid.js";

const VALID_TYPES = new Set([EMPTY, WALL, START, END]);

/** The current shape's version, bumped if the format ever needs to change incompatibly. */
export const FORMAT_VERSION = 1;

/**
 * @param {{type: string, weight: number}[][]} grid
 * @returns a plain object safe to `JSON.stringify` and later round-trip with `deserializeGrid`
 */
export function serializeGrid(grid) {
  return {
    version: FORMAT_VERSION,
    rows: grid.length,
    cols: grid[0]?.length ?? 0,
    cells: grid.map((row) => row.map((cell) => [cell.type, cell.weight])),
  };
}

/**
 * Parses a serialized grid, requiring it to match `expectedRows` x `expectedCols` exactly —
 * the app always draws a fixed-size grid, so a mismatch almost always means the file came from
 * a differently-sized session rather than something this app should try to resize around.
 * Throws a descriptive `Error` for anything malformed, rather than producing a partially valid
 * grid from a hand-edited or corrupted file.
 * @returns {{type: string, weight: number}[][]}
 */
export function deserializeGrid(json, expectedRows, expectedCols) {
  if (!json || typeof json !== "object") {
    throw new Error("Not a grid file: expected a JSON object.");
  }
  const { rows, cols, cells } = json;
  if (rows !== expectedRows || cols !== expectedCols) {
    throw new Error(`Grid size mismatch: file is ${rows}x${cols}, expected ${expectedRows}x${expectedCols}.`);
  }
  if (!Array.isArray(cells) || cells.length !== rows) {
    throw new Error(`Invalid grid: expected ${rows} row(s) of cells.`);
  }

  let startCount = 0;
  let endCount = 0;
  const grid = cells.map((row, r) => {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(`Invalid grid: row ${r} must have ${cols} cell(s).`);
    }
    return row.map((entry, c) => {
      if (!Array.isArray(entry) || entry.length !== 2) {
        throw new Error(`Invalid grid: cell (${r}, ${c}) is malformed.`);
      }
      const [type, weight] = entry;
      if (!VALID_TYPES.has(type)) {
        throw new Error(`Invalid grid: cell (${r}, ${c}) has an unknown type "${type}".`);
      }
      if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
        throw new Error(`Invalid grid: cell (${r}, ${c}) has an invalid weight.`);
      }
      if (type === START) startCount++;
      if (type === END) endCount++;
      return { type, weight };
    });
  });

  if (startCount > 1) throw new Error("Invalid grid: more than one start cell.");
  if (endCount > 1) throw new Error("Invalid grid: more than one end cell.");

  return grid;
}
