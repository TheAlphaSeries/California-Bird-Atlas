# California Bird Atlas

A photography-led website about California's native birds.

- **Public site:** Home (the cover), This Season (each region's nine birds and the scoring), the Bird Wall
  (everyone's birds, cut out on black, with credits), All Birds (all 696 species with each bird's level by region
  and season), How It Works, Send a photo, and My Wall (a private wall kept only in the visitor's browser).
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

- **Add your own birds:** signed in, press **Add birds** (top right). Drop in any number of photos; each is cut out
  automatically, the bird's name is guessed from the file name when it can be, and you can touch up any cut-out.
  **Publish** puts them on the wall at once, credited to the name you enter (remembered on that device).
  Sign-in lasts a year per device.
- **Review submissions:** sign in → **Tools** → **Review**. Open a photo, check the bird and the credit, choose
  **Cut out the bird** (the background is removed automatically; adjust the cut-off or paint with Erase and Restore),
  then **Publish to the wall**. Featured birds show first.

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

## The nine birds

Each region gets nine new birds every two weeks: six cards a season (five of two weeks, the last running to the end of
the season). The draw is in `public/js/rotation.js`: each level's eligible birds are shuffled once per season with a
generator seeded by season, year and region, then dealt out three at a time, with no repeats until every bird has had a
turn and a mix of families on every card. Everyone in a region sees the same birds, every year is different, and
upcoming cards stay hidden. To check the draw, run `node tools/check-rotation.mjs`.

## Reference photos

So people know what each bird looks like, every bird can show a reference photo until a real one is published:
the lead photo of its Wikipedia article (looked up by scientific name, then English name), kept only if it is on
Wikimedia Commons under an open licence (public domain, CC0, CC BY or CC BY-SA). The photographer, licence and a link
to the original are shown with it, and it is always labelled "Reference photo". Images are linked from Wikimedia,
not stored here.

- **Load them:** Review → **Load missing photos** (about 10 minutes for all 696; keep the tab open).
- **Wrong photo:** visitors press **Wrong photo? Tell us** and pick a reason. Reports collect under Review →
  **Photo reports**, where you can keep the photo, remove it, or pick a replacement from a grid of openly licensed
  Commons photos of that species. Signed in, the same button on a bird page reads **Change photo**.

## Sample birds

Until community photos arrive, **Review → Fill with sample birds** puts about 35 California birds on the wall. Each
is the lead photo from the bird's Wikipedia article (always freely licensed on Wikimedia Commons). Your browser
fetches it, cuts it out and uploads it with the photographer's name, the licence and a link to the original.
Photos under licences that aren't open enough are skipped. **Remove sample birds** takes them all off in one step
and leaves real submissions alone. Any sample can also be re-cut, edited or deleted on its own in Review.

## Cut-outs

Backgrounds are removed in the browser, on the editor's or visitor's own device, with the U^2-Net small model
(`public/models/u2netp.onnx`, Apache License 2.0) run by ONNX Runtime Web (`public/vendor/ort/`, MIT). Nothing is
sent to another service. The first cut-out on a device downloads about 20 MB, once.

## Submissions

Anyone can send a photo: the bird, the name to credit, an optional private email, the region, and three
confirmations (they took it, no bait or nest disturbance, permission to publish with credit). Location data is
stripped in the browser before upload, and where a photo was taken is never asked for. Each visitor can send 12 a day,
and the queue holds at most 1,000 waiting photos. Submissions and their photos are included in the Export backup.

Photos are stored in the D1 database until R2 is enabled (see below). D1 is fine for hundreds of photos; turn on R2
before it holds thousands.

## Not built yet

- Member accounts, star ratings and the leaderboards. Scoring rules are published on This Season, but nothing
  records points yet.
- Bot protection on the submission form (Cloudflare Turnstile) if spam appears.
- Season timing from open data (the CC BY eBird Observation Dataset on GBIF).
- Keeping full-resolution originals: enable R2, create a bucket named `california-bird-atlas-photos`, and uncomment
  the `r2_buckets` block in `wrangler.jsonc`.

## Run locally

    npm install
    cp .dev.vars.example .dev.vars
    npm run dev
