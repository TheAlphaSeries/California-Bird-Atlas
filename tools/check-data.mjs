// Checks that the site's data files agree with each other. Run: npm run check
// It catches the mistakes that would otherwise show up as blank pages or missing birds.
import fs from 'fs';
const read = (p) => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url)));
const wi = read('public/data/wildindex.json'), seed = read('src/seed.json'), samples = read('public/data/wall-samples.json');
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

const CATS = ['assign', 'scarce', 'rare', 'night', 'offshore', 'sensitive', 'introduced'];
const R = wi.regions.length;
check(R === 7 && wi.regions.every((r) => wi.region_names[r]), 'regions and region_names must list the same 7 regions');
const ids = new Set(), names = new Set();
for (const b of wi.birds) {
  check(/^WI-\d{3}$/.test(b.id) && !ids.has(b.id), `bad or repeated id: ${b.id}`); ids.add(b.id);
  check(b.n && !names.has(b.n), `missing or repeated name: ${b.n}`); names.add(b.n);
  check(CATS.includes(b.cat), `${b.n}: unknown category ${b.cat}`);
  if (b.lv) for (const s of 'WPSF') check(new RegExp(`^[123-]{${R}}$`).test(b.lv[s] || ''), `${b.n}: level string for ${s} must be ${R} characters of 1, 2, 3 or -`);
  if (b.cat === 'assign') check(!!b.lv, `${b.n}: assignable birds need levels`);
  if (b.rr) check(new RegExp(`^[yr-]{${R}}$`).test(b.rr), `${b.n}: rr must be ${R} characters of y, r or -`);
}
// The field guide and the database seed are joined by common name, so the two lists must match exactly.
const seedNames = new Set(seed.species.map((s) => s.cn));
for (const n of names) check(seedNames.has(n), `in wildindex.json but not in seed.json: ${n}`);
for (const n of seedNames) check(names.has(n), `in seed.json but not in wildindex.json: ${n}`);
// Every level in every region and season needs at least 3 birds, or an assignment cannot be filled.
for (const s of 'WPSF') wi.regions.forEach((r, i) => { for (const L of '123') {
  const n = wi.birds.filter((b) => b.cat === 'assign' && b.lv && b.lv[s][i] === L).length;
  check(n >= 3, `${r} ${s} level ${L}: only ${n} assignable birds`);
} });
for (const x of samples) {
  check(names.has(x.bird), `sample wall bird not on the list: ${x.bird}`);
  check(wi.regions.includes(x.region), `${x.bird}: unknown region ${x.region}`);
  check(x.credit && x.license && x.source_url, `${x.bird}: sample needs credit, license and source_url`);
  check(fs.existsSync(new URL('../public' + x.src, import.meta.url)), `${x.bird}: missing file ${x.src}`);
}
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`Data OK: ${wi.birds.length} birds, ${seed.species.length} in the seed, ${samples.length} sample wall birds.`);
