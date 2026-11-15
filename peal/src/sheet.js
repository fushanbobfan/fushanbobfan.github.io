// Layout of a method sheet: the rows of a course printed lead by lead in
// columns, the way ringers' diagrams set them out. Pure geometry, no canvas.

// Each column holds one lead plus its closing row (the next lead head), so
// the line can be followed across the join. Returns, for every row index,
// where it is printed; rows that close a lead appear twice.
export function sheetLayout(rowCount, leadLength) {
  const leads = Math.max(1, Math.ceil((rowCount - 1) / leadLength));
  const cells = [];
  for (let lead = 0; lead < leads; lead++) {
    for (let k = 0; k <= leadLength; k++) {
      const index = lead * leadLength + k;
      if (index >= rowCount) break;
      cells.push({ index, column: lead, line: k });
    }
  }
  return { columns: leads, linesPerColumn: leadLength + 1, cells };
}

// Fit the sheet into a box. Returns the size of one character cell, the
// column gap and the canvas size actually needed.
export function fitSheet(layout, stage, maxWidth, { minCell = 7, maxCell = 18, gapCells = 1.6 } = {}) {
  const widthCells = layout.columns * stage + (layout.columns - 1) * gapCells;
  const cell = Math.max(minCell, Math.min(maxCell, Math.floor(maxWidth / widthCells)));
  const lineHeight = Math.round(cell * 1.15);
  return {
    cell,
    lineHeight,
    gap: cell * gapCells,
    width: Math.ceil(widthCells * cell),
    height: layout.linesPerColumn * lineHeight + lineHeight,
  };
}

// Centre of the character at (column, line, place) in canvas pixels.
export function cellCentre(fit, stage, column, line, place) {
  return [
    column * (stage * fit.cell + fit.gap) + (place + 0.5) * fit.cell,
    (line + 1) * fit.lineHeight,
  ];
}
