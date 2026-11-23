import { S, $, api, esc, toast } from '../util.js';
import { wi, REGIONS, REGION_NAMES, myRegion } from '../wi.js';
import { readExif, derivatives } from '../exif.js';
import { openClipper, autoCut, warmClipper } from '../clip.js';
import { birdOptions } from './submit.js';

// Editor only: add your own photos straight to the Bird Wall. Drop any number of photos; each is cut out
// automatically, you name the bird, touch up the cut-out if needed, and publish. No review queue.
const CREDIT_KEY = 'wi.credit';

export default async function addBirds(view) {
  document.body.classList.add('mag');
  if (!S.owner) {
    view.innerHTML = `<div class="mag-wrap mag-page"><p class="mag-kicker">Bird Wall</p><h1 class="mag-h">Add birds</h1>
      <p class="mag-deck">This is where the editor adds photos straight to the wall. <a href="/settings" data-link style="color:var(--mag-accent)">Sign in</a> first. If you'd like to share a photo, <a href="/submit" data-link style="color:var(--mag-accent)">send it here</a>.</p></div>`;
    return;
  }
  const d = await wi();
  warmClipper();
  const rows = [];
  let queue = Promise.resolve();
  const credit = localStorage.getItem(CREDIT_KEY) || '';
  view.innerHTML = `<div class="mag-wrap mag-page add-page">
    <p class="mag-kicker">Bird Wall · Editor</p>
    <h1 class="mag-h">Add birds to the wall</h1>
    <p class="mag-deck">Drop in as many photos as you like. Each bird is cut out automatically. Name each bird, touch up any cut-out that needs it, then publish. They go on the wall straight away.</p>
    <div class="add-defaults">
      <label class="f"><span>Credit</span><input id="ad-credit" value="${esc(credit)}" placeholder="Your name" maxlength="80"></label>
      <label class="f"><span>Region for new photos</span><select id="ad-region">${REGIONS.map((r) => `<option value="${r}" ${r === myRegion({ regions: REGIONS }) ? 'selected' : ''}>${REGION_NAMES[r]}</option>`).join('')}</select></label>
    </div>
    <label class="drop add-drop" id="ad-drop"><input type="file" id="ad-file" accept="image/jpeg,image/png,image/webp" multiple>
      <span class="drop-in"><b>Choose photos</b><span>or drop them here. JPEG, PNG or WebP, as many as you like.</span></span></label>
    ${birdOptions(d)}
    <div class="add-list" id="ad-list"></div>
    <div class="add-bar" id="ad-bar" hidden><span id="ad-count"></span><button type="button" class="mag-btn solid" id="ad-pub">Publish to the wall</button></div>
  </div>`;
  const list = $('#ad-list', view);
  $('#ad-credit', view).addEventListener('change', (e) => localStorage.setItem(CREDIT_KEY, e.target.value.trim()));

  // Match a bird name in the file name, e.g. "annas-hummingbird-03.jpg".
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const names = d.birds.filter((b) => b.cat !== 'introduced').map((b) => [norm(b.n), b.n]).sort((a, b) => b[0].length - a[0].length);
  const guess = (fname) => { const f = norm(fname); return names.find(([k]) => k.length > 5 && f.includes(k))?.[1] || ''; };
  const birdOf = (name) => d.byName.get(String(name || '').trim()) || [...d.byName.values()].find((b) => b.n.toLowerCase() === String(name || '').trim().toLowerCase());

  const ready = (r) => r.status === 'ready' && birdOf(r.bird);
  const bar = () => {
    const live = rows.filter((r) => r.status !== 'removed' && r.status !== 'published');
    const ok = live.filter(ready).length;
    $('#ad-bar', view).hidden = !live.length;
    $('#ad-count', view).textContent = live.length ? `${ok} of ${live.length} ready${ok < live.length ? ' (each needs a bird name and a finished cut-out)' : ''}` : '';
    $('#ad-pub', view).disabled = !ok;
    $('#ad-pub', view).textContent = ok ? `Publish ${ok} to the wall` : 'Publish to the wall';
  };
  const paint = (r) => {
    const el = r.el;
    el.querySelector('.ad-cut').innerHTML = r.cut ? `<img src="${r.cutUrl}" alt="Cut-out">` : `<span>${r.status === 'error' ? 'Cut-out failed' : r.status === 'cutting' ? 'Cutting out…' : 'Waiting…'}</span>`;
    el.querySelector('.ad-status').textContent = r.status === 'published' ? 'On the wall' : r.status === 'publishing' ? 'Publishing…' : r.status === 'error' ? r.error : !birdOf(r.bird) ? 'Name the bird' : r.status === 'ready' ? 'Ready' : '';
    el.classList.toggle('done', r.status === 'published');
    el.querySelectorAll('input, select, button').forEach((x) => (x.disabled = r.status === 'published' || r.status === 'publishing'));
    bar();
  };
  const setCut = (r, cut) => { if (r.cutUrl) URL.revokeObjectURL(r.cutUrl); r.cut = cut; r.cutUrl = URL.createObjectURL(cut.blob); r.status = 'ready'; paint(r); };

  const add = (file) => {
    if (!/^image\/(jpeg|png|webp)/.test(file.type)) { toast(`"${file.name}" isn't a JPEG, PNG or WebP photo.`, true); return; }
    const r = { file, url: URL.createObjectURL(file), bird: guess(file.name), region: $('#ad-region', view).value, featured: false, status: 'waiting', cut: null };
    r.el = document.createElement('div'); r.el.className = 'add-row';
    r.el.innerHTML = `<div class="ad-imgs"><img class="ad-orig" src="${r.url}" alt="Photo"><div class="ad-cut"></div></div>
      <div class="ad-fields">
        <label class="f"><span>Bird</span><input class="ad-bird" list="bird-names" value="${esc(r.bird)}" placeholder="Start typing the bird's name" autocomplete="off"></label>
        <label class="f"><span>Region</span><select class="ad-reg">${REGIONS.map((x) => `<option value="${x}" ${x === r.region ? 'selected' : ''}>${REGION_NAMES[x]}</option>`).join('')}</select></label>
        <label class="ad-feat"><input type="checkbox" class="ad-featured"> Featured (larger, at the top)</label>
        <div class="ad-actions"><button type="button" class="mag-btn ad-touch">Touch up cut-out</button><button type="button" class="mag-btn ad-del">Remove</button><span class="ad-status" role="status"></span></div>
      </div>`;
    list.appendChild(r.el); rows.push(r);
    r.el.querySelector('.ad-bird').addEventListener('input', (e) => { r.bird = e.target.value; paint(r); });
    r.el.querySelector('.ad-reg').onchange = (e) => (r.region = e.target.value);
    r.el.querySelector('.ad-featured').onchange = (e) => (r.featured = e.target.checked);
    r.el.querySelector('.ad-del').onclick = () => { r.status = 'removed'; r.el.remove(); bar(); };
    r.el.querySelector('.ad-touch').onclick = async () => {
      const cut = await openClipper(r.file, { title: `Cut out the ${birdOf(r.bird)?.n || 'bird'}` });
      if (cut) setCut(r, cut);
    };
    paint(r);
    queue = queue.then(async () => {
      if (r.status === 'removed' || r.cut) return;
      r.status = 'cutting'; paint(r);
      try { setCut(r, await autoCut(r.file)); }
      catch (err) { r.status = 'error'; r.error = 'Automatic cut-out failed. Use Touch up.'; paint(r); console.error(err); }
    });
  };
  const take = (files) => [...files].forEach(add);
  $('#ad-file', view).onchange = (e) => { take(e.target.files); e.target.value = ''; };
  const drop = $('#ad-drop', view);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files); });

  $('#ad-pub', view).onclick = async () => {
    const name = $('#ad-credit', view).value.trim();
    if (!name) { toast('Enter the name to credit at the top.', true); $('#ad-credit', view).focus(); return; }
    localStorage.setItem(CREDIT_KEY, name);
    let ok = 0;
    for (const r of rows.filter(ready)) {
      r.status = 'publishing'; paint(r);
      try {
        const b = birdOf(r.bird);
        const [ex, dv] = [await readExif(r.file), await derivatives(r.file)];
        const fd = new FormData();
        fd.set('meta', JSON.stringify({ bird: b.n, credit_name: name, region: r.region, featured: r.featured, taken_at: ex.taken_at || null, camera: ex.camera || '', width: dv.width, height: dv.height, cut_w: r.cut.width, cut_h: r.cut.height }));
        fd.set('display', dv.display, 'display.jpg'); fd.set('thumb', dv.thumb, 'thumb.jpg'); fd.set('cutout', r.cut.blob, 'cutout.png');
        await api('/wall', { method: 'POST', form: fd });
        r.status = 'published'; ok++;
      } catch (err) { r.status = 'error'; r.error = err.message; }
      paint(r);
    }
    if (ok) toast(`${ok} bird${ok === 1 ? '' : 's'} added to the wall.`);
    if (ok && rows.every((r) => ['published', 'removed'].includes(r.status))) {
      $('#ad-bar', view).hidden = false;
      $('#ad-count', view).innerHTML = `All done. <a href="/wall" data-link style="color:var(--mag-accent)">See the Bird Wall</a>`;
      $('#ad-pub', view).disabled = true;
    }
  };
}
