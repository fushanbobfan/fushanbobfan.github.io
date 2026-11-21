// Words for what the numbers say.

import { formatDate, formatDateTime, jdeToUtc, calendarDate, monthName } from './time.js';
import { phaseName } from './year.js';

const TYPE = {
  total: 'Total', annular: 'Annular', hybrid: 'Hybrid', partial: 'Partial', penumbral: 'Penumbral',
};

export function eclipseLabel(e) {
  return `${TYPE[e.eclipse]} ${e.kind === 'new' ? 'solar' : 'lunar'}`;
}

const WHAT = {
  total: { new: 'the Moon covers the whole Sun along a narrow path', full: 'the whole Moon passes into the Earth’s dark shadow' },
  annular: { new: 'the Moon is too far away to cover the Sun and leaves a ring', full: '' },
  hybrid: { new: 'total near the middle of the path, a ring at its ends', full: '' },
  partial: { new: 'the Moon covers part of the Sun', full: 'part of the Moon enters the dark shadow' },
  penumbral: { new: '', full: 'the Moon only crosses the faint outer shadow' },
};

export function eclipseRows(data) {
  return data.eclipses.map((e) => {
    const lim = e.kind === 'new' ? e.limits.solarPartial : e.limits.lunarPenumbral;
    return {
      jde: e.greatest,
      when: formatDateTime(jdeToUtc(e.greatest)),
      kind: eclipseLabel(e),
      what: WHAT[e.eclipse][e.kind],
      miss: `${e.gap.toFixed(2)}° of ${lim.toFixed(2)}°`,
    };
  });
}

function seasonMonths(s) {
  const a = calendarDate(s.start);
  const b = calendarDate(s.end);
  return a.month === b.month ? monthName(a.month) : `${monthName(a.month)}–${monthName(b.month)}`;
}

function countPhrase(n, word) {
  return `${n === 0 ? 'no' : n} ${word} eclipse${n === 1 ? '' : 's'}`;
}

export function yearSummary(data, realTilt) {
  const counts = `${countPhrase(data.solarCount, 'solar')} and ${countPhrase(data.lunarCount, 'lunar')}`;
  if (data.halfWidth >= 90) {
    return `With the Moon’s orbit tilted only ${data.tilt.toFixed(1)}°, every new moon lines up with the Sun and every full moon with the Earth’s shadow: ${counts} in ${data.year}.`;
  }
  const seasons = data.seasons.map(seasonMonths);
  const list = seasons.length > 1
    ? `${seasons.slice(0, -1).join(', ')} and ${seasons[seasons.length - 1]}`
    : seasons[0] || 'none';
  const lead = realTilt ? `${data.year} has` : `With a ${data.tilt.toFixed(1)}° tilt, ${data.year} would have`;
  return `${lead} ${counts}. They all fall in the ${seasons.length} eclipse season${seasons.length === 1 ? '' : 's'} (${list}), when the Sun stands within ${data.halfWidth.toFixed(0)}° of a node of the Moon’s orbit.`;
}

// What the top view shows at the cursor, in a sentence or two.
export function momentText(snap, data) {
  const phase = phaseName(snap.elongation);
  const height = Math.abs(snap.moonLat) < 0.05
    ? 'right on the Sun’s path'
    : `${Math.abs(snap.moonLat).toFixed(1)}° ${snap.moonLat > 0 ? 'above' : 'below'} the Sun’s path`;
  const inSeason = Math.abs(snap.fromNode) < data.halfWidth;
  let season;
  if (data.halfWidth >= 90) season = 'Every day is in an eclipse season.';
  else if (inSeason) season = `The Sun is ${Math.abs(snap.fromNode).toFixed(0)}° from a node: eclipse season.`;
  else {
    const next = data.seasons.find((s) => s.start > snap.jde);
    season = `The Sun is ${Math.abs(snap.fromNode).toFixed(0)}° from the nearest node.`
      + (next ? ` Next eclipse season in ${Math.round(next.start - snap.jde)} days.` : '');
  }
  return {
    date: formatDate(jdeToUtc(snap.jde)),
    line: `${phase[0].toUpperCase()}${phase.slice(1)}, the Moon ${height}. ${season}`,
  };
}
