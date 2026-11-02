// Durations and angles as the readouts show them.

export function duration(seconds) {
  if (!Number.isFinite(seconds)) return 'never';
  const s = Math.max(0, seconds);
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60), r = Math.round(s - 60 * m);
    return r === 60 ? `${m + 1} min` : r ? `${m} min ${r} s` : `${m} min`;
  }
  if (s < 48 * 3600) {
    const h = Math.floor(s / 3600), m = Math.round((s - 3600 * h) / 60);
    return m === 60 ? `${h + 1} h` : m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${(s / 86400).toFixed(1)} days`;
}

export function hours(seconds) {
  if (!Number.isFinite(seconds)) return 'never';
  return `${(seconds / 3600).toFixed(seconds < 36000 ? 2 : 1)} h`;
}

export function latitude(deg) {
  if (Math.abs(deg) < 0.05) return '0°';
  return `${Math.abs(deg).toFixed(1)}° ${deg > 0 ? 'N' : 'S'}`;
}
