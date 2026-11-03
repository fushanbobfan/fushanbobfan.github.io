import {
  PLANETS, VALID_FROM, VALID_TO, julianDay, geocentric, elongation, dailyMotion,
  siderealPeriod, synodicPeriod, loops, inner,
} from './orbits.js';
import { day, isoDay, fromIsoDay, days, degrees, motion, monthTicks } from './format.js';
import { drawOrrery, drawSky } from './view.js';

const $ = (id) => document.getElementById(id);
const orrery = $('orrery'), sky = $('sky');

// Half the width of the sky window, in days, wide enough to hold a loop.
const HALF = { mercury: 40, venus: 70, mars: 140, jupiter: 120, saturn: 130, uranus: 140, neptune: 150 };
const NAMES = Object.fromEntries(PLANETS.map((p) => [p, p[0].toUpperCase() + p.slice(1)]));

const state = {
  planet: 'mars',
  jd: today(),
  speed: 7,
  playing: false,
  showAll: true,
  trailFrac: 1,
  skyMode: 'loop',
  frame: 'sun',
  epicycles: false,
};

let cache = { key: '', list: [] };

// The viewer's calendar day, read as a UTC date like the date box.
function today() {
  const d = new Date();
  return clamp(julianDay(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))));
}

function clamp(jd) {
  return Math.min(VALID_TO - 1, Math.max(VALID_FROM, jd));
}

// Loops within a couple of synodic periods of the date, cached by planet and
// a coarse slice of time so playback does not recompute them every frame.
function nearbyLoops() {
  const syn = synodicPeriod(state.planet);
  const slice = Math.floor(state.jd / (syn / 2));
  const key = `${state.planet}:${slice}`;
  if (cache.key !== key) {
    const centre = (slice + 0.5) * (syn / 2);
    cache = { key, list: loops(state.planet, clamp(centre - 2 * syn), clamp(centre + 2 * syn)) };
  }
  return cache.list;
}

function trailDays() {
  return state.trailFrac * synodicPeriod(state.planet) / 2;
}

// The middle of the sky window: the nearest loop's, or the date itself.
function skyMid() {
  if (state.skyMode !== 'loop') return state.jd;
  let best = null;
  for (const l of nearbyLoops()) {
    if (!best || Math.abs(l.middle - state.jd) < Math.abs(best.middle - state.jd)) best = l;
  }
  return best ? best.middle : state.jd;
}

function render() {
  const mid = skyMid();
  const s = {
    skyMid: mid,
    planet: state.planet,
    label: NAMES[state.planet],
    jd: state.jd,
    showAll: state.showAll,
    frame: state.frame,
    epicycles: state.epicycles,
    trail: trailDays(),
    half: HALF[state.planet],
  };
  const scale = drawOrrery(orrery, s);
  drawSky(sky, s, monthTicks);
  const title = state.frame === 'earth' ? 'With the Earth held still' : 'From above the Sun';
  $('top-caption').textContent = scale.k === 1 ? title : `${title}, distances compressed`;
  readouts(mid);
}

function readouts(mid) {
  const p = state.planet, jd = state.jd;
  const g = geocentric(p, jd);
  const v = dailyMotion(p, jd);
  const el = elongation(p, jd);
  $('date').value = isoDay(jd);
  $('sky-caption').textContent = `In the sky, ${day(mid - HALF[p])} to ${day(mid + HALF[p])}`;
  $('r-lon').textContent = `${degrees(g.lon)}, ${g.lat >= 0 ? '+' : ''}${degrees(g.lat, 2)}`;
  $('r-motion').textContent = motion(v);
  $('r-motion').classList.toggle('back', v < 0);
  $('r-elong').textContent = Math.abs(el) > 178 ? 'opposite the Sun, up all night'
    : Math.abs(el) < 2 ? 'in line with the Sun'
      : `${degrees(Math.abs(el), 0)} ${el >= 0 ? 'east (evening sky)' : 'west (morning sky)'}`;
  $('r-dist').textContent = `${g.dist.toFixed(3)} au`;

  const list = nearbyLoops();
  const now = list.find((l) => l.start <= jd && jd <= l.end);
  const next = list.find((l) => l.start > jd);
  const middle = inner(p) ? 'inferior conjunction' : 'opposition';
  let text;
  if (now) {
    text = `Backing up: day ${Math.floor(jd - now.start) + 1} of ${Math.round(now.days)}. ` +
      `It turns forward again on ${day(now.end)}; ${middle} ${jd < now.middle ? 'comes' : 'came'} on ${day(now.middle)}.`;
  } else if (next) {
    text = `Moving east. The next loop starts in ${days(next.start - jd)}, on ${day(next.start)}.`;
  } else {
    text = 'Moving east.';
  }
  $('r-loop').textContent = text;
  $('status').textContent = `${day(jd)} · ${NAMES[p]} ${v < 0 ? 'moving west against the stars' : 'moving east against the stars'}`;

  const ol = $('loops');
  ol.replaceChildren(...list.map((l) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${day(l.start)} – ${day(l.end)}`;
    b.title = `Go to the ${middle}`;
    b.addEventListener('click', () => go(l.middle));
    const meta = document.createElement('span');
    meta.textContent = `${Math.round(l.days)} days, ${degrees(l.arc)} back`;
    li.append(b, meta);
    if (l === now) li.classList.add('current');
    return li;
  }));
}

function go(jd) {
  state.jd = clamp(jd);
  render();
}

function jumpLoop(dir) {
  const list = nearbyLoops();
  const target = dir > 0
    ? list.find((l) => l.middle > state.jd + 0.5)
    : [...list].reverse().find((l) => l.middle < state.jd - 0.5);
  if (target) go(target.middle);
}

function setPlaying(on) {
  state.playing = on;
  const b = $('play');
  b.textContent = on ? 'Pause' : 'Play';
  const k = document.createElement('kbd');
  k.textContent = 'Space';
  b.append(k);
  if (on) {
    last = performance.now();
    requestAnimationFrame(tick);
  }
}

let last = 0;
function tick(now) {
  if (!state.playing) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  state.jd += dt * state.speed;
  if (state.jd >= VALID_TO - 1) {
    state.jd = VALID_TO - 1;
    setPlaying(false);
  }
  render();
  if (state.playing) requestAnimationFrame(tick);
}

function updateStatic() {
  const p = state.planet;
  $('r-synodic').textContent = `${days(synodicPeriod(p))} (${(synodicPeriod(p) / 365.25).toFixed(2)} years)`;
  $('r-sidereal').textContent = `${(siderealPeriod(p) / 365.25).toFixed(2)} Earth years`;
  $('trail-out').textContent = days(trailDays());
}

$('planet').addEventListener('change', (e) => {
  state.planet = e.target.value;
  updateStatic();
  render();
});
$('date').addEventListener('change', (e) => {
  const jd = fromIsoDay(e.target.value);
  if (jd !== null) go(jd);
});
$('speed').addEventListener('change', (e) => { state.speed = Number(e.target.value); });
$('play').addEventListener('click', () => setPlaying(!state.playing));
$('today').addEventListener('click', () => go(today()));
$('prev-loop').addEventListener('click', () => jumpLoop(-1));
$('next-loop').addEventListener('click', () => jumpLoop(1));
function setFrame(frame) {
  state.frame = frame;
  $('frame').value = frame;
  $('epicycles-row').hidden = frame !== 'earth';
  render();
}

$('frame').addEventListener('change', (e) => setFrame(e.target.value));
$('epicycles').addEventListener('change', (e) => { state.epicycles = e.target.checked; render(); });
$('sky-mode').addEventListener('change', (e) => { state.skyMode = e.target.value; render(); });
$('all').addEventListener('change', (e) => { state.showAll = e.target.checked; render(); });
$('trail').addEventListener('input', (e) => {
  state.trailFrac = Number(e.target.value);
  updateStatic();
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') && e.key !== 'Escape') return;
  if (e.key === ' ') {
    e.preventDefault();
    setPlaying(!state.playing);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    go(state.jd + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1));
  } else if (e.key === 'e' || e.key === 'E') {
    setFrame(state.frame === 'earth' ? 'sun' : 'earth');
  } else if (e.key === 'n' || e.key === 'N') {
    jumpLoop(e.shiftKey ? -1 : 1);
  } else if (e.key >= '1' && e.key <= '7') {
    state.planet = PLANETS[Number(e.key) - 1];
    $('planet').value = state.planet;
    updateStatic();
    render();
  }
});

new ResizeObserver(() => render()).observe(document.querySelector('.stage'));
updateStatic();
render();
