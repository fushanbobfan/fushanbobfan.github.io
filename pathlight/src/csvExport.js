// Formats compare.js's per-algorithm results as CSV text, kept free of any DOM or File
// dependency (like compare.js itself) so the encoding logic can be tested without a browser.

const HEADER = ["Algorithm", "Cells explored", "Steps", "Cost"];

// RFC 4180: a field containing a comma, double quote, or newline is wrapped in double quotes,
// with any double quote inside it doubled. Every other field is written as plain text.
function csvField(value) {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * @param {{label:string, visitedCount:number, found:boolean, steps:number|null, cost:number|null}[]} results
 *   compareAlgorithms' output, in the order it should appear as rows
 * @returns {string} CSV text with a header row, CRLF line endings, and a trailing newline —
 *   a path search reports its steps/cost as `null` when no path was found, which this renders
 *   as the same "unreachable" text `renderComparison`'s table already shows for that case
 */
export function compareResultsToCsv(results) {
  const rows = results.map((r) => [
    r.label,
    r.visitedCount,
    r.found ? r.steps : "unreachable",
    r.found ? r.cost : "unreachable",
  ]);
  return [HEADER, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}
