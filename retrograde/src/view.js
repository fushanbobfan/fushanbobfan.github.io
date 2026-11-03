import {
  ELEMENTS, heliocentric, geocentric, dailyMotion, wrap180, earthCentredPath, epicycle, inner,
} from './orbits.js';

export const COLORS = {
  sun: '#f2c45a',
  earth: '#6fa8dc',
  mercury: '#b9b3a8',
  venus: '#e8d9a8',
  mars: '#e0704f',
  jupiter: '#d9b38c',
  saturn: '#e3cf8f',
  uranus: '#9fd8d8',
  neptune: '#7f9ce8',
  back: '#e86fd0',
  grid: '#262a30',
  text: '#9a9890',
  sight: 'rgba(233,230,223,0.35)',
  epicycle: '#8fc9a0',
};

export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// Distances from the centre in au map to pixels; past Mars the map is
// compressed so the Earth's orbit stays visible beside Neptune's.
export function radialScale(outer, pixels) {
  const k = outer > 3 ? 0.5 : 1;
  const R = outer * 1.08;
  return { k, f: (r) => pixels * Math.pow(r / R, k) };
}

function orbitPath(planet, jd) {
  const period = 36525 * 360 / ELEMENTS[planet][9];
  const pts = [];
  for (let i = 0; i <= 180; i++) pts.push(heliocentric(planet, jd + (i / 180) * period));
  return pts;
}

function toScreen(p, cx, cy, scale) {
  const r = Math.hypot(p.x, p.y);
  if (r === 0) return { x: cx, y: cy };
  const s = scale.f(r) / r;
  return { x: cx + p.x * s, y: cy - p.y * s };
}

// Seen from above the ecliptic's north pole: the Sun in the middle, the
// Earth and the chosen planet on their orbits, the line of sight from the
// Earth through the planet run out to a ring of sky, and the marks the
// sight line has left on that ring over the trail. With s.frame 'earth' the
// Earth holds still in the middle; the Sun circles it and the planet's
// track over the trail shows its loops.
export function drawOrrery(canvas, s) {
  const { ctx, w, h } = fitCanvas(canvas);
  const cx = w / 2, cy = h / 2;
  const ring = Math.min(w, h) / 2 - 18;
  const a = ELEMENTS[s.planet][0];
  const fromEarth = s.frame === 'earth';
  const scale = radialScale(fromEarth ? a * (1 + ELEMENTS[s.planet][1]) + 1.02 : Math.max(a, 1), ring - 26);
  const origin = fromEarth ? heliocentric('earth', s.jd) : { x: 0, y: 0, z: 0 };
  const place = (p) => toScreen({ x: p.x - origin.x, y: p.y - origin.y }, cx, cy, scale);
  ctx.clearRect(0, 0, w, h);

  // the sky ring with longitude ticks; 0° is the March equinox direction
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, ring, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.text;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 30) {
    const t = d * Math.PI / 180;
    ctx.strokeStyle = '#3a3f46';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(t) * (ring - 5), cy - Math.sin(t) * (ring - 5));
    ctx.lineTo(cx + Math.cos(t) * (ring + 5), cy - Math.sin(t) * (ring + 5));
    ctx.stroke();
    if (d % 90 === 0) {
      ctx.fillText(`${d}°`, cx + Math.cos(t) * (ring - 16), cy - Math.sin(t) * (ring - 16));
    }
  }

  const planets = fromEarth ? [] : s.showAll ? Object.keys(ELEMENTS) : ['earth', s.planet];
  if (fromEarth) drawEarthFrame(ctx, s, cx, cy, scale);
  for (const p of planets) {
    if (ELEMENTS[p][0] > a * 1.01 && p !== 'earth') continue;
    const path = orbitPath(p, s.jd);
    ctx.strokeStyle = p === s.planet || p === 'earth' ? '#3c424a' : '#24282d';
    ctx.beginPath();
    path.forEach((q, i) => {
      const v = toScreen(q, cx, cy, scale);
      if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // marks on the sky ring: where the sight line pointed over the trail
  if (s.trail > 0) {
    const step = Math.max(1, s.trail / 120);
    for (let t = s.jd - s.trail; t <= s.jd; t += step) {
      const g = geocentric(s.planet, t);
      const ang = g.lon * Math.PI / 180;
      const back = dailyMotion(s.planet, t) < 0;
      const age = (s.jd - t) / s.trail;
      ctx.fillStyle = back ? COLORS.back : COLORS[s.planet];
      ctx.globalAlpha = 0.15 + 0.85 * (1 - age);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * ring, cy - Math.sin(ang) * ring, 2.6, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const earth = place(heliocentric('earth', s.jd));
  const here = geocentric(s.planet, s.jd);
  const target = place(heliocentric(s.planet, s.jd));
  const sun = place({ x: 0, y: 0 });
  const ang = here.lon * Math.PI / 180;
  const rim = { x: cx + Math.cos(ang) * ring, y: cy - Math.sin(ang) * ring };

  // the sight line, drawn in screen space so it still meets the ring when
  // distances are compressed
  ctx.strokeStyle = COLORS.sight;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(earth.x, earth.y);
  ctx.lineTo(rim.x, rim.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // the Sun
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 7, 0, 2 * Math.PI);
  ctx.fill();

  if (s.showAll) {
    for (const p of Object.keys(ELEMENTS)) {
      if (p === 'earth' || p === s.planet || ELEMENTS[p][0] > a * 1.01) continue;
      const v = place(heliocentric(p, s.jd));
      ctx.fillStyle = COLORS[p];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  dot(ctx, earth, 5.5, COLORS.earth, 'Earth');
  dot(ctx, target, 5.5, COLORS[s.planet], s.label);
  ctx.strokeStyle = dailyMotion(s.planet, s.jd) < 0 ? COLORS.back : '#e9e6df';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(rim.x, rim.y, 6, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1;

  return scale;
}

// In the Earth's frame: the Sun's yearly circle, and the planet's track over
// the trail, pink where it runs backwards.
function drawEarthFrame(ctx, s, cx, cy, scale) {
  ctx.strokeStyle = '#3c424a';
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const e = heliocentric('earth', s.jd + (i / 120) * 365.26);
    const v = toScreen({ x: -e.x, y: -e.y }, cx, cy, scale);
    if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y);
  }
  ctx.stroke();
  if (s.trail <= 0) return;
  const n = Math.min(600, Math.max(60, Math.round(s.trail / 2)));
  const path = earthCentredPath(s.planet, s.jd - s.trail, s.jd, n);
  ctx.lineWidth = 1.6;
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i];
    const back = p.x * q.y - p.y * q.x < 0;
    ctx.strokeStyle = back ? COLORS.back : COLORS[s.planet];
    ctx.globalAlpha = 0.2 + 0.8 * (i / path.length);
    const u = toScreen(p, cx, cy, scale), v = toScreen(q, cx, cy, scale);
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(v.x, v.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  if (s.epicycles) drawEpicycle(ctx, s, cx, cy, scale);
}

// Ptolemy's construction for the current date: the deferent the centre
// rides on, the epicycle around that centre and the arm out to the planet.
// Circles go through the same radial map as everything else, so with
// compressed distances they bend a little.
function drawEpicycle(ctx, s, cx, cy, scale) {
  const ep = epicycle(s.planet, s.jd);
  const trace = (pts) => {
    ctx.beginPath();
    pts.forEach((q, i) => {
      const v = toScreen(q, cx, cy, scale);
      if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y);
    });
    ctx.closePath();
    ctx.stroke();
  };
  ctx.strokeStyle = COLORS.epicycle;
  ctx.setLineDash([2, 4]);
  if (!inner(s.planet)) {
    // the deferent: the planet's own orbit, now centred on the Earth
    const period = 36525 * 360 / ELEMENTS[s.planet][9];
    const pts = [];
    for (let i = 0; i < 180; i++) pts.push(heliocentric(s.planet, s.jd + (i / 180) * period));
    trace(pts);
  }
  const circle = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * 2 * Math.PI;
    circle.push({ x: ep.centre.x + ep.radius * Math.cos(a), y: ep.centre.y + ep.radius * Math.sin(a) });
  }
  trace(circle);
  ctx.setLineDash([]);
  const c = toScreen(ep.centre, cx, cy, scale);
  const tip = toScreen({ x: ep.centre.x + ep.arm.x, y: ep.centre.y + ep.arm.y }, cx, cy, scale);
  ctx.strokeStyle = COLORS.epicycle;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.epicycle;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 3, 0, 2 * Math.PI);
  ctx.fill();
}

function dot(ctx, v, r, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(v.x, v.y, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#e9e6df';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, v.x + r + 3, v.y - 2);
}

// The planet's path against the sky over a window around a date:
// ecliptic longitude across (east to the left, as when facing south from
// the northern hemisphere) and ecliptic latitude up, stretched so the loop
// opens out.
export function trackWindow(planet, jd, half) {
  const step = Math.max(0.5, half / 300);
  const pts = [];
  const centre = geocentric(planet, jd).lon;
  for (let t = jd - half; t <= jd + half + 1e-9; t += step) {
    const g = geocentric(planet, t);
    pts.push({ t, dlon: wrap180(g.lon - centre), lat: g.lat, back: dailyMotion(planet, t) < 0 });
  }
  return { centre, pts };
}

export function drawSky(canvas, s, monthTicks) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const mid = s.skyMid ?? s.jd;
  const { centre, pts } = trackWindow(s.planet, mid, s.half);
  let lonSpan = 0.5, latMin = Infinity, latMax = -Infinity;
  for (const p of pts) {
    lonSpan = Math.max(lonSpan, Math.abs(p.dlon));
    latMin = Math.min(latMin, p.lat);
    latMax = Math.max(latMax, p.lat);
  }
  lonSpan *= 1.08;
  const latMid = (latMin + latMax) / 2;
  const latSpan = Math.max(lonSpan * 0.08, (latMax - latMin) * 0.65);
  const pad = 22;
  const X = (dlon) => w / 2 - (dlon / lonSpan) * (w / 2 - pad);
  const Y = (lat) => h / 2 - ((lat - latMid) / latSpan) * (h / 2 - pad);

  // longitude grid every half degree up to every 20 degrees
  const stepDeg = [0.5, 1, 2, 5, 10, 20].find((d) => (2 * lonSpan) / d <= 9) || 30;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const first = Math.ceil((centre - lonSpan) / stepDeg) * stepDeg;
  for (let lon = first; lon <= centre + lonSpan; lon += stepDeg) {
    const x = X(wrap180(lon - centre));
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h - 16);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`${+((((lon % 360) + 360) % 360).toFixed(1))}°`, x, h - 14);
  }
  // the ecliptic itself, if it is in view
  if (Y(0) > 0 && Y(0) < h - 16) {
    ctx.strokeStyle = '#3c424a';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, Y(0));
    ctx.lineTo(w, Y(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ecliptic', 6, Y(0) - 2);
  }

  // the track: solid where it has been, faint where it is going
  ctx.lineWidth = 2.2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ctx.strokeStyle = b.back ? COLORS.back : COLORS[s.planet];
    ctx.globalAlpha = b.t <= s.jd ? 1 : 0.3;
    ctx.beginPath();
    ctx.moveTo(X(a.dlon), Y(a.lat));
    ctx.lineTo(X(b.dlon), Y(b.lat));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  // a tick on the track at the first of each month
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const m of monthTicks(mid - s.half, mid + s.half)) {
    const g = geocentric(s.planet, m.jd);
    const x = X(wrap180(g.lon - centre)), y = Y(g.lat);
    ctx.fillStyle = '#e9e6df';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, 2 * Math.PI);
    ctx.fill();
    if (m.label) {
      ctx.fillStyle = COLORS.text;
      ctx.fillText(m.label, x, y - 5);
    }
  }

  if (Math.abs(s.jd - mid) <= s.half) {
    const now = geocentric(s.planet, s.jd);
    ctx.fillStyle = COLORS[s.planet];
    ctx.strokeStyle = '#0e0f11';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(wrap180(now.lon - centre)), Y(now.lat), 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('east ←', 6, 6);
  ctx.textAlign = 'right';
  const stretch = ((h / 2 - pad) / latSpan) / ((w / 2 - pad) / lonSpan);
  if (stretch > 1.5) ctx.fillText(`latitude stretched ×${stretch.toFixed(0)}`, w - 6, 6);
}
