import { S, api, esc, go } from '../util.js';
import { seasonCards, latestOccurrence } from '../rotation.js';
import { openBird } from './wall.js';
import { onSwipe, openFull } from '../viewer.js';
import { loadMap, mapSvg } from '../regionmap.js';
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
  const allWall = await api('/wall').catch(() => []);
  const shots = allWall.filter((r) => r.bird === b.n);
  const g = b.lv ? await loadMap().catch(() => null) : null;
  // Look-alikes: the note names one or more other birds; show any that are on the list beside this one.
  const alikes = b.look ? d.birds.filter((x) => x !== b && new RegExp(`(^|[^A-Za-z'-])${x.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z'-])`).test(b.look)).slice(0, 2) : [];
  const mini = (x) => { const p = birdPic(x, 'thumb'); return `<a class="bp-alike" href="${birdLink(x)}" data-link><span class="art">${p ? `<img loading="lazy" src="${esc(p.src)}" alt="">` : `<b>${+x.id.slice(3)}</b>`}</span><b>${esc(x.n)}</b><i>${esc(x.sci)}</i></a>`; };
  const pic = birdPic(b, 'display');
  const seasons = SEASON_ORDER.filter((s) => b.lv && b.lv[s].replace(/-/g, ''));
  const grid = b.lv ? `<div class="lv-grid"><table>
      <thead><tr><th scope="col">Region</th>${seasons.map((s) => `<th scope="col">${SEASONS[s]}</th>`).join('')}</tr></thead>
      <tbody>${d.regions.map((r, i) => `<tr><td>${esc(d.region_names[r])}</td>${seasons.map((s) => `<td>${lvSpan(levelOf(b, i, s))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '';
  view.innerHTML = `<div class="mag-wrap mag-page"><article class="bird">
    <div class="bp-left"><figure class="art">${pic ? `<img src="${esc(pic.src)}" alt="${esc(b.n)}${pic.kind === 'ref' ? ' (reference photo)' : ''}">${refCredit(pic)}` : '<div class="ph">Not yet photographed</div>'}</figure>
      ${g ? `<section class="bp-map" aria-label="How hard it is to find, by region">
        <div class="bp-map-head"><h2>Where it's easiest</h2><div class="bp-map-ctl"><button type="button" class="bp-play" id="bp-play" aria-pressed="false">Play the year</button><div class="seg small" role="group" aria-label="Season">${SEASON_ORDER.map((s) => `<button type="button" data-ms="${s}" aria-pressed="${s === season}">${SEASONS[s]}</button>`).join('')}</div></div></div>
        <div id="bp-mapbox"></div><p class="bp-map-season" id="bp-ms" aria-live="polite"></p>
        <p class="bp-key"><span class="k l1"></span>Easy <span class="k l2"></span>Takes a trip <span class="k l3"></span>Hard <span class="k none"></span>Not dependable</p></section>` : ''}
    </div>
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
  ${alikes.length ? `<section class="mag-section"><p class="mag-kicker">Look-alike</p><h2>Easy to mix up with</h2>
    <div class="bp-alikes">${mini(b)}<span class="vs" aria-hidden="true">or</span>${alikes.map(mini).join('<span class="vs" aria-hidden="true">or</span>')}</div>
    <p style="margin-top:18px"><button type="button" class="mag-btn" id="bp-cmp" aria-expanded="false" aria-controls="bp-cmpbox">Compare side by side</button></p>
    <div id="bp-cmpbox" class="bp-cmp" hidden></div></section>` : ''}
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
  if (g) {
    const paint = (s) => { view.querySelector('#bp-mapbox').innerHTML = mapSvg(g, (r) => { const v = levelOf(b, d.regions.indexOf(r), s); return typeof v === 'number' ? 'l' + v : 'none'; },
      { title: (r) => { const v = levelOf(b, d.regions.indexOf(r), s); return `${d.region_names[r]}: ${typeof v === 'number' ? ['easy to find', 'takes a trip', 'hard to find'][v - 1] : 'not dependable'}`; } }); };
    const pick = (s) => { view.querySelectorAll('[data-ms]').forEach((y) => y.setAttribute('aria-pressed', y.dataset.ms === s)); paint(s); view.querySelector('#bp-ms').textContent = SEASONS[s]; };
    let timer = null;
    const play = view.querySelector('#bp-play');
    const stop = () => { clearInterval(timer); timer = null; play.setAttribute('aria-pressed', 'false'); play.textContent = 'Play the year'; };
    // Steps the map through winter, spring, summer and fall twice, then stops on the season it started from.
    play.onclick = () => {
      if (timer) return stop();
      let k = SEASON_ORDER.indexOf(view.querySelector('[data-ms][aria-pressed=true]')?.dataset.ms || season), n = 0;
      play.setAttribute('aria-pressed', 'true'); play.textContent = 'Stop';
      timer = setInterval(() => {
        if (!document.body.contains(play) || ++n > 8) return stop();
        k = (k + 1) % 4; pick(SEASON_ORDER[k]);
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 2200 : 1300);
    };
    view.querySelectorAll('[data-ms]').forEach((x) => (x.onclick = () => { stop(); pick(x.dataset.ms); }));
    pick(season);
  }
  view.querySelectorAll('.bp-shots [data-k]').forEach((x) => (x.onclick = () => openBird(shots[+x.dataset.k], d, { list: shots, all: allWall })));
  bindReports(view);
  // Compare look-alikes: picture, family, how findable each is in your region by season, a small map for now, field notes.
  const cmpBtn = view.querySelector('#bp-cmp');
  if (cmpBtn) cmpBtn.onclick = () => {
    const box = view.querySelector('#bp-cmpbox'), open = box.hidden;
    box.hidden = !open; cmpBtn.setAttribute('aria-expanded', open); cmpBtn.textContent = open ? 'Hide the comparison' : 'Compare side by side';
    if (!open || box.innerHTML) return;
    const set = [b, ...alikes];
    const lvWord = (v) => typeof v === 'number' ? ['Easy', 'Trip', 'Hard'][v - 1] : '–';
    box.innerHTML = `<table class="cmp"><caption class="vh">${esc(set.map((x) => x.n).join(' compared with '))}</caption><colgroup><col class="cmp-k">${set.map(() => '<col>').join('')}</colgroup>
      <thead><tr><td></td>${set.map((x) => { const p = birdPic(x, 'thumb'); return `<th scope="col">${p ? `<img loading="lazy" src="${esc(p.src)}" alt="">` : ''}<b>${esc(x.n)}</b><i>${esc(x.sci)}</i></th>`; }).join('')}</tr></thead>
      <tbody>
        <tr><th scope="row">Family</th>${set.map((x) => `<td>${esc(x.fam)}</td>`).join('')}</tr>
        <tr><th scope="row">In the ${esc(d.region_names[mine])}</th>${set.map((x) => `<td><span class="cmp-lv">${SEASON_ORDER.map((s2) => { const v = levelOf(x, mi, s2); return `<span class="${typeof v === 'number' ? 'l' + v : 'none'}" title="${SEASONS[s2]}: ${typeof v === 'number' ? ['easy to find', 'takes a trip', 'hard to find'][v - 1] : 'not dependable'}"><i>${SEASONS[s2].slice(0, 3)}</i>${lvWord(v)}</span>`; }).join('')}</span></td>`).join('')}</tr>
        ${g ? `<tr><th scope="row">${SEASONS[season]}, by region</th>${set.map((x) => `<td class="cmp-map">${x.lv ? mapSvg(g, (r) => { const v = levelOf(x, d.regions.indexOf(r), season); return typeof v === 'number' ? 'l' + v : 'none'; }, { labels: false, title: (r) => d.region_names[r] }) : ''}</td>`).join('')}</tr>` : ''}
        ${set.some((x) => x.note) ? `<tr><th scope="row">In the field</th>${set.map((x) => `<td>${esc(x.note || '')}</td>`).join('')}</tr>` : ''}
        ${set.some((x) => x.prot) ? `<tr><th scope="row">Protection</th>${set.map((x) => `<td>${esc(x.prot || '')}</td>`).join('')}</tr>` : ''}
        <tr><th scope="row">Points</th>${set.map((x) => `<td>${esc(pointsLabel(x, d))}</td>`).join('')}</tr>
        <tr><td></td>${set.map((x) => `<td>${x === b ? '<span class="cmp-here">This page</span>' : `<a class="linkish" href="${birdLink(x)}" data-link>Open ${esc(x.n)}</a>`}</td>`).join('')}</tr>
      </tbody></table>`;
  };
  // Phones: swipe sideways on the bird's picture or title to go to the previous or next bird. The big picture opens full screen.
  const top = view.querySelector('article.bird');
  onSwipe(top, { left: () => next && go(birdLink(next)), right: () => prev && go(birdLink(prev)) });
  const big = view.querySelector('.bp-left .art img');
  if (big) { big.classList.add('zoomable'); big.tabIndex = 0; big.setAttribute('role', 'button'); big.setAttribute('aria-label', `${b.n}: see it full screen`);
    const o = () => openFull(big.src, b.n); big.onclick = o; big.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o(); } }; }
}
