import { S, $, $$, api, esc, toast, fmtDate } from '../util.js';
import { wi, REGION_NAMES } from '../wi.js';
import { openClipper, warmClipper } from '../clip.js';
import { birdOptions } from './submit.js';
import { fillSamples, clearSamples, SAMPLES } from '../samples.js';
import { pickReference } from '../refpick.js';
import { loadAll } from '../util.js';
import { loadIssues, currentIssue, stateLine } from '../issues.js';
import { nineBirdsEmail } from '../email.js';

const AWARDS = ['Best Level 3 find', 'Best behavior', 'Bird in its habitat', 'Best portrait', 'Young photographer', 'Phone or digiscope', "Editor's pick"];
let ISS = [];

// Owner only: review submitted photos, cut the bird out and publish it to the Bird Wall.
let tab = 'pending';

export default async function review(view) {
  if (!S.owner) { view.innerHTML = '<div class="mag-wrap mag-page"><h1 class="mag-h">Review</h1><p class="mag-deck">Sign in with Editor login to review submissions.</p></div>'; return; }
  const [rows, d, reports, issues, subs] = await Promise.all([api('/submissions'), wi(), api('/reports'), loadIssues(), api('/subscribers')]);
  ISS = issues;
  const cur = currentIssue(issues);
  warmClipper();
  const count = (s) => (s === 'reports' ? new Set(reports.map((r) => r.species_id)).size : rows.filter((r) => r.status === s).length);
  const withRef = S.species.filter((x) => x.ref_url).length;
  view.innerHTML = `<div class="mag-wrap mag-page">
    <p class="mag-kicker">Editor</p><h1 class="mag-h">Review submissions</h1>
    <p class="mag-deck">Open a photo, check the bird and the credit, cut the bird out, then publish it to the Bird Wall.</p>
    <div class="rv-samples">
      <div><b>Issues</b><span>${cur ? `No. ${cur.number}, ${esc(cur.title)}: "${esc(cur.theme)}". ${esc(stateLine(cur).long)} ${rows.filter((r) => r.issue_id === cur.id).length} photo(s) sent for it.` : 'No issue yet.'}</span></div>
      <div class="rv-sbtn">${cur ? `<button type="button" class="mag-btn" id="is-edit">Edit this issue</button>` : ''}<button type="button" class="mag-btn solid" id="is-new">New issue</button></div>
    </div>
    <div class="rv-samples">
      <div><b>Two-week email</b><span>${subs.length} subscriber${subs.length === 1 ? '' : 's'}. The email for each region writes itself from the current assignment; copy it into your email app and send it with that region's subscribers in BCC.</span></div>
      <div class="rv-sbtn"><button type="button" class="mag-btn solid" id="em-open">Write this fortnight's email</button></div>
    </div>
    <div class="rv-samples">
      <div><b>Sample birds</b><span id="smp-s">${rows.some((r) => r.sample) ? `${rows.filter((r) => r.sample).length} sample birds are on the wall. They're openly licensed photos from Wikimedia Commons, credited to their photographers. Remove them when your own photos are up.` : `The wall is empty until photos arrive. Fill it with ${SAMPLES.length} openly licensed photos of California birds from Wikimedia Commons, cut out automatically and credited to their photographers.`}</span></div>
      <div class="rv-sbtn"><button type="button" class="mag-btn solid" id="smp-add">${rows.some((r) => r.sample) ? 'Add any missing' : 'Fill with sample birds'}</button>${rows.some((r) => r.sample) ? '<button type="button" class="mag-btn" id="smp-del">Remove sample birds</button>' : ''}</div>
    </div>
    <div class="rv-samples">
      <div><b>Reference photos</b><span id="ref-s">${withRef} of ${S.species.length} birds have a reference photo, so people know what to look for. Missing ones are looked up from each bird's Wikipedia article and kept only if openly licensed, with the photographer credited.</span></div>
      <div class="rv-sbtn">${withRef < S.species.length ? `<button type="button" class="mag-btn solid" id="ref-run">Load ${S.species.length - withRef} missing photos</button><button type="button" class="mag-btn" id="ref-stop" hidden>Stop</button>` : ''}</div>
    </div>
    <div class="seg" role="group" aria-label="Show">${[['pending', 'Waiting'], ['approved', 'On the wall'], ['rejected', 'Declined'], ['reports', 'Photo reports']].map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}">${l} (${count(k)})</button>`).join('')}</div>
    <div class="rv-grid" id="rvl"></div>
  </div>`;
  const list = $('#rvl', view);
  const draw = () => {
    if (tab === 'reports') {
      const by = new Map(); for (const r of reports) { if (!by.has(r.species_id)) by.set(r.species_id, []); by.get(r.species_id).push(r); }
      list.innerHTML = [...by.values()].map((rs) => `<button type="button" class="rv-card" data-sp="${rs[0].species_id}">
        <img loading="lazy" src="${esc(rs[0].ref_thumb || '')}" alt="">
        <span class="rv-t"><b>${esc(rs[0].common_name)}</b><span>${rs.length} report${rs.length > 1 ? 's' : ''}</span><span>${esc(fmtDate(rs[0].created_at))}</span></span></button>`).join('')
        || '<p class="mag-deck" style="padding-top:20px">No reports. When someone says a reference photo is wrong, it shows up here.</p>';
      $$('[data-sp]', list).forEach((b) => (b.onclick = () => pickReference(+b.dataset.sp, by.get(+b.dataset.sp), () => window.dispatchEvent(new Event('route')))));
      return;
    }
    const shown = rows.filter((r) => r.status === tab);
    // Likely duplicates: the same bird from the same person, with the same capture time or the same image size.
    const dupOf = (r) => rows.find((x) => x.id !== r.id && x.status !== 'rejected' && x.bird === r.bird && x.credit_name === r.credit_name
      && ((r.taken_at && x.taken_at === r.taken_at) || (r.width && x.width === r.width && x.height === r.height)));
    const sel = new Set();
    list.innerHTML = (tab === 'pending' && shown.length ? `<div class="rv-bulk"><label><input type="checkbox" id="rv-all"> Select all</label><button type="button" class="mag-btn solid" id="rv-pubsel" disabled>Publish selected</button><span id="rv-bn"></span></div>` : '')
      + (shown.map((r) => { const dup = dupOf(r);
        return `<div class="rv-item">${tab === 'pending' ? `<label class="rv-sel" title="${r.cut_w ? 'Select' : 'Cut out first to publish'}"><input type="checkbox" data-sel="${r.id}" ${r.cut_w ? '' : 'disabled'}><span class="vh">Select ${esc(r.bird)}</span></label>` : ''}
        <button type="button" class="rv-card" data-id="${r.id}">
        <img loading="lazy" src="/media/sub/${r.id}/${r.cut_w ? 'cutout' : 'thumb'}" alt="" class="${r.cut_w ? 'cut' : ''}">
        <span class="rv-t"><b>${esc(r.bird)}</b><span>${esc(r.credit_name)} · ${esc(REGION_NAMES[r.region] || r.region || '')}</span><span>${esc(fmtDate(r.created_at))}${r.cut_w ? ' · cut out' : ' · not cut out'}${r.featured ? ' · featured' : ''}${r.sample ? ' · sample' : ''}</span>
        ${dup ? `<span class="rv-dup">Possible duplicate of #${dup.id}</span>` : ''}</span></button></div>`; }).join('')
      || `<p class="mag-deck" style="padding-top:20px">${tab === 'pending' ? 'Nothing waiting. New submissions show up here.' : 'None yet.'}</p>`);
    $$('.rv-card', list).forEach((b) => (b.onclick = () => openSub(rows.find((r) => r.id === +b.dataset.id), d)));
    const pubsel = $('#rv-pubsel', list);
    if (pubsel) {
      const upd = () => { pubsel.disabled = !sel.size; pubsel.textContent = sel.size ? `Publish ${sel.size} to the wall` : 'Publish selected'; };
      $$('[data-sel]', list).forEach((c) => (c.onchange = () => { c.checked ? sel.add(+c.dataset.sel) : sel.delete(+c.dataset.sel); upd(); }));
      $('#rv-all', list).onchange = (e) => { $$('[data-sel]:not(:disabled)', list).forEach((c) => { c.checked = e.target.checked; c.onchange(); }); };
      pubsel.onclick = async () => {
        pubsel.disabled = true; let n = 0;
        for (const id of sel) { try { await api(`/submissions/${id}`, { method: 'PATCH', body: { status: 'approved' } }); n++; $('#rv-bn', list).textContent = `${n} of ${sel.size} published`; } catch (err) { toast(err.message, true); break; } }
        toast(`Published ${n} to the Bird Wall.`); window.dispatchEvent(new Event('route'));
      };
    }
  };
  $('#smp-add', view).onclick = async (e) => {
    const b = e.currentTarget, st = $('#smp-s', view); b.disabled = true;
    try {
      const { added, problems } = await fillSamples((i, n, msg) => { st.textContent = `${msg} (${i} of ${n}). Keep this page open; it takes a few minutes.`; });
      toast(`Added ${added} sample bird${added === 1 ? '' : 's'}.${problems.length ? ` ${problems.length} skipped.` : ''}`);
      if (problems.length) console.warn('Skipped samples:\n' + problems.join('\n'));
      window.dispatchEvent(new Event('route'));
    } catch (err) { toast(err.message, true); b.disabled = false; }
  };
  $('#is-new', view).onclick = () => editIssue({ number: (issues[0]?.number || 0) + 1, title: '', theme: '', blurb: '', opens_at: '', closes_at: '' });
  const ie = $('#is-edit', view); if (ie) ie.onclick = () => editIssue(cur);
  $('#em-open', view).onclick = () => openEmail(d, cur, subs);
  let stop = false;
  const run = $('#ref-run', view);
  if (run) run.onclick = async () => {
    const todo = S.species.filter((x) => !x.ref_url), st = $('#ref-s', view), halt = $('#ref-stop', view);
    run.disabled = true; halt.hidden = false; stop = false; halt.onclick = () => (stop = true);
    let ok = 0, miss = 0, i = 0;
    const worker = async () => {
      while (!stop && i < todo.length) {
        const x = todo[i++];
        try { const r = await api('/reference/' + x.id, { method: 'POST', body: {} }); if (r.ok) ok++; else miss++; } catch { miss++; }
        st.textContent = `Looking up ${i} of ${todo.length}: ${ok} found, ${miss} without a usable photo. Keep this page open.`;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    toast(`Reference photos: ${ok} added${miss ? `, ${miss} without a usable photo` : ''}${stop ? ' (stopped)' : ''}.`);
    await loadAll(); window.dispatchEvent(new Event('route'));
  };
  const del = $('#smp-del', view); if (del) del.onclick = async () => {
    if (!confirm('Remove every sample bird from the wall? Real submissions are not affected.')) return;
    try { const { removed } = await clearSamples(); toast(`Removed ${removed} sample birds.`); window.dispatchEvent(new Event('route')); } catch (err) { toast(err.message, true); }
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
        <label class="f"><span>Behind the shot (the caption readers see)</span><textarea name="caption" rows="5" maxlength="2000">${esc(r.caption || '')}</textarea></label>
        <label class="f"><span>Issue</span><select name="issue_id"><option value="">None</option>${ISS.map((i) => `<option value="${i.id}" ${i.id === r.issue_id ? 'selected' : ''}>No. ${i.number}: ${esc(i.theme || i.title)}</option>`).join('')}</select></label>
        <label class="f"><span>Award (optional)</span><input name="award" list="award-names" value="${esc(r.award || '')}" placeholder="None"><datalist id="award-names">${AWARDS.map((a) => `<option value="${esc(a)}"></option>`).join('')}</datalist></label>
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
  const fields = () => { const v = Object.fromEntries(new FormData(q('#rf'))); return { bird: v.bird, credit_name: v.credit_name, region: v.region, featured: v.featured ? 1 : 0, caption: v.caption || '', award: (v.award || '').trim(), issue_id: v.issue_id ? +v.issue_id : null }; };
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

// Create or edit an issue. Dates are entered as California calendar days and stored as UTC instants.
function editIssue(it) {
  const day = (iso, back = 0) => (iso ? new Date(Date.parse(iso) - back).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) : '');
  const el = document.createElement('div'); el.className = 'modal mag-modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Issue"><button class="x" type="button">Close</button>
    <p class="mag-kicker">${it.id ? 'Edit issue' : 'New issue'}</p><h2>Issue No. ${it.number}</h2>
    <form id="if">
      <div class="add-defaults"><label class="f"><span>Number</span><input name="number" type="number" min="1" required value="${it.number}"></label>
        <label class="f"><span>Title (the season)</span><input name="title" required placeholder="Spring 2027" value="${esc(it.title)}"></label></div>
      <label class="f"><span>Theme</span><input name="theme" placeholder="Courtship" value="${esc(it.theme)}"></label>
      <label class="f"><span>The call for photos (a few sentences)</span><textarea name="blurb" rows="4" maxlength="1200">${esc(it.blurb)}</textarea></label>
      <div class="add-defaults"><label class="f"><span>Opens (first day)</span><input name="opens" type="date" required value="${day(it.opens_at)}"></label>
        <label class="f"><span>Closes (last day)</span><input name="closes" type="date" required value="${day(it.closes_at, 1)}"></label></div>
      <div class="wm-actions"><button type="submit" class="mag-btn solid">Save issue</button></div>
    </form></div>`;
  document.body.appendChild(el);
  el.querySelector('.x').onclick = () => el.remove();
  el.querySelector('#if').onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    // Midnight in California is 08:00 UTC in winter; an hour's difference in summer does not matter for a window of months.
    const at = (d, plus = 0) => new Date(Date.parse(d + 'T08:00:00Z') + plus * 864e5).toISOString();
    const body = { number: +v.number, title: v.title, theme: v.theme, blurb: v.blurb, opens_at: at(v.opens), closes_at: at(v.closes, 1) };
    try { await api(it.id ? `/issues/${it.id}` : '/issues', { method: it.id ? 'PATCH' : 'POST', body }); toast('Issue saved.'); el.remove(); window.dispatchEvent(new Event('route')); }
    catch (err) { toast(err.message, true); }
  };
}

// The two-week email, one region at a time, ready to copy.
function openEmail(d, issue, subs) {
  const el = document.createElement('div'); el.className = 'modal mag-modal wall-modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Two-week email"><button class="x" type="button">Close</button>
    <p class="mag-kicker">Two-week email</p><h2>Your nine new birds</h2>
    <div class="seg" role="group" aria-label="Region">${d.regions.map((r, i) => `<button type="button" data-r="${r}" aria-pressed="${i === 0}">${esc(REGION_NAMES[r])} (${subs.filter((s) => s.region === r).length})</button>`).join('')}</div>
    <div class="em-grid"><div><label class="f"><span>Subject</span><input id="em-sub" readonly></label>
        <label class="f"><span>Send to (paste into BCC)</span><textarea id="em-to" rows="3" readonly></textarea></label>
        <div class="wm-actions"><button type="button" class="mag-btn solid" data-copy="html">Copy formatted email</button><button type="button" class="mag-btn" data-copy="text">Copy as plain text</button><button type="button" class="mag-btn" data-copy="to">Copy addresses</button></div>
        <p class="wm-note">Paste the formatted email into a new message in Gmail or Apple Mail. Put the addresses in BCC so subscribers never see each other.</p></div>
      <div class="em-prev" id="em-prev"></div></div></div>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  q('.x').onclick = () => el.remove();
  let mail = null, to = '';
  const show = (r) => { mail = nineBirdsEmail(d, r, issue); to = subs.filter((s) => s.region === r).map((s) => s.email).join(', '); q('#em-sub').value = mail.subject; q('#em-to').value = to || 'No subscribers in this region yet.'; q('#em-prev').innerHTML = mail.html; };
  el.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { el.querySelectorAll('[data-r]').forEach((x) => x.setAttribute('aria-pressed', x === b)); show(b.dataset.r); }));
  el.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async () => {
    try {
      if (b.dataset.copy === 'html' && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([mail.html], { type: 'text/html' }), 'text/plain': new Blob([mail.text], { type: 'text/plain' }) })]);
      else await navigator.clipboard.writeText(b.dataset.copy === 'to' ? to : mail.text);
      toast('Copied.');
    } catch { toast('Could not copy. Select the text and copy it by hand.', true); }
  }));
  show(d.regions[0]);
}
