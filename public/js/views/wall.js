import { S, $, $$, api, esc, fmtDate } from '../util.js';
import { wi, REGION_NAMES, birdLink } from '../wi.js';

// The Bird Wall: everyone's birds, cut out and set on black. Click a bird for the credits.
export default async function wall(view) {
  document.body.classList.add('mag');
  const [rows, d] = await Promise.all([api(S.owner ? '/wall?fresh=' + Date.now() : '/wall'), wi()]);
  let region = '', q = '';
  view.innerHTML = `<div class="wall-page">
    <header class="mag-wrap wall-head">
      <p class="mag-kicker">The Bird Wall</p>
      <h1 class="ix-title">Birds of California,<br>by the people who found them</h1>
      <p class="mag-deck">Every bird here was photographed in the wild by a member of the community, then cut out and added to the wall. Click any bird to see who took it.</p>
      <p class="wall-ctas"><a class="mag-btn solid" href="/submit" data-link>Send a photo</a><a class="mag-btn" href="/my-wall" data-link>My Wall</a></p>
    </header>
    ${rows.length ? `<div class="ix-bar"><div class="mag-wrap ix-row1">
      <label class="ix-search"><span class="vh">Search</span><input id="wq" type="search" placeholder="Search by bird or photographer"></label>
      <div class="seg small" role="group" aria-label="Region"><button type="button" data-r="" aria-pressed="true">All regions</button>${Object.entries(REGION_NAMES).map(([k, n]) => `<button type="button" data-r="${k}" aria-pressed="false">${esc(n)}</button>`).join('')}</div>
    </div></div>` : ''}
    <div class="mag-wrap">
      <p class="ix-count" id="wc" aria-live="polite"></p>
      <div class="wall" id="wl"></div>
      ${rows.length ? '' : `<div class="wall-empty"><p class="wall-empty-h">The wall is waiting for its first birds.</p><p class="mag-deck">Photograph a California bird, send it in, and it could be the first one up.</p><a class="mag-btn solid" href="/submit" data-link>Send a photo</a></div>`}
    </div>
  </div>`;
  if (!rows.length) return;
  const list = $('#wl', view);
  const draw = () => {
    const ql = q.trim().toLowerCase();
    const shown = rows.filter((r) => (!region || r.region === region) && (!ql || r.bird.toLowerCase().includes(ql) || (r.credit_name || '').toLowerCase().includes(ql)));
    $('#wc', view).textContent = `${shown.length} bird${shown.length === 1 ? '' : 's'} on the wall${region ? ` from the ${REGION_NAMES[region]}` : ''}`;
    list.innerHTML = shown.map((r, i) => {
      const wide = r.cut_w && r.cut_h && r.cut_w / r.cut_h > 1.35;
      return `<button type="button" class="wb${wide ? ' wide' : ''}${r.featured ? ' big' : ''}" data-i="${rows.indexOf(r)}" style="--d:${(i % 12) * 40}ms" aria-label="${esc(r.bird)}, photographed by ${esc(r.credit_name)}">
        <img loading="lazy" src="/media/sub/${r.id}/cutout" alt="" width="${r.cut_w || ''}" height="${r.cut_h || ''}">
        <span class="wb-cap"><span class="nm">${esc(r.bird)}</span><span class="by">${esc(r.credit_name)}</span></span>
      </button>`;
    }).join('') || '<p class="mag-deck">No birds match.</p>';
    $$('.wb', list).forEach((b) => (b.onclick = () => openBird(rows[+b.dataset.i], d)));
  };
  $('#wq', view).addEventListener('input', (e) => { q = e.target.value; draw(); });
  $$('[data-r]', view).forEach((b) => (b.onclick = () => { region = b.dataset.r; $$('[data-r]', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
  draw();
}

export function openBird(r, d) {
  const b = d.byName.get(r.bird);
  const el = document.createElement('div'); el.className = 'modal mag-modal wall-modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(r.bird)}">
    <button class="x" type="button">Close</button>
    <div class="wm-grid">
      <div class="wm-art"><img id="wm-img" src="/media/sub/${r.id}/cutout" alt="${esc(r.bird)}"></div>
      <div class="wm-info">
        <p class="mag-kicker">On the wall</p>
        <h2>${esc(r.bird)}</h2>
        <p class="mag-sci" style="margin:0 0 20px">${esc(r.sci || '')}</p>
        <dl>
          <dt>Photograph</dt><dd>${esc(r.credit_name)}</dd>
          ${r.license ? `<dt>Licence</dt><dd>${r.license_url ? `<a class="linkish" href="${esc(r.license_url)}" target="_blank" rel="noopener">${esc(r.license)}</a>` : esc(r.license)}</dd>` : ''}
          ${r.region ? `<dt>Region</dt><dd>${esc(REGION_NAMES[r.region] || r.region)}</dd>` : ''}
          ${r.taken_at ? `<dt>Taken</dt><dd>${esc(fmtDate(r.taken_at))}</dd>` : ''}
          ${r.camera ? `<dt>Camera</dt><dd>${esc(r.camera)}</dd>` : ''}
        </dl>
        <p class="wm-links"><button type="button" class="linkish" id="wm-full">See the full photo</button>${b ? ` · <a class="linkish" href="${birdLink(b)}" data-link>About this bird</a>` : ''}</p>
        ${r.sample ? `<p class="wm-note">Sample photo from <a class="linkish" href="${esc(r.source_url)}" target="_blank" rel="noopener">Wikimedia Commons</a>, cut out by California Bird Atlas. Shown under its licence until community photos fill the wall.</p>` : `<p class="wm-note">© ${esc(r.credit_name)}. Shown with permission. Please don't reuse without asking.</p>`}
      </div>
    </div></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  el.querySelector('.x').onclick = close;
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  el.querySelectorAll('a[data-link]').forEach((a) => a.addEventListener('click', close));
  let full = false;
  el.querySelector('#wm-full').onclick = (e) => { full = !full; el.querySelector('#wm-img').src = `/media/sub/${r.id}/${full ? 'display' : 'cutout'}`; e.target.textContent = full ? 'See the cut-out' : 'See the full photo'; };
  el.querySelector('.x').focus();
}
