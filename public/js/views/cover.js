import { S, $, api, esc, modal, toast } from '../util.js';
import { wi, BUILT_IN, REGION_NAMES, REGIONS, hasRegion, myRegion, setRegion, pickRegion, currentSeason } from '../wi.js';
import { seasonCards, latestOccurrence } from '../rotation.js';
import { heartButton, bindHearts } from '../hearts.js';
import { openFull } from '../viewer.js';

// Photo of the week: changes every Monday (California time) by itself. It picks from photos put up in the last
// four weeks that came with a story, falling back to any photo with a story, then any photo; the most-hearted
// come first, and the week number steps through them so the same photo doesn't sit there for months.
function weekOf(now = new Date()) {
  const ca = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = Math.floor(Date.UTC(ca.getFullYear(), ca.getMonth(), ca.getDate()) / 864e5);
  const monday = day - ((new Date(day * 864e5).getUTCDay() + 6) % 7);
  return { n: Math.floor(monday / 7), start: new Date(monday * 864e5), end: new Date((monday + 6) * 864e5) };
}
export function photoOfTheWeek(rows, now = new Date()) {
  const w = weekOf(now), real = rows.filter((r) => !r.static);
  const recent = real.filter((r) => r.caption && r.approved_at && now - Date.parse(r.approved_at) < 28 * 864e5);
  const pool = (recent.length ? recent : real.filter((r) => r.caption).length ? real.filter((r) => r.caption) : rows)
    .slice().sort((a, b) => (b.hearts || 0) - (a.hearts || 0) || String(a.id).localeCompare(String(b.id)));
  if (!pool.length) return null;
  const top = pool.slice(0, Math.max(1, Math.min(pool.length, 5)));
  return { r: top[w.n % top.length], week: w };
}

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
  const c = coverData();
  const lines = [c.line1, c.line2, c.line3].filter(Boolean);
  const builtIn = !c.photo_id && (c.bird === 'Great Blue Heron' || !BUILT_IN[c.bird]);
  // The nine birds assigned right now in the reader's region, as cover lines.
  const d = await wi();
  const region = myRegion(d), season = currentSeason(), occ = latestOccurrence(season);
  const card = seasonCards(d, region, season, occ.year)[occ.window];
  const nine = [...card[1], ...card[2], ...card[3]].map((id) => d.byId.get(id).n);
  // Slides: this edition's cover first, then featured birds from the Bird Wall.
  let wallRows = await api('/wall').catch(() => []);
  if (!wallRows.length) wallRows = (await fetch('/data/wall-samples.json').then((r) => r.json()).catch(() => [])).map((x) => ({ ...x, credit_name: x.credit, static: true }));
  const potw = photoOfTheWeek(wallRows);
  const picks = [...wallRows.filter((r) => r.featured), ...wallRows.filter((r) => !r.featured)].slice(0, 5);
  const slides = [{ edition: true }, ...picks.map((r) => ({
    bird: r.bird, src: r.static ? r.src : `/media/sub/${r.id}/cutout`, region: REGION_NAMES[r.region] || '',
    credit: r.credit_name + (r.license ? `, ${r.license}, via Wikimedia Commons` : ''),
  }))];
  const textOf = (sl) => sl.edition
    ? `<p class="mag-kicker">Cover story</p><p class="cv2-hl">${esc(c.headline)}</p><p class="cv2-dk">${esc(c.deck)}</p>
      ${lines.length ? `<ul class="cv2-lines" aria-label="Also in this issue">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`
    : `<p class="mag-kicker">From the Bird Wall</p><p class="cv2-hl">${esc(sl.bird.replace(/ (?=[^ ]+$)/, '\n'))}</p>
      <p class="cv2-dk">${sl.region ? `Photographed in the ${esc(sl.region)}. ` : ''}One of the birds readers have put on the wall.</p>
      <p style="margin-top:24px"><a class="mag-btn solid" href="/wall" data-link>See the Bird Wall</a></p>`;
  const artOf = (sl) => sl.edition
    ? `<div class="cv2-art">
        <img class="base" src="${esc(coverSrc(c))}" alt="${esc(c.bird)} on the cover" fetchpriority="high">
        ${builtIn ? `<img class="cut" src="/img/great-blue-heron-cut.webp" alt="" aria-hidden="true">
        <span class="mk" style="left:47%;top:8%">1</span><span class="mk" style="left:83%;top:33%">2</span><span class="mk" style="left:60%;top:70%">3</span>` : ''}
      </div>
      <figcaption class="cv-cap"><b>${esc(c.bird)}.</b> ${esc(c.aside)}
        ${builtIn ? '<span class="notes"><b>1</b> Black plumes trail from the crown. <b>2</b> A dagger bill for spearing fish. <b>3</b> Long breast plumes in the breeding season.</span>' : ''}
        ${c.credit ? `<span class="cr">Photo ● ${esc(c.credit)}</span>` : ''}</figcaption>`
    : `<div class="cv2-art cutonly"><img src="${esc(sl.src)}" alt="${esc(sl.bird)}"></div>
      <figcaption class="cv-cap"><b>${esc(sl.bird)}.</b> <span class="cr">Photo ● ${esc(sl.credit)}</span></figcaption>`;
  view.innerHTML = `<article class="cv2" aria-label="This issue's cover" aria-roledescription="carousel">
    <h1 class="cv2-title">California<br>Bird Atlas</h1>
    <div class="cv2-text"><div id="cv-text" aria-live="polite">${textOf(slides[0])}</div>
      ${slides.length > 1 ? `<div class="cv2-nav" role="group" aria-label="Cover birds">
        <button type="button" id="cv-prev" aria-label="Previous bird">←</button><span id="cv-count">1 / ${slides.length}</span><button type="button" id="cv-next" aria-label="Next bird">→</button>
        <button type="button" id="cv-pause" aria-pressed="false">Pause</button></div>` : ''}
    </div>
    <figure class="cv2-bird" id="cv-bird">${artOf(slides[0])}</figure>
    <p class="cv2-sticker" aria-hidden="true"><b>9</b>new birds<br>every 2 weeks</p>
    ${S.owner ? '<div class="cover-actions"><button type="button" class="mag-btn" id="edit-cover">Edit cover</button></div>' : ''}
  </article>
  ${potw ? (() => { const r = potw.r, fmt = (x) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return `<section class="potw" aria-labelledby="potw-h">
    <button type="button" class="potw-art" id="potw-full" aria-label="${esc(r.bird)}: see it full screen"><img loading="lazy" src="${r.static ? esc(r.src) : `/media/sub/${r.id}/display`}" alt=""></button>
    <div class="potw-text">
      <p class="mag-kicker">Photo of the week, ${fmt(potw.week.start)} – ${fmt(potw.week.end)}</p>
      <h2 id="potw-h">${esc(r.bird)}</h2>
      ${r.caption ? `<p class="potw-story">${esc(r.caption)}</p>` : `<p class="potw-story">${r.static ? 'A sample bird from Wikimedia Commons, standing in until readers send their own. Next week this spot goes to a reader’s photo and the story behind it.' : 'Photographed by a reader and put up on the Bird Wall.'}</p>`}
      <p class="potw-by">Photo ● ${esc(r.credit_name)}${r.region ? `, ${esc(REGION_NAMES[r.region] || '')}` : ''}${r.license ? `, ${esc(r.license)}` : ''}</p>
      <p class="potw-acts">${heartButton(r)}<a class="mag-btn" href="/wall" data-link>See the Bird Wall</a></p>
    </div></section>`; })() : ''}
  <a class="cv2-band" href="/this-season" data-link>
    <span class="lead">Assigned now in the ${esc(d.region_names[region])}</span>
    <span class="names">${nine.map((n) => `<span>${esc(n)}</span>`).join('')}</span>
    <span class="go">See your nine birds</span>
  </a>
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
          <span class="how-btns"><a class="mag-btn" href="/field-card" data-link>Print your field card</a><a class="mag-btn" href="/wall" data-link>See the Bird Wall</a></span></li>
      </ol>
    </div>
  </section>`;
  view.querySelectorAll('.how-regions [data-r]').forEach((b) => (b.onclick = () => { setRegion(b.dataset.r); window.dispatchEvent(new Event('route')); }));
  $('#how-which', view).onclick = pickRegion;
  if (potw) { $('#potw-full', view).onclick = () => openFull(potw.r.static ? potw.r.src : `/media/sub/${potw.r.id}/display`, potw.r.bird); bindHearts(view, wallRows); }
  if (S.owner) $('#edit-cover', view).onclick = () => editCover(c);
  if (slides.length < 2) return;
  // Rotate the cover bird. Stops for good when the reader pauses it, and never auto-plays with reduced motion.
  slides.slice(1).forEach((sl) => { const im = new Image(); im.src = sl.src; });
  const root = view.querySelector('.cv2');
  let at = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches, busy = false;
  const show = (i) => {
    if (busy) return; busy = true;
    at = (i + slides.length) % slides.length;
    root.classList.add('swap');
    setTimeout(() => {
      $('#cv-text', view).innerHTML = textOf(slides[at]); $('#cv-bird', view).innerHTML = artOf(slides[at]);
      $('#cv-count', view).textContent = `${at + 1} / ${slides.length}`;
      root.classList.remove('swap'); busy = false;
    }, 240);
  };
  const pauseBtn = $('#cv-pause', view);
  const setPaused = (v) => { paused = v; pauseBtn.setAttribute('aria-pressed', v); pauseBtn.textContent = v ? 'Play' : 'Pause'; };
  setPaused(paused);
  $('#cv-prev', view).onclick = () => { setPaused(true); show(at - 1); };
  $('#cv-next', view).onclick = () => { setPaused(true); show(at + 1); };
  pauseBtn.onclick = () => setPaused(!paused);
  const timer = setInterval(() => {
    if (!document.body.contains(root)) return clearInterval(timer);
    if (!paused && !document.hidden) show(at + 1);
  }, 7000);
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
