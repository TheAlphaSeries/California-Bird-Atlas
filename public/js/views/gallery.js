import { S, $$, api, esc } from '../util.js';
import { openLightbox } from '../lightbox.js';
import { wi, BUILT_IN, birdLink } from '../wi.js';

export default async function gallery(view) {
  const [photos, d] = await Promise.all([api('/photos'), wi()]);
  const shown = new Set(photos.map((p) => p.common_name));
  const builtIn = Object.entries(BUILT_IN).filter(([n]) => !shown.has(n)).map(([n, v]) => ({ n, ...v, b: d.byName.get(n) }));
  const plate = (p, i) => {
    const b = d.byName.get(p.common_name);
    return `<figure>
      <button type="button" class="img" data-i="${i}" aria-label="Open photograph of ${esc(p.common_name)}"><img loading="lazy" src="/media/${p.id}/display" alt="${esc(p.common_name)}"></button>
      <figcaption>
        <p class="nm">${b ? `<a href="${birdLink(b)}" data-link>${esc(p.common_name)}</a>` : esc(p.common_name)}</p>
        <p class="sc mag-sci">${esc(p.scientific_name)}</p>
        ${p.caption ? `<p class="ct">${esc(p.caption)}</p>` : ''}
        ${S.owner && p.visibility !== 'public' ? '<p class="ct" style="color:#ff9a6b">Private: only you can see this</p>' : ''}
      </figcaption></figure>`;
  };
  view.innerHTML = `<div class="mag-wrap mag-page">
    <p class="mag-kicker">The Gallery</p>
    <h1 class="mag-h">California birds</h1>
    <p class="mag-deck">New birds are added as they are photographed.</p>
    <div class="plates">
      ${photos.map(plate).join('')}
      ${builtIn.map((x) => `<figure><a class="img" href="${x.b ? birdLink(x.b) : '#'}" data-link><img loading="lazy" src="${esc(x.src)}" alt="${esc(x.n)}"></a>
        <figcaption><p class="nm">${x.b ? `<a href="${birdLink(x.b)}" data-link>${esc(x.n)}</a>` : esc(x.n)}</p><p class="sc mag-sci">${esc(x.b?.sci || '')}</p><p class="ct">${esc(x.caption)}</p></figcaption></figure>`).join('')}
    </div>
    ${S.owner ? '<p class="mag-deck" style="margin-top:40px">To add a photo: Add observation, attach the photo and set it to Public.</p>' : ''}
  </div>`;
  $$('button.img', view).forEach((btn) => (btn.onclick = () => openLightbox(photos, +btn.dataset.i)));
}
