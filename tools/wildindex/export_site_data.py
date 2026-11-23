"""Write public/data/wildindex.json (birds, levels, scoring) from tools/wildindex/v2.json.

The nine birds per assignment are no longer exported: the site draws them itself (public/js/rotation.js).
cards.json is kept only as the record of the hand-picked trial cards in the planning Sheet."""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
v2 = json.load(open(os.path.join(H, 'v2.json')))
REG = v2['regions']; SO = 'WPSF'
def cat(b):
    if b['kind'] == 'Introduced': return 'introduced'
    if b['sensitive']: return 'sensitive'
    if b['kind'] in ('Rare visitor (review list)', 'Extirpated'): return 'rare'
    if b['kind'] == 'Native, too scarce to assign': return 'scarce'
    if b['night']: return 'night'
    if b['assignable']: return 'assign'
    return 'offshore'
birds = []
for b in v2['birds']:
    lv = None
    if b['levels']:
        lv = {s: ''.join(str(x) if x else '-' for x in b['levels'][s]) for s in SO}
    birds.append({k: v for k, v in {
        'id': b['id'], 'n': b['name'], 'sci': b['sci'], 'fam': b['family_common'] or b['family'], 'kind': b['kind'],
        'cat': cat(b), 'why': b['why_not'] or None, 'photo': b['photo'], 'lv': lv,
        'rr': ''.join('r' if c == 'x' else ('-' if c == '-' else 'y') for c in b['cells']) if b['cells'] else None,
        'prot': b['protection'] or None, 'note': b['field_note'] or None, 'look': b['lookalike'] or None, 'conf': b['confidence'] or None,
    }.items() if v is not None})
scoring = {
    'base': {'assign': [2, 5, 10], 'frequent': [1, 2, 5], 'night': 10, 'offshore': 10, 'scarce': 15, 'rare': 25, 'sensitive': 0, 'introduced': 0},
    'stars': [0.5, 0.75, 1, 1.5, 2], 'reupload': {'max': 3, 'share': 0.75},
    'bonus': {'level': 5, 'card': 25, 'documented': 10, 'issue': 25, 'annual': 100},
    'activity': {'post': 1, 'weekly_cap': 7, 'streak': 2, 'streak_cap': 10},
}
out = {'version': '2026-11-19', 'regions': REG, 'region_names': v2['region_names'], 'birds': birds, 'scoring': scoring}
dst = os.path.join(H, '..', '..', 'public', 'data', 'wildindex.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('wrote', os.path.getsize(dst), 'bytes,', len(birds), 'birds')
