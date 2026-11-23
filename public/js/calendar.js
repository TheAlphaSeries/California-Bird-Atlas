// "Add to my calendar": a calendar file (.ics) with the next days the nine birds change, for one region.
// Apple Calendar, Google Calendar and Outlook all open it. Each date is an all-day event with a link back.
import { SEASONS, SEASON_ORDER, currentSeason, REGION_NAMES } from './wi.js';
import { latestOccurrence, windowSpan, WINDOWS } from './rotation.js';

const day = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
export function calendarFile(d, region) {
  const now = Date.now(), season = currentSeason(), occ = latestOccurrence(season);
  const next = SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % 4], nextYear = season === 'W' ? occ.year + 1 : occ.year;
  const starts = [];
  for (let w = 0; w < WINDOWS; w++) starts.push([windowSpan(season, occ.year, w).start, season, w]);
  for (let w = 0; w < WINDOWS; w++) starts.push([windowSpan(next, nextYear, w).start, next, w]);
  const url = `${location.origin}/this-season`;
  const events = starts.filter(([t]) => t > now).map(([t, s, w]) => [
    'BEGIN:VEVENT', `UID:nine-birds-${region}-${t}@${location.host}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${day(t)}`, `DTEND;VALUE=DATE:${day(t + 864e5)}`,
    `SUMMARY:New nine birds: ${REGION_NAMES[region]}`, `DESCRIPTION:${SEASONS[s]} assignment ${w + 1} of ${WINDOWS}. See them at ${url}`, `URL:${url}`, 'END:VEVENT',
  ].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//California Bird Atlas//Nine birds//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `nine-birds-${REGION_NAMES[region].toLowerCase().replace(/[^a-z]+/g, '-')}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
}
