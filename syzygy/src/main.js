import { buildYear, snapshot } from './year.js';
import { renderChart, jdeAt, scales, W } from './chart.js';
import { renderOrbit, seasonLongitudes } from './orbit.js';
import { eclipseRows, yearSummary, momentText } from './story.js';
import { sunPosition } from './ephemeris.js';
import { MOON_INCLINATION } from './eclipses.js';
import { renderCloseup, closeupText } from './closeup.js';
import { eclipseLabel } from './story.js';
import {
  windowYears, decadeRows, renderDecades, sarosText, findEclipse, eclipseId,
} from './decades.js';

const $ = (id) => document.getElementById(id);
const els = {
  year: $('year'), prev: $('prev-year'), next: $('next-year'),
  tilt: $('tilt'), tiltValue: $('tilt-value'), realTilt: $('real-tilt'),
  day: $('day'), play: $('play'),
  chart: $('chart'), orbit: $('orbit'), summary: $('summary'),
  date: $('moment-date'), moment: $('moment-text'), live: $('live'),
  rows: $('eclipse-rows'), whatIf: $('what-if'),
  closeup: $('closeup'), closeupTitle: $('closeup-title'), closeupText: $('closeup-text'),
  decades: $('decades'), saros: $('saros-text'), sarosGo: $('saros-go'),
};

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const state = { year: new Date().getUTCFullYear(), tilt: MOON_INCLINATION, day: 0, playing: false };
let data = null;
let last = 0;
const yearCache = new Map();
let selectedId = null;
let closeupId = null;
let rows = [];

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
  const days = data.end - data.start;
  els.day.max = String(days);
  state.day = Math.min(state.day, days);
  els.day.value = String(state.day);
  els.chart.innerHTML = renderChart(data, cursorJde());
  els.summary.textContent = yearSummary(data, isRealTilt());
  els.rows.innerHTML = eclipseRows(data).map((r, i) => `<tr>`
    + `<td><button type="button" class="jump" data-index="${i}" data-jde="${r.jde}">${r.when}</button></td>`
    + `<td>${r.kind}</td><td>${r.what}</td><td>${r.miss}</td></tr>`).join('')
    || '<tr><td colspan="4">No eclipses this year.</td></tr>';
  els.whatIf.hidden = isRealTilt();
  const kept = data.eclipses.findIndex((e) => eclipseId(e) === closeupId);
  const next = data.eclipses.findIndex((e) => e.greatest >= cursorJde());
  drawCloseup(kept >= 0 ? kept : Math.max(0, next));
  drawMoment(false);
  drawDecades();
}

function drawCloseup(index) {
  const e = data.eclipses[index];
  els.closeup.parentElement.hidden = !e;
  if (!e) return;
  closeupId = eclipseId(e);
  els.closeup.innerHTML = renderCloseup(e, state.tilt / MOON_INCLINATION);
  els.closeupTitle.textContent = `${eclipseLabel(e)} eclipse, ${els.rows.querySelector(`[data-index="${index}"]`).textContent}`;
  els.closeupText.textContent = closeupText(e);
  els.rows.querySelectorAll('button.jump').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.index) === index)));
}

// The many-years grid around the current year, and the selected eclipse's saros.
function drawDecades() {
  rows = decadeRows(windowYears(state.year, MIN_YEAR, MAX_YEAR), state.tilt, yearCache);
  if (!selectedId || !findEclipse(rows, selectedId)) {
    const first = data.eclipses.find((e) => e.greatest >= cursorJde()) || data.eclipses[0];
    selectedId = first ? eclipseId(first) : null;
  }
  els.decades.innerHTML = renderDecades(rows, { currentYear: state.year, selectedId });
  const target = selectedId ? findEclipse(rows, selectedId) : null;
  els.saros.textContent = sarosText(target, rows);
  els.sarosGo.hidden = !target;
  if (target) els.sarosGo.dataset.jde = String(target.greatest);
}

function selectEclipse(id) {
  selectedId = id;
  els.decades.innerHTML = renderDecades(rows, { currentYear: state.year, selectedId });
  els.saros.textContent = sarosText(findEclipse(rows, id), rows);
  els.sarosGo.dataset.jde = String(findEclipse(rows, id).greatest);
  els.decades.querySelector(`[data-id="${id}"]`)?.focus();
}

function setYear(y) {
  const v = Math.round(Number(y));
  if (!Number.isFinite(v)) return;
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, v));
  els.year.value = String(year);
  // A late change event (on blur) must not rebuild the table under a click.
  if (year === state.year && data) return;
  state.year = year;
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

els.decades.addEventListener('click', (ev) => {
  const mark = ev.target.closest('.mark');
  if (mark) selectEclipse(mark.dataset.id);
});

els.decades.addEventListener('keydown', (ev) => {
  const mark = ev.target.closest('.mark');
  if (!mark || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault();
  selectEclipse(mark.dataset.id);
});

els.sarosGo.addEventListener('click', () => {
  const jde = Number(els.sarosGo.dataset.jde);
  const target = findEclipse(rows, selectedId);
  const row = rows.find((r) => jde >= r.start && jde < r.end);
  stop();
  setYear(row.year);
  setDay(jde - data.start);
  if (target) els.orbit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

els.rows.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button.jump');
  if (!btn) return;
  stop();
  setDay(Number(btn.dataset.jde) - data.start);
  drawCloseup(Number(btn.dataset.index));
});

const now = new Date();
state.day = Math.floor((now - Date.UTC(state.year, 0, 1)) / 86400000);
els.year.min = String(MIN_YEAR);
els.year.max = String(MAX_YEAR);
els.year.value = String(state.year);
setTilt(MOON_INCLINATION);
