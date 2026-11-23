// The seven-region map of California (drawn by tools/make-region-map.mjs into /data/region-map.json).
// Used by the region picker, the difficulty map on bird pages, and the map on This Season.
import { REGIONS, REGION_NAMES } from './wi.js';

let mapP = null;
export const loadMap = () => (mapP ||= fetch('/data/region-map.json').then((r) => r.json()).catch((e) => { mapP = null; throw e; }));
const SHORT = { BAY: 'Bay Area', NC: 'North', CV: 'Valley', SN: 'Sierra', CC: 'Central', SC: 'Southern', DES: 'Deserts' };

// classOf(region) returns the CSS class for that region's shape; set labels: false for small maps.
export function mapSvg(g, classOf, { labels = true, title = (r) => REGION_NAMES[r] } = {}) {
  return `<svg class="rmap" viewBox="-6 -6 ${g.w + 12} ${g.h + 12}" role="img" aria-label="Map of California's seven regions">
    ${REGIONS.map((r) => `<path data-mr="${r}" class="${classOf(r) || ''}" d="${g.paths[r]}"><title>${title(r)}</title></path>`).join('')}
    ${labels ? REGIONS.map((r) => `<text x="${g.labels[r][0]}" y="${g.labels[r][1]}">${SHORT[r]}</text>`).join('') : ''}</svg>`;
}
