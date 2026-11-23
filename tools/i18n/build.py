"""Turn tools/i18n/strings.txt into public/data/i18n.json (one dictionary per language, keyed by the English)."""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
LANGS = ['es', 'zh', 'tl', 'vi', 'ko']
out = {l: {} for l in LANGS}
for n, line in enumerate(open(os.path.join(H, 'strings.txt'), encoding='utf-8'), 1):
    line = line.strip()
    if not line or line.startswith('#'): continue
    parts = [p.strip() for p in line.split(' || ')]
    if len(parts) != 6: raise SystemExit(f'line {n}: expected 6 parts, got {len(parts)}')
    for l, t in zip(LANGS, parts[1:]): out[l][parts[0]] = t
dst = os.path.join(H, '..', '..', 'public', 'data', 'i18n.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('wrote', len(out['es']), 'strings x', len(LANGS), 'languages,', os.path.getsize(dst), 'bytes')
