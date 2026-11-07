// The Thresholds tab: three curves measured on the spot, a point at a time.

import { drawChart, token } from './chart.js';
import {
  GAPS, STRONGEST_SECOND_PULSE, WIDTHS, pulseThreshold, recoveryCurve, rheobaseAndChronaxie, strengthDuration,
} from './excitability.js';
import { membrane } from './simulate.js';
import { currentSweep } from './sweep.js';

const $ = (id) => document.getElementById(id);
const P = membrane();
const FRAME_BUDGET_MS = 12;

const CURRENTS = Array.from({ length: 81 }, (_, i) => i * 0.25);
const TOTAL = WIDTHS.length + GAPS.length + CURRENTS.length * 2;

export function sweepEdges(points) {
  const up = points.filter((p) => p.direction === 'up');
  const down = points.filter((p) => p.direction === 'down');
  const start = up.find((p) => p.rate > 0);
  const firing = down.filter((p) => p.rate > 0);
  return { start, stop: firing[firing.length - 1] };
}

export function recoverySummary(points, resting) {
  const blocked = points.filter((p) => p.threshold === null);
  const finite = points.filter((p) => p.threshold !== null);
  const lowest = finite.reduce((a, b) => (b.threshold < a.threshold ? b : a), finite[0]);
  return { lastBlocked: blocked.length ? blocked[blocked.length - 1].gap : null, lowest, resting };
}

export function mountThresholds() {
  const sd = [];
  const rc = [];
  const fi = [];
  const resting = pulseThreshold(P, 1);
  let started = false;
  let done = 0;

  function* everything() {
    for (const point of strengthDuration(P)) {
      sd.push(point);
      yield;
    }
    for (const point of recoveryCurve(P)) {
      rc.push(point);
      yield;
    }
    for (const point of currentSweep(P, CURRENTS)) {
      fi.push(point);
      yield;
    }
  }

  function drawStrength() {
    drawChart($('sd-chart'), {
      x: [0.05, 100],
      y: [1, 200],
      logX: true,
      logY: true,
      xTicks: [0.1, 1, 10, 100],
      yTicks: [1, 10, 100],
      xLabel: 'pulse width, ms',
      yLabel: 'threshold, µA/cm²',
      series: [{
        x: sd.map((p) => p.width),
        y: sd.map((p) => p.threshold),
        color: token('accent'),
        width: 2,
      }],
      markers: sd.map((p) => ({ x: p.width, y: p.threshold, color: token('accent'), radius: 2.5 })),
    });
    if (sd.length === WIDTHS.length) {
      const { rheobase, chronaxie } = rheobaseAndChronaxie(sd);
      const short = sd.find((p) => p.width === 0.1);
      $('sd-note').textContent = `Below ${rheobase.toFixed(2)} µA/cm² (the rheobase) nothing fires, however long it lasts. Twice that needs ${chronaxie.toFixed(2)} ms (the chronaxie). For very short pulses, strength times width stays near ${(short.width * short.threshold).toFixed(1)} nC/cm²: the membrane is simply adding up charge, and any pulse delivering that much is enough.`;
    }
  }

  function drawRecovery() {
    const finite = rc.filter((p) => p.threshold !== null);
    drawChart($('rc-chart'), {
      x: [0, 40],
      y: [1, 300],
      logY: true,
      yTicks: [1, 10, 100],
      xLabel: 'delay after the first pulse, ms',
      yLabel: 'second pulse, µA/cm²',
      series: [
        {
          x: [0, 40],
          y: [resting, resting],
          color: token('muted'),
          width: 1.2,
          dash: [4, 4],
        },
        { x: finite.map((p) => p.gap), y: finite.map((p) => p.threshold), color: token('accent'), width: 2 },
      ],
      markers: finite.map((p) => ({ x: p.gap, y: p.threshold, color: token('accent'), radius: 2.5 })),
    });
    if (rc.length === GAPS.length) {
      const s = recoverySummary(rc, resting);
      $('rc-note').textContent = `The dashed line is what a pulse needs at rest, ${resting.toFixed(1)} µA/cm². After a spike, even ${STRONGEST_SECOND_PULSE} µA/cm² fails at a delay of ${s.lastBlocked} ms (the absolute refractory period). Then the requirement falls steeply as sodium channels unplug and potassium channels close (the relative refractory period), and a spike forced that early is smaller than usual. Around ${s.lowest.gap} ms it dips below normal, to ${s.lowest.threshold.toFixed(1)}, before settling back.`;
    }
  }

  function drawSweep() {
    const up = fi.filter((p) => p.direction === 'up');
    const down = fi.filter((p) => p.direction === 'down');
    drawChart($('fi-chart'), {
      x: [0, 20],
      y: [0, 100],
      yTickCount: 5,
      xLabel: 'steady current, µA/cm²',
      yLabel: 'spikes per second',
      series: [
        { x: up.map((p) => p.current), y: up.map((p) => p.rate), color: token('sodium'), width: 2 },
        { x: down.map((p) => p.current), y: down.map((p) => p.rate), color: token('potassium'), width: 2 },
      ],
    });
    if (fi.length === CURRENTS.length * 2) {
      const { start, stop } = sweepEdges(fi);
      $('fi-note').textContent = `Raised slowly, the current finds a silent membrane until ${start.current} µA/cm², where it jumps straight to ${Math.round(start.rate)} spikes a second. Lowered slowly, the firing goes on until ${stop.current}. Between the two the same current gives silence or firing, depending on how it got there. A sudden step inside that band fires too: try a strength of 8 on the Membrane page, with a long pulse.`;
    }
  }

  function redraw() {
    drawStrength();
    drawRecovery();
    drawSweep();
    $('measure-status').textContent = done < TOTAL ? `Measuring: ${done} of ${TOTAL} points.` : '';
  }

  function shown() {
    if (started) return;
    started = true;
    const work = everything();
    const pump = () => {
      const panelHidden = $('tab-thresholds').hidden;
      if (!panelHidden) {
        const until = performance.now() + FRAME_BUDGET_MS;
        while (performance.now() < until) {
          if (work.next().done) {
            redraw();
            return;
          }
          done++;
        }
        redraw();
      }
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  }

  window.addEventListener('resize', () => {
    if (!$('tab-thresholds').hidden) redraw();
  });

  return { redraw, shown };
}
