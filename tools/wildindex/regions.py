"""Latitude/longitude -> California county -> WILD INDEX region.

Regions: BAY, NC, CV, SN, CC, SC, DES. Counties that straddle two regions are
split with simple boundary lines (documented in SPLIT_NOTES)."""
import json

GEO = '/home/claude/verify/geo/ca_counties.geojson'
REGIONS = ['BAY', 'NC', 'CV', 'SN', 'CC', 'SC', 'DES']
REGION_NAMES = {'BAY': 'Bay Area', 'NC': 'North Coast', 'CV': 'Central Valley', 'SN': 'Sierra & Northeast',
                'CC': 'Central Coast', 'SC': 'Southern Coast', 'DES': 'Deserts'}

WHOLE = {
    'BAY': ['Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco', 'San Mateo', 'Santa Clara', 'Solano', 'Sonoma'],
    'NC': ['Del Norte', 'Humboldt', 'Mendocino', 'Lake', 'Trinity'],
    'CV': ['Sacramento', 'San Joaquin', 'Yolo', 'Sutter', 'Stanislaus', 'Merced', 'Kings'],
    'SN': ['Modoc', 'Lassen', 'Plumas', 'Sierra', 'Nevada', 'El Dorado', 'Amador', 'Calaveras', 'Tuolumne',
           'Mariposa', 'Alpine', 'Mono'],
    'CC': ['Santa Cruz', 'Monterey', 'San Benito', 'San Luis Obispo', 'Santa Barbara'],
    'SC': ['Ventura', 'Orange'],
    'DES': ['Imperial'],
}
COUNTY_REGION = {c: r for r, cs in WHOLE.items() for c in cs}

# East edge of the Central Valley floor (roughly the 300 ft contour), north to south.
VALLEY_EAST = [(40.60, -122.20), (40.20, -122.05), (39.75, -121.72), (39.50, -121.52), (39.15, -121.42),
               (38.85, -121.22), (38.60, -121.12), (38.25, -121.02), (37.80, -120.72), (37.35, -120.30),
               (37.00, -119.85), (36.80, -119.50), (36.35, -119.05), (36.05, -118.95), (35.40, -118.80),
               (35.05, -118.75)]
# West edge of the Owens Valley floor (a few miles west of US 395), north to south.
OWENS_WEST = [(37.47, -118.60), (37.36, -118.50), (37.17, -118.38), (36.80, -118.28), (36.60, -118.15),
              (36.20, -118.08), (35.80, -118.02)]


def _interp(line, lat):
    pts = sorted(line, reverse=True)
    if lat >= pts[0][0]:
        return pts[0][1]
    if lat <= pts[-1][0]:
        return pts[-1][1]
    for (la1, lo1), (la2, lo2) in zip(pts, pts[1:]):
        if la2 <= lat <= la1:
            t = (la1 - lat) / (la1 - la2) if la1 != la2 else 0
            return lo1 + t * (lo2 - lo1)


def _split(county, lat, lon):
    east_of_valley = lon > _interp(VALLEY_EAST, lat)
    if county == 'Siskiyou':
        return 'NC' if lon < -122.70 else 'SN'
    if county == 'Shasta':
        if lon < -122.60:
            return 'NC'
        if lat < 40.75 and -122.60 <= lon <= -122.15 and not east_of_valley:
            return 'CV'
        return 'SN'
    if county == 'Tehama':
        if lon < -122.60:
            return 'NC'
        return 'SN' if east_of_valley else 'CV'
    if county in ('Glenn', 'Colusa'):
        return 'NC' if lon < -122.60 else 'CV'
    if county in ('Butte', 'Yuba', 'Placer', 'Madera', 'Fresno', 'Tulare'):
        return 'SN' if east_of_valley else 'CV'
    if county == 'Kern':
        if not east_of_valley:
            return 'SC' if (lat < 34.95 and lon > -119.5) else 'CV'
        if lat < 34.95 and lon < -118.75:
            return 'SC'
        return 'DES' if lon > -118.15 else 'SN'
    if county == 'Inyo':
        return 'SN' if lon < _interp(OWENS_WEST, lat) else 'DES'
    if county == 'Los Angeles':
        return 'DES' if ((lat > 34.50 and lon > -118.30) or lat > 34.72) else 'SC'
    if county == 'San Bernardino':
        if (lat < 34.33 and lon < -116.70) or (lat < 34.40 and lon < -117.55):
            return 'SC'
        return 'DES'
    if county == 'Riverside':
        return 'SC' if lon < -116.65 else 'DES'
    if county == 'San Diego':
        return 'DES' if lon > -116.45 else 'SC'
    raise KeyError(county)


SPLIT_NOTES = {
    'Siskiyou': 'West of Yreka (Klamath Mountains, Scott Valley): North Coast. Yreka, Mount Shasta and everything east: Sierra & Northeast.',
    'Shasta': 'Valley floor around Redding and Anderson: Central Valley. Far west (Whiskeytown, Trinity divide): North Coast. Mountains north and east: Sierra & Northeast.',
    'Tehama': 'Valley floor (Red Bluff, Corning): Central Valley. Coast Range in the far west: North Coast. Foothills and mountains east: Sierra & Northeast.',
    'Glenn': 'Valley floor: Central Valley. Mendocino National Forest in the far west: North Coast.',
    'Colusa': 'Valley floor: Central Valley. Mendocino National Forest in the far west: North Coast.',
    'Butte': 'Valley floor (Chico, Gridley, Oroville): Central Valley. Paradise and the mountains east: Sierra & Northeast.',
    'Yuba': 'Valley floor (Marysville): Central Valley. Foothills east: Sierra & Northeast.',
    'Placer': 'Valley floor (Roseville, Lincoln): Central Valley. Auburn and east: Sierra & Northeast.',
    'Madera': 'Valley floor: Central Valley. Foothills and mountains east: Sierra & Northeast.',
    'Fresno': 'Valley floor: Central Valley. Foothills and mountains east: Sierra & Northeast.',
    'Tulare': 'Valley floor: Central Valley. Foothills and mountains east: Sierra & Northeast.',
    'Kern': 'Valley floor (Bakersfield): Central Valley. Southern Sierra and Tehachapi Mountains: Sierra & Northeast. Mojave, Ridgecrest: Deserts. Frazier Park and Mount Pinos: Southern Coast.',
    'Inyo': 'Owens Valley floor, Death Valley and the desert ranges: Deserts. Sierra east slope above the valley: Sierra & Northeast.',
    'Los Angeles': 'Antelope Valley (Lancaster, Palmdale): Deserts. Everything else: Southern Coast.',
    'San Bernardino': 'Valley cities and the San Bernardino and San Gabriel mountains: Southern Coast. Everything north and east: Deserts.',
    'Riverside': 'West of San Gorgonio Pass and the San Jacinto crest: Southern Coast. Coachella Valley and east: Deserts.',
    'San Diego': 'Coast, valleys and mountains: Southern Coast. Anza-Borrego and the desert slope: Deserts.',
}

_polys = None


def _load():
    global _polys
    g = json.load(open(GEO))
    _polys = []
    for f in g['features']:
        geom = f['geometry']
        polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        for poly in polys:
            ring = poly[0]
            xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
            _polys.append((f['properties']['name'], ring, min(xs), max(xs), min(ys), max(ys)))


def _inside(ring, x, y):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def county_of(lat, lon):
    if _polys is None:
        _load()
    for name, ring, x0, x1, y0, y1 in _polys:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and _inside(ring, lon, lat):
            return name
    return None


def region_of(lat, lon):
    c = county_of(lat, lon)
    if c is None:
        return None, None
    return (COUNTY_REGION[c] if c in COUNTY_REGION else _split(c, lat, lon)), c


if __name__ == '__main__':
    tests = {'San Francisco': (37.77, -122.45, 'BAY'), 'Point Reyes': (38.04, -122.80, 'BAY'), 'Arcata': (40.87, -124.08, 'NC'),
             'Clear Lake': (39.02, -122.75, 'NC'), 'Scott Valley': (41.46, -122.90, 'NC'), 'Yreka': (41.73, -122.63, 'SN'),
             'Tule Lake': (41.90, -121.50, 'SN'), 'Redding': (40.58, -122.39, 'CV'), 'Burney': (40.88, -121.66, 'SN'),
             'Chico': (39.73, -121.84, 'CV'), 'Paradise': (39.76, -121.62, 'SN'), 'Sacramento NWR': (39.42, -122.18, 'CV'),
             'Auburn': (38.90, -121.08, 'SN'), 'Roseville': (38.75, -121.29, 'CV'), 'Yosemite Valley': (37.74, -119.59, 'SN'),
             'Fresno': (36.75, -119.77, 'CV'), 'Three Rivers': (36.44, -118.90, 'SN'), 'Bakersfield': (35.37, -119.02, 'CV'),
             'Lake Isabella': (35.62, -118.47, 'SN'), 'Ridgecrest': (35.62, -117.67, 'DES'), 'Tehachapi': (35.13, -118.45, 'SN'),
             'Mount Pinos': (34.81, -119.14, 'SC'), 'Lee Vining': (37.96, -119.12, 'SN'), 'Bishop': (37.36, -118.40, 'DES'),
             'Aspendell': (37.24, -118.60, 'SN'), 'Lone Pine': (36.60, -118.06, 'DES'), 'Furnace Creek': (36.46, -116.87, 'DES'),
             'Monterey': (36.60, -121.90, 'CC'), 'Carrizo Plain': (35.19, -119.86, 'CC'), 'Santa Barbara': (34.42, -119.70, 'CC'),
             'Ventura': (34.28, -119.29, 'SC'), 'Los Angeles': (34.05, -118.30, 'SC'), 'Lancaster': (34.70, -118.14, 'DES'),
             'Big Bear': (34.24, -116.91, 'SC'), 'Victorville': (34.54, -117.29, 'DES'), 'Idyllwild': (33.74, -116.72, 'SC'),
             'Palm Springs': (33.83, -116.55, 'DES'), 'San Diego': (32.72, -117.16, 'SC'), 'Julian': (33.08, -116.60, 'SC'),
             'Borrego Springs': (33.26, -116.37, 'DES'), 'Salton Sea': (33.20, -115.60, 'DES'), 'Davis': (38.54, -121.74, 'CV'),
             'Los Banos': (37.06, -120.85, 'CV'), 'Lake Tahoe': (39.10, -120.15, 'SN'), 'Alturas': (41.49, -120.54, 'SN'),
             'Weaverville': (40.73, -122.94, 'NC'), 'Santa Cruz Island': (34.00, -119.72, 'CC'), 'Blythe': (33.61, -114.60, 'DES'),
             'Joshua Tree': (34.13, -116.31, 'DES'), 'Pinnacles': (36.49, -121.18, 'CC')}
    bad = 0
    for k, (la, lo, want) in tests.items():
        got, c = region_of(la, lo)
        if got != want:
            bad += 1
            print('MISMATCH', k, c, got, 'want', want)
    print(len(tests), 'places tested;', bad, 'mismatches')
