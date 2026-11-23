// The field guide data: every bird, how hard it is to find in each region and season, and the scoring rules.
// Loaded once from /data/wildindex.json (written by tools/wildindex/export_site_data.py; never edit the JSON by hand).
//
// Shape of the object wi() resolves to:
//   regions       ['BAY','NC','CV','SN','CC','SC','DES']   region codes; the ORDER matters (see lv and rr below)
//   region_names  { BAY: 'Bay Area', ... }
//   scoring       { base, stars, reupload, bonus, activity }   point values shown on This Season
//   birds[]       all 696 species, in official checklist order:
//     id    'WI-382'       permanent plate number, used in URLs (/birds/WI-382)
//     n     common name    the join key to the database's species table (S.spByName)
//     sci   scientific name
//     fam   family, in English
//     kind  status on the state list, e.g. 'Native', 'Introduced', 'Rare visitor (review list)'
//     cat   one of CATEGORY's keys; decides scoring and whether the bird can be assigned
//     lv    { W, P, S, F }  one 7-character string per season, one character per region in `regions` order:
//           '1' easy, '2' takes a trip, '3' hard, '-' not dependable. Example: W: '222-222'. Only assignable birds have it.
//     rr    7 characters, one per region: 'y' regular, 'r' rare there, '-' absent
//     why, prot, note, look, conf   optional notes (why not assigned, protection, field note, look-alike, confidence)
//   byId, byName  Maps added here for lookups
//
// Use levelOf(bird, regionIndex, seasonCode) to read a level; don't index the strings directly.
import { S, esc, modal } from './util.js';

export const SEASONS = { W: 'Winter', P: 'Spring', S: 'Summer', F: 'Fall' };
export const SEASON_ORDER = ['W', 'P', 'S', 'F'];
export const CATEGORY = {
  assign: 'On the cards', scarce: 'Scarce', rare: 'Rare visitor', night: 'Night bird',
  offshore: 'Offshore and island', sensitive: 'Gallery only', introduced: 'Introduced',
};
// Photos that ship with the site, shown until uploaded photographs replace them.
export const BUILT_IN = { 'Great Blue Heron': { src: '/img/great-blue-heron.jpg', caption: 'Found all year in every region of California.' } };

let dataP = null; // the promise is cached, so pages that load together share one download
export function wi() {
  if (!dataP) {
    dataP = (async () => {
      const res = await fetch('/data/wildindex.json');
      if (!res.ok) throw new Error('The bird index could not be loaded.');
      const data = await res.json();
      data.byId = new Map(data.birds.map((b) => [b.id, b]));
      data.byName = new Map(data.birds.map((b) => [b.n, b]));
      return data;
    })().catch((e) => { dataP = null; throw e; });
  }
  return dataP;
}

export function currentSeason(d = new Date()) {
  const m = d.getMonth() + 1;
  return m === 12 || m <= 2 ? 'W' : m <= 5 ? 'P' : m <= 8 ? 'S' : 'F';
}
export function seasonLabel(code, d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth() + 1;
  return `${SEASONS[code]} ${code === 'W' && m === 12 ? `${y}–${String(y + 1).slice(2)}` : code === 'W' ? `${y - 1}–${String(y).slice(2)}` : y}`;
}

const REGION_KEY = 'wi.region';
export function myRegion(d) {
  try { const r = localStorage.getItem(REGION_KEY); if (r && d.regions.includes(r)) return r; } catch { /* storage off */ }
  return 'BAY';
}
export function setRegion(r) { try { localStorage.setItem(REGION_KEY, r); } catch { /* storage off */ } }
export function hasRegion() { try { return !!localStorage.getItem(REGION_KEY); } catch { return false; } }
export const REGIONS = ['BAY', 'NC', 'CV', 'SN', 'CC', 'SC', 'DES'];
export const REGION_NAMES = { BAY: 'Bay Area', NC: 'North Coast', CV: 'Central Valley', SN: 'Sierra & Northeast', CC: 'Central Coast', SC: 'Southern Coast', DES: 'Deserts' };
export const REGION_HINT = {
  BAY: 'San Francisco, Oakland, San Jose, Marin, Napa, Sonoma',
  NC: 'Mendocino, Humboldt, Del Norte, Lake, Trinity',
  CV: 'Sacramento, Stockton, Modesto, Fresno, Bakersfield',
  SN: 'Sierra Nevada and foothills, Tahoe, Yosemite, Mount Shasta, Modoc',
  CC: 'Santa Cruz, Monterey, San Luis Obispo, Santa Barbara',
  SC: 'Ventura, Los Angeles, Orange, San Diego, Inland Empire',
  DES: 'Mojave, Palm Springs, Salton Sea, Death Valley, Owens Valley',
};
export function regionName() { try { return REGION_NAMES[localStorage.getItem(REGION_KEY)] || 'Bay Area'; } catch { return 'Bay Area'; } }
// Ask which region the visitor birds in. Nothing about their location is collected.
export function pickRegion() {
  let cur = null; try { cur = localStorage.getItem(REGION_KEY); } catch { /* storage off */ }
  const m = modal(`<p class="mag-kicker">Your region</p><h2>Where do you go birding?</h2>
    <p class="rp-note">Pick the part of California you bird in most. It sets your nine birds each season and the levels you see. It is saved on this device only, and you can change it any time.</p>
    <div class="region-pick">${REGIONS.map((r) => `<button type="button" data-r="${r}" aria-pressed="${r === cur}"><b>${REGION_NAMES[r]}</b><span>${REGION_HINT[r]}</span></button>`).join('')}</div>`, { wide: true });
  m.el.classList.add('mag-modal');
  m.el.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { setRegion(b.dataset.r); m.close(); window.dispatchEvent(new Event('route')); }));
}

// level of bird b in region index i and season s: 1..3, 'r' (rare/brief), or null
export function levelOf(b, i, s) {
  if (b.lv) { const c = b.lv[s][i]; if (c !== '-') return +c; }
  if (b.rr && b.rr[i] === 'r') return 'r';
  return null;
}

export function pointsLabel(b, d) {
  const sc = d.scoring.base;
  if (b.cat === 'assign') return `${sc.assign.join(' / ')} points by level`;
  if (b.cat === 'sensitive') return 'no points';
  if (b.cat === 'introduced') return 'No points';
  return `${sc[b.cat]} points`;
}

// The species record in the database for an index bird (for photographs), if any.
export const dbSpecies = (b) => S.spByName.get(b.n);
export const birdLink = (b) => `/birds/${b.id}`;
export const lvSpan = (v) => v == null ? '<span class="lv none">–</span>' : v === 'r' ? '<span class="lv none">rare</span>' : `<span class="lv l${v}">${v}</span>`;
