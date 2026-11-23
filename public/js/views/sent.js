import { api, esc, fmtDate } from '../util.js';
import { sentLinks } from './submit.js';

// A sender's own photos and where they stand. Reads /sent?s=<id>.<key>,... or, with no query, the links this browser saved.
const STATE = { pending: ['Waiting for review', 'We look at every photo, usually within a week.'], approved: ['On the Bird Wall', ''], rejected: ['Not published', 'It may not have met the photo rules, or we couldn\'t confirm the bird.'] };
export default async function sent(view) {
  const q = new URLSearchParams(location.search).get('s');
  const pairs = q ? q.split(',') : sentLinks().map((x) => x.s);
  const rows = pairs.length ? await api('/status?s=' + encodeURIComponent(pairs.join(','))) : [];
  view.innerHTML = `<div class="mag-wrap mag-page" style="max-width:900px">
    <p class="mag-kicker">Your photos</p><h1 class="mag-h">What happened to my photos?</h1>
    ${rows.length ? `<ol class="st-list">${rows.slice().reverse().map((r) => { const [h, p] = STATE[r.status] || [r.status, ''];
      return `<li class="${esc(r.status)}"><span class="st-art">${r.status === 'approved' && r.cut_w ? `<img src="/media/sub/${r.id}/cutout" alt="">` : ''}</span>
        <span><b>${esc(r.bird)}</b><small>Sent ${esc(fmtDate(r.created_at))}</small></span>
        <span class="st-state"><b>${esc(h)}</b>${r.award ? `<small>Award: ${esc(r.award)}</small>` : p ? `<small>${esc(p)}</small>` : ''}${r.status === 'approved' ? '<a class="linkish" href="/wall" data-link>See the wall</a>' : ''}</span></li>`; }).join('')}</ol>`
      : `<p class="mag-deck">${pairs.length ? 'That link doesn\'t match any photos. Check that it was copied in full.' : 'No photos have been sent from this browser. Open the status link you were given after sending, or send a photo.'}</p>
        <p><a class="mag-btn solid" href="/submit" data-link>Send a photo</a></p>`}
  </div>`;
}
