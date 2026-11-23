import { S, $, api, esc, modal, toast } from '../util.js';
import { BUILT_IN, REGION_NAMES, REGIONS, hasRegion, myRegion, setRegion, pickRegion } from '../wi.js';

export const DEFAULT_COVER = {
  line1: 'The Marshes at Dawn', line2: "California's Great Herons", line3: 'A Coastal Sanctuary',
  issue: 'No. 1', season: 'Winter 2026–27', headline: 'The\nGreat\nBlue',
  deck: "How a coastal giant thrives in California's changing wetlands",
  aside: 'A closer look at the heron that defines our rivers, marshes, and estuaries.',
  bird: 'Great Blue Heron', photo_id: null, credit: '',
};
export function coverData() {
  let c = {};
  try { c = JSON.parse(S.settings.cover || '{}'); } catch { c = {}; }
  return { ...DEFAULT_COVER, ...c };
}
const coverSrc = (c) => (c.photo_id ? `/media/${c.photo_id}/display` : BUILT_IN[c.bird]?.src || BUILT_IN['Great Blue Heron'].src);

export default async function cover(view) {
  document.body.classList.add('mag');
  const c = coverData();
  const lines = [c.line1, c.line2, c.line3].filter(Boolean);
  view.innerHTML = `<article class="cv" aria-label="This issue's cover">
    <div class="cv-text">
      <p class="cv-top"><span class="cv-no">${esc(c.issue)}</span><span>${esc(c.season)}</span></p>
      <h1 class="cv-title">California<br>Bird Atlas</h1>
      <div class="cv-feature">
        <p class="cv-hl">${esc(c.headline)}</p>
        <p class="cv-dk">${esc(c.deck)}</p>
      </div>
      ${lines.length ? `<ul class="cv-lines" aria-label="Also in this issue">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>
    <figure class="cv-art">
      <img src="${esc(coverSrc(c))}" alt="${esc(c.bird)} on the cover" fetchpriority="high">
      <p class="cv-jp" lang="ja" aria-hidden="true">カリフォルニア野鳥図鑑</p>
      <figcaption class="cv-cap"><b>${esc(c.bird)}.</b> ${esc(c.aside)}${c.credit ? ` <span class="cr">Photograph by ${esc(c.credit)}</span>` : ''}</figcaption>
    </figure>
    ${S.owner ? '<div class="cover-actions"><button type="button" class="mag-btn" id="edit-cover">Edit cover</button></div>' : ''}
  </article>
  <section class="how" aria-labelledby="how-h">
    <div class="mag-wrap">
      <p class="mag-kicker">How it works</p>
      <h2 id="how-h">Photograph California's birds, one season at a time.</h2>
      <ol class="how-steps">
        <li><span class="n">1</span><h3>Pick your region</h3><p>Tell us where you go birding. Nothing about your location is collected.</p>
          <div class="how-regions" role="group" aria-label="Your region">${REGIONS.map((r) => `<button type="button" data-r="${r}" aria-pressed="${hasRegion() && myRegion({ regions: REGIONS }) === r}">${REGION_NAMES[r]}</button>`).join('')}</div>
          <button type="button" class="linkish" id="how-which">Not sure which region you're in?</button></li>
        <li><span class="n">2</span><h3>Get your nine birds</h3><p>Every two weeks your region gets nine new birds: three easy, three that take a trip, three that are hard to find.</p>
          <a class="mag-btn solid" href="/this-season" data-link>See this season's birds</a></li>
        <li><span class="n">3</span><h3>Go out and photograph them</h3><p>Send your best shot. We cut the bird out and add it to the Bird Wall with your name. The best are published in the magazine.</p>
          <a class="mag-btn" href="/wall" data-link>See the Bird Wall</a></li>
      </ol>
    </div>
  </section>`;
  view.querySelectorAll('.how-regions [data-r]').forEach((b) => (b.onclick = () => { setRegion(b.dataset.r); window.dispatchEvent(new Event('route')); }));
  $('#how-which', view).onclick = pickRegion;
  if (S.owner) $('#edit-cover', view).onclick = () => editCover(c);
}

async function editCover(c) {
  const photos = await api('/photos');
  const f = (k, label, rows = 1) => `<label class="field"><span>${label}</span>${rows > 1 ? `<textarea name="${k}" rows="${rows}">${esc(c[k])}</textarea>` : `<input name="${k}" value="${esc(c[k])}">`}</label>`;
  const m = modal(`<span class="label">The cover</span><h2>Edit cover</h2>
    <form>
      <label class="field"><span>Photograph</span><select name="photo_id">
        <option value="">Built-in: Great Blue Heron</option>
        ${photos.map((p) => `<option value="${p.id}" ${+c.photo_id === p.id ? 'selected' : ''}>${esc(p.common_name)} · #${p.id}${p.visibility === 'public' ? '' : ' (private: make it public first)'}</option>`).join('')}
      </select></label>
      ${f('bird', 'Bird on the cover')}${f('credit', 'Photographer credit')}
      ${f('issue', 'Issue number')}${f('season', 'Season line')}${f('line1', 'Cover line 1')}${f('line2', 'Cover line 2')}${f('line3', 'Cover line 3')}
      ${f('headline', 'Headline (one word per line)', 3)}${f('deck', 'Line under the headline', 2)}${f('aside', 'Photo caption', 3)}
      <p class="note">Use a photo on a black or very dark background, with room on the left for the headline. Only public photos show to visitors.</p>
      <button class="btn solid" type="submit">Save cover</button>
    </form>`, { wide: true });
  const form = $('form', m.el);
  form.photo_id.onchange = () => { const p = photos.find((x) => x.id === +form.photo_id.value); if (p) form.bird.value = p.common_name; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const next = Object.fromEntries(new FormData(form));
    next.photo_id = next.photo_id ? +next.photo_id : null;
    try { await api('/settings', { method: 'PUT', body: { cover: JSON.stringify(next) } }); S.settings.cover = JSON.stringify(next); m.close(); toast('Cover saved.'); window.dispatchEvent(new Event('route')); }
    catch (err) { toast(err.message, true); }
  };
}
