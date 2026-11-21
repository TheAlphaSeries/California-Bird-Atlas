import { S, esc, api, toast } from './util.js';
import { BUILT_IN } from './wi.js';

// The picture to show for a bird: a published photograph, the built-in cover photo, or a credited reference photo
// from Wikimedia Commons. Returns null when there is none.
export function birdPic(b, size = 'display') {
  const sp = S.species.find((s) => s.common_name === b.n);
  if (sp?.photo_id) return { src: `/media/${sp.photo_id}/${size}`, kind: 'own', sp };
  if (BUILT_IN[b.n]) return { src: BUILT_IN[b.n].src, kind: 'built', sp };
  if (sp?.ref_url) return { src: size === 'thumb' ? (sp.ref_thumb || sp.ref_url) : sp.ref_url, kind: 'ref', sp, credit: sp.ref_credit, license: sp.ref_license, license_url: sp.ref_license_url, source: sp.ref_source_url };
  return null;
}

// Credit line for a reference photo, with the report link.
export function refCredit(pic) {
  if (pic?.kind !== 'ref') return '';
  const lic = pic.license_url ? `<a href="${esc(pic.license_url)}" target="_blank" rel="noopener">${esc(pic.license)}</a>` : esc(pic.license || '');
  return `<figcaption class="ref-cap"><span><b>Reference photo</b> · ${esc(pic.credit || 'Unknown photographer')}${lic ? `, ${lic}` : ''}, via ${pic.source ? `<a href="${esc(pic.source)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : 'Wikimedia Commons'}</span>
    <button type="button" class="linkish ref-report" data-sp="${pic.sp.id}">Wrong photo? Tell us</button></figcaption>`;
}

const REASONS = [['wrong-species', "It's a different bird"], ['plumage', "Right bird, but not how it usually looks in California"], ['not-photo', "It's a drawing, map or diagram"], ['quality', 'Too small, blurry or dark to tell'], ['other', 'Something else']];

export function reportPhoto(spId) {
  const sp = S.species.find((s) => s.id === spId);
  if (!sp) return;
  const el = document.createElement('div'); el.className = 'modal mag-modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Report this photo"><button class="x" type="button">Close</button>
    <p class="mag-kicker">Reference photo</p><h2>Something wrong with the ${esc(sp.common_name)} photo?</h2>
    <p class="mag-deck" style="font-size:16px">Reference photos are picked automatically from Wikimedia Commons, so a few will be off. Tell us what's wrong and we'll swap it.</p>
    <form id="rp">
      <fieldset class="f radios"><legend>What's wrong</legend>${REASONS.map(([k, l], i) => `<label><input type="radio" name="reason" value="${k}" ${i ? '' : 'checked'}> ${esc(l)}</label>`).join('')}</fieldset>
      <label class="f"><span>Anything else? (optional)</span><textarea name="note" rows="3" maxlength="500" placeholder="For example: this is a female; the male is more recognisable"></textarea></label>
      <div class="wm-actions"><button type="submit" class="mag-btn solid">Send report</button></div>
    </form></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  el.querySelector('.x').onclick = close;
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  el.querySelector('#rp').onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    try { await api('/reports', { method: 'POST', body: { species_id: sp.id, reason: v.reason, note: v.note } }); close(); toast('Thanks. We\'ll take a look.'); }
    catch (err) { toast(err.message, true); }
  };
  el.querySelector('input').focus();
}

// Wire up every "Wrong photo?" button inside a container.
export function bindReports(root) {
  root.querySelectorAll('.ref-report').forEach((b) => {
    if (S.owner) b.textContent = 'Change photo';
    b.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (S.owner) { const { pickReference } = await import('./refpick.js'); pickReference(+b.dataset.sp, [], () => window.dispatchEvent(new Event('route'))); }
      else reportPhoto(+b.dataset.sp);
    };
  });
}
