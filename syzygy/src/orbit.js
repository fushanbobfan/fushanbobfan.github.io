// The view from above the Earth's orbit. The Moon's orbit is drawn far larger
// than it is so that its tilt and its line of nodes can be seen; the solid half
// lies above the Earth's orbital plane and the dashed half below it.

export const SIZE = 420;
const C = SIZE / 2;
const EARTH_ORBIT = 150;
const MOON_ORBIT = 44;
const RAD = Math.PI / 180;

const f1 = (x) => x.toFixed(1);

// Ecliptic longitude to picture coordinates, counter-clockwise from the right.
function at(cx, cy, r, lonDeg) {
  return [cx + r * Math.cos(lonDeg * RAD), cy - r * Math.sin(lonDeg * RAD)];
}

function arc(cx, cy, r, from, to) {
  const [x0, y0] = at(cx, cy, r, from);
  const [x1, y1] = at(cx, cy, r, to);
  const sweep = ((to - from) % 360 + 360) % 360;
  return `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${f1(x1)} ${f1(y1)}`;
}

// Arcs of the Earth's orbit it travels through during each eclipse season.
function seasonArcs(seasonLons) {
  return seasonLons
    .map(([a, b]) => `<path class="season-arc" d="${arc(C, C, EARTH_ORBIT, a, b)}"/>`)
    .join('');
}

// The line of nodes is highlighted while the Sun is within `halfWidth` of it.
export function renderOrbit(snap, seasonLons = [], halfWidth = 17) {
  const earthLon = snap.sunLon + 180;
  const [ex, ey] = at(C, C, EARTH_ORBIT, earthLon);
  const asc = snap.node;
  const [ax, ay] = at(ex, ey, MOON_ORBIT, asc);
  const [dx, dy] = at(ex, ey, MOON_ORBIT, asc + 180);
  const [lx0, ly0] = at(ex, ey, SIZE, asc);
  const [lx1, ly1] = at(ex, ey, SIZE, asc + 180);
  const [mx, my] = at(ex, ey, MOON_ORBIT, snap.moonLon);
  const above = snap.moonLat >= 0;
  const aligned = Math.abs(snap.fromNode) < halfWidth;
  const label = `Seen from above: the Earth on its orbit around the Sun, the Moon on its tilted orbit around the Earth, and the line where the two orbits cross pointing ${Math.abs(snap.fromNode).toFixed(0)}° away from the Sun.`;
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${label}" class="orbit">`
    + `<defs><clipPath id="frame"><rect width="${SIZE}" height="${SIZE}"/></clipPath></defs>`
    + `<circle class="earth-orbit" cx="${C}" cy="${C}" r="${EARTH_ORBIT}"/>`
    + seasonArcs(seasonLons)
    + `<g clip-path="url(#frame)"><line class="node-line${aligned ? ' aligned' : ''}" x1="${f1(lx0)}" y1="${f1(ly0)}" x2="${f1(lx1)}" y2="${f1(ly1)}"/></g>`
    + `<line class="sunward" x1="${f1(ex)}" y1="${f1(ey)}" x2="${C}" y2="${C}"/>`
    + `<circle class="sun" cx="${C}" cy="${C}" r="18"/>`
    + `<path class="moon-orbit above" d="${arc(ex, ey, MOON_ORBIT, asc, asc + 180)}"/>`
    + `<path class="moon-orbit below" d="${arc(ex, ey, MOON_ORBIT, asc + 180, asc + 360)}"/>`
    + `<circle class="node asc" cx="${f1(ax)}" cy="${f1(ay)}" r="3.5"><title>ascending node: the Moon crosses the plane going up</title></circle>`
    + `<circle class="node desc" cx="${f1(dx)}" cy="${f1(dy)}" r="3.5"><title>descending node: the Moon crosses the plane going down</title></circle>`
    + `<circle class="earth" cx="${f1(ex)}" cy="${f1(ey)}" r="8"/>`
    + `<circle class="moon ${above ? 'up' : 'down'}" cx="${f1(mx)}" cy="${f1(my)}" r="5.5"/>`
    + `<text class="orbit-note" x="12" y="${SIZE - 30}">solid: Moon above the plane</text>`
    + `<text class="orbit-note" x="12" y="${SIZE - 14}">dashed: below · line: where the orbits cross</text>`
    + '</svg>';
}

// Turn season time spans into the Earth's heliocentric longitudes.
export function seasonLongitudes(seasons, sunLonAt) {
  return seasons.map((s) => [sunLonAt(s.start) + 180, sunLonAt(s.end) + 180]);
}
