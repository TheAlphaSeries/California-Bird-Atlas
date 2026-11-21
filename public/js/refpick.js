import { S, esc, api, toast } from './util.js';

// Editor: replace a bird's reference photo with another freely licensed photo from Wikimedia Commons.
const OK_LICENSE = /^(cc0|cc[ -]by|public domain|pd)/i;
const text = (h) => new DOMParser().parseFromString(String(h || ''), 'text/html').body.textContent.replace(/\s+/g, ' ').trim();

async function search(q) {
  const p = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '24', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '330', format: 'json', origin: '*' });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);
  if (!r.ok) throw new Error('Wikimedia Commons answered ' + r.status);
  const pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages.map((pg) => {
    const ii = pg.imageinfo?.[0]; if (!ii) return null;
    const m = ii.extmetadata || {};
    return { title: pg.title, thumb: ii.thumburl, mime: ii.mime, license: text(m.LicenseShortName?.value), credit: text(m.Artist?.value) };
  }).filter((x) => x && /^image\/(jpeg|png|webp)/.test(x.mime) && OK_LICENSE.test(x.license));
}

// reports: open reports for this bird (optional). onDone is called after any change.
export function pickReference(spId, reports = [], onDone = () => {}) {
  const sp = S.species.find((s) => s.id === spId);
  if (!sp) return;
  const REASON = { 'wrong-species': 'Different bird', plumage: 'Not typical plumage', 'not-photo': 'Not a photo', quality: 'Poor quality', other: 'Other' };
  const el = document.createElement('div'); el.className = 'modal mag-modal wall-modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Reference photo"><button class="x" type="button">Close</button>
    <p class="mag-kicker">Reference photo</p><h2>${esc(sp.common_name)} <i class="mag-sci" style="font-size:18px">${esc(sp.scientific_name)}</i></h2>
    <div class="rp-now">${sp.ref_thumb ? `<img src="${esc(sp.ref_thumb)}" alt="Current photo">` : '<div class="ph">No photo</div>'}
      <div>${sp.ref_url ? `<p>Now: ${esc(sp.ref_credit || '')}, ${esc(sp.ref_license || '')}</p>` : '<p>No reference photo yet.</p>'}
      ${reports.length ? `<ul class="rp-reports">${reports.map((r) => `<li><b>${esc(REASON[r.reason] || r.reason)}</b>${r.note ? `: ${esc(r.note)}` : ''}</li>`).join('')}</ul>` : ''}
      <div class="wm-actions">${reports.length ? '<button type="button" class="mag-btn" id="rp-keep">Keep this photo</button>' : ''}${sp.ref_url ? '<button type="button" class="mag-btn" id="rp-clear">Remove photo</button>' : ''}</div></div></div>
    <form id="rp-q" class="rp-q"><label class="f" style="flex:1"><span>Search Wikimedia Commons</span><input name="q" value="${esc(sp.scientific_name)}"></label><button class="mag-btn" type="submit">Search</button></form>
    <p class="mag-deck" style="font-size:14px">Openly licensed photos only. Click one to use it.</p>
    <div class="rp-grid" id="rp-grid"><p class="mag-deck">Searching…</p></div></div>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  q('.x').onclick = close;
  const done = (msg) => { toast(msg); close(); window.dispatchEvent(new Event('atlas:changed')); onDone(); };
  const keep = q('#rp-keep'); if (keep) keep.onclick = async () => { try { await api(`/reports/species/${spId}`, { method: 'PATCH', body: { status: 'dismissed' } }); done('Reports dismissed; photo kept.'); } catch (e) { toast(e.message, true); } };
  const clr = q('#rp-clear'); if (clr) clr.onclick = async () => { try { await api(`/reference/${spId}`, { method: 'POST', body: { clear: true } }); done('Photo removed.'); } catch (e) { toast(e.message, true); } };
  const run = async (term) => {
    const grid = q('#rp-grid'); grid.innerHTML = '<p class="mag-deck">Searching…</p>';
    try {
      const hits = await search(term);
      grid.innerHTML = hits.map((h, i) => `<button type="button" class="rp-hit" data-i="${i}"><img loading="lazy" src="${esc(h.thumb)}" alt=""><span>${esc(h.credit.slice(0, 40))} · ${esc(h.license)}</span></button>`).join('') || '<p class="mag-deck">No openly licensed photos found. Try the English name.</p>';
      grid.querySelectorAll('.rp-hit').forEach((b) => (b.onclick = async () => {
        b.disabled = true;
        try { const r = await api(`/reference/${spId}`, { method: 'POST', body: { file: hits[+b.dataset.i].title } }); if (r.ok) done('New reference photo saved.'); else { toast(r.reason, true); b.disabled = false; } }
        catch (e) { toast(e.message, true); b.disabled = false; }
      }));
    } catch (e) { grid.innerHTML = `<p class="mag-deck">${esc(e.message)}</p>`; }
  };
  q('#rp-q').onsubmit = (e) => { e.preventDefault(); run(q('#rp-q input').value); };
  run(sp.scientific_name);
}
