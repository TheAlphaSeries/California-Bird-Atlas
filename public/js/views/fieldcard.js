import { esc } from '../util.js';
import { wi, SEASONS, SEASON_ORDER, currentSeason, myRegion, REGIONS } from '../wi.js';
import { seasonCards, latestOccurrence, windowSpan, WINDOWS } from '../rotation.js';
import { birdPic } from '../refphoto.js';

// A one-page field card of the nine birds, laid out for printing (letter or A4).
// /field-card?r=BAY&s=F&a=5 prints a given region, season and assignment; with no query it prints the current one.
const LEVELS = ['Easy to find', 'Takes a trip', 'Hard to find'];
const fmt = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default async function fieldCard(view) {
  const d = await wi(), p = new URLSearchParams(location.search);
  const region = REGIONS.includes(p.get('r')) ? p.get('r') : myRegion(d);
  const season = SEASON_ORDER.includes(p.get('s')) ? p.get('s') : currentSeason();
  const occ = latestOccurrence(season), a = Math.min(WINDOWS - 1, Math.max(0, p.has('a') ? +p.get('a') : occ.window));
  const card = seasonCards(d, region, season, occ.year)[a], span = windowSpan(season, occ.year, a);
  const ri = d.regions.indexOf(region);
  const bird = (id, n) => { const b = d.byId.get(id), pic = birdPic(b, 'thumb');
    return `<li class="fc-bird"><span class="fc-n">${n}</span>
      <span class="fc-pic">${pic ? `<img src="${esc(pic.src)}" alt="">` : `<b>${+b.id.slice(3)}</b>`}</span>
      <span class="fc-nm"><b>${esc(b.n)}</b><i>${esc(b.sci)}</i><small>${esc(b.fam)}</small></span>
      <span class="fc-tick"><span><i></i>Seen</span><span><i></i>Photographed</span></span>
      <span class="fc-note"><span>Where, when</span></span></li>`; };
  let n = 0;
  view.innerHTML = `<div class="fc-page">
    <div class="fc-bar no-print"><a class="linkish" href="/this-season" data-link>Back to This Season</a><button type="button" class="mag-btn solid" id="fc-print">Print this card</button></div>
    <article class="fc-sheet" aria-label="Field card">
      <header class="fc-head">
        <div><p class="fc-kick">Field card</p><h1>Nine birds</h1></div>
        <dl><div><dt>Region</dt><dd>${esc(d.region_names[region])}</dd></div><div><dt>Dates</dt><dd>${fmt(span.start)} – ${fmt(span.end - 864e5)}</dd></div><div><dt>Assignment</dt><dd>${SEASONS[season]} ${a + 1} of ${WINDOWS}</dd></div></dl>
      </header>
      ${[1, 2, 3].map((L) => `<section class="fc-level"><h2><span>${L}</span>${LEVELS[L - 1]}<em>${d.scoring.base.assign[L - 1]} points each</em></h2>
        <ol>${card[L].map((id) => bird(id, ++n)).join('')}</ol></section>`).join('')}
      <footer class="fc-foot"><p><b>Field rules.</b> No bait, no playback, no flushing, keep well back from nests. No photo is worth stressing a bird.</p>
        <p><b>Send your photos</b> ${esc(location.host)}/submit</p></footer>
    </article></div>`;
  view.querySelector('#fc-print').onclick = () => window.print();
  void ri;
}
