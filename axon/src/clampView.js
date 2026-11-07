// The Voltage clamp tab: step the voltage, read the current.

import { clampTrace, currentVoltage } from './clamp.js';
import { dataRange, drawChart, token } from './chart.js';
import { membrane } from './simulate.js';

const $ = (id) => document.getElementById(id);
const DURATION = 20;
const VOLTAGES = Array.from({ length: 91 }, (_, i) => -100 + i * 2);

function signed(volts) {
  return `${volts > 0 ? '+' : volts < 0 ? '−' : ''}${Math.abs(volts)} mV`;
}

// One sentence on what the step did, in the page's words.
export function describeClamp(trace, target) {
  const lowest = Math.min(...trace.total);
  const end = trace.total[trace.total.length - 1];
  const start = `Stepping to ${signed(target)}:`;
  if (end <= -1) return `${start} a steady ${Math.round(-end)} µA/cm² flows in, and no outward current appears.`;
  if (lowest < -10 && end > 5) {
    return `${start} up to ${Math.round(-lowest)} µA/cm² flows in, then the current turns and ${Math.round(end)} µA/cm² flows out.`;
  }
  if (lowest < -10) return `${start} up to ${Math.round(-lowest)} µA/cm² flows in, then the current fades away.`;
  if (end > 5) return `${start} no net inward current, and ${Math.round(end)} µA/cm² flows out by the end.`;
  return `${start} almost nothing happens.`;
}

export function mountClamp() {
  let target = 0;
  let hold = -65;
  let noNa = false;
  let noK = false;
  let curve = null;

  function params() {
    return membrane({ naOpen: noNa ? 0 : 1, kOpen: noK ? 0 : 1 });
  }

  function refreshCurve() {
    curve = currentVoltage(params(), hold, VOLTAGES);
  }

  function draw() {
    const p = params();
    const trace = clampTrace(p, hold, target, { duration: DURATION });
    $('clamp-step-out').textContent = signed(target);
    $('clamp-hold-out').textContent = signed(hold);
    $('clamp-verdict').textContent = describeClamp(trace, target);
    drawChart($('clamp-chart'), {
      x: [0, DURATION],
      y: dataRange([trace.total, trace.iNa, trace.iK], { minSpan: 40 }),
      yTickCount: 5,
      yLabel: 'µA/cm²',
      xLabel: 'ms after the step',
      level: 0,
      series: [
        { x: trace.t, y: trace.iNa, color: token('sodium') },
        { x: trace.t, y: trace.iK, color: token('potassium') },
        { x: trace.t, y: trace.total, color: token('ink'), width: 2.2 },
      ],
    });
    const volts = curve.map((c) => c.v);
    const early = curve.map((c) => c.early);
    const late = curve.map((c) => c.late);
    const i = Math.round((target + 100) / 2);
    drawChart($('iv-chart'), {
      x: [-100, 80],
      y: dataRange([early, late], { minSpan: 40 }),
      yTickCount: 5,
      yLabel: 'µA/cm²',
      xLabel: 'mV',
      level: 0,
      series: [
        { x: volts, y: early, color: token('sodium') },
        { x: volts, y: late, color: token('potassium') },
      ],
      markers: [
        { x: curve[i].v, y: curve[i].early, color: token('sodium'), radius: 4 },
        { x: curve[i].v, y: curve[i].late, color: token('potassium'), radius: 4 },
      ],
    });
  }

  $('clamp-step').addEventListener('input', (event) => {
    target = Number(event.target.value);
    draw();
  });
  $('clamp-hold').addEventListener('input', (event) => {
    hold = Number(event.target.value);
    refreshCurve();
    draw();
  });
  $('clamp-no-na').addEventListener('change', (event) => {
    noNa = event.target.checked;
    refreshCurve();
    draw();
  });
  $('clamp-no-k').addEventListener('change', (event) => {
    noK = event.target.checked;
    refreshCurve();
    draw();
  });
  window.addEventListener('resize', () => {
    if (!$('clamp-chart').closest('[hidden]')) draw();
  });

  refreshCurve();
  return { redraw: draw };
}
