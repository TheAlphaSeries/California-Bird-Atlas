import { $, $$, S, esc } from '../util.js';
import { birdPic } from '../refphoto.js';
import { wi, SEASONS, SEASON_ORDER, CATEGORY, BUILT_IN, currentSeason, myRegion, pickRegion, birdLink, levelOf } from '../wi.js';

let st = null;
const SHOW = [['here', 'Findable here now'], ['rare', 'Rare finds'], ['out', 'Off-limits'], ['all', 'All birds']];
const SHORT = { W: 'Win', P: 'Spr', S: 'Sum', F: 'Fall' };

function thumb(b) {
  const pic = birdPic(b, 'thumb');
  return pic
    ? `<span class="ixc-img${pic.kind === 'ref' ? ' ref' : ''}"><img loading="lazy" src="${esc(pic.src)}" alt="">${pic.kind === 'ref' ? '<span class="ref-tag">Reference</span>' : ''}</span>`
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
  if (!st) st = { q: '', season: currentSeason(), show: 'here' };
  st.region = myRegion(d);
  const n = (c) => d.birds.filter((b) => c.includes(b.cat)).length;
  view.innerHTML = `<div class="ix">
    <header class="mag-wrap ix-head">
      <p class="mag-kicker">All birds</p>
      <h1 class="ix-title">Every bird<br>in California</h1>
      <p class="mag-deck">All ${d.birds.length} species on the official state list. Search for a bird, or see which ones you can find in your region this season and how hard each one is.</p>
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
        <p class="ix-where">Levels for the <b>${esc(d.region_names[st.region])}</b> <button type="button" class="linkish" id="ixreg">Change region</button></p>
        <div class="seg small" role="group" aria-label="Season">${SEASON_ORDER.map((s) => `<button type="button" data-s="${s}" aria-pressed="${st.season === s}">${SEASONS[s]}</button>`).join('')}</div>
      </div>
    </div></div>
    <div class="mag-wrap ix-body">
      <p class="ix-count" id="ixc" aria-live="polite"></p>
      <p class="ix-legend"><b>How to read a card.</b> The badge is how hard the bird is to find in your region this season: <span class="ixc-badge l1">Level 1</span> easy, <span class="ixc-badge l2">Level 2</span> takes a trip, <span class="ixc-badge l3">Level 3</span> hard. The four bars show the same thing for <span class="sq l1"><i></i></span> winter, spring, summer and fall, so you can see when to look.</p>
      <div id="ixl"></div>

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
    const what = { here: `you can find in the ${d.region_names[st.region]} this ${SEASONS[st.season].toLowerCase()}`, rare: 'scarce or rare in California', out: 'that are never assigned, to protect them or because they need a boat', all: 'on the state list' }[st.show];
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
    $$(sel, view).forEach((x) => x.setAttribute('aria-pressed', x === b));
    draw();
  }));
  press('[data-show]', 'show'); press('[data-s]', 'season');
  $('#ixreg', view).onclick = pickRegion;
  $('#ixq', view).addEventListener('input', (e) => { st.q = e.target.value; draw(); });
  draw();
}
