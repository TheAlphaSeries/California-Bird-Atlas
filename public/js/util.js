// Shared state and helpers
export const S = { owner: false, species: [], families: [], fields: [], views: [], settings: {}, sources: [], totals: {} };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['content-type'] = 'application/json'; }
  const res = await fetch('/api' + path, init);
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok && !(opts.allow || []).includes(res.status)) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

export async function loadAll() {
  const d = await api('/bootstrap');
  Object.assign(S, d);
  S.famById = new Map(S.families.map((f) => [f.id, f]));
  S.spById = new Map(S.species.map((s) => [s.id, s]));
  S.spByName = new Map(S.species.map((s) => [s.common_name, s])); // joins a field-guide bird (wildindex.json) to its database record
  try { S.goal = JSON.parse(S.settings.goal || 'null') || DEFAULT_GOAL; } catch { S.goal = DEFAULT_GOAL; }
  return S;
}
export const DEFAULT_GOAL = { 'Native resident': true, 'Native migrant': true, 'Rare natural visitor': false, 'Introduced': false, 'Extirpated': false };
export const NATIVE = ['Native resident', 'Native migrant', 'Rare natural visitor', 'Introduced', 'Extirpated'];
export const SEASON = ['Year-round resident', 'Summer breeding visitor', 'Winter visitor', 'Migrant', 'Pelagic visitor', 'Rare visitor'];
export const STATUS = { photographed: 'Photographed', observed: 'Observed, not photographed', pending: 'Identification pending', none: 'Not yet observed' };
export const PRIORITY = ['', 'High', 'Medium', 'Low'];
export const inGoal = (sp) => !!S.goal[sp.native_status];
export const goalSpecies = () => S.species.filter(inGoal);

let toastTimer;
export function toast(msg, isErr) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), isErr ? 6000 : 3200);
}
export const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso); return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };
export const fmtLong = (iso) => { if (!iso) return ''; const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso); return isNaN(d) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); };
export const pad3 = (n) => String(Math.round(n)).padStart(3, '0');

const MONTHS = { 'Year-round resident': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'Winter visitor': [10, 11, 12, 1, 2, 3], 'Summer breeding visitor': [4, 5, 6, 7, 8], 'Migrant': [4, 5, 8, 9, 10], 'Pelagic visitor': [5, 8, 9, 10], 'Rare visitor': [] };
export const monthsFor = (season) => MONTHS[season] || [];

// A species' picture: my own photograph first, then a credited reference image, else none.
export function picture(sp, size = 'thumb') {
  if (sp.photo_id) return { src: `/media/${sp.photo_id}/${size}`, kind: 'mine' };
  if (sp.ref_url) return { src: size === 'thumb' ? (sp.ref_thumb || sp.ref_url) : sp.ref_url, kind: 'ref' };
  return null;
}
export function plate(sp, { status = true, tag = '' } = {}) {
  const pic = picture(sp);
  const fig = pic
    ? `<img loading="lazy" src="${esc(pic.src)}" alt="${esc(sp.common_name)}${pic.kind === 'ref' ? ' (reference photograph)' : ''}"><span class="tag ${pic.kind === 'mine' ? 'mine' : ''}">${pic.kind === 'mine' ? 'My photograph' : 'Reference'}</span>`
    : `<span class="blank"><span class="no">No. ${pad3(sp.seq)}</span><span class="nm">${esc(sp.scientific_name)}</span></span>`;
  return `<a class="plate" href="/species/${sp.id}" data-link>
    <span class="fig">${fig}</span>
    ${tag ? `<span class="label ochre" style="display:block;margin-top:10px">${esc(tag)}</span>` : ''}
    <span class="cn" style="display:block">${esc(sp.common_name)}</span>
    <span class="sn">${esc(sp.scientific_name)}</span>
    ${status ? `<span class="mono st" style="display:block"><span class="dot ${sp.status}"></span>${esc(sp.season_status || '')}</span>` : ''}
  </a>`;
}

export function go(path) { history.pushState({}, '', path); window.dispatchEvent(new Event('route')); }

// Keep Tab and Shift+Tab inside a dialog (Apple and Google both ask that focus stay in a modal until it closes).
export function trapFocus(el, e) {
  if (e.key !== 'Tab') return;
  const f = [...el.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter((n) => !n.disabled && n.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}
export function modal(html, { wide = false } = {}) {
  const back = document.activeElement;
  const root = $('#modal-root');
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" ${wide ? 'style="width:min(900px,100%)"' : ''}><button class="x" type="button">Close</button>${html}</div>`;
  root.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); back?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); else trapFocus(el, e); };
  document.addEventListener('keydown', onKey);
  $('.x', el).onclick = close;
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  const first = $('input, select, textarea, button:not(.x)', el); if (first) first.focus();
  return { el, close };
}
export function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
export const COUNTIES = 'Alameda,Alpine,Amador,Butte,Calaveras,Colusa,Contra Costa,Del Norte,El Dorado,Fresno,Glenn,Humboldt,Imperial,Inyo,Kern,Kings,Lake,Lassen,Los Angeles,Madera,Marin,Mariposa,Mendocino,Merced,Modoc,Mono,Monterey,Napa,Nevada,Orange,Placer,Plumas,Riverside,Sacramento,San Benito,San Bernardino,San Diego,San Francisco,San Joaquin,San Luis Obispo,San Mateo,Santa Barbara,Santa Clara,Santa Cruz,Shasta,Sierra,Siskiyou,Solano,Sonoma,Stanislaus,Sutter,Tehama,Trinity,Tulare,Tuolumne,Ventura,Yolo,Yuba'.split(',');
