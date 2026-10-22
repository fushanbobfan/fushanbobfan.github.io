import { fieldFromRgba, colourFromRgba, adjustField, fieldMean, fitSize } from './density.js';
import { SOURCE_IDS, sourceInfo, paintSource } from './sources.js';
import { dotColours, colourGroups } from './colour.js';
import { seedPoints, relax } from './lloyd.js';
import { dotRadii, evenRadiusFor } from './dots.js';
import { nearestNeighbourTour, neighbourLists, twoOpt, tourLength } from './tour.js';
import { dotsSvg, tourSvg } from './svg.js';
import { pictureRgba, cellsRgba } from './render.js';
import { decodeSettings, encodeSettings, clampSetting, PALETTES } from './settings.js';
import { createRng, randomSeed } from './rng.js';
import { PAPERS, mmPerPixel, cumulativeLengths, penAt, plotSeconds, formatDuration } from './plot.js';

const $ = (id) => document.getElementById(id);
const canvas = $('page');
const ctx = canvas.getContext('2d');
const chart = $('settle');
const chartCtx = chart.getContext('2d');
const statusEl = $('status');

// Rounds stop on their own once the mean move falls below this share of the
// typical dot spacing, or after MAX_ROUNDS.
const SETTLED = 0.0004;
const MIN_ROUNDS = 10;
const MAX_ROUNDS = 300;
const FRAME_BUDGET = 14;
// A plot is replayed as a time-lapse of this many seconds, whatever its length.
const PLAYBACK = 12;

const s = decodeSettings(location.hash.slice(1));
let upload = null; // an <img> the viewer chose; never leaves the page
let base = null; // picture before tone controls
let colour = null; // the picture's own colours, or null for grey pictures
let field = null;
let points = new Float64Array(0);
let count = 0;
let scratch = {};
let stats = null;
let radii = new Float64Array(0);
let rounds = 0;
let trace = [];
let running = true;
let settled = false;
let line = null; // { tour, neighbours, done, moves }
let dirty = true;
let play = null; // { start, cum } while a plot is being replayed
let notice = '';
let noticeTimer = 0;
const layer = document.createElement('canvas');
const layerCtx = layer.getContext('2d');

// ---------- picture and dots ----------

function pictureSize() {
  // Small uploads are scaled up too, so the dot spacing does not fall to a pixel.
  if (upload) {
    const k = s.detail / Math.max(upload.naturalWidth, upload.naturalHeight);
    return fitSize(upload.naturalWidth * k, upload.naturalHeight * k, s.detail);
  }
  return { width: s.detail, height: Math.round(s.detail * 0.75) };
}

function loadPicture() {
  const { width, height } = pictureSize();
  if (upload) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const cx = c.getContext('2d');
    cx.drawImage(upload, 0, 0, width, height);
    const rgba = cx.getImageData(0, 0, width, height).data;
    base = fieldFromRgba(rgba, width, height);
    colour = colourFromRgba(rgba, width, height);
  } else {
    ({ field: base, colour } = paintSource(s.picture, width, height));
  }
  applyTone();
}

function applyTone() {
  field = adjustField(base, s);
  layer.width = field.width;
  layer.height = field.height;
  resizeCanvas();
  wake();
}

function reseed() {
  count = s.dots;
  points = seedPoints(field, count, createRng(s.seed));
  scratch = {};
  stats = null;
  rounds = 0;
  trace = [];
  wake();
}

// Something changed the picture or the dots: start relaxing again.
function wake() {
  settled = false;
  line = null;
  stopPlay();
  dirty = true;
}

function step() {
  const r = relax(field, points, count, scratch);
  stats = r.stats;
  rounds++;
  trace.push(r.meanMove);
  if (trace.length > 160) trace.shift();
  if ((r.meanMove < settleBelow() && rounds >= MIN_ROUNDS) || rounds >= MAX_ROUNDS) settled = true;
  line = null;
  dirty = true;
}

// Mean spacing the dots would have if spread over the inked part of the page.
function spacing() {
  return Math.sqrt((field.width * field.height * Math.max(0.01, fieldMean(field))) / Math.max(1, count));
}

function settleBelow() {
  return SETTLED * spacing();
}

function stopPlay() {
  if (!play) return;
  play = null;
  dirty = true;
}

// Plots follow the tour: the line is drawn pen-down, dots are tapped in order.
function plotMode() {
  return s.view === 'line' ? 'line' : 'dots';
}

function plotEstimate() {
  if (!line) return null;
  const mm = mmPerPixel(field.width, field.height, s.paper);
  const length = tourLength(points, line.tour);
  const seconds = plotSeconds({ mode: plotMode(), length, dots: count, mmPerPx: mm, drawSpeed: s.speed, travelSpeed: 3 * s.speed });
  return {
    size: `${Math.round(field.width * mm)} × ${Math.round(field.height * mm)} mm`,
    metres: (length * mm) / 1000,
    seconds,
  };
}

function sizeDots() {
  if (!stats) {
    // Before the first round the cells are unknown; use even dots for a frame.
    radii = new Float64Array(count).fill(evenRadiusFor(fieldMean(field), count, field.width, field.height) * s.size);
    return;
  }
  const even = evenRadiusFor(fieldMean(field), count, field.width, field.height);
  radii = dotRadii(stats, count, { mode: s.mode, radius: even * s.size, scale: s.size, min: 0.15 }, radii);
}

// ---------- the line ----------

function growLine(deadline) {
  if (!line) {
    const tour = nearestNeighbourTour(points, count);
    line = { tour, neighbours: neighbourLists(points, count, 8), done: false, moves: 0 };
    dirty = true;
    return;
  }
  if (line.done) return;
  const r = twoOpt(points, line.tour, line.neighbours, deadline);
  line.moves += r.moves;
  line.done = r.done;
  dirty = true;
}

// ---------- drawing ----------

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.parentElement.clientWidth || field.width;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round((cssWidth * ratio * field.height) / field.width);
  dirty = true;
}

function palette() {
  return PALETTES[s.palette];
}

function drawLayer(rgba) {
  layerCtx.putImageData(new ImageData(rgba, field.width, field.height), 0, 0);
  ctx.imageSmoothingEnabled = s.view === 'picture';
  ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
}

// Per-dot RGB when the palette takes the picture's colours and it has some.
function currentColours() {
  if (!palette().fromPicture || !colour || !scratch.labels) return null;
  return dotColours(scratch.labels, field, colour, points, count);
}

function drawDots(k) {
  const rgb = currentColours();
  const groups = rgb ? colourGroups(rgb, count) : [{ colour: palette().ink, dots: null }];
  for (const g of groups) {
    ctx.fillStyle = g.colour;
    ctx.beginPath();
    const n = g.dots ? g.dots.length : count;
    for (let j = 0; j < n; j++) {
      const i = g.dots ? g.dots[j] : j;
      const r = radii[i] * k;
      if (r <= 0) continue;
      const x = points[2 * i] * k;
      const y = points[2 * i + 1] * k;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

function draw() {
  const k = canvas.width / field.width;
  const { ink, paper } = palette();
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  sizeDots();
  if (play && play.start) {
    drawPlayback(k);
  } else if (s.view === 'picture') {
    drawLayer(pictureRgba(field, ink, paper));
  } else if (s.view === 'cells') {
    if (scratch.labels) drawLayer(cellsRgba(scratch.labels, field, ink, paper));
    ctx.fillStyle = ink;
    for (let i = 0; i < count; i++) ctx.fillRect(points[2 * i] * k - 1, points[2 * i + 1] * k - 1, 2, 2);
  } else if (s.view === 'line' && line) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.6, k * 0.35 * s.size);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const t = line.tour;
    for (let n = 0; n < t.length; n++) {
      const x = points[2 * t[n]] * k;
      const y = points[2 * t[n] + 1] * k;
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    drawDots(k);
  }
  drawChart();
  updateStatus();
  dirty = false;
}

// The plot so far: the line up to the pen, or the dots it has tapped, with
// the pen itself as a ring.
function drawPlayback(k) {
  const t = Math.min(1, (performance.now() - play.start) / (PLAYBACK * 1000));
  const tour = line.tour;
  const pen = penAt(points, tour, play.cum, t * play.cum[tour.length]);
  const { ink } = palette();
  if (plotMode() === 'line') {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.6, k * 0.35 * s.size);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let n = 0; n < pen.passed; n++) {
      const i = tour[n];
      if (n === 0) ctx.moveTo(points[2 * i] * k, points[2 * i + 1] * k);
      else ctx.lineTo(points[2 * i] * k, points[2 * i + 1] * k);
    }
    ctx.lineTo(pen.x * k, pen.y * k);
    ctx.stroke();
  } else {
    const rgb = currentColours();
    ctx.fillStyle = ink;
    for (let n = 0; n < pen.passed; n++) {
      const i = tour[n];
      const r = radii[i] * k;
      if (r <= 0) continue;
      if (rgb) ctx.fillStyle = `rgb(${rgb[3 * i]},${rgb[3 * i + 1]},${rgb[3 * i + 2]})`;
      ctx.beginPath();
      ctx.arc(points[2 * i] * k, points[2 * i + 1] * k, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pen.x * k, pen.y * k, 6, 0, Math.PI * 2);
  ctx.stroke();
  if (t >= 1) {
    play = null;
    dirty = true;
  }
}

function drawChart() {
  const w = chart.width;
  const h = chart.height;
  const style = getComputedStyle(document.body);
  chartCtx.clearRect(0, 0, w, h);
  if (trace.length < 2) return;
  // Log scale from 0.0001 px to 10 px of mean movement per round.
  const y = (v) => {
    const t = (Math.log10(Math.max(1e-4, Math.min(10, v))) + 4) / 5;
    return h - 4 - t * (h - 8);
  };
  chartCtx.strokeStyle = style.getPropertyValue('--border');
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  chartCtx.moveTo(0, y(settleBelow()));
  chartCtx.lineTo(w, y(settleBelow()));
  chartCtx.stroke();
  chartCtx.strokeStyle = style.getPropertyValue('--accent');
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();
  trace.forEach((v, i) => {
    const x = (i / (trace.length - 1)) * w;
    if (i === 0) chartCtx.moveTo(x, y(v));
    else chartCtx.lineTo(x, y(v));
  });
  chartCtx.stroke();
}

function updateStatus() {
  const parts = [`${count.toLocaleString()} dots`, `round ${rounds}`];
  if (trace.length) parts.push(`mean move ${trace[trace.length - 1].toFixed(4)} px`);
  parts.push(settled ? 'settled' : running ? 'relaxing' : 'paused');
  if (s.view === 'line') {
    if (!line) parts.push(settled || !running ? 'threading the line…' : 'the line waits for the dots to stop');
    else {
      const pages = tourLength(points, line.tour) / field.width;
      parts.push(`line ${pages.toFixed(1)} page widths${line.done ? '' : `, uncrossing (${line.moves.toLocaleString()} fixes)`}`);
    }
  }
  statusEl.textContent = notice || parts.join(' · ');
  updatePlotNote();
  $('run').textContent = running && !settled ? 'Pause' : settled ? 'Settled' : 'Run';
  $('run').disabled = settled;
}

function updatePlotNote() {
  const est = plotEstimate();
  const paper = PAPERS[s.paper].label;
  let text;
  if (play && !play.start) text = 'Threading the line to plot along…';
  else if (!est) text = `On ${paper}, the pen time appears once the line has been threaded.`;
  else if (plotMode() === 'line') {
    text = `On ${paper}: ${est.size}, ${est.metres.toFixed(1)} m of line, about ${formatDuration(est.seconds)} at ${s.speed} mm/s.`;
  } else {
    text = `On ${paper}: ${est.size}, ${count.toLocaleString()} taps, about ${formatDuration(est.seconds)} with ${est.metres.toFixed(1)} m of pen-up travel.`;
  }
  $('plot-note').textContent = text;
  $('play').textContent = play ? 'Stop' : 'Watch it plot';
}

// ---------- loop ----------

function frame() {
  const start = performance.now();
  const deadline = () => performance.now() - start > FRAME_BUDGET;
  if (play) {
    if (!line || !line.done) growLine(deadline);
    else {
      if (!play.start) play = { start, cum: cumulativeLengths(points, line.tour) };
      dirty = true;
    }
  } else if (running && !settled) {
    do step();
    while (!settled && !deadline());
  } else if (s.view === 'line' && (!line || !line.done)) {
    growLine(deadline);
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

// ---------- controls ----------

const SLIDERS = ['detail', 'brightness', 'contrast', 'gamma', 'floor', 'dots', 'size', 'speed'];

function show(id) {
  const input = $(id);
  const out = document.querySelector(`output[for="${id}"]`);
  const v = s[id];
  const digits = Number(input.step) >= 1 ? 0 : 2;
  out.textContent = (digits ? Number(v).toFixed(digits) : Number(v).toLocaleString()) + (input.dataset.unit || '');
}

function syncControls() {
  for (const id of SLIDERS) {
    $(id).value = s[id];
    show(id);
  }
  $('picture').value = upload ? 'upload' : s.picture;
  $('picture-note').textContent = upload ? 'Your image, kept in this page only.' : sourceInfo(s.picture).note;
  $('invert').checked = s.invert;
  $('mode').value = s.mode;
  $('palette').value = s.palette;
  $('paper').value = s.paper;
  for (const r of document.querySelectorAll('input[name="view"]')) r.checked = r.value === s.view;
}

function fillSelects() {
  for (const id of SOURCE_IDS) $('picture').append(new Option(sourceInfo(id).label, id));
  for (const [id, p] of Object.entries(PALETTES)) $('palette').append(new Option(p.label, id));
  for (const [id, p] of Object.entries(PAPERS)) $('paper').append(new Option(`${p.label} (${p.short} × ${p.long} mm)`, id));
}

function saveHash() {
  const q = encodeSettings(s);
  window.history.replaceState(null, '', q ? `#${q}` : location.pathname + location.search);
}

function bind() {
  for (const id of SLIDERS) {
    $(id).addEventListener('input', () => {
      s[id] = clampSetting(id, $(id).value);
      show(id);
      if (id === 'detail') {
        loadPicture();
        reseed();
      } else if (id === 'dots') reseed();
      else if (id === 'size' || id === 'speed') dirty = true;
      else applyTone();
      saveHash();
    });
  }
  $('invert').addEventListener('change', () => {
    s.invert = $('invert').checked;
    applyTone();
    saveHash();
  });
  $('picture').addEventListener('change', () => {
    const v = $('picture').value;
    if (v === 'upload') return;
    upload = null;
    $('picture').querySelector('option[value="upload"]')?.remove();
    s.picture = v;
    if (paintSource(v, 1, 1).colour) s.palette = 'picture';
    syncControls();
    loadPicture();
    reseed();
    saveHash();
  });
  $('mode').addEventListener('change', () => {
    s.mode = $('mode').value;
    dirty = true;
    saveHash();
  });
  $('palette').addEventListener('change', () => {
    s.palette = $('palette').value;
    dirty = true;
    saveHash();
  });
  for (const r of document.querySelectorAll('input[name="view"]')) {
    r.addEventListener('change', () => {
      s.view = r.value;
      dirty = true;
      saveHash();
    });
  }
  $('paper').addEventListener('change', () => {
    s.paper = $('paper').value;
    dirty = true;
    saveHash();
  });
  $('play').addEventListener('click', togglePlay);
  $('run').addEventListener('click', toggleRun);
  $('reseed').addEventListener('click', newSeed);
  $('upload').addEventListener('change', () => {
    const file = $('upload').files[0];
    if (file) useFile(file);
  });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) useFile(file);
  });
  $('svg').addEventListener('click', saveSvg);
  $('png').addEventListener('click', savePng);
  $('share').addEventListener('click', copyLink);
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'SELECT' || tag === 'BUTTON' || (tag === 'INPUT' && e.key === ' ')) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggleRun();
    } else if (e.key === 'r' || e.key === 'R') newSeed();
    else if (e.key === 'p' || e.key === 'P') togglePlay();
    else if (e.key === 'l' || e.key === 'L') {
      s.view = 'line';
      syncControls();
      dirty = true;
      saveHash();
    }
  });
}

// A short message that holds the status line for a few seconds.
function say(text) {
  notice = text;
  dirty = true;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice = '';
    dirty = true;
  }, 4000);
}

function togglePlay() {
  if (play) {
    stopPlay();
    return;
  }
  // Replaying freezes the dots; the line is threaded first if needed.
  running = false;
  play = { start: 0, cum: null };
  dirty = true;
}

function toggleRun() {
  stopPlay();
  if (settled) return;
  running = !running;
  dirty = true;
}

function newSeed() {
  s.seed = randomSeed();
  reseed();
  running = true;
  saveHash();
}

function useFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    upload = img;
    s.palette = 'picture';
    if (!$('picture').querySelector('option[value="upload"]')) $('picture').append(new Option('Your image', 'upload'));
    syncControls();
    loadPicture();
    reseed();
    running = true;
  };
  img.onerror = () => {
    say('That file could not be read as an image.');
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function baseName() {
  return `dotwork-${upload ? 'image' : s.picture}-${count}`;
}

function saveSvg() {
  const { ink, paper } = palette();
  const scale = 1000 / Math.max(field.width, field.height);
  sizeDots();
  const svg =
    s.view === 'line' && line
      ? tourSvg(points, line.tour, field.width, field.height, { scale, ink, paper, stroke: 0.35 * s.size * scale })
      : dotsSvg(points, radii, count, field.width, field.height, { scale, ink, paper, colours: currentColours() });
  download(`${baseName()}${s.view === 'line' && line ? '-line' : ''}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
}

function savePng() {
  canvas.toBlob((blob) => blob && download(`${baseName()}.png`, blob));
}

async function copyLink() {
  saveHash();
  const note = upload ? ' (your own image stays here; the link opens the built-in picture)' : '';
  try {
    await navigator.clipboard.writeText(location.href);
    say(`Link copied${note}.`);
  } catch {
    say(`Copy this address to share${note}: ${location.href}`);
  }
}

fillSelects();
syncControls();
bind();
loadPicture();
reseed();
requestAnimationFrame(frame);
