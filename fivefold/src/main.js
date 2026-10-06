import { PHI, SEEDS, SYSTEMS, assemble, edgeLength, grow, seedsFor } from './tiling.js';
import { cull, fitView, nearView } from './view.js';
import { COLOURINGS, PALETTES } from './palettes.js';
import { drawOutlines, drawTiling, outlineWidth, svgDocument } from './render.js';
import { halfCounts, patchRatio, summarise } from './stats.js';
import { MAX_GENERATIONS, MAX_OVERLAY, decode, encode, normalise } from './share.js';

const $ = (id) => document.getElementById(id);
const canvas = $('plane');
const ctx = canvas.getContext('2d');

let state = decode(location.hash);
let frame = 0;

const NAMES = { kite: 'Kites', dart: 'Darts', thick: 'Thick rhombi', thin: 'Thin rhombi' };
const number = new Intl.NumberFormat('en');

function systemOf(seedId) {
  return SEEDS[seedId].system;
}

function fillSelect(select, entries, value) {
  select.replaceChildren(
    ...entries.map(([v, label]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      return o;
    }),
  );
  select.value = value;
}

function syncControls() {
  const system = systemOf(state.seed);
  for (const r of document.querySelectorAll('input[name="system"]')) r.checked = r.value === system;
  fillSelect(
    $('seed'),
    seedsFor(system).map((s) => [s.id, s.name]),
    state.seed,
  );
  $('seed-note').textContent = `Starts from ${SEEDS[state.seed].note}.`;
  $('generations').max = String(MAX_GENERATIONS);
  $('generations').value = String(state.generations);
  $('generations-out').textContent = String(state.generations);
  for (const r of document.querySelectorAll('input[name="fit"]')) r.checked = r.value === state.fit;
  $('zoom').value = String(state.zoom);
  $('zoom-out').textContent = `${state.zoom}×`;
  fillSelect($('colouring'), Object.entries(COLOURINGS), state.colouring);
  fillSelect(
    $('palette'),
    Object.entries(PALETTES).map(([id, p]) => [id, p.name]),
    state.palette,
  );
  $('weight').value = String(state.weight);
  $('weight-out').textContent = state.weight === 0 ? 'none' : `${state.weight}×`;
  $('overlay').max = String(MAX_OVERLAY);
  $('overlay').value = String(state.overlay);
  $('overlay-out').textContent = overlayLabel();
  $('coarser').disabled = state.generations <= 0;
  $('finer').disabled = state.generations >= MAX_GENERATIONS;
}

// Grow the tiling for a canvas of the given size, keeping only what shows.
function build(width, height) {
  const seedTris = SEEDS[state.seed].build();
  const view = fitView(seedTris, width, height, { fit: state.fit, zoom: state.zoom });
  const margin = 2 * edgeLength(state.generations);
  const tris = grow(state.seed, state.generations, nearView(view, margin));
  const patch = assemble(tris, systemOf(state.seed));
  const shown = {
    tiles: cull(patch.tiles, view),
    halves: cull(patch.halves, view, (h) => [h.a, h.b, h.c]),
  };
  const turn = shown.tiles.length ? shown.tiles[0].axis % 36 : 0;
  return { view, shown, turn, outlines: outlines(view) };
}

function overlayGeneration() {
  return state.overlay > 0 ? Math.max(0, state.generations - state.overlay) : null;
}

function overlayLabel() {
  const g = overlayGeneration();
  if (g === null) return 'off';
  return `${state.overlay} back (generation ${g})`;
}

// Whole tiles and halves of the coarser generation, as polygons.
function outlines(view) {
  const g = overlayGeneration();
  if (g === null || g === state.generations) return null;
  const tris = grow(state.seed, g, nearView(view, 2 * edgeLength(g)));
  const patch = assemble(tris, systemOf(state.seed));
  const polygons = [
    ...cull(patch.tiles, view).map((t) => t.points),
    ...cull(patch.halves, view, (h) => [h.a, h.b, h.c]).map((h) => [h.a, h.b, h.c]),
  ];
  return { polygons, width: outlineWidth(view, edgeLength(g)) };
}

function drawOptions(turn) {
  return {
    palette: PALETTES[state.palette],
    colouring: state.colouring,
    edge: edgeLength(state.generations),
    weight: state.weight,
    turn,
  };
}

function render() {
  frame = 0;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const { view, shown, turn, outlines: over } = build(width, height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTiling(ctx, shown, view, drawOptions(turn));
  if (over) drawOutlines(ctx, over.polygons, view, PALETTES[state.palette].overlay, over.width);
  report(shown);
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(render);
}

function report(shown) {
  const system = systemOf(state.seed);
  const s = summarise(shown, system);
  const total = s.whole[s.major] + s.whole[s.minor];
  const ratio = s.ratio === null ? '—' : s.ratio.toFixed(4);
  $('status').textContent = `Generation ${state.generations} · ${number.format(total)} tiles in view · ${NAMES[s.major].toLowerCase()} : ${NAMES[s.minor].toLowerCase()} = ${ratio}`;
  canvas.setAttribute(
    'aria-label',
    `${SYSTEMS[system].name} Penrose tiling, ${SEEDS[state.seed].name.toLowerCase()} seed, generation ${state.generations}, ${total} tiles in view`,
  );

  const patch = halfCounts(state.seed, state.generations);
  const pr = patchRatio(state.seed, state.generations);
  const rows = [
    [`${NAMES[s.major]} in view`, number.format(s.whole[s.major])],
    [`${NAMES[s.minor]} in view`, number.format(s.whole[s.minor])],
    ['Ratio in view', ratio],
    [`${NAMES[s.major]} in the patch`, number.format(patch[s.major] / 2)],
    [`${NAMES[s.minor]} in the patch`, number.format(patch[s.minor] / 2)],
    ['Ratio in the patch', pr === null ? '—' : pr.toFixed(6)],
    ['Golden ratio φ', PHI.toFixed(6)],
  ];
  $('counts').replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}

function update(patch) {
  state = normalise({ ...state, ...patch });
  syncControls();
  schedule();
}

function switchSystem(system) {
  if (systemOf(state.seed) === system) return;
  const kind = SEEDS[state.seed].name;
  const match = seedsFor(system).find((s) => s.name === kind) || seedsFor(system)[0];
  update({ seed: match.id });
}

function cycleSeed() {
  const list = seedsFor(systemOf(state.seed));
  const i = list.findIndex((s) => s.id === state.seed);
  update({ seed: list[(i + 1) % list.length].id });
}

// Controls

for (const r of document.querySelectorAll('input[name="system"]')) {
  r.addEventListener('change', () => r.checked && switchSystem(r.value));
}
$('seed').addEventListener('change', (e) => update({ seed: e.target.value }));
$('generations').addEventListener('input', (e) => update({ generations: Number(e.target.value) }));
$('coarser').addEventListener('click', () => update({ generations: state.generations - 1 }));
$('finer').addEventListener('click', () => update({ generations: state.generations + 1 }));
for (const r of document.querySelectorAll('input[name="fit"]')) {
  r.addEventListener('change', () => r.checked && update({ fit: r.value }));
}
$('zoom').addEventListener('input', (e) => update({ zoom: Number(e.target.value) }));
$('colouring').addEventListener('change', (e) => update({ colouring: e.target.value }));
$('palette').addEventListener('change', (e) => update({ palette: e.target.value }));
$('weight').addEventListener('input', (e) => update({ weight: Number(e.target.value) }));
$('overlay').addEventListener('input', (e) => update({ overlay: Number(e.target.value) }));

canvas.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === '+' || key === '=') update({ generations: state.generations + 1 });
  else if (key === '-' || key === '_') update({ generations: state.generations - 1 });
  else if (key === 't') switchSystem(systemOf(state.seed) === 'p2' ? 'p3' : 'p2');
  else if (key === 's') cycleSeed();
  else if (key === 'o') update({ overlay: (state.overlay + 1) % (MAX_OVERLAY + 1) });
  else if (key === 'c') {
    const keys = Object.keys(COLOURINGS);
    update({ colouring: keys[(keys.indexOf(state.colouring) + 1) % keys.length] });
  } else return;
  e.preventDefault();
});

// Keeping

function link() {
  const hash = encode(state);
  return `${location.origin}${location.pathname}${hash ? `#${hash}` : ''}`;
}

function flash(button, text) {
  const old = button.textContent;
  button.textContent = text;
  setTimeout(() => (button.textContent = old), 1400);
}

$('copy-link').addEventListener('click', async (e) => {
  const url = link();
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    flash(e.currentTarget, 'Copied');
  } catch {
    flash(e.currentTarget, 'Link in address bar');
  }
});

function printSize() {
  const rect = canvas.getBoundingClientRect();
  const width = Number($('print-size').value);
  return [width, Math.round((width * rect.height) / rect.width)];
}

function fileName(ext) {
  return `fivefold-${state.seed}-g${state.generations}.${ext}`;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('save-png').addEventListener('click', () => {
  const [w, h] = printSize();
  const { view, shown, turn, outlines: over } = build(w, h);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  drawTiling(octx, shown, view, drawOptions(turn));
  if (over) drawOutlines(octx, over.polygons, view, PALETTES[state.palette].overlay, over.width);
  out.toBlob((blob) => blob && download(blob, fileName('png')), 'image/png');
});

$('save-svg').addEventListener('click', () => {
  const [w, h] = printSize();
  const { view, shown, turn, outlines: over } = build(w, h);
  const svg = svgDocument(shown, view, {
    ...drawOptions(turn),
    title: `Penrose tiling, ${SEEDS[state.seed].name.toLowerCase()} seed`,
    overlay: over,
  });
  download(new Blob([svg], { type: 'image/svg+xml' }), fileName('svg'));
});

window.addEventListener('hashchange', () => {
  state = decode(location.hash);
  syncControls();
  schedule();
});

new ResizeObserver(schedule).observe(canvas);

syncControls();
schedule();
