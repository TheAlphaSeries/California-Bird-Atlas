import { api, esc } from '../util.js';
import { wi, REGIONS, REGION_NAMES, SEASONS, currentSeason, myRegion, birdLink, levelOf } from '../wi.js';

// The scoreboard: which region has put the most species on the wall, and which birds nobody has sent yet.
// Everything is counted from the public wall list, so it needs no accounts. Sample birds don't count.
export default async function board(view) {
  const [wall, d] = await Promise.all([api('/wall'), wi()]);
  // Only birds that can score count: sensitive and introduced birds never do.
  const scoring = new Set(d.birds.filter((b) => !['sensitive', 'introduced'].includes(b.cat)).map((b) => b.n));
  const real = wall.filter((r) => !r.sample && scoring.has(r.bird));
  const have = new Set(real.map((r) => r.bird));
  const standings = REGIONS.map((r) => {
    const mine = real.filter((x) => x.region === r);
    return { r, species: new Set(mine.map((x) => x.bird)).size, photos: mine.length, people: new Set(mine.map((x) => x.credit_name)).size };
  }).sort((a, b) => b.species - a.species || b.photos - a.photos);
  const top = Math.max(1, standings[0].species);
  // Birds that can score. Sensitive and introduced birds are never wanted on the board.
  const wanted = d.birds.filter((b) => !['sensitive', 'introduced'].includes(b.cat));
  const missing = wanted.filter((b) => !have.has(b.n));
  const season = currentSeason(), ri = d.regions.indexOf(myRegion(d));
  let mode = 'here';
  view.innerHTML = `<div class="mag-wrap mag-page bd">
    <p class="mag-kicker">Scoreboard</p>
    <h1 class="mag-h">Region against region</h1>
    <p class="mag-deck">Each region scores one for every species its photographers have put on the Bird Wall. ${real.length ? '' : 'Nobody has scored yet. The first photo puts a region on the board.'}</p>
    <ol class="bd-table">${standings.map((s, i) => `<li><span class="rk">${i + 1}</span><span class="nm">${esc(REGION_NAMES[s.r])}</span>
      <span class="bar"><i style="width:${(s.species / top) * 100}%"></i></span>
      <span class="ct"><b>${s.species}</b> species</span><span class="sm">${s.photos} photo${s.photos === 1 ? '' : 's'}, ${s.people} photographer${s.people === 1 ? '' : 's'}</span></li>`).join('')}</ol>

    <section class="mag-section">
      <p class="mag-kicker">Missing birds</p>
      <h2>${missing.length} birds nobody has sent yet</h2>
      <p class="mag-deck">${have.size} of ${wanted.length} are on the wall. Be the first to put one of these on the wall.</p>
      <div class="seg" role="group" aria-label="Show"><button type="button" data-m="here" aria-pressed="true">Findable in the ${esc(d.region_names[myRegion(d)])} now</button><button type="button" data-m="all" aria-pressed="false">All missing birds</button></div>
      <p class="ix-count" id="bd-count" aria-live="polite"></p>
      <div class="bd-missing" id="bd-list"></div>
    </section>
    <p style="margin-top:40px"><a class="mag-btn solid" href="/submit" data-link>Send a photo</a></p>
  </div>`;
  const draw = () => {
    const rows = mode === 'here' ? missing.filter((b) => typeof levelOf(b, ri, season) === 'number') : missing;
    view.querySelector('#bd-count').textContent = mode === 'here' ? `${rows.length} you could find this ${SEASONS[season].toLowerCase()}` : `${rows.length} in all`;
    view.querySelector('#bd-list').innerHTML = rows.map((b) => { const v = levelOf(b, ri, season);
      return `<a href="${birdLink(b)}" data-link><span class="no">${+b.id.slice(3)}</span><span>${esc(b.n)}</span>${typeof v === 'number' ? `<span class="ixc-badge l${v}" title="Level ${v}">${v}</span>` : ''}</a>`; }).join('') || '<p class="mag-deck">None left. Every one of these is on the wall.</p>';
  };
  view.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; view.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); }));
  draw();
}
