// Sunrise, sunset and golden hour for a region, worked out in the browser. Nothing to update by hand:
// the date comes from the reader's clock, daylight saving is handled by formatting in California time,
// and the sun's position uses NOAA's published approximation (good to about a minute).
//
// Golden hour here means the sun between 4° below and 6° above the horizon: the soft, low light.
// Each region is timed for one town near its middle; across a region the times differ by a few minutes.
export const PLACES = {
  BAY: ['Oakland', 37.80, -122.27], NC: ['Eureka', 40.80, -124.16], CV: ['Merced', 37.30, -120.48],
  SN: ['Truckee', 39.33, -120.18], CC: ['Monterey', 36.60, -121.89], SC: ['Los Angeles', 34.05, -118.24], DES: ['Palm Springs', 33.83, -116.55],
};
const TZ = 'America/Los_Angeles', R = Math.PI / 180;

// Minutes after UTC midnight of the given UTC day when the sun crosses `elev` degrees, rising or setting.
function crossing(y, m, d, lat, lng, elev, rising) {
  const doy = (Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 864e5;
  let t = rising ? 720 + 4 * -lng - 360 : 720 + 4 * -lng + 360; // first guess: noon ∓ 6 hours
  for (let i = 0; i < 3; i++) { // refine using the sun's position at the guessed time
    const g = (2 * Math.PI / 365) * (doy - 1 + (t / 60 - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const c = (Math.sin(elev * R) - Math.sin(lat * R) * Math.sin(dec)) / (Math.cos(lat * R) * Math.cos(dec));
    if (c < -1 || c > 1) return null; // the sun never reaches that height today
    const ha = Math.acos(c) / R;
    t = 720 - 4 * (lng + (rising ? ha : -ha)) - eq;
  }
  return new Date(Date.UTC(y, m, d) + t * 60000);
}

// Today's light for a region (or tomorrow's, once today's evening golden hour is over).
export function lightFor(region, now = new Date()) {
  const [place, lat, lng] = PLACES[region] || PLACES.BAY;
  const day = (offset) => {
    const ca = new Date(now.toLocaleString('en-US', { timeZone: TZ })); ca.setDate(ca.getDate() + offset);
    const y = ca.getFullYear(), m = ca.getMonth(), d = ca.getDate();
    // A California day runs from about 08:00 UTC to 08:00 UTC the next day, so the times sit on this UTC date.
    return { rise: crossing(y, m, d, lat, lng, -0.833, true), set: crossing(y, m, d, lat, lng, -0.833, false),
      amEnd: crossing(y, m, d, lat, lng, 6, true), pmStart: crossing(y, m, d, lat, lng, 6, false),
      amStart: crossing(y, m, d, lat, lng, -4, true), pmEnd: crossing(y, m, d, lat, lng, -4, false) };
  };
  let t = day(0), tomorrow = false;
  if (t.pmEnd && now > t.pmEnd) { t = day(1); tomorrow = true; }
  return { place, tomorrow, ...t };
}
export const clock = (dt) => dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(' AM', ' am').replace(' PM', ' pm') : '–';
