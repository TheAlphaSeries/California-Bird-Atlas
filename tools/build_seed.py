import csv, json, sys, difflib, re
ibp_path, list_path, out_path = sys.argv[1:4]
names = {}
order = {}
with open(ibp_path, newline='', encoding='utf-8-sig') as f:
    for i, r in enumerate(csv.DictReader(f)):
        if r['SP'].strip():  # non-species forms (subspecies, hybrids, morphs)
            continue
        cn = r['COMMONNAME'].strip(); sn = r['SCINAME'].strip()
        if cn and sn and len(sn.split()) == 2:
            names.setdefault(cn, sn); order.setdefault(cn, i)
status_map = {'R': 'Year-round resident', 'S': 'Summer breeding visitor', 'W': 'Winter visitor',
              'M': 'Migrant', 'P': 'Pelagic visitor', 'V': 'Rare visitor'}
fams = []; species = []; bad = []; seen = set(); fam = None
for line in open(list_path, encoding='utf-8'):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    if line.startswith('>'):
        o, fs, fc, hab = [x.strip() for x in line[1:].split('|')]
        fam = {'id': len(fams) + 1, 'ord': o, 'family': fs, 'family_common': fc, 'hab': hab}
        fams.append(fam); continue
    parts = line.split('|')
    cn = parts[0].strip(); code = parts[1].strip(); hab = parts[2].strip() if len(parts) > 2 and parts[2].strip() else fam['hab']
    if cn in seen: bad.append((cn, 'DUPLICATE')); continue
    seen.add(cn)
    if len(parts) > 3 and parts[3].strip():
        names[cn] = parts[3].strip(); order[cn] = (order.get(species[-1]['cn'], 0) + 0.5) if species else 0
    if cn not in names:
        bad.append((cn, difflib.get_close_matches(cn, names.keys(), n=3, cutoff=0.6))); continue
    intro = 'I' in code[1:]; ext = 'X' in code[1:]; rev = '*' in code; end = 'E' in code[1:]
    native = 'Introduced' if intro else ('Extirpated' if ext else ('Rare natural visitor' if code[0] == 'V' else ('Native migrant' if code[0] in 'SWMP' else 'Native resident')))
    species.append({'cn': cn, 'sn': names[cn], 'fam': fam['id'], 'native': native, 'season': status_map[code[0]],
                    'review': 1 if rev else 0, 'endemic': 1 if end else 0, 'hab': hab, 'aos': order[cn]})
if bad:
    for b in bad: print('UNMATCHED', b)
    sys.exit(1)
sys.path.insert(0, 'tools')
from starters import STARTERS
GROUPS = {'hummingbird': ['Trochilidae'], 'waterfowl': ['Anatidae','Podicipedidae','Gaviidae','Rallidae'],
 'shorebird': ['Recurvirostridae','Haematopodidae','Charadriidae','Scolopacidae'],
 'wader': ['Ardeidae','Threskiornithidae','Ciconiidae','Gruidae'],
 'raptor': ['Cathartidae','Pandionidae','Accipitridae','Falconidae'], 'owl': ['Tytonidae','Strigidae','Caprimulgidae'],
 'seabird': ['Stercorariidae','Alcidae','Laridae','Phaethontidae','Diomedeidae','Oceanitidae','Hydrobatidae','Procellariidae','Fregatidae','Sulidae','Phalacrocoracidae','Pelecanidae','Anhingidae'],
 'aerial': ['Apodidae','Hirundinidae'],
 'forest': ['Picidae','Paridae','Sittidae','Certhiidae','Regulidae','Vireonidae','Parulidae','Tyrannidae','Turdidae','Corvidae','Cardinalidae','Columbidae','Cuculidae','Psittacidae','Psittaculidae','Bombycillidae']}
fam_group = {f: g for g, fl in GROUPS.items() for f in fl}
CONS = {
 'California Condor': 'Endangered (federal and California)',
 "Ridgway's Rail": 'Endangered (federal and California; California subspecies)',
 'Marbled Murrelet': 'Threatened (federal); Endangered (California)',
 'Snowy Plover': 'Threatened (federal; Pacific coast population)',
 'Least Tern': 'Endangered (federal and California; California subspecies)',
 'Tricolored Blackbird': 'Threatened (California)',
 'Spotted Owl': 'Threatened (federal; Northern subspecies)',
 'Bank Swallow': 'Threatened (California)',
 "Swainson's Hawk": 'Threatened (California)',
 'Great Gray Owl': 'Endangered (California)',
 'Willow Flycatcher': 'Endangered (California)',
 'Bald Eagle': 'Endangered (California)',
 'Black Rail': 'Threatened (California)',
 'Yellow-billed Cuckoo': 'Threatened (federal; western population); Endangered (California)',
 'Elf Owl': 'Endangered (California)',
 'Gila Woodpecker': 'Endangered (California)',
 'Gilded Flicker': 'Endangered (California)',
 "Bell's Vireo": "Endangered (federal and California; Least Bell's subspecies)",
 'California Gnatcatcher': 'Threatened (federal; coastal subspecies)',
 'Sandhill Crane': 'Threatened (California; Greater subspecies)',
}
species.sort(key=lambda s: s['aos'])
by_fam = {f['id']: f for f in fams}
missing = [k for k in list(STARTERS) + list(CONS) if k not in seen]
if missing: print('MISSING', missing); sys.exit(1)
for i, s in enumerate(species):
    s['seq'] = i + 1; del s['aos']
    s['group'] = fam_group.get(by_fam[s['fam']]['family'], 'perched')
    if s['cn'] in CONS: s['cons'] = CONS[s['cn']]
    if s['cn'] in STARTERS: s['bay'] = 1; s.update(STARTERS[s['cn']])
# keep families in the order their first species appears
first = {}
for s in species: first.setdefault(s['fam'], s['seq'])
fams.sort(key=lambda f: first.get(f['id'], 1e9))
print(len(species), 'species,', len(fams), 'families; review', sum(s['review'] for s in species), 'introduced', sum(s['native']=='Introduced' for s in species))
json.dump({'families': [{k: f[k] for k in ('id','ord','family','family_common')} for f in fams], 'species': species}, open(out_path, 'w'), ensure_ascii=False, indent=0)
