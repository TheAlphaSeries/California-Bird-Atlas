import fs from 'fs';
import { seasonCards, latestOccurrence, windowSpan } from '../public/js/rotation.js';
const d = JSON.parse(fs.readFileSync(new URL('../public/data/wildindex.json', import.meta.url)));
d.byId = new Map(d.birds.map((b) => [b.id, b]));
let repeats = 0, slots = 0, levelFam = 0, cardFam = 0, short = 0, backToBack = 0, cards = 0;
const appear = new Map(); // key region|season|level|bird -> count
const poolSize = new Map();
const YEARS = 40;
for (let y = 2026; y < 2026 + YEARS; y++) for (const s of 'WPSF') for (const r of d.regions) {
  const cs = seasonCards(d, r, s, y), ri = d.regions.indexOf(r);
  for (const L of [1,2,3]) {
    const pool = d.birds.filter((b) => b.cat === 'assign' && b.lv && b.lv[s][ri] === String(L)).length;
    poolSize.set(`${r}|${s}|${L}`, pool);
    const seen = cs.flatMap((c) => c[L]); slots += seen.length;
    const extra = seen.length - new Set(seen).size;
    if (pool >= 18 && extra) repeats += extra; // a repeat with enough birds would be a bug
    if (pool < 18) short += Math.max(0, extra - (18 - pool)); // more repeats than unavoidable
    for (let w = 1; w < cs.length; w++) backToBack += cs[w][L].filter((id) => cs[w-1][L].includes(id)).length;
    for (const id of seen) { const k = `${r}|${s}|${L}|${id}`; appear.set(k, (appear.get(k) || 0) + 1); }
  }
  for (const c of cs) {
    cards++;
    const fams = new Map();
    for (const L of [1,2,3]) {
      if (c[L].length < 3) short++;
      const f = c[L].map((id) => d.byId.get(id).fam); if (new Set(f).size < f.length) levelFam++;
      for (const x of f) fams.set(x, (fams.get(x) || 0) + 1);
    }
    if ([...fams.values()].some((n) => n > 2)) cardFam++;
  }
}
console.log({ cards, slots, repeatsWithEnoughBirds: repeats, avoidableRepeats: short, backToBack, levelsWithSameFamily: levelFam, cardsWithFamilyOver2: cardFam });
// Fairness: for each pool, how evenly were its birds picked over the years?
let worst = 0, sumCv = 0, n = 0, never = 0;
for (const [k, size] of poolSize) {
  const [r, s, L] = k.split('|');
  const counts = d.birds.filter((b) => b.cat === 'assign' && b.lv && b.lv[s][d.regions.indexOf(r)] === L).map((b) => appear.get(`${k}|${b.id}`) || 0);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const sd = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length);
  never += counts.filter((c) => c === 0).length;
  const cv = sd / mean; sumCv += cv; n++; worst = Math.max(worst, cv);
}
console.log('fairness over', YEARS, 'years: avg spread', (sumCv / n).toFixed(2), 'worst', worst.toFixed(2), 'birds never picked', never);
// Year-to-year: how much does the opening card change?
let same = 0, tot = 0;
for (const s of 'WPSF') for (const r of d.regions) { const a = seasonCards(d, r, s, 2026)[0], b = seasonCards(d, r, s, 2027)[0]; for (const L of [1,2,3]) { tot += 3; same += a[L].filter((x) => b[L].includes(x)).length; } }
console.log('opening-card overlap 2026 vs 2027:', same, 'of', tot);
for (const t of ['2026-11-20T18:00:00-08:00','2026-12-01T00:30:00-08:00','2026-11-30T23:30:00-08:00','2027-02-28T12:00:00-08:00','2027-01-12T09:00:00-08:00']) {
  const o = latestOccurrence(t.startsWith('2026-11') ? 'F' : 'W', new Date(t)); const sp = windowSpan(t.startsWith('2026-11')?'F':'W', o.year, o.window);
  console.log(t, o.year, 'card', o.window + 1, new Date(sp.start).toISOString().slice(0,10), '→', new Date(sp.end).toISOString().slice(0,10), o.live);
}
const c = seasonCards(d, 'BAY', 'F', 2026)[latestOccurrence('F', new Date('2026-11-20T18:00:00-08:00')).window];
for (const L of [1,2,3]) console.log('BAY now L' + L, c[L].map((id) => d.byId.get(id).n + ' (' + d.byId.get(id).fam.split(',')[0] + ')').join(', '));
