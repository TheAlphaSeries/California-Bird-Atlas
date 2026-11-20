"""Map bird names from older or differently spelled sources onto the official
California list (California Bird Records Committee, updated 27 Oct 2026)."""
import re

OFFICIAL_FILE = '/home/claude/wildindex/v2/cbrc_2026-10-27.txt'


def norm(s):
    s = s.lower().replace('’', "'").replace("'", '').replace('.', '')
    s = re.sub(r'[-/]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def load_official():
    out = []
    for l in open(OFFICIAL_FILE, encoding='utf-8'):
        l = l.rstrip('\n')
        if l:
            n, _, m = l.partition('|')
            out.append((n, m))
    return out


OFFICIAL = load_official()
_BY_NORM = {norm(n): n for n, m in OFFICIAL}

# older / alternate name -> official name (California context)
ALIASES = {
    'Whimbrel': 'Hudsonian Whimbrel', 'Willet': 'Prairie Willet', 'Great Egret': 'American Egret',
    'Marsh Wren': 'Western Marsh-Wren', 'Cattle Egret': 'Western Cattle-Egret', 'Western Cattle Egret': 'Western Cattle-Egret',
    'House Wren': 'Northern House Wren', 'Barn Owl': 'American Barn Owl', 'Common Barn-Owl': 'American Barn Owl',
    'Northern Goshawk': 'American Goshawk', 'Mew Gull': 'Short-billed Gull', 'Herring Gull': 'American Herring Gull',
    'Warbling Vireo': 'Western Warbling-Vireo', "McCown's Longspur": 'Thick-billed Longspur',
    'Common Moorhen': 'Common Gallinule', 'Clapper Rail': "Ridgway's Rail", 'Gray Jay': 'Canada Jay',
    "Xantus's Murrelet": "Scripps's Murrelet", "Thayer's Gull": 'Iceland Gull', "Le Conte's Thrasher": "LeConte's Thrasher",
    "Le Conte's Sparrow": "LeConte's Sparrow", 'Western Scrub-Jay': 'California Scrub-Jay', 'Scrub Jay': 'California Scrub-Jay',
    'Pacific-slope Flycatcher': 'Western Flycatcher', 'Cordilleran Flycatcher': 'Western Flycatcher',
    'Common Redpoll': 'Redpoll', 'Painted Redstart': 'Painted Whitestart', 'Brown Booby': 'Cocos Booby',
    'Winter Wren': 'Pacific Wren', 'Blue Grouse': 'Sooty Grouse', 'Dusky Grouse': 'Sooty Grouse',
    'Plain Titmouse': 'Oak Titmouse', 'Solitary Vireo': "Cassin's Vireo", 'Rufous-sided Towhee': 'Spotted Towhee',
    'Brown Towhee': 'California Towhee', 'Northern Oriole': "Bullock's Oriole", 'Sage Sparrow': "Bell's Sparrow",
    'Arctic Warbler': 'Arctic/Kamchatka Leaf Warbler', 'Rock Dove': 'Rock Pigeon', 'Lesser Sand-Plover': 'Siberian Sand-Plover',
    'Oldsquaw': 'Long-tailed Duck', 'Green-backed Heron': 'Green Heron', 'Water Pipit': 'American Pipit',
    'Nutmeg Mannikin': 'Scaly-breasted Munia', 'Black-shouldered Kite': 'White-tailed Kite',
    'Whip-poor-will': 'Mexican Whip-poor-will', 'Sage Grouse': 'Greater Sage-Grouse', 'Common Snipe': "Wilson's Snipe",
    'Northwestern Crow': 'American Crow', 'Mountain Plover': 'Mountain Plover', 'Snowy Plover': 'Snowy Plover',
    'Yellow-rumped Warbler (Audubon\'s)': 'Yellow-rumped Warbler', "Audubon's Warbler": 'Yellow-rumped Warbler',
    'Myrtle Warbler': 'Yellow-rumped Warbler', 'Oregon Junco': 'Dark-eyed Junco', 'Red-shafted Flicker': 'Northern Flicker',
    'Blue-throated Hummingbird': 'Blue-throated Mountain-gem', 'Magnificent Hummingbird': "Rivoli's Hummingbird",
    'Green Violetear': 'Mexican Violetear', 'Mongolian Plover': 'Siberian Sand-Plover', 'Black Brant': 'Brant',
    'American Swallow-tailed Kite': 'Swallow-tailed Kite', 'Great Gray Shrike': 'Northern Shrike',
    'Traill\'s Flycatcher': 'Willow Flycatcher', 'Western Marsh Wren': 'Western Marsh-Wren',
    'Bewick\'s Wren': "Bewick's Wren", 'Hutton\'s Vireo': "Hutton's Vireo", 'Common Black-Hawk': 'Common Black Hawk',
    'Rock Sandpiper': 'Rock Sandpiper', 'Fea\'s Petrel': None, 'Pacific Golden Plover': 'Pacific Golden-Plover',
    'Lesser Golden-Plover': 'American Golden-Plover', 'Black-necked Grebe': 'Eared Grebe', 'Gray Partridge': None,
    'Harlan\'s Hawk': 'Red-tailed Hawk', 'Eurasian Teal': 'Green-winged Teal', 'Common Teal': 'Green-winged Teal',
    'Double crested Cormorant': 'Double-crested Cormorant', 'Yellow Warbler (Northern)': 'Yellow Warbler',
    'Northern Yellow Warbler': 'Yellow Warbler', 'Hesperiphona vespertina': 'Evening Grosbeak',
    'American Pipit': 'American Pipit', 'Buff-bellied Pipit': 'American Pipit', 'Canyon Towhee': None,
    'Greater Sage Grouse': 'Greater Sage-Grouse', 'Nuttalls Woodpecker': "Nuttall's Woodpecker",
    'Ladder backed Woodpecker': 'Ladder-backed Woodpecker', 'Timberline Sparrow': "Brewer's Sparrow",
    'Western Gull x Glaucous-winged Gull': None, 'Hoary Redpoll': 'Redpoll', 'Northern Pygmy Owl': 'Northern Pygmy-Owl',
    'Mountain Pygmy Owl': 'Northern Pygmy-Owl', 'Stejnegers Scoter': "Stejneger's Scoter",
    'Greater White fronted Goose': 'Greater White-fronted Goose', 'American Three-toed Woodpecker': None,
    'Juniper Titmouse': 'Juniper Titmouse', 'Common Ground-Dove': 'Common Ground Dove', 'Ruddy Ground-Dove': 'Ruddy Ground Dove',
    'Black-crowned Night-Heron': 'Black-crowned Night Heron', 'Yellow-crowned Night-Heron': 'Yellow-crowned Night Heron',
    'Lawrences Goldfinch': "Lawrence's Goldfinch", 'Spotted Owl': 'Spotted Owl',
}
_ALIAS_NORM = {norm(k): v for k, v in ALIASES.items()}


def to_official(name):
    """Return the official California name for `name`, or None."""
    if not name:
        return None
    n = name.strip()
    n = re.sub(r'^\((?:unid\.\s*)?[^)]*\)\s*', '', n)   # BBS forms: "(Oregon Junco) Dark-eyed Junco"
    k = norm(n)
    if k in _BY_NORM:
        return _BY_NORM[k]
    if k in _ALIAS_NORM:
        return _ALIAS_NORM[k]
    return None


BBS_UNID = {  # BBS "unid." categories that are safe to assign in California
    'unid. Oak Titmouse / Juniper Titmouse': 'Oak Titmouse',
}
