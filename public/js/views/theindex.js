import { $, $$, S, esc } from '../util.js';
import { wi, SEASONS, SEASON_ORDER, CATEGORY, BUILT_IN, currentSeason, myRegion, setRegion, birdLink, levelOf } from '../wi.js';

let st = null;
const SHOW = [['here', 'On the cards'], ['rare', 'Rare finds'], ['out', 'Not this edition'], ['all', 'All birds']];
const SHORT = { W: 'Win', P: 'Spr', S: 'Sum', F: 'Fall' };

function thumb(b) {
  const sp = S.species.find((s) => s.common_name === b.n);
  const src = sp?.photo_id ? `/media/${sp.photo_id}/thumb` : BUILT_IN[b.n]?.src;
  return src
    ? `<span class="ixc-img"><img loading="lazy" src="${esc(src)}" alt=""></span>`
    : `<span class="ixc-img blank" aria-hidden="true"><span class="no">${esc(b.id.replace('WI-', 'No. '))}</span><span class="sc">No photo yet</span></span>`;
}

function strip(b, i) {
  return `<span class="ixc-strip" aria-label="Level by season">${SEASON_ORDER.map((s) => {
    const v = levelOf(b, i, s);
    const cls = typeof v === 'number' ? `l${v}` : 'off';
    return `<span class="sq ${cls}" title="${SEASONS[s]}: ${typeof v === 'number' ? 'Level ' + v : v === 'r' ? 'rare' : 'not expected'}"><i></i><b>${SHORT[s]}</b></span>`;
  }).join('')}</span>`;
}

function badge(b, i, season) {
  if (b.cat !== 'assign') return `<span class="ixc-badge cat">${esc(CATEGORY[b.cat])}</span>`;
  const v = levelOf(b, i, season);
  if (typeof v === 'number') return `<span class="ixc-badge l${v}">Level ${v}</span>`;
  return `<span class="ixc-badge off">${v === 'r' ? 'Rare here' : 'Not this season'}</span>`;
}

export default async function theIndex(view) {
  document.body.classList.add('mag');
  const d = await wi();
  if (!st) st = { q: '', region: myRegion(d), season: currentSeason(), show: 'here' };
  const n = (c) => d.birds.filter((b) => c.includes(b.cat)).length;
  view.innerHTML = `<div class="ix">
    <header class="mag-wrap ix-head">
      <p class="mag-kicker">The Index</p>
      <h1 class="ix-title">Every bird<br>in California</h1>
      <p class="mag-deck">The official state list, bird by bird, with how hard each one is to find in your region, season by season.</p>
      <dl class="ix-stats">
        <div><dt>Species</dt><dd>${d.birds.length}</dd></div>
        <div><dt>On the cards</dt><dd>${n(['assign'])}</dd></div>
        <div><dt>Rare finds</dt><dd>${n(['rare', 'scarce'])}</dd></div>
        <div><dt>Regions</dt><dd>${d.regions.length}</dd></div>
      </dl>
    </header>
    <div class="ix-bar"><div class="mag-wrap">
      <div class="ix-row1">
        <label class="ix-search"><span class="vh">Search</span><input id="ixq" type="search" placeholder="Search by name" value="${esc(st.q)}"></label>
        <div class="seg" role="group" aria-label="Show">${SHOW.map(([k, l]) => `<button type="button" data-show="${k}" aria-pressed="${st.show === k}">${l}</button>`).join('')}</div>
      </div>
      <div class="ix-row2">
        <div class="seg small" role="group" aria-label="Region">${d.regions.map((r) => `<button type="button" data-r="${r}" aria-pressed="${st.region === r}">${esc(d.region_names[r])}</button>`).join('')}</div>
        <div class="seg small" role="group" aria-label="Season">${SEASON_ORDER.map((s) => `<button type="button" data-s="${s}" aria-pressed="${st.season === s}">${SEASONS[s]}</button>`).join('')}</div>
      </div>
    </div></div>
    <div class="mag-wrap ix-body">
      <p class="ix-count" id="ixc" aria-live="polite"></p>
      <div id="ixl"></div>
      <p class="ix-key"><span class="sq l1"><i></i></span> Level 1, easy <span class="sq l2"><i></i></span> Level 2 <span class="sq l3"><i></i></span> Level 3, hard <span class="sq off"><i></i></span> Not expected. The four squares on each bird show its level in ${esc(d.region_names[st.region])} through the year.</p>
    </div>
  </div>`;
  const list = $('#ixl', view);
  const draw = () => {
    const i = d.regions.indexOf(st.region), q = st.q.trim().toLowerCase();
    const rows = d.birds.filter((b) => {
      if (q && !b.n.toLowerCase().includes(q) && !b.sci.toLowerCase().includes(q)) return false;
      if (st.show === 'here') return b.cat === 'assign' && typeof levelOf(b, i, st.season) === 'number';
      if (st.show === 'rare') return b.cat === 'rare' || b.cat === 'scarce';
      if (st.show === 'out') return ['sensitive', 'night', 'offshore'].includes(b.cat);
      return true;
    });
    const groups = [];
    for (const b of rows) { const g = groups[groups.length - 1]; if (g && g.fam === b.fam) g.birds.push(b); else groups.push({ fam: b.fam, birds: [b] }); }
    const what = { here: `on the cards in the ${d.region_names[st.region]} this ${SEASONS[st.season].toLowerCase()}`, rare: 'scarce or rare in California', out: 'native but left out of the cards', all: 'on the state list' }[st.show];
    $('#ixc', view).textContent = `${rows.length} bird${rows.length === 1 ? '' : 's'} ${what}, in ${groups.length} famil${groups.length === 1 ? 'y' : 'ies'}`;
    list.innerHTML = groups.map((g) => `<section class="ix-fam">
      <h2><span>${esc(g.fam)}</span><span class="ct">${g.birds.length}</span></h2>
      <div class="ix-grid">${g.birds.map((b) => `<a class="ixc" href="${birdLink(b)}" data-link>
        ${thumb(b)}
        <span class="ixc-txt"><span class="bn">${esc(b.n)}</span><span class="bs mag-sci">${esc(b.sci)}</span>
        <span class="ixc-foot">${badge(b, i, st.season)}${b.lv ? strip(b, i) : ''}</span></span>
      </a>`).join('')}</div></section>`).join('') || '<p class="mag-deck" style="padding:40px 0">No birds match. Try another region, season or spelling.</p>';
  };
  const press = (sel, key) => $$(sel, view).forEach((b) => (b.onclick = () => {
    st[key] = b.dataset[key === 'show' ? 'show' : key === 'region' ? 'r' : 's'];
    if (key === 'region') setRegion(st.region);
    $$(sel, view).forEach((x) => x.setAttribute('aria-pressed', x === b));
    if (key === 'region') $('.ix-key', view).lastChild.textContent = ` Not expected. The four squares on each bird show its level in ${d.region_names[st.region]} through the year.`;
    draw();
  }));
  press('[data-show]', 'show'); press('[data-r]', 'region'); press('[data-s]', 'season');
  $('#ixq', view).addEventListener('input', (e) => { st.q = e.target.value; draw(); });
  draw();
}
