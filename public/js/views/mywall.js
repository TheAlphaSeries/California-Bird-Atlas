import { $, $$, esc, toast, go, download, fmtDate } from '../util.js';
import { wi, birdLink } from '../wi.js';
import { openClipper, warmClipper } from '../clip.js';

// My Wall: a private bird wall kept only in this browser (IndexedDB). Nothing here is uploaded.
const DB = 'wi-mywall', STORE = 'birds';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('This browser is not letting the site save anything.'));
  });
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out.result ?? out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Not saved. The browser may be out of space.'));
  });
}
export const allMyBirds = () => tx('readonly', (s) => s.getAll());
export const getMyBird = (id) => tx('readonly', (s) => s.get(id));
export const addToMyWall = (rec) => tx('readwrite', (s) => s.add({ created: new Date().toISOString(), cutout: null, ...rec }));
const putMyBird = (rec) => tx('readwrite', (s) => s.put(rec));
const delMyBird = (id) => tx('readwrite', (s) => s.delete(id));

export default async function myWall(view) {
  document.body.classList.add('mag');
  const d = await wi();
  let rows = [];
  try { rows = (await allMyBirds()).sort((a, b) => b.created.localeCompare(a.created)); }
  catch (e) { view.innerHTML = `<div class="mag-wrap mag-page"><h1 class="mag-h">My Wall</h1><p class="mag-deck">${esc(e.message)} My Wall needs the browser to allow site storage (private browsing often blocks it).</p></div>`; return; }
  const urls = [];
  const url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
  view.innerHTML = `<div class="wall-page">
    <header class="mag-wrap wall-head">
      <p class="mag-kicker">My Wall · Private</p>
      <h1 class="ix-title">Your own bird wall</h1>
      <p class="mag-deck">A wall just for you. Photos you add here stay in this browser on this device. Nothing is uploaded unless you choose to send a bird to the public wall.</p>
      <p class="wall-ctas"><label class="mag-btn solid" for="mw-file">Add a bird</label><input type="file" id="mw-file" accept="image/jpeg,image/png,image/webp" class="vh"><a class="mag-btn" href="/wall" data-link>The public Bird Wall</a></p>
      <p class="sub-privacy">Clearing your browser's site data deletes My Wall. Download the birds you want to keep.</p>
    </header>
    <div class="mag-wrap"><p class="ix-count">${rows.length} bird${rows.length === 1 ? '' : 's'}, ${new Set(rows.map((r) => r.bird)).size} species</p>
      <div class="wall" id="mwl">${rows.map((r, i) => `<button type="button" class="wb" data-i="${i}" aria-label="${esc(r.bird)}">
        <img src="${url(r.cutout || r.photo)}" alt="" class="${r.cutout ? '' : 'uncut'}">
        <span class="wb-cap"><span class="nm">${esc(r.bird)}</span><span class="by">${r.cutout ? (r.taken_at ? esc(fmtDate(r.taken_at)) : '') : 'Not cut out yet'}</span></span></button>`).join('')}</div>
      ${rows.length ? '' : '<div class="wall-empty"><p class="wall-empty-h">Nothing here yet.</p><p class="mag-deck">Add a bird photo. The background is removed right here in your browser, and the bird goes on your wall.</p></div>'}
    </div></div>`;
  warmClipper();
  $('#mw-file', view).onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const name = await askBird(d);
    if (!name) return;
    const cut = await openClipper(f, { title: `Cut out your ${name.n}` });
    try {
      await addToMyWall({ bird: name.n, sci: name.sci, photo: f, cutout: cut?.blob || null, w: cut?.width, h: cut?.height });
      toast(`${name.n} added to My Wall.`); window.dispatchEvent(new Event('route'));
    } catch (err) { toast(err.message, true); }
  };
  $$('#mwl .wb', view).forEach((b) => (b.onclick = () => openMine(rows[+b.dataset.i], d)));
  window.addEventListener('route', () => urls.forEach((u) => URL.revokeObjectURL(u)), { once: true });
}

function askBird(d) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'modal mag-modal';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Which bird?"><button class="x" type="button">Cancel</button>
      <p class="mag-kicker">My Wall</p><h2>Which bird is it?</h2>
      <form><label class="f"><span>Bird</span><input name="bird" list="mw-names" autocomplete="off" required placeholder="Start typing, e.g. Western Bluebird">
      <datalist id="mw-names">${d.birds.map((b) => `<option value="${esc(b.n)}"></option>`).join('')}</datalist></label>
      <p style="margin-top:18px"><button class="mag-btn solid" type="submit">Next: cut it out</button></p></form></div>`;
    document.body.appendChild(el);
    const done = (v) => { el.remove(); resolve(v); };
    el.querySelector('.x').onclick = () => done(null);
    const input = el.querySelector('input'); input.focus();
    el.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const v = input.value.trim().toLowerCase();
      const b = d.birds.find((x) => x.n.toLowerCase() === v);
      if (!b) { toast('Pick the bird from the list.', true); return; }
      done(b);
    };
  });
}

function openMine(r, d) {
  const b = d.byName.get(r.bird);
  const el = document.createElement('div'); el.className = 'modal mag-modal wall-modal';
  const src = URL.createObjectURL(r.cutout || r.photo);
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(r.bird)}"><button class="x" type="button">Close</button>
    <div class="wm-grid"><div class="wm-art"><img src="${src}" alt="${esc(r.bird)}"></div>
    <div class="wm-info"><p class="mag-kicker">My Wall · Private</p><h2>${esc(r.bird)}</h2><p class="mag-sci" style="margin:0 0 20px">${esc(r.sci || '')}</p>
      <div class="wm-actions">
        <button type="button" class="mag-btn" id="m-cut">${r.cutout ? 'Cut out again' : 'Cut it out'}</button>
        <button type="button" class="mag-btn solid" id="m-send">Send to the Bird Wall</button>
        ${r.cutout ? '<button type="button" class="mag-btn" id="m-dl">Download cut-out</button>' : ''}
        <button type="button" class="mag-btn" id="m-del">Remove</button>
      </div>
      ${b ? `<p class="wm-links"><a class="linkish" href="${birdLink(b)}" data-link>About this bird</a></p>` : ''}
    </div></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); URL.revokeObjectURL(src); };
  el.querySelector('.x').onclick = close;
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  el.querySelectorAll('a[data-link]').forEach((a) => a.addEventListener('click', close));
  el.querySelector('#m-cut').onclick = async () => {
    close();
    const cut = await openClipper(r.photo, { title: `Cut out your ${r.bird}` });
    if (!cut) return;
    await putMyBird({ ...r, cutout: cut.blob, w: cut.width, h: cut.height });
    window.dispatchEvent(new Event('route'));
  };
  el.querySelector('#m-send').onclick = () => { sessionStorage.setItem('wi.submit', JSON.stringify({ bird: r.bird, blobKey: r.id })); close(); go('/submit'); };
  const dl = el.querySelector('#m-dl'); if (dl) dl.onclick = () => download(`${r.bird.replace(/[^\w]+/g, '-').toLowerCase()}.png`, r.cutout);
  el.querySelector('#m-del').onclick = async () => {
    if (!confirm(`Remove this ${r.bird} from My Wall? This can't be undone.`)) return;
    await delMyBird(r.id); close(); window.dispatchEvent(new Event('route'));
  };
}
