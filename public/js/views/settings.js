import { S, $, $$, api, esc, toast, NATIVE, fmtDate } from '../util.js';
import { signIn, signOut } from '../app.js';

export default async function settings(view) {
  const withRef = S.species.filter((s) => s.ref_url).length;
  view.innerHTML = `<div class="wrap settings">
    <header class="page-head"><span class="label">Settings</span><h1>${S.owner ? 'The workroom' : 'Owner sign-in'}</h1></header>
    <section><h2>Access</h2>
      ${S.owner ? '<p>You are signed in as the owner. Visitors can read the field guide and anything you mark public; they cannot see private observations, private photographs or original files.</p><button class="btn" id="out" type="button">Sign out</button>'
        : `<p>${S.configured ? 'Sign in to record observations, upload photographs and edit the catalog.' : 'No owner password has been set. In the Cloudflare dashboard, open this Worker, go to Settings, then Variables and Secrets, and add a secret named ADMIN_PASSWORD.'}</p><button class="btn solid" id="in" type="button">Sign in</button>`}
    </section>
    ${S.owner ? `
    <section id="goal"><h2>What counts toward the goal</h2><p>Completion percentages across the site use the species in the groups ticked here as the denominator.</p>
      <div class="checks">${NATIVE.map((n) => `<label><input type="checkbox" data-goal="${n}" ${S.goal[n] ? 'checked' : ''}> ${n} <span class="caption">(${S.species.filter((s) => s.native_status === n).length} species)</span></label>`).join('')}</div>
      <p style="margin-top:14px"><label class="field" style="max-width:320px"><span>New observations and photographs are</span><select id="vis"><option value="private">Private by default</option><option value="public" ${S.settings.default_visibility === 'public' ? 'selected' : ''}>Public by default</option></select></label></p>
      <button class="btn solid" id="save-goal" type="button">Save</button></section>
    <section><h2>Photograph storage</h2>
      ${S.storage === 'r2' ? '<p>Originals are archived in R2 storage alongside a 2560-pixel display copy and a thumbnail. Originals can be downloaded from the Gallery and are never shown to visitors.</p>'
        : '<p class="note">R2 storage is not connected. The site is keeping a 2560-pixel display copy and a thumbnail of each upload in the database, and <b>original files are not being archived</b>. Keep your originals. To archive them here, enable R2 in the Cloudflare dashboard, create a bucket named <span class="mono">california-bird-atlas-photos</span>, and uncomment the r2_buckets block in wrangler.jsonc. Photographs uploaded before that keep their display copies only.</p>'}
    </section>
    <section><h2>Reference photographs</h2>
      <p>${withRef} of ${S.species.length} species have a reference photograph. The lookup takes the lead image of each species' Wikipedia article, and keeps it only if it is hosted on Wikimedia Commons under a free license. Author and license are stored and shown with every image. Lead images are occasionally an illustration or a different plumage than you want; replace any of them from the species page.</p>
      <label class="field" style="max-width:420px"><span>Which species</span><select id="ref-scope"><option value="bay">Bay Area starter collection without a reference</option><option value="goal">Goal species without a reference</option><option value="all">Every species without a reference</option></select></label>
      <button class="btn solid" id="ref-run" type="button">Load reference photographs</button> <button class="btn quiet" id="ref-stop" type="button" hidden>Stop</button>
      <div class="log" id="ref-log" hidden></div></section>
    <section><h2>Backup</h2><p>Download every record in the database (species, observations, photograph records, custom columns, saved views) as one JSON file. Photograph files are not inside the backup.</p>
      <a class="btn" href="/api/export">Download backup</a></section>` : ''}
    <section id="sources"><h2>Sources and data notes</h2>
      <table class="plain"><thead><tr><th>Source</th><th>Used for</th><th>Recorded</th></tr></thead><tbody>${S.sources.map((s) => `<tr><td><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a></td><td>${esc(s.note)}</td><td class="mono">${esc(fmtDate(s.updated_at))}</td></tr>`).join('')}</tbody></table>
      <p class="caption" style="margin-top:14px">Seasonal status, habitat tags and the 28 written profiles were compiled for this site and can be corrected from each species page or the Scientific Catalog. No recent-sighting data is connected yet.</p></section>
  </div>`;
  if ($('#in', view)) $('#in', view).onclick = signIn;
  if (!S.owner) return;
  $('#out', view).onclick = signOut;
  $('#save-goal', view).onclick = async () => {
    const goal = {}; $$('[data-goal]', view).forEach((c) => (goal[c.dataset.goal] = c.checked));
    try { await api('/settings', { method: 'PUT', body: { goal, default_visibility: $('#vis', view).value } }); toast('Saved.'); window.dispatchEvent(new Event('atlas:changed')); } catch (e) { toast(e.message, true); }
  };
  let stop = false;
  $('#ref-stop', view).onclick = () => (stop = true);
  $('#ref-run', view).onclick = async () => {
    const scope = $('#ref-scope', view).value;
    const list = S.species.filter((s) => !s.ref_url && (scope === 'all' || (scope === 'bay' ? s.bay_area : S.goal[s.native_status])));
    const log = $('#ref-log', view), run = $('#ref-run', view), halt = $('#ref-stop', view);
    if (!list.length) return toast('Every species in that group already has a reference photograph.');
    log.hidden = false; halt.hidden = false; run.disabled = true; stop = false; let ok = 0, miss = 0, lines = [];
    for (const [i, s] of list.entries()) {
      if (stop) break;
      let line;
      try { const r = await api('/reference/' + s.id, { method: 'POST', body: {} }); if (r.ok) { ok++; line = `${s.common_name}: loaded (${r.license}, ${r.credit})`; } else { miss++; line = `${s.common_name}: skipped. ${r.reason}`; } }
      catch (e) { miss++; line = `${s.common_name}: failed. ${e.message}`; }
      lines.unshift(`${i + 1}/${list.length}  ${line}`); log.textContent = lines.slice(0, 200).join('\n');
      await new Promise((r) => setTimeout(r, 250));
    }
    run.disabled = false; halt.hidden = true;
    toast(`Reference photographs: ${ok} loaded, ${miss} skipped${stop ? ' (stopped early)' : ''}.`);
    const keep = log.textContent; await new Promise((r) => setTimeout(r, 50));
    window.dispatchEvent(new Event('atlas:changed'));
    setTimeout(() => { const l = document.getElementById('ref-log'); if (l) { l.hidden = false; l.textContent = keep; } }, 800);
  };
}
