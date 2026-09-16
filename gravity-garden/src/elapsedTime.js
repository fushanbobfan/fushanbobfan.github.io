// Pure formatting for the simulation's elapsed time readout. The caller accumulates simulated
// seconds (the sum of physics timesteps actually applied, so pausing or scrubbing speed stays
// faithful to the simulation rather than the wall clock) and this just renders that duration.
// Kept DOM-free like the other readout modules (scaleBar.js, massLabels.js) so it can be tested
// without a canvas.

/**
 * Formats a duration in simulated seconds as `h:mm:ss` once it reaches an hour, or `m:ss`
 * below that — the common stopwatch convention of not padding a leading unit that isn't
 * shown. Rounds down to the nearest whole second so the readout doesn't flicker digits every
 * frame, and treats a negative or non-finite input as zero rather than throwing.
 */
export function formatElapsedTime(seconds) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const ss = String(secs).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  }
  return `${minutes}:${ss}`;
}
