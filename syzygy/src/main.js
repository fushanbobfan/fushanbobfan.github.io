import { buildYear, snapshot } from './year.js';
import { renderChart, jdeAt, scales, W } from './chart.js';
import { renderOrbit, seasonLongitudes } from './orbit.js';
import { eclipseRows, yearSummary, momentText } from './story.js';
import { sunPosition } from './ephemeris.js';
import { MOON_INCLINATION } from './eclipses.js';

const $ = (id) => document.getElementById(id);
const els = {
  year: $('year'), prev: $('prev-year'), next: $('next-year'),
  tilt: $('tilt'), tiltValue: $('tilt-value'), realTilt: $('real-tilt'),
  day: $('day'), play: $('play'),
  chart: $('chart'), orbit: $('orbit'), summary: $('summary'),
  date: $('moment-date'), moment: $('moment-text'), live: $('live'),
  rows: $('eclipse-rows'), whatIf: $('what-if'),
};

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const state = { year: new Date().getUTCFullYear(), tilt: MOON_INCLINATION, day: 0, playing: false };
let data = null;
let last = 0;

function isRealTilt() {
  return Math.abs(state.tilt - MOON_INCLINATION) < 1e-6;
}

function cursorJde() {
  return data.start + state.day;
}

function seasonArcs() {
  if (data.halfWidth >= 90) return [[0, 359.9]];
  return seasonLongitudes(data.seasons, (t) => sunPosition(t).lon);
}

function drawMoment(announce) {
  const jde = cursorJde();
  const snap = snapshot(jde, state.tilt);
  els.orbit.innerHTML = renderOrbit(snap, seasonArcs(), data.halfWidth);
  const cursor = els.chart.querySelector('#cursor');
  if (cursor) {
    const x = scales(data).x(jde).toFixed(1);
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
  }
  const text = momentText(snap, data);
  els.date.textContent = text.date;
  els.moment.textContent = text.line;
  if (announce) els.live.textContent = `${text.date}. ${text.line}`;
}

function drawYear() {
  data = buildYear(state.year, state.tilt);
  const days = Math.round(data.end - data.start);
  els.day.max = String(days - 0.25);
  state.day = Math.min(state.day, days - 0.25);
  els.day.value = String(state.day);
  els.chart.innerHTML = renderChart(data, cursorJde());
  els.summary.textContent = yearSummary(data, isRealTilt());
  els.rows.innerHTML = eclipseRows(data).map((r) => `<tr>`
    + `<td><button type="button" class="jump" data-jde="${r.jde}">${r.when}</button></td>`
    + `<td>${r.kind}</td><td>${r.what}</td><td>${r.miss}</td></tr>`).join('')
    || '<tr><td colspan="4">No eclipses this year.</td></tr>';
  els.whatIf.hidden = isRealTilt();
  drawMoment(false);
}

function setYear(y) {
  const v = Math.round(Number(y));
  if (!Number.isFinite(v)) return;
  state.year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, v));
  els.year.value = String(state.year);
  drawYear();
}

function setTilt(t) {
  state.tilt = Number(t);
  els.tilt.value = String(state.tilt);
  els.tiltValue.textContent = `${state.tilt.toFixed(1)}°${isRealTilt() ? ' (the real tilt)' : ''}`;
  drawYear();
}

function setDay(d, announce = true) {
  state.day = Math.min(Number(els.day.max), Math.max(0, Number(d)));
  els.day.value = String(state.day);
  drawMoment(announce);
}

function stop() {
  state.playing = false;
  els.play.textContent = 'Play';
  els.play.setAttribute('aria-pressed', 'false');
}

function tick(now) {
  if (!state.playing) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const next = state.day + dt * 20; // twenty days a second
  if (next >= Number(els.day.max)) {
    setDay(Number(els.day.max), true);
    stop();
    return;
  }
  setDay(next, false);
  requestAnimationFrame(tick);
}

els.play.addEventListener('click', () => {
  if (state.playing) { stop(); drawMoment(true); return; }
  if (state.day >= Number(els.day.max)) setDay(0, false);
  state.playing = true;
  els.play.textContent = 'Pause';
  els.play.setAttribute('aria-pressed', 'true');
  last = performance.now();
  requestAnimationFrame(tick);
});

els.day.addEventListener('input', () => { stop(); setDay(els.day.value); });
els.year.addEventListener('change', () => setYear(els.year.value));
els.prev.addEventListener('click', () => setYear(state.year - 1));
els.next.addEventListener('click', () => setYear(state.year + 1));
els.tilt.addEventListener('input', () => setTilt(els.tilt.value));
els.realTilt.addEventListener('click', () => setTilt(MOON_INCLINATION));

els.chart.addEventListener('click', (ev) => {
  const svg = els.chart.querySelector('svg');
  if (!svg) return;
  const box = svg.getBoundingClientRect();
  const x = ((ev.clientX - box.left) / box.width) * W;
  stop();
  setDay(jdeAt(data, x) - data.start);
});

els.rows.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button.jump');
  if (!btn) return;
  stop();
  setDay(Number(btn.dataset.jde) - data.start);
  els.orbit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

const now = new Date();
state.day = Math.floor((now - Date.UTC(state.year, 0, 1)) / 86400000);
els.year.min = String(MIN_YEAR);
els.year.max = String(MAX_YEAR);
els.year.value = String(state.year);
setTilt(MOON_INCLINATION);
