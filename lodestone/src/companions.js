// Bobs released alongside the main one, to show how much a tiny change in the
// starting point matters.

export const SPREAD = 0.01;

// Starting points for the chosen company: the main bob first, then either one
// twin SPREAD to the right, or `fan - 1` others evenly round a circle of radius SPREAD.
export function companionStarts(x, y, mode, fan = 12) {
  const starts = [[x, y]];
  if (mode === 'twin') starts.push([x + SPREAD, y]);
  if (mode === 'fan') {
    const others = fan - 1;
    for (let k = 0; k < others; k++) {
      const a = (2 * Math.PI * k) / others;
      starts.push([x + SPREAD * Math.cos(a), y + SPREAD * Math.sin(a)]);
    }
  }
  return starts;
}

// How many bobs each magnet caught so far, how many came to rest elsewhere or
// ran out of time, and how many are still moving.
export function tally(bobs, magnetCount) {
  const caught = new Array(magnetCount).fill(0);
  let lost = 0;
  let moving = 0;
  for (const b of bobs) {
    if (b.caught >= 0) caught[b.caught]++;
    else if (b.done) lost++;
    else moving++;
  }
  return { caught, lost, moving, total: bobs.length };
}

// "5 orange, 4 blue and 3 green": magnets with no bobs are left out.
export function tallyWords(t, names) {
  const parts = [];
  t.caught.forEach((n, i) => {
    if (n > 0) parts.push(`${n} ${names[i]}`);
  });
  if (t.lost > 0) parts.push(`${t.lost} not caught`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
