import { $, api, esc, toast } from '../util.js';
import { autoCut, warmClipper } from '../clip.js';
import { readExif, derivatives } from '../exif.js';
import { wi, REGIONS, REGION_NAMES, myRegion } from '../wi.js';
import { addToMyWall } from './mywall.js';
import { loadIssues, currentIssue, stateLine } from '../issues.js';

// Behind the Shot: specific, easy questions get better stories than one empty box. Each answer becomes a
// sentence or two of the caption (the worker joins them in this order; the editor can tidy it in Review).
const STORY = [
  ['day', 'Set the scene. What kind of place was it, and what was the day like?', 'A foggy morning at a salt marsh, just after sunrise. Cold enough that my hands hurt.'],
  ['doing', 'What was the bird doing when you took this?', 'It had just caught a small fish and was shaking it before swallowing.'],
  ['how', 'How did you get the shot? Luck, patience, a plan?', 'I sat still by the same channel for forty minutes until it walked into the light.'],
  ['surprise', 'What surprised you, or what nearly went wrong?', 'A jogger almost flushed it. It froze, then went straight back to hunting.'],
];

export const birdOptions = (d) => `<datalist id="bird-names">${d.birds.filter((b) => b.cat !== 'introduced').map((b) => `<option value="${esc(b.n)}"></option>`).join('')}</datalist>`;

const MAX = 6; // photos per send; the daily limit per visitor is 12

// A half-filled form is kept in this browser (IndexedDB, which can hold the photos too) until it is sent or cleared.
const DRAFT_DB = 'wi-draft';
function draftStore(mode) {
  return new Promise((res, rej) => { const r = indexedDB.open(DRAFT_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('d'); r.onerror = () => rej(r.error); r.onsuccess = () => res(r.result.transaction('d', mode).objectStore('d')); });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const loadDraft = async () => { try { return await req((await draftStore('readonly')).get('current')); } catch { return null; } };
const saveDraft = async (v) => { try { await req((await draftStore('readwrite')).put(v, 'current')); } catch { /* private mode: nothing kept */ } };
const clearDraft = async () => { try { await req((await draftStore('readwrite')).delete('current')); } catch { /* nothing to clear */ } };
// Status links for photos sent from this browser, newest last.
export const SENT_KEY = 'wi.sent';
export const sentLinks = () => { try { return JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch { return []; } };

export default async function submit(view) {
  const d = await wi();
  const issue = currentIssue(await loadIssues().catch(() => []));
  const pre = (() => { try { return JSON.parse(sessionStorage.getItem('wi.submit') || 'null'); } catch { return null; } })();
  sessionStorage.removeItem('wi.submit');
  const items = []; // one per photo: { file, url, bird, story, cut, el, state }
  let queue = Promise.resolve();
  view.innerHTML = `<div class="mag-wrap mag-page sub-page">
    <p class="mag-kicker">Send a photo</p>
    <h1 class="mag-h">Put your bird on the wall</h1>
    ${sentLinks().length ? `<p class="sub-sent"><a class="linkish" href="/sent" data-link>Check on the photos you've sent</a></p>` : ''}
    <p class="sub-restore" id="restore" hidden><span>We kept your unsent photos and answers from last time.</span><button type="button" class="linkish" id="restart">Start over</button></p>
    <p class="mag-deck">Send up to ${MAX} of your California bird photos at once. We review every one and add it to the Bird Wall with your name. The best ones run in the magazine.</p>
    ${issue ? `<p class="sub-issue"><b>Issue No. ${issue.number}: ${esc(issue.theme || issue.title)}.</b> ${esc(stateLine(issue).long)} <a class="linkish" href="/issues/${issue.number}" data-link>About this issue</a></p>` : ''}
    <form id="sf" novalidate>
      <label class="drop sub-drop" id="drop"><input type="file" id="file" accept="image/jpeg,image/png,image/webp" multiple>
        <span class="drop-in"><b>Choose photos</b><span>or drop them here. JPEG, PNG or WebP, up to ${MAX}.</span></span></label>
      ${birdOptions(d)}
      <div class="sp-list" id="sp-list"></div>
      <div class="sub-you" id="sub-you" hidden>
        <h2>About you</h2>
        <div class="sub-you-grid">
          <label class="f"><span>Your name, as it should be credited</span><input name="credit_name" required maxlength="80" autocomplete="name"></label>
          <label class="f"><span>Email <i>(optional, never shown; only used if we need to ask about a photo)</i></span><input name="contact" type="email" maxlength="120" autocomplete="email"></label>
          <label class="f"><span>Region where you took them</span><select name="region">${REGIONS.map((r) => `<option value="${r}" ${r === myRegion({ regions: REGIONS }) ? 'selected' : ''}>${REGION_NAMES[r]}</option>`).join('')}</select></label>
        </div>
        <fieldset class="f checks"><legend>Before you send</legend>
          <label><input type="checkbox" name="mine" required> I took these photos myself, of wild birds in California.</label>
          <label><input type="checkbox" name="ethics" required> I didn't use bait or playback, flush a bird, or go near a nest.</label>
          <label><input type="checkbox" name="consent" required> California Bird Atlas may publish them, cut out or whole, on this site and in print, with my name as credit. I keep the copyright.</label>
          <label><input type="checkbox" name="keep" checked> Also keep copies on My Wall on this device.</label>
        </fieldset>
        <p class="sub-privacy">We never publish where a photo was taken. Location data in your photo files is removed in your browser before they're sent.</p>
        <button class="mag-btn solid" type="submit" id="sb">Send</button>
      </div>
    </form>
  </div>`;
  const form = $('#sf', view), list = $('#sp-list', view), drop = $('#drop', view), btn = $('#sb', view);
  const birdOf = (name) => d.byName.get(String(name || '').trim()) || [...d.byName.values()].find((b) => b.n.toLowerCase() === String(name || '').trim().toLowerCase());
  const live = () => items.filter((x) => x.state !== 'removed' && x.state !== 'sent');
  const sync = () => { $('#sub-you', view).hidden = !live().length; btn.textContent = live().length > 1 ? `Send ${live().length} photos` : 'Send photo'; };
  const paintCut = (it) => { it.el.querySelector('.sp-cut').innerHTML = it.cut ? `<img src="${it.cutUrl}" alt="How it will look on the wall">` : `<span>${it.cutFailed ? 'No preview. We\'ll cut it out for you.' : 'Cutting out…'}</span>`; };
  // Save the form as it is now. Called after any change; cheap enough to run on every keystroke batch.
  let saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => {
    const v = Object.fromEntries(new FormData(form));
    const kept = live().map((it) => ({ blob: it.file, name: it.file.name, type: it.file.type, bird: it.el.querySelector('.sp-bird').value, story: Object.fromEntries([...it.el.querySelectorAll('textarea[data-k]')].map((t) => [t.dataset.k, t.value])) }));
    if (kept.length || v.credit_name) saveDraft({ items: kept, you: { credit_name: v.credit_name || '', contact: v.contact || '', region: v.region || '' } }); else clearDraft();
  }, 400); };
  form.addEventListener('input', persist); form.addEventListener('change', persist);
  const add = (file, bird = '', story = {}) => {
    if (!/^image\/(jpeg|png|webp)/.test(file.type)) { toast(`"${file.name}" isn't a JPEG, PNG or WebP photo.`, true); return; }
    if (live().length >= MAX) { toast(`You can send ${MAX} at a time. Send these, then add more.`, true); return; }
    const it = { file, url: URL.createObjectURL(file), state: 'ready', cut: null };
    it.el = document.createElement('div'); it.el.className = 'sp-item';
    it.el.innerHTML = `<div class="sp-imgs"><figure><img src="${it.url}" alt="Your photo"><figcaption>Your photo</figcaption></figure><figure><div class="sp-cut"></div><figcaption>On the wall</figcaption></figure></div>
      <div class="sp-fields">
        <label class="f"><span>Which bird is it?</span><input class="sp-bird" list="bird-names" autocomplete="off" placeholder="Start typing, e.g. Anna's Hummingbird" value="${esc(bird)}"></label>
        <details class="sp-story" ${items.length ? '' : 'open'}><summary>Behind the shot <i>(optional, but it's what gets a photo featured)</i></summary>
          <p class="story-hint">A sentence or two each is plenty. Please describe the kind of place, not the exact spot.</p>
          ${STORY.map(([k, q, eg]) => `<label><span>${esc(q)}</span><textarea data-k="${k}" rows="2" maxlength="700" placeholder="For example: ${esc(eg)}"></textarea></label>`).join('')}
        </details>
        <p class="sp-foot"><button type="button" class="linkish sp-del">Remove this photo</button><span class="sp-state" role="status"></span></p>
      </div>`;
    list.appendChild(it.el); items.push(it); paintCut(it); sync();
    it.el.querySelectorAll('textarea[data-k]').forEach((t) => { if (story[t.dataset.k]) t.value = story[t.dataset.k]; });
    if (Object.values(story).some(Boolean)) it.el.querySelector('.sp-story').open = true;
    persist();
    it.el.querySelector('.sp-del').onclick = () => { it.state = 'removed'; it.el.remove(); sync(); persist(); };
    // Cut-outs are made one at a time so a phone is not asked to do several at once.
    queue = queue.then(async () => { if (it.state === 'removed') return; try { it.cut = await autoCut(file); it.cutUrl = URL.createObjectURL(it.cut.blob); } catch { it.cutFailed = true; } if (it.state !== 'removed') paintCut(it); });
  };
  const take = (files) => { warmClipper(); [...files].forEach((f) => add(f)); };
  $('#file', view).onchange = (e) => { take(e.target.files); e.target.value = ''; };
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files); });
  // Bring back a half-filled form, unless this visit came from My Wall with a photo of its own.
  const draft = pre?.blobKey ? null : await loadDraft();
  if (draft && (draft.items?.length || draft.you?.credit_name)) {
    warmClipper();
    for (const x of draft.items || []) add(new File([x.blob], x.name || 'photo.jpg', { type: x.type || x.blob.type }), x.bird || '', x.story || {});
    for (const [k, val] of Object.entries(draft.you || {})) { const f = form.elements[k]; if (f && val) f.value = val; }
    $('#restore', view).hidden = false;
    $('#restart', view).onclick = async () => { await clearDraft(); window.dispatchEvent(new Event('route')); };
  }
  if (pre?.blobKey) {
    const { getMyBird } = await import('./mywall.js');
    const mine = await getMyBird(pre.blobKey);
    if (mine) { warmClipper(); add(new File([mine.photo], 'my-wall.jpg', { type: mine.photo.type || 'image/jpeg' }), pre.bird || ''); }
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form)), todo = live();
    if (!todo.length) return toast('Choose a photo first.', true);
    for (const it of todo) { it.b = birdOf(it.el.querySelector('.sp-bird').value); if (!it.b) { it.el.querySelector('.sp-bird').focus(); return toast('Pick each bird from the list. Start typing its name.', true); } }
    if (!v.credit_name?.trim()) return toast('Enter the name to credit.', true);
    if (!v.mine || !v.ethics || !v.consent) return toast('Please tick the three boxes under "Before you send".', true);
    btn.disabled = true; let sent = 0; const names = [];
    for (const it of todo) {
      const stEl = it.el.querySelector('.sp-state'); stEl.textContent = 'Sending…';
      try {
        const [ex, dv] = [await readExif(it.file), await derivatives(it.file)];
        const story = Object.fromEntries([...it.el.querySelectorAll('textarea[data-k]')].map((t) => [t.dataset.k, t.value]));
        const fd = new FormData();
        fd.set('meta', JSON.stringify({ bird: it.b.n, credit_name: v.credit_name.trim(), contact: v.contact || '', region: v.region, story, consent: true, taken_at: ex.taken_at || null, camera: ex.camera || '', width: dv.width, height: dv.height, cut_w: it.cut?.width, cut_h: it.cut?.height }));
        fd.set('display', dv.display, 'display.jpg'); fd.set('thumb', dv.thumb, 'thumb.jpg');
        if (it.cut) fd.set('cutout', it.cut.blob, 'cutout.png');
        const res = await api('/submissions', { method: 'POST', form: fd });
        if (res?.key) { const list = sentLinks(); list.push({ s: `${res.id}.${res.key}`, bird: it.b.n, at: new Date().toISOString(), region: v.region || '', taken_at: ex.taken_at || null }); try { localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-60))); } catch { /* storage off */ } it.statusPair = `${res.id}.${res.key}`; }
        if (v.keep && !pre?.blobKey) await addToMyWall({ bird: it.b.n, sci: it.b.sci, photo: dv.display, taken_at: ex.taken_at || null, region: v.region || '' }).catch(() => {});
        it.state = 'sent'; sent++; names.push(it.b.n); stEl.textContent = 'Sent'; it.el.classList.add('done');
      } catch (err) { stEl.textContent = err.message; toast(err.message, true); break; }
    }
    btn.disabled = false; sync();
    if (sent && !live().length) {
      await clearDraft();
      const link = `${location.origin}/sent?s=${items.filter((x) => x.statusPair).map((x) => x.statusPair).join(',')}`;
      view.querySelector('.sub-page').innerHTML = `<p class="mag-kicker">Sent</p><h1 class="mag-h">Thank you.</h1>
        <div class="sub-status"><p><b>Your private status link.</b> It shows whether each photo is waiting, on the wall or declined. Only people with the link can see it, so keep it somewhere safe. This browser remembers it too.</p>
          <p class="sub-link"><input readonly value="${esc(link)}" aria-label="Status link"><button type="button" class="mag-btn" id="cp">Copy link</button></p></div>
        <p class="mag-deck" style="font-size:19px">${sent === 1 ? `Your ${esc(names[0])} is` : `Your ${sent} photos are`} in the review queue. Approved photos go on the Bird Wall with your name, usually within a week.</p>
        <p class="wall-ctas"><a class="mag-btn solid" href="/submit" data-link>Send more</a><a class="mag-btn" href="/wall" data-link>See the Bird Wall</a>${v.keep ? '<a class="mag-btn" href="/my-wall" data-link>My Wall</a>' : ''}</p>`;
      const cp = view.querySelector('#cp'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied.'); } catch { view.querySelector('.sub-link input').select(); } };
      window.scrollTo(0, 0);
    }
  };
}
