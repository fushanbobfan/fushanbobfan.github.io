// Plain-language lines for the readout.

const fmt = (n) => n.toLocaleString('en-US');

function offset(dx, dy) {
  const parts = [];
  if (dx) parts.push(`${Math.abs(dx)} ${dx > 0 ? 'right' : 'left'}`);
  if (dy) parts.push(`${Math.abs(dy)} ${dy > 0 ? 'down' : 'up'}`);
  return parts.join(' and ');
}

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

// Axial offsets are hard to read, so give the hex distance in cells and the
// nearest compass direction on screen.
function hexOffset(dq, dr) {
  const cells = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  const angle = Math.atan2(dr * (Math.sqrt(3) / 2), dq + dr / 2);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return `${cells} ${cells === 1 ? 'cell' : 'cells'} ${COMPASS[sector]}`;
}

export function describePattern({ highway, ants, steps, lattice = 'square' }) {
  if (ants !== 1) return 'The repeat check follows a single ant; with several ants, watch for yourself.';
  if (!highway) {
    return steps < 4096
      ? 'Checking for a repeating pattern every 4,096 steps.'
      : `No repeating pattern in the last few thousand of ${fmt(steps)} steps.`;
  }
  const since = highway.onsetExact ? `since step ${fmt(highway.onset)}` : `since before step ${fmt(highway.onset)}`;
  const every = `repeats every ${fmt(highway.period)} steps`;
  if (!highway.dx && !highway.dy) return `Loop ${since}: the ant ${every} without going anywhere.`;
  const moved = lattice === 'hex' ? hexOffset(highway.dx, highway.dy) : offset(highway.dx, highway.dy);
  return `Highway ${since}: the ant ${every}, moving ${moved} each time.`;
}

export function describeHalt(halted, size) {
  return halted === 'edge' ? `Stopped at the edge of the ${size} × ${size} grid. Reset to run again.` : '';
}
