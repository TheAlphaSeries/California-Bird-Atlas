// Draws the seven-region map of California used by the region picker, and writes public/data/region-map.json.
// Run once, or again if the region boundaries change:
//   npm install --no-save us-atlas topojson-client d3-geo && node tools/make-region-map.mjs
// County outlines come from the US Census Bureau (public domain) via the us-atlas package.
// The county and split rules below mirror tools/wildindex/regions.py; keep the two in step.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(process.env.MAP_DEPS ? process.env.MAP_DEPS + '/' : import.meta.url);
const topojson = require('topojson-client'), { geoContains, geoBounds } = require('d3-geo');
const us = require('us-atlas/counties-10m.json');

const WHOLE = {
  BAY: ['Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco', 'San Mateo', 'Santa Clara', 'Solano', 'Sonoma'],
  NC: ['Del Norte', 'Humboldt', 'Mendocino', 'Lake', 'Trinity'],
  CV: ['Sacramento', 'San Joaquin', 'Yolo', 'Sutter', 'Stanislaus', 'Merced', 'Kings'],
  SN: ['Modoc', 'Lassen', 'Plumas', 'Sierra', 'Nevada', 'El Dorado', 'Amador', 'Calaveras', 'Tuolumne', 'Mariposa', 'Alpine', 'Mono'],
  CC: ['Santa Cruz', 'Monterey', 'San Benito', 'San Luis Obispo', 'Santa Barbara'],
  SC: ['Ventura', 'Orange'], DES: ['Imperial'],
};
const COUNTY_REGION = Object.fromEntries(Object.entries(WHOLE).flatMap(([r, cs]) => cs.map((c) => [c, r])));
const VALLEY_EAST = [[40.60, -122.20], [40.20, -122.05], [39.75, -121.72], [39.50, -121.52], [39.15, -121.42], [38.85, -121.22], [38.60, -121.12], [38.25, -121.02], [37.80, -120.72], [37.35, -120.30], [37.00, -119.85], [36.80, -119.50], [36.35, -119.05], [36.05, -118.95], [35.40, -118.80], [35.05, -118.75]];
const OWENS_WEST = [[37.47, -118.60], [37.36, -118.50], [37.17, -118.38], [36.80, -118.28], [36.60, -118.15], [36.20, -118.08], [35.80, -118.02]];
function interp(line, lat) {
  if (lat >= line[0][0]) return line[0][1];
  if (lat <= line[line.length - 1][0]) return line[line.length - 1][1];
  for (let i = 0; i < line.length - 1; i++) { const [a1, o1] = line[i], [a2, o2] = line[i + 1]; if (a2 <= lat && lat <= a1) return o1 + ((a1 - lat) / (a1 - a2 || 1)) * (o2 - o1); }
}
function split(county, lat, lon) {
  const east = lon > interp(VALLEY_EAST, lat);
  if (county === 'Siskiyou') return lon < -122.70 ? 'NC' : 'SN';
  if (county === 'Shasta') return lon < -122.60 ? 'NC' : (lat < 40.75 && lon <= -122.15 && !east) ? 'CV' : 'SN';
  if (county === 'Tehama') return lon < -122.60 ? 'NC' : east ? 'SN' : 'CV';
  if (county === 'Glenn' || county === 'Colusa') return lon < -122.60 ? 'NC' : 'CV';
  if (['Butte', 'Yuba', 'Placer', 'Madera', 'Fresno', 'Tulare'].includes(county)) return east ? 'SN' : 'CV';
  if (county === 'Kern') { if (!east) return (lat < 34.95 && lon > -119.5) ? 'SC' : 'CV'; if (lat < 34.95 && lon < -118.75) return 'SC'; return lon > -118.15 ? 'DES' : 'SN'; }
  if (county === 'Inyo') return lon < interp(OWENS_WEST, lat) ? 'SN' : 'DES';
  if (county === 'Los Angeles') return ((lat > 34.50 && lon > -118.30) || lat > 34.72) ? 'DES' : 'SC';
  if (county === 'San Bernardino') return ((lat < 34.33 && lon < -116.70) || (lat < 34.40 && lon < -117.55)) ? 'SC' : 'DES';
  if (county === 'Riverside') return lon < -116.65 ? 'SC' : 'DES';
  if (county === 'San Diego') return lon > -116.45 ? 'DES' : 'SC';
  throw new Error('No region rule for ' + county);
}

const counties = topojson.feature(us, us.objects.counties).features.filter((f) => String(f.id).startsWith('06')).map((f) => ({ f, name: f.properties.name, b: geoBounds(f) }));
// Sample the state on a fine grid; each cell takes the region of the county (and split rule) at its centre.
const STEP = 0.07, LON0 = -124.5, LON1 = -114.0, LAT0 = 32.4, LAT1 = 42.1, KX = Math.cos((37.2 * Math.PI) / 180);
const cols = Math.round((LON1 - LON0) / STEP), rows = Math.round((LAT1 - LAT0) / STEP);
const CW = 6 * KX, CH = 6; // cell size in drawing units; narrower than tall, as a degree of longitude is at this latitude
const runs = {}, sums = {};
for (let r = 0; r < rows; r++) {
  const lat = LAT1 - (r + 0.5) * STEP; let cur = null, start = 0;
  const flush = (c) => { if (cur) (runs[cur] ||= []).push([start, r, c - start]); };
  for (let c = 0; c <= cols; c++) {
    const lon = LON0 + (c + 0.5) * STEP; let reg = null;
    if (c < cols) { const hit = counties.find((k) => lon >= k.b[0][0] && lon <= k.b[1][0] && lat >= k.b[0][1] && lat <= k.b[1][1] && geoContains(k.f, [lon, lat])); if (hit) reg = COUNTY_REGION[hit.name] || split(hit.name, lat, lon); }
    if (reg) { const s = (sums[reg] ||= [0, 0, 0]); s[0] += c; s[1] += r; s[2]++; }
    if (reg !== cur) { flush(c); cur = reg; start = c; }
  }
}
const n = (v) => +v.toFixed(1);
const out = { w: n(cols * CW), h: n(rows * CH), paths: {}, labels: {}, credit: 'County outlines: US Census Bureau (public domain), via us-atlas.' };
for (const [reg, list] of Object.entries(runs)) {
  out.paths[reg] = list.map(([c, r, len]) => `M${n(c * CW)} ${n(r * CH)}h${n(len * CW)}v${CH}h${n(-len * CW)}z`).join('');
  out.labels[reg] = [n((sums[reg][0] / sums[reg][2] + 0.5) * CW), n((sums[reg][1] / sums[reg][2] + 0.5) * CH)];
}
const dst = new URL('../public/data/region-map.json', import.meta.url);
fs.writeFileSync(dst, JSON.stringify(out));
console.log('wrote', fs.statSync(dst).size, 'bytes;', Object.entries(sums).map(([r, s]) => `${r} ${s[2]}`).join(', '));
