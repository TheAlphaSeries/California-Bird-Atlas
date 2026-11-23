// Issues: one per season, each with a theme and a window when photos can be sent for it.
// An issue (from GET /api/issues): { id, number, title, theme, blurb, opens_at, closes_at }  (dates are UTC ISO strings)
import { api, esc, toast } from './util.js';
import { REGIONS, REGION_NAMES, myRegion } from './wi.js';

const DAY = 864e5;
export const loadIssues = () => api('/issues');
export const fmtDay = (iso) => new Date(new Date(iso).getTime() - 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

// Where an issue stands today: 'soon' (not open yet), 'open', or 'closed', with the days left until the next change.
export function issueState(issue, now = Date.now()) {
  const o = Date.parse(issue.opens_at), c = Date.parse(issue.closes_at);
  if (now < o) return { state: 'soon', days: Math.ceil((o - now) / DAY) };
  if (now < c) return { state: 'open', days: Math.ceil((c - now) / DAY) };
  return { state: 'closed', days: 0 };
}
// The issue to feature: the open one, else the next to open, else the latest.
export function currentIssue(issues, now = Date.now()) {
  const open = issues.find((i) => issueState(i, now).state === 'open');
  if (open) return open;
  const soon = issues.filter((i) => issueState(i, now).state === 'soon').sort((a, b) => a.opens_at.localeCompare(b.opens_at))[0];
  return soon || issues[0] || null;
}
export function stateLine(issue) {
  const s = issueState(issue), d = `${s.days} day${s.days === 1 ? '' : 's'}`;
  if (s.state === 'open') return { n: s.days, text: `day${s.days === 1 ? '' : 's'} left to send a photo`, long: `Open now. Closes ${fmtDay(issue.closes_at)}, in ${d}.` };
  if (s.state === 'soon') return { n: s.days, text: `day${s.days === 1 ? '' : 's'} until it opens`, long: `Opens ${new Date(issue.opens_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })}, in ${d}. Photos sent now are held for it.` };
  return { n: null, text: 'Closed', long: `Closed ${fmtDay(issue.closes_at)}.` };
}

// The sign-up form for the two-week email. Returns HTML; call bindSubscribe(root) after inserting it.
export const subscribeForm = () => `<form class="sub-box" novalidate>
    <div><h2>Your nine birds, by email</h2><p>One short email every two weeks with the nine new birds for your region. Nothing else, and you can leave any time.</p></div>
    <div class="sub-row">
      <label><span class="vh">Email</span><input type="email" name="email" required placeholder="you@example.com" autocomplete="email"></label>
      <label><span class="vh">Region</span><select name="region">${REGIONS.map((r) => `<option value="${r}" ${r === myRegion({ regions: REGIONS }) ? 'selected' : ''}>${esc(REGION_NAMES[r])}</option>`).join('')}</select></label>
      <button class="mag-btn solid" type="submit">Sign me up</button>
    </div>
    <p class="sub-fine">We keep your email and the region you picked, and use them only for this email. <a href="/unsubscribe" data-link>Unsubscribe</a>.</p>
  </form>`;
export function bindSubscribe(root) {
  root.querySelectorAll('.sub-box').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    try { await api('/subscribe', { method: 'POST', body: v }); f.querySelector('.sub-row').innerHTML = '<p class="sub-done">You\'re on the list. The next email goes out when the birds change.</p>'; }
    catch (err) { toast(err.message, true); }
  }));
}
