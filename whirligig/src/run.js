// One run of the top from its release: advances simulated time exactly,
// whatever the frame rate, and stops when the rim meets the table.

import { bodyState, bodyStep, bodyStepSize, bodyTilt } from './top.js';

// `touches` is the prediction from the turning points. When the outer turning
// point sits right at the floor the sampled tilt may only graze it, so a run
// predicted to touch stops within a millionth of a radian of the floor.
export function createRun(release, top, floor, touches) {
  const run = {
    state: bodyState(release, top),
    fell: false,
    pending: 0,
    h: 0,
  };
  run.h = bodyStepSize(run.state, top);
  const limit = floor - (touches ? 1e-6 : 0);

  // Advance by `seconds` of simulated time; leftover time shorter than one
  // step carries over to the next call. `onSample` sees about `samples` states.
  run.advance = (seconds, onSample, samples = 24, maxSteps = 20000) => {
    if (run.fell) return;
    run.pending += seconds;
    const n = Math.min(Math.floor(run.pending / run.h), maxSteps);
    run.pending -= n * run.h;
    if (n === maxSteps) run.pending = 0;
    const every = Math.max(1, Math.floor(n / samples));
    for (let i = 1; i <= n; i++) {
      run.state = bodyStep(run.state, run.h, top);
      if (bodyTilt(run.state) >= limit) {
        run.fell = true;
        if (onSample) onSample(run.state);
        return;
      }
      if (onSample && i % every === 0) onSample(run.state);
    }
  };
  return run;
}
