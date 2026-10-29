// The photo catalogue: every trip photo on the site, tagged once with what it shows.
// The trip comes from the key (m- Murchison, b-/y- Moyo & Mt. Buce, r- Uganda Reptiles Village, no prefix
// Fort Portal & Queen Elizabeth)
// and the orientation from the file, so adding a photo is one line here.
// Order matters: the "Every photo" gallery shows them in this order, strongest first.
// Admins add trips and photos, re-tag and remove them from the admin portal; applyAlbum() layers
// those changes on at start-up (see src/lib/site.js).
import { photoMeta } from '../lib/media.js';

export const photoTrips = [
  { id: 'murchison', label: 'Murchison Falls' },
  { id: 'reptiles', label: 'Uganda Reptiles Village' },
  { id: 'fortportal', label: 'Fort Portal & Queen Elizabeth' },
  { id: 'moyo', label: 'Moyo & Mt. Buce' },
];
// The album's chapters: one per trip, in the order the trips ran. Photos within a chapter run in the order they were taken.
// `start` (year-month) keeps the chapters in date order when admins add a trip.
export const albumChapters = [
  { trip: 'moyo', title: 'Moyo & Mt. Buce', when: 'May 2026', start: '2026-05' },
  { trip: 'murchison', title: 'Murchison Falls', when: 'July 2026', start: '2026-07' },
  { trip: 'reptiles', title: 'Uganda Reptiles Village', when: 'July 2026', start: '2026-07' },
  { trip: 'fortportal', title: 'Fort Portal & Queen Elizabeth', when: 'September 2026', start: '2026-09' },
];
export const photoTypes = [
  { id: 'wildlife', label: 'Wildlife' },
  { id: 'land', label: 'Landscapes' },
  { id: 'people', label: 'People & moments' },
];

const TAGS = `
  m-elephant-face wildlife    crater-sweep land          crater-crew people         b-edge-nile land
  lioness wildlife            m-falls-head land          y-arms-nile people         m-group-boat people
  m-giraffes-dusk wildlife    rwenzori land              falls-joy people           b-ridges-nile land
  leopard wildlife            pink-valley land           b-summit-joy people        elephant-euphorbia wildlife
  m-top-sign people           falls-curtain land         m-croc wildlife            y-dusk-hills land
  kob-dawn wildlife           equator-couple people      storm-sunset land          b-dance people
  hippo-head wildlife         m-hyena wildlife           flowers-lake land          m-friends people
  y-ferry-sunset land         buffalo-herd wildlife      m-falls-top land           y-fire people
  fish-eagle wildlife         live-band people           b-panorama land            m-elephants-acacia wildlife
  lion-male wildlife          m-sunrise-roof people      crater-dusk land           b-summit-crew people
  elephants-bank wildlife     m-falls-cliff land         y-nile-smile people        leopard-2 wildlife
  b-elder-nile land           ridge-joy people           m-giraffes wildlife        y-canoe land
  elephants-kazinga wildlife  m-photographer people      y-ferry-clouds land        falls-dance people
  m-croc-tree wildlife        b-village-trail people     mirror-lake land           kob-herd wildlife
  y-grass-cow land            m-gate-dance people        lioness-rest wildlife      falls-wide land
  b-grin people               m-elephant-nile wildlife   hills-tree land            y-grill people
  buffalo-egret wildlife      m-arms-falls people        crater-reflect land        b-cheer people
  elephant-line wildlife      y-roadstop people          mountains land             m-laugh-1 people
  m-kob-palms wildlife        b-hat-nile people          kazinga-clouds land        hippo-water wildlife
  y-mangoes people            sunrays land               m-hartebeest wildlife      rim-hikers people
  lioness-vehicle wildlife    crater-summit land         m-laugh-2 people           elephant-mist wildlife
  euphorbia-plain land        y-nile-dusk people         buffalo-stare wildlife     deck land
  m-sunrise-guest people      hippo-wallow wildlife      lone-tree land             m-van-laugh people
  waterbuck wildlife          crater-storm land          m-excited people           elephant-pair wildlife
  dawn-savannah land          arms-lake people           hippo-side wildlife        acacia land
  m-ranger people             cruise-buffalo wildlife    sunset-figure land         rainforest land
  salt-lake land              cave land                  equator land               town land
  van-road land               safari-4x4 land            falls-dark land
  r-chameleon-smile people    r-chameleon wildlife       r-snake-hands people       r-tortoise wildlife
  r-gate land                 r-snake-hooks people       r-tortoise-lift wildlife   r-planting people
  r-mamba people              r-path land                r-seedling people          r-group people
  r-kneel people              r-sunset land
`;

const tripByKey = (key) => (key.startsWith('m-') ? 'murchison' : /^[by]-/.test(key) ? 'moyo' : key.startsWith('r-') ? 'reptiles' : 'fortportal');
const entry = (key, type, trip) => {
  const meta = photoMeta(key) || { w: 3, h: 2 };
  return { key, type, trip, orient: meta.w > meta.h ? 'wide' : meta.w < meta.h ? 'tall' : 'square' };
};

export const catalogue = TAGS.trim().split(/\s+/).reduce((out, word, i, all) => {
  if (!(i % 2)) out.push(entry(word, all[i + 1], tripByKey(word)));
  return out;
}, []);
export const tripOf = (key) => catalogue.find((p) => p.key === key)?.trip ?? tripByKey(key);

// The admin portal's changes. Arrays change in place, so every module that imported them sees the result.
export function applyAlbum({ trips = {}, photos = {}, edits = {}, hidden = [] }) {
  for (const [id, t] of Object.entries(trips)) {
    let ch = albumChapters.find((c) => c.trip === id);
    if (!ch) albumChapters.push((ch = { trip: id }));
    if (!photoTrips.some((p) => p.id === id)) photoTrips.push({ id, label: t.title });
    for (const k of ['title', 'when', 'start']) if (t[k]) ch[k] = t[k];
    if (t.title) photoTrips.find((p) => p.id === id).label = t.title;
  }
  albumChapters.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  for (const [key, p] of Object.entries(photos)) if (!catalogue.some((c) => c.key === key)) catalogue.push(entry(key, p.type, p.trip));
  for (const c of catalogue) {
    const e = edits[c.key];
    if (e?.type) c.type = e.type;
    if (e?.trip) c.trip = e.trip;
  }
  // removed photos go; so would a photo whose trip isn't in the album (the server won't delete a trip that has photos)
  const gone = new Set(hidden);
  for (let i = catalogue.length - 1; i >= 0; i--) {
    if (gone.has(catalogue[i].key) || !albumChapters.some((c) => c.trip === catalogue[i].trip)) catalogue.splice(i, 1);
  }
}

// Dev-only guard for the rule "each photo has one job": warns when a photo is used twice
// in the selling sections (hero, trips, experiences, about, notes, itinerary days).
export function checkRepeats(uses) {
  const seen = {};
  uses.forEach(([key, where]) => key && (seen[key] ||= []).push(where));
  Object.entries(seen).filter(([, w]) => w.length > 1)
    .forEach(([key, w]) => console.warn(`[photos] "${key}" is used ${w.length}×: ${w.join(', ')}`));
}
