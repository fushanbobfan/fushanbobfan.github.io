import { moon, sun, EARTH_RADIUS, MOON_MEAN_DISTANCE, MOON_PERIGEE, MOON_APOGEE } from './tides.js';
import { renderField } from './field.js';
import { rows, distanceLabel, liveText } from './readout.js';
import { renderMonth, monthSummary, when, eventLabel } from './monthchart.js';
import { equatorialSky } from './month.js';
import { julianDay, calendarDate, utcToJde } from './time.js';

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;

const state = {
  mode: 'tidal',
  moonAngle: 0,
  moonDistance: MOON_MEAN_DISTANCE,
  sunOn: false,
  sunAngle: 0,
  ocean: true,
  // The chart window: first day (JDE) and the moment shown, in days from it.
  start: 0,
  day: 0,
  dated: false,
};

const WINDOW_DAYS = 59;
const DAY_STEP = 0.125;
const FIRST_MONTH = 1900 * 12;
const LAST_MONTH = 2100 * 12 + 11;

let sunDistance = undefined;

const PRESETS = { perigee: MOON_PERIGEE, mean: MOON_MEAN_DISTANCE, apogee: MOON_APOGEE };

function bodies() {
  return {
    moonBody: moon(state.moonAngle * DEG, state.moonDistance),
    sunBody: state.sunOn ? sun(state.sunAngle * DEG, sunDistance) : null,
  };
}

function render() {
  const b = bodies();
  const pic = renderField({ ...b, mode: state.mode, showOcean: state.ocean });
  $('field').innerHTML = pic.svg;
  const dl = $('readout');
  dl.replaceChildren();
  for (const [k, v] of rows({ ...b, longest: pic.longest, exaggeration: pic.exaggeration, mode: state.mode, moment: state.dated ? when(state.start + state.day) : null })) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  $('moon-angle').value = String(Math.round(state.moonAngle) % 360);
  $('moon-angle-value').textContent = `${Math.round(state.moonAngle) % 360}°`;
  $('moon-distance').value = (state.moonDistance / EARTH_RADIUS).toFixed(1);
  $('moon-distance-value').textContent = distanceLabel(state.moonDistance);
  $('sun-angle').disabled = !state.sunOn;
  $('sun-angle').value = String(Math.round(state.sunAngle) % 360);
  $('sun-angle-value').textContent = state.sunOn ? `${Math.round(state.sunAngle) % 360}°` : '';
  $('pull-label').textContent = state.sunOn ? "The Moon's and the Sun's pull" : "The Moon's pull";
  $('live').textContent = liveText(b);
  renderChart();
}

let chart = null;
let chartKey = '';
function renderChart() {
  const key = `${state.start}|${state.dated ? state.day : 'x'}`;
  if (key === chartKey) return;
  chartKey = key;
  chart = renderMonth({ start: state.start, days: WINDOW_DAYS, selected: state.dated ? state.start + state.day : null });
  $('month').innerHTML = chart.svg;
  $('month-summary').textContent = monthSummary(chart);
  const list = $('event-list');
  list.replaceChildren(...chart.events.map((e) => {
    const li = document.createElement('li');
    li.textContent = eventLabel(e);
    return li;
  }));
  const c = calendarDate(state.start);
  $('month-start').value = `${c.year}-${String(c.month).padStart(2, '0')}`;
  $('day').value = String(state.day);
  const idx = monthIndex();
  $('month-prev').disabled = idx <= FIRST_MONTH;
  $('month-next').disabled = idx >= LAST_MONTH;
  $('day-value').textContent = state.dated ? when(state.start + state.day) : 'drag the slider or click the chart';
}

// Put the real Moon and Sun of a moment into the picture, seen from above the
// North Pole with right ascension measured counterclockwise. The moment is
// kept on the slider's steps so the slider, the cursor and the picture agree.
function showMoment(day) {
  state.day = Math.max(0, Math.min(WINDOW_DAYS, Math.round(day / DAY_STEP) * DAY_STEP));
  state.dated = true;
  const k = equatorialSky(state.start + state.day);
  state.moonAngle = k.moon.ra;
  state.moonDistance = k.moon.distance;
  state.sunOn = true;
  state.sunAngle = k.sun.ra;
  $('sun-on').checked = true;
  sunDistance = k.sun.distance;
  render();
}

function monthIndex() {
  const c = calendarDate(state.start);
  return c.year * 12 + (c.month - 1);
}

function setMonth(idx) {
  const i = Math.max(FIRST_MONTH, Math.min(LAST_MONTH, idx));
  state.start = utcToJde(julianDay(Math.floor(i / 12), (i % 12) + 1, 1));
  showMoment(state.day);
}

for (const r of document.querySelectorAll('input[name="mode"]')) {
  r.addEventListener('change', () => { state.mode = r.value; render(); });
}
$('moon-angle').addEventListener('input', (e) => { state.moonAngle = Number(e.target.value); undate(); render(); });
$('moon-distance').addEventListener('input', (e) => {
  state.moonDistance = Number(e.target.value) * EARTH_RADIUS;
  undate();
  render();
});
for (const btn of document.querySelectorAll('[data-distance]')) {
  btn.addEventListener('click', () => { state.moonDistance = PRESETS[btn.dataset.distance]; undate(); render(); });
}
$('sun-on').addEventListener('change', (e) => { state.sunOn = e.target.checked; undate(); render(); });
$('sun-angle').addEventListener('input', (e) => { state.sunAngle = Number(e.target.value); undate(); render(); });
$('ocean-on').addEventListener('change', (e) => { state.ocean = e.target.checked; render(); });

// Drag the Moon round the Earth. Only the pointer that grabbed it moves it.
let dragging = null;
function angleFromEvent(e) {
  const svg = $('field').querySelector('svg');
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const a = Math.atan2(-p.y, p.x) / DEG;
  return (Math.round(a) + 360) % 360;
}
$('field').addEventListener('pointerdown', (e) => {
  if (!(e.target instanceof Element) || e.target.id !== 'moon-handle') return;
  if (dragging !== null) return;
  dragging = e.pointerId;
  $('field').setPointerCapture(e.pointerId);
  e.preventDefault();
});
$('field').addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragging) return;
  state.moonAngle = angleFromEvent(e);
  undate();
  render();
});
const stop = (e) => { if (e.pointerId === dragging) dragging = null; };
$('field').addEventListener('pointerup', stop);
$('field').addEventListener('pointercancel', stop);
$('field').addEventListener('lostpointercapture', stop);

// Any hand change to the Moon or the Sun leaves the dated moment behind.
function undate() {
  state.dated = false;
  sunDistance = undefined;
}

$('day').addEventListener('input', (e) => showMoment(Number(e.target.value)));
$('month').addEventListener('click', (e) => {
  const svg = $('month').querySelector('svg');
  if (!svg || !chart) return;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  showMoment(chart.scales.jdeAt(p.x) - state.start);
});
$('month-prev').addEventListener('click', () => setMonth(monthIndex() - 1));
$('month-next').addEventListener('click', () => setMonth(monthIndex() + 1));
$('month-start').addEventListener('change', (e) => {
  const [y, m] = e.target.value.split('-').map(Number);
  if (y && m) setMonth(y * 12 + (m - 1));
});

{
  const now = new Date();
  state.start = utcToJde(julianDay(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  state.day = Math.floor((utcToJde(Date.now() / 86400000 + 2440587.5) - state.start) * 8) / 8;
}
render();
