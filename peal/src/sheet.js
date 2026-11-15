// Layout of a method sheet: the rows of a touch printed lead by lead in
// columns, the way ringers' diagrams set them out. Long touches wrap onto
// further bands of columns below. Pure geometry, no canvas.

// Each column holds one lead plus its closing row (the next lead head), so
// the line can be followed across the join. Returns, for every row index,
// where it is printed; rows that close a lead appear twice.
export function sheetLayout(rowCount, leadLength, maxColumns = Infinity) {
  const leads = Math.max(1, Math.ceil((rowCount - 1) / leadLength));
  const perBand = Math.max(1, Math.min(leads, maxColumns));
  const cells = [];
  for (let lead = 0; lead < leads; lead++) {
    const band = Math.floor(lead / perBand);
    const column = lead % perBand;
    for (let k = 0; k <= leadLength; k++) {
      const index = lead * leadLength + k;
      if (index >= rowCount) break;
      cells.push({ index, lead, band, column, line: k });
    }
  }
  return {
    leads,
    columns: perBand,
    bands: Math.ceil(leads / perBand),
    linesPerColumn: leadLength + 1,
    cells,
  };
}

// How many columns fit across a width at the smallest readable cell size.
export function columnsThatFit(stage, maxWidth, { minCell = 9, gapCells = 1.6 } = {}) {
  return Math.max(1, Math.floor((maxWidth / minCell + gapCells) / (stage + gapCells)));
}

// Fit the sheet into a box. Returns the size of one character cell, the
// column gap and the canvas size actually needed.
export function fitSheet(layout, stage, maxWidth, { minCell = 7, maxCell = 18, gapCells = 1.6 } = {}) {
  const widthCells = layout.columns * stage + (layout.columns - 1) * gapCells;
  const cell = Math.max(minCell, Math.min(maxCell, Math.floor(maxWidth / widthCells)));
  const lineHeight = Math.round(cell * 1.15);
  const bandHeight = (layout.linesPerColumn + 1) * lineHeight;
  return {
    cell,
    lineHeight,
    bandHeight,
    gap: cell * gapCells,
    width: Math.ceil(widthCells * cell),
    height: (layout.bands ?? 1) * bandHeight,
  };
}

// Centre of the character at (column, line, place) of a band, in pixels.
export function cellCentre(fit, stage, column, line, place, band = 0) {
  return [
    column * (stage * fit.cell + fit.gap) + (place + 0.5) * fit.cell,
    band * fit.bandHeight + (line + 1) * fit.lineHeight,
  ];
}
