// The page shell: routing, the menu bar and the footer. No framework and no build step.
//
// - `routes` maps a URL to a view module in ./views. A view is `export default async function (el, ...urlParts)`
//   that fills `el` with its page.
// - Magazine pages (MAG) are built off-screen and swapped in, so there is never a half-drawn page. PAPER lists
//   which of them are white reading pages; the rest are black.
// - S (from util.js) is the shared state loaded once from /api/bootstrap: species, families, settings, owner.
// - To add a page: write views/<name>.js, add a line to `routes`, add its nav key to MAG (and PAPER if white),
//   and add it to PUBLIC_NAV if it belongs in the menu.
import { S, $, $$, api, loadAll, toast, modal, esc } from './util.js';
import { loadIssues, currentIssue, stateLine } from './issues.js';
let ISSUES = []; // loaded once at start for the strip above the menu
import { openObservation, syncDrafts, draftCount } from './observe.js';
import { regionName, pickRegion } from './wi.js';
import { initI18n, translate, langPicker, bindLangPicker } from './i18n.js';

const routes = [
  [/^\/$/, () => import('./views/cover.js'), 'cover'],
  [/^\/gallery\/?$/, () => import('./views/gallery.js'), 'gallery'],
  [/^\/(?:this-season|fieldwork)\/?$/, () => import('./views/fieldwork.js'), 'fieldwork'],
  [/^\/(?:birds|the-index)\/?$/, () => import('./views/theindex.js'), 'index'],
  [/^\/(?:birds|the-index)\/(WI-\d{3})\/?$/, () => import('./views/bird.js'), 'index'],
  [/^\/about\/?$/, () => import('./views/about.js'), 'about'],
  [/^\/wall\/?$/, () => import('./views/wall.js'), 'wall'],
  [/^\/submit\/?$/, () => import('./views/submit.js'), 'submit'],
  [/^\/add\/?$/, () => import('./views/addbirds.js'), 'add'],
  [/^\/issues\/?$/, () => import('./views/issue.js'), 'issue'],
  [/^\/issues\/(\d+)\/?$/, () => import('./views/issue.js'), 'issue'],
  [/^\/board\/?$/, () => import('./views/board.js'), 'board'],
  [/^\/field-card\/?$/, () => import('./views/fieldcard.js'), 'fieldcard'],
  [/^\/sent\/?$/, () => import('./views/sent.js'), 'sent'],
  [/^\/unsubscribe\/?$/, () => import('./views/unsubscribe.js'), 'unsubscribe'],
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

const MAG = new Set(['cover', 'gallery', 'fieldwork', 'index', 'about', 'wall', 'submit', 'add', 'mywall', 'review', 'issue', 'board', 'unsubscribe', 'fieldcard', 'sent']);
let renderSeq = 0;

// Every page uses the magazine shell. Photo pages are black; everything else is printed on white paper.
const BLACK = new Set(['cover', 'wall', 'mywall']);
// The sideways section label in the left margin, one per section.
const MARGIN_LABEL = { fieldwork: 'This season', wall: 'Bird Wall', index: 'Field guide', about: 'How it works', submit: 'Send a photo', add: 'Add birds', mywall: 'My Wall', review: 'Editor', gallery: 'Photographs', issue: 'The issue', board: 'Scoreboard' };

// Put a finished page on screen. The page is built off-screen first, so the old page stays whole until this
// moment; then the menu, the page colours and the content all change together and the new page fades in.
// (No cross-fade: blending two pages made the old one ghost through the new one.)
function commit(view, page, nav) {
  renderChrome();
  $$('.primary a').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  const b = document.body.classList;
  b.add('mag'); b.remove('dark');
  document.body.dataset.page = nav; // lets the stylesheet treat one page differently (the cover's big footer)
  if (nav === 'issue') $$('.primary a').forEach((a) => a.classList.toggle('active', a.dataset.nav === 'fieldwork')); // the issue lives under This Season
  b.toggle('paper', !BLACK.has(nav));
  b.toggle('tool', !MAG.has(nav)); // the editor's tool pages: atlas.css components, restyled to match
  const t = document.getElementById('tategaki'); if (t) { t.textContent = MARGIN_LABEL[nav] || ''; t.hidden = !t.textContent; }
  translate(page); // interface text into the reader's language (no-op in English)
  view.replaceChildren(page);
  if (!location.hash) window.scrollTo(0, 0);
  view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in');
}

async function render() {
  const seq = ++renderSeq;
  const path = location.pathname;
  const view = $('#view');
  document.body.classList.remove('menu-open');
  const page = document.createElement('div'); page.className = 'page';
  for (const [re, load, nav] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    try {
      const mod = await load();
      await mod.default(page, ...m.slice(1));
    } catch (e) {
      console.error(e);
      page.innerHTML = `<div class="mag-wrap mag-page"><p class="mag-deck">This page could not be opened: ${esc(e.message)}</p></div>`;
    }
    if (seq !== renderSeq) return; // a newer click won
    commit(view, page, nav);
    return;
  }
  page.innerHTML = `<div class="mag-wrap mag-page"><p class="mag-kicker">Not found</p><h1 class="mag-h">No such page</h1><p class="mag-deck">Return to <a class="linkish" href="/" data-link>the cover</a>.</p></div>`;
  commit(view, page, '');
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
    ${S.owner ? '<a href="/add" data-link class="cta u-send">Add birds</a>' : '<a href="/submit" data-link class="cta u-send">Send a photo</a>'}
    <button type="button" id="u-search" class="u-search" aria-label="Search birds and photographers">Search</button>
    <button type="button" id="u-region" class="region-chip" aria-label="Your region: ${regionName()}. Change region"><span class="rl">Region: </span><b>${regionName()}</b></button>
    ${S.owner && onTool ? `<button type="button" class="cta" id="u-add">Add observation</button>${n ? `<button type="button" id="u-drafts">${n} draft${n > 1 ? 's' : ''} waiting</button>` : ''}` : ''}
    ${S.owner ? '<a href="/settings" data-link>Settings</a>' : ''}`;
  let cv = {}; try { cv = JSON.parse(S.settings?.cover || '{}'); } catch { cv = {}; }
  const iss = currentIssue(ISSUES);
  $('#strip').innerHTML = iss
    ? `<span><b>No. ${iss.number}</b> ${esc(iss.title)}</span><a href="/issues" data-link>${esc(iss.theme)}: ${esc(stateLine(iss).long.split('. ')[0])}.</a>`
    : `<span><b>${esc(cv.issue || 'No. 1')}</b> ${esc(cv.season || 'Winter 2026–27')}</span><span>Free to read. Made from readers' photographs.</span>`;
  $('#strip').insertAdjacentHTML('beforeend', langPicker()); bindLangPicker();
  $('#u-region').onclick = pickRegion;
  $('#u-search').onclick = () => import('./search.js').then((m) => m.openSearch());
  if (S.owner && onTool) { $('#u-add').onclick = () => openObservation(); const d = $('#u-drafts'); if (d) d.onclick = () => syncDrafts(true); }
  $('#quick-entry').hidden = !S.owner;
  const src = S.sources || [];
  $('#colophon').innerHTML = `<span>California Bird Atlas. California's native birds, photographed.</span>
    <span>${S.species.length} species on the official California list. <a href="/about" data-link>About</a> · <a href="/settings#sources" data-link>Sources and data notes</a>${S.owner ? '' : ' · <a href="/settings" data-link>Editor login</a>'}</span>`;
  ['#primary-nav', '#utilities', '#strip', '#colophon', '.masthead'].forEach((q) => translate(document.querySelector(q)));
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
    await initI18n(); await loadAll(); loadIssues().then((x) => { ISSUES = x; renderChrome(); }).catch(() => {}); await render(); if (S.owner) syncDrafts();
    const warm = () => { import('./wi.js').then((w) => w.wi()); ['cover', 'wall', 'fieldwork', 'theindex', 'bird', 'about', 'submit'].forEach((v) => import(`./views/${v}.js`)); };
    (window.requestIdleCallback || setTimeout)(warm);
    // Offline support (public/sw.js). Not on localhost, where it would only get in the way of development.
    if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  catch (e) { $('#view').innerHTML = `<div class="wrap"><p class="empty">The atlas could not be opened: ${esc(e.message)}</p></div>`; }
})();
