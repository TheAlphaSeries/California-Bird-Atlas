// Quick field observation form, photograph upload, and offline drafts.
import { S, $, $$, api, esc, toast, modal, COUNTIES } from './util.js';
import { readExif, derivatives } from './exif.js';

// ---------- offline drafts (IndexedDB, including the photograph files) ----------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('atlas-drafts', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('drafts', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function store(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('drafts', mode); const rq = fn(tx.objectStore('drafts')); tx.oncomplete = () => res(rq?.result); tx.onerror = () => rej(tx.error); });
}
const setCount = (n) => { try { localStorage.setItem('atlas_drafts', String(n)); } catch { /* storage unavailable */ } };
export const draftCount = () => { try { return Number(localStorage.getItem('atlas_drafts')) || 0; } catch { return 0; } };
const isNetworkError = (e) => e instanceof TypeError || !navigator.onLine;

async function send(draft) {
  // draft: { payload, files, obsId, sent } — resumable, so a retry never duplicates the observation
  if (!draft.obsId) { draft.obsId = (await api('/observations', { method: 'POST', body: draft.payload })).id; if (draft.id) await store('readwrite', (s) => s.put(draft)); }
  let lostOriginals = 0;
  for (let i = draft.sent || 0; i < draft.files.length; i++) {
    const file = draft.files[i];
    const [exif, d] = [await readExif(file), await derivatives(file)];
    const form = new FormData();
    form.set('meta', JSON.stringify({ species_id: draft.payload.species_id, observation_id: draft.obsId, original_name: file.name, original_type: file.type, width: d.width, height: d.height, exif, taken_at: exif.taken_at || draft.payload.observed_at, id_confirmed: draft.payload.confidence === 'confirmed' ? 1 : 0, visibility: draft.payload.visibility }));
    form.set('display', d.display, 'display.jpg'); form.set('thumb', d.thumb, 'thumb.jpg'); form.set('original', file, file.name);
    const r = await api('/photos', { method: 'POST', form });
    if (!r.original_kept) lostOriginals++;
    draft.sent = i + 1; if (draft.id) await store('readwrite', (s) => s.put(draft));
  }
  return lostOriginals;
}

let syncing = false;
export async function syncDrafts(verbose) {
  if (syncing || !S.owner) return; syncing = true;
  try {
    const all = await store('readonly', (s) => s.getAll());
    let done = 0;
    for (const d of all) {
      try { await send(d); await store('readwrite', (s) => s.delete(d.id)); done++; }
      catch (e) { if (isNetworkError(e)) break; toast(`A saved draft could not be sent: ${e.message}`, true); break; }
    }
    setCount(all.length - done);
    if (done) { toast(`${done} saved draft${done > 1 ? 's' : ''} sent.`); window.dispatchEvent(new Event('atlas:changed')); }
    else if (verbose) toast(all.length ? 'Still offline. Drafts will be sent when the connection returns.' : 'No drafts waiting.');
  } catch { /* IndexedDB unavailable */ } finally { syncing = false; }
}

// ---------- the form ----------
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

export function openObservation(preset = {}) {
  if (!S.owner) { toast('Sign in as the owner to record observations.', true); return; }
  const sp0 = preset.species_id ? S.spById.get(preset.species_id) : null;
  const vis = S.settings.default_visibility || 'private';
  const m = modal(`<span class="label">Field observation</span><h2>Record a sighting</h2>
  <form novalidate>
    <label class="field typeahead"><span>Bird species</span><input name="species" autocomplete="off" placeholder="Start typing a common or scientific name" value="${esc(sp0?.common_name || '')}" required><ul hidden></ul></label>
    <div class="row2">
      <label class="field"><span>Date and time</span><input type="datetime-local" name="observed_at" value="${localNow()}" required></label>
      <label class="field"><span>Number observed</span><input type="number" name="count" min="1" inputmode="numeric" placeholder="1"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Location</span><input name="location_name" placeholder="e.g. Heron's Head Park" value="${esc(preset.location_name || '')}"></label>
      <label class="field"><span>County</span><input name="county" list="county-list" placeholder="San Francisco"><datalist id="county-list">${COUNTIES.map((c) => `<option value="${c}">`).join('')}</datalist></label>
    </div>
    <div class="row3">
      <label class="field"><span>Latitude</span><input name="lat" inputmode="decimal" placeholder="optional"></label>
      <label class="field"><span>Longitude</span><input name="lng" inputmode="decimal" placeholder="optional"></label>
      <div class="field"><span>&nbsp;</span><button type="button" class="btn quiet" id="geo" style="width:100%">Use my position</button></div>
    </div>
    <div class="row2">
      <label class="field"><span>Behavior</span><input name="behavior" placeholder="Feeding, singing, in flight…"></label>
      <label class="field"><span>Habitat</span><input name="habitat" placeholder="Tidal marsh, coastal scrub…"></label>
    </div>
    <label class="field"><span>Photographs</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple><div class="previews"></div></label>
    ${S.storage === 'd1' ? '<p class="note">Photo originals are not being archived yet: this site keeps a 2560-pixel display copy only, until R2 storage is switched on (see Settings). Keep your original files.</p>' : ''}
    <label class="field"><span>Notes</span><textarea name="notes" placeholder="What you saw, light, how the bird behaved…"></textarea></label>
    <div class="row2">
      <label class="field"><span>Identification confidence</span><select name="confidence"><option value="confirmed">Confirmed</option><option value="probable">Probable</option><option value="pending">Identification pending</option></select></label>
      <label class="field"><span>Visibility</span><select name="visibility"><option value="private" ${vis === 'private' ? 'selected' : ''}>Private (only me)</option><option value="public" ${vis === 'public' ? 'selected' : ''}>Public</option></select></label>
    </div>
    <button class="btn solid" type="submit">Save observation</button>
  </form>`);
  const form = $('form', m.el), input = form.species, list = $('.typeahead ul', m.el);
  let chosen = sp0, dateTouched = false, active = -1, matches = [];

  const show = () => {
    const q = input.value.trim().toLowerCase(); chosen = null; active = -1;
    matches = q.length < 2 ? [] : S.species.filter((s) => s.common_name.toLowerCase().includes(q) || s.scientific_name.toLowerCase().includes(q))
      .sort((a, b) => (b.common_name.toLowerCase().startsWith(q) - a.common_name.toLowerCase().startsWith(q)) || a.seq - b.seq).slice(0, 12);
    list.hidden = !matches.length;
    list.innerHTML = matches.map((s, i) => `<li data-i="${i}">${esc(s.common_name)}<i>${esc(s.scientific_name)}</i></li>`).join('');
  };
  const pick = (s) => { chosen = s; input.value = s.common_name; list.hidden = true; };
  input.addEventListener('input', show);
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length; $$('li', list).forEach((li, i) => li.classList.toggle('on', i === active)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[Math.max(active, 0)]); }
  });
  list.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(matches[+li.dataset.i]); } });
  input.addEventListener('blur', () => setTimeout(() => (list.hidden = true), 150));
  form.observed_at.addEventListener('input', () => (dateTouched = true));

  $('#geo', m.el).onclick = () => {
    if (!navigator.geolocation) return toast('This device does not offer a position.', true);
    navigator.geolocation.getCurrentPosition((p) => { form.lat.value = p.coords.latitude.toFixed(6); form.lng.value = p.coords.longitude.toFixed(6); }, () => toast('Position unavailable. Enter coordinates by hand, or leave them blank.', true), { enableHighAccuracy: true, timeout: 10000 });
  };
  form.photos.addEventListener('change', async () => {
    const box = $('.previews', m.el); box.innerHTML = '';
    for (const [i, f] of [...form.photos.files].entries()) {
      const ex = await readExif(f);
      if (i === 0) {
        if (ex.taken_at && !dateTouched) form.observed_at.value = ex.taken_at.slice(0, 16);
        if (ex.lat != null && !form.lat.value) { form.lat.value = ex.lat; form.lng.value = ex.lng; }
      }
      const fig = document.createElement('figure');
      fig.innerHTML = `<img alt=""><figcaption>${esc([ex.focal_length, ex.aperture, ex.shutter, ex.iso ? 'ISO ' + ex.iso : ''].filter(Boolean).join(' · ') || 'No EXIF data')}</figcaption>`;
      $('img', fig).src = URL.createObjectURL(f); box.appendChild(fig);
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!chosen) { const exact = S.species.find((s) => s.common_name.toLowerCase() === input.value.trim().toLowerCase()); if (exact) chosen = exact; }
    if (!chosen) { toast('Choose a species from the list.', true); input.focus(); return; }
    if (!form.observed_at.value) { toast('Enter the date and time.', true); return; }
    const num = (v) => (v === '' || isNaN(Number(v)) ? null : Number(v));
    const payload = { species_id: chosen.id, observed_at: form.observed_at.value, location_name: form.location_name.value.trim(), county: form.county.value.trim(), lat: num(form.lat.value), lng: num(form.lng.value), count: num(form.count.value), behavior: form.behavior.value.trim(), habitat: form.habitat.value.trim(), notes: form.notes.value.trim(), confidence: form.confidence.value, visibility: form.visibility.value };
    const draft = { payload, files: [...form.photos.files], sent: 0 };
    const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = draft.files.length ? 'Saving and uploading…' : 'Saving…';
    try {
      const lost = await send(draft);
      m.close();
      toast(`${chosen.common_name} recorded${draft.files.length ? ` with ${draft.files.length} photograph${draft.files.length > 1 ? 's' : ''}` : ''}.${lost ? ' Originals were not archived.' : ''}`);
      window.dispatchEvent(new Event('atlas:changed'));
    } catch (err) {
      if (isNetworkError(err)) {
        try { await store('readwrite', (s) => s.add(draft)); setCount(draftCount() + 1); m.close(); toast('No connection. Saved as a draft on this device; it will be sent when you are back online.'); window.dispatchEvent(new Event('atlas:changed')); }
        catch { toast('No connection, and the draft could not be saved on this device.', true); btn.disabled = false; btn.textContent = 'Save observation'; }
      } else { toast(err.message, true); btn.disabled = false; btn.textContent = 'Save observation'; if (draft.obsId) window.dispatchEvent(new Event('atlas:changed')); }
    }
  };
}
