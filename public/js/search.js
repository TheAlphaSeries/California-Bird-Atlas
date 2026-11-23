// Site search: one box that finds any bird (by English or scientific name) or any photographer on the wall.
import { api, esc, go } from './util.js';
import { wi, birdLink } from './wi.js';

export async function openSearch() {
  const el = document.createElement('div'); el.className = 'modal mag-modal search-modal';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Search"><button class="x" type="button">Close</button>
    <label class="f"><span>Search birds and photographers</span><input id="sq" type="search" autocomplete="off" placeholder="Try heron, Calypte, or a photographer's name"></label>
    <div id="sr" class="sr" aria-live="polite"></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  el.querySelector('.x').onclick = close;
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  const input = el.querySelector('#sq'), out = el.querySelector('#sr');
  input.focus();
  const [d, wall] = await Promise.all([wi(), api('/wall').catch(() => [])]);
  const people = [...new Set(wall.filter((r) => !r.sample).map((r) => r.credit_name))];
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { out.innerHTML = '<p class="sr-hint">Type at least two letters.</p>'; return; }
    // Names that start with the search come first, then names that contain it.
    const birds = d.birds.filter((b) => b.n.toLowerCase().includes(q) || b.sci.toLowerCase().includes(q))
      .sort((a, b) => (b.n.toLowerCase().startsWith(q) - a.n.toLowerCase().startsWith(q)) || a.n.localeCompare(b.n)).slice(0, 10);
    const who = people.filter((p) => p.toLowerCase().includes(q)).slice(0, 5);
    out.innerHTML = (birds.length ? `<p class="sr-h">Birds</p>${birds.map((b) => `<a href="${birdLink(b)}"><span class="no">${+b.id.slice(3)}</span><b>${esc(b.n)}</b><i>${esc(b.sci)}</i></a>`).join('')}` : '')
      + (who.length ? `<p class="sr-h">Photographers</p>${who.map((p) => `<a href="/wall?by=${encodeURIComponent(p)}"><span class="no"></span><b>${esc(p)}</b><i>See their birds on the wall</i></a>`).join('')}` : '')
      || '<p class="sr-hint">Nothing found. Check the spelling, or try part of the name.</p>';
    out.querySelectorAll('a').forEach((a) => (a.onclick = (e) => { e.preventDefault(); close(); go(a.getAttribute('href')); }));
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') out.querySelector('a')?.click(); });
  draw();
}
