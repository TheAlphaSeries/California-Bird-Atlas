import { S, $, $$, api, esc, toast, fmtDate } from './util.js';

// Full-screen photograph viewer with caption, EXIF and (for the owner) management controls.
export function openLightbox(photos, index = 0) {
  let i = index;
  const box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  document.body.appendChild(box);
  const close = () => { box.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.target.matches('textarea, input, select')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight' && i < photos.length - 1) { i++; draw(); } if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); } };
  document.addEventListener('keydown', key);
  const changed = () => window.dispatchEvent(new Event('atlas:changed'));
  const draw = () => {
    const p = photos[i], sp = S.spById.get(p.species_id), ex = p.exif || {};
    const isDef = sp?.definitive_photo_id === p.id;
    const rows = [['Taken', fmtDate(p.taken_at || ex.taken_at)], ['Camera', ex.camera], ['Lens', ex.lens], ['Focal length', ex.focal_length ? ex.focal_length + (ex.focal_35mm ? ` (${ex.focal_35mm} equiv.)` : '') : ''], ['Aperture', ex.aperture], ['Shutter', ex.shutter], ['ISO', ex.iso], ['Location', [p.location_name, p.county].filter(Boolean).join(', ')], ['Size', p.width ? `${p.width} × ${p.height}` : '']].filter((r) => r[1]);
    box.innerHTML = `<button class="x" type="button">Close</button>
      <div class="stage"><img src="/media/${p.id}/display" alt="${esc(sp?.common_name || 'Photograph')}"></div>
      <div class="info">
        <span class="mono">${i + 1} / ${photos.length}${isDef ? ' · Definitive image' : ''}</span>
        <h3 style="margin:8px 0 2px"><a href="/species/${p.species_id}" data-link style="text-decoration:none">${esc(sp?.common_name || '')}</a></h3>
        <div class="sci" style="color:var(--gray)">${esc(sp?.scientific_name || '')}</div>
        ${p.caption && !S.owner ? `<p style="margin-top:14px;font-family:var(--serif)">${esc(p.caption)}</p>` : ''}
        <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('') || '<dd>No EXIF data recorded.</dd>'}</dl>
        ${S.owner ? `
          <div class="stars" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-rate="${n}" class="${n <= p.rating ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
          <p style="margin:12px 0 6px"><span class="label">Caption</span></p><textarea rows="3" class="cap-in">${esc(p.caption)}</textarea>
          <p style="margin:12px 0 6px"><span class="label">Visibility</span></p><select class="vis-in"><option value="private" ${p.visibility === 'private' ? 'selected' : ''}>Private (only me)</option><option value="public" ${p.visibility === 'public' ? 'selected' : ''}>Public</option></select>
          <div style="margin-top:18px">
            <button class="btn small" data-act="def" type="button" ${isDef ? 'disabled' : ''}>${isDef ? 'Definitive image' : 'Make definitive image'}</button>
            <button class="btn small" data-act="fav" type="button">${p.favorite ? 'Remove favorite' : 'Mark favorite'}</button>
            <button class="btn small" data-act="idc" type="button">${p.id_confirmed ? 'Mark ID pending' : 'Confirm identification'}</button>
            ${p.original_kept ? `<a class="btn small" href="/media/${p.id}/original">Download original</a>` : ''}
            <button class="btn small danger" data-act="del" type="button">Delete photograph</button>
          </div>
          ${p.original_kept ? '' : '<p class="caption" style="margin-top:12px">The original file was not archived for this photograph; this is the 2560-pixel display copy.</p>'}` : ''}
        <div style="margin-top:22px">${i > 0 ? '<button class="btn small" data-act="prev" type="button">Previous</button>' : ''}${i < photos.length - 1 ? '<button class="btn small" data-act="next" type="button">Next</button>' : ''}</div>
      </div>`;
    $('.x', box).onclick = close;
    $$('a[data-link]', box).forEach((a) => a.addEventListener('click', close));
    const patch = async (body, msg) => { try { await api('/photos/' + p.id, { method: 'PATCH', body }); Object.assign(p, body); if (msg) toast(msg); draw(); return true; } catch (e) { toast(e.message, true); } };
    $$('[data-rate]', box).forEach((b) => (b.onclick = () => patch({ rating: +b.dataset.rate === p.rating ? 0 : +b.dataset.rate })));
    const cap = $('.cap-in', box); if (cap) cap.onchange = () => patch({ caption: cap.value }, 'Caption saved.');
    const vis = $('.vis-in', box); if (vis) vis.onchange = async () => { if (await patch({ visibility: vis.value }, vis.value === 'public' ? 'This photograph is now public.' : 'This photograph is now private.')) changed(); };
    $$('[data-act]', box).forEach((b) => (b.onclick = async () => {
      const a = b.dataset.act;
      if (a === 'prev') { i--; draw(); } else if (a === 'next') { i++; draw(); }
      else if (a === 'fav') patch({ favorite: p.favorite ? 0 : 1 });
      else if (a === 'idc') { if (await patch({ id_confirmed: p.id_confirmed ? 0 : 1 })) { close(); changed(); } }
      else if (a === 'def') { try { await api('/species/' + p.species_id, { method: 'PATCH', body: { definitive_photo_id: p.id } }); toast('Set as the definitive image for this species.'); close(); changed(); } catch (e) { toast(e.message, true); } }
      else if (a === 'del') { if (b.dataset.sure) { try { await api('/photos/' + p.id, { method: 'DELETE' }); toast('Photograph deleted.'); close(); changed(); } catch (e) { toast(e.message, true); } } else { b.dataset.sure = 1; b.textContent = 'Click again to delete'; } }
    }));
  };
  draw();
}
