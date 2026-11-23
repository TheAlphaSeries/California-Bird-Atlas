import { S, esc } from '../util.js';
import { birdPic, refCredit, bindReports } from '../refphoto.js';
import { wi, SEASONS, SEASON_ORDER, CATEGORY, BUILT_IN, dbSpecies, levelOf, lvSpan, pointsLabel } from '../wi.js';

export default async function bird(view, id) {
  document.body.classList.add('mag');
  const d = await wi();
  const b = d.byId.get(id);
  if (!b) { view.innerHTML = '<div class="mag-wrap mag-page"><h1 class="mag-h">No such bird</h1><p class="mag-deck"><a href="/birds" data-link style="color:var(--mag-accent)">Back to all birds</a></p></div>'; return; }
  const sp = dbSpecies(b);
  const pic = birdPic(b, 'display');
  const seasons = SEASON_ORDER.filter((s) => b.lv && b.lv[s].replace(/-/g, ''));
  const grid = b.lv ? `<div class="lv-grid"><table>
      <thead><tr><th scope="col">Region</th>${seasons.map((s) => `<th scope="col">${SEASONS[s]}</th>`).join('')}</tr></thead>
      <tbody>${d.regions.map((r, i) => `<tr><td>${esc(d.region_names[r])}</td>${seasons.map((s) => `<td>${lvSpan(levelOf(b, i, s))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '';
  view.innerHTML = `<div class="mag-wrap mag-page"><article class="bird">
    <figure class="art">${pic ? `<img src="${esc(pic.src)}" alt="${esc(b.n)}${pic.kind === 'ref' ? ' (reference photo)' : ''}">${refCredit(pic)}` : '<div class="ph">Not yet photographed</div>'}</figure>
    <div class="facts">
      <p class="plate"><a href="/birds" data-link>All birds</a><span>Plate No. ${+b.id.slice(3)}</span></p>
      <h1 class="mag-h" style="font-size:clamp(40px,5vw,68px)">${esc(b.n)}</h1>
      <p class="mag-sci" style="font-size:18px;margin:0">${esc(b.sci)}</p>
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
  </article></div>`;
  bindReports(view);
}
