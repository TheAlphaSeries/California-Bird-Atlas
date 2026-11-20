import { api } from './util.js';
import { derivatives } from './exif.js';
import { autoCut } from './clip.js';

// Sample birds for the Bird Wall, used until real submissions arrive.
// Each photo is the lead image of the bird's Wikipedia article, which is always freely licensed on Wikimedia Commons.
// The editor's browser fetches it, cuts it out and uploads it with the photographer and licence.
// [bird on the California list, region, featured]
export const SAMPLES = [
  ["Anna's Hummingbird", "BAY", 1],
  ["California Scrub-Jay", "BAY", 0],
  ["Acorn Woodpecker", "CC", 1],
  ["California Quail", "CC", 0],
  ["Western Bluebird", "BAY", 0],
  ["Steller's Jay", "SN", 0],
  ["Snowy Egret", "BAY", 1],
  ["Brown Pelican", "SC", 1],
  ["Black Oystercatcher", "NC", 0],
  ["American Avocet", "CV", 0],
  ["Black-necked Stilt", "CV", 0],
  ["Red-tailed Hawk", "CV", 0],
  ["Osprey", "NC", 0],
  ["Yellow-billed Magpie", "CV", 0],
  ["Oak Titmouse", "CC", 0],
  ["California Towhee", "SC", 0],
  ["Wrentit", "CC", 0],
  ["Mountain Bluebird", "SN", 1],
  ["Clark's Nutcracker", "SN", 0],
  ["Greater Roadrunner", "DES", 1],
  ["Gambel's Quail", "DES", 0],
  ["Cactus Wren", "DES", 0],
  ["Vermilion Flycatcher", "DES", 0],
  ["White-crowned Sparrow", "BAY", 0],
  ["Cedar Waxwing", "SC", 0],
  ["Wood Duck", "CV", 0],
  ["Hooded Merganser", "NC", 0],
  ["Allen's Hummingbird", "SC", 0],
  ["Belted Kingfisher", "NC", 0],
  ["Western Tanager", "SN", 1],
  ["Lazuli Bunting", "SN", 0],
  ["Phainopepla", "DES", 0],
  ["Burrowing Owl", "SC", 0],
  ["Tufted Puffin", "NC", 0],
  ["Common Merganser", "SN", 0],
];

const WP = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const OK_LICENSE = /public domain|^pd|cc0|cc[ -]by/i;
const text = (html) => new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`Wikimedia answered ${r.status}`); return r.json(); };

async function findPhoto(bird) {
  const q = new URLSearchParams({ action: 'query', titles: bird, redirects: '1', prop: 'pageimages', piprop: 'name', format: 'json', origin: '*' });
  const page = Object.values((await getJSON(`${WP}?${q}`)).query?.pages || {})[0];
  const file = page?.pageimage;
  if (!file || !/\.jpe?g$/i.test(file)) throw new Error('no photo on its Wikipedia page');
  const q2 = new URLSearchParams({ action: 'query', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1600', format: 'json', origin: '*' });
  const info = Object.values((await getJSON(`${COMMONS}?${q2}`)).query?.pages || {})[0]?.imageinfo?.[0];
  if (!info) throw new Error('no file details');
  const m = info.extmetadata || {};
  const license = text(m.LicenseShortName?.value);
  if (!OK_LICENSE.test(license)) throw new Error('licence not open enough (' + (license || 'unknown') + ')');
  return { url: info.thumburl || info.url, page: info.descriptionurl, license, license_url: m.LicenseUrl?.value || '', artist: text(m.Artist?.value).slice(0, 100) || 'Unknown photographer' };
}

// Adds every sample not already on the wall. onProgress(done, total, message).
export async function fillSamples(onProgress = () => {}) {
  const have = new Set(await api('/samples'));
  let added = 0; const problems = [];
  for (let i = 0; i < SAMPLES.length; i++) {
    const [bird, region, featured] = SAMPLES[i];
    onProgress(i, SAMPLES.length, `Adding ${bird}…`);
    try {
      const p = await findPhoto(bird);
      if (have.has(p.page)) continue;
      const blob = await (await fetch(p.url)).blob();
      const [der, cut] = await Promise.all([derivatives(blob), autoCut(blob)]);
      const fd = new FormData();
      fd.set('meta', JSON.stringify({ bird, region, featured, credit_name: p.artist, license: p.license, license_url: p.license_url, source_url: p.page, width: der.width, height: der.height, cut_w: cut.width, cut_h: cut.height }));
      fd.set('display', der.display, 'display.jpg'); fd.set('thumb', der.thumb, 'thumb.jpg'); fd.set('cutout', cut.blob, 'cutout.png');
      const res = await api('/samples', { method: 'POST', form: fd });
      if (!res.skipped) added++;
    } catch (err) { problems.push(`${bird}: ${err.message}`); }
  }
  onProgress(SAMPLES.length, SAMPLES.length, 'Done');
  return { added, problems };
}

export const clearSamples = () => api('/samples', { method: 'DELETE' });
