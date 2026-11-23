import { S, $, $$, api, esc } from '../util.js';
import { openLightbox } from '../lightbox.js';

let f = { species: '', fav: '', layout: 'grid', sort: 'new' };

export default async function gallery(view) {
  const photos = await api('/photos');
  const spIds = [...new Set(photos.map((p) => p.species_id))];
  view.innerHTML = `<div class="wrap">
    <header class="page-head"><span class="label">The photographic collection</span><h1>Gallery</h1>
      <p class="deck">${photos.length ? `${photos.length} photograph${photos.length > 1 ? 's' : ''} of ${spIds.length} species.` : 'No photographs in the collection yet.'}</p></header>
    ${photos.length ? `<form class="filters" id="gf">
      <select class="input" name="species" aria-label="Species"><option value="">All species</option>${spIds.map((id) => S.spById.get(id)).filter(Boolean).sort((a, b) => a.seq - b.seq).map((s) => `<option value="${s.id}" ${+f.species === s.id ? 'selected' : ''}>${esc(s.common_name)}</option>`).join('')}</select>
      <select class="input" name="fav" aria-label="Selection"><option value="">All photographs</option><option value="fav" ${f.fav === 'fav' ? 'selected' : ''}>Favorites</option><option value="def" ${f.fav === 'def' ? 'selected' : ''}>Definitive images</option><option value="rated" ${f.fav === 'rated' ? 'selected' : ''}>Rated four stars and above</option></select>
      <select class="input" name="sort" aria-label="Order"><option value="new">Newest first</option><option value="old" ${f.sort === 'old' ? 'selected' : ''}>Oldest first</option><option value="tax" ${f.sort === 'tax' ? 'selected' : ''}>Taxonomic order</option><option value="rating" ${f.sort === 'rating' ? 'selected' : ''}>Highest rated</option></select>
      <select class="input" name="layout" aria-label="Layout"><option value="grid">Grid</option><option value="masonry" ${f.layout === 'masonry' ? 'selected' : ''}>Masonry</option></select>
      <span class="mono count" id="gc"></span></form><div id="gl"></div>` : `<p class="empty">${S.owner ? 'Photographs are added with an observation. Use Add observation to upload the first one.' : 'Published photographs will appear here.'}</p>`}
    <p class="note" style="margin-top:40px">Side-by-side image comparison and location galleries are planned for the photography archive phase.</p></div>`;
  if (!photos.length) return;
  const form = $('#gf', view), list = $('#gl', view);
  const draw = () => {
    f = Object.fromEntries(new FormData(form));
    const t = (p) => p.taken_at || p.created_at || '';
    let rows = photos.filter((p) => (!f.species || p.species_id === +f.species) && (f.fav !== 'fav' || p.favorite) && (f.fav !== 'def' || p.definitive_photo_id === p.id) && (f.fav !== 'rated' || p.rating >= 4));
    rows.sort(f.sort === 'old' ? (a, b) => t(a).localeCompare(t(b)) : f.sort === 'tax' ? (a, b) => (S.spById.get(a.species_id)?.seq || 0) - (S.spById.get(b.species_id)?.seq || 0) : f.sort === 'rating' ? (a, b) => b.rating - a.rating : (a, b) => t(b).localeCompare(t(a)));
    $('#gc', view).textContent = `${rows.length} shown`;
    list.className = 'gallery ' + (f.layout === 'masonry' ? 'masonry' : '');
    list.innerHTML = rows.map((p, i) => `<button type="button" data-i="${i}" aria-label="${esc(p.common_name)}"><img loading="lazy" src="/media/${p.id}/thumb" alt="${esc(p.common_name)}"><span class="cap">${esc(p.common_name)}${p.visibility === 'private' && S.owner ? ' · private' : ''}</span></button>`).join('') || '<p class="empty">No photographs match.</p>';
    $$('button', list).forEach((b) => (b.onclick = () => openLightbox(rows, +b.dataset.i)));
  };
  form.addEventListener('input', draw); draw();
}
