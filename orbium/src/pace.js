// Frame pacing: run up to `want` steps, but stop once the frame's time budget
// is spent, so on a large grid the simulation slows while the page stays
// responsive.
// At least one step always runs.

export const FRAME_BUDGET_MS = 24;

export function runSteps(want, step, now, budget = FRAME_BUDGET_MS) {
  const t0 = now();
  let done = 0;
  while (done < want) {
    step();
    done++;
    if (now() - t0 >= budget) break;
  }
  return { done, ms: now() - t0 };
}

// Smoothed milliseconds per step, weighting the newest frame by `alpha`.
export function smoothStepTime(prev, frame, alpha = 0.1) {
  if (frame.done === 0) return prev;
  const ms = frame.ms / frame.done;
  return prev > 0 ? prev + alpha * (ms - prev) : ms;
}
