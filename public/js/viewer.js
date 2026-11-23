// Two small helpers shared by the wall, the cover and bird pages.
//
// openFull(src, alt): shows one photo on black, filling the screen without stretching or cropping it
//   (object-fit: contain). Uses the browser's real full screen where it can; Esc, the Close button or a
//   tap closes it. Focus goes back to where it was.
// onSwipe(el, { left, right }): calls left() or right() after a clear sideways swipe on a touch screen.
//   Ignores swipes that start inside something that scrolls sideways, and mostly-vertical drags.
import { esc } from './util.js';

export function openFull(src, alt = '') {
  const back = document.activeElement;
  const el = document.createElement('div');
  el.className = 'fullview';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', alt ? `${alt}, full screen` : 'Photo, full screen');
  el.innerHTML = `<img src="${esc(src)}" alt="${esc(alt)}"><button type="button" class="fv-x">Close</button>`;
  document.body.appendChild(el);
  const close = () => {
    document.removeEventListener('keydown', key, true);
    if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
    el.remove(); back?.focus?.();
  };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.tagName === 'IMG' || e.target.classList.contains('fv-x')) close(); });
  el.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && el.isConnected) close(); });
  el.requestFullscreen?.().catch(() => { /* the fixed black layer still covers the window */ });
  el.querySelector('.fv-x').focus();
}

export function onSwipe(el, { left, right }) {
  let x0 = null, y0 = 0, t0 = 0;
  const scrollsSideways = (n) => {
    for (; n && n !== el; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
    return false;
  };
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || scrollsSideways(e.target)) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - t0 > 800) return;
    (dx < 0 ? left : right)?.();
  }, { passive: true });
}
