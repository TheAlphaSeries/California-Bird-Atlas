// Two-week rotation of the nine birds.
//
// Each season (Winter starts 1 Dec, Spring 1 Mar, Summer 1 Jun, Fall 1 Sep, Pacific time) is split into six cards:
// five of two weeks and a last one that runs to the end of the season (about three weeks).
//
// How the birds are drawn, for one region, one season, one year:
//  - Everyone in a region gets the same nine birds, so scores compare fairly.
//  - The draw is seeded by season, year and region, so it is the same on every device, and different every year.
//  - Each level's eligible birds are shuffled once for the whole season (Fisher-Yates with a seeded generator),
//    then dealt out three at a time, so no bird repeats within a season until every eligible bird has had a turn.
//  - Within one level of one card, no two birds come from the same family (no card of three gulls), and across
//    the nine birds no family appears more than twice. A bird skipped for this rule goes first in line next time.
//  - If a level runs out of birds before the season ends, its birds are reshuffled, avoiding the most recent card.
//  - Future cards are never shown; the page only reveals cards that have started.

export const WINDOWS = 6;
const START_MONTH = { W: 12, P: 3, S: 6, F: 9 };
const DAY = 864e5;

// Today's date in California, as a plain UTC midnight, so every visitor shares the same calendar.
function caToday(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day);
}

// The start and end of season s in season-year y (Winter y runs Dec y to Feb y+1).
export function seasonSpan(s, y) {
  const start = Date.UTC(y, START_MONTH[s] - 1, 1);
  const end = Date.UTC(y, START_MONTH[s] - 1 + 3, 1); // first day of the next season
  return { start, end };
}

export function windowSpan(s, y, w) {
  const { start, end } = seasonSpan(s, y);
  return { start: start + w * 14 * DAY, end: w === WINDOWS - 1 ? end : start + (w + 1) * 14 * DAY };
}

// The most recent time season s started, on or before today, and how far into it we are.
// Returns { year, window } where window is the latest card that has started (0-5), or WINDOWS-1 if the season is over.
export function latestOccurrence(s, now = new Date()) {
  const today = caToday(now);
  let y = new Date(today).getUTCFullYear();
  if (seasonSpan(s, y).start > today) y -= 1;
  const { start, end } = seasonSpan(s, y);
  const live = today < end;
  const window = live ? Math.min(WINDOWS - 1, Math.floor((today - start) / (14 * DAY))) : WINDOWS - 1;
  return { year: y, window, live, today };
}

// ---- seeded random numbers ----
function hash(str) { // cyrb128: four 32-bit seeds from a string
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}
function sfc32(a, b, c, d) { // small fast counter generator; good statistical quality
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0; d = (d + 1) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
export function rng(key) { const r = sfc32(...hash(key)); for (let i = 0; i < 15; i++) r(); return r; }
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- the draw ----
const cache = new Map();

// All six cards for one region, season and season-year: [{ 1: [ids], 2: [ids], 3: [ids] }, ...]
export function seasonCards(d, region, s, y) {
  const key = `${y}|${s}|${region}`;
  if (cache.has(key)) return cache.get(key);
  const ri = d.regions.indexOf(region);
  const pools = { 1: [], 2: [], 3: [] };
  for (const b of d.birds) {
    if (b.cat !== 'assign' || !b.lv) continue;
    const c = b.lv[s][ri];
    if (c === '1' || c === '2' || c === '3') pools[c].push(b);
  }
  // Sort first so the draw never depends on the order of the data file.
  for (const L of [1, 2, 3]) pools[L].sort((a, b) => (a.id < b.id ? -1 : 1));
  const rand = rng(`california-bird-atlas|${key}`);
  const queue = { 1: shuffle(pools[1], rand), 2: shuffle(pools[2], rand), 3: shuffle(pools[3], rand) };
  const cards = [];
  let last = { 1: [], 2: [], 3: [] };
  for (let w = 0; w < WINDOWS; w++) {
    const card = { 1: [], 2: [], 3: [] }, famCount = new Map();
    for (const L of [3, 2, 1]) { // hardest first: its pool is smallest, so it gets first pick of families
      const take = Math.min(3, pools[L].length);
      for (let pass = 0; pass < 3 && card[L].length < take; pass++) {
        // pass 0: no repeated family in this level, at most two of a family on the card
        // pass 1: relax the two-per-card limit; pass 2: anything not already on this card
        let i = 0;
        while (card[L].length < take) {
          if (i >= queue[L].length) {
            if (pass < 2) break;
            // Level ran out this season: reshuffle everything not on this card or the last one.
            const used = new Set([...card[L], ...last[L]]);
            const fresh = shuffle(pools[L].filter((b) => !used.has(b.id)), rand);
            if (!fresh.length) break;
            queue[L].push(...fresh);
          }
          const b = queue[L][i];
          const inLevel = card[L].some((id) => d.byId.get(id).fam === b.fam);
          const famFull = (famCount.get(b.fam) || 0) >= 2;
          const ok = !card[L].includes(b.id) && (pass === 2 || (!inLevel && (pass === 1 || !famFull)));
          if (ok) { card[L].push(b.id); famCount.set(b.fam, (famCount.get(b.fam) || 0) + 1); queue[L].splice(i, 1); }
          else i++;
        }
      }
    }
    cards.push(card); last = card;
  }
  cache.set(key, cards);
  return cards;
}
