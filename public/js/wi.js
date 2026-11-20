// WILD INDEX data: regional levels, seasonal cards and scoring, from /data/wildindex.json.
import { S, esc } from './util.js';

export const SEASONS = { W: 'Winter', P: 'Spring', S: 'Summer', F: 'Fall' };
export const SEASON_ORDER = ['W', 'P', 'S', 'F'];
export const CATEGORY = {
  assign: 'On the cards', scarce: 'Scarce', rare: 'Rare visitor', night: 'Night bird',
  offshore: 'Offshore and island', sensitive: 'Gallery only', introduced: 'Introduced',
};
// Photos that ship with the site, shown until uploaded photographs replace them.
export const BUILT_IN = { 'Great Blue Heron': { src: '/img/great-blue-heron.jpg', caption: 'Found all year in every region of California.' } };

let data = null;
export async function wi() {
  if (!data) {
    const res = await fetch('/data/wildindex.json');
    if (!res.ok) throw new Error('The bird index could not be loaded.');
    data = await res.json();
    data.byId = new Map(data.birds.map((b) => [b.id, b]));
    data.byName = new Map(data.birds.map((b) => [b.n, b]));
  }
  return data;
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
export const dbSpecies = (b) => S.species.find((s) => s.common_name === b.n);
export const birdLink = (b) => `/the-index/${b.id}`;
export const lvSpan = (v) => v == null ? '<span class="lv none">–</span>' : v === 'r' ? '<span class="lv none">rare</span>' : `<span class="lv l${v}">${v}</span>`;
export const birdName = (b) => `<span class="bn">${esc(b.n)}</span><span class="bs mag-sci">${esc(b.sci)}</span>`;
