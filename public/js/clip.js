// Cut a bird out of its background, in the browser.
// Uses the U^2-Net small model (Apache 2.0) run by ONNX Runtime Web (MIT). Nothing is uploaded to do this.
import { esc } from './util.js';

const SIZE = 320, MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
// Defaults for the cut: a slightly high cut-off and a narrow soft edge leave less of the background as a halo.
const CUT = 0.56, SOFT = 0.14;
const WORK = 1600; // longest side of the working image
let sessionP = null;

async function session() {
  if (!sessionP) {
    sessionP = (async () => {
      const ort = await import('/vendor/ort/ort.wasm.min.mjs');
      ort.env.wasm.wasmPaths = '/vendor/ort/';
      ort.env.wasm.numThreads = 1;
      const s = await ort.InferenceSession.create('/models/u2netp.onnx', { executionProviders: ['wasm'] });
      return { ort, s };
    })().catch((e) => { sessionP = null; throw e; });
  }
  return sessionP;
}
export const warmClipper = () => session().catch(() => {});

export async function loadImage(src) {
  const blob = src instanceof Blob ? src : await (await fetch(src, { credentials: 'same-origin' })).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const s = Math.min(1, WORK / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

// Returns the model's 320x320 saliency map, scaled 0..1.
async function saliency(img) {
  const { ort, s } = await session();
  const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) for (let ch = 0; ch < 3; ch++) input[ch * SIZE * SIZE + i] = (px[i * 4 + ch] / 255 - MEAN[ch]) / STD[ch];
  const feeds = { [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) };
  const out = (await s.run(feeds))[s.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const m = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < m.length; i++) m[i] = (out[i] - lo) / (hi - lo || 1);
  return m;
}

// Build a full-size mask canvas (white = keep) from the saliency map.
function maskFrom(sal, w, h, threshold, soft) {
  const small = document.createElement('canvas'); small.width = SIZE; small.height = SIZE;
  const sctx = small.getContext('2d'); const id = sctx.createImageData(SIZE, SIZE);
  const lo = Math.max(0, threshold - soft / 2), hi = Math.min(1, threshold + soft / 2);
  for (let i = 0; i < sal.length; i++) {
    let a = hi === lo ? (sal[i] >= threshold ? 1 : 0) : (sal[i] - lo) / (hi - lo);
    a = Math.max(0, Math.min(1, a)); a = a * a * (3 - 2 * a);
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = Math.round(a * 255);
  }
  sctx.putImageData(id, 0, 0);
  const m = document.createElement('canvas'); m.width = w; m.height = h;
  const mctx = m.getContext('2d'); mctx.imageSmoothingQuality = 'high'; mctx.drawImage(small, 0, 0, w, h);
  return m;
}

function compose(img, mask) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, 0, 0);
  return c;
}

// Crop to the bird with a small margin, and return a PNG.
async function finish(cut, crop = true) {
  const { width: w, height: h } = cut;
  const a = cut.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('Nothing is left of the photo. Lower the cut-off or restore the bird with the brush.');
  if (!crop) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const pad = crop ? Math.round(Math.max(x1 - x0, y1 - y0) * 0.03) : 0;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(cut, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Could not save the cut-out.'))), 'image/png'));
  return { blob, width: out.width, height: out.height };
}

// Opens the cut-out editor. Resolves with { blob, width, height } or null if cancelled.
export function openClipper(src, { title = 'Cut out the bird' } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'clipper'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
    el.innerHTML = `<div class="clip-stage"><canvas aria-label="Cut-out preview"></canvas><p class="clip-status" role="status">Loading the photo…</p></div>
      <div class="clip-side">
        <p class="mag-kicker">Bird Wall</p><h2>${esc(title)}</h2>
        <p class="clip-help">The background is removed automatically. If it took too much or too little, adjust the cut-off, then paint with the brush to erase leftovers or bring back missing feathers.</p>
        <label class="clip-field"><span>Cut-off <output id="ct-v"></output></span><input type="range" id="ct" min="0.05" max="0.95" step="0.01" value="${CUT}"></label>
        <label class="clip-field"><span>Edge softness <output id="cs-v"></output></span><input type="range" id="cs" min="0" max="0.6" step="0.01" value="${SOFT}"></label>
        <div class="clip-field"><span>Brush</span><div class="seg" role="group" aria-label="Brush">
          <button type="button" data-mode="off" aria-pressed="true">Off</button><button type="button" data-mode="erase" aria-pressed="false">Erase</button><button type="button" data-mode="restore" aria-pressed="false">Restore</button></div></div>
        <label class="clip-field"><span>Brush size <output id="bs-v"></output></span><input type="range" id="bs" min="4" max="160" step="2" value="40"></label>
        <label class="clip-check"><input type="checkbox" id="ghost" checked> Show the background faintly</label>
        <div class="clip-actions"><button type="button" class="mag-btn" id="c-reset">Start over</button><button type="button" class="mag-btn" id="c-cancel">Cancel</button><button type="button" class="mag-btn solid" id="c-done" disabled>Use this cut-out</button></div>
      </div>`;
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    const q = (s) => el.querySelector(s);
    const canvas = q('canvas'), ctx = canvas.getContext('2d'), status = q('.clip-status');
    let img = null, sal = null, mask = null, paint = null, mode = 'off', drawing = false;
    const close = (val) => { el.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', key); resolve(val); };
    const key = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', key);
    const outVal = () => { q('#ct-v').textContent = Math.round(q('#ct').value * 100); q('#cs-v').textContent = Math.round(q('#cs').value * 100); q('#bs-v').textContent = q('#bs').value; };
    // paint holds brush strokes: alpha 255 = force keep, a separate erase layer forces removal
    const rebuild = () => {
      mask = maskFrom(sal, img.width, img.height, +q('#ct').value, +q('#cs').value);
      const m = mask.getContext('2d');
      m.globalCompositeOperation = 'source-over'; m.drawImage(paint.keep, 0, 0);
      m.globalCompositeOperation = 'destination-out'; m.drawImage(paint.erase, 0, 0);
      m.globalCompositeOperation = 'source-over';
      draw();
    };
    const draw = () => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (q('#ghost').checked) { ctx.globalAlpha = 0.22; ctx.drawImage(img, 0, 0); ctx.globalAlpha = 1; }
      ctx.drawImage(compose(img, mask), 0, 0);
    };
    const layer = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; return c; };
    const at = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    const stroke = (e) => {
      const [x, y] = at(e), size = +q('#bs').value * canvas.width / canvas.getBoundingClientRect().width;
      const target = mode === 'erase' ? paint.erase : paint.keep, other = mode === 'erase' ? paint.keep : paint.erase;
      for (const [c, op] of [[target, 'source-over'], [other, 'destination-out']]) {
        const g = c.getContext('2d'); g.globalCompositeOperation = op; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, size / 2, 0, Math.PI * 2); g.fill();
      }
      rebuild();
    };
    canvas.addEventListener('pointerdown', (e) => { if (mode === 'off' || !img) return; drawing = true; canvas.setPointerCapture(e.pointerId); stroke(e); });
    canvas.addEventListener('pointermove', (e) => { if (drawing) stroke(e); });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; el.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b)); canvas.style.cursor = mode === 'off' ? 'default' : 'crosshair'; }));
    for (const id of ['#ct', '#cs']) q(id).addEventListener('input', () => { outVal(); if (sal) rebuild(); });
    q('#bs').addEventListener('input', outVal);
    q('#ghost').addEventListener('change', () => img && draw());
    q('#c-cancel').onclick = () => close(null);
    q('#c-reset').onclick = () => { if (!img) return; q('#ct').value = CUT; q('#cs').value = SOFT; paint = { keep: layer(), erase: layer() }; outVal(); rebuild(); };
    q('#c-done').onclick = async () => {
      q('#c-done').disabled = true; status.textContent = 'Saving…'; status.hidden = false;
      try { close(await finish(compose(img, mask))); }
      catch (err) { status.textContent = err.message; q('#c-done').disabled = false; }
    };
    outVal();
    (async () => {
      try {
        img = await loadImage(src);
        canvas.width = img.width; canvas.height = img.height; paint = { keep: layer(), erase: layer() };
        ctx.drawImage(img, 0, 0);
        status.textContent = 'Finding the bird…';
        sal = await saliency(img);
        rebuild(); status.hidden = true; q('#c-done').disabled = false;
      } catch (err) { console.error(err); status.textContent = 'The cut-out tool could not start: ' + err.message; }
    })();
  });
}

// Cut out without the editor, using the default settings. Resolves with { blob, width, height }.
export async function autoCut(src, { crop = true } = {}) {
  const img = await loadImage(src);
  const sal = await saliency(img);
  return finish(compose(img, maskFrom(sal, img.width, img.height, CUT, SOFT)), crop);
}
