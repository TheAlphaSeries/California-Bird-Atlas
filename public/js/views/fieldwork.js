import { $, $$, esc } from '../util.js';
import { birdPic } from '../refphoto.js';
import { wi, SEASONS, SEASON_ORDER, currentSeason, myRegion, pickRegion, hasRegion, birdLink, birdName, levelOf } from '../wi.js';
import { seasonCards, latestOccurrence, windowSpan, WINDOWS } from '../rotation.js';

const DAY = 864e5;
const fmt = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const range = (sp) => `${fmt(sp.start)} – ${fmt(sp.end - DAY)}`;
const occLabel = (s, y) => `${SEASONS[s]} ${s === 'W' ? `${y}–${String(y + 1).slice(2)}` : y}`;

const BLURB = { 1: 'Common and widespread. Expect them on an ordinary outing.', 2: 'Go to the right habitat. Usually found when you do.', 3: 'Scarce, local or hard to see. May take several tries.' };

export default async function fieldwork(view, seasonArg) {
  document.body.classList.add('mag');
  const d = await wi();
  const now = currentSeason();
  let season = SEASON_ORDER.includes(seasonArg) ? seasonArg : now;
  let region = myRegion(d);
  let pick = null; // which card is open; null = the latest one
  const sc = d.scoring;
  const draw = () => {
    const ri = d.regions.indexOf(region);
    const occ = latestOccurrence(season);
    const cards = seasonCards(d, region, season, occ.year);
    const shownIdx = pick ?? occ.window;
    const card = cards[shownIdx];
    const span = windowSpan(season, occ.year, shownIdx);
    const isNow = occ.live && shownIdx === occ.window;
    const curSpan = windowSpan(season, occ.year, occ.window);
    const daysLeft = Math.round((curSpan.end - occ.today) / DAY);
    const nextLabel = occ.window < WINDOWS - 1 ? 'New birds' : `${SEASONS[SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % 4]]} birds`;
    const seasonEnd = windowSpan(season, occ.year, WINDOWS - 1).end - DAY;
    const frequent = d.birds.filter((b) => b.cat === 'assign' && levelOf(b, ri, season) && ![...card['1'], ...card['2'], ...card['3']].includes(b.id)).length;
    view.innerHTML = `<div class="mag-wrap mag-page">
      <p class="mag-kicker">${esc(occLabel(season, occ.year))}, assignment ${shownIdx + 1} of ${WINDOWS}</p>
      <h1 class="mag-h">${isNow ? 'Your nine birds' : `Nine birds, ${esc(range(span))}`}</h1>
      <p class="mag-deck" style="font-size:19px;color:#e6e2da">For birders in the <b style="color:var(--mag-accent);font-weight:600">${esc(d.region_names[region])}</b>${isNow ? ' right now' : ''}. <button type="button" class="linkish" id="chg">${hasRegion() ? 'Change region' : 'Not your region? Choose yours'}</button></p>
      ${occ.live ? `<p class="rot-next"><b>${nextLabel} in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</b> · ${fmt(curSpan.end)}. A new set of nine every two weeks, all season long.</p>` : ''}
      <ol class="steps-inline">
        <li><b>Find</b> any of these birds in your region this season. Tap a bird for where and when to look.</li>
        <li><b>Photograph</b> it. Any of the nine counts, and birds from earlier cards this season still count until ${fmt(seasonEnd)}. Harder levels score more points.</li>
        <li><b>Share</b> your best photo. <a href="/submit" data-link style="color:var(--mag-accent)">Send it in</a> and it goes on the Bird Wall with your name.</li>
      </ol>
      <div class="pills" role="group" aria-label="Season"><span class="pills-lbl">Season</span>${SEASON_ORDER.map((s) => `<button type="button" class="pill" data-s="${s}" aria-pressed="${s === season}">${SEASONS[s]}${s === now ? ' (now)' : ''}</button>`).join('')}</div>
      <div class="pills rot-cards" role="group" aria-label="Card"><span class="pills-lbl">Cards</span>${cards.slice(0, occ.window + 1).map((_, i) => `<button type="button" class="pill" data-c="${i}" aria-pressed="${i === shownIdx}">${range(windowSpan(season, occ.year, i))}${occ.live && i === occ.window ? ' (now)' : ''}</button>`).join('')}${occ.live && occ.window < WINDOWS - 1 ? `<span class="pill locked" title="Revealed on ${fmt(curSpan.end)}">${WINDOWS - 1 - occ.window} more to come</span>` : ''}</div>
      <div class="levels">${[1, 2, 3].map((L) => `<section class="level" aria-label="Level ${L}">
        <div class="top"><h3>Level ${L}</h3><span class="pts">${sc.base.assign[L - 1]} points each</span></div>
        <p class="bl">${BLURB[L]}</p>
        ${card[String(L)].map((id) => d.byId.get(id)).map((b) => { const pic = birdPic(b, 'thumb'); return `<a class="bird has-thumb" href="${birdLink(b)}" data-link><span class="bt">${pic ? `<img loading="lazy" src="${esc(pic.src)}" alt="">` : ''}</span><span>${birdName(b)}</span></a>`; }).join('') || '<p class="bl">To be announced.</p>'}
      </section>`).join('')}</div>
      <p class="mag-deck" style="margin-top:28px">Spotted something else? ${frequent} other birds can be found in the ${esc(d.region_names[region])} this ${SEASONS[season].toLowerCase()}. Photos of those count too, as frequent visitors. <a href="/birds" data-link style="color:var(--mag-accent)">See them all</a>.</p>
      <p class="mag-deck">Birds are drawn at random from those findable in your region this season, three per level, with no repeats until every bird has had a turn and a mix of bird families on every card. Everyone in your region gets the same nine. <a href="/about#rotation" data-link style="color:var(--mag-accent)">How the draw works</a>.</p>

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
            <tr><td>Bonuses</td><td class="n">+${sc.bonus.level} / +${sc.bonus.card}</td><td>All three birds in a level of one card / all nine birds of one card, by the end of the season.</td></tr>
            <tr><td>Featured</td><td class="n">+${sc.bonus.issue} / +${sc.bonus.annual}</td><td>In a seasonal issue / in the year-end edition.</td></tr>
            <tr><td>Posting</td><td class="n">+${sc.activity.post}</td><td>Each post, up to ${sc.activity.weekly_cap} a week. +${sc.activity.streak} a week for a streak of weekly posts, up to +${sc.activity.streak_cap}.</td></tr>
          </tbody>
        </table>
        <p class="mag-deck" style="margin-top:20px">No points for photos taken with bait, playback, or by flushing birds or disturbing nests. No exact location is ever published for a scarce or rare bird.</p>
      </section>
    </div>`;
    $('#chg', view).onclick = pickRegion;
    $$('[data-s]', view).forEach((b) => (b.onclick = () => { season = b.dataset.s; pick = null; draw(); }));
    $$('[data-c]', view).forEach((b) => (b.onclick = () => { pick = +b.dataset.c; draw(); }));
  };
  draw();
}
