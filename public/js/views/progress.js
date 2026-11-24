import { S, api, esc, inGoal } from '../util.js';
import { wi, birdLink, levelOf, myRegion, currentSeason, SEASONS } from '../wi.js';
import { birdPic } from '../refphoto.js';

// The Count: the editor's progress toward photographing every bird in California.
//
// A bird counts once the editor has photographed it, which the site knows two ways:
//   - a confirmed photo in the editor's atlas tools (species status 'photographed', from /api/bootstrap), or
//   - a bird the editor put on the Bird Wall from /add (wall rows with by_editor = 1).
// The goal is the editor's own setting (Settings → which kinds of birds count; native residents and migrants by default).
// Nothing here needs updating by hand: add a photo either way and the page moves.
const MILESTONES = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700];

export function editorCount(wall) {
  const got = new Map(); // common name -> first date (ISO) it was photographed
  const put = (name, when) => { const w = when || ''; if (!got.has(name) || (w && (!got.get(name) || w < got.get(name)))) got.set(name, w); };
  for (const sp of S.species) if (sp.status === 'photographed') put(sp.common_name, sp.first_photo);
  for (const r of wall) if (r.by_editor) put(r.bird, r.taken_at || r.approved_at);
  return got;
}

export default async function progress(view) {
  const [d, wall] = await Promise.all([wi(), api('/wall').catch(() => [])]);
  const got = editorCount(wall);
  const goal = S.species.filter(inGoal);
  const goalNames = new Set(goal.map((s) => s.common_name));
  const done = goal.filter((s) => got.has(s.common_name));
  const extra = [...got.keys()].filter((n) => !goalNames.has(n)).length; // rarities and the like, outside the goal
  const pct = goal.length ? (done.length / goal.length) * 100 : 0;
  const next = MILESTONES.find((m) => m > done.length);
  const yr = String(new Date().getFullYear());
  const thisYear = done.filter((s) => (got.get(s.common_name) || '').startsWith(yr)).length;
  const recent = [...got.entries()].filter(([, w]) => w).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 8)
    .map(([n, w]) => ({ b: d.byName.get(n), n, w })).filter((x) => x.b);
  // Families, in field-guide order, with how many of each are done.
  const fams = new Map();
  for (const s of goal) { const f = d.byName.get(s.common_name)?.fam || 'Other'; if (!fams.has(f)) fams.set(f, { f, all: 0, done: 0 }); const x = fams.get(f); x.all++; if (got.has(s.common_name)) x.done++; }
  // Still to find: the easiest birds in the reader's region this season that aren't on the count yet.
  const region = myRegion(d), ri = d.regions.indexOf(region), season = currentSeason();
  const todo = goal.filter((s) => !got.has(s.common_name)).map((s) => d.byName.get(s.common_name)).filter(Boolean)
    .map((b) => ({ b, v: levelOf(b, ri, season) })).filter((x) => typeof x.v === 'number').sort((a, b) => a.v - b.v || d.birds.indexOf(a.b) - d.birds.indexOf(b.b)).slice(0, 12);
  const when = (iso) => iso ? new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  let fam = '';
  view.innerHTML = `<div class="mag-wrap mag-page pg">
    <header class="pg-head">
      <p class="mag-kicker">The count</p>
      <h1 class="mag-h">Every bird in California</h1>
      <p class="pg-deck">My goal is to photograph every bird in California that I can. This is how far I've got. Every square below is one bird; the yellow ones are done.</p>
    </header>
    <section class="pg-score" aria-label="Progress">
      <p class="pg-big"><b>${done.length}</b><span>of ${goal.length} birds<br>photographed</span></p>
      <div class="pg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal.length}" aria-valuenow="${done.length}" aria-label="Birds photographed"><i style="width:${pct.toFixed(2)}%"></i></div>
      <dl class="pg-stats">
        <div><dt>Done</dt><dd>${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%</dd></div>
        <div><dt>In ${yr}</dt><dd>${thisYear}</dd></div>
        <div><dt>Left to go</dt><dd>${goal.length - done.length}</dd></div>
        ${next && next <= goal.length ? `<div><dt>Next milestone</dt><dd>${next}<small>${next - done.length} to go</small></dd></div>` : ''}
      </dl>
      ${extra ? `<p class="pg-extra">Plus ${extra} bird${extra === 1 ? '' : 's'} outside the goal, such as rare visitors.</p>` : ''}
    </section>
    <section class="pg-grid-wrap" aria-labelledby="pg-grid-h">
      <h2 id="pg-grid-h" class="vh">All ${goal.length} birds, in field-guide order</h2>
      <p class="pg-key"><span class="on"></span>Photographed <span></span>Not yet</p>
      <div class="pg-grid" role="img" aria-label="${done.length} of ${goal.length} birds photographed, shown as a grid of squares">${goal.map((s) => {
        const b = d.byName.get(s.common_name), f = b?.fam || '', brk = f !== fam; fam = f;
        const on = got.has(s.common_name);
        return `<i class="${on ? 'on' : ''}${brk ? ' brk' : ''}" title="${esc(s.common_name)}${on ? ', photographed' : ''}"></i>`;
      }).join('')}</div>
    </section>
    ${recent.length ? `<section class="mag-section"><p class="mag-kicker">Latest</p><h2>Most recently photographed</h2>
      <div class="pg-recent">${recent.map(({ b, w }) => { const p = birdPic(b, 'thumb'); return `<a href="${birdLink(b)}" data-link><span class="art">${p ? `<img loading="lazy" src="${esc(p.src)}" alt="">` : ''}</span><b>${esc(b.n)}</b><i>${esc(when(w))}</i></a>`; }).join('')}</div></section>` : ''}
    ${todo.length ? `<section class="mag-section"><p class="mag-kicker">Still to find</p><h2>Easiest next, in the ${esc(d.region_names[region])} this ${SEASONS[season].toLowerCase()}</h2>
      <ol class="pg-todo">${todo.map(({ b, v }) => `<li><a href="${birdLink(b)}" data-link><span class="lvn l${v}">${v}</span><b>${esc(b.n)}</b><i>${['Easy to find', 'Takes a trip', 'Hard to find'][v - 1]}</i></a></li>`).join('')}</ol></section>` : ''}
    <section class="mag-section"><p class="mag-kicker">By family</p><h2>Where the gaps are</h2>
      <ul class="pg-fams">${[...fams.values()].map((x) => `<li${x.done === x.all ? ' class="full"' : ''}><span class="nm">${esc(x.f)}</span><span class="bar" aria-hidden="true"><i style="width:${(x.done / x.all * 100).toFixed(1)}%"></i></span><span class="n">${x.done} of ${x.all}</span></li>`).join('')}</ul></section>
    ${S.owner ? `<p class="pg-note">Editor: the count goes up when you add a confirmed photo in the atlas tools or put your own bird on the wall from <a class="linkish" href="/add" data-link>Add birds</a>. Which kinds of birds count is set in <a class="linkish" href="/settings" data-link>Settings</a>.</p>` : ''}
  </div>`;
}
