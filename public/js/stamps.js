// Region stamps for My Wall: one stamp for each of the seven regions you've photographed in, and one for each
// season you took part. Worked out from what this browser already keeps (My Wall birds and the photos sent from
// here), so nothing new is stored and nothing leaves the device.
import { esc } from './util.js';
import { REGIONS, REGION_NAMES, currentSeason, seasonLabel } from './wi.js';
// Photos sent from this browser (written by views/submit.js under the same key).
const sentLinks = () => { try { return JSON.parse(localStorage.getItem('wi.sent') || '[]'); } catch { return []; } };

// The region's outline, cut from the state map and fitted into the stamp.
function outline(g, r) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const m of g.paths[r].matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)/g)) {
    const x = +m[1], y = +m[2], w = +m[3];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 6);
  }
  const pad = 6;
  return `<svg class="st-shape" viewBox="${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><path d="${g.paths[r]}"/></svg>`;
}
const month = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

export function stampsSection(g, myBirds) {
  const recs = [
    ...myBirds.map((x) => ({ region: x.region, when: x.taken_at || x.created })),
    ...sentLinks().map((x) => ({ region: x.region, when: x.taken_at || x.at })),
  ].filter((x) => x.when);
  const firstIn = {};
  for (const x of recs) if (x.region && (!firstIn[x.region] || x.when < firstIn[x.region])) firstIn[x.region] = x.when;
  const seasons = new Map();
  for (const x of recs) { const dt = new Date(x.when); const k = seasonLabel(currentSeason(dt), dt); if (!seasons.has(k)) seasons.set(k, x.when); }
  const now = seasonLabel(currentSeason());
  const seasonList = [...seasons.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  if (!seasons.has(now)) seasonList.push([now, null]);
  const got = REGIONS.filter((r) => firstIn[r]).length;
  return `<section class="stamps" aria-labelledby="st-h">
    <div class="st-head"><div><p class="mag-kicker">Field passport</p><h2 id="st-h">Your stamps</h2></div>
      <p class="st-count"><b>${got}</b> of 7 regions<br><b>${seasons.size}</b> season${seasons.size === 1 ? '' : 's'}</p></div>
    <p class="st-how">A stamp for every region you photograph a bird in, and every season you take part. Add birds here or send them to the wall to collect them. Kept on this device only.</p>
    <ul class="st-row" aria-label="Region stamps">${REGIONS.map((r, i) => `<li class="stamp ${firstIn[r] ? 'on' : 'off'}"><div class="st-in">
      <span class="st-no">${String(i + 1).padStart(2, '0')}</span>${outline(g, r)}<span class="st-name">${esc(REGION_NAMES[r])}</span></div>
      ${firstIn[r] ? `<span class="st-cancel" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="33"/>
        <path id="stc${i}" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" fill="none" stroke="none"/>
        <text><textPath href="#stc${i}" startOffset="2%">PHOTOGRAPHED · ${month(firstIn[r])} · CALIFORNIA BIRD ATLAS ·</textPath></text></svg></span>` : ''}
      <span class="vh">${firstIn[r] ? `Collected ${month(firstIn[r]).toLowerCase()}` : 'Not collected yet'}</span></li>`).join('')}</ul>
    <ul class="st-seasons" aria-label="Season stamps">${seasonList.map(([k, w]) => `<li class="sstamp ${w ? 'on' : 'off'}"><b>${esc(k.split(' ')[0])}</b><span>${esc(k.split(' ').slice(1).join(' '))}</span><i>${w ? 'Took part' : 'This season: not yet'}</i></li>`).join('')}</ul>
  </section>`;
}
