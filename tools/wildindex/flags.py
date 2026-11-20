"""Exclusions, protection status, look-alikes, field notes and photo scores for the v2 table."""
OWL = 'Owl (roosts and nests are easily disturbed)'
SENSITIVE = {
 'American Barn Owl': OWL, 'Flammulated Owl': OWL, 'Western Screech-Owl': OWL, 'Great Horned Owl': OWL,
 'Northern Pygmy-Owl': OWL, 'Elf Owl': OWL, 'Burrowing Owl': OWL, 'Spotted Owl': OWL, 'Barred Owl': OWL,
 'Great Gray Owl': OWL, 'Long-eared Owl': OWL, 'Short-eared Owl': OWL, 'Northern Saw-whet Owl': OWL,
 'Greater Sage-Grouse': 'Display grounds are easily disturbed',
 'Yellow-billed Cuckoo': 'Protected, with very few pairs left',
 'Black Swift': 'Nests at a handful of waterfalls',
 "Ridgway's Rail": 'Protected marsh bird; people use playback to draw it out',
 'Yellow Rail': 'Very rare marsh bird; people use playback to draw it out',
 'Black Rail': 'Protected marsh bird; people use playback to draw it out',
 'Snowy Plover': 'Protected beach nester',
 'Least Tern': 'Protected colony nester',
 'American Goshawk': 'Nests are easily disturbed',
 'Willow Flycatcher': 'Protected, with few pairs left',
 "Bell's Vireo": 'Protected streamside nester',
 'Gray Vireo': 'Small, local population',
 'Bank Swallow': 'Protected colony nester',
 'California Gnatcatcher': 'Protected; people use playback to draw it out',
 "Bendire's Thrasher": 'Candidate for state protection; small population',
 "LeConte's Thrasher": 'Candidate for state protection; thinly spread',
 'Tricolored Blackbird': 'Protected colony nester',
 'California Condor': 'Protected; reintroduction still in progress',
 'Gila Woodpecker': 'Protected; a few hundred pairs in a few towns',
 'Gilded Flicker': 'Protected; nearly gone from California',
}
NIGHT = {'Lesser Nighthawk', 'Common Nighthawk', 'Common Poorwill', 'Mexican Whip-poor-will'}
ISLAND = {'Island Scrub-Jay': 'Santa Cruz Island only (boat trip)'}

# Protection status. State entries: CDFW 2026 status report as reported 14 Nov 2026. Federal entries: 2020 summary.
PROTECTION = {
 'Short-tailed Albatross': 'Federal Endangered',
 'California Condor': 'Federal Endangered; State Endangered',
 "Ridgway's Rail": 'Federal Endangered; State Endangered or Threatened (all three California races)',
 'Least Tern': 'Federal Endangered; State Endangered (California race)',
 'Willow Flycatcher': 'State Endangered; Federal Endangered (southwestern race)',
 "Bell's Vireo": 'State Endangered (both California races); Federal Endangered (Least race)',
 'Snowy Plover': 'Federal Threatened (coastal population)',
 'Marbled Murrelet': 'State Endangered; Federal Threatened',
 'Yellow-billed Cuckoo': 'State Endangered; Federal Threatened (western population)',
 'Spotted Owl': 'State Threatened; Federal Threatened (northern race)',
 'California Gnatcatcher': 'Federal Threatened (coastal race)',
 'California Towhee': 'Inyo race only: State Endangered; Federal Threatened',
 'Savannah Sparrow': "Belding's race (south coast salt marsh) only: State Endangered",
 'Bald Eagle': 'State Endangered',
 'Elf Owl': 'State Endangered', 'Great Gray Owl': 'State Endangered',
 'Gila Woodpecker': 'State Endangered', 'Gilded Flicker': 'State Endangered',
 "Swainson's Hawk": 'State Threatened',
 'Black Rail': 'State Threatened (California race)',
 'Sandhill Crane': 'Greater race only: State Threatened',
 "Scripps's Murrelet": 'State Threatened', 'Guadalupe Murrelet': 'State Threatened',
 'Bank Swallow': 'State Threatened', 'Tricolored Blackbird': 'State Threatened',
 'Greater Sage-Grouse': 'State candidate', 'Burrowing Owl': 'State candidate',
 "Bendire's Thrasher": 'State candidate (2026)', "LeConte's Thrasher": 'State candidate (2026)',
 'Sooty Grouse': 'Mount Pinos race only: State candidate (2026)',
 'Loggerhead Shrike': 'San Clemente Island race only: Federal Endangered',
}
FIELD_NOTE = {
 'Bald Eagle': 'Protected. Stay at least 330 feet from any nest.',
 'Golden Eagle': 'Protected by federal eagle law. Stay well away from any nest.',
 "Swainson's Hawk": 'Protected. Photograph from the road; never approach a nest tree.',
 'Sandhill Crane': 'Use refuge viewing areas; do not walk into roost or feeding fields.',
 'Marbled Murrelet': 'Protected. Photograph from shore only.',
 'Savannah Sparrow': 'On the south coast assign only from fall to spring; summer birds there are the protected race.',
 'Sooty Grouse': 'Sierra and north coast birds only.',
 'Mountain Plover': 'Declining. Stay on the road; flocks flush easily.',
 'Black Skimmer': 'Never approach a nesting colony.', 'Gull-billed Tern': 'Never approach a nesting colony.',
 'Elegant Tern': 'Never approach a nesting colony.', 'Caspian Tern': 'Never approach a nesting colony.',
 "Forster's Tern": 'Never approach a nesting colony.', 'Royal Tern': 'Never approach a nesting colony.',
 'Great Blue Heron': 'Never approach a nesting colony.', 'American Egret': 'Never approach a nesting colony.',
 'Snowy Egret': 'Never approach a nesting colony.', 'Black-crowned Night Heron': 'Never approach a nesting colony.',
 'Purple Martin': 'Few colonies left. Keep back from nest sites.',
 'Virginia Rail': 'No playback.', 'Sora': 'No playback.', 'Least Bittern': 'No playback.', 'American Bittern': 'No playback.',
 'Cactus Wren': 'Coastal birds are few. No playback.', 'Peregrine Falcon': 'Stay well away from nest cliffs.',
 'Prairie Falcon': 'Stay well away from nest cliffs.', 'Osprey': 'Keep back from nest platforms.',
 'White-tailed Kite': 'Protected. Keep back from nest trees.',
 'Vermilion Flycatcher': 'Spreading fast; survey data used for checking predates the spread.',
 'Neotropic Cormorant': 'Spreading; survey data used for checking predates the spread.',
 'Yellow-billed Magpie': 'Found only in California. Absent from the southern San Joaquin Valley.',
 'Costa\'s Hummingbird': 'Level 1 across the desert only in spring.',
}
LOOKALIKE = {
 'Greater Scaup': 'Lesser Scaup', 'Lesser Scaup': 'Greater Scaup', 'Cackling Goose': 'Canada Goose',
 'Snow Goose': "Ross's Goose", "Ross's Goose": 'Snow Goose', 'Tundra Swan': 'Trumpeter Swan',
 'Common Goldeneye': "Barrow's Goldeneye", "Barrow's Goldeneye": 'Common Goldeneye',
 'Western Grebe': "Clark's Grebe", "Clark's Grebe": 'Western Grebe', 'Horned Grebe': 'Eared Grebe', 'Eared Grebe': 'Horned Grebe',
 'Short-billed Dowitcher': 'Long-billed Dowitcher', 'Long-billed Dowitcher': 'Short-billed Dowitcher',
 'Western Sandpiper': 'Least Sandpiper', 'Least Sandpiper': 'Western Sandpiper',
 'Greater Yellowlegs': 'Lesser Yellowlegs', 'Lesser Yellowlegs': 'Greater Yellowlegs',
 'Rufous Hummingbird': "Allen's Hummingbird", "Allen's Hummingbird": 'Rufous Hummingbird',
 "Cooper's Hawk": 'Sharp-shinned Hawk', 'Sharp-shinned Hawk': "Cooper's Hawk",
 'Royal Tern': 'Elegant Tern, Caspian Tern', 'Elegant Tern': 'Royal Tern', 'Common Tern': "Forster's Tern", "Forster's Tern": 'Common Tern',
 'American Herring Gull': 'other large gulls', 'Iceland Gull': 'other large gulls', 'Glaucous-winged Gull': 'Western Gull hybrids',
 'Western Gull': 'Glaucous-winged Gull hybrids', 'California Gull': 'Ring-billed Gull', 'Ring-billed Gull': 'California Gull',
 'Red-throated Loon': 'Pacific Loon', 'Pacific Loon': 'Red-throated Loon, Common Loon',
 'Neotropic Cormorant': 'Double-crested Cormorant', "Brandt's Cormorant": 'Pelagic Cormorant', 'Pelagic Cormorant': "Brandt's Cormorant",
 "Hammond's Flycatcher": 'Dusky, Gray and Western Flycatchers', 'Dusky Flycatcher': "Hammond's and Gray Flycatchers",
 'Gray Flycatcher': 'Dusky Flycatcher', 'Western Flycatcher': 'other small flycatchers',
 "Cassin's Kingbird": 'Western Kingbird', 'Western Kingbird': "Cassin's Kingbird", 'Tropical Kingbird': 'Western Kingbird',
 "Cassin's Vireo": 'Plumbeous Vireo', 'Plumbeous Vireo': "Cassin's Vireo", "Hutton's Vireo": 'Ruby-crowned Kinglet',
 'California Scrub-Jay': "Woodhouse's Scrub-Jay", "Woodhouse's Scrub-Jay": 'California Scrub-Jay',
 'Purple Finch': "House Finch, Cassin's Finch", "Cassin's Finch": 'Purple Finch, House Finch',
 "Bell's Sparrow": 'Sagebrush Sparrow', 'Sagebrush Sparrow': "Bell's Sparrow", "Brewer's Sparrow": 'Chipping Sparrow',
 'Downy Woodpecker': 'Hairy Woodpecker', 'Hairy Woodpecker': 'Downy Woodpecker',
 "Nuttall's Woodpecker": 'Ladder-backed Woodpecker', 'Ladder-backed Woodpecker': "Nuttall's Woodpecker",
 'Red-naped Sapsucker': 'Red-breasted Sapsucker hybrids', 'Black-tailed Gnatcatcher': 'Blue-gray Gnatcatcher',
 'Blue-gray Gnatcatcher': 'Black-tailed Gnatcatcher', 'Crissal Thrasher': 'California Thrasher',
 "Swainson's Thrush": 'Hermit Thrush', 'Hermit Thrush': "Swainson's Thrush", 'American Crow': 'Common Raven', 'Common Raven': 'American Crow',
 'Black-bellied Plover': 'golden-plovers', 'Semipalmated Plover': 'Snowy Plover', 'Black Turnstone': 'Surfbird', 'Surfbird': 'Black Turnstone',
 'Greater White-fronted Goose': '', 'Sooty Shearwater': 'Short-tailed Shearwater',
}
FAMILY_P = {'Anatidae': 2, 'Odontophoridae': 2, 'Phasianidae': 3, 'Podicipedidae': 2, 'Columbidae': 2, 'Cuculidae': 2, 'Caprimulgidae': 3,
 'Apodidae': 3, 'Trochilidae': 2, 'Gruidae': 2, 'Rallidae': 3, 'Recurvirostridae': 1, 'Haematopodidae': 1, 'Charadriidae': 2,
 'Scolopacidae': 2, 'Stercorariidae': 3, 'Alcidae': 3, 'Laridae': 2, 'Phaethontidae': 3, 'Gaviidae': 3, 'Diomedeidae': 3,
 'Oceanitidae': 3, 'Hydrobatidae': 3, 'Procellariidae': 3, 'Sulidae': 3, 'Phalacrocoracidae': 2, 'Threskiornithidae': 2,
 'Pelecanidae': 1, 'Ardeidae': 2, 'Cathartidae': 1, 'Pandionidae': 2, 'Accipitridae': 2, 'Tytonidae': 3, 'Strigidae': 3,
 'Alcedinidae': 3, 'Picidae': 2, 'Falconidae': 2, 'Tyrannidae': 2, 'Vireonidae': 3, 'Laniidae': 2, 'Corvidae': 1, 'Remizidae': 2,
 'Paridae': 2, 'Alaudidae': 2, 'Hirundinidae': 2, 'Aegithalidae': 2, 'Paradoxornithidae': 3, 'Sylviidae': 3, 'Regulidae': 3,
 'Bombycillidae': 2, 'Ptiliogonatidae': 2, 'Sittidae': 2, 'Certhiidae': 3, 'Polioptilidae': 3, 'Troglodytidae': 2, 'Mimidae': 2,
 'Cinclidae': 2, 'Turdidae': 2, 'Motacillidae': 2, 'Fringillidae': 2, 'Calcariidae': 3, 'Passerellidae': 2, 'Icteriidae': 3,
 'Icteridae': 2, 'Parulidae': 3, 'Cardinalidae': 2}
P1 = """Canada Goose;Snow Goose;Ross's Goose;Greater White-fronted Goose;Cackling Goose;Mallard;American Wigeon;Northern Shoveler;Gadwall;
American Coot;Mourning Dove;Greater Roadrunner;Killdeer;Hudsonian Whimbrel;Marbled Godwit;Prairie Willet;Sanderling;Western Gull;California Gull;
Ring-billed Gull;Heermann's Gull;Glaucous-winged Gull;American Herring Gull;Short-billed Gull;Yellow-footed Gull;Glaucous Gull;
Double-crested Cormorant;Brandt's Cormorant;Great Blue Heron;American Egret;Snowy Egret;Black-crowned Night Heron;Red-tailed Hawk;Acorn Woodpecker;
Black Phoebe;Say's Phoebe;Western Kingbird;Cassin's Kingbird;Northern Mockingbird;American Robin;Western Bluebird;House Finch;
White-crowned Sparrow;Golden-crowned Sparrow;Song Sparrow;Dark-eyed Junco;California Towhee;Red-winged Blackbird;Brewer's Blackbird;Great-tailed Grackle"""
P2 = """Pigeon Guillemot;Common Loon;Common Gallinule;Yellow-rumped Warbler;Black-billed Magpie;Yellow-billed Magpie;Clark's Nutcracker;
Woodhouse's Scrub-Jay;California Condor;Bonaparte's Gull;Laughing Gull;Franklin's Gull;Sabine's Gull;Black-legged Kittiwake;Sandhill Crane;
Sooty Grouse;Iceland Gull;Tropical Kingbird;American Barn Owl;Great Horned Owl;Burrowing Owl;Lesser Nighthawk;Common Nighthawk"""
P3 = """White-winged Scoter;Black Scoter;Long-tailed Duck;Harlequin Duck;Mountain Quail;Red-necked Grebe;Calliope Hummingbird;Broad-tailed Hummingbird;
Mountain Plover;Wilson's Snipe;Golden Eagle;Sharp-shinned Hawk;American Goshawk;Broad-winged Hawk;Peregrine Falcon;Prairie Falcon;Merlin;
Pileated Woodpecker;Hammond's Flycatcher;Dusky Flycatcher;Gray Flycatcher;Western Flycatcher;Willow Flycatcher;Pinyon Jay;Pacific Wren;Canyon Wren;
LeConte's Thrasher;Crissal Thrasher;Bendire's Thrasher;Swainson's Thrush;Hermit Thrush;Varied Thrush;Red Crossbill;Grasshopper Sparrow;
Lincoln's Sparrow;Nelson's Sparrow;Swamp Sparrow;Least Bittern;American Bittern"""
def _set(s): return {x.strip() for x in s.replace('\n', '').split(';') if x.strip()}
P1, P2, P3 = _set(P1), _set(P2), _set(P3)
def photo(name, family):
    if name in P1: return 1
    if name in P2: return 2
    if name in P3: return 3
    return FAMILY_P.get(family, 2)
