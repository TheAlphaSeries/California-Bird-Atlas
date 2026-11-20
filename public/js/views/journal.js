import { S, $, $$, api, esc, toast, fmtLong, modal, COUNTIES } from '../util.js';
import { DataGrid } from '../grid.js';
import { openObservation } from '../observe.js';

let tab = 'notes';
const changed = () => window.dispatchEvent(new Event('atlas:changed'));

export default async function journal(view) {
  const obs = await api('/observations');
  view.innerHTML = `<div class="wrap">
    <header class="page-head"><span class="label">The naturalist's journal</span><h1>Field Journal</h1>
      <p class="deck">A chronological record of days in the field${S.owner ? '' : ', showing the entries that have been made public'}.</p></header>
    <div class="tabs" role="tablist"><button type="button" data-tab="notes" class="${tab === 'notes' ? 'active' : ''}">Field notes</button><button type="button" data-tab="records" class="${tab === 'records' ? 'active' : ''}">Observation records</button></div>
    <div id="jb"></div></div>`;
  $$('[data-tab]', view).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; journal(view); }));
  const box = $('#jb', view);

  if (tab === 'notes') {
    if (!obs.length) { box.innerHTML = `<p class="empty">No field notes yet.</p>${S.owner ? '<button class="btn solid" id="add" type="button">Record the first observation</button>' : ''}`; if ($('#add', box)) $('#add', box).onclick = () => openObservation(); return; }
    const days = new Map();
    for (const o of obs) { const k = o.observed_at.slice(0, 10) + '|' + (o.location_name || ''); if (!days.has(k)) days.set(k, []); days.get(k).push(o); }
    box.innerHTML = `<p class="note">Typeset journal entries with photo essays, drafts and publishing are planned for the journal phase. For now this page gathers your observations into field days.</p>` + [...days.values()].map((set) => {
      const first = set[0], photos = set.filter((o) => o.photo_id);
      return `<article class="section" style="padding:34px 0;border-top:1px solid var(--charcoal)">
        <span class="mono">${esc(fmtLong(first.observed_at.slice(0, 10)))}${first.county ? ' · ' + esc(first.county) + ' County' : ''}</span>
        <h2 style="margin:8px 0 18px">${esc(first.location_name || 'Unnamed location')}</h2>
        ${photos.length ? `<div class="thumbs" style="margin-bottom:20px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${photos.slice(0, 6).map((o) => `<a href="/species/${o.species_id}" data-link style="aspect-ratio:3/2;display:block;overflow:hidden;background:var(--ivory)"><img loading="lazy" src="/media/${o.photo_id}/thumb" alt="${esc(o.common_name)}" style="width:100%;height:100%;object-fit:cover"></a>`).join('')}</div>` : ''}
        <table class="plain"><thead><tr><th>Time</th><th>Species</th><th>Count</th><th>Notes</th></tr></thead><tbody>${set.map((o) => `<tr><td class="mono">${esc(o.observed_at.slice(11, 16))}</td><td><a href="/species/${o.species_id}" data-link>${esc(o.common_name)}</a> <span class="sci caption">${esc(o.scientific_name)}</span>${o.confidence !== 'confirmed' ? ` <span class="mono">(${esc(o.confidence)})</span>` : ''}</td><td>${o.count ?? ''}</td><td>${esc([o.behavior, o.habitat, o.notes].filter(Boolean).join('. '))}</td></tr>`).join('')}</tbody></table>
      </article>`;
    }).join('');
    return;
  }

  box.innerHTML = `<p class="caption" style="margin-bottom:14px">${S.owner ? 'Every observation, one row each. Click a cell to edit. To change the species, type its common name.' : 'Public observation records.'}</p><div id="grid"></div>`;
  const custom = S.fields.filter((f) => f.tbl === 'observations').map((f) => ({ key: f.key, label: f.label, width: 150, editable: true, custom: true, fieldId: f.id, type: f.type === 'select' ? 'text' : f.type, options: f.type === 'select' ? ['', ...f.options.split(',').map((x) => x.trim()).filter(Boolean)] : null }));
  const findSp = (name) => S.species.find((s) => s.common_name.toLowerCase() === String(name).trim().toLowerCase() || s.scientific_name.toLowerCase() === String(name).trim().toLowerCase());
  new DataGrid($('#grid', box), {
    id: 'observations', title: 'Observations', rows: obs, editable: S.owner, views: S.views.filter((v) => v.tbl === 'observations'),
    columns: [
      { key: 'observed_at', label: 'Date and time', width: 160, editable: true, noBulk: true, format: (v) => String(v || '').replace('T', ' ').slice(0, 16) },
      { key: 'common_name', label: 'Species', width: 200, editable: true, noBulk: true, link: (r) => '/species/' + r.species_id },
      { key: 'scientific_name', label: 'Scientific name', width: 190, cls: 'sci' },
      { key: 'location_name', label: 'Location', width: 190, editable: true },
      { key: 'county', label: 'County', width: 130, editable: true, options: ['', ...COUNTIES] },
      { key: 'count', label: 'Number', width: 90, editable: true, type: 'number' },
      { key: 'behavior', label: 'Behavior', width: 160, editable: true },
      { key: 'habitat', label: 'Habitat', width: 160, editable: true },
      { key: 'confidence', label: 'ID confidence', width: 130, editable: true, options: ['confirmed', 'probable', 'pending'] },
      { key: 'visibility', label: 'Visibility', width: 110, editable: true, options: ['private', 'public'] },
      { key: 'photo_count', label: 'Photos', width: 80, type: 'number' },
      { key: 'lat', label: 'Latitude', width: 110, editable: true, type: 'number', hidden: true },
      { key: 'lng', label: 'Longitude', width: 110, editable: true, type: 'number', hidden: true },
      { key: 'notes', label: 'Notes', width: 280, editable: true },
      ...custom,
    ],
    onEdit: async (row, c, v) => {
      if (c.key === 'common_name') { const sp = findSp(v); if (!sp) throw new Error(`"${v}" is not in the catalog. Use the exact common name.`); await api('/observations/' + row.id, { method: 'PATCH', body: { species_id: sp.id } }); row.species_id = sp.id; row.scientific_name = sp.scientific_name; setTimeout(changed); return; }
      if (c.key === 'observed_at' && !/^\d{4}-\d\d-\d\d/.test(v)) throw new Error('Enter the date as YYYY-MM-DD, optionally followed by a time (HH:MM).');
      await api('/observations/' + row.id, { method: 'PATCH', body: c.custom ? { custom: { [c.key]: v } } : { [c.key]: c.key === 'observed_at' ? v.replace(' ', 'T') : v } });
    },
    onBulk: async (ids, c, v) => { for (const id of ids) await api('/observations/' + id, { method: 'PATCH', body: c.custom ? { custom: { [c.key]: v } } : { [c.key]: v } }); toast(`${ids.length} rows updated.`); changed(); },
    onAdd: () => openObservation(),
    onDelete: (rows) => {
      const m = modal(`<span class="label">Remove rows</span><h2>Delete ${rows.length} observation${rows.length > 1 ? 's' : ''}?</h2><p>Photographs attached to them are kept and stay linked to their species.</p><button class="btn solid danger" id="yes" type="button">Delete</button>`);
      $('#yes', m.el).onclick = async () => { for (const r of rows) await api('/observations/' + r.id, { method: 'DELETE' }); m.close(); toast('Deleted.'); changed(); };
    },
    onAddColumn: async (def) => { await api('/fields', { method: 'POST', body: { tbl: 'observations', ...def } }); toast('Column added.'); changed(); },
    onRemoveColumn: async (c) => { await api('/fields/' + c.fieldId, { method: 'DELETE' }); toast('Column removed.'); changed(); },
    onSaveView: async (name, config) => { await api('/views', { method: 'POST', body: { tbl: 'observations', name, config } }); toast('View saved.'); changed(); },
    onDeleteView: async (id) => { await api('/views/' + id, { method: 'DELETE' }); changed(); },
    onImport: async (rows) => {
      const have = new Set(obs.map((o) => `${o.species_id}|${String(o.observed_at).slice(0, 16)}|${(o.location_name || '').toLowerCase()}`));
      let added = 0, dup = 0, bad = 0;
      for (const r of rows) {
        const sp = findSp(r.common_name || ''); const when = String(r.observed_at || '').trim().replace(' ', 'T');
        if (!sp || !/^\d{4}-\d\d-\d\d/.test(when)) { bad++; continue; }
        const k = `${sp.id}|${when.slice(0, 16)}|${(r.location_name || '').toLowerCase()}`;
        if (have.has(k)) { dup++; continue; } have.add(k);
        const { custom, common_name, ...rest } = r;
        const res = await api('/observations', { method: 'POST', body: { ...rest, species_id: sp.id, observed_at: when, confidence: ['confirmed', 'probable', 'pending'].includes(r.confidence) ? r.confidence : 'confirmed', visibility: r.visibility === 'public' ? 'public' : 'private' } });
        if (custom && Object.keys(custom).length) await api('/observations/' + res.id, { method: 'PATCH', body: { custom } });
        added++;
      }
      toast(`Import finished: ${added} added, ${dup} duplicates skipped, ${bad} rows skipped (species not in the catalog, or no valid date).`); changed();
    },
  });
}
