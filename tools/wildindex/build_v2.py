"""Build the v2 regional table: official list + first-table ratings + corrections + scores + evidence."""
import sys, json, re, collections
sys.path.insert(0, '/home/claude/verify/scripts'); sys.path.insert(0, '/home/claude/wildindex/v2')
import names as N, regions as R, compare as C, flags as F

V2 = '/home/claude/wildindex/v2/'
REG = R.REGIONS
SO = 'WPSF'
V1TOK = {'A': 'WPSF', 'W': 'WPF', 'S': 'PS', 'P': 'PSF', 'M': 'PF', 'F': 'F', 'Y': 'SF', 'N': 'WF', 'G': 'P', 'H': 'WSF', 'U': 'S'}
PHRASE = {'WPSF': 'all year', 'WPF': 'fall to spring', 'PS': 'spring and summer', 'PSF': 'spring to fall', 'PF': 'spring and fall',
          'F': 'fall', 'SF': 'summer and fall', 'WF': 'fall and winter', 'P': 'spring', 'WSF': 'summer to winter', 'S': 'summer',
          'W': 'winter', 'WP': 'winter and spring', 'WPS': 'winter to summer', 'WS': 'winter and summer', 'PSW': 'winter to summer'}
SEASON_NAME = {'W': 'Winter', 'P': 'Spring', 'S': 'Summer', 'F': 'Fall'}
W_SPOT, W_PHOTO, T1, T2 = 0.70, 0.30, 1.5, 2.5


def order(s):
    return ''.join(c for c in SO if c in s)


def parse(cell, keep=None):
    """v2 cell text -> '-', 'x' or {season: level}."""
    if cell in ('-', 'x'):
        return cell
    out = {}
    for part in cell.split('+'):
        m = re.fullmatch(r'([AWPSF]+)([123*])', part)
        if not m:
            raise ValueError('bad cell ' + cell)
        ss = 'WPSF' if m.group(1) == 'A' else m.group(1)
        lv = keep if m.group(2) == '*' else int(m.group(2))
        if lv is None:
            raise ValueError('no level to keep for ' + cell)
        for s in ss:
            out[s] = lv
    return out


def words(c):
    if c == '-':
        return '–'
    if c == 'x':
        return 'rare'
    by = collections.defaultdict(str)
    for s in SO:
        if s in c:
            by[c[s]] += s
    return '; '.join('%d %s' % (lv, PHRASE[order(by[lv])]) for lv in sorted(by))


def level(spot, photo):
    d = W_SPOT * spot + W_PHOTO * photo
    return 1 if d < T1 else 2 if d < T2 else 3


# ------------------------------------------------------------------ species list
seedfile = json.load(open('/home/claude/atlas/src/seed.json'))
fam = {f['id']: f for f in seedfile['families']}
seed = {}
for s in seedfile['species']:
    o = N.to_official(s['cn'])
    if o and s['cn'] != 'Brown Booby':
        seed[o] = s
SCI_PATCH = {'Pacific Wren': 'Nannus pacificus', 'Winter Wren': 'Nannus hiemalis', 'Yellow Warbler': 'Setophaga aestiva',
             'Hudsonian Whimbrel': 'Numenius hudsonicus', 'Prairie Willet': 'Tringa inornata', 'American Egret': 'Ardea egretta',
             'Western Marsh-Wren': 'Cistothorus paludicola', 'Western Warbling-Vireo': 'Vireo swainsoni',
             'Arctic/Kamchatka Leaf Warbler': 'Phylloscopus borealis/examinandus', 'Painted Whitestart': 'Myioborus pictus'}
NEW = {  # on the official list, missing from the first table: scientific name, family
    'Waved Albatross': ('Phoebastria irrorata', 'Diomedeidae'), "Ainley's Storm-Petrel": ('Hydrobates cheimomnestes', 'Hydrobatidae'),
    'Band-rumped Storm-Petrel': ('Hydrobates castro', 'Hydrobatidae'), 'Kermadec Petrel': ('Pterodroma neglecta', 'Procellariidae'),
    'Eurasian Wryneck': ('Jynx torquilla', 'Picidae'), 'Small-billed Elaenia': ('Elaenia parvirostris', 'Tyrannidae'),
    'Buff-breasted Flycatcher': ('Empidonax fulvifrons', 'Tyrannidae'), 'Willow Warbler': ('Phylloscopus trochilus', 'Phylloscopidae'),
    'Wood Warbler': ('Phylloscopus sibilatrix', 'Phylloscopidae'), 'Yellow-browed Warbler': ('Phylloscopus inornatus', 'Phylloscopidae'),
    'Red-whiskered Bulbul': ('Pycnonotus jocosus', 'Pycnonotidae'), 'Bluethroat': ('Luscinia svecica', 'Muscicapidae'),
    'Siberian Rubythroat': ('Calliope calliope', 'Muscicapidae'), 'Blue Rock-thrush': ('Monticola solitarius', 'Muscicapidae'),
    'Citrine Wagtail': ('Motacilla citreola', 'Motacillidae'), 'Siberian Pipit': ('Anthus japonicus', 'Motacillidae'),
    'Eastern Meadowlark': ('Sturnella magna', 'Icteridae'), 'Tropical Parula': ('Setophaga pitiayumi', 'Parulidae'),
    'Slate-throated Whitestart': ('Myioborus miniatus', 'Parulidae')}
FAM_COMMON = {f['family']: f['family_common'] for f in seedfile['families']}
FAM_COMMON.setdefault('Pycnonotidae', 'Bulbuls'); FAM_COMMON.setdefault('Phylloscopidae', 'Leaf Warblers')
genus = [g for g, n in re.findall(r'([A-Z][a-z]+) (\d+)', open(V2 + 'genus_runs.txt').read()) for _ in range(int(n))]

# ------------------------------------------------------------------ ratings: first table -> v2 cells
v1 = C.load_v1()
ratings, v1cells, why = {}, {}, {}
for o, d in v1.items():
    if not d['cells']:
        continue
    grp = seed[o]['group'] if o in seed else '?'
    row, base = [], []
    for reg, c in zip(REG, d['cells']):
        if c in ('-', 'x'):
            row.append(c); base.append(c); continue
        tok, lv = c[:-1], int(c[-1])
        cell = {s: lv for s in V1TOK[tok]}
        base.append(dict(cell))
        if reg == 'DES' and tok == 'M' and grp in ('forest', 'perched'):
            cell = {'P': lv}; why[(o, reg)] = 'Desert passage is dependable in spring only'
        row.append(cell)
    ratings[o] = row; v1cells[o] = base


def migrant_rule(o):
    for i, c in enumerate(ratings[o]):
        if isinstance(c, dict) and set(c) <= {'P', 'F'} and min(c.values()) == 1:
            for s in c:
                c[s] = 2
            why.setdefault((o, REG[i]), 'Passage bird: never Level 1')
            if 'Passage' not in why[(o, REG[i])] and 'passage' not in why[(o, REG[i])]:
                why[(o, REG[i])] += '; passage birds are never Level 1'


for o in ratings:
    migrant_rule(o)
n_over = 0
for line in open(V2 + 'overrides.txt', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'):
        continue
    name, ops, reason = [x.strip() for x in line.split('|')]
    if name not in ratings:
        raise SystemExit('override for unrated species: ' + name)
    d = v1[name]['cells']
    explicit = [op for op in ops.split() if '=' in op]
    tokops = [op for op in ops.split() if '>' in op]
    for op in tokops:
        m = re.fullmatch(r'([A-Z])>([WPSFA]+)(?:@([A-Z,]+))?', op)
        old, new, regs = m.group(1), m.group(2), (m.group(3).split(',') if m.group(3) else REG)
        new = 'WPSF' if new == 'A' else new
        hit = 0
        for i, reg in enumerate(REG):
            if reg in regs and d[i] not in ('-', 'x') and d[i][:-1] == old:
                ratings[name][i] = {s: int(d[i][-1]) for s in new}; why[(name, reg)] = reason; hit += 1
        if not hit:
            raise SystemExit('token op matched nothing: %s %s' % (name, op))
    for op in explicit:
        k, v = op.split('=')
        if k == 'ALL':
            for i, reg in enumerate(REG):
                if ratings[name][i] != '-':
                    if ratings[name][i] != 'x':
                        why[(name, reg)] = reason
                    ratings[name][i] = 'x'
            continue
        i = REG.index(k)
        keep = int(d[i][-1]) if d[i] not in ('-', 'x') else None
        ratings[name][i] = parse(v, keep); why[(name, k)] = reason
    n_over += 1
    migrant_rule(name)

BBS_SKIP = {'Sagebrush Sparrow', "Bell's Sparrow", "Woodhouse's Scrub-Jay"}   # survey used older, lumped names
for o in ratings:
    if o in BBS_SKIP or o not in C.bbs_sp or (seed[o]['group'] if o in seed else '?') not in ('forest', 'perched'):
        continue
    for i, reg in enumerate(REG):
        c = ratings[o][i]; f = C.bbs_sp[o].get(reg, [0, 0, 0])[0]
        if isinstance(c, dict) and 'S' not in c and f >= 0.15:
            c['S'] = max(2 if f >= 0.30 else 3, min(c.values()))
            extra = 'Breeding survey finds it on %d%% of June runs: summer added at a harder level' % round(f * 100)
            why[(o, reg)] = (why[(o, reg)] + '; ' + extra[0].lower() + extra[1:]) if (o, reg) in why else extra

changes = []
for o in ratings:
    for i, reg in enumerate(REG):
        a, b = v1cells[o][i], ratings[o][i]
        if a != b:
            changes.append({'species': o, 'region': reg, 'was': words(a), 'now': words(b), 'why': why.get((o, reg), 'Season set clarified')})

# ------------------------------------------------------------------ evidence per cell
AB = {'Abundant': 5, 'Common': 4, 'Uncommon': 3, 'Rare': 2, 'Occasional': 1}
PARK_REG = {'REDW': 'NC', 'LAVO': 'SN', 'YOSE': 'SN', 'SEKI': 'SN', 'PINN': 'CC', 'CHIS': 'CC', 'DEVA': 'DES', 'JOTR': 'DES'}
LOW_MANUAL = {'Vermilion Flycatcher': 'spreading fast', 'Neotropic Cormorant': 'spreading', 'Great-tailed Grackle': 'still spreading',
              'Evening Grosbeak': 'wanders', 'Red Crossbill': 'wanders', 'Pine Siskin': 'numbers swing year to year',
              'Varied Thrush': 'numbers swing year to year', "Lawrence's Goldfinch": 'erratic', 'Pinyon Jay': 'wanders',
              'Mountain Plover': 'declining', 'Yellow-footed Gull': 'numbers falling', 'Black Tern': 'declining',
              'Inca Dove': 'declining', 'Tropical Kingbird': 'a few birds a year', 'White-throated Sparrow': 'a few birds per county',
              "Lewis's Woodpecker": 'irregular', 'Rufous Hummingbird': "easily confused with Allen's",
              "Hammond's Flycatcher": 'hard to identify', 'Dusky Flycatcher': 'hard to identify', 'Iceland Gull': 'hard to identify',
              'Sooty Shearwater': 'from shore only on some days', 'Black-vented Shearwater': 'from shore only on some days',
              'Royal Tern': 'status changing', 'Yellow-crowned Night Heron': 'spreading', 'Reddish Egret': 'a few birds',
              'Stilt Sandpiper': 'one area only', 'Gull-billed Tern': 'two colonies', 'Black Skimmer': 'a few sites',
              'Brown Pelican': 'Salton Sea numbers falling', 'Cactus Wren': 'coastal birds declining', 'Pectoral Sandpiper': 'a few each fall',
              'Eurasian Wigeon': 'a few each winter', 'Red Knot': 'a few sites'}


def cell_checks(o, reg, cell):
    """-> (list of agreeing sources, list of disagreeing notes)"""
    ok, bad = [], []
    grp = seed[o]['group'] if o in seed else '?'
    land = grp in ('forest', 'perched')
    f = C.bbs_sp[o].get(reg, [0, 0, 0])[0] if o in C.bbs_sp else 0.0
    summer = cell['S'] if isinstance(cell, dict) and 'S' in cell else None
    if o in BBS_SKIP:
        land_chk = False
    else:
        land_chk = land
    if land_chk:
        if summer is not None:
            good = (summer == 1 and f >= 0.25) or (summer == 2 and 0.03 <= f) or (summer == 3 and f < 0.55)
            (ok if good else bad).append('survey' if good else 'survey %d%% vs spotting %d' % (round(f * 100), summer))
        elif cell in ('-', 'x') or isinstance(cell, dict):
            if f >= 0.15:
                bad.append('survey finds it on %d%% of June runs' % round(f * 100))
            elif cell in ('-', 'x'):
                ok.append('survey')
    elif f >= 0.15 and cell in ('-', 'x'):
        bad.append('survey finds it on %d%% of June runs' % round(f * 100))
    if reg in ('SN', 'DES') or (reg in ('NC', 'CC') and (land or grp in ('raptor', 'hummingbird'))):
        best = None
        for p, pr in PARK_REG.items():
            if pr != reg or (reg == 'CC' and p == 'CHIS'):
                continue
            dd = C.nps['species'].get(o, {}).get(p)
            if o == 'Yellow-bellied Sapsucker': dd = None      # park lists use the old lumped name
            v = AB.get(dd.get('ab')) if dd and dd.get('occ') in ('Present', 'Probably Present') else 0
            if v is not None:
                best = v if best is None else max(best, v)
        if best is not None:
            anyl = min(cell.values()) if isinstance(cell, dict) else None
            if anyl is None:
                (bad if best >= 4 else ok).append('parks list it as common' if best >= 4 else 'parks')
            elif anyl == 1:
                if best >= 3: ok.append('parks')
                elif reg != 'CC': bad.append('parks list it as rare or absent')   # Pinnacles is dry interior: no test for coastal birds
            elif anyl == 2:
                if best >= 1: ok.append('parks')
            else:
                if best <= 4: ok.append('parks')
    zone = {'SN': 'BCR15', 'DES': 'BCR33'}.get(reg, 'BCR32')
    if o in C.cbc_n:
        ix = C.cbc_n[o].get(zone, 0)
        winter = cell['W'] if isinstance(cell, dict) and 'W' in cell else None
        if zone != 'BCR32':
            if winter == 1:
                (ok if ix >= 1 else bad).append('winter counts' if ix >= 1 else 'winter counts low')
            elif winter in (2, 3) and ix >= 0.2:
                ok.append('winter counts')
            elif winter is None and ix >= 8:
                bad.append('winter counts find it')
    return ok, bad


# ------------------------------------------------------------------ assemble
birds = []
for i, (name, mark) in enumerate(N.OFFICIAL):
    s = seed.get(name)
    if s:
        sci = SCI_PATCH.get(name, s['sn']); family = fam[s['fam']]['family']
    else:
        sci, family = NEW[name]
    assert sci.split()[0].split('/')[0] == genus[i], (name, sci, genus[i])
    b = {'id': 'WI-%03d' % (i + 1), 'no': i + 1, 'name': name, 'sci': sci, 'family': family,
         'family_common': FAM_COMMON.get(family, ''), 'review': '*' in mark,
         'introduced': 'I' in mark.replace('RI', ''), 'extirpated': mark == 'E', 'reintro': 'RI' in mark}
    row = ratings.get(name)
    boat = name in v1 and '~' in v1[name]['flag']
    b['cells'] = row
    has_level = bool(row) and any(isinstance(c, dict) for c in row)
    if b['introduced']: kind = 'Introduced'
    elif b['extirpated']: kind = 'Extirpated'
    elif b['reintro']: kind = 'Reintroduced, not yet established'
    elif b['review']: kind = 'Rare visitor (review list)'
    elif has_level or boat: kind = 'Native'
    else: kind = 'Native, too scarce to assign'
    b['kind'] = kind
    reasons = []
    if kind != 'Native': reasons.append(kind if kind != 'Introduced' else 'Introduced: not part of the collection')
    if name in F.SENSITIVE: reasons.append('Sensitive: ' + F.SENSITIVE[name][0].lower() + F.SENSITIVE[name][1:])
    if name in F.NIGHT: reasons.append('Night bird')
    if boat: reasons.append('Boat only')
    if name in F.ISLAND: reasons.append(F.ISLAND[name])
    b['why_not'] = '; '.join(reasons); b['assignable'] = not reasons and has_level
    b['sensitive'] = name in F.SENSITIVE; b['night'] = name in F.NIGHT; b['boat'] = boat or name in F.ISLAND
    b['protection'] = F.PROTECTION.get(name, ''); b['field_note'] = F.FIELD_NOTE.get(name, ''); b['lookalike'] = F.LOOKALIKE.get(name, '')
    b['photo'] = F.photo(name, family) if (row or boat) else None
    b['levels'] = None
    if has_level:
        b['levels'] = {s: [level(c[s], b['photo']) if isinstance(c, dict) and s in c else None for c in row] for s in SO}
        b['spot'] = {s: [c[s] if isinstance(c, dict) and s in c else None for c in row] for s in SO}
    # evidence
    ev = {'bbs': None, 'parks': None, 'cbc': None}
    if name in C.bbs_sp: ev['bbs'] = [round(C.bbs_sp[name].get(r, [0])[0] * 100) for r in REG]
    if name in C.nps['species']:
        ev['parks'] = {p: (d.get('ab') or '?') if d.get('occ') in ('Present', 'Probably Present') else 'not listed' for p, d in C.nps['species'][name].items()}
    if name in C.cbc_n: ev['cbc'] = {z: round(C.cbc_n[name].get(z, 0), 1) for z in ('BCR15', 'BCR32', 'BCR33')}
    b['evidence'] = ev
    conf, checked_with, review = '', [], []
    if row:
        n_checked = n_agree = 0
        for reg, c in zip(REG, row):
            ok, bad = cell_checks(name, reg, c)
            for x in ok:
                if x not in checked_with: checked_with.append(x)
            if (ok or bad) and isinstance(c, dict):
                n_checked += 1
                if ok and not bad: n_agree += 1
            for x in bad: review.append('%s: %s' % (R.REGION_NAMES[reg], x))
            if bad and 'survey' in ' '.join(bad) and 'survey' not in checked_with: checked_with.append('survey')
            if bad and 'park' in ' '.join(bad) and 'parks' not in checked_with: checked_with.append('parks')
            if bad and 'winter' in ' '.join(bad) and 'winter counts' not in checked_with: checked_with.append('winter counts')
        if has_level:
            if name in LOW_MANUAL: conf = 'Low'; review.insert(0, 'Unsettled: ' + LOW_MANUAL[name])
            elif n_checked == 0: conf = 'Unchecked'
            elif n_checked >= 3 and n_agree / n_checked >= 0.8: conf = 'High'
            elif n_agree / n_checked >= 0.5: conf = 'Medium'
            else: conf = 'Low'
        b['n_checked'], b['n_agree'] = n_checked, n_agree
    b['confidence'] = conf; b['checked_with'] = checked_with; b['to_review'] = '; '.join(review)
    birds.append(b)

# removed / added / renamed relative to the first table
old_names = {s['cn'] for s in seedfile['species']}
removed = sorted(n for n in old_names if N.to_official(n) is None or n == 'Brown Booby')
renamed = sorted((n, N.to_official(n)) for n in old_names if N.to_official(n) and N.to_official(n) != n and n != 'Brown Booby')
added = sorted(NEW)
out = {'regions': REG, 'region_names': R.REGION_NAMES, 'birds': birds, 'changes': changes,
       'list_changes': {'removed': removed, 'renamed': renamed, 'added': added},
       'weights': [W_SPOT, W_PHOTO, T1, T2], 'bbs_runs': C.bbs['runs'], 'bbs_routes': C.bbs['routes']}
json.dump(out, open(V2 + 'v2.json', 'w'), indent=0)

# authoritative flat file
with open(V2 + 'ratings_v2.txt', 'w', encoding='utf-8') as fh:
    fh.write('# WILD INDEX regional spotting scores, v2 (reviewed 2026-11-19). Columns: ' + ' '.join(REG) + '\n')
    fh.write('# cell = seasons (W winter, P spring, S summer, F fall) + spotting score 1-3; parts joined by +; x = too rare to assign; - = not expected\n')
    for b in birds:
        if b['cells']:
            fh.write(b['id'] + '|' + b['name'] + '|' + ' '.join(('+'.join('%s%d' % (order(''.join(s for s in c if c[s] == lv)), lv) for lv in sorted(set(c.values()))) if isinstance(c, dict) else c) for c in b['cells']) + '\n')

if __name__ == '__main__':
    k = collections.Counter(b['kind'] for b in birds); print('species', len(birds), dict(k))
    print('overrides applied', n_over, '| cells changed', len(changes), '| species changed', len({c['species'] for c in changes}))
    print('assignable', sum(b['assignable'] for b in birds), '| sensitive', sum(b['sensitive'] for b in birds),
          '| night', sum(b['night'] for b in birds), '| boat/island', sum(b['boat'] for b in birds))
    print('not assignable with a level:', sum(1 for b in birds if b['levels'] and not b['assignable']))
    print('eligible but no level anywhere (must be 0):', sum(1 for b in birds if b['assignable'] and not b['levels']))
    print('confidence', dict(collections.Counter(b['confidence'] for b in birds if b['levels'])))
    print('list changes: removed', removed, '\nrenamed', renamed, '\nadded', len(added))
    print('review species rated (should be few):', [b['name'] for b in birds if b['review'] and b['cells']])
