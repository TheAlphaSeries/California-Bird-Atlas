import { S, api, esc, plate, picture, fmtDate, fmtLong, monthsFor, goalSpecies, $ } from '../util.js';
import { openObservation } from '../observe.js';

const REGIONS = [
  ['San Francisco', '37.77° N, 122.42° W', 'City parks, the Presidio, Lake Merced and the outer coast from Fort Funston to the Golden Gate.'],
  ['Marin', '38.04° N, 122.74° W', 'The Marin Headlands and Hawk Hill, Bolinas Lagoon and the Point Reyes peninsula.'],
  ['San Mateo', '37.50° N, 122.33° W', 'Pillar Point, the coastside bluffs, Pescadero Marsh and the bayside flats.'],
  ['East Bay', '37.80° N, 122.27° W', 'Arrowhead Marsh, Hayward shoreline, Coyote Hills and the Berkeley and Oakland hills.'],
  ['South Bay', '37.44° N, 122.11° W', 'Palo Alto Baylands, Shoreline, Alviso and the salt ponds of the Don Edwards refuge.'],
  ['Northern California', '40.80° N, 122.00° W', 'The Klamath Basin, the redwood coast, the Sacramento Valley refuges and the Cascades.'],
  ['Central California', '36.60° N, 119.90° W', 'Monterey Bay, the Sierra Nevada, the San Joaquin Valley and Mono Lake.'],
  ['Southern California', '33.80° N, 116.90° W', 'The Salton Sea, the Mojave and Colorado deserts, the Channel Islands and the southern coast.'],
];

export default async function home(view) {
  const obs = await api('/observations?limit=80');
  const month = new Date().getMonth() + 1;
  const photographed = S.species.filter((s) => s.status === 'photographed');
  const observed = S.species.filter((s) => s.status === 'photographed' || s.status === 'observed');
  const goal = goalSpecies();

  // hero: my latest photographed species, else a credited reference image from the starter collection
  const mine = S.species.filter((s) => s.photo_id).sort((a, b) => b.photo_id - a.photo_id)[0];
  const refs = S.species.filter((s) => s.bay_area && s.ref_url);
  const heroSp = mine || refs[Math.floor(Date.now() / 864e5) % (refs.length || 1)];
  const heroPic = heroSp ? picture(heroSp, 'display') : null;

  // latest field day
  let field = '';
  if (obs.length) {
    const day = obs[0].observed_at.slice(0, 10), loc = obs[0].location_name;
    const set = obs.filter((o) => o.observed_at.slice(0, 10) === day && o.location_name === loc);
    const withPhoto = set.find((o) => o.photo_id);
    const names = [...new Set(set.map((o) => o.common_name))];
    const note = set.find((o) => o.notes)?.notes || '';
    field = `<div class="feature">
      <div class="fig">${withPhoto ? `<img src="/media/${withPhoto.photo_id}/display" alt="${esc(withPhoto.common_name)}">` : ''}</div>
      <div><span class="mono">${esc(fmtLong(day))}</span>
        <h3>${esc(loc || 'Field day')}</h3>
        <p class="mono" style="margin-bottom:14px">${esc([obs[0].county && obs[0].county + ' County', `${names.length} species`].filter(Boolean).join(' · '))}</p>
        <p>${note ? esc(note.length > 280 ? note.slice(0, 280) + '…' : note) : esc(names.slice(0, 8).join(', ') + (names.length > 8 ? ' and others.' : '.'))}</p>
        <a class="btn" href="/journal" data-link>Read the field notes</a></div></div>`;
  } else {
    field = `<p class="empty">No field days recorded yet. ${S.owner ? 'The first observation you log will appear here.' : ''}</p>${S.owner ? '<button class="btn solid" id="first-obs" type="button">Record the first observation</button>' : ''}`;
  }

  const seasonal = S.species.filter((s) => s.bay_area && monthsFor(s.season_status).includes(month))
    .sort((a, b) => (a.season_status === 'Year-round resident') - (b.season_status === 'Year-round resident') || a.seq - b.seq).slice(0, 8);
  const rank = { High: 0, Medium: 1, Low: 2, '': 3 };
  const watch = S.species.filter((s) => s.status !== 'photographed' && (s.target_priority || s.bay_area))
    .sort((a, b) => rank[a.target_priority || ''] - rank[b.target_priority || ''] || (monthsFor(b.season_status).includes(month) - monthsFor(a.season_status).includes(month)) || a.seq - b.seq).slice(0, 4);

  view.innerHTML = `
  <section class="hero ${heroPic ? '' : 'plate'}">
    ${heroPic ? `<img class="bg" src="${esc(heroPic.src)}" alt="${esc(heroSp.common_name)}">` : ''}
    <div class="inner">
      <span class="label ochre">A field journal · Est. 2026 · San Francisco</span>
      <h1 style="margin-top:14px">California Bird Atlas</h1>
      <p class="deck">An ongoing photographic study of the birds of California.</p>
      <p class="sub">A personal field journal documenting the landscapes, migrations, and wild birds of the Golden State.</p>
      <div class="actions"><a href="/guide" data-link>Explore the Atlas</a><a href="/journal" data-link>Open Field Journal</a></div>
    </div>
    ${heroPic ? `<div class="credit">${esc(heroSp.common_name)}, <i>${esc(heroSp.scientific_name)}</i>. ${heroPic.kind === 'ref' ? `Reference photograph: ${esc(heroSp.ref_credit || '')} (${esc(heroSp.ref_license || '')}), Wikimedia Commons.` : 'Photograph from the collection.'}</div>` : ''}
  </section>
  <div class="wrap">
    <section class="section"><div class="section-head"><div><span class="label">From the field</span><h2>The most recent outing</h2></div><a class="more" href="/journal" data-link>All field notes</a></div>${field}</section>

    <section class="section" style="padding-top:0"><span class="label">The collection</span>
      <div class="counters" style="margin-top:14px">
        <div class="counter"><span class="n">${photographed.length}</span><span class="of">/ ${goal.length}</span><span class="label">Species photographed</span></div>
        <div class="counter"><span class="n">${observed.length}</span><span class="label">Species observed</span></div>
        <div class="counter"><span class="n">${S.totals.counties || 0}</span><span class="of">/ 58</span><span class="label">Counties explored</span></div>
        <div class="counter"><span class="n">${S.totals.field_days || 0}</span><span class="label">Field days recorded</span></div>
      </div></section>

    <section class="section" style="padding-top:0"><div class="section-head"><div><span class="label">Birds of the season · ${new Date().toLocaleDateString('en-US', { month: 'long' })}</span><h2>Around the Bay this month</h2></div><a class="more" href="/guide" data-link>The field guide</a></div>
      <div class="plates">${seasonal.map((s) => plate(s)).join('')}</div></section>

    <section class="section" style="padding-top:0"><div class="section-head"><div><span class="label">The unphotographed</span><h2>On the watchlist</h2></div><a class="more" href="/life-list" data-link>The life list</a></div>
      ${watch.length ? `<div class="plates tall">${watch.map((s) => plate(s, { tag: 'On the watchlist' })).join('')}</div>` : '<p class="empty">Every target on the watchlist has been photographed.</p>'}</section>

    <section class="section" style="padding-top:0"><div class="section-head"><div><span class="label">Recent field notes</span><h2>Latest entries</h2></div></div>
      ${obs.length ? `<ul class="notes">${obs.slice(0, 7).map((o) => `<li><span class="mono">${esc(fmtDate(o.observed_at))}</span><span><span class="what"><a href="/species/${o.species_id}" data-link>${esc(o.common_name)}</a></span> <span class="sci caption">${esc(o.scientific_name)}</span>${o.notes ? `<br><span class="caption">${esc(o.notes.slice(0, 140))}${o.notes.length > 140 ? '…' : ''}</span>` : ''}</span><span class="where">${esc([o.location_name, o.county].filter(Boolean).join(', '))}${o.photo_count ? ' · photographed' : ''}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing recorded yet.</p>'}</section>

    <section class="section" style="padding-top:0"><div class="section-head"><div><span class="label">Explore California</span><h2>Birding regions of the state</h2></div><a class="more" href="/explore" data-link>Explore</a></div>
      <div class="regions">${REGIONS.map(([n, c, d]) => `<div class="region"><span class="mono">${c}</span><h3>${n}</h3><p>${d}</p></div>`).join('')}</div></section>
  </div>`;
  const b = $('#first-obs', view); if (b) b.onclick = () => openObservation();
}
