// Regions of a side x side grid for the pile to live on. Each returns a mask
// with 1 for cells that hold sand.

export const SHAPES = {
  square: 'Square',
  disc: 'Disc',
  diamond: 'Diamond',
  ring: 'Ring',
};

export function makeMask(shape, side) {
  const mask = new Uint8Array(side * side);
  const c = (side - 1) / 2;
  const r = side / 2;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const dx = x - c;
      const dy = y - c;
      const d2 = dx * dx + dy * dy;
      let on;
      if (shape === 'disc') on = d2 <= r * r;
      else if (shape === 'diamond') on = Math.abs(dx) + Math.abs(dy) <= r;
      else if (shape === 'ring') on = d2 <= r * r && d2 >= (r * 0.45) ** 2;
      else on = true;
      mask[y * side + x] = on ? 1 : 0;
    }
  }
  return mask;
}

// Indices of the switched-on cells, for picking random sites.
export function activeCells(mask) {
  const out = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) out.push(i);
  return Int32Array.from(out);
}
