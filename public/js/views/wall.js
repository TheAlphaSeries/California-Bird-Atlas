import { S, $, $$, api, esc, fmtDate } from '../util.js';
import { wi, REGION_NAMES, birdLink } from '../wi.js';
import { heartButton, bindHearts } from '../hearts.js';
import { openFull, onSwipe } from '../viewer.js';

// The Bird Wall: everyone's birds, cut out and set on black. Click a bird for the credits.
export default async function wall(view) {
  let [rows, d] = await Promise.all([api(S.owner ? '/wall?fresh=' + Date.now() : '/wall'), wi()]);
  // Until the first real birds go up, show the built-in sample birds (openly licensed Wikimedia Commons photos).
  const samples = !rows.length;
  if (samples) rows = (await fetch('/data/wall-samples.json').then((r) => r.json()).catch(() => [])).map((x, i) => ({ ...x, id: 'sample-' + i, credit_name: x.credit, cut_w: x.w, cut_h: x.h, sample: 1, static: true }));
  let region = '', q = new URLSearchParams(location.search).get('by') || '', order = 'new';
  let names = false; try { names = localStorage.getItem('wi.wallnames') === '1'; } catch { /* storage off */ }
  const WEEK = 7 * 864e5, fresh = (r) => r.approved_at && Date.now() - Date.parse(r.approved_at) < WEEK;
  view.innerHTML = `<div class="wall-page">
    <header class="mag-wrap wall-head one-line">
      <p class="mag-kicker">Photographed by readers</p>
      <h1 class="ix-title">The Bird Wall</h1>
      <p class="mag-deck">Birds of California, by the people who found them. Every one was photographed in the wild, cut out and put up here. Click a bird to see who took it.</p>
      ${samples && rows.length ? '<p class="wall-sample-note">Sample birds for now: openly licensed photos from Wikimedia Commons, credited to their photographers. They step aside as soon as the first community photos go up.</p>' : ''}
      <p class="wall-ctas">${S.owner ? '<a class="mag-btn solid" href="/add" data-link>Add birds</a>' : '<a class="mag-btn solid" href="/submit" data-link>Send a photo</a>'}<a class="mag-btn" href="/my-wall" data-link>My Wall</a><a class="mag-btn" href="/board" data-link>Scoreboard</a></p>
    </header>
    ${rows.length ? `<div class="ix-bar"><div class="mag-wrap ix-row1">
      <label class="ix-search"><span class="vh">Search</span><input id="wq" type="search" placeholder="Search by bird or photographer" value="${esc(q)}"></label>
      <div class="seg small" role="group" aria-label="Region"><button type="button" data-r="" aria-pressed="true">All regions</button>${Object.entries(REGION_NAMES).map(([k, n]) => `<button type="button" data-r="${k}" aria-pressed="false">${esc(n)}</button>`).join('')}</div>
      <div class="wall-opts"><label><span>Order</span><select id="wo"><option value="new">Newest first</option><option value="family">By family</option><option value="region">By region</option></select></label>
        <button type="button" class="seg-btn" id="wn" aria-pressed="${names}">Show names</button></div>
    </div></div>` : ''}
    <div class="mag-wrap">
      <p class="ix-count" id="wc" aria-live="polite"></p>
      <div class="wall" id="wl"></div>
      ${rows.length ? '' : `<div class="wall-empty"><p class="wall-empty-h">The wall is waiting for its first birds.</p><p class="mag-deck">Photograph a California bird, send it in, and it could be the first one up.</p>${S.owner ? '<a class="mag-btn solid" href="/add" data-link>Add birds</a> <a class="mag-btn" href="/review" data-link>Fill with sample birds</a>' : '<a class="mag-btn solid" href="/submit" data-link>Send a photo</a>'}</div>`}
    </div>
  </div>`;
  if (!rows.length) return;
  const list = $('#wl', view);
  const draw = () => {
    const ql = q.trim().toLowerCase();
    const famOf = (r) => d.byName.get(r.bird)?.fam || '';
    const shown = rows.filter((r) => (!region || r.region === region) && (!ql || r.bird.toLowerCase().includes(ql) || (r.credit_name || '').toLowerCase().includes(ql)))
      .sort(order === 'family' ? (a, b) => famOf(a).localeCompare(famOf(b)) || a.bird.localeCompare(b.bird)
        : order === 'region' ? (a, b) => (REGION_NAMES[a.region] || '').localeCompare(REGION_NAMES[b.region] || '') || a.bird.localeCompare(b.bird)
        : (a, b) => (b.featured - a.featured) || String(b.approved_at || '').localeCompare(String(a.approved_at || '')));
    list.classList.toggle('names', names);
    $('#wc', view).textContent = `${shown.length} bird${shown.length === 1 ? '' : 's'} on the wall${region ? ` from the ${REGION_NAMES[region]}` : ''}`;
    list.innerHTML = shown.map((r, i) => {
      const wide = r.cut_w && r.cut_h && r.cut_w / r.cut_h > 1.35;
      return `<button type="button" class="wb${wide ? ' wide' : ''}${r.featured ? ' big' : ''}" data-i="${rows.indexOf(r)}" style="--d:${(i % 12) * 40}ms">
        <img loading="lazy" src="${r.static ? r.src : `/media/sub/${r.id}/cutout`}" alt="" width="${r.cut_w || ''}" height="${r.cut_h || ''}">
        ${fresh(r) ? '<span class="wb-new">New</span>' : ''}<span class="wb-cap"><span class="nm">${esc(r.bird)}</span><span class="rg">${esc(REGION_NAMES[r.region] || '')}</span><span class="by">Photo <span aria-hidden="true">●</span> ${esc(r.credit_name)}</span></span>${r.hearts ? `<span class="wb-h"><span aria-hidden="true">♥</span> ${r.hearts}<span class="vh"> heart${r.hearts === 1 ? '' : 's'}</span></span>` : ''}
      </button>`;
    }).join('') || '<p class="mag-deck">No birds match.</p>';
    $$('.wb', list).forEach((b) => (b.onclick = () => openBird(rows[+b.dataset.i], d, { list: shown, all: rows })));
  };
  $('#wq', view).addEventListener('input', (e) => { q = e.target.value; draw(); });
  $('#wo', view).onchange = (e) => { order = e.target.value; draw(); };
  $('#wn', view).onclick = (e) => { names = !names; e.currentTarget.setAttribute('aria-pressed', names); try { localStorage.setItem('wi.wallnames', names ? '1' : '0'); } catch { /* storage off */ } draw(); };
  $$('[data-r]', view).forEach((b) => (b.onclick = () => { region = b.dataset.r; $$('[data-r]', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
  draw();
}

// The credits panel for one wall photo. `list` is the set of photos it was opened from (arrow keys and swipes
// step through it); `all` is every photo on the wall, for the photographer card (fetched if not given).
export async function openBird(r, d, { list = null, all = null } = {}) {
  if (!all) all = list && list.length > 1 ? list : await api('/wall').catch(() => []);
  const back = document.activeElement;
  const el = document.createElement('div'); el.className = 'modal mag-modal wall-modal';
  document.body.appendChild(el);
  let cur = r;
  const src = (x, v = 'cutout') => (x.static ? x.src : `/media/sub/${x.id}/${v}`);
  const step = (k) => { if (!list || list.length < 2) return; const i = list.indexOf(cur); render(list[(i + k + list.length) % list.length]); };
  function card(x) { // the photographer: a short card, not a page
    if (x.static) return '';
    const theirs = all.filter((y) => !y.static && y.credit_name === x.credit_name);
    if (!theirs.length) return '';
    const species = new Set(theirs.map((y) => y.bird)).size;
    const regions = [...new Set(theirs.map((y) => REGION_NAMES[y.region]).filter(Boolean))];
    const since = theirs.map((y) => y.approved_at).filter(Boolean).sort()[0];
    const hearts = theirs.reduce((n, y) => n + (y.hearts || 0), 0);
    const others = theirs.filter((y) => y !== x).slice(0, 6);
    return `<section class="wm-who" aria-label="About the photographer">
      <p class="wm-who-name"><b>${esc(x.credit_name)}</b>${since ? ` <span>on the wall since ${new Date(since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>` : ''}</p>
      <p class="wm-who-stats"><span><b>${theirs.length}</b> photo${theirs.length === 1 ? '' : 's'}</span><span><b>${species}</b> species</span><span><b>${hearts}</b> heart${hearts === 1 ? '' : 's'}</span>${regions.length ? `<span>${esc(regions.join(', '))}</span>` : ''}</p>
      ${others.length ? `<div class="wm-who-shots">${others.map((y) => `<button type="button" data-who="${y.id}" aria-label="${esc(y.bird)} by ${esc(y.credit_name)}"><img loading="lazy" src="${src(y)}" alt=""></button>`).join('')}</div>` : ''}
      ${theirs.length > 1 ? `<a class="linkish" href="/wall?by=${encodeURIComponent(x.credit_name)}" data-link>All ${theirs.length} on the wall</a>` : ''}
    </section>`;
  }
  function render(x) {
    cur = x;
    const b = d.byName.get(x.bird);
    const pos = list && list.length > 1 ? list.indexOf(x) : -1;
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(x.bird)}">
    <button class="x" type="button">Close</button>
    <div class="wm-grid">
      <div class="wm-art"><img id="wm-img" src="${src(x)}" alt="${esc(x.bird)}">
        ${pos >= 0 ? `<div class="wm-step"><button type="button" data-step="-1" aria-label="Previous photo">←</button><span>${pos + 1} / ${list.length}</span><button type="button" data-step="1" aria-label="Next photo">→</button></div>` : ''}</div>
      <div class="wm-info">
        <p class="mag-kicker">${x.award ? esc(x.award) : 'On the wall'}</p>
        <h2>${esc(x.bird)}</h2>
        <p class="mag-sci" style="margin:0 0 16px">${esc(x.sci || '')}</p>
        <p class="wm-acts">${heartButton(x)}<button type="button" class="mag-btn" id="wm-full">Full screen</button></p>
        <dl>
          <dt>Photograph</dt><dd>${esc(x.credit_name)}</dd>
          ${x.license ? `<dt>Licence</dt><dd>${x.license_url ? `<a class="linkish" href="${esc(x.license_url)}" target="_blank" rel="noopener">${esc(x.license)}</a>` : esc(x.license)}</dd>` : ''}
          ${x.region ? `<dt>Region</dt><dd>${esc(REGION_NAMES[x.region] || x.region)}</dd>` : ''}
          ${x.taken_at ? `<dt>Taken</dt><dd>${esc(fmtDate(x.taken_at))}</dd>` : ''}
          ${x.camera ? `<dt>Camera</dt><dd>${esc(x.camera)}</dd>` : ''}
        </dl>
        ${x.caption ? `<p class="wm-story"><b>Behind the shot.</b> ${esc(x.caption)}</p>` : ''}
        ${card(x)}
        <p class="wm-links">${x.static ? `<a class="linkish" href="${esc(x.source_url)}" target="_blank" rel="noopener">See the original</a>` : '<button type="button" class="linkish" id="wm-swap">See the full photo</button>'}${b ? ` · <a class="linkish" href="${birdLink(b)}" data-link>About this bird</a>` : ''}</p>
        ${x.sample ? `<p class="wm-note">Sample photo from <a class="linkish" href="${esc(x.source_url)}" target="_blank" rel="noopener">Wikimedia Commons</a>, cut out by California Bird Atlas. Shown under its licence until community photos fill the wall.</p>` : `<p class="wm-note">© ${esc(x.credit_name)}. Shown with permission. Please don't reuse without asking.</p>`}
      </div>
    </div></div>`;
    el.querySelector('.x').onclick = close;
    el.querySelectorAll('a[data-link]').forEach((a) => a.addEventListener('click', close));
    el.querySelectorAll('[data-step]').forEach((bt) => (bt.onclick = () => step(+bt.dataset.step)));
    el.querySelectorAll('[data-who]').forEach((bt) => (bt.onclick = () => render(all.find((y) => y.id === +bt.dataset.who))));
    let full = false;
    const swap = el.querySelector('#wm-swap');
    if (swap) swap.onclick = () => { full = !full; el.querySelector('#wm-img').src = src(x, full ? 'display' : 'cutout'); swap.textContent = full ? 'See the cut-out' : 'See the full photo'; };
    el.querySelector('#wm-full').onclick = () => openFull(x.static ? x.src : src(x, 'display'), x.bird);
    bindHearts(el, all);
    el.querySelector('.x').focus();
  }
  const close = () => { el.remove(); document.removeEventListener('keydown', key); back?.focus?.(); };
  const key = (e) => {
    if (document.querySelector('.fullview')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') { // keep keyboard focus inside the panel
      const f = [...el.querySelectorAll('button, a[href], input, select')].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', key);
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  onSwipe(el, { left: () => step(1), right: () => step(-1) });
  render(r);
}
