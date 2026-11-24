// Builds the two-week email, "Your nine new birds", for one region from the current assignment.
// Nothing is sent from here: the editor copies it from Review into their own email app, with the
// region's subscribers in BCC. (Automatic sending needs a mail service and a domain; see ARCHITECTURE.md.)
import { SEASONS, currentSeason, REGION_NAMES } from './wi.js';
import { seasonCards, latestOccurrence, windowSpan } from './rotation.js';

const LEVELS = ['Easy to find', 'Takes a trip', 'Hard to find'];
const fmt = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

export function nineBirdsEmail(d, region, issue, origin = location.origin) {
  const season = currentSeason(), occ = latestOccurrence(season);
  const card = seasonCards(d, region, season, occ.year)[occ.window], span = windowSpan(season, occ.year, occ.window);
  const until = fmt(span.end - 864e5), name = REGION_NAMES[region];
  const groups = [1, 2, 3].map((L) => ({ L, label: LEVELS[L - 1], pts: d.scoring.base.assign[L - 1], birds: card[L].map((id) => d.byId.get(id)) }));
  const subject = `Your nine new birds: ${name}, until ${until}`;
  const issueLine = issue ? `Issue No. ${issue.number}, "${issue.theme}", is taking photos until ${fmt(Date.parse(issue.closes_at) - 1)}.` : '';
  const text = [
    `Your nine birds for the ${name}, ${fmt(span.start)} to ${until} (${SEASONS[season].toLowerCase()} assignment ${occ.window + 1} of 6).`, '',
    ...groups.flatMap((g) => [`${g.label.toUpperCase()} (${g.pts} points each)`, ...g.birds.map((b) => `  ${b.n}  ${origin}/birds/${b.id}`), '']),
    'Print these nine on one page to take with you:', `${origin}/field-card?r=${region}`, '',
    'Find one, photograph it, send it in:', `${origin}/submit`, '', issueLine, '',
    `You are getting this because you signed up at ${origin}. To stop, go to ${origin}/unsubscribe or reply to this email.`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#151515">
  <div style="background:#ffcc00;padding:10px 16px;font-weight:bold">Your nine new birds</div>
  <h1 style="font-size:30px;line-height:1.05;margin:20px 0 6px">${name}</h1>
  <p style="margin:0 0 20px;color:#4d4d48">${fmt(span.start)} to ${until}. ${SEASONS[season]} assignment ${occ.window + 1} of 6.</p>
  ${groups.map((g) => `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 18px"><tr><td style="background:#151515;color:#fff;padding:8px 12px;font-weight:bold"><span style="background:#ffcc00;color:#151515;padding:2px 8px;margin-right:8px">${g.L}</span>${g.label} <span style="font-weight:normal;color:#cfcfc8">${g.pts} points each</span></td></tr>
    ${g.birds.map((b) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #dadad3"><a href="${origin}/birds/${b.id}" style="color:#151515;font-size:18px;font-weight:bold;text-decoration:none">${b.n}</a><br><i style="color:#8a8a84;font-size:13px">${b.sci}</i></td></tr>`).join('')}</table>`).join('')}
  <p style="margin:24px 0"><a href="${origin}/submit" style="background:#ffcc00;color:#151515;padding:12px 18px;font-weight:bold;text-decoration:none;border:2px solid #151515">Send a photo</a>
    &nbsp; <a href="${origin}/field-card?r=${region}" style="color:#151515;padding:12px 18px;font-weight:bold;text-decoration:none;border:2px solid #151515">Print the field card</a></p>
  ${issueLine ? `<p style="color:#4d4d48">${issueLine}</p>` : ''}
  <p style="font-size:12px;color:#8a8a84;border-top:1px solid #dadad3;padding-top:12px">You are getting this because you signed up at ${origin}. To stop, <a href="${origin}/unsubscribe" style="color:#8a8a84">unsubscribe here</a> or reply to this email.</p>
</div>`;
  return { subject, text, html };
}
