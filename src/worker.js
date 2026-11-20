// California Bird Atlas — Cloudflare Worker (API + media). Static pages are served from ./public.
import seed from './seed.json';

const SCHEMA_VERSION = '3';
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS families (id INTEGER PRIMARY KEY, ord TEXT, family TEXT, family_common TEXT, seq INTEGER)`,
  `CREATE TABLE IF NOT EXISTS species (
     id INTEGER PRIMARY KEY AUTOINCREMENT, seq REAL, common_name TEXT NOT NULL, scientific_name TEXT NOT NULL,
     family_id INTEGER REFERENCES families(id), native_status TEXT, season_status TEXT, review INTEGER DEFAULT 0,
     endemic INTEGER DEFAULT 0, habitats TEXT, conservation TEXT, photo_group TEXT, bay_area INTEGER DEFAULT 0,
     target_priority TEXT DEFAULT '', notes TEXT DEFAULT '', ident TEXT DEFAULT '', natural_history TEXT DEFAULT '',
     distribution TEXT DEFAULT '', where_to_find TEXT DEFAULT '', photo_notes TEXT DEFAULT '', custom TEXT DEFAULT '{}',
     definitive_photo_id INTEGER, ref_url TEXT, ref_thumb TEXT, ref_credit TEXT, ref_license TEXT, ref_license_url TEXT,
     ref_source_url TEXT, ref_fetched_at TEXT, user_added INTEGER DEFAULT 0, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS observations (
     id INTEGER PRIMARY KEY AUTOINCREMENT, species_id INTEGER NOT NULL REFERENCES species(id), observed_at TEXT NOT NULL,
     location_name TEXT DEFAULT '', county TEXT DEFAULT '', lat REAL, lng REAL, count INTEGER, behavior TEXT DEFAULT '',
     habitat TEXT DEFAULT '', notes TEXT DEFAULT '', confidence TEXT DEFAULT 'confirmed', visibility TEXT DEFAULT 'private',
     custom TEXT DEFAULT '{}', created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS photos (
     id INTEGER PRIMARY KEY AUTOINCREMENT, species_id INTEGER NOT NULL REFERENCES species(id),
     observation_id INTEGER REFERENCES observations(id), store TEXT, original_name TEXT, original_type TEXT,
     original_kept INTEGER DEFAULT 0, width INTEGER, height INTEGER, exif TEXT DEFAULT '{}', taken_at TEXT,
     caption TEXT DEFAULT '', rating INTEGER DEFAULT 0, favorite INTEGER DEFAULT 0, id_confirmed INTEGER DEFAULT 1,
     visibility TEXT DEFAULT 'private', created_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS blobs (key TEXT NOT NULL, idx INTEGER NOT NULL, data BLOB, PRIMARY KEY (key, idx))`,
  `CREATE TABLE IF NOT EXISTS custom_fields (id INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL, type TEXT DEFAULT 'text', options TEXT DEFAULT '', UNIQUE (tbl, key))`,
  `CREATE TABLE IF NOT EXISTS saved_views (id INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, url TEXT, note TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS submissions (
     id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, bird TEXT NOT NULL, sci TEXT, credit_name TEXT NOT NULL, contact TEXT DEFAULT '',
     region TEXT DEFAULT '', note TEXT DEFAULT '', taken_at TEXT, camera TEXT DEFAULT '', width INTEGER, height INTEGER, store TEXT,
     status TEXT DEFAULT 'pending', cut_w INTEGER, cut_h INTEGER, approved_at TEXT, featured INTEGER DEFAULT 0, ip TEXT,
     license TEXT DEFAULT '', license_url TEXT DEFAULT '', source_url TEXT DEFAULT '', sample INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS sub_status ON submissions(status)`,
  `CREATE INDEX IF NOT EXISTS obs_species ON observations(species_id)`,
  `CREATE INDEX IF NOT EXISTS photo_species ON photos(species_id)`,
];
const SOURCES = [
  ['American Ornithological Society Check-list, 2025 (via Institute for Bird Populations species list)', 'https://www.birdpop.org/pages/birdSpeciesCodes.php', 'English and scientific names and taxonomic sequence. Every seeded name was matched against this list.'],
  ['California Bird Records Committee state list', 'https://californiabirds.org/ca_list.asp', 'The species list: all 696 species on the official list as updated 27 October 2026, with its review, introduced and extirpated flags.'],
  ['California Department of Fish and Wildlife — State and Federally Listed Endangered and Threatened Animals', 'https://wildlife.ca.gov/Conservation/CESA', 'Conservation status notes, entered for a small number of well-known listed species only.'],
  ['Wikimedia Commons', 'https://commons.wikimedia.org', 'Reference photographs, loaded on request with author and license recorded for each image.'],
];

let ready = null;
function ensureReady(env) {
  if (!ready) ready = init(env).catch((e) => { ready = null; throw e; });
  return ready;
}
async function init(env) {
  const db = env.DB;
  let v = null;
  try { v = await db.prepare(`SELECT value FROM settings WHERE key='schema_version'`).first('value'); } catch { /* first run */ }
  if (v === SCHEMA_VERSION) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // Columns added after the first release; each fails harmlessly if it is already there.
  for (const col of [`license TEXT DEFAULT ''`, `license_url TEXT DEFAULT ''`, `source_url TEXT DEFAULT ''`, `sample INTEGER DEFAULT 0`]) {
    try { await db.prepare(`ALTER TABLE submissions ADD COLUMN ${col}`).run(); } catch { /* exists */ }
  }
  const n = await db.prepare(`SELECT COUNT(*) n FROM species`).first('n');
  if (!n) {
    const now = new Date().toISOString();
    const stmts = [];
    seed.families.forEach((f, i) => stmts.push(db.prepare(`INSERT INTO families (id, ord, family, family_common, seq) VALUES (?,?,?,?,?)`).bind(f.id, f.ord, f.family, f.family_common, i + 1)));
    for (const s of seed.species) {
      stmts.push(db.prepare(`INSERT INTO species (seq, common_name, scientific_name, family_id, native_status, season_status, review, endemic, habitats, conservation, photo_group, bay_area, ident, natural_history, distribution, where_to_find, photo_notes, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(s.seq, s.cn, s.sn, s.fam, s.native, s.season, s.review, s.endemic, s.hab, s.cons || '', s.group, s.bay || 0, s.ident || '', s.nat || '', s.dist || '', s.find || '', s.photo || '', now));
    }
    for (const [name, url, note] of SOURCES) stmts.push(db.prepare(`INSERT INTO sources (name, url, note, updated_at) VALUES (?,?,?,?)`).bind(name, url, note, now));
    for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  }
  await db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)`).bind(SCHEMA_VERSION).run();
}

// ---------- helpers ----------
// Visitors never see exact locations: no coordinates, no place names, no GPS from photo files.
function publicPhoto(p, owner) {
  const exif = JSON.parse(p.exif || '{}');
  if (owner) return { ...p, exif };
  delete exif.lat; delete exif.lng;
  const { location_name, original_name, ...rest } = p;
  return { ...rest, exif };
}
function publicObs(o, owner) {
  if (owner) return o;
  const { lat, lng, location_name, notes, ...rest } = o;
  return rest;
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (status, message) => json({ error: message }, status);
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function isOwner(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)atlas_session=([^;]+)/.exec(request.headers.get('cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(env.ADMIN_PASSWORD, 'atlas|' + exp));
}
const SPECIES_EDITABLE = ['common_name', 'scientific_name', 'family_id', 'native_status', 'season_status', 'review', 'endemic', 'habitats', 'conservation', 'photo_group', 'bay_area', 'target_priority', 'notes', 'ident', 'natural_history', 'distribution', 'where_to_find', 'photo_notes', 'definitive_photo_id', 'seq'];
const OBS_FIELDS = ['species_id', 'observed_at', 'location_name', 'county', 'lat', 'lng', 'count', 'behavior', 'habitat', 'notes', 'confidence', 'visibility'];
const PHOTO_EDITABLE = ['species_id', 'observation_id', 'caption', 'rating', 'favorite', 'id_confirmed', 'visibility', 'taken_at'];
const clean = (v) => (v === undefined ? null : v);

async function patchRow(db, table, id, body, allowed) {
  const sets = [], vals = [];
  for (const k of allowed) if (k in body) { sets.push(`${k} = ?`); vals.push(clean(body[k])); }
  if (body.custom && typeof body.custom === 'object' && table !== 'photos') {
    const cur = JSON.parse((await db.prepare(`SELECT custom FROM ${table} WHERE id = ?`).bind(id).first('custom')) || '{}');
    sets.push('custom = ?'); vals.push(JSON.stringify({ ...cur, ...body.custom }));
  }
  if (table === 'species') { sets.push('updated_at = ?'); vals.push(new Date().toISOString()); }
  if (!sets.length) return;
  await db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
}

// ---------- media storage: R2 when bound, otherwise D1 chunks (display copies only) ----------
const CHUNK = 900 * 1024;
async function putBlob(env, key, buf, type) {
  if (env.PHOTOS) { await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: type } }); return; }
  const bytes = new Uint8Array(buf);
  const stmts = [];
  for (let i = 0, n = 0; i < bytes.length; i += CHUNK, n++) stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO blobs (key, idx, data) VALUES (?,?,?)`).bind(key, n, bytes.slice(i, i + CHUNK)));
  for (const s of stmts) await s.run();
}
async function getBlob(env, key, store) {
  if (store === 'r2') { if (!env.PHOTOS) return null; const o = await env.PHOTOS.get(key); return o ? o.body : null; }
  const rows = (await env.DB.prepare(`SELECT data FROM blobs WHERE key = ? ORDER BY idx`).bind(key).all()).results;
  if (!rows.length) return null;
  const parts = rows.map((r) => new Uint8Array(r.data));
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
async function deleteSubBlobs(env, id, store) {
  for (const v of ['thumb', 'display', 'cutout']) {
    const key = `subs/${id}/${v}`;
    if (store === 'r2' && env.PHOTOS) await env.PHOTOS.delete(key); else await env.DB.prepare(`DELETE FROM blobs WHERE key = ?`).bind(key).run();
  }
}
async function deleteBlobs(env, id, store) {
  for (const v of ['thumb', 'display', 'original']) {
    const key = `photos/${id}/${v}`;
    if (store === 'r2' && env.PHOTOS) await env.PHOTOS.delete(key); else await env.DB.prepare(`DELETE FROM blobs WHERE key = ?`).bind(key).run();
  }
}

// ---------- reference photographs (Wikimedia Commons) ----------
const OK_LICENSE = /^(cc0|cc[ -]by|public domain|pd)/i;
const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
async function wiki(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'CaliforniaBirdAtlas/1.0 (personal field guide; reference image lookup)', accept: 'application/json' } });
  if (!r.ok) throw new Error('Wikimedia returned ' + r.status);
  return r.json();
}
async function commonsInfo(fileTitle) {
  // Two standard thumbnail widths are requested; Wikimedia only serves a fixed set of sizes.
  const q = (w) => wiki(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=${w}&titles=${encodeURIComponent(fileTitle)}`);
  const pick = (d) => Object.values(d?.query?.pages || {})[0]?.imageinfo?.[0];
  const ii = pick(await q(1920));
  if (!ii) return null;
  const small = pick(await q(500));
  const md = ii.extmetadata || {};
  return { url: ii.thumburl || ii.url, thumb: small?.thumburl || ii.thumburl || ii.url, mime: ii.mime, credit: strip(md.Artist?.value) || 'Unknown author', license: strip(md.LicenseShortName?.value), license_url: md.LicenseUrl?.value || '', source: ii.descriptionurl };
}
async function findReference(sp, fileTitle) {
  let title = fileTitle;
  if (!title) {
    const d = await wiki(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(sp.scientific_name)}`);
    const page = Object.values(d?.query?.pages || {})[0];
    if (!page?.pageimage) return { error: 'No lead image on the Wikipedia article' };
    title = 'File:' + page.pageimage;
  }
  if (!/^File:/i.test(title)) title = 'File:' + title;
  const info = await commonsInfo(title);
  if (!info) return { error: 'Image is not hosted on Wikimedia Commons' };
  if (!/^image\/(jpeg|png|webp)/.test(info.mime || '')) return { error: 'Lead image is not a photograph (' + info.mime + ')' };
  if (!OK_LICENSE.test(info.license)) return { error: 'License not accepted: ' + (info.license || 'unknown') };
  return info;
}

// ---------- data assembly ----------
async function loadSpecies(db, owner) {
  const [sp, obs, ph] = await db.batch([
    db.prepare(`SELECT id, seq, common_name, scientific_name, family_id, native_status, season_status, review, endemic, habitats, conservation, photo_group, bay_area, target_priority, notes, custom, definitive_photo_id, ref_url, ref_thumb, ref_credit, ref_license, user_added, (ident != '') has_profile FROM species ORDER BY seq`),
    db.prepare(`SELECT species_id, COUNT(*) n, SUM(confidence = 'confirmed') confirmed, MIN(CASE WHEN confidence = 'confirmed' THEN observed_at END) first_seen, MAX(observed_at) last_seen FROM observations GROUP BY species_id`),
    db.prepare(`SELECT species_id, COUNT(*) n, SUM(id_confirmed = 1) confirmed, MIN(CASE WHEN id_confirmed = 1 THEN COALESCE(taken_at, created_at) END) first_photo, MAX(id) latest_id, MAX(CASE WHEN visibility = 'public' THEN id END) latest_public FROM photos GROUP BY species_id`),
  ]);
  const pub = owner ? null : new Set((await db.prepare(`SELECT id FROM photos WHERE visibility = 'public'`).all()).results.map((r) => r.id));
  const counties = (await db.prepare(`SELECT o.species_id, o.county FROM observations o JOIN (SELECT species_id, MAX(observed_at) m FROM observations GROUP BY species_id) x ON x.species_id = o.species_id AND x.m = o.observed_at`).all()).results;
  const O = new Map(obs.results.map((r) => [r.species_id, r])), P = new Map(ph.results.map((r) => [r.species_id, r])), C = new Map(counties.map((r) => [r.species_id, r.county]));
  return sp.results.map((s) => {
    const o = O.get(s.id), p = P.get(s.id);
    const status = p?.confirmed ? 'photographed' : o?.confirmed ? 'observed' : (o || p) ? 'pending' : 'none';
    return { ...s, custom: JSON.parse(s.custom || '{}'), status, encounters: o?.n || 0, photo_count: p?.n || 0, first_seen: o?.first_seen || null, last_seen: o?.last_seen || null, first_photo: p?.first_photo || null, county: owner ? (C.get(s.id) || '') : '', photo_id: owner ? (s.definitive_photo_id || p?.latest_id || null) : (pub.has(s.definitive_photo_id) ? s.definitive_photo_id : p?.latest_public || null), notes: owner ? s.notes : '' };
  });
}
const pubObs = (owner) => (owner ? '' : ` AND o.visibility = 'public'`);
const pubPhoto = (owner) => (owner ? '' : ` AND p.visibility = 'public'`);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith('/api/') && !path.startsWith('/media/')) return env.ASSETS.fetch(request);
    try {
      await ensureReady(env);
      return await route(request, env, url, path);
    } catch (e) {
      return fail(500, e.message || String(e));
    }
  },
};

async function route(request, env, url, path) {
  const db = env.DB, method = request.method;
  const owner = await isOwner(request, env);
  const seg = path.split('/').filter(Boolean); // ['api', 'species', '12']
  const body = async () => { try { return await request.json(); } catch { return {}; } };
  const need = () => { if (!owner) throw Object.assign(new Error('Sign in as the owner to make changes.'), { status: 401 }); };
  try {
    // ----- media: submissions and the Bird Wall -----
    if (seg[0] === 'media' && seg[1] === 'sub') {
      const id = Number(seg[2]), variant = seg[3];
      if (!['thumb', 'display', 'cutout'].includes(variant)) return fail(404, 'Not found');
      const sub = await db.prepare(`SELECT status, store FROM submissions WHERE id = ?`).bind(id).first();
      if (!sub) return fail(404, 'Not found');
      if (!owner && sub.status !== 'approved') return fail(403, 'Not published');
      const data = await getBlob(env, `subs/${id}/${variant}`, sub.store);
      if (!data) return fail(404, 'Not found');
      return new Response(data, { headers: { 'content-type': variant === 'cutout' ? 'image/png' : 'image/jpeg', 'cache-control': sub.status === 'approved' ? 'public, max-age=86400' : 'private, no-store' } });
    }
    // ----- media -----
    if (seg[0] === 'media') {
      const id = Number(seg[1]), variant = seg[2];
      if (!['thumb', 'display', 'original'].includes(variant)) return fail(404, 'Not found');
      const p = await db.prepare(`SELECT * FROM photos WHERE id = ?`).bind(id).first();
      if (!p) return fail(404, 'Not found');
      if (!owner && (p.visibility !== 'public' || variant === 'original')) return fail(403, 'Private photograph');
      if (variant === 'original' && !p.original_kept) return fail(404, 'The original file was not archived for this photograph.');
      const data = await getBlob(env, `photos/${id}/${variant}`, p.store);
      if (!data) return fail(404, 'Not found');
      const h = { 'content-type': variant === 'original' ? (p.original_type || 'application/octet-stream') : 'image/jpeg', 'cache-control': p.visibility === 'public' ? 'public, max-age=86400' : 'private, max-age=3600' };
      if (variant === 'original') h['content-disposition'] = `attachment; filename="${(p.original_name || 'photo-' + id).replace(/[^\w.\- ]/g, '_')}"`;
      return new Response(data, { headers: h });
    }
    const r = seg[1];
    // ----- session -----
    if (r === 'session') return json({ owner, configured: !!env.ADMIN_PASSWORD, storage: env.PHOTOS ? 'r2' : 'd1' });
    if (r === 'login' && method === 'POST') {
      if (!env.ADMIN_PASSWORD) return fail(400, 'No owner password is set yet. Add a secret named ADMIN_PASSWORD to this Worker in the Cloudflare dashboard.');
      const { password = '' } = await body();
      if (!same(await hmac('pw', String(password)), await hmac('pw', env.ADMIN_PASSWORD))) return fail(401, 'Incorrect password.');
      const exp = Date.now() + 30 * 864e5;
      const secure = url.protocol === 'https:' ? ' Secure;' : '';
      return json({ owner: true }, 200, { 'set-cookie': `atlas_session=${exp}.${await hmac(env.ADMIN_PASSWORD, 'atlas|' + exp)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${30 * 86400}` });
    }
    if (r === 'logout' && method === 'POST') return json({ owner: false }, 200, { 'set-cookie': 'atlas_session=; Path=/; HttpOnly; Max-Age=0' });

    // ----- bootstrap -----
    if (r === 'bootstrap') {
      const [fam, fields, views, settings, sources] = await db.batch([
        db.prepare(`SELECT * FROM families ORDER BY seq`), db.prepare(`SELECT * FROM custom_fields ORDER BY id`),
        db.prepare(`SELECT * FROM saved_views ORDER BY name`), db.prepare(`SELECT key, value FROM settings`), db.prepare(`SELECT * FROM sources ORDER BY id`),
      ]);
      const totals = await db.prepare(`SELECT (SELECT COUNT(DISTINCT county) FROM observations WHERE county != '') counties, (SELECT COUNT(DISTINCT substr(observed_at, 1, 10)) FROM observations) field_days, (SELECT COUNT(*) FROM observations) observations, (SELECT COUNT(*) FROM photos) photos`).first();
      return json({ owner, configured: !!env.ADMIN_PASSWORD, storage: env.PHOTOS ? 'r2' : 'd1', families: fam.results, species: await loadSpecies(db, owner), fields: fields.results,
        views: owner ? views.results.map((v) => ({ ...v, config: JSON.parse(v.config) })) : [], settings: Object.fromEntries(settings.results.map((s) => [s.key, s.value])), sources: sources.results, totals });
    }

    // ----- species -----
    if (r === 'species') {
      const id = Number(seg[2]);
      if (method === 'GET' && id) {
        const sp = await db.prepare(`SELECT s.*, f.family, f.family_common, f.ord FROM species s LEFT JOIN families f ON f.id = s.family_id WHERE s.id = ?`).bind(id).first();
        if (!sp) return fail(404, 'Species not found');
        const obs = (await db.prepare(`SELECT o.* FROM observations o WHERE o.species_id = ?${pubObs(owner)} ORDER BY o.observed_at DESC`).bind(id).all()).results;
        const photos = (await db.prepare(`SELECT p.* FROM photos p WHERE p.species_id = ?${pubPhoto(owner)} ORDER BY p.favorite DESC, p.rating DESC, p.id DESC`).bind(id).all()).results;
        if (!owner) sp.notes = '';
        return json({ species: { ...sp, custom: JSON.parse(sp.custom || '{}') }, observations: obs.map((o) => publicObs(o, owner)), photos: photos.map((p) => publicPhoto(p, owner)) });
      }
      need();
      if (method === 'POST' && seg[2] === 'bulk') {
        const { ids = [], patch = {} } = await body();
        for (const i of ids) await patchRow(db, 'species', Number(i), patch, SPECIES_EDITABLE);
        return json({ updated: ids.length });
      }
      if (method === 'POST' && seg[2] === 'import') {
        const { rows = [] } = await body();
        const all = (await db.prepare(`SELECT id, common_name, scientific_name FROM species`).all()).results;
        const bySci = new Map(all.map((s) => [s.scientific_name.toLowerCase(), s.id])), byCom = new Map(all.map((s) => [s.common_name.toLowerCase(), s.id]));
        let updated = 0, created = 0, skipped = 0; const maxSeq = (await db.prepare(`SELECT MAX(seq) m FROM species`).first('m')) || 0;
        for (const row of rows) {
          const sci = String(row.scientific_name || '').trim(), com = String(row.common_name || '').trim();
          const hit = bySci.get(sci.toLowerCase()) || byCom.get(com.toLowerCase());
          if (hit) { await patchRow(db, 'species', hit, row, SPECIES_EDITABLE.filter((k) => !['common_name', 'scientific_name', 'seq'].includes(k))); updated++; }
          else if (sci && com) {
            const res = await db.prepare(`INSERT INTO species (seq, common_name, scientific_name, native_status, season_status, user_added, updated_at) VALUES (?,?,?,?,?,1,?)`).bind(maxSeq + 1 + created, com, sci, row.native_status || '', row.season_status || '', new Date().toISOString()).run();
            await patchRow(db, 'species', res.meta.last_row_id, row, SPECIES_EDITABLE.filter((k) => !['common_name', 'scientific_name', 'seq'].includes(k)));
            bySci.set(sci.toLowerCase(), res.meta.last_row_id); byCom.set(com.toLowerCase(), res.meta.last_row_id); created++;
          } else skipped++;
        }
        return json({ updated, created, skipped });
      }
      if (method === 'POST' && !seg[2]) {
        const b = await body();
        const com = String(b.common_name || '').trim(), sci = String(b.scientific_name || '').trim();
        if (!com || !sci) return fail(400, 'A common name and a scientific name are both required.');
        const dup = await db.prepare(`SELECT id, common_name FROM species WHERE lower(common_name) = lower(?) OR lower(scientific_name) = lower(?)`).bind(com, sci).first();
        if (dup && !b.allow_duplicate) return json({ error: `"${dup.common_name}" is already in the catalog.`, duplicate: dup.id }, 409);
        const maxSeq = (await db.prepare(`SELECT MAX(seq) m FROM species`).first('m')) || 0;
        const res = await db.prepare(`INSERT INTO species (seq, common_name, scientific_name, family_id, native_status, season_status, habitats, user_added, updated_at) VALUES (?,?,?,?,?,?,?,1,?)`).bind(maxSeq + 1, com, sci, clean(b.family_id), b.native_status || '', b.season_status || '', b.habitats || '', new Date().toISOString()).run();
        return json({ id: res.meta.last_row_id });
      }
      if (method === 'PATCH' && id) { await patchRow(db, 'species', id, await body(), SPECIES_EDITABLE); return json({ ok: true }); }
      if (method === 'DELETE' && id) {
        const used = await db.prepare(`SELECT (SELECT COUNT(*) FROM observations WHERE species_id = ?1) + (SELECT COUNT(*) FROM photos WHERE species_id = ?1) n`).bind(id).first('n');
        if (used) return fail(409, 'This species has observations or photographs. Remove or reassign those first.');
        await db.prepare(`DELETE FROM species WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
    }

    // ----- reference image -----
    if (r === 'reference' && method === 'POST') {
      need();
      const id = Number(seg[2]); const b = await body();
      const sp = await db.prepare(`SELECT id, scientific_name FROM species WHERE id = ?`).bind(id).first();
      if (!sp) return fail(404, 'Species not found');
      if (b.clear) { await db.prepare(`UPDATE species SET ref_url = NULL, ref_thumb = NULL, ref_credit = NULL, ref_license = NULL, ref_license_url = NULL, ref_source_url = NULL, ref_fetched_at = NULL WHERE id = ?`).bind(id).run(); return json({ ok: true }); }
      const info = await findReference(sp, b.file);
      if (info.error) return json({ ok: false, reason: info.error });
      await db.prepare(`UPDATE species SET ref_url = ?, ref_thumb = ?, ref_credit = ?, ref_license = ?, ref_license_url = ?, ref_source_url = ?, ref_fetched_at = ? WHERE id = ?`).bind(info.url, info.thumb, info.credit, info.license, info.license_url, info.source, new Date().toISOString(), id).run();
      return json({ ok: true, ...info });
    }

    // ----- observations -----
    if (r === 'observations') {
      const id = Number(seg[2]);
      if (method === 'GET') {
        const limit = Math.min(Number(url.searchParams.get('limit')) || 2000, 5000);
        const rows = (await db.prepare(`SELECT o.*, s.common_name, s.scientific_name, (SELECT COUNT(*) FROM photos p WHERE p.observation_id = o.id) photo_count, (SELECT MIN(p.id) FROM photos p WHERE p.observation_id = o.id${pubPhoto(owner)}) photo_id FROM observations o JOIN species s ON s.id = o.species_id WHERE 1 = 1${pubObs(owner)} ORDER BY o.observed_at DESC, o.id DESC LIMIT ?`).bind(limit).all()).results;
        return json(rows.map((o) => publicObs({ ...o, custom: JSON.parse(o.custom || '{}') }, owner)));
      }
      need();
      if (method === 'POST') {
        const b = await body();
        if (!b.species_id || !b.observed_at) return fail(400, 'A species and a date are required.');
        const res = await db.prepare(`INSERT INTO observations (${OBS_FIELDS.join(', ')}, created_at) VALUES (${OBS_FIELDS.map(() => '?').join(',')}, ?)`).bind(...OBS_FIELDS.map((k) => clean(b[k] ?? (k === 'confidence' ? 'confirmed' : k === 'visibility' ? 'private' : ['lat', 'lng', 'count'].includes(k) ? null : ''))), new Date().toISOString()).run();
        return json({ id: res.meta.last_row_id });
      }
      if (method === 'PATCH' && id) {
        const b = await body(); await patchRow(db, 'observations', id, b, OBS_FIELDS);
        if ('confidence' in b) await db.prepare(`UPDATE photos SET id_confirmed = ? WHERE observation_id = ?`).bind(b.confidence === 'confirmed' ? 1 : 0, id).run();
        if ('species_id' in b) await db.prepare(`UPDATE photos SET species_id = ? WHERE observation_id = ?`).bind(b.species_id, id).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && id) {
        await db.prepare(`UPDATE photos SET observation_id = NULL WHERE observation_id = ?`).bind(id).run();
        await db.prepare(`DELETE FROM observations WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
    }

    // ----- photos -----
    if (r === 'photos') {
      const id = Number(seg[2]);
      if (method === 'GET') {
        const rows = (await db.prepare(`SELECT p.*, s.common_name, s.scientific_name, s.definitive_photo_id, o.location_name, o.county FROM photos p JOIN species s ON s.id = p.species_id LEFT JOIN observations o ON o.id = p.observation_id WHERE 1 = 1${pubPhoto(owner)} ORDER BY COALESCE(p.taken_at, p.created_at) DESC, p.id DESC`).all()).results;
        return json(rows.map((p) => publicPhoto(p, owner)));
      }
      need();
      if (method === 'POST') {
        const form = await request.formData();
        const meta = JSON.parse(form.get('meta') || '{}');
        const display = form.get('display'), thumb = form.get('thumb'), original = form.get('original');
        if (!meta.species_id || !display || !thumb) return fail(400, 'A species and an image are required.');
        const store = env.PHOTOS ? 'r2' : 'd1';
        const keepOriginal = store === 'r2' && original && typeof original !== 'string';
        const res = await db.prepare(`INSERT INTO photos (species_id, observation_id, store, original_name, original_type, original_kept, width, height, exif, taken_at, caption, id_confirmed, visibility, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(meta.species_id, clean(meta.observation_id), store, meta.original_name || '', meta.original_type || '', keepOriginal ? 1 : 0, clean(meta.width), clean(meta.height), JSON.stringify(meta.exif || {}), clean(meta.taken_at), meta.caption || '', meta.id_confirmed === 0 ? 0 : 1, meta.visibility || 'private', new Date().toISOString()).run();
        const pid = res.meta.last_row_id;
        try {
          await putBlob(env, `photos/${pid}/thumb`, await thumb.arrayBuffer(), 'image/jpeg');
          await putBlob(env, `photos/${pid}/display`, await display.arrayBuffer(), 'image/jpeg');
          if (keepOriginal) await env.PHOTOS.put(`photos/${pid}/original`, original.stream(), { httpMetadata: { contentType: original.type || 'application/octet-stream' } });
        } catch (e) { await deleteBlobs(env, pid, store); await db.prepare(`DELETE FROM photos WHERE id = ?`).bind(pid).run(); throw e; }
        return json({ id: pid, original_kept: keepOriginal });
      }
      if (method === 'PATCH' && id) { await patchRow(db, 'photos', id, await body(), PHOTO_EDITABLE); return json({ ok: true }); }
      if (method === 'DELETE' && id) {
        const p = await db.prepare(`SELECT store FROM photos WHERE id = ?`).bind(id).first();
        if (!p) return fail(404, 'Not found');
        await deleteBlobs(env, id, p.store);
        await db.prepare(`UPDATE species SET definitive_photo_id = NULL WHERE definitive_photo_id = ?`).bind(id).run();
        await db.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
    }

    // ----- submissions (public send, owner review) and the public Bird Wall -----
    if (r === 'wall' && method === 'GET') {
      const rows = (await db.prepare(`SELECT id, bird, sci, credit_name, region, taken_at, camera, width, height, cut_w, cut_h, approved_at, featured, license, license_url, source_url, sample FROM submissions WHERE status = 'approved' AND cut_w IS NOT NULL ORDER BY featured DESC, approved_at DESC, id DESC LIMIT 2000`).all()).results;
      return json(rows, 200, { 'cache-control': 'public, max-age=60' });
    }
    // Sample birds: openly licensed photos the editor's browser fetched and cut out, shown until real photos arrive.
    if (r === 'samples') {
      need();
      if (method === 'GET') return json((await db.prepare(`SELECT source_url FROM submissions WHERE sample = 1`).all()).results.map((x) => x.source_url));
      if (method === 'DELETE') {
        const rows = (await db.prepare(`SELECT id, store FROM submissions WHERE sample = 1`).all()).results;
        for (const x of rows) await deleteSubBlobs(env, x.id, x.store);
        await db.prepare(`DELETE FROM submissions WHERE sample = 1`).run();
        return json({ removed: rows.length });
      }
      if (method === 'POST') {
        const form = await request.formData();
        const meta = JSON.parse(form.get('meta') || '{}');
        const display = form.get('display'), thumb = form.get('thumb'), cut = form.get('cutout');
        if ([display, thumb, cut].some((f) => !f || typeof f === 'string')) return fail(400, 'Missing image.');
        const sp = await db.prepare(`SELECT common_name, scientific_name FROM species WHERE lower(common_name) = lower(?)`).bind(String(meta.bird || '')).first();
        if (!sp) return fail(400, 'Not on the California list: ' + meta.bird);
        const src = String(meta.source_url || '').slice(0, 400);
        if (src && await db.prepare(`SELECT id FROM submissions WHERE source_url = ?`).bind(src).first()) return json({ skipped: true });
        const store = env.PHOTOS ? 'r2' : 'd1', now = new Date().toISOString();
        const res = await db.prepare(`INSERT INTO submissions (created_at, bird, sci, credit_name, region, note, width, height, store, status, cut_w, cut_h, approved_at, featured, license, license_url, source_url, sample) VALUES (?,?,?,?,?,?,?,?,?,'approved',?,?,?,?,?,?,?,1)`)
          .bind(now, sp.common_name, sp.scientific_name, String(meta.credit_name || 'Unknown').slice(0, 120), String(meta.region || '').slice(0, 40), 'Sample photo from Wikimedia Commons', clean(meta.width), clean(meta.height), store, clean(meta.cut_w), clean(meta.cut_h), now, meta.featured ? 1 : 0, String(meta.license || '').slice(0, 80), String(meta.license_url || '').slice(0, 400), src).run();
        const sid = res.meta.last_row_id;
        try {
          await putBlob(env, `subs/${sid}/display`, await display.arrayBuffer(), 'image/jpeg');
          await putBlob(env, `subs/${sid}/thumb`, await thumb.arrayBuffer(), 'image/jpeg');
          await putBlob(env, `subs/${sid}/cutout`, await cut.arrayBuffer(), 'image/png');
        } catch (e) { await deleteSubBlobs(env, sid, store); await db.prepare(`DELETE FROM submissions WHERE id = ?`).bind(sid).run(); throw e; }
        return json({ id: sid });
      }
    }
    if (r === 'submissions') {
      const id = Number(seg[2]);
      if (method === 'POST' && !seg[2]) {
        const form = await request.formData();
        const meta = JSON.parse(form.get('meta') || '{}');
        const display = form.get('display'), thumb = form.get('thumb');
        const bird = String(meta.bird || '').trim(), name = String(meta.credit_name || '').trim().slice(0, 80);
        if (!meta.consent) return fail(400, 'Please confirm that you took this photo and agree to the terms.');
        if (!bird || !name) return fail(400, 'Choose the bird and enter the name to credit.');
        if (!display || typeof display === 'string' || !thumb || typeof thumb === 'string') return fail(400, 'Attach a photo.');
        if (display.size > 8 * 1024 * 1024 || thumb.size > 400 * 1024) return fail(413, 'That photo is too large. Try a smaller copy.');
        const sp = await db.prepare(`SELECT common_name, scientific_name FROM species WHERE lower(common_name) = lower(?)`).bind(bird).first();
        if (!sp) return fail(400, 'Choose a bird from the California list.');
        const ip = await hmac(env.ADMIN_PASSWORD || 'wild-index', request.headers.get('cf-connecting-ip') || 'local');
        const recent = await db.prepare(`SELECT COUNT(*) n FROM submissions WHERE ip = ? AND created_at > ?`).bind(ip, new Date(Date.now() - 864e5).toISOString()).first('n');
        if (recent >= 12) return fail(429, 'You have sent 12 photos today. Please try again tomorrow.');
        const waiting = await db.prepare(`SELECT COUNT(*) n FROM submissions WHERE status = 'pending'`).first('n');
        if (waiting >= 1000) return fail(503, 'The review queue is full right now. Please try again in a few days.');
        const store = env.PHOTOS ? 'r2' : 'd1';
        const res = await db.prepare(`INSERT INTO submissions (created_at, bird, sci, credit_name, contact, region, note, taken_at, camera, width, height, store, ip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(new Date().toISOString(), sp.common_name, sp.scientific_name, name, String(meta.contact || '').slice(0, 120), String(meta.region || '').slice(0, 40), String(meta.note || '').slice(0, 600), clean(meta.taken_at), String(meta.camera || '').slice(0, 80), clean(meta.width), clean(meta.height), store, ip).run();
        const sid = res.meta.last_row_id;
        try {
          await putBlob(env, `subs/${sid}/display`, await display.arrayBuffer(), 'image/jpeg');
          await putBlob(env, `subs/${sid}/thumb`, await thumb.arrayBuffer(), 'image/jpeg');
        } catch (e) { await deleteSubBlobs(env, sid, store); await db.prepare(`DELETE FROM submissions WHERE id = ?`).bind(sid).run(); throw e; }
        return json({ id: sid });
      }
      need();
      if (method === 'GET') {
        const rows = (await db.prepare(`SELECT id, created_at, bird, sci, credit_name, contact, region, note, taken_at, camera, width, height, status, cut_w, cut_h, approved_at, featured, license, license_url, source_url, sample FROM submissions ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, id DESC LIMIT 3000`).all()).results;
        return json(rows);
      }
      if (method === 'POST' && seg[3] === 'cutout' && id) {
        const form = await request.formData();
        const cut = form.get('cutout'); const w = Number(form.get('w')), h = Number(form.get('h'));
        if (!cut || typeof cut === 'string') return fail(400, 'No cut-out received.');
        const sub = await db.prepare(`SELECT store FROM submissions WHERE id = ?`).bind(id).first();
        if (!sub) return fail(404, 'Not found');
        await putBlob(env, `subs/${id}/cutout`, await cut.arrayBuffer(), 'image/png');
        await db.prepare(`UPDATE submissions SET cut_w = ?, cut_h = ? WHERE id = ?`).bind(w || null, h || null, id).run();
        return json({ ok: true });
      }
      if (method === 'PATCH' && id) {
        const b = await body(); const sets = [], vals = [];
        for (const k of ['credit_name', 'region', 'note', 'featured', 'status']) if (k in b) { sets.push(`${k} = ?`); vals.push(b[k]); }
        if ('bird' in b) {
          const sp = await db.prepare(`SELECT common_name, scientific_name FROM species WHERE lower(common_name) = lower(?)`).bind(String(b.bird)).first();
          if (!sp) return fail(400, 'Choose a bird from the California list.');
          sets.push('bird = ?', 'sci = ?'); vals.push(sp.common_name, sp.scientific_name);
        }
        if (b.status === 'approved') { sets.push('approved_at = ?'); vals.push(new Date().toISOString()); }
        if (!sets.length) return json({ ok: true });
        await db.prepare(`UPDATE submissions SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run();
        return json({ ok: true });
      }
      if (method === 'DELETE' && id) {
        const sub = await db.prepare(`SELECT store FROM submissions WHERE id = ?`).bind(id).first();
        if (!sub) return fail(404, 'Not found');
        await deleteSubBlobs(env, id, sub.store);
        await db.prepare(`DELETE FROM submissions WHERE id = ?`).bind(id).run();
        return json({ ok: true });
      }
    }

    // ----- custom fields, saved views, settings, export -----
    if (r === 'fields') {
      need();
      if (method === 'POST') {
        const b = await body(); const label = String(b.label || '').trim();
        if (!label || !['species', 'observations'].includes(b.tbl)) return fail(400, 'A column name is required.');
        const key = 'c_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        try { const res = await db.prepare(`INSERT INTO custom_fields (tbl, key, label, type, options) VALUES (?,?,?,?,?)`).bind(b.tbl, key, label, b.type || 'text', b.options || '').run(); return json({ id: res.meta.last_row_id, tbl: b.tbl, key, label, type: b.type || 'text', options: b.options || '' }); }
        catch { return fail(409, 'A column with that name already exists.'); }
      }
      if (method === 'DELETE' && seg[2]) { await db.prepare(`DELETE FROM custom_fields WHERE id = ?`).bind(Number(seg[2])).run(); return json({ ok: true }); }
    }
    if (r === 'views') {
      need();
      if (method === 'POST') { const b = await body(); const res = await db.prepare(`INSERT INTO saved_views (tbl, name, config) VALUES (?,?,?)`).bind(b.tbl, String(b.name || 'Untitled view'), JSON.stringify(b.config || {})).run(); return json({ id: res.meta.last_row_id }); }
      if (method === 'DELETE' && seg[2]) { await db.prepare(`DELETE FROM saved_views WHERE id = ?`).bind(Number(seg[2])).run(); return json({ ok: true }); }
    }
    if (r === 'settings' && method === 'PUT') {
      need(); const b = await body();
      for (const [k, v] of Object.entries(b)) if (k !== 'schema_version') await db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).bind(k, typeof v === 'string' ? v : JSON.stringify(v)).run();
      return json({ ok: true });
    }
    if (r === 'export' && method === 'GET') {
      need();
      const out = { exported_at: new Date().toISOString(), note: 'California Bird Atlas backup. Photograph files are not included; download originals from the Gallery.' };
      for (const t of ['families', 'species', 'observations', 'photos', 'submissions', 'custom_fields', 'saved_views', 'sources', 'settings']) out[t] = (await db.prepare(`SELECT * FROM ${t}`).all()).results;
      return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="california-bird-atlas-backup-${out.exported_at.slice(0, 10)}.json"` } });
    }
    return fail(404, 'Not found');
  } catch (e) {
    if (e.status) return fail(e.status, e.message);
    throw e;
  }
}
