# Hineni — tour company website

A cinematic, single-page safari site built from the group's own trip media
(Murchison Falls, July 2026 · Fort Portal & Queen Elizabeth NP, September 2026).

## Run it

```bash
npm install
npm run dev        # the site at http://localhost:5188 (admin portal at /admin)
npm run server     # the admin API on :8787, needed for /admin in dev (run it alongside `npm run dev`)
npm run build      # production build in dist/
npm start          # production: the site, /admin and the API from one Node process (PORT, default 8787)
```

## Admin portal: updating the photos

Admins sign in at **/admin** and change the website's photos without touching code or rebuilding:

- **Album photos**: upload photos (drag and drop, from a computer or a phone) into a trip, write captions,
  set what they show (wildlife / landscapes / people), move them between trips, remove them from the website
  and put them back. Uploads are turned into 900/1600/2000/2800 px WebP; the date the photo was taken comes
  from the camera, and location data is stripped. Removed photos also leave the map.
- **Spots on the page**: choose the photo for every fixed spot (the hero slides and their captions, the trust
  card, trip cards and itinerary days, experiences, the About portrait), from the album or a fresh upload.
  "Back to the original" undoes a change.
- **Trips**: rename a trip or change its month, and add new trips; each trip is a chapter of the album.

Changes show on the website at the next page load: the page fetches them from `GET /api/site` before it renders
(`src/lib/site.js`). Without the server (a plain static host, or the API down), the site shows exactly what's in
the code.

**Accounts** (passwords are stored as scrypt hashes):

```bash
npm run admin -- add amina      # create an admin, or set a new password (asks for it)
npm run admin -- remove amina   # signed out at their next click
npm run admin -- list
```

On a brand-new server you can instead set `ADMIN_USER` / `ADMIN_PASSWORD` once; the first account is created
from them if none exist (then remove them). For local development, `.env` holds a test account (`dev`).

**Where things live**: everything admins change is in the data folder: the Railway volume in production,
`storage/` locally (or `DATA_DIR`). It holds `site.json` (the changes), `uploads/` (the photos), `media/` (the
site's own photos and clips, on Railway), `admins.json`, `sessions.json`, and `history/` (the last 100 versions of
`site.json`; copy one back over `site.json` and restart to undo). The repository's own photos and `src/data/*.js`
are never modified.

## Deploying on Railway

Everything runs inside one Railway service: the site, `/admin`, the API, and a **volume** that holds the
uploads, the accounts and the site's own media. Deploys carry only the code (about 5 MB, see `.railwayignore`);
the 400 MB of photos and clips are pushed to the volume once, through the admin API.

The repo is set up for it: `Dockerfile` (Node 22, builds the pages, runs `server/index.mjs`) and `railway.json`
(health check `/api/health`, restart on failure, and **refuses to deploy without a volume at `/data`**). The
server finds the volume itself (`RAILWAY_VOLUME_MOUNT_PATH`) and trusts Railway's HTTPS proxy, so sign-in
cookies are Secure.

First time, from this folder:

```bash
railway login                             # opens the browser
railway init                              # create the project (or `railway link` to an existing one)
railway up                                # first deploy creates the service; it fails until the volume exists
railway volume add --mount-path /data     # the volume (Hobby: 5 GB, room for thousands of photos)
railway variable set ADMIN_USER=amina     # the first admin's name…
railway variable set ADMIN_PASSWORD --stdin   # …and password (typed, not left in your shell history)
railway domain                            # a public *.up.railway.app address (or `railway domain example.com`)
railway up                                # deploy again, now with the volume
npm run push-media -- https://<your-app>.up.railway.app   # copy the site's photos and clips to the volume
```

Then sign in at `https://<your-app>.up.railway.app/admin`, remove the `ADMIN_PASSWORD` variable
(`railway variable delete ADMIN_PASSWORD`), and turn on **daily backups** for the volume in the dashboard
(service → Volume → Backups).

`push-media` asks for the admin name and password, sends only what's missing or changed (safe to stop and
rerun), and is how new media from `npm run media` reaches the live site. More admins: `railway ssh`, then
`npm run admin -- add <name>`. A local copy of everything on the volume: `railway volume files download / ./backup`.

After that, deploying code changes is just `railway up` (or connect the GitHub repo in the dashboard for
deploys on push). Photos and admin changes stay on the volume across deploys. Railway runs one instance when a
volume is attached, so a deploy has a few seconds of downtime while the new version starts.

Other hosts work too: any Node 22 host with a persistent disk (`DATA_DIR`), running
`npm ci && npm run build && npm start` behind HTTPS with `TRUST_PROXY=1`. A static host can serve the site but
not the portal. See `.env.example`.

**Security**: sign-in is rate-limited (5 failures → 15 min wait); sessions are HttpOnly, SameSite=Strict cookies
lasting 12 hours; every change also needs a header other sites can't send; captions are stored as plain text;
uploads must decode as JPEG / PNG / WebP of at least 1000 px (40 MB max). HEIC from desktops isn't supported
(iPhones convert to JPEG when uploading from the browser).

Not editable from the portal (still in code): the map's web photos, the manifesto's inline photos, the guest
stories' photos and all video clips.

## What's on the page

| Section | What it does |
|---|---|
| Preloader | Counts real asset loading (fonts + first hero clip), then a curtain wipe |
| Hero | Full-screen slideshow of the best photos (landscape set on desktop, portrait set on phones), shown as real images at full resolution with a crossfade and gentle zoom; arrows, thumbnails, swipe and keyboard. Real guest faces above the fold. |
| Manifesto | Words light up as you scroll, with inline photo "pills" |
| The Game | Pinned viewfinder sequence (REC, live timecode, GPS): lion, leopard, hyena, tusker, croc, buffalo, giraffe, hippo — hard cuts, flash frames, camera shake |
| The Route | Procedural 3D model of the Albertine Rift from real coordinates (Rwenzori, Lake Albert, the Nile & Murchison Falls, crater lakes, Equator). Scroll flies the camera stop to stop while the route draws itself. |
| Who we are | The "Hineni = here I am" story with real group photos |
| Experiences | Filterable grid of 12 experiences; "+ Add to my trip" carries picks into the booking form; clips play on hover |
| Field notes | Guide knowledge (expertise proof) |
| The album | The home of every photo (111 in `src/data/photos.js`, plus what admins upload): scroll flies a 3D tunnel through them, a chapter per trip in the order the trips ran, photos in the order they were taken. Stop and the nearest photo comes forward with its caption and date; click flies it into full view. Trip chips filter it; "Grid view" opens the same photos as a filterable wall. Photos elsewhere are doors in: trip cards ("See all N photos"), experiences, itinerary days and the map's place photos open the album at that photo, with a "Back to …" button. |
| Trips | Both real itineraries as tabs, sticky photo that wipes between days |
| Guest stories | Fear → moment testimonials (**currently samples — see below**) |
| Questions | Every "silent question" answered before booking |
| Enquire | Form that opens a pre-filled email, with a WhatsApp fallback |

Sound is off by default; the "Sound" toggle unmutes the hero and Game clips.
The film button plays the "Hineni Final" edit.

## Before going live — please replace

All copy is in `src/data/content.js`.

1. **Contacts** — `brand.email`, `brand.whatsapp`, `brand.phone` are placeholders.
2. **Guest stories** — the three `stories` entries are marked `sample: true`. They show with a red
   "Sample" badge in dev and are **hidden in production builds** until you replace them with real
   guests' words (the fear they had, and the moment it disappeared) and set `sample: false`.
3. **Policies in the FAQ** — check the answers about payment, cancellation and what's included
   match how you actually operate.
4. **Park fees** — figures came from UWA reporting in Oct 2026; re-check before quoting.
5. **Brand name** — the site assumes the company is called *Hineni* (from the film and album names).
6. **Web photos** — 23 credited Wikimedia Commons photos stand in for map places we haven't been to
   (see below). They're all licensed for commercial use with credit; swap in your own when you can.

## Media pipeline

Photos and clips come straight from the shared Google Photos albums.

```bash
node tools/fetch-album.mjs "<shared album url>" album3   # list every item in an album
node tools/contact-sheets.mjs album3                       # numbered contact sheets to pick from
# add picks to data/selection.json  ({ key, album, i, alt })
npm run media                                              # download + optimise photos, fetch clips
node tools/build-hq.mjs                                    # photos at near-original resolution (900/1600/2000/2800 px, colours untouched)
node tools/trim-videos.mjs                                 # cut each clip to its best seconds (TRIM table)
```

`tools/video-strips.mjs` makes filmstrips of clips to choose trim points.

### Photos of places we haven't been to yet

Places on the map with no photos of our own can show openly licensed photos from Wikimedia Commons
(CC BY / CC BY-SA / CC0 only). The map credits the photographer,
licence and source, as the licences require — keep that credit wherever one is shown.

```bash
node tools/web-photo-candidates.mjs   # search Commons per place → data/web-sheets/<place>.jpg contact sheets
# pick by eye; set PICKS (and short captions in ALT) in tools/web-photos.mjs
node tools/web-photos.mjs             # download, build w-*.webp, write credits to src/data/web-photos.json
# then list the keys on the place in content.js:  web: ['w-saaka', ...]
```

Replace a web photo with your own as soon as you have one: add it to the place's `photos`, and the map
stops showing the web one.

## The 3D route map (real terrain)

The map is built from real data, not drawn by hand:

- **Elevation** — SRTM via [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles) (Terrarium PNG)
- **Imagery** — [Sentinel-2 cloudless 2016](https://s2maps.eu) by EOX IT Services GmbH, CC BY 4.0

```bash
node tools/fetch-terrain.mjs     # downloads tiles (cached in data/tile-cache), writes public/terrain/
```

It produces one regional map (Kampala → Rwenzori) plus high-detail patches for **Fort Portal**
(4096 px, ~13 m per pixel), **Murchison Falls** and **Queen Elizabeth NP**. Regions, zoom levels and
texture sizes are at the top of the script; stops, camera angles (`heading`, `shot`) are in
`src/data/content.js`. `tools/grid-crop.mjs` renders any region with a lat/lon grid for placing pins.

The routes are real roads too. `routeTrips` in `src/data/content.js` holds the trips and their stops;

```bash
node tools/fetch-routes.mjs      # roads (OSRM), districts, towns, rivers, parks (OpenStreetMap) → public/terrain/routes.json
```

routes every leg on OpenStreetMap (ferries and the Nile boat legs included), then walks each route to find
the districts, national parks, towns, rivers and Equator crossings on the way, each at its km from Kampala.
Each trip can also list **stopovers** on a leg (`leg.stopovers`: planned pauses — the road is routed
through them and the drive pulls in for a few seconds) and **sights** (`sights`: attractions near the road,
shown with their distance off it and whether they're an add-on). Guides should confirm the stopovers.
The map drives the vehicle along that geometry: the odometer, the "Now in … District" line and the list of
places passed all come from this file. Rerun it whenever a stop moves. Responses are cached in `data/route-cache`.
`fetch-terrain.mjs` needs `sharp` (`npm i --no-save sharp`).

Beyond the three trips, the map has **Explore a region** (drive around every place in an area, e.g. all of
Fort Portal) and **Build your own** (tick any places — pre-ticked from "Add to my trip" on the experiences —
and it drives from Kampala to them in the best order, then hands the route to the enquiry form). Both use
the `places` catalogue in `src/data/content.js`: every place, its region, and our own photos of it (only
photos we know were taken there; places without any say so on the map). The roads between places come from

```bash
node tools/fetch-network.mjs     # road links between neighbouring places + districts/towns → public/terrain/network.json
```

Rerun it after adding or moving a place.

All of these data sources require the credit line shown at the bottom of the map — keep it. EOX now also sells
a separate commercial licence for its imagery; for a commercial site it's worth confirming with EOX
that the 2016 CC BY layer covers your use.
Raw downloads are kept in `data/raw-video/` (not needed for the site).
