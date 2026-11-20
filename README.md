# California Bird Atlas

A photography-led website about California's native birds.

- **Public site:** Cover, Gallery, Fieldwork (this season's assignment and scoring), The Index (all 696 species
  on the official state list, with each bird's level by region and season), and About.
- **Owner tools,** behind a password: the atlas (field guide, life list, observation journal, explore, photo
  archive, editable catalog), photo uploads, and the cover editor.

It runs on Cloudflare: one Worker (`src/worker.js`) serves the pages in `public/` and an API, with a D1 database
for records and photos. There is no build step.

## Go live (Cloudflare dashboard, about 10 minutes)

The D1 database `california-bird-atlas` already exists in your Cloudflare account, and `wrangler.jsonc` points at it.
The tables and the species list are created automatically the first time the site is opened.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → choose
   `TheAlphaSeries/California-Bird-Atlas`.
2. Leave the build command empty. Set the deploy command to `npx wrangler deploy`. Deploy.
3. Open the new Worker → **Settings** → **Variables and Secrets** → **Add** → type **Secret**,
   name `ADMIN_PASSWORD`, value a long passphrase. Deploy again if asked.
4. Open the address shown on the Worker page (it ends in `.workers.dev`). Choose **Sign in**.

From then on, every push to this repository redeploys the site automatically.

Dashboard labels change from time to time; the names above may differ slightly.

### Your own domain (optional)

Buy a domain (Cloudflare Registrar works), then Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain**.

## Day to day

- **Add a bird photo:** sign in → **Add observation** → choose the bird, attach the photo, set **Visibility** to
  **Public**. It appears in the Gallery and on the bird's page in The Index.
- **Change the cover:** sign in → Cover → **Edit cover**. Pick any public photo, then edit the cover lines, season,
  headline and notes. Photos on a black or very dark background work best.
- **Owner tools:** once signed in, **Tools** in the top menu opens the atlas.
- **Back up:** Tools → Settings → Export.

## Privacy

Visitors never see exact locations. The API removes coordinates, place names, notes, original file names and GPS
data read from photo files from everything it sends to anyone who is not signed in. Only the county shows.
Uploaded display copies are re-encoded in the browser, which drops the camera's GPS data from the image itself.

## Data

- `public/data/wildindex.json` holds the regional levels, the trial assignment cards and the scoring values that
  the public pages read. It is written by `tools/wildindex/export_site_data.py` from `tools/wildindex/v2.json`.
- `tools/wildindex/` keeps the regional table's sources and build scripts as they were run on 19 November 2026
  (official list, ratings, corrections, picker). Their file paths point at the workspace they were built in and
  need adjusting before they are run again.
- `src/seed.json` fills an empty database: 696 species from the California Bird Records Committee list
  (updated 27 October 2026). It is not reapplied to a database that already holds species.
- Regional levels are editorial estimates, checked against the USGS Breeding Bird Survey, National Park Service
  species lists and Audubon Christmas Bird Count results. See the Rules sheet of the regional table for details.

## Not built yet

- Member accounts, public photo submissions, star ratings and the leaderboards. Scoring rules are published on
  the Fieldwork page, but nothing records points yet.
- Season timing from open data (the CC BY eBird Observation Dataset on GBIF).
- Keeping full-resolution originals: enable R2, create a bucket named `california-bird-atlas-photos`, and uncomment
  the `r2_buckets` block in `wrangler.jsonc`.

## Run locally

    npm install
    cp .dev.vars.example .dev.vars
    npm run dev
