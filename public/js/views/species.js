import { S, $, $$, api, esc, toast, picture, pad3, fmtDate, STATUS, NATIVE, SEASON, PRIORITY } from '../util.js';
import { openObservation } from '../observe.js';
import { openLightbox } from '../lightbox.js';
import { GROUPS } from '../photoguide.js';

const SECTIONS = [['ident', 'Identification'], ['natural_history', 'Natural History'], ['distribution', 'California Distribution'], ['where_to_find', 'Where to Find It'], ['photo_notes', 'Photography Notes']];
let editing = false;

export default async function species(view, idStr) {
  const id = +idStr;
  const { species: sp, observations, photos } = await api('/species/' + id);
  const sum = S.spById.get(id) || sp;
  const pic = picture({ ...sum, ref_url: sp.ref_url, ref_thumb: sp.ref_thumb }, 'display');
  const group = GROUPS[sp.photo_group] || GROUPS.perched;
  const opts = (arr, cur) => arr.map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const para = (t) => esc(t).split(/\n+/).map((p) => `<p>${p}</p>`).join('');
  const prev = S.species[S.species.findIndex((s) => s.id === id) - 1], next = S.species[S.species.findIndex((s) => s.id === id) + 1];

  view.innerHTML = `
  <div class="sp-hero ${pic ? '' : 'noimg'}">
    ${pic ? `<div class="fig"><img src="${esc(pic.src)}" alt="${esc(sp.common_name)}"></div>
    <div class="cap"><span>${pic.kind === 'mine' ? 'Photograph from the collection.' : `Reference photograph, not an image from this collection. ${esc(sp.ref_credit || '')}, ${sp.ref_license_url ? `<a href="${esc(sp.ref_license_url)}" rel="noopener">${esc(sp.ref_license || '')}</a>` : esc(sp.ref_license || '')}, via <a href="${esc(sp.ref_source_url || '#')}" rel="noopener">Wikimedia Commons</a>.`}</span><span>${esc(sp.common_name)}, <i>${esc(sp.scientific_name)}</i></span></div>` : ''}
  </div>
  <div class="wrap">
    <header class="sp-title">
      <span class="label ochre">Species No. ${pad3(sp.seq)}</span>
      ${editing ? `<div class="row2" style="margin-top:14px"><label class="field"><span>Common name</span><input id="e-cn" value="${esc(sp.common_name)}"></label><label class="field"><span>Scientific name</span><input id="e-sn" value="${esc(sp.scientific_name)}"></label></div>`
        : `<h1>${esc(sp.common_name)}</h1><div class="sci">${esc(sp.scientific_name)}</div>`}
    </header>
    <dl class="register">
      <div><dt>Family</dt><dd class="v">${esc(sp.family || '')}${sp.family_common ? ` · ${esc(sp.family_common)}` : ''}</dd></div>
      <div><dt>Order</dt><dd class="v">${esc(sp.ord || '')}</dd></div>
      <div><dt>Habitat</dt><dd class="v">${editing ? `<input class="input" id="e-hab" value="${esc(sp.habitats || '')}">` : esc((sp.habitats || '').replace(/;\s*/g, ' / '))}</dd></div>
      <div><dt>California status</dt><dd class="v">${editing ? `<select class="input" id="e-season">${opts(SEASON, sp.season_status)}</select>` : esc(sp.season_status || '')}</dd></div>
      <div><dt>Native status</dt><dd class="v">${editing ? `<select class="input" id="e-native">${opts(NATIVE, sp.native_status)}</select>` : esc(sp.native_status || '')}${sp.endemic ? ' · Endemic to California' : ''}${sp.review ? ' · CBRC review species' : ''}</dd></div>
      <div><dt>Conservation</dt><dd class="v">${editing ? `<input class="input" id="e-cons" value="${esc(sp.conservation || '')}">` : esc(sp.conservation || 'No listing recorded')}</dd></div>
      <div><dt>Personal status</dt><dd class="v"><span class="dot ${sum.status}"></span>${esc(STATUS[sum.status] || '')}</dd></div>
      <div><dt>Target priority</dt><dd class="v">${editing ? `<select class="input" id="e-pri">${opts(PRIORITY, sp.target_priority || '')}</select>` : esc(sp.target_priority || 'Not set')}</dd></div>
    </dl>
    <div class="sp-body">
      <article class="article">
        ${SECTIONS.map(([k, title], i) => {
          const text = sp[k] || '';
          let body;
          if (editing) body = `<textarea data-k="${k}" aria-label="${title}">${esc(text)}</textarea>`;
          else if (text) body = `<div class="${i === 0 ? 'dropcap' : ''}">${para(text)}</div>`;
          else body = `<p class="caption">${k === 'photo_notes' ? '' : `No ${title.toLowerCase()} text has been written for this species yet.${S.owner ? ' Use Edit profile to add it.' : ''}`}</p>`;
          const extra = k === 'distribution' && !editing ? '<p class="note">An interactive range map is planned for the Explore phase. No map is shown here yet.</p>'
            : k === 'where_to_find' && !editing && text ? '<p class="caption">Long-established general locations, not recent sightings. Check current access before visiting.</p>'
            : k === 'photo_notes' && !editing ? `<p class="label" style="margin:18px 0 8px">${esc(group[0])}: general approach with the X-T5 and XF 150-600mm</p><p>${esc(group[1])}</p>` : '';
          return `<section><span class="label">${String(i + 1).padStart(2, '0')}</span><h2>${title}</h2>${body}${extra}</section>`;
        }).join('')}
        ${editing ? `<section><span class="label">Private</span><h2>Notes</h2><textarea data-k="notes" aria-label="Notes">${esc(sp.notes || '')}</textarea></section>` : (S.owner && sp.notes ? `<section><span class="label">Private</span><h2>Notes</h2>${para(sp.notes)}</section>` : '')}

        <section style="max-width:none"><span class="label">06</span><h2>My Encounters</h2>
          ${observations.length ? `<table class="plain"><thead><tr><th>Date</th><th>Location</th><th>Count</th><th>Notes</th><th>ID</th></tr></thead><tbody>${observations.map((o) => `<tr><td class="mono">${esc(fmtDate(o.observed_at))}</td><td>${esc([o.location_name, o.county].filter(Boolean).join(', '))}</td><td>${o.count ?? ''}</td><td>${esc([o.behavior, o.notes].filter(Boolean).join('. '))}</td><td class="mono">${esc(o.confidence)}</td></tr>`).join('')}</tbody></table>` : `<p class="caption">No encounters recorded${S.owner ? '' : ' publicly'} yet.</p>`}
        </section>
        <section style="max-width:none"><span class="label">07</span><h2>My Photographs</h2>
          ${photos.length ? `<div class="thumbs">${photos.map((p, i) => `<button type="button" data-i="${i}" aria-label="Open photograph ${i + 1}"><img loading="lazy" src="/media/${p.id}/thumb" alt="${esc(sp.common_name)}">${sp.definitive_photo_id === p.id ? '<span class="def">Definitive</span>' : ''}</button>`).join('')}</div>` : `<p class="caption">No photographs${S.owner ? '' : ' published'} yet.</p>`}
        </section>
      </article>
      <aside class="aside">
        ${S.owner ? `<div class="block"><span class="label">Field record</span>
          <button class="btn solid" id="log" type="button">Record a sighting</button>
          <button class="btn" id="edit" type="button">${editing ? 'Save profile' : 'Edit profile'}</button>
          ${editing ? '<button class="btn quiet" id="cancel" type="button">Cancel</button>' : ''}</div>
        <div class="block"><span class="label">Reference photograph</span>
          <p class="caption" style="margin:8px 0">${sp.ref_url ? `Loaded ${esc(fmtDate(sp.ref_fetched_at))}. Shown until you photograph this species, and always labelled as a reference.` : 'None loaded. The lookup takes the lead image of the Wikipedia article and accepts it only if it is on Wikimedia Commons under a free license.'}</p>
          <button class="btn small" id="ref-find" type="button">${sp.ref_url ? 'Look up again' : 'Find reference photograph'}</button>
          <input class="input" id="ref-file" placeholder="Or a Commons file name, e.g. File:Calypte anna.jpg" style="margin-top:10px;font-size:.8rem">
          <button class="btn small quiet" id="ref-use" type="button">Use this file</button>
          ${sp.ref_url ? '<button class="btn small quiet danger" id="ref-clear" type="button">Remove reference</button>' : ''}</div>` : ''}
        <div class="block"><span class="label">In the catalog</span>
          <p class="mono" style="margin-top:10px">Encounters: ${sum.encounters || 0}<br>Photographs: ${sum.photo_count || 0}<br>First seen: ${esc(fmtDate(sum.first_seen) || 'not yet')}<br>First photographed: ${esc(fmtDate(sum.first_photo) || 'not yet')}</p></div>
        <div class="block" style="border:0"><span class="label">Neighbouring entries</span>
          <p style="margin-top:10px;font:500 1.1rem var(--display)">${prev ? `<a href="/species/${prev.id}" data-link>← ${esc(prev.common_name)}</a><br>` : ''}${next ? `<a href="/species/${next.id}" data-link>${esc(next.common_name)} →</a>` : ''}</p></div>
      </aside>
    </div>
  </div>`;

  $$('.thumbs button', view).forEach((b) => (b.onclick = () => openLightbox(photos, +b.dataset.i)));
  if (!S.owner) return;
  const rerender = () => species(view, idStr);
  $('#log', view).onclick = () => openObservation({ species_id: id });
  $('#edit', view).onclick = async () => {
    if (!editing) { editing = true; return rerender(); }
    const body = { common_name: $('#e-cn', view).value.trim(), scientific_name: $('#e-sn', view).value.trim(), habitats: $('#e-hab', view).value.trim(), season_status: $('#e-season', view).value, native_status: $('#e-native', view).value, conservation: $('#e-cons', view).value.trim(), target_priority: $('#e-pri', view).value };
    $$('textarea[data-k]', view).forEach((t) => (body[t.dataset.k] = t.value.trim()));
    if (!body.common_name || !body.scientific_name) return toast('A common name and a scientific name are required.', true);
    try { await api('/species/' + id, { method: 'PATCH', body }); editing = false; toast('Profile saved.'); window.dispatchEvent(new Event('atlas:changed')); } catch (e) { toast(e.message, true); }
  };
  if ($('#cancel', view)) $('#cancel', view).onclick = () => { editing = false; rerender(); };
  const ref = async (body, btn) => {
    btn.disabled = true;
    try { const r = await api('/reference/' + id, { method: 'POST', body }); if (r.ok) { toast(body.clear ? 'Reference removed.' : 'Reference photograph loaded.'); window.dispatchEvent(new Event('atlas:changed')); } else toast('No reference photograph was loaded: ' + r.reason, true); }
    catch (e) { toast(e.message, true); } btn.disabled = false;
  };
  $('#ref-find', view).onclick = (e) => ref({}, e.currentTarget);
  $('#ref-use', view).onclick = (e) => { const f = $('#ref-file', view).value.trim(); if (!f) return toast('Enter a Wikimedia Commons file name.', true); ref({ file: f }, e.currentTarget); };
  if ($('#ref-clear', view)) $('#ref-clear', view).onclick = (e) => ref({ clear: true }, e.currentTarget);
}
