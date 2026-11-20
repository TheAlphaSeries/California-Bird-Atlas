import { $, $$, esc } from '../util.js';
import { wi, SEASONS, SEASON_ORDER, currentSeason, seasonLabel, myRegion, setRegion, birdLink, birdName, levelOf } from '../wi.js';

const BLURB = { 1: 'Common and widespread. Expect them on an ordinary outing.', 2: 'Go to the right habitat. Usually found when you do.', 3: 'Scarce, local or hard to see. May take several tries.' };

export default async function fieldwork(view, seasonArg) {
  document.body.classList.add('mag');
  const d = await wi();
  const now = currentSeason();
  let season = SEASON_ORDER.includes(seasonArg) ? seasonArg : now;
  let region = myRegion(d);
  const sc = d.scoring;
  const draw = () => {
    const ri = d.regions.indexOf(region);
    const card = d.cards[season][region];
    const frequent = d.birds.filter((b) => b.cat === 'assign' && levelOf(b, ri, season) && ![...card['1'], ...card['2'], ...card['3']].includes(b.id)).length;
    view.innerHTML = `<div class="mag-wrap mag-page">
      <p class="mag-kicker">Fieldwork · ${esc(season === now ? seasonLabel(season) : SEASONS[season])}</p>
      <h1 class="mag-h">${season === now ? "This season's assignment" : `The ${SEASONS[season].toLowerCase()} card`}</h1>
      <p class="mag-deck">Nine birds for your region, three at each level. Pick the region you bird in. Nothing about where you are is collected.</p>
      <div class="pills" role="group" aria-label="Your region">${d.regions.map((r) => `<button type="button" class="pill" data-r="${r}" aria-pressed="${r === region}">${esc(d.region_names[r])}</button>`).join('')}</div>
      <div class="pills" role="group" aria-label="Season">${SEASON_ORDER.map((s) => `<button type="button" class="pill" data-s="${s}" aria-pressed="${s === season}">${SEASONS[s]}${s === now ? ' (now)' : ''}</button>`).join('')}</div>
      <div class="levels">${[1, 2, 3].map((L) => `<section class="level" aria-label="Level ${L}">
        <div class="top"><h3>Level ${L}</h3><span class="pts">${sc.base.assign[L - 1]} points</span></div>
        <p class="bl">${BLURB[L]}</p>
        ${card[String(L)].map((id) => d.byId.get(id)).map((b) => `<a class="bird" href="${birdLink(b)}" data-link>${birdName(b)}</a>`).join('') || '<p class="bl">To be announced.</p>'}
      </section>`).join('')}</div>
      <p class="mag-deck" style="margin-top:28px">Not on your card? ${frequent} other birds can be found in the ${esc(d.region_names[region])} this ${SEASONS[season].toLowerCase()}, and every one counts as a frequent visitor. <a href="/the-index" data-link style="color:var(--mag-accent)">Browse them in The Index</a>.</p>
      <p class="mag-deck">This card is a trial run. Cards become final when the editor approves them before each season.</p>

      <section class="mag-section" aria-labelledby="sc-h">
        <p class="mag-kicker">Scoring</p>
        <h2 id="sc-h">How points work</h2>
        <table class="score-table">
          <thead><tr><th>Photo of</th><th>Points</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>A bird on your card</td><td class="n">${sc.base.assign.join(' / ')}</td><td>Level 1, 2 or 3.</td></tr>
            <tr><td>A frequent visitor</td><td class="n">${sc.base.frequent.join(' / ')}</td><td>Any other bird with a level in your region this season. First photo of each bird per season.</td></tr>
            <tr><td>A night bird</td><td class="n">${sc.base.night}</td><td>Nighthawks, poorwill, whip-poor-will.</td></tr>
            <tr><td>An offshore or island bird</td><td class="n">${sc.base.offshore}</td><td>Seabirds seen from a boat, and Island Scrub-Jay.</td></tr>
            <tr><td>A scarce bird</td><td class="n">${sc.base.scarce}</td><td>Native but too rare to assign. First photo of each per year.</td></tr>
            <tr><td>A rare visitor</td><td class="n">${sc.base.rare}</td><td>On the state review list. +${sc.bonus.documented} if you send it to the California Bird Records Committee.</td></tr>
            <tr><td>A sensitive bird</td><td class="n">0</td><td>Owls and nest, roost or colony birds can go in the Gallery but never score.</td></tr>
            <tr><td>Star rating</td><td class="n">×${sc.stars.join(' ×')}</td><td>Every scored photo is rated 1 to 5 stars. Points × the rating, rounded up.</td></tr>
            <tr><td>A better photo later</td><td class="n">${sc.reupload.share * 100}%</td><td>Up to ${sc.reupload.max} re-uploads per bird per season earn ${sc.reupload.share * 100}% of the extra points.</td></tr>
            <tr><td>Bonuses</td><td class="n">+${sc.bonus.level} / +${sc.bonus.card}</td><td>All three birds in a level / all nine on your card in one season.</td></tr>
            <tr><td>Featured</td><td class="n">+${sc.bonus.issue} / +${sc.bonus.annual}</td><td>In a seasonal issue / in the year-end edition.</td></tr>
            <tr><td>Posting</td><td class="n">+${sc.activity.post}</td><td>Each post, up to ${sc.activity.weekly_cap} a week. +${sc.activity.streak} a week for a streak of weekly posts, up to +${sc.activity.streak_cap}.</td></tr>
          </tbody>
        </table>
        <p class="mag-deck" style="margin-top:20px">No points for photos taken with bait, playback, or by flushing birds or disturbing nests. No exact location is ever published for a scarce or rare bird.</p>
      </section>
    </div>`;
    $$('[data-r]', view).forEach((b) => (b.onclick = () => { region = b.dataset.r; setRegion(region); draw(); }));
    $$('[data-s]', view).forEach((b) => (b.onclick = () => { season = b.dataset.s; draw(); }));
  };
  draw();
}
