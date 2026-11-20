import { S, $, $$, api, esc, toast, fmtDate } from '../util.js';
import { wi, REGION_NAMES } from '../wi.js';
import { openClipper, warmClipper } from '../clip.js';
import { birdOptions } from './submit.js';

// Owner only: review submitted photos, cut the bird out and publish it to the Bird Wall.
let tab = 'pending';

export default async function review(view) {
  document.body.classList.add('mag');
  if (!S.owner) { view.innerHTML = '<div class="mag-wrap mag-page"><h1 class="mag-h">Review</h1><p class="mag-deck">Sign in with Editor login to review submissions.</p></div>'; return; }
  const [rows, d] = await Promise.all([api('/submissions'), wi()]);
  warmClipper();
  const count = (s) => rows.filter((r) => r.status === s).length;
  view.innerHTML = `<div class="mag-wrap mag-page">
    <p class="mag-kicker">Editor</p><h1 class="mag-h">Review submissions</h1>
    <p class="mag-deck">Open a photo, check the bird and the credit, cut the bird out, then publish it to the Bird Wall.</p>
    <div class="seg" role="group" aria-label="Show">${[['pending', 'Waiting'], ['approved', 'On the wall'], ['rejected', 'Declined']].map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}">${l} (${count(k)})</button>`).join('')}</div>
    <div class="rv-grid" id="rvl"></div>
  </div>`;
  const list = $('#rvl', view);
  const draw = () => {
    const shown = rows.filter((r) => r.status === tab);
    list.innerHTML = shown.map((r) => `<button type="button" class="rv-card" data-id="${r.id}">
      <img loading="lazy" src="/media/sub/${r.id}/${r.cut_w ? 'cutout' : 'thumb'}" alt="" class="${r.cut_w ? 'cut' : ''}">
      <span class="rv-t"><b>${esc(r.bird)}</b><span>${esc(r.credit_name)} · ${esc(REGION_NAMES[r.region] || r.region || '')}</span><span>${esc(fmtDate(r.created_at))}${r.cut_w ? ' · cut out' : ''}${r.featured ? ' · featured' : ''}</span></span></button>`).join('')
      || `<p class="mag-deck" style="padding-top:20px">${tab === 'pending' ? 'Nothing waiting. New submissions show up here.' : 'None yet.'}</p>`;
    $$('.rv-card', list).forEach((b) => (b.onclick = () => openSub(rows.find((r) => r.id === +b.dataset.id), d)));
  };
  $$('[data-t]', view).forEach((b) => (b.onclick = () => { tab = b.dataset.t; $$('[data-t]', view).forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
  draw();
}

function openSub(r, d) {
  const el = document.createElement('div'); el.className = 'modal mag-modal wall-modal';
  const bust = Date.now();
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Submission"><button class="x" type="button">Close</button>
    <div class="wm-grid"><div class="wm-art two">
      <figure><img src="/media/sub/${r.id}/display" alt="Submitted photo"><figcaption>Submitted photo</figcaption></figure>
      <figure><img id="rv-cut" src="${r.cut_w ? `/media/sub/${r.id}/cutout?v=${bust}` : ''}" alt="Cut-out" ${r.cut_w ? '' : 'hidden'}><figcaption id="rv-cutcap">${r.cut_w ? 'Cut-out' : 'Not cut out yet'}</figcaption></figure>
    </div>
    <div class="wm-info"><p class="mag-kicker">Submission #${r.id} · ${esc(r.status)}</p>
      <form id="rf">
        <label class="f"><span>Bird</span><input name="bird" list="bird-names" value="${esc(r.bird)}">${birdOptions(d)}</label>
        <label class="f"><span>Credit</span><input name="credit_name" value="${esc(r.credit_name)}"></label>
        <label class="f"><span>Region</span><select name="region">${Object.entries(REGION_NAMES).map(([k, n]) => `<option value="${k}" ${k === r.region ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f checks"><span>Featured</span><label><input type="checkbox" name="featured" ${r.featured ? 'checked' : ''}> Show larger, at the top of the wall</label></label>
      </form>
      <dl>${r.contact ? `<dt>Email (private)</dt><dd><a href="mailto:${esc(r.contact)}">${esc(r.contact)}</a></dd>` : ''}
        ${r.note ? `<dt>Note</dt><dd>${esc(r.note)}</dd>` : ''}
        <dt>Details</dt><dd>${esc([r.camera, r.taken_at ? 'taken ' + fmtDate(r.taken_at) : '', r.width ? `${r.width} × ${r.height}` : ''].filter(Boolean).join(' · ') || 'none')}</dd></dl>
      <div class="wm-actions">
        <button type="button" class="mag-btn" id="r-cut">${r.cut_w ? 'Cut out again' : 'Cut out the bird'}</button>
        <button type="button" class="mag-btn" id="r-save">Save changes</button>
        ${r.status !== 'approved' ? '<button type="button" class="mag-btn solid" id="r-pub">Publish to the wall</button>' : '<button type="button" class="mag-btn" id="r-unpub">Take off the wall</button>'}
        ${r.status !== 'rejected' ? '<button type="button" class="mag-btn" id="r-rej">Decline</button>' : ''}
        <button type="button" class="mag-btn" id="r-del">Delete</button>
      </div>
    </div></div></div>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const close = () => el.remove();
  const refresh = () => { close(); window.dispatchEvent(new Event('route')); };
  q('.x').onclick = close;
  const fields = () => { const v = Object.fromEntries(new FormData(q('#rf'))); return { bird: v.bird, credit_name: v.credit_name, region: v.region, featured: v.featured ? 1 : 0 }; };
  const patch = async (extra = {}) => api(`/submissions/${r.id}`, { method: 'PATCH', body: { ...fields(), ...extra } });
  q('#r-cut').onclick = async () => {
    el.style.display = 'none';
    const cut = await openClipper(`/media/sub/${r.id}/display`, { title: `Cut out the ${r.bird}` });
    el.style.display = '';
    if (!cut) return;
    const fd = new FormData(); fd.set('cutout', cut.blob, 'cutout.png'); fd.set('w', cut.width); fd.set('h', cut.height);
    try {
      await api(`/submissions/${r.id}/cutout`, { method: 'POST', form: fd });
      r.cut_w = cut.width; r.cut_h = cut.height;
      q('#rv-cut').src = URL.createObjectURL(cut.blob); q('#rv-cut').hidden = false; q('#rv-cutcap').textContent = 'Cut-out (saved)';
      toast('Cut-out saved.');
    } catch (err) { toast(err.message, true); }
  };
  q('#r-save').onclick = async () => { try { await patch(); toast('Saved.'); } catch (err) { toast(err.message, true); } };
  const pub = q('#r-pub'); if (pub) pub.onclick = async () => {
    if (!r.cut_w) { toast('Cut out the bird first.', true); return; }
    try { await patch({ status: 'approved' }); toast('Published to the Bird Wall.'); refresh(); } catch (err) { toast(err.message, true); }
  };
  const un = q('#r-unpub'); if (un) un.onclick = async () => { try { await patch({ status: 'pending' }); toast('Taken off the wall.'); refresh(); } catch (err) { toast(err.message, true); } };
  const rej = q('#r-rej'); if (rej) rej.onclick = async () => { try { await patch({ status: 'rejected' }); toast('Declined.'); refresh(); } catch (err) { toast(err.message, true); } };
  q('#r-del').onclick = async () => {
    if (!confirm('Delete this submission and its photos for good?')) return;
    try { await api(`/submissions/${r.id}`, { method: 'DELETE' }); toast('Deleted.'); refresh(); } catch (err) { toast(err.message, true); }
  };
}
