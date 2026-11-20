import { S, api, esc } from '../util.js';

export default async function explore(view) {
  const obs = S.owner ? await api('/observations') : [];
  const places = new Map();
  for (const o of obs) { if (!o.location_name) continue; const k = o.location_name + '|' + o.county; const p = places.get(k) || { name: o.location_name, county: o.county, n: 0, sp: new Set(), last: o.observed_at }; p.n++; p.sp.add(o.species_id); places.set(k, p); }
  view.innerHTML = `<div class="wrap">
    <header class="page-head"><span class="label">Explore California</span><h1>The atlas of places</h1>
      <p class="deck">The cartographic map, hotspot profiles, the seasonal calendar and the Find My Next Bird tool belong to the next phase of the build and are not here yet.</p></header>
    <p class="note">What is planned for this page: an interactive California map starting with San Francisco, Marin, San Mateo, the East Bay and the South Bay; field-guide profiles for birdwatching locations; and your own observation sites and expeditions plotted on the map. Nothing on this page is simulated in the meantime.</p>
    <section class="section" style="padding-top:20px"><div class="section-head"><div><span class="label">From your records</span><h2>Places you have recorded</h2></div></div>
    ${places.size ? `<table class="plain"><thead><tr><th>Location</th><th>County</th><th>Observations</th><th>Species</th><th>Most recent</th></tr></thead><tbody>${[...places.values()].sort((a, b) => b.n - a.n).map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.county)}</td><td>${p.n}</td><td>${p.sp.size}</td><td class="mono">${esc(p.last.slice(0, 10))}</td></tr>`).join('')}</tbody></table>` : `<p class="empty">${S.owner ? 'Locations you enter on observations will be listed here.' : 'Sign in as the owner to see recorded locations.'}</p>`}
    </section></div>`;
}
