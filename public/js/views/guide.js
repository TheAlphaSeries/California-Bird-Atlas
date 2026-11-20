import { S, $, esc, plate, NATIVE, SEASON, STATUS } from '../util.js';

let saved = { q: '', family: '', habitat: '', season: '', native: '', status: '', bay: '', cons: '', sort: 'tax' };

export default async function guide(view) {
  const habitats = [...new Set(S.species.flatMap((s) => (s.habitats || '').split(';').map((h) => h.trim()).filter(Boolean)))].sort();
  const opt = (arr, cur) => arr.map((x) => (Array.isArray(x) ? x : [x, x])).map(([v, l]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  view.innerHTML = `<div class="wrap">
    <header class="page-head"><span class="label">The ornithological field guide</span><h1>Birds of California</h1>
      <p class="deck">${S.species.length} species in ${S.families.length} families, arranged in taxonomic order. Search by name, or browse by family, habitat, season and status.</p></header>
    <form class="filters" id="gf">
      <input class="input" type="search" name="q" placeholder="Search common or scientific name" value="${esc(saved.q)}" aria-label="Search species">
      <select class="input" name="family" aria-label="Family"><option value="">All families</option>${opt(S.families.map((f) => [f.id, `${f.family_common} (${f.family})`]), saved.family)}</select>
      <select class="input" name="habitat" aria-label="Habitat"><option value="">All habitats</option>${opt(habitats, saved.habitat)}</select>
      <select class="input" name="season" aria-label="Seasonal occurrence"><option value="">Any season</option>${opt(SEASON, saved.season)}</select>
      <select class="input" name="native" aria-label="Native status"><option value="">Any native status</option>${opt(NATIVE, saved.native)}</select>
      <select class="input" name="status" aria-label="Photography status"><option value="">Any personal status</option>${opt(Object.entries(STATUS), saved.status)}</select>
      <select class="input" name="bay" aria-label="Region"><option value="">All of California</option><option value="1" ${saved.bay ? 'selected' : ''}>San Francisco Bay Area starter collection</option></select>
      <select class="input" name="cons" aria-label="Conservation status"><option value="">Any conservation status</option><option value="1" ${saved.cons ? 'selected' : ''}>Listed as threatened or endangered</option></select>
      <select class="input" name="sort" aria-label="Order"><option value="tax">Taxonomic order</option><option value="az" ${saved.sort === 'az' ? 'selected' : ''}>Common name A to Z</option><option value="sci" ${saved.sort === 'sci' ? 'selected' : ''}>Scientific name A to Z</option></select>
      <span class="mono count" id="gcount"></span>
    </form>
    <p class="caption" style="margin:-14px 0 26px">County-level and regional occurrence will be added with the Explore map. Until then the region filter covers the Bay Area starter collection.</p>
    <div class="plates" id="glist"></div></div>`;
  const form = $('#gf', view), list = $('#glist', view);
  const draw = () => {
    saved = Object.fromEntries(new FormData(form));
    const q = saved.q.trim().toLowerCase();
    let rows = S.species.filter((s) => (!q || s.common_name.toLowerCase().includes(q) || s.scientific_name.toLowerCase().includes(q))
      && (!saved.family || s.family_id === +saved.family) && (!saved.habitat || (s.habitats || '').split(';').map((h) => h.trim()).includes(saved.habitat))
      && (!saved.season || s.season_status === saved.season) && (!saved.native || s.native_status === saved.native)
      && (!saved.status || s.status === saved.status) && (!saved.bay || s.bay_area) && (!saved.cons || s.conservation));
    if (saved.sort === 'az') rows = [...rows].sort((a, b) => a.common_name.localeCompare(b.common_name));
    if (saved.sort === 'sci') rows = [...rows].sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
    $('#gcount', view).textContent = `${rows.length} species`;
    let html = '', fam = null;
    for (const s of rows) {
      if (saved.sort === 'tax' && s.family_id !== fam) { fam = s.family_id; const f = S.famById.get(fam); html += `<div class="fam-head"><h3>${esc(f?.family_common || 'Unplaced')}</h3><span class="mono">${esc(f ? `${f.family} · ${f.ord}` : '')}</span></div>`; }
      html += plate(s);
    }
    list.innerHTML = html || '<p class="empty">No species match those filters.</p>';
  };
  form.addEventListener('input', draw); form.addEventListener('submit', (e) => e.preventDefault());
  draw();
}
