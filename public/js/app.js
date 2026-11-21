import { S, $, $$, api, loadAll, toast, modal, go, esc } from './util.js';
import { openObservation, syncDrafts, draftCount } from './observe.js';
import { regionName, pickRegion } from './wi.js';

const routes = [
  [/^\/$/, () => import('./views/cover.js'), 'cover'],
  [/^\/gallery\/?$/, () => import('./views/gallery.js'), 'gallery'],
  [/^\/(?:this-season|fieldwork)\/?$/, () => import('./views/fieldwork.js'), 'fieldwork'],
  [/^\/(?:birds|the-index)\/?$/, () => import('./views/theindex.js'), 'index'],
  [/^\/(?:birds|the-index)\/(WI-\d{3})\/?$/, () => import('./views/bird.js'), 'index'],
  [/^\/about\/?$/, () => import('./views/about.js'), 'about'],
  [/^\/wall\/?$/, () => import('./views/wall.js'), 'wall'],
  [/^\/submit\/?$/, () => import('./views/submit.js'), 'submit'],
  [/^\/my-wall\/?$/, () => import('./views/mywall.js'), 'mywall'],
  [/^\/review\/?$/, () => import('./views/review.js'), 'review'],
  [/^\/atlas\/?$/, () => import('./views/atlas.js'), 'atlas'],
  [/^\/archive\/?$/, () => import('./views/archive.js'), 'archive'],
  [/^\/guide\/?$/, () => import('./views/guide.js'), 'guide'],
  [/^\/species\/(\d+)\/?$/, () => import('./views/species.js'), 'guide'],
  [/^\/life-list\/?$/, () => import('./views/lifelist.js'), 'life-list'],
  [/^\/journal\/?$/, () => import('./views/journal.js'), 'journal'],
  [/^\/explore\/?$/, () => import('./views/explore.js'), 'explore'],
  [/^\/settings\/?$/, () => import('./views/settings.js'), ''],
];

const MAG = new Set(['cover', 'gallery', 'fieldwork', 'index', 'about', 'wall', 'submit', 'mywall', 'review']);
let renderSeq = 0;

// Swap in a new page smoothly: build it off-screen, then cross-fade it in.
function swapIn(view, tmp, mag) {
  const apply = () => {
    document.body.classList.toggle('mag', mag);
    view.replaceChildren(tmp);
    if (!location.hash) window.scrollTo(0, 0);
  };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply);
  else { apply(); view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in'); }
}

async function render() {
  const seq = ++renderSeq;
  const path = location.pathname;
  const view = $('#view');
  document.body.classList.remove('menu-open', 'dark');
  renderChrome();
  for (const [re, load, nav] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    $$('.primary a').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    const mag = MAG.has(nav);
    try {
      const mod = await load();
      if (mag) {
        const tmp = document.createElement('div'); tmp.className = 'page';
        await mod.default(tmp, ...m.slice(1));
        if (seq !== renderSeq) return; // a newer click won
        swapIn(view, tmp, true);
      } else {
        document.body.classList.remove('mag');
        await mod.default(view, ...m.slice(1));
        if (!location.hash) window.scrollTo(0, 0);
      }
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="wrap"><p class="empty">This page could not be opened: ${esc(e.message)}</p></div>`;
    }
    return;
  }
  view.innerHTML = `<div class="wrap page-head"><span class="label">Not found</span><h1>No such page</h1><p class="deck">Return to <a href="/" data-link>the cover</a>.</p></div>`;
}

const PUBLIC_NAV = [['/', 'cover', 'Home'], ['/this-season', 'fieldwork', 'This Season'], ['/wall', 'wall', 'Bird Wall'], ['/birds', 'index', 'All Birds'], ['/about', 'about', 'How It Works']];
const TOOLS_NAV = [['/review', 'review', 'Review'], ['/atlas', 'atlas', 'Atlas'], ['/guide', 'guide', 'Field Guide'], ['/life-list', 'life-list', 'Life List'], ['/journal', 'journal', 'Journal'], ['/explore', 'explore', 'Explore'], ['/archive', 'archive', 'Photo archive']];
const TOOL_PATHS = [/^\/review/, /^\/atlas/, /^\/guide/, /^\/species\//, /^\/life-list/, /^\/journal/, /^\/explore/, /^\/archive/, /^\/settings/];
export function renderChrome() {
  const link = ([href, key, label], cls = '') => `<a href="${href}" data-link data-nav="${key}"${cls ? ` class="${cls}"` : ''}>${label}</a>`;
  const onTool = TOOL_PATHS.some((re) => re.test(location.pathname));
  $('#primary-nav').innerHTML = S.owner && onTool
    ? link(PUBLIC_NAV[0]) + '<span class="tools-sep" aria-hidden="true"></span>' + TOOLS_NAV.map((x) => link(x, 'tool')).join('')
    : PUBLIC_NAV.map((x) => link(x)).join('') + (S.owner ? '<span class="tools-sep" aria-hidden="true"></span>' + link(['/review', 'review', 'Tools'], 'tool') : '');
  const n = draftCount();
  $('#utilities').innerHTML = `
    <a href="/submit" data-link class="cta u-send">Send a photo</a>
    <button type="button" id="u-region" class="region-chip" aria-label="Your region: ${regionName()}. Change region"><span class="rl">Region: </span><b>${regionName()}</b></button>
    ${S.owner && onTool ? `<button type="button" class="cta" id="u-add">Add observation</button>${n ? `<button type="button" id="u-drafts">${n} draft${n > 1 ? 's' : ''} waiting</button>` : ''}` : ''}
    ${S.owner ? '<a href="/settings" data-link>Settings</a>' : ''}`;
  $('#u-region').onclick = pickRegion;
  if (S.owner && onTool) { $('#u-add').onclick = () => openObservation(); const d = $('#u-drafts'); if (d) d.onclick = () => syncDrafts(true); }
  $('#quick-entry').hidden = !S.owner;
  const src = S.sources || [];
  $('#colophon').innerHTML = `<span>California Bird Atlas. California's native birds, photographed.</span>
    <span>${S.species.length} species on the official California list. <a href="/about" data-link>About</a> · <a href="/settings#sources" data-link>Sources and data notes</a>${S.owner ? '' : ' · <a href="/settings" data-link>Editor login</a>'}</span>`;
}

export async function refresh() { await loadAll(); renderChrome(); await render(); }

export function signIn() {
  const m = modal(`<span class="label">Owner access</span><h2>Sign in</h2>
    ${S.configured ? '' : '<p class="note">No owner password has been set for this site yet. Add a secret named ADMIN_PASSWORD to the Worker in the Cloudflare dashboard, then return here.</p>'}
    <form><label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn solid" type="submit">Sign in</button></form>`);
  $('form', m.el).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/login', { method: 'POST', body: { password: e.target.password.value } }); m.close(); toast('Signed in.'); await refresh(); syncDrafts(); }
    catch (err) { toast(err.message, true); }
  };
}
export async function signOut() { await api('/logout', { method: 'POST' }); toast('Signed out.'); await refresh(); }

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const url = new URL(a.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.hash) { location.hash = url.hash; return; }
  history.pushState({}, '', url.pathname + url.hash);
  render().then(() => { if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView(); });
});
window.addEventListener('popstate', render);
window.addEventListener('route', render);
window.addEventListener('atlas:changed', refresh);
window.addEventListener('online', () => syncDrafts());
$('#menu-toggle').onclick = () => { const open = document.body.classList.toggle('menu-open'); $('#menu-toggle').setAttribute('aria-expanded', open); };
$('#quick-entry').onclick = () => openObservation();

(async () => {
  try {
    await loadAll(); renderChrome(); await render(); if (S.owner) syncDrafts();
    const warm = () => { import('./wi.js').then((w) => w.wi()); ['cover', 'wall', 'fieldwork', 'theindex', 'bird', 'about', 'submit'].forEach((v) => import(`./views/${v}.js`)); };
    (window.requestIdleCallback || setTimeout)(warm);
  }
  catch (e) { $('#view').innerHTML = `<div class="wrap"><p class="empty">The atlas could not be opened: ${esc(e.message)}</p></div>`; }
})();
