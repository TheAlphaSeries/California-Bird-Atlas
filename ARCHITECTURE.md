# How California Bird Atlas is built

A reference for whoever works on the site next. Day-to-day use is in `README.md`.

## The short version

- **Hosting:** one Cloudflare Worker (`src/worker.js`) plus static files (`public/`). Pushing to `main` on GitHub deploys it.
- **Database:** Cloudflare D1 (SQLite). Photos are stored in D1 too until R2 is switched on in `wrangler.jsonc`.
- **Front end:** plain JavaScript modules, no framework and no build step. What is in `public/` is what the browser gets.
- **Checks:** `npm run check` validates the data files, stress-tests the bird draw and syntax-checks every script.

## Where things live

| Path | What it is |
|---|---|
| `src/worker.js` | The API and image routes. Its header comment lists every table and route. |
| `src/seed.json` | The 696 species, loaded into the database the first time it starts. |
| `public/index.html` | The page shell: menu bar, footer, fonts. |
| `public/js/app.js` | Routing and the menu. Its header explains how to add a page. |
| `public/js/views/` | One file per page. |
| `public/js/wi.js` | Loads the field guide data. Its header documents the data's shape. |
| `public/js/rotation.js` | Draws the nine birds for each two-week assignment. |
| `public/js/clip.js` | The in-browser cut-out tool. |
| `public/js/refphoto.js`, `refpick.js` | Reference photos, reader reports, and the editor's replacement picker. |
| `public/js/samples.js` | "Fill with sample birds" (fetches from Wikimedia Commons in the editor's browser). |
| `public/css/atlas.css` | Styles for the editor's tool pages. |
| `public/css/magazine.css` | Styles for every public page. Its header explains the layout. |
| `public/data/wildindex.json` | The field guide: every bird's levels by region and season. Generated; do not edit by hand. |
| `public/data/wall-samples.json` | The 14 built-in sample birds shown while the wall is empty. |
| `public/_headers` | Caching rules for static files. |
| `tools/wildindex/` | The scripts and source tables that produce `wildindex.json`. |
| `tools/check-data.mjs`, `check-rotation.mjs` | The checks behind `npm run check`. |

## The two kinds of bird data

The site keeps bird information in two places, joined by **common name**:

1. **The field guide** (`public/data/wildindex.json`): fixed reference data. Plate number, family, category, and a level for each of 7 regions in each of 4 seasons. It changes only when the levels are revised, by rerunning `tools/wildindex/export_site_data.py`.
2. **The database** (`species` table): things that change while the site runs. Reference photo links, the editor's notes, and which photos and sightings belong to each bird.

In the browser these are `wi()` (field guide) and `S.species` (database). `S.spByName` and `dbSpecies(bird)` join them. `npm run check` fails if the two lists of names ever differ.

## Levels, regions and seasons

- Regions, always in this order: `BAY, NC, CV, SN, CC, SC, DES`.
- Seasons: `W` winter (from 1 Dec), `P` spring (1 Mar), `S` summer (1 Jun), `F` fall (1 Sep), on the California calendar.
- A bird's levels are four 7-character strings, one per season, one character per region: `1` easy, `2` takes a trip, `3` hard, `-` not dependable. Read them with `levelOf(bird, regionIndex, season)`.
- Categories (`cat`): `assign` can be drawn for an assignment; `scarce`, `rare`, `night`, `offshore` score but are never assigned; `sensitive` and `introduced` never score.

## The nine birds

Nothing about an assignment is stored. `rotation.js` recomputes it from the season, year and region, so every visitor gets the same nine and there is nothing to keep in sync. A season has six assignments (five of two weeks, then one to the season's end). Each level's eligible birds are shuffled once per season with a seeded generator and dealt three at a time.

## The Bird Wall

Every bird on the wall is a row in `submissions`, whatever its source:

| Source | How it arrives | `status` | `sample` |
|---|---|---|---|
| A reader | Send a photo (`POST /api/submissions`) | `pending`, until published in Review | 0 |
| The editor | Add birds (`POST /api/wall`) | `approved` at once | 0 |
| Sample fill | Review, "Fill with sample birds" | `approved` | 1 |

A bird shows on the wall when it is `approved` and has a cut-out. Each has three image files: `thumb`, `display` (2,560 px at most) and `cutout`. While the table has no approved birds, the wall shows the static samples in `wall-samples.json` instead.

## Privacy rules built into the code

- The region is chosen by the reader and kept in their browser. Nothing about location is collected.
- Photos are re-encoded in the browser before upload, which removes embedded location data.
- Visitors never receive coordinates, place names or notes (`publicPhoto`, `publicObs` in the worker).
- Only the editor's signed session cookie allows changes. There is no other way in.

## Known limits

- **Styles are layered.** `magazine.css` was restyled several times, and later rules override earlier ones. Unused rules have been removed, but the overrides have not been folded together. It works and is documented; a full rewrite would be a tidy-up, not a fix.
- **Photo storage.** D1 is fine for hundreds of wall birds. Switch on R2 (see `wrangler.jsonc`) before thousands.
- **No accounts.** Points, ratings and leaderboards are described on the site but not recorded yet.
- **Spam.** The submission form is limited to 12 photos a day per visitor and nothing more.
- **The old Gallery page** (`/gallery`) still works but is not in the menu.
