import { S, $, api, esc, modal, toast } from '../util.js';
import { BUILT_IN, REGION_NAMES, REGIONS, hasRegion, myRegion, setRegion, pickRegion } from '../wi.js';

export const DEFAULT_COVER = {
  line1: 'The Marshes at Dawn', line2: "California's Great Herons", line3: 'A Coastal Sanctuary',
  season: 'Spring 2027', headline: 'The\nGreat\nBlue',
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
  view.innerHTML = `<article class="cover" aria-label="This issue's cover">
    <div class="cover-lines"><span>${esc(c.line1)}</span><span class="bar" aria-hidden="true">|</span><span>${esc(c.line2)}</span><span class="bar" aria-hidden="true">|</span><span>${esc(c.line3)}</span></div>
    <header class="cover-head">
      <p class="cover-state">CALIFORNIA</p>
      <h1 class="cover-title">BIRD ATLAS</h1>
      <p class="cover-season">${esc(c.season)}</p>
    </header>
    <div class="cover-art">
      <div class="cover-left"><p class="hl">${esc(c.headline)}</p><p class="dk">${esc(c.deck)}</p></div>
      <img src="${esc(coverSrc(c))}" alt="${esc(c.bird)} on the cover" fetchpriority="high">
      <div class="cover-right"><p>${esc(c.aside)}</p></div>
    </div>
    <p class="cover-credit">Cover: ${esc(c.bird)}${c.credit ? ' · ' + esc(c.credit) : ''}</p>
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
        <li><span class="n">2</span><h3>Get your nine birds</h3><p>Each season your region gets nine birds: three easy, three that take a trip, three that are hard to find.</p>
          <a class="mag-btn solid" href="/this-season" data-link>See this season's birds</a></li>
        <li><span class="n">3</span><h3>Go out and photograph them</h3><p>Harder birds score more points. The best photos are published in the next issue and the year-end edition.</p>
          <a class="mag-btn" href="/gallery" data-link>See the Gallery</a></li>
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
      ${f('season', 'Season line')}${f('line1', 'Cover line 1')}${f('line2', 'Cover line 2')}${f('line3', 'Cover line 3')}
      ${f('headline', 'Headline (one word per line)', 3)}${f('deck', 'Line under the headline', 2)}${f('aside', 'Note on the right', 3)}
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
