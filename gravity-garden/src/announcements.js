// Pure message formatting for screen-reader announcements of simulation events that
// change the body count without any direct user action to explain them — a collision
// merging two bodies into one, or removing the selected body. Kept DOM-free, like the
// rest of the simulation logic, so the wording can be tested without an aria-live region.

/**
 * @param {number} beforeCount body count before this tick's collision pass
 * @param {number} afterCount body count after it
 * @returns {string|null} an announcement, or null if nothing merged this tick
 */
export function describeMerge(beforeCount, afterCount) {
  if (afterCount >= beforeCount) return null;
  return `Bodies collided and merged: ${beforeCount} became ${afterCount}.`;
}

/**
 * @param {number} remainingCount body count after the removal
 */
export function describeRemoval(remainingCount) {
  return `Removed the selected body. ${remainingCount} ${remainingCount === 1 ? "body remains" : "bodies remain"}.`;
}
