import { $, api, esc, toast } from '../util.js';
import { readExif, derivatives } from '../exif.js';
import { wi, REGIONS, REGION_NAMES, myRegion } from '../wi.js';
import { addToMyWall } from './mywall.js';
import { loadIssues, currentIssue, stateLine } from '../issues.js';

// Behind the Shot: specific, easy questions get better stories than one empty box. Each answer becomes a
// sentence or two of the caption (the worker joins them in this order; the editor can tidy it in Review).
const STORY = [
  ['day', 'Set the scene. What kind of place was it, and what was the day like?', 'A foggy morning at a salt marsh, just after sunrise. Cold enough that my hands hurt.'],
  ['doing', 'What was the bird doing when you took this?', 'It had just caught a small fish and was shaking it before swallowing.'],
  ['how', 'How did you get the shot? Luck, patience, a plan?', 'I sat still by the same channel for forty minutes until it walked into the light.'],
  ['surprise', 'What surprised you, or what nearly went wrong?', 'A jogger almost flushed it. It froze, then went straight back to hunting.'],
];

export const birdOptions = (d) => `<datalist id="bird-names">${d.birds.filter((b) => b.cat !== 'introduced').map((b) => `<option value="${esc(b.n)}"></option>`).join('')}</datalist>`;

export default async function submit(view) {
  const d = await wi();
  const issue = currentIssue(await loadIssues().catch(() => []));
  const pre = (() => { try { return JSON.parse(sessionStorage.getItem('wi.submit') || 'null'); } catch { return null; } })();
  sessionStorage.removeItem('wi.submit');
  let file = null;
  view.innerHTML = `<div class="mag-wrap mag-page sub-page">
    <p class="mag-kicker">Send a photo</p>
    <h1 class="mag-h">Put your bird on the wall</h1>
    <p class="mag-deck">Send one of your California bird photos. We review every one, cut the bird out of its background and add it to the Bird Wall with your name. The best ones run in the magazine.</p>
    ${issue ? `<p class="sub-issue"><b>Issue No. ${issue.number}: ${esc(issue.theme || issue.title)}.</b> ${esc(stateLine(issue).long)} <a class="linkish" href="/issues/${issue.number}" data-link>About this issue</a></p>` : ''}
    <form class="sub-form" id="sf" novalidate>
      <div class="sub-photo">
        <label class="drop" id="drop"><input type="file" id="file" accept="image/jpeg,image/png,image/webp" required>
          <span class="drop-in"><b>Choose a photo</b><span>or drop it here. JPEG, PNG or WebP.</span></span>
          <img id="prev" alt="" hidden></label>
      </div>
      <div class="sub-fields">
        <label class="f"><span>Which bird is it?</span><input name="bird" list="bird-names" autocomplete="off" required placeholder="Start typing, e.g. Anna's Hummingbird" value="${esc(pre?.bird || '')}">${birdOptions(d)}</label>
        <label class="f"><span>Your name, as it should be credited</span><input name="credit_name" required maxlength="80" autocomplete="name"></label>
        <label class="f"><span>Email <i>(optional, never shown; only used if we need to ask about your photo)</i></span><input name="contact" type="email" maxlength="120" autocomplete="email"></label>
        <label class="f"><span>Region where you took it</span><select name="region">${REGIONS.map((r) => `<option value="${r}" ${r === myRegion({ regions: REGIONS }) ? 'selected' : ''}>${REGION_NAMES[r]}</option>`).join('')}</select></label>
        <fieldset class="f story"><legend>Behind the shot <i>(optional, but it's what gets a photo featured)</i></legend>
          <p class="story-hint">A sentence or two each is plenty. Please describe the kind of place, not the exact spot.</p>
          ${STORY.map(([k, q, eg]) => `<label><span>${esc(q)}</span><textarea name="story_${k}" rows="2" maxlength="700" placeholder="For example: ${esc(eg)}"></textarea></label>`).join('')}
        </fieldset>
        <label class="f"><span>Anything else we should know? <i>(optional, not published)</i></span><textarea name="note" rows="2" maxlength="600"></textarea></label>
        <fieldset class="f checks"><legend>Before you send</legend>
          <label><input type="checkbox" name="mine" required> I took this photo myself, of a wild bird in California.</label>
          <label><input type="checkbox" name="ethics" required> I didn't use bait or playback, flush the bird, or go near a nest.</label>
          <label><input type="checkbox" name="consent" required> California Bird Atlas may publish it, cut out or whole, on this site and in print, with my name as credit. I keep the copyright.</label>
          <label><input type="checkbox" name="keep" checked> Also keep a copy on My Wall on this device.</label>
        </fieldset>
        <p class="sub-privacy">We never publish where a photo was taken. Location data in your photo file is removed in your browser before it's sent.</p>
        <button class="mag-btn solid" type="submit" id="sb">Send photo</button>
      </div>
    </form>
  </div>`;
  const form = $('#sf', view), prev = $('#prev', view), drop = $('#drop', view);
  const take = (f) => {
    if (!f || !/^image\//.test(f.type)) { toast('Choose a JPEG, PNG or WebP photo.', true); return; }
    file = f; prev.src = URL.createObjectURL(f); prev.hidden = false; drop.classList.add('has');
  };
  $('#file', view).onchange = (e) => take(e.target.files[0]);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files[0]); });
  if (pre?.blobKey) {
    const { getMyBird } = await import('./mywall.js');
    const mine = await getMyBird(pre.blobKey);
    if (mine) take(new File([mine.photo], 'my-wall.jpg', { type: mine.photo.type || 'image/jpeg' }));
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    const bird = d.byName.get(String(v.bird || '').trim()) || [...d.byName.values()].find((b) => b.n.toLowerCase() === String(v.bird || '').trim().toLowerCase());
    if (!file) return toast('Choose a photo first.', true);
    if (!bird) return toast('Pick the bird from the list. Start typing its name.', true);
    if (!v.credit_name?.trim()) return toast('Enter the name to credit.', true);
    if (!v.mine || !v.ethics || !v.consent) return toast('Please tick the three boxes under "Before you send".', true);
    const btn = $('#sb', view); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const [ex, dv] = [await readExif(file), await derivatives(file)];
      const fd = new FormData();
      fd.set('meta', JSON.stringify({ bird: bird.n, credit_name: v.credit_name.trim(), contact: v.contact || '', region: v.region, note: v.note || '', story: Object.fromEntries(STORY.map(([k]) => [k, v['story_' + k] || ''])), consent: true, taken_at: ex.taken_at || null, camera: ex.camera || '', width: dv.width, height: dv.height }));
      fd.set('display', dv.display, 'display.jpg'); fd.set('thumb', dv.thumb, 'thumb.jpg');
      await api('/submissions', { method: 'POST', form: fd });
      if (v.keep && !pre?.blobKey) await addToMyWall({ bird: bird.n, sci: bird.sci, photo: dv.display, taken_at: ex.taken_at || null }).catch(() => {});
      view.querySelector('.sub-page').innerHTML = `<p class="mag-kicker">Sent</p><h1 class="mag-h">Thank you.</h1>
        <p class="mag-deck" style="font-size:19px;color:#e6e2da">Your ${esc(bird.n)} is in the review queue. Approved photos are cut out and added to the Bird Wall with your name, usually within a week.</p>
        <p class="wall-ctas"><a class="mag-btn solid" href="/submit" data-link>Send another</a><a class="mag-btn" href="/wall" data-link>See the Bird Wall</a>${v.keep ? '<a class="mag-btn" href="/my-wall" data-link>My Wall</a>' : ''}</p>`;
      window.scrollTo(0, 0);
    } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Send photo'; }
  };
}
