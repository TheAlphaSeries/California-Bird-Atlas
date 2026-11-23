import { api, esc } from '../util.js';
import { wi, REGION_NAMES } from '../wi.js';
import { loadIssues, currentIssue, issueState, stateLine, subscribeForm, bindSubscribe } from '../issues.js';
import { openBird } from './wall.js';

// An issue's page: its theme, the submission window, award winners, and every published photo sent for it
// with its Behind the Shot story. /issues shows the current issue; /issues/<number> shows one by number.
export default async function issue(view, number) {
  const [issues, wall, d] = await Promise.all([loadIssues(), api('/wall'), wi()]);
  const it = number ? issues.find((i) => i.number === +number) : currentIssue(issues);
  if (!it) { view.innerHTML = '<div class="mag-wrap mag-page"><h1 class="mag-h">No such issue</h1><p class="mag-deck"><a class="linkish" href="/issues" data-link>See the current issue</a></p></div>'; return; }
  const st = issueState(it), line = stateLine(it);
  const rows = wall.filter((r) => r.issue_id === it.id);
  const winners = rows.filter((r) => r.award);
  const story = (r) => `<article class="is-story">
      <button type="button" class="is-art" data-id="${r.id}" aria-label="${esc(r.bird)}: see credits"><img loading="lazy" src="/media/sub/${r.id}/cutout" alt=""></button>
      <div>${r.award ? `<p class="is-award">${esc(r.award)}</p>` : ''}
        <h3>${esc(r.bird)}</h3>
        ${r.caption ? `<p class="is-cap">${esc(r.caption)}</p>` : ''}
        <p class="is-by">Photo ● ${esc(r.credit_name)}${r.region ? `, ${esc(REGION_NAMES[r.region] || r.region)}` : ''}</p></div>
    </article>`;
  view.innerHTML = `<div class="mag-wrap mag-page is">
    <header class="is-head">
      <div>
        <p class="mag-kicker">Issue No. ${it.number}, ${esc(it.title)}</p>
        <h1 class="mag-h">${esc(it.theme || it.title)}</h1>
        ${it.blurb ? `<p class="is-blurb">${esc(it.blurb)}</p>` : ''}
      </div>
      <div class="is-status ${st.state}">
        ${line.n != null ? `<p class="n"><b>${line.n}</b><span>${line.text}</span></p>` : '<p class="n"><span>This issue is closed</span></p>'}
        <p>${esc(line.long)}</p>
        ${st.state !== 'closed' ? '<a class="mag-btn" href="/submit" data-link>Send a photo for this issue</a>' : ''}
      </div>
    </header>
    ${winners.length ? `<section class="mag-section"><p class="mag-kicker">Awards</p><h2>This issue's winners</h2><div class="is-stories">${winners.map(story).join('')}</div></section>` : ''}
    ${winners.length && winners.length === rows.length ? '' : `<section class="mag-section"><p class="mag-kicker">Behind the shot</p>
      <h2>${rows.length ? `${rows.length} photograph${rows.length === 1 ? '' : 's'} so far` : 'No photographs yet'}</h2>
      ${rows.length ? `<div class="is-stories">${rows.filter((r) => !r.award).map(story).join('')}</div>`
        : `<p class="mag-deck">${st.state === 'closed' ? 'Nothing was published for this issue.' : 'Be the first. Send a photo and tell us how you got it, and it runs here with your name.'}</p>`}
    </section>`}
    <section class="mag-section">${subscribeForm()}</section>
    ${issues.length > 1 ? `<section class="mag-section"><p class="mag-kicker">All issues</p><ul class="is-list">${issues.map((i) => `<li><a href="/issues/${i.number}" data-link><b>No. ${i.number}</b><span>${esc(i.theme || i.title)}</span><i>${esc(i.title)}</i></a></li>`).join('')}</ul></section>` : ''}
  </div>`;
  bindSubscribe(view);
  view.querySelectorAll('.is-art').forEach((b) => (b.onclick = () => openBird(rows.find((r) => r.id === +b.dataset.id), d)));
}
