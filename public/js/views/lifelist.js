import { S, $, $$, api, esc, toast, plate, modal, goalSpecies, inGoal, STATUS, NATIVE, SEASON, PRIORITY } from '../util.js';
import { DataGrid } from '../grid.js';

let tab = 'editorial', chip = 'all';
const changed = () => window.dispatchEvent(new Event('atlas:changed'));

export function speciesColumns() {
  const fam = (id) => S.famById.get(id)?.family || '';
  const d = (v) => (v ? String(v).slice(0, 10) : '');
  return [
    { key: 'seq', label: 'No.', width: 64, type: 'number', format: (v) => String(Math.round(v)).padStart(3, '0') },
    { key: 'common_name', label: 'Species', width: 210, editable: true, noBulk: true, importKey: true, link: (r) => '/species/' + r.id },
    { key: 'scientific_name', label: 'Scientific name', width: 200, editable: true, noBulk: true, importKey: true, cls: 'sci' },
    { key: 'family_id', label: 'Family', width: 150, format: (v) => fam(v) },
    { key: 'native_status', label: 'Native status', width: 170, editable: true, options: NATIVE },
    { key: 'season_status', label: 'Seasonal occurrence', width: 190, editable: true, options: SEASON },
    { key: 'status', label: 'Observation status', width: 210, format: (v) => STATUS[v] || '' },
    { key: 'first_seen', label: 'First seen', width: 110, format: d },
    { key: 'first_photo', label: 'First photographed', width: 140, format: d },
    { key: 'last_seen', label: 'Most recent sighting', width: 150, format: d },
    { key: 'county', label: 'County', width: 130 },
    { key: 'encounters', label: 'Encounters', width: 100, type: 'number' },
    { key: 'photo_count', label: 'Photo count', width: 100, type: 'number' },
    { key: 'target_priority', label: 'Target priority', width: 130, editable: true, options: PRIORITY },
    { key: 'habitats', label: 'Habitat', width: 220, editable: true, hidden: true },
    { key: 'conservation', label: 'Conservation status', width: 240, editable: true, hidden: true },
    { key: 'notes', label: 'Notes', width: 260, editable: true },
    ...S.fields.filter((f) => f.tbl === 'species').map((f) => ({ key: f.key, label: f.label, width: 150, editable: true, custom: true, fieldId: f.id, type: f.type === 'select' ? 'text' : f.type, options: f.type === 'select' ? ['', ...f.options.split(',').map((x) => x.trim()).filter(Boolean)] : null })),
  ];
}

export default async function lifelist(view) {
  const goal = goalSpecies(), ph = goal.filter((s) => s.status === 'photographed').length, ob = goal.filter((s) => s.status === 'observed').length;
  const pct = (n) => (goal.length ? (n / goal.length) * 100 : 0);
  view.innerHTML = `<div class="wrap">
    <header class="page-head"><span class="label">The photographic life list</span><h1>Life List</h1>
      <p class="deck">A species counts toward the goal once a photograph has been recorded and its identification confirmed.</p></header>
    <div class="goal"><div class="n">${ph}<small> / ${goal.length}</small></div>
      <div><p class="mono" style="margin-bottom:10px">Photographed: ${ph} · Observed, not yet photographed: ${ob} · Goal: ${esc(Object.entries(S.goal).filter(([, v]) => v).map(([k]) => k.toLowerCase()).join(', ') || 'no categories selected')} (${goal.length} of ${S.species.length} catalog species). ${S.owner ? '<a href="/settings#goal" data-link>Change what counts</a>' : ''}</p>
      <div class="progress"><i class="obs" style="width:${pct(ph + ob)}%"></i><i style="width:${pct(ph)}%"></i></div></div></div>
    <div class="tabs" role="tablist">${[['editorial', 'Editorial collection'], ['catalog', 'Scientific catalog'], ['taxonomic', 'Taxonomic collection']].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div id="ll"></div></div>`;
  $$('[data-tab]', view).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; lifelist(view); }));
  const box = $('#ll', view);

  if (tab === 'editorial') {
    const counts = { all: S.species.length }; for (const k of Object.keys(STATUS)) counts[k] = S.species.filter((s) => s.status === k).length;
    const draw = () => {
      const rows = S.species.filter((s) => chip === 'all' || s.status === chip);
      box.innerHTML = `<div class="chips">${[['all', 'All species'], ...Object.entries(STATUS)].map(([k, l]) => `<button type="button" class="chip ${chip === k ? 'active' : ''}" data-chip="${k}">${l} · ${counts[k]}</button>`).join('')}</div>
        <p class="caption" style="margin:-10px 0 24px">Species you have photographed show your selected image. All others show a credited reference photograph where one has been loaded, labelled as a reference.</p>
        ${rows.length ? `<div class="plates">${rows.map((s) => plate(s, { tag: inGoal(s) ? '' : 'Outside the goal' })).join('')}</div>` : '<p class="empty">No species in this group yet.</p>'}`;
      $$('[data-chip]', box).forEach((b) => (b.onclick = () => { chip = b.dataset.chip; draw(); }));
    };
    draw();
  } else if (tab === 'taxonomic') {
    box.innerHTML = `<p class="caption" style="margin-bottom:14px">Completion is counted over the species that qualify for the goal. Dark bar: photographed. Ochre: observed.</p><ul class="taxa">${S.families.map((f) => {
      const all = S.species.filter((s) => s.family_id === f.id), g = all.filter(inGoal); if (!all.length) return '';
      const p = g.filter((s) => s.status === 'photographed').length, o = g.filter((s) => s.status === 'observed').length, w = (n) => (g.length ? (n / g.length) * 100 : 0);
      return `<li><details><summary><span class="fn">${esc(f.family_common)}<small>${esc(f.family)}</small></span><span class="progress"><i class="obs" style="width:${w(p + o)}%"></i><i style="width:${w(p)}%"></i></span><span class="ct">${p} / ${g.length}</span></summary>
        <div class="members">${all.map((s) => `<a href="/species/${s.id}" data-link><span class="dot ${s.status}"></span>${esc(s.common_name)}${inGoal(s) ? '' : ' <span class="caption">(outside goal)</span>'}</a>`).join('')}</div></details></li>`;
    }).join('')}</ul>`;
  } else {
    box.innerHTML = `<p class="caption" style="margin-bottom:14px">${S.owner ? 'Click a cell to edit it. Dates, counts and observation status are calculated from your records and cannot be typed over.' : 'Sign in as the owner to edit this register.'}</p><div id="grid"></div>`;
    new DataGrid($('#grid', box), {
      id: 'species-catalog', title: 'Life List', columns: speciesColumns(), rows: S.species, editable: S.owner, views: S.views.filter((v) => v.tbl === 'species'),
      onEdit: (row, c, v) => api('/species/' + row.id, { method: 'PATCH', body: c.custom ? { custom: { [c.key]: v } } : { [c.key]: v } }),
      onBulk: async (ids, c, v) => { await api('/species/bulk', { method: 'POST', body: { ids, patch: c.custom ? { custom: { [c.key]: v } } : { [c.key]: v } } }); toast(`${ids.length} rows updated.`); changed(); },
      onAdd: () => addSpecies(),
      onDelete: async (rows) => {
        const m = modal(`<span class="label">Remove rows</span><h2>Remove ${rows.length} species?</h2><p>${esc(rows.slice(0, 6).map((r) => r.common_name).join(', '))}${rows.length > 6 ? ' and others' : ''}. Species that have observations or photographs are kept.</p><button class="btn solid danger" id="yes" type="button">Remove from the catalog</button>`);
        $('#yes', m.el).onclick = async () => { let ok = 0, kept = 0; for (const r of rows) { try { await api('/species/' + r.id, { method: 'DELETE' }); ok++; } catch { kept++; } } m.close(); toast(`${ok} removed${kept ? `, ${kept} kept because they have records` : ''}.`); changed(); };
      },
      onAddColumn: async (def) => { await api('/fields', { method: 'POST', body: { tbl: 'species', ...def } }); toast('Column added.'); changed(); },
      onRemoveColumn: async (c) => { await api('/fields/' + c.fieldId, { method: 'DELETE' }); toast('Column removed. Its values are kept and return if you add a column with the same name.'); changed(); },
      onSaveView: async (name, config) => { await api('/views', { method: 'POST', body: { tbl: 'species', name, config } }); toast('View saved.'); changed(); },
      onDeleteView: async (id) => { await api('/views/' + id, { method: 'DELETE' }); changed(); },
      onImport: async (rows, unmatched) => {
        const seen = new Set(); let dups = 0;
        const uniq = rows.filter((r) => { const k = (r.scientific_name || r.common_name || '').toLowerCase(); if (!k) return false; if (seen.has(k)) { dups++; return false; } seen.add(k); return true; });
        const r = await api('/species/import', { method: 'POST', body: { rows: uniq } });
        toast(`Import finished: ${r.updated} existing species updated, ${r.created} added, ${r.skipped + dups} skipped${dups ? ` (${dups} duplicate rows in the file)` : ''}.${unmatched.length ? ` Unrecognised columns ignored: ${unmatched.join(', ')}.` : ''}`);
        changed();
      },
    });
  }
}

function addSpecies() {
  const m = modal(`<span class="label">Catalog</span><h2>Add a species</h2><form>
    <div class="row2"><label class="field"><span>Common name</span><input name="common_name" required></label><label class="field"><span>Scientific name</span><input name="scientific_name" required></label></div>
    <label class="field"><span>Family</span><select name="family_id"><option value="">Unplaced</option>${S.families.map((f) => `<option value="${f.id}">${esc(f.family_common)} (${esc(f.family)})</option>`).join('')}</select></label>
    <div class="row2"><label class="field"><span>Native status</span><select name="native_status">${NATIVE.map((x) => `<option>${x}</option>`).join('')}</select></label><label class="field"><span>Seasonal occurrence</span><select name="season_status">${SEASON.map((x) => `<option>${x}</option>`).join('')}</select></label></div>
    <button class="btn solid">Add to the catalog</button></form>`);
  $('form', m.el).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const body = { common_name: f.common_name.value.trim(), scientific_name: f.scientific_name.value.trim(), family_id: f.family_id.value ? +f.family_id.value : null, native_status: f.native_status.value, season_status: f.season_status.value };
    try {
      const r = await api('/species', { method: 'POST', body, allow: [409] });
      if (r.duplicate) return toast(r.error + ' Nothing was added.', true);
      m.close(); toast('Species added.'); changed();
    } catch (err) { toast(err.message, true); }
  };
}
