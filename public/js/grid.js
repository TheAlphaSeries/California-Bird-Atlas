// DataGrid: an editable, extensible table (sort, filter, resize, reorder, inline edit, custom columns,
// saved views, bulk update, CSV / Excel export, CSV import).
import { $, $$, esc, toast, download, modal } from './util.js';

const OPS = { contains: 'contains', is: 'is', not: 'is not', empty: 'is empty', filled: 'is not empty', gt: 'is greater than', lt: 'is less than' };

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export class DataGrid {
  // opts: { id, title, columns, rows, editable, views, onEdit, onAdd, onDelete, onBulk, onAddColumn, onRemoveColumn, onImport, onSaveView, onDeleteView }
  constructor(el, opts) {
    this.el = el; this.o = opts; this.rows = opts.rows; this.cols = opts.columns;
    this.state = { order: this.cols.map((c) => c.key), widths: {}, hidden: this.cols.filter((c) => c.hidden).map((c) => c.key), sort: opts.sort || null, filters: [], search: '' };
    try { const saved = JSON.parse(localStorage.getItem('grid:' + opts.id) || 'null'); if (saved) this.apply(saved, true); } catch { /* no saved layout */ }
    this.selected = new Set();
    this.render();
  }
  apply(cfg, quiet) {
    const keys = this.cols.map((c) => c.key);
    const order = (cfg.order || []).filter((k) => keys.includes(k));
    this.state = { order: [...order, ...keys.filter((k) => !order.includes(k))], widths: cfg.widths || {}, hidden: (cfg.hidden || []).filter((k) => keys.includes(k)), sort: cfg.sort || null, filters: (cfg.filters || []).filter((f) => keys.includes(f.key)), search: cfg.search || '' };
    if (!quiet) { this.persist(); this.render(); }
  }
  persist() { try { localStorage.setItem('grid:' + this.o.id, JSON.stringify(this.state)); } catch { /* storage unavailable */ } }
  col(key) { return this.cols.find((c) => c.key === key); }
  val(row, c) { const v = c.custom ? row.custom?.[c.key] : row[c.key]; return v ?? ''; }
  text(row, c) { const v = this.val(row, c); return c.format ? c.format(v, row) : String(v); }
  visible() { return this.state.order.filter((k) => !this.state.hidden.includes(k)).map((k) => this.col(k)).filter(Boolean); }
  filtered() {
    const { filters, search, sort } = this.state; const q = search.trim().toLowerCase(); const vis = this.visible();
    let out = this.rows.filter((r) => {
      if (q && !vis.some((c) => this.text(r, c).toLowerCase().includes(q))) return false;
      return filters.every((f) => {
        const c = this.col(f.key); if (!c) return true;
        const t = this.text(r, c).toLowerCase(), v = String(f.value ?? '').toLowerCase();
        switch (f.op) {
          case 'is': return t === v; case 'not': return t !== v; case 'empty': return t === ''; case 'filled': return t !== '';
          case 'gt': return t !== '' && (isNaN(+t) || isNaN(+v) ? t > v : +t > +v); case 'lt': return t !== '' && (isNaN(+t) || isNaN(+v) ? t < v : +t < +v);
          default: return t.includes(v);
        }
      });
    });
    if (sort && this.col(sort.key)) {
      const c = this.col(sort.key), dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) => {
        const x = this.val(a, c), y = this.val(b, c);
        if (x === '' && y !== '') return 1; if (y === '' && x !== '') return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir;
      });
    }
    return out;
  }
  render() {
    const o = this.o, st = this.state, ed = o.editable;
    this.el.innerHTML = `
      <div class="grid-tools">
        <input class="input g-search" type="search" placeholder="Search this table" value="${esc(st.search)}" aria-label="Search this table">
        <button class="btn small quiet g-addfilter" type="button">Add filter</button>
        <button class="btn small quiet g-columns" type="button">Columns</button>
        <select class="input g-views" aria-label="Saved views"><option value="">Saved views…</option><option value="__default">Default layout</option>${(o.views || []).map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}${ed ? '<option value="__save">Save current view…</option>' : ''}${ed && (o.views || []).length ? '<option value="__delete">Delete a saved view…</option>' : ''}</select>
        <span class="spacer"></span>
        ${ed && o.onAdd ? '<button class="btn small g-add" type="button">Add row</button>' : ''}
        ${ed && o.onAddColumn ? '<button class="btn small quiet g-addcol" type="button">Add column</button>' : ''}
        ${ed && o.onImport ? '<button class="btn small quiet g-import" type="button">Import CSV</button><input type="file" class="g-file" accept=".csv,text/csv" hidden>' : ''}
        <button class="btn small quiet g-csv" type="button">Export CSV</button>
        <button class="btn small quiet g-xlsx" type="button">Export Excel</button>
      </div>
      <div class="grid-filters"></div>
      <div class="grid-scroll" tabindex="0"><table class="grid"><colgroup></colgroup><thead></thead><tbody></tbody></table></div>
      <div class="grid-foot"><span class="mono g-count"></span><span class="g-bulk"></span></div>`;
    $('.g-search', this.el).oninput = (e) => { st.search = e.target.value; this.persist(); this.body(); };
    $('.g-addfilter', this.el).onclick = () => { st.filters.push({ key: this.visible()[0].key, op: 'contains', value: '' }); this.persist(); this.filters(); };
    $('.g-columns', this.el).onclick = (e) => this.columnsMenu(e.currentTarget);
    $('.g-views', this.el).onchange = (e) => this.viewAction(e.target);
    $('.g-csv', this.el).onclick = () => this.exportCSV();
    $('.g-xlsx', this.el).onclick = () => this.exportXLSX();
    if ($('.g-add', this.el)) $('.g-add', this.el).onclick = () => o.onAdd();
    if ($('.g-addcol', this.el)) $('.g-addcol', this.el).onclick = () => this.addColumn();
    if ($('.g-import', this.el)) { $('.g-import', this.el).onclick = () => $('.g-file', this.el).click(); $('.g-file', this.el).onchange = (e) => this.importCSV(e.target); }
    this.filters(); this.head(); this.body();
  }
  filters() {
    const box = $('.grid-filters', this.el), st = this.state;
    box.innerHTML = st.filters.map((f, i) => {
      const c = this.col(f.key);
      const valueInput = ['empty', 'filled'].includes(f.op) ? '' : (c?.options && ['is', 'not'].includes(f.op) ? `<select class="input" data-i="${i}" data-k="value"><option value=""></option>${c.options.map((x) => `<option ${String(f.value) === String(x) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<input class="input" data-i="${i}" data-k="value" value="${esc(f.value)}" placeholder="value">`);
      return `<div class="f"><select class="input" data-i="${i}" data-k="key">${this.cols.map((x) => `<option value="${x.key}" ${x.key === f.key ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        <select class="input" data-i="${i}" data-k="op">${Object.entries(OPS).map(([k, l]) => `<option value="${k}" ${k === f.op ? 'selected' : ''}>${l}</option>`).join('')}</select>${valueInput}
        <button class="btn small quiet" data-rm="${i}" type="button">Remove</button></div>`;
    }).join('');
    $$('[data-k]', box).forEach((inp) => { const h = () => { const f = st.filters[+inp.dataset.i]; f[inp.dataset.k] = inp.value; this.persist(); if (inp.dataset.k !== 'value') this.filters(); this.body(); }; inp.oninput = inp.tagName === 'INPUT' ? h : null; inp.onchange = inp.tagName === 'SELECT' ? h : null; });
    $$('[data-rm]', box).forEach((b) => (b.onclick = () => { st.filters.splice(+b.dataset.rm, 1); this.persist(); this.filters(); this.body(); }));
  }
  head() {
    const vis = this.visible(), st = this.state, ed = this.o.editable;
    $('colgroup', this.el).innerHTML = (ed ? '<col style="width:34px">' : '') + vis.map((c) => `<col data-key="${c.key}" style="width:${st.widths[c.key] || c.width || 150}px">`).join('');
    $('thead', this.el).innerHTML = `<tr>${ed ? '<th class="chk"><input type="checkbox" class="g-all" aria-label="Select all rows"></th>' : ''}${vis.map((c) => `<th draggable="true" data-key="${c.key}" title="${esc(c.label)}${c.custom ? ' (custom column)' : ''}">${esc(c.label)}${st.sort?.key === c.key ? (st.sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}<span class="rs"></span></th>`).join('')}</tr>`;
    if (ed) $('.g-all', this.el).onchange = (e) => { const rows = this.filtered(); this.selected = new Set(e.target.checked ? rows.map((r) => r.id) : []); this.body(); };
    $$('th[data-key]', this.el).forEach((th) => {
      const key = th.dataset.key;
      th.onclick = (e) => { if (e.target.classList.contains('rs')) return; st.sort = st.sort?.key === key ? (st.sort.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }; this.persist(); this.head(); this.body(); };
      th.ondragstart = (e) => e.dataTransfer.setData('text/plain', key);
      th.ondragover = (e) => { e.preventDefault(); th.classList.add('drop'); };
      th.ondragleave = () => th.classList.remove('drop');
      th.ondrop = (e) => { e.preventDefault(); th.classList.remove('drop'); const from = e.dataTransfer.getData('text/plain'); if (!from || from === key) return; const ord = st.order.filter((k) => k !== from); ord.splice(ord.indexOf(key), 0, from); st.order = ord; this.persist(); this.head(); this.body(); };
      $('.rs', th).onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation(); th.draggable = false;
        const x0 = e.clientX, w0 = th.offsetWidth, col = $(`col[data-key="${key}"]`, this.el);
        const move = (ev) => { const w = Math.max(60, w0 + ev.clientX - x0); col.style.width = w + 'px'; st.widths[key] = w; };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); th.draggable = true; this.persist(); };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      };
    });
  }
  body() {
    const vis = this.visible(), rows = this.filtered(), ed = this.o.editable;
    this.shown = rows;
    $('tbody', this.el).innerHTML = rows.map((r) => `<tr data-id="${r.id}" class="${this.selected.has(r.id) ? 'sel' : ''}">${ed ? `<td class="chk"><input type="checkbox" ${this.selected.has(r.id) ? 'checked' : ''} aria-label="Select row"></td>` : ''}${vis.map((c) => {
      const t = this.text(r, c), can = ed && c.editable;
      const inner = c.link ? `<a href="${esc(c.link(r))}" data-link>${esc(t)}</a>` : esc(t);
      return `<td data-key="${c.key}" class="${can ? 'ed' : 'ro'} ${c.cls || ''}" title="${esc(t)}">${inner}</td>`;
    }).join('')}</tr>`).join('') || `<tr><td colspan="${vis.length + 1}" style="padding:24px;color:var(--gray)">No rows match.</td></tr>`;
    $('.g-count', this.el).textContent = `${rows.length} of ${this.rows.length} rows`;
    const tb = $('tbody', this.el);
    tb.onchange = (e) => { if (!e.target.matches('.chk input')) return; const id = +e.target.closest('tr').dataset.id; e.target.checked ? this.selected.add(id) : this.selected.delete(id); e.target.closest('tr').classList.toggle('sel', e.target.checked); this.bulk(); };
    tb.onclick = (e) => { const td = e.target.closest('td.ed'); if (!td || e.target.closest('a') || td.querySelector('input,select')) return; this.edit(td); };
    this.bulk();
  }
  bulk() {
    const box = $('.g-bulk', this.el); const n = this.selected.size, o = this.o;
    if (!o.editable || !n) { box.innerHTML = ''; return; }
    const cols = this.cols.filter((c) => c.editable && !c.noBulk);
    box.innerHTML = `<span class="mono">${n} selected</span> <select class="input b-col" style="width:auto;font-size:.78rem;padding:5px 7px">${cols.map((c) => `<option value="${c.key}">${esc(c.label)}</option>`).join('')}</select> <span class="b-val"></span> <button class="btn small b-go" type="button">Apply to selected</button> ${o.onDelete ? '<button class="btn small quiet danger b-del" type="button">Remove selected</button>' : ''}`;
    const drawVal = () => { const c = this.col($('.b-col', box).value); $('.b-val', box).innerHTML = c.options ? `<select class="input" style="width:auto;font-size:.78rem;padding:5px 7px">${c.options.map((x) => `<option>${esc(x)}</option>`).join('')}</select>` : `<input class="input" style="width:150px;font-size:.78rem;padding:5px 7px" placeholder="new value">`; };
    drawVal(); $('.b-col', box).onchange = drawVal;
    $('.b-go', box).onclick = async () => { const c = this.col($('.b-col', box).value), v = $('.b-val input, .b-val select', box).value; try { await o.onBulk([...this.selected], c, c.type === 'number' && v !== '' ? Number(v) : v); } catch (e) { toast(e.message, true); } };
    if ($('.b-del', box)) $('.b-del', box).onclick = () => o.onDelete(this.rows.filter((r) => this.selected.has(r.id)));
  }
  edit(td) {
    const id = +td.parentElement.dataset.id, c = this.col(td.dataset.key), row = this.rows.find((r) => r.id === id);
    const cur = this.val(row, c);
    td.innerHTML = c.options ? `<select>${c.options.map((x) => `<option ${String(cur) === String(x) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<input type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}" value="${esc(cur)}">`;
    const inp = td.firstChild; inp.focus(); if (inp.select) inp.select();
    let done = false;
    const finish = async (save) => {
      if (done) return; done = true;
      let v = inp.value; if (c.type === 'number') v = v === '' ? null : Number(v);
      if (save && String(v ?? '') !== String(cur ?? '')) {
        try { await this.o.onEdit(row, c, v); if (c.custom) (row.custom ||= {})[c.key] = v; else row[c.key] = v; }
        catch (e) { toast(e.message, true); }
      }
      const t = this.text(row, c); td.textContent = t; td.title = t;
    };
    inp.onblur = () => finish(true);
    inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); else if (e.key === 'Escape') finish(false); };
    if (c.options) inp.onchange = () => inp.blur();
  }
  pop(anchor, html) {
    $$('.pop').forEach((p) => p.remove());
    const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect(); p.style.top = r.bottom + window.scrollY + 6 + 'px'; p.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - p.offsetWidth - 12)) + 'px';
    const off = (e) => { if (!p.contains(e.target) && e.target !== anchor) { p.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off));
    return p;
  }
  columnsMenu(anchor) {
    const st = this.state;
    const p = this.pop(anchor, `<div class="label" style="margin-bottom:8px">Show columns</div>${st.order.map((k) => { const c = this.col(k); return `<label><input type="checkbox" data-key="${k}" ${st.hidden.includes(k) ? '' : 'checked'}> ${esc(c.label)}${c.custom && this.o.onRemoveColumn ? ` <button class="btn small quiet danger" data-del="${k}" type="button" style="margin-left:auto;padding:4px 6px">Delete</button>` : ''}</label>`; }).join('')}<p class="caption" style="margin:10px 0 0">Drag a column heading to reorder. Drag its right edge to resize.</p>`);
    $$('input', p).forEach((cb) => (cb.onchange = () => { st.hidden = cb.checked ? st.hidden.filter((k) => k !== cb.dataset.key) : [...st.hidden, cb.dataset.key]; this.persist(); this.head(); this.body(); }));
    $$('[data-del]', p).forEach((b) => (b.onclick = () => { p.remove(); this.o.onRemoveColumn(this.col(b.dataset.del)); }));
  }
  async viewAction(sel) {
    const v = sel.value, o = this.o; sel.value = '';
    if (v === '__default') { try { localStorage.removeItem('grid:' + o.id); } catch { /* ignore */ } this.apply({}); return; }
    if (v === '__save') {
      const m = modal(`<span class="label">Saved view</span><h2>Save this layout</h2><p class="caption" style="margin-bottom:16px">Stores the current filters, sort order, column order, widths and hidden columns.</p><form><label class="field"><span>Name</span><input name="name" required maxlength="60"></label><button class="btn solid">Save view</button></form>`);
      $('form', m.el).onsubmit = async (e) => { e.preventDefault(); try { await o.onSaveView(e.target.name.value.trim(), JSON.parse(JSON.stringify(this.state))); m.close(); } catch (err) { toast(err.message, true); } };
      return;
    }
    if (v === '__delete') {
      const m = modal(`<span class="label">Saved views</span><h2>Delete a saved view</h2>${o.views.map((x) => `<p><button class="btn small danger" data-id="${x.id}" type="button">Delete</button> &nbsp; ${esc(x.name)}</p>`).join('')}`);
      $$('[data-id]', m.el).forEach((b) => (b.onclick = async () => { await o.onDeleteView(+b.dataset.id); m.close(); }));
      return;
    }
    const view = (o.views || []).find((x) => String(x.id) === v); if (view) this.apply(view.config);
  }
  addColumn() {
    const m = modal(`<span class="label">Custom column</span><h2>Add a column</h2><form><label class="field"><span>Column name</span><input name="label" required maxlength="40" placeholder="e.g. Best lens"></label>
      <label class="field"><span>Type</span><select name="type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option></select></label>
      <label class="field"><span>Dropdown choices (comma separated)</span><input name="options" placeholder="Only used for dropdown columns"></label><button class="btn solid">Add column</button></form>`);
    $('form', m.el).onsubmit = async (e) => { e.preventDefault(); const f = e.target; try { await this.o.onAddColumn({ label: f.label.value.trim(), type: f.type.value, options: f.options.value.trim() }); m.close(); } catch (err) { toast(err.message, true); } };
  }
  matrix() { const vis = this.visible(); return [vis.map((c) => c.label), ...this.filtered().map((r) => vis.map((c) => { const v = this.val(r, c); return c.format ? c.format(v, r) : v; }))]; }
  exportCSV() { download(`${this.o.id}-${new Date().toISOString().slice(0, 10)}.csv`, new Blob(['﻿' + this.matrix().map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' })); }
  async exportXLSX() {
    try {
      if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('The Excel library could not be loaded. Check your connection, or export CSV instead.')); document.head.appendChild(s); });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(this.matrix()), (this.o.title || 'Sheet').slice(0, 31));
      download(`${this.o.id}-${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    } catch (e) { toast(e.message, true); }
  }
  async importCSV(input) {
    const file = input.files[0]; input.value = ''; if (!file) return;
    const data = parseCSV(await file.text()); if (data.length < 2) return toast('That file has no data rows.', true);
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = data[0].map((h) => this.cols.find((c) => norm(c.label) === norm(h) || norm(c.key) === norm(h)));
    if (!map.some(Boolean)) return toast('None of the column headings in that file match this table.', true);
    const rows = data.slice(1).map((r) => { const o = { custom: {} }; r.forEach((v, i) => { const c = map[i]; if (!c || (!c.editable && !c.importKey)) return; v = v.trim(); if (c.custom) o.custom[c.key] = v; else o[c.key] = c.type === 'number' && v !== '' ? Number(v) : v; }); return o; });
    try { await this.o.onImport(rows, data[0].filter((h, i) => !map[i])); } catch (e) { toast(e.message, true); }
  }
}
