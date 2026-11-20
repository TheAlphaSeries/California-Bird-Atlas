"""Bird picker, v2. One card per region per season: 3 levels x 3 birds. Shared birds first."""
import json, collections
V2 = '/home/claude/wildindex/v2/'
d = json.load(open(V2 + 'v2.json'))
REG = d['regions']; SO = 'WPSF'
SEASON = {'W': 'Winter', 'P': 'Spring', 'S': 'Summer', 'F': 'Fall'}
birds = [b for b in d['birds'] if b['assignable']]
CONF = {'High': 0, 'Medium': 1, 'Unchecked': 2, 'Low': 3}


def coverage():
    cov = {}
    for s in SO:
        for i, r in enumerate(REG):
            for L in (1, 2, 3):
                cov[(s, r, L)] = sum(1 for b in birds if b['levels'][s][i] == L)
    return cov


def run_year(order='WPSF', no_repeat=True):
    used = collections.defaultdict(set)        # region -> bird ids used this year
    last = collections.defaultdict(set)        # region -> bird ids used last season
    year, notes = {}, []
    for s in order:
        card = {r: {1: [], 2: [], 3: []} for r in REG}
        fam_count = collections.Counter()
        def cover(b, tier):
            relax = tier == 2
            if tier == 0 and b['confidence'] == 'Low': return []
            out = []
            for i, r in enumerate(REG):
                L = b['levels'][s][i]
                if L is None or len(card[r][L]) >= 3: continue
                if any(x['id'] == b['id'] for LL in card[r].values() for x in LL): continue
                if not relax and b['id'] in used[r]: continue
                if relax and b['id'] in last[r]: continue
                look = b['lookalike']
                if any(x['name'] in look or b['name'] in x['lookalike'] for LL in card[r].values() for x in LL if look or x['lookalike']): continue
                out.append((r, L))
            return out
        for relax in (0, 1, 2):
            while True:
                best, bestkey, bestcov = None, None, None
                for b in birds:
                    cv = cover(b, relax)
                    if not cv: continue
                    seasonal = sum(1 for i, r in enumerate(REG) if (r, b['levels'][s][i]) in cv and any(b['levels'][t][i] is None for t in SO))
                    key = (len(cv), -CONF[b['confidence']], seasonal, -fam_count[b['family']], -b['no'])
                    if bestkey is None or key > bestkey: best, bestkey, bestcov = b, key, cv
                if best is None: break
                for r, L in bestcov:
                    card[r][L].append({'id': best['id'], 'name': best['name'], 'lookalike': best['lookalike'], 'shared': len(bestcov), 'repeat': relax == 2, 'conf': best['confidence']})
                fam_count[best['family']] += 1
            if all(len(card[r][L]) == 3 for r in REG for L in (1, 2, 3)): break
        for r in REG:
            for L in (1, 2, 3):
                if len(card[r][L]) < 3: notes.append('%s, %s, Level %d: only %d of 3 filled. Needs an editor pick.' % (SEASON[s], d['region_names'][r], L, len(card[r][L])))
                for x in card[r][L]:
                    if x['repeat']: notes.append('%s, %s, Level %d: %s repeats from earlier in the year (no fresh bird left).' % (SEASON[s], d['region_names'][r], L, x['name']))
        last = collections.defaultdict(set)
        for r in REG:
            for L in (1, 2, 3):
                for x in card[r][L]: used[r].add(x['id']); last[r].add(x['id'])
        year[s] = card
    return year, notes


if __name__ == '__main__':
    cov = coverage()
    print('Assignable birds:', len(birds))
    print('Candidates per region / season / level (L1 L2 L3):')
    print('%-20s' % '' + '  '.join('%-12s' % SEASON[s] for s in SO))
    for r in REG:
        print('%-20s' % d['region_names'][r] + '  '.join('%3d %3d %3d ' % tuple(cov[(s, r, L)] for L in (1, 2, 3)) for s in SO))
    print('thinnest:', sorted(((v, SEASON[k[0]], k[1], k[2]) for k, v in cov.items()))[:6])
    year, notes = run_year()
    print('notes:', len(notes)); print('\n'.join(notes[:20]))
    json.dump({'year': year, 'notes': notes, 'coverage': {'%s|%s|%d' % k: v for k, v in cov.items()}}, open(V2 + 'cards.json', 'w'))
    for s in SO:
        sh = collections.Counter(x['shared'] for r in REG for L in (1, 2, 3) for x in year[s][r][L])
        names = {x['name'] for r in REG for L in (1, 2, 3) for x in year[s][r][L]}
        print(SEASON[s], 'distinct birds', len(names), '| slots by number of regions sharing the bird:', dict(sorted(sh.items())))
    print('Winter, Bay Area:', {L: [x['name'] for x in year['W']['BAY'][L]] for L in (1, 2, 3)})
    print('Summer, Deserts:', {L: [x['name'] for x in year['S']['DES'][L]] for L in (1, 2, 3)})
