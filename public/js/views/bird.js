import { S, api, esc } from '../util.js';
import { seasonCards, latestOccurrence } from '../rotation.js';
import { openBird } from './wall.js';
import { birdPic, refCredit, bindReports } from '../refphoto.js';
import { wi, SEASONS, SEASON_ORDER, CATEGORY, dbSpecies, levelOf, lvSpan, pointsLabel, currentSeason, myRegion, birdLink } from '../wi.js';

export default async function bird(view, id) {
  const d = await wi();
  const b = d.byId.get(id);
  if (!b) { view.innerHTML = '<div class="mag-wrap mag-page"><h1 class="mag-h">No such bird</h1><p class="mag-deck"><a href="/birds" data-link style="color:var(--mag-accent)">Back to all birds</a></p></div>'; return; }
  const sp = dbSpecies(b);
  // Where this bird is one of the nine right now.
  const season = currentSeason(), occ = latestOccurrence(season);
  const assignedIn = b.cat === 'assign' ? d.regions.filter((r) => { const c = seasonCards(d, r, season, occ.year)[occ.window]; return [...c[1], ...c[2], ...c[3]].includes(b.id); }) : [];
  // When to look in the reader's own region: the seasons with its lowest level there.
  const mine = myRegion(d), mi = d.regions.indexOf(mine);
  const lv = SEASON_ORDER.map((s) => [s, levelOf(b, mi, s)]).filter(([, v]) => typeof v === 'number');
  const best = lv.length ? Math.min(...lv.map(([, v]) => v)) : null;
  const bestSeasons = lv.filter(([, v]) => v === best).map(([s]) => SEASONS[s].toLowerCase());
  const when = best ? `In the ${d.region_names[mine]}, look ${bestSeasons.length === 4 ? 'at any time of year' : 'in ' + bestSeasons.join(', ').replace(/, ([^,]*)$/, ' or $1')}, when it is ${['easy to find', 'worth a trip', 'hard to find'][best - 1]}.`
    : b.lv ? `Not dependable in the ${d.region_names[mine]}. The table shows where it is.` : '';
  const i = d.birds.indexOf(b), prev = d.birds[i - 1], next = d.birds[i + 1];
  const shots = (await api('/wall').catch(() => [])).filter((r) => r.bird === b.n);
  const pic = birdPic(b, 'display');
  const seasons = SEASON_ORDER.filter((s) => b.lv && b.lv[s].replace(/-/g, ''));
  const grid = b.lv ? `<div class="lv-grid"><table>
      <thead><tr><th scope="col">Region</th>${seasons.map((s) => `<th scope="col">${SEASONS[s]}</th>`).join('')}</tr></thead>
      <tbody>${d.regions.map((r, i) => `<tr><td>${esc(d.region_names[r])}</td>${seasons.map((s) => `<td>${lvSpan(levelOf(b, i, s))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '';
  view.innerHTML = `<div class="mag-wrap mag-page"><article class="bird">
    <figure class="art">${pic ? `<img src="${esc(pic.src)}" alt="${esc(b.n)}${pic.kind === 'ref' ? ' (reference photo)' : ''}">${refCredit(pic)}` : '<div class="ph">Not yet photographed</div>'}</figure>
    <div class="facts">
      <p class="plate-no"><a href="/birds" data-link>All birds</a><span class="pn"><i>Plate no.</i>${+b.id.slice(3)}</span></p>
      <h1 class="mag-h" style="font-size:clamp(40px,5vw,68px)">${esc(b.n)}</h1>
      <p class="mag-sci" style="font-size:18px;margin:0">${esc(b.sci)}</p>
      ${assignedIn.length ? `<p class="bp-now"><b>One of the nine right now</b> in the ${esc(assignedIn.map((r) => d.region_names[r]).join(', ').replace(/, ([^,]*)$/, ' and $1'))}. <a class="linkish" href="/this-season" data-link>This season</a></p>` : ''}
      ${when ? `<p class="bp-when">${esc(when)}</p>` : ''}
      <dl>
        <dt>Family</dt><dd>${esc(b.fam)}</dd>
        <dt>Status</dt><dd>${esc(b.kind)}${b.why && b.cat !== 'assign' ? `. ${esc(b.why)}.` : ''}</dd>
        <dt>Category</dt><dd>${esc(CATEGORY[b.cat])} · ${esc(pointsLabel(b, d))}</dd>
        ${b.lv ? `<dt>Level by region and season</dt><dd>${grid}<p style="color:var(--mag-dim);font-size:14px;margin-top:8px">1 is easy to find, 3 is hard. A dash means not dependable there that season.</p></dd>` : ''}
        ${b.note ? `<dt>In the field</dt><dd>${esc(b.note)}</dd>` : ''}
        ${b.look ? `<dt>Look-alike</dt><dd>${esc(b.look)}</dd>` : ''}
        ${b.prot ? `<dt>Protection</dt><dd>${esc(b.prot)}</dd>` : ''}
      </dl>
      ${S.owner && sp ? `<p style="margin-top:28px"><a class="mag-btn" href="/species/${sp.id}" data-link>Open in the atlas tools</a></p>` : ''}
    </div>
  </article>
  <section class="mag-section bp-wall">
    <p class="mag-kicker">On the Bird Wall</p>
    <h2>${shots.length ? `${shots.length} photograph${shots.length === 1 ? '' : 's'} of this bird` : 'Nobody has sent this bird yet'}</h2>
    ${shots.length ? `<div class="bp-shots">${shots.map((r, k) => `<button type="button" data-k="${k}" aria-label="By ${esc(r.credit_name)}: see credits"><img loading="lazy" src="/media/sub/${r.id}/cutout" alt=""><span>Photo ● ${esc(r.credit_name)}</span></button>`).join('')}</div>`
      : `<p class="mag-deck">Be the first. <a class="linkish" href="/submit" data-link>Send a photo</a> of ${esc(b.n)} and it goes up here with your name.</p>`}
  </section>
  <nav class="bp-nav" aria-label="Neighbouring birds">
    ${prev ? `<a href="${birdLink(prev)}" data-link><i>Previous, no. ${+prev.id.slice(3)}</i><b>${esc(prev.n)}</b></a>` : '<span></span>'}
    ${next ? `<a href="${birdLink(next)}" data-link class="nx"><i>Next, no. ${+next.id.slice(3)}</i><b>${esc(next.n)}</b></a>` : '<span></span>'}
  </nav></div>`;
  view.querySelectorAll('.bp-shots [data-k]').forEach((x) => (x.onclick = () => openBird(shots[+x.dataset.k], d)));
  bindReports(view);
}
