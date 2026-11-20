import { $, esc } from '../util.js';
import { wi, SEASONS, SEASON_ORDER, CATEGORY, currentSeason, myRegion, setRegion, birdLink, birdName, levelOf, lvSpan } from '../wi.js';

let st = null;

export default async function theIndex(view) {
  document.body.classList.add('mag');
  const d = await wi();
  if (!st) st = { q: '', region: myRegion(d), season: currentSeason(), show: 'here' };
  view.innerHTML = `<div class="mag-wrap mag-page">
    <p class="mag-kicker">The Index</p>
    <h1 class="mag-h">Every bird in California</h1>
    <p class="mag-deck">All ${d.birds.length} species on the official state list. Choose a region and season to see each bird's level there.</p>
    <form class="ix-filters" id="ixf">
      <label>Search<input name="q" type="search" value="${esc(st.q)}" placeholder="Name or scientific name"></label>
      <label>Region<select name="region">${d.regions.map((r) => `<option value="${r}" ${r === st.region ? 'selected' : ''}>${esc(d.region_names[r])}</option>`).join('')}</select></label>
      <label>Season<select name="season">${SEASON_ORDER.map((s) => `<option value="${s}" ${s === st.season ? 'selected' : ''}>${SEASONS[s]}</option>`).join('')}</select></label>
      <label>Show<select name="show">
        <option value="here" ${st.show === 'here' ? 'selected' : ''}>Birds with a level here</option>
        <option value="all" ${st.show === 'all' ? 'selected' : ''}>All birds</option>
        <option value="rare" ${st.show === 'rare' ? 'selected' : ''}>Scarce and rare finds</option>
        <option value="out" ${st.show === 'out' ? 'selected' : ''}>Native birds not on any card</option>
      </select></label>
    </form>
    <p class="ix-count" id="ixc" aria-live="polite"></p>
    <div class="ix-list" id="ixl"></div>
  </div>`;
  const form = $('#ixf', view), list = $('#ixl', view);
  const draw = () => {
    Object.assign(st, Object.fromEntries(new FormData(form)));
    setRegion(st.region);
    const i = d.regions.indexOf(st.region), q = st.q.trim().toLowerCase();
    const rows = d.birds.filter((b) => {
      if (q && !b.n.toLowerCase().includes(q) && !b.sci.toLowerCase().includes(q)) return false;
      if (st.show === 'here') return b.cat === 'assign' && typeof levelOf(b, i, st.season) === 'number';
      if (st.show === 'rare') return b.cat === 'rare' || b.cat === 'scarce';
      if (st.show === 'out') return ['sensitive', 'night', 'offshore'].includes(b.cat);
      return true;
    });
    if (st.show === 'here') rows.sort((a, b) => levelOf(a, i, st.season) - levelOf(b, i, st.season));
    $('#ixc', view).textContent = `${rows.length} bird${rows.length === 1 ? '' : 's'}`;
    list.innerHTML = rows.map((b) => {
      const lv = b.cat === 'assign' ? levelOf(b, i, st.season) : null;
      const tag = b.cat === 'assign' ? (typeof lv === 'number' ? `Level <b>${lv}</b>` : lvSpan(lv)) : esc(CATEGORY[b.cat]);
      return `<a class="ix-row" href="${birdLink(b)}" data-link><span>${birdName(b)}</span><span class="tag">${tag}</span></a>`;
    }).join('') || '<p class="mag-deck" style="padding-top:16px">No birds match.</p>';
  };
  form.addEventListener('input', draw);
  form.addEventListener('submit', (e) => e.preventDefault());
  draw();
}
