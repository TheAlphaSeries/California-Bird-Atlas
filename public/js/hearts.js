// Readers' hearts on Bird Wall photos, and the Readers' Choice award they decide.
//
// No accounts: each browser makes up a random id once (kept in localStorage) and sends it with a heart; the
// server keeps one heart per photo per id (POST /api/hearts/<id> toggles it). The photos this browser has
// hearted are remembered locally so the button shows filled.
import { api, toast } from './util.js';

const DEV = 'wi.device', MINE = 'wi.hearts';
// A photo needs at least this many hearts to win Readers' Choice, so one early vote doesn't decide an issue.
export const MIN_HEARTS = 3;

function deviceId() {
  try {
    let id = localStorage.getItem(DEV);
    if (!id) { id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem(DEV, id); }
    return id;
  } catch { return null; }
}
const mine = () => { try { return new Set(JSON.parse(localStorage.getItem(MINE) || '[]')); } catch { return new Set(); } };
const saveMine = (s) => { try { localStorage.setItem(MINE, JSON.stringify([...s].slice(-2000))); } catch { /* storage off */ } };

// The button. `r` is a wall row (static sample birds can't be hearted).
export function heartButton(r, cls = '') {
  if (r.static) return '';
  const on = mine().has(r.id), n = r.hearts || 0;
  return `<button type="button" class="heart ${cls}" data-heart="${r.id}" aria-pressed="${on}"><span class="vh">Heart this photo. Hearts so far: </span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.5h2c.7-1.3 2.2-2.5 4.3-2.5 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg>
    <span class="hn">${n}</span></button>`;
}

// Wire every heart button inside `root`. `rows` lets the count stay right if the same photo is redrawn.
export function bindHearts(root, rows = []) {
  root.querySelectorAll('[data-heart]').forEach((b) => {
    if (b.dataset.bound) return; b.dataset.bound = '1';
    b.onclick = async (e) => {
      e.stopPropagation();
      const id = +b.dataset.heart, dev = deviceId();
      if (!dev) return toast('Hearts need this browser to allow site storage.', true);
      b.disabled = true;
      try {
        const res = await api(`/hearts/${id}`, { method: 'POST', body: { device: dev } });
        const s = mine(); res.on ? s.add(id) : s.delete(id); saveMine(s);
        const row = rows.find((x) => x.id === id); if (row) row.hearts = res.hearts;
        document.querySelectorAll(`[data-heart="${id}"]`).forEach((x) => {
          x.setAttribute('aria-pressed', res.on); x.querySelector('.hn').textContent = res.hearts;
          if (res.on) { x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); }
        });
      } catch (err) { toast(err.message, true); }
      b.disabled = false;
    };
  });
}

// Readers' Choice for an issue: the photo with the most hearts (at least MIN_HEARTS); ties go to the earlier photo.
export function readersChoice(rows) {
  const top = rows.filter((r) => (r.hearts || 0) >= MIN_HEARTS)
    .sort((a, b) => b.hearts - a.hearts || String(a.approved_at).localeCompare(String(b.approved_at)))[0];
  return top || null;
}
