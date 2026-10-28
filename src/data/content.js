// All site copy lives here so the brand, contacts and trip details can be edited in one place.
// Media keys refer to src/data/media.json (built by `npm run media` from data/selection.json).
// Anything marked `sample: true` is placeholder copy: it shows with a "sample" badge in dev
// and is hidden from production builds until real words replace it.

export const brand = {
  name: 'Hineni',
  meaning: 'Hebrew for “here I am”',
  tagline: 'Uganda, to the world.',
  // the one-line answer to "what is this?" — shown in the hero on every screen size
  offer: 'Small-group safaris and hikes in Uganda — Murchison Falls, Queen Elizabeth, Fort Portal and the West Nile hills. Everything arranged.',
  // TODO: replace with the company's real contacts
  email: 'hello@hineni.travel',
  whatsapp: '256700000000',
  phone: '+256 700 000 000',
  base: 'Kampala, Uganda',
};

export const heroReel = {
  // Landscape clips play on wide screens, portrait clips on phones.
  wide: [
    { key: 'v-hero-water', label: 'Kazinga Channel', note: 'Elephants & buffalo at the water' },
    { key: 'v-m-falls-wide', label: 'Murchison Falls', note: 'The Nile through a 7-metre gap' },
    { key: 'v-hero-elephant', label: 'Kasenyi Plains', note: 'Bull elephant, 06:41' },
    { key: 'v-m-croc', label: 'Victoria Nile', note: 'Nile crocodile, Paraa' },
    { key: 'v-hero-storm', label: 'Crater Lakes', note: 'Storm rolling in at dusk' },
    { key: 'v-m-falls-chasm', label: 'Top of the Falls', note: 'Forty-three metres down' },
  ],
  tall: [
    { key: 'v-m-tusker', label: 'Victoria Nile', note: 'Tusker coming down to drink' },
    { key: 'v-m-hyena-road', label: 'Buligi Plains', note: 'Hyenas on the track at dawn' },
    { key: 'v-elephants-drink', label: 'Kazinga Channel', note: 'The herd at noon' },
    { key: 'v-m-falls-mist', label: 'Murchison Falls', note: 'From the boat' },
    { key: 'v-lake-pan', label: 'Crater Lakes', note: 'The winding lake' },
  ],
  // Hero slideshow: seven of the strongest photos, every trip represented, alternating
  // animals, places and people. Landscape picks on wide screens, portrait picks on phones.
  // These photos aren't reused in the trips, experiences or itinerary below (the dev console warns if they are).
  // `focus` nudges the crop (0–1 across, 0–1 down).
  slides: {
    wide: [
      { photo: 'elephants-bank', title: 'Kazinga Channel', place: 'Elephants coming down to drink' },
      { photo: 'm-falls-cliff', title: 'Murchison Falls', place: 'The whole Nile through a 7-metre gap' },
      { photo: 'lioness', title: 'Kasenyi Plains', place: 'Lioness on the morning drive', focus: [0.45, 0.55] },
      { photo: 'crater-sweep', title: 'Lake Kyaninga', place: 'Crater-rim walk, Fort Portal' },
      { photo: 'm-croc', title: 'Victoria Nile', place: 'Five metres of crocodile' },
      { photo: 'b-edge-nile', title: 'Mt. Buce', place: 'The Albert Nile from the border hills' },
      { photo: 'y-arms-nile', title: 'The Albert Nile', place: 'Arms wide at the Laropi landing', focus: [0.4, 0.55] },
    ],
    tall: [
      { photo: 'm-elephant-face', title: 'Victoria Nile', place: 'A tusker at the water\'s edge' },
      { photo: 'b-ridges-nile', title: 'Mt. Buce', place: 'The Nile winding below the ridges' },
      { photo: 'kob-dawn', title: 'Kasenyi Plains', place: 'Uganda kob at pink dawn' },
      { photo: 'falls-joy', title: 'Nyakasura Falls', place: 'Arms wide, soaked through' },
      { photo: 'm-giraffes-dusk', title: 'Buligi Plains', place: 'Rothschild\'s giraffes at dusk' },
      { photo: 'flowers-lake', title: 'The crater lakes', place: 'Wildflowers on the rim' },
      { photo: 'm-hyena', title: 'Buligi Plains', place: 'Spotted hyena, first light' },
    ],
  },
  // Real faces above the fold
  faces: ['m-laugh-1', 'm-laugh-2', 'm-friends'],
  trustPhoto: 'm-group-boat',
};

// The wildlife: one card per sighting. `key` is a clip (played on request), `photo` a still.
export const game = [
  { photo: 'lioness', word: 'Lion', kicker: '01 — The pride', time: '09:31', geo: '0°04′S 30°02′E', place: 'Kasenyi Plains, Queen Elizabeth NP', note: 'Lionesses working the kob grounds at first light.' },
  { key: 'v-leopard', word: 'Leopard', kicker: '02 — The ghost', time: '08:37', geo: '0°05′S 30°01′E', place: 'Kasenyi Plains, Queen Elizabeth NP', note: 'Rosettes in the grass. Gone in a breath.', outline: true },
  { key: 'v-m-hyena-road', word: 'Hyena', kicker: '03 — The clan', time: '07:40', geo: '2°17′N 31°26′E', place: 'Buligi, Murchison Falls NP', note: 'Two of them, lying in the road, waiting for us.' },
  { key: 'v-m-tusker', word: 'Six tonnes', kicker: '04 — Right of way', time: '14:52', geo: '2°16′N 31°36′E', place: 'Victoria Nile', note: 'A tusker walks down to drink. Engines off. Nobody speaks.' },
  { key: 'v-m-croc', word: 'Crocodile', kicker: '05 — Older than the river', time: '15:40', geo: '2°16′N 31°34′E', place: 'Victoria Nile', note: 'Five metres of patience on the sandbank.', outline: true },
  { key: 'v-m-buffalo-birds', word: 'Buffalo', kicker: '06 — Horn & stare', time: '08:20', geo: '2°18′N 31°24′E', place: 'Buligi, Murchison Falls NP', note: 'A bull, a cloud of birds, and nowhere to look away.' },
  { key: 'v-m-giraffes', word: 'Giraffe', kicker: '07 — Rothschild\'s', time: '09:10', geo: '2°19′N 31°28′E', place: 'Buligi, Murchison Falls NP', note: 'White stockings, five metres tall, unbothered by us.', outline: true },
  { key: 'v-hippo', word: 'Hippo', kicker: '08 — Below the surface', time: '11:48', geo: '0°11′S 29°54′E', place: 'Kazinga Channel', note: 'Close enough to hear it breathe.' },
];

// The route map: one entry per bookable trip (`id` matches `itineraries`), stops in travel order.
// Positions checked against SRTM elevation, Sentinel-2 imagery and OpenStreetMap (Oct 2026).
//   when  — the day and time you're there (from the day-by-day plan)
//   leg   — how you get there from the previous stop; `from` starts a leg somewhere that isn't a stop,
//           `extra` marks travel that isn't included in the price (drawn dashed),
//           `mode: 'boat'` follows `river`, `walk: 'hike'` names the stretch past the end of the road,
//           `ferry` names a crossing OSM routes as an ordinary road,
//           `stopovers` are planned pauses on the way — the route goes through them and the drive stops there
//   shot  — camera: distance back, height up, sideways offset (world units); `heading` = compass direction it faces
//   sights (per trip) — attractions near the road that we pass but don't stop at (mostly add-ons)
// The real road geometry, distances and what you pass (districts, towns, rivers, parks) are built from
// OpenStreetMap by tools/fetch-routes.mjs into public/terrain/routes.json — rerun it after changing stops.
// Drive times are planning estimates — check them against the guides' logs; `km` is only a fallback.
// Stopovers and sights are only on the Fort Portal trip for now.
// TODO (guides): confirm every stopover is where you really stop, and add the ones you make that aren't here.
const KAMPALA = { lat: 0.3476, lon: 32.5825 };
export const routeTrips = [
  {
    id: 'murchison', color: '#ffca16', label: 'Murchison Falls', anchor: 'falls',
    stops: [
      { id: 'kampala', name: 'Kampala', ...KAMPALA, when: 'Day 01, 06:30', photo: 'm-van-laugh', heading: 330, shot: [16, 10, 0],
        text: 'Pick-up at your door before sunrise. Coffee, music, and the people you\'ll share the next three days with.' },
      { id: 'paraa', name: 'The Victoria Nile', lat: 2.285, lon: 31.566, when: 'Day 01, 14:00', photo: 'm-elephant-nile', heading: 80, shot: [3.2, 1.5, 0.6],
        leg: { time: '≈ 6 h by road', km: 305, how: 'Tarmac to Masindi, then park roads to Paraa' },
        text: 'Boat cruise upstream from Paraa: tuskers in the shallows, crocodiles on the sand, hippo pods under the banks.' },
      { id: 'falls', name: 'Murchison Falls', lat: 2.278, lon: 31.686, when: 'Day 01–02', photo: 'm-falls-head', heading: 75, shot: [2.3, 1.1, 1.1],
        leg: { mode: 'boat', river: 'Victoria Nile', time: '≈ 1.5 h by boat', km: 17, how: 'Upstream to the foot of the falls; the Top of the Falls walk is on day 2' },
        text: 'The whole Nile forced through a gap about seven metres wide, dropping roughly 43 metres. You feel it before you see it.' },
      { id: 'buligi', name: 'Buligi Plains', lat: 2.29, lon: 31.44, when: 'Day 02, 06:20', photo: 'm-giraffes', heading: 235, shot: [4, 1.7, 0.8],
        leg: { first: { river: 'Victoria Nile', to: [2.285, 31.566], name: 'Back down the Nile to Paraa' }, ferry: 'Paraa ferry over the Nile', walk: 'track',
          time: '≈ 1 h', km: 25, how: 'The early ferry across at Paraa, then the north-bank game tracks' },
        text: 'Dawn game drive on the north bank: Rothschild\'s giraffe, hyena, buffalo, hartebeest and kob in borassus palm savannah, down to the Lake Albert delta.' },
    ],
  },
  {
    id: 'fortportal', color: '#ff801f', label: 'Fort Portal & Queen Elizabeth', anchor: 'craters',
    // attractions of Fort Portal and the west, positions from OpenStreetMap (Oct 2026). Anything more than
    // 40 km from the road is left out by tools/fetch-routes.mjs; `addon` = a paid extra, not in the trip price
    sights: [
      // on the road from Kampala
      { name: 'Lake Wamala', lat: 0.3287, lon: 31.8969, note: 'A wide, shallow lake in the hills south of Mityana' },
      { name: 'Nakayima Tree', lat: 0.5738, lon: 31.3775, note: 'A huge sacred tree on Mubende hill, tied to the Bachwezi legends' },
      // Fort Portal
      { name: 'Tooro Palace', lat: 0.6468, lon: 30.2685, note: 'The Tooro king\'s palace on Karuzika hill, over Fort Portal' },
      { name: 'Toro Botanical Gardens', lat: 0.6637, lon: 30.2849, note: 'Medicinal plants and indigenous trees on the edge of town' },
      { name: 'Lake Saaka', lat: 0.6924, lon: 30.2429, note: 'The crater lake below Kiganywa Hill' },
      { name: 'Sempaya Hot Springs', lat: 0.8353, lon: 30.1656, addon: true, note: 'Boiling springs in the Semuliki forest, over the Rwenzori towards Bundibugyo' },
      // the Ndali–Kasenda crater field
      { name: 'Top of the World', lat: 0.5146, lon: 30.319, note: 'A ridge-top viewpoint over three crater lakes at once' },
      { name: 'Lake Nkuruba', lat: 0.517, lon: 30.303, note: 'A small crater lake ringed by forest and monkeys' },
      { name: 'Lake Nyabikere', lat: 0.4972, lon: 30.3282, note: 'A crater lake on the road towards Kibale' },
      { name: 'Lake Nyinambuga', lat: 0.4805, lon: 30.2903, note: 'The crater lake below Ndali Lodge' },
      { name: 'Lake Kasenda', lat: 0.4321, lon: 30.2903, note: 'At the southern end of the crater field' },
      // Kibale
      { name: 'Kibale Forest, Kanyanchu', lat: 0.437, lon: 30.3933, addon: true, note: 'Chimpanzee tracking in Kibale Forest' },
      { name: 'Bigodi Wetland Sanctuary', lat: 0.404, lon: 30.4113, addon: true, note: 'A community-run swamp walk for birds and monkeys, next to Kibale' },
      // the Rwenzori
      { name: 'Rwenzori Mountains, Nyakalengija', lat: 0.3422, lon: 30.0432, addon: true, note: 'The trailhead for the Mountains of the Moon' },
      { name: 'Kilembe', lat: 0.2069, lon: 29.9961, note: 'The old copper mines in the Rwenzori foothills above Kasese' },
      // Queen Elizabeth National Park and around
      { name: 'Mpanga Falls', lat: 0.0712, lon: 30.3249, note: 'A waterfall in a deep gorge on the Mpanga River, off the beaten track' },
      { name: 'Katwe–Kikorongo craters', lat: -0.0807, lon: 29.9282, note: 'Explosion craters along the park\'s crater drive' },
      { name: 'Lake Katwe', lat: -0.1286, lon: 29.8704, note: 'A crater lake where salt is still dug by hand' },
      { name: 'Lake Munyanyange', lat: -0.1361, lon: 29.8857, note: 'A shallow lake beside Katwe that flamingos visit in season' },
      { name: 'Mweya Peninsula', lat: -0.1907, lon: 29.8996, note: 'The lodge and viewpoint between the Kazinga Channel and Lake Edward' },
      { name: 'Kyambura Gorge', lat: -0.1684, lon: 30.0922, addon: true, note: 'A sunken forest gorge with chimpanzees' },
      { name: 'Maramagambo Forest', lat: -0.4301, lon: 29.9741, addon: true, note: 'Old forest in the south of the park, with a bat cave' },
    ],
    // Times and stops from the guide's log of the 25–27 September 2026 trip.
    stops: [
      { id: 'kampala', name: 'Kampala', ...KAMPALA, when: 'Day 01, 07:00', photo: 'van-road', heading: 280, shot: [16, 10, 0],
        text: 'Meet at 6:50, on the road by 7:00, out of the city through Busega.' },
      { id: 'fortportal', name: 'Fort Portal', lat: 0.654, lon: 30.274, when: 'Day 01, 13:30', photo: 'hills-tree', heading: 255, shot: [3.4, 1.7, 0.6],
        leg: { time: '≈ 6½ h with stops', km: 300, how: 'Through Mubende, Kyegegwa and Kyenjojo. Mostly tarmac, with road works and murram patches around Kalamba and Kiganda',
          stopovers: [
            { name: 'Mubende', lat: 0.5575, lon: 31.395, when: '09:54', note: 'A short stop, then a smoother road west' },
            { name: 'Kyenjojo', lat: 0.6328, lon: 30.6214, when: '12:15', note: 'The long stretch-and-bathroom break before the last hour' },
          ] },
        text: 'Uganda\'s tourism city and seat of the Tooro Kingdom. You come in past the tea estates, with school kids in yellow and blue on the roadside. Lunch in town is a big plate.' },
      { id: 'amabere', name: 'Amabere Caves', lat: 0.6772, lon: 30.2247, when: 'Day 01, 15:30', photo: 'falls-curtain', heading: 265, shot: [1.8, 0.9, 0.3],
        leg: { time: '≈ 20 min', km: 9, how: 'Out of town past the tea and banana gardens' },
        text: 'Stalactite caves and Nyakasura Falls, fed by water off the Rwenzori. Wear closed shoes: small ants on the path like to climb aboard.' },
      { id: 'craters', name: 'Kiganywa Hill', lat: 0.6835, lon: 30.2385, when: 'Day 01, 17:00', photo: 'crater-crew', heading: 300, shot: [1.6, 0.95, 0.35],
        leg: { walk: 'walk', time: '≈ 30 min on foot', km: 2, how: 'Up from the caves on a steep grass path' },
        text: 'A short, steep hike above the caves, between the crater lakes Kigere, Wabikere and Saaka, with the storms rolling in off the Rwenzori.' },
      { id: 'kasenyi', name: 'Kasenyi Plains', lat: -0.04, lon: 30.08, when: 'Day 02, 06:50', photo: 'lioness', heading: 315, shot: [3.4, 1.5, 0.6],
        leg: { time: '≈ 2 h', km: 110, how: 'Up at 3, breakfast at 4, out by 4:50: down the escarpment and across the Equator in the dark' },
        text: 'The dawn drive above Lake George. Elephant first, then lion country: buffalo, thousands of kob and, if luck is with you, the cats. A game drive is a game of luck.' },
      { id: 'kazinga', name: 'Kazinga Channel', lat: -0.165, lon: 29.95, when: 'Day 02, 11:00', photo: 'elephants-kazinga', heading: 240, shot: [3, 1.3, 0.5],
        leg: { walk: 'boat', time: '≈ 1 h', km: 40, how: 'Via the Bunyampaka salt lake to the jetty',
          stopovers: [{ name: 'Bunyampaka salt lake', lat: -0.0402, lon: 30.1304, when: '10:00', note: 'Mined by hand, only in the dry season: table salt, and salt licks for cattle' }] },
        text: 'Two hours on the water between Lakes George and Edward: hippos by the hundred, crocodiles, elephant and buffalo at the edge, even a monitor lizard.' },
      { id: 'kyaninga', name: 'Lake Kyaninga', lat: 0.704, lon: 30.297, when: 'Day 03, 10:30', photo: 'crater-sweep', heading: 250, shot: [1.0, 0.5, 0.35],
        leg: { time: '≈ 2.5 h', km: 140, how: 'Back north across the Equator to Fort Portal for the night, then out through the farmland in the morning',
          stopovers: [{ name: 'Equator photo stop', lat: 0.0, lon: 29.9992, when: '13:30', note: 'One foot in each hemisphere at the Kikorongo marker' }] },
        text: 'A local guide walks you through hillside food farms to the crater, then up the hills around it for the view straight down into the lake. Stay a few hours.' },
      { id: 'kampala', name: 'Back in Kampala', ...KAMPALA, when: 'Day 03, 19:30', photo: 'safari-4x4', heading: 280, shot: [16, 10, 0],
        leg: { time: '≈ 6 h by road', km: 300, how: 'Snacks from Fort Portal, then the same road home' },
        text: 'Home by 7:30 in the evening, three days and two national parks later.' },
    ],
  },
  {
    id: 'moyo', color: '#75c7f0', label: 'Moyo & Mt. Buce', anchor: 'moyo',
    stops: [
      { id: 'kampala', name: 'Kampala', ...KAMPALA, when: 'Day 01, 06:00', photo: 'y-roadstop', heading: 350, shot: [16, 10, 0],
        text: 'An early start for the long, happy road north — roadside grilled meat, a playlist and the whole country going past the window.' },
      { id: 'laropi', name: 'Laropi Ferry', lat: 3.551, lon: 31.802, when: 'Day 01, 17:00', photo: 'y-ferry-sunset', heading: 330, shot: [2.6, 1.2, 0.6],
        leg: { time: '≈ 10 h with stops', km: 470, how: 'North via Gulu and Adjumani, lunch on the B250' },
        text: 'Across the Albert Nile at sunset on the Laropi ferry, the hills of Moyo rising on the far bank.' },
      { id: 'moyo', name: 'Moyo', lat: 3.655, lon: 31.722, when: 'Day 01–04', photo: 'y-grass-cow', heading: 55, shot: [3.2, 1.5, 0.6],
        leg: { time: '≈ 1 h', km: 15, how: 'The ferry crossing, then up into the hills — Moyo by dark' },
        text: 'A green hill town in the far north-west, a few kilometres from South Sudan: mangoes, grilled goat, cattle on the hills and bonfire nights.' },
      { id: 'buce', name: 'Mt. Buce & the border hills', lat: 3.7, lon: 31.84, when: 'Day 02, 08:00', photo: 'b-elder-nile', heading: 205, shot: [4.2, 2.6, 0.6],
        leg: { walk: 'hike', time: '≈ 30 min, then a 3–4 h climb', km: 12, how: 'To the trailhead village to meet the local guides' },
        text: 'A summit hike with local guides on the South Sudan border. From the cliffs the Albert Nile winds across the plains far below.' },
    ],
  },
];

// Every place the map can show, whatever the itinerary: trip stops, stopovers and the sights near them,
// grouped by region. "Explore" tours a region; "Build your own" drives only to the places picked.
//   photos — our own photos of that place (keys in media.json). Only pictures we're sure were taken
//            there; a place we haven't been to yet has none.
//   web    — for those places only: openly licensed photos from Wikimedia Commons (tools/web-photos.mjs),
//            shown with the photographer, licence and source link, as the licences require.
//   addon  — a paid extra, not in a trip price
// Positions from OpenStreetMap / the trip logs. The road links between places are built by
// tools/fetch-network.mjs into public/terrain/network.json — rerun it after adding or moving a place.
export const regions = [
  { id: 'fortportal', name: 'Fort Portal & the crater lakes', color: '#ff801f', hub: 'fortportal',
    blurb: 'Tooro kingdom country: crater lakes by the dozen, caves and waterfalls, Kibale\'s chimps and the hot springs over the Rwenzori.' },
  { id: 'qenp', name: 'Queen Elizabeth & the Rwenzori foothills', color: '#f5e147', hub: 'kasenyi',
    blurb: 'Lion country on the Kasenyi plains, the Kazinga Channel, salt lakes in old craters and the trailheads of the Mountains of the Moon.' },
  { id: 'murchison', name: 'Murchison Falls', color: '#ffca16', hub: 'paraa',
    blurb: 'The Nile forced through a seven-metre gap, the river cruise below it and the giraffe plains of the north bank.' },
  { id: 'moyo', name: 'Moyo & the West Nile', color: '#75c7f0', hub: 'laropi',
    blurb: 'The far north-west: the Laropi ferry over the Albert Nile, green hills and the climb up Mt. Buce on the South Sudan border.' },
  { id: 'road', name: 'On the road from Kampala', color: '#adb5b2', hub: 'kampala', hidden: true },
];
export const places = [
  { id: 'kampala', name: 'Kampala', region: 'road', lat: 0.3476, lon: 32.5825, photos: ['m-van-laugh', 'van-road'], note: 'Where every trip starts — pick-up at your door.' },
  { id: 'wamala', name: 'Lake Wamala', region: 'road', lat: 0.3287, lon: 31.8969, note: 'A wide, shallow lake in the hills south of Mityana.' },
  { id: 'nakayima', name: 'Nakayima Tree', region: 'road', lat: 0.5738, lon: 31.3775, web: ['w-nakayima', 'w-nakayima-2'], note: 'A huge sacred tree on Mubende hill, tied to the Bachwezi legends.' },
  { id: 'ziwa', name: 'Ziwa Rhino Sanctuary', region: 'road', lat: 1.4483, lon: 32.0778, addon: true, web: ['w-ziwa', 'w-ziwa-2'], note: 'Uganda\'s only wild rhinos, tracked on foot with a ranger.' },

  // Fort Portal & the crater lakes
  { id: 'fortportal', name: 'Fort Portal', region: 'fortportal', lat: 0.654, lon: 30.274, photos: ['town', 'hills-tree', 'live-band'], note: 'Uganda\'s tourism city and seat of the Tooro Kingdom, on a green plateau under the Rwenzori.' },
  { id: 'palace', name: 'Tooro Palace', region: 'fortportal', lat: 0.6468, lon: 30.2685, web: ['w-palace'], note: 'The Tooro king\'s palace on Karuzika hill, over the town.' },
  { id: 'botanical', name: 'Toro Botanical Gardens', region: 'fortportal', lat: 0.6637, lon: 30.2849, note: 'Medicinal plants and indigenous trees on the edge of town.' },
  { id: 'amabere', name: 'Amabere Caves & Nyakasura Falls', region: 'fortportal', lat: 0.6772, lon: 30.2247, photos: ['cave', 'falls-curtain', 'falls-joy', 'falls-dance', 'falls-dark', 'falls-wide'], note: 'Stalactite caves and a waterfall fed by water off the Rwenzori.' },
  { id: 'craters', name: 'Kiganywa Hill', region: 'fortportal', lat: 0.6835, lon: 30.2385, photos: ['crater-crew', 'ridge-joy', 'rim-hikers', 'crater-dusk', 'crater-storm'], note: 'A short, steep hike between the crater lakes, with storms rolling off the Rwenzori.' },
  { id: 'saaka', name: 'Lake Saaka', region: 'fortportal', lat: 0.6924, lon: 30.2429, web: ['w-saaka', 'w-saaka-2'], note: 'The crater lake below Kiganywa Hill.' },
  { id: 'kyaninga', name: 'Lake Kyaninga', region: 'fortportal', lat: 0.704, lon: 30.297, photos: ['crater-sweep', 'deck'], note: 'One of the most perfect crater lakes in Africa, with a floating deck for lunch.' },
  { id: 'sempaya', name: 'Sempaya Hot Springs', region: 'fortportal', lat: 0.8353, lon: 30.1656, addon: true, web: ['w-sempaya', 'w-sempaya-2'], note: 'Boiling springs in the Semuliki forest, over the Rwenzori towards Bundibugyo.' },
  { id: 'topworld', name: 'Top of the World', region: 'fortportal', lat: 0.5146, lon: 30.319, note: 'A ridge-top viewpoint over three crater lakes at once.' },
  { id: 'nkuruba', name: 'Lake Nkuruba', region: 'fortportal', lat: 0.517, lon: 30.303, web: ['w-nkuruba'], note: 'A small crater lake ringed by forest and monkeys.' },
  { id: 'nyabikere', name: 'Lake Nyabikere', region: 'fortportal', lat: 0.4972, lon: 30.3282, web: ['w-nyabikere'], note: 'A crater lake on the road towards Kibale.' },
  { id: 'nyinambuga', name: 'Lake Nyinambuga', region: 'fortportal', lat: 0.4805, lon: 30.2903, note: 'The crater lake below Ndali Lodge.' },
  { id: 'kasenda', name: 'Lake Kasenda', region: 'fortportal', lat: 0.4321, lon: 30.2903, note: 'At the southern end of the crater field.' },
  { id: 'kibale', name: 'Kibale Forest, Kanyanchu', region: 'fortportal', lat: 0.437, lon: 30.3933, addon: true, photos: ['rainforest'], note: 'Chimpanzee tracking in Kibale Forest.' },
  { id: 'bigodi', name: 'Bigodi Wetland Sanctuary', region: 'fortportal', lat: 0.404, lon: 30.4113, addon: true, web: ['w-bigodi', 'w-bigodi-2'], note: 'A community-run swamp walk for birds and monkeys, next to Kibale.' },

  // Queen Elizabeth & the Rwenzori foothills
  { id: 'kasenyi', name: 'Kasenyi Plains', region: 'qenp', lat: -0.04, lon: 30.08, photos: ['lioness', 'lioness-vehicle', 'lion-male', 'leopard', 'kob-dawn', 'kob-herd', 'buffalo-herd', 'buffalo-stare'], note: 'The dawn drive above Lake George: lion, leopard, buffalo and thousands of kob.' },
  { id: 'bunyampaka', name: 'Bunyampaka salt lake', region: 'qenp', lat: -0.0402, lon: 30.1304, photos: ['salt-lake'], note: 'Salt mined by hand in the dry season, for the table and for cattle licks.' },
  { id: 'kazinga', name: 'Kazinga Channel', region: 'qenp', lat: -0.165, lon: 29.95, photos: ['elephants-kazinga', 'elephant-line', 'elephants-bank', 'hippo-water', 'hippo-wallow', 'cruise-buffalo', 'kazinga-clouds', 'waterbuck'], note: 'Two hours on the water between Lakes George and Edward: hippos by the hundred, elephant at the edge.' },
  { id: 'equator', name: 'The Equator at Kikorongo', region: 'qenp', lat: 0.0, lon: 29.9992, photos: ['equator', 'equator-couple'], note: 'One foot in each hemisphere.' },
  { id: 'katwecraters', name: 'Katwe–Kikorongo craters', region: 'qenp', lat: -0.0807, lon: 29.9282, web: ['w-katwecraters', 'w-katwecraters-2'], note: 'Explosion craters along the park\'s crater drive.' },
  { id: 'katwe', name: 'Lake Katwe', region: 'qenp', lat: -0.1286, lon: 29.8704, web: ['w-katwe'], note: 'A crater lake where salt is still dug by hand.' },
  { id: 'munyanyange', name: 'Lake Munyanyange', region: 'qenp', lat: -0.1361, lon: 29.8857, web: ['w-munyanyange', 'w-munyanyange-2'], note: 'A shallow lake beside Katwe that flamingos visit in season.' },
  { id: 'mweya', name: 'Mweya Peninsula', region: 'qenp', lat: -0.1907, lon: 29.8996, web: ['w-mweya'], note: 'The lodge and viewpoint between the Kazinga Channel and Lake Edward.' },
  { id: 'kyambura', name: 'Kyambura Gorge', region: 'qenp', lat: -0.1684, lon: 30.0922, addon: true, web: ['w-kyambura', 'w-kyambura-2'], note: 'A sunken forest gorge with chimpanzees.' },
  { id: 'maramagambo', name: 'Maramagambo Forest', region: 'qenp', lat: -0.4301, lon: 29.9741, addon: true, note: 'Old forest in the south of the park, with a bat cave.' },
  { id: 'mpanga', name: 'Mpanga Falls', region: 'qenp', lat: 0.0712, lon: 30.3249, note: 'A waterfall in a deep gorge on the Mpanga River, off the beaten track.' },
  { id: 'nyakalengija', name: 'Rwenzori Mountains, Nyakalengija', region: 'qenp', lat: 0.3422, lon: 30.0432, addon: true, photos: ['rwenzori'], note: 'The trailhead for the Mountains of the Moon.' },
  { id: 'kilembe', name: 'Kilembe', region: 'qenp', lat: 0.2069, lon: 29.9961, web: ['w-kilembe', 'w-kilembe-2'], note: 'The old copper mines in the Rwenzori foothills above Kasese.' },

  // Murchison Falls
  { id: 'gate', name: 'Murchison Falls NP gate', region: 'murchison', lat: 1.8534, lon: 31.7098, photos: ['m-gate-dance'], note: 'Park entry, and the first dance of the trip.' },
  { id: 'paraa', name: 'The Victoria Nile at Paraa', region: 'murchison', lat: 2.285, lon: 31.566, photos: ['m-elephant-nile', 'm-group-boat', 'm-croc', 'm-croc-tree', 'm-elephant-face'], note: 'The boat cruise upstream: tuskers in the shallows, crocodiles on the sand.' },
  { id: 'topfalls', name: 'Murchison Falls', region: 'murchison', lat: 2.278, lon: 31.6858, photos: ['m-falls-head', 'm-falls-cliff', 'm-falls-top', 'm-top-sign', 'm-arms-falls', 'm-photographer', 'm-ranger'], note: 'The whole Nile through a gap about seven metres wide — from the boat below and from the top.' },
  { id: 'buligi', name: 'Buligi Plains', region: 'murchison', lat: 2.29, lon: 31.44, photos: ['m-giraffes', 'm-hyena', 'm-hartebeest', 'm-kob-palms', 'm-giraffes-dusk', 'm-elephants-acacia'], note: 'Dawn on the north bank: Rothschild\'s giraffe, hyena and hartebeest in the borassus palms.' },

  // Moyo & the West Nile
  { id: 'laropi', name: 'Laropi Ferry', region: 'moyo', lat: 3.551, lon: 31.802, photos: ['y-ferry-sunset', 'y-ferry-clouds', 'y-arms-nile', 'y-canoe', 'y-nile-smile', 'y-nile-dusk'], note: 'Across the Albert Nile at sunset, the hills of Moyo on the far bank.' },
  { id: 'moyo', name: 'Moyo', region: 'moyo', lat: 3.655, lon: 31.722, photos: ['y-grass-cow', 'y-grill', 'y-fire', 'y-mangoes', 'y-dusk-hills'], note: 'A green hill town a few kilometres from South Sudan: mangoes, muchomo and bonfire nights.' },
  { id: 'buce', name: 'Mt. Buce', region: 'moyo', lat: 3.7, lon: 31.84, photos: ['b-summit-joy', 'b-panorama', 'b-elder-nile', 'b-hat-nile', 'b-edge-nile', 'b-summit-crew', 'b-dance', 'b-village-trail'], note: 'A summit hike with local guides on the South Sudan border, the Albert Nile far below.' },
];
// "Add to my trip" on an experience puts these places in "Build your own"
export const experiencePlaces = {
  'crater-hike': ['craters'], waterfalls: ['amabere'], 'nile-cruise': ['paraa'], 'top-falls': ['topfalls'],
  'buce-hike': ['buce'], laropi: ['laropi'], muchomo: ['moyo'], nights: ['fortportal'], equator: ['equator'],
  kazinga: ['kazinga'], deck: ['kyaninga'], 'game-drive': ['kasenyi'], chimps: ['kibale'], 'tea-road': ['fortportal'], salt: ['bunyampaka'],
};

// Experiences are a core offer in their own right, not just safari add-ons.
// cat: adventure | water | culture | wildlife — drives the filter tabs. `trip` says where it runs.
export const experienceCats = [
  { id: 'all', label: 'Everything' },
  { id: 'adventure', label: 'Hikes & adventure' },
  { id: 'water', label: 'On the water' },
  { id: 'culture', label: 'Culture & nights out' },
  { id: 'wildlife', label: 'Wildlife' },
];
export const experiences = [
  { id: 'crater-hike', cat: 'adventure', title: 'Crater-rim hikes', trip: 'Fort Portal', photo: 'crater-dusk', video: 'v-crater', feel: 'Loud, sweaty, unforgettable',
    text: 'Grass ridges between volcanic lakes, the whole group cheering at the top as the storm rolls off the Rwenzori.' },
  { id: 'waterfalls', cat: 'adventure', title: 'Waterfalls & caves', trip: 'Fort Portal', photo: 'falls-dark', video: 'v-falls', feel: 'Get soaked, on purpose',
    text: 'Walk behind the curtain of Nyakasura Falls and into the stalactite caves of Amabere ga Nyina Mwiru — legend included.' },
  { id: 'nile-cruise', cat: 'water', title: 'Nile boat to the falls', trip: 'Murchison', photo: 'm-photographer', video: 'v-m-elephant-nile', feel: 'Life jackets, big grins',
    text: 'Upstream from Paraa to the foot of Murchison Falls, past tuskers in the shallows and crocodiles on the sand.' },
  { id: 'top-falls', cat: 'adventure', title: 'Top of the Falls', trip: 'Murchison', photo: 'm-falls-top', video: 'v-m-falls-chasm', feel: 'Spray in your face',
    text: 'Stand where the whole Nile squeezes through a seven-metre gap and explodes into the gorge below.' },
  { id: 'buce-hike', cat: 'adventure', title: 'Summit hike on the border', trip: 'Moyo', photo: 'b-dance', feel: 'Dance first, then climb',
    text: 'Mt. Buce with local guides from the villages below: red-earth trails, tall grass, then cliffs with the Albert Nile winding across the plains.' },
  { id: 'laropi', cat: 'water', title: 'Sunset on the Laropi ferry', trip: 'Moyo', photo: 'y-ferry-sunset', feel: 'Golden hour on the Nile',
    text: 'Crossing the Albert Nile on the Laropi ferry as the sun drops behind the West Nile hills.' },
  { id: 'muchomo', cat: 'culture', title: 'Grilled goat & bonfire nights', trip: 'Moyo', photo: 'y-grill', feel: 'Goat on the drum grill',
    text: 'Goat (muchomo) sizzling on a homemade drum grill, fresh mangoes, and a bonfire that runs late under the stars.' },
  { id: 'nights', cat: 'culture', title: 'Evenings & live music', trip: 'Fort Portal', photo: 'live-band', feel: 'Dance after the game drive',
    text: 'Dinner, a cold drink and a live band in town. Safari days start at 4:30, but the nights are ours.' },
  { id: 'equator', cat: 'culture', title: 'One foot in each hemisphere', trip: 'Queen Elizabeth', photo: 'equator-couple', feel: 'The photo everyone takes',
    text: 'A stop on the Equator on the road into Queen Elizabeth — hugs, jumps and far too many pictures.' },
  { id: 'kazinga', cat: 'water', title: 'Kazinga Channel cruise', trip: 'Queen Elizabeth', photo: 'elephant-line', video: 'v-hippo-pod', feel: 'Hippos at arm\'s length',
    text: 'Two hours on one of the densest hippo channels in Africa, with elephant herds coming down to drink.' },
  { id: 'deck', cat: 'water', title: 'Crater-lake lunch & swim', trip: 'Fort Portal', photo: 'deck', feel: 'Slow morning, cold water',
    text: 'A lakeside lunch at Kyaninga and a floating deck on a jungle-walled crater lake.' },
  { id: 'game-drive', cat: 'wildlife', title: 'Dawn game drives', trip: 'Both trips', photo: 'lioness-vehicle', video: 'v-drive', feel: 'Roof up, eyes wide',
    text: 'Out of the gate before sunrise for lion, leopard, hyena and buffalo, when the cats are still hunting.' },
  { id: 'chimps', cat: 'wildlife', title: 'Rainforest & chimps', trip: 'Kibale add-on', photo: 'rainforest', video: 'v-forest', feel: 'Hush, then chaos',
    text: 'Kibale holds over 1,500 chimpanzees, about an hour from Fort Portal. Add a tracking morning to any trip.' },
  { id: 'tea-road', cat: 'culture', title: 'Tea-country road trip', trip: 'Fort Portal', photo: 'ridge-joy', feel: 'Windows down, music up',
    text: 'Emerald tea estates, Tooro hill villages and the Mountains of the Moon on the horizon — the drive is half the fun.' },
  { id: 'salt', cat: 'culture', title: 'Bunyampaka salt lake', trip: 'Queen Elizabeth', photo: 'salt-lake', video: 'v-salt', feel: 'A crater turned salt pan',
    text: 'A crater lake on the Kasenyi plains where salt is still dug by hand, and only in the dry season: table salt for kitchens, and salt licks for cattle.' },
];

// Pillar 2 — proof of expertise: what a guide knows that a brochure doesn't.
export const fieldNotes = [
  { photo: 'lioness-rest', title: 'Why we leave before 5', tag: 'Lion',
    text: 'Lions do most of their hunting in the dark and at first light. By mid-morning they\'re flat out in a thicket. So in September we were out of Fort Portal at 4:50 and in the park by 6:50.' },
  { photo: 'kob-herd', title: 'Watch the kob, not the grass', tag: 'Reading the bush',
    text: 'When a herd of kob stops grazing and every head turns the same way, something is moving. Half our leopard and lion sightings start with antelope staring.' },
  { photo: 'm-elephants-acacia', title: 'Ears tell you everything', tag: 'Elephant',
    text: 'Slow flapping is an elephant cooling down. Ears spread wide, head up, trunk swinging — that\'s a warning. We cut the engine, give space, and let her decide.' },
  // the guide's lessons from the September 2026 game drive
  { photo: 'lioness-vehicle', title: 'A game drive is a game of luck', tag: 'Rule number one',
    text: 'The first thing our guide told us at the gate. Nobody can promise you a lion. We can be in the right place at the right hour, and tell you straight what we saw last time.' },
  { photo: 'buffalo-herd', title: 'Antelope are snacks', tag: 'Lion',
    text: 'To a lion, a kob is a snack. A real meal is a buffalo. So when a big buffalo herd is out on the plain, keep watching its edges.' },
  { photo: 'elephant-line', title: 'Tusks up, tusks down', tag: 'Elephant',
    text: 'Savanna elephants, like most in Queen Elizabeth, carry tusks that curve up and out. Forest elephants from the Congo side have straighter tusks pointing down, which suits pushing through thick forest.' },
  { photo: 'm-hyena', title: 'Hyenas are hunters', tag: 'Hyena',
    text: 'Forget the cartoon scavenger. Spotted hyenas kill most of what they eat, hunt in clans, and are among the most successful predators on the continent.' },
  { photo: 'hippo-side', title: 'Never between a hippo and water', tag: 'Hippo',
    text: 'They graze on land at night and sprint back to the water when spooked — faster than you can run. On foot near a channel, we always know where the water is.' },
  { photo: 'm-giraffes-dusk', title: 'Look at the legs', tag: 'Giraffe',
    text: 'Rothschild\'s giraffe wear "white stockings" — no patches below the knee. Murchison holds one of the largest populations left anywhere. Don\'t look for them in Queen Elizabeth: there are none.' },
];

export const itineraries = [
  {
    id: 'murchison', name: 'Murchison Falls', em: 'Explorer', days: '3 days, 2 nights', when: 'Ran July 2026',
    blurb: 'Kampala to the most powerful waterfall on the Nile, a river cruise among tuskers and crocodiles, and a dawn drive on the Buligi plains.',
    // TODO: set a real price, e.g. 'From USD 480 pp' — until then the site shows "Quote within 24 h"
    price: null,
    cover: 'm-falls-head', route: 'Kampala → Murchison Falls NP → Kampala',
    highlights: ['Murchison Falls', 'Nile boat cruise', 'Giraffe & elephant', 'Hyena & buffalo'],
    season: 'Best Dec–Feb & Jun–Sep',
    includes: ['Pop-up-roof safari van & fuel', 'Driver-guide throughout', 'Park entry & Nile cruise', 'Top of the Falls hike', '2 nights lodge, meals as listed'],
    excludes: ['Drinks & tips', 'Travel insurance'],
    days_: [
      { n: '01', title: 'North to', em: 'the Nile', photo: 'm-elephant-nile', place: 'Kampala → Murchison Falls NP',
        text: 'An early start from Kampala, through the park gate by midday, then onto the water for the cruise from Paraa to the foot of the falls.',
        plan: [['06:30', 'Pick-up in Kampala'], ['12:15', 'Murchison Falls NP gate'], ['14:00', 'Nile cruise to the foot of the falls'], ['17:00', 'Sunset drive — giraffes at dusk']] },
      { n: '02', title: 'Dawn on', em: 'the plains', photo: 'm-giraffes', place: 'Buligi game tracks and the Top of the Falls',
        text: 'Ferry to the north bank before sunrise. Hyena on the track, buffalo, Rothschild\'s giraffe, hartebeest and kob towards the Lake Albert delta. Late morning at the Top of the Falls.',
        plan: [['06:20', 'Sunrise game drive, Buligi'], ['09:00', 'Giraffe herds & hartebeest'], ['10:30', 'Top of the Falls walk'], ['14:30', 'Free afternoon at the lodge']] },
      { n: '03', title: 'Home with', em: 'a thousand photos', photo: 'm-van-laugh', place: 'Murchison → Kampala',
        text: 'A slow breakfast, a last look at the river, and the road back to Kampala — with the playlist louder than on the way up.',
        plan: [['08:00', 'Breakfast by the river'], ['10:00', 'Depart Murchison'], ['16:30', 'Drop-off in Kampala']] },
    ],
  },
  {
    id: 'fortportal', name: 'Fort Portal &', em: 'Queen Elizabeth', days: '3 days, 2 nights', when: 'Ran 25–27 Sep 2026',
    blurb: 'From Kampala to the caves, waterfalls and crater-lake hills of Fort Portal, then a 4:50 am run across the Equator for the game drive and the Kazinga Channel.',
    // TODO: set a real price, e.g. 'From USD 520 pp' — until then the site shows "Quote within 24 h"
    price: null,
    cover: 'crater-crew', route: 'Kampala → Fort Portal → Queen Elizabeth NP → Kampala',
    highlights: ['Game drive & Kazinga cruise', 'Crater lake hikes', 'Caves & waterfalls', 'Bunyampaka salt lake'],
    season: 'Best Dec–Feb & Jun–Sep',
    // TODO (guides): confirm what the price covers; the September trip stayed in a private house in Kagote and ate in town
    includes: ['Transport from Kampala & fuel', 'Driver-guide throughout', 'Park entry & Kazinga cruise', 'Local guides for the caves & Kyaninga', '2 nights in Fort Portal, meals as listed'],
    excludes: ['Chimp permits (optional add-on)', 'Drinks & tips', 'Travel insurance'],
    days_: [
      { n: '01', title: 'Hills, caves &', em: 'crater lake storms', photo: 'crater-summit', place: 'Kampala → Fort Portal, Amabere, Kiganywa',
        text: 'West through Mubende and Kyenjojo, past the tea estates into Fort Portal for a big lunch. Then the Amabere caves, Nyakasura Falls, and a steep hike up Kiganywa hill between three crater lakes.',
        plan: [['07:00', 'Leave Kampala via Busega'], ['09:54', 'Short stop in Mubende'], ['12:15', 'Long break in Kyenjojo'], ['13:30', 'Fort Portal, lunch in town'], ['15:30', 'Amabere caves & Nyakasura Falls'], ['17:00', 'Kiganywa hill over the crater lakes']] },
      { n: '02', title: 'Into', em: 'elephant country', photo: 'elephants-kazinga', place: 'Queen Elizabeth National Park',
        text: 'Up at 3, breakfast at 4 and out by 4:50, across the Equator in the dark. Elephants first on the dawn drive, then the salt lake at Bunyampaka and two hours on the Kazinga Channel.',
        plan: [['04:50', 'Leave Fort Portal'], ['06:50', 'Into the park, dawn game drive'], ['10:00', 'Bunyampaka salt lake, Kasenyi'], ['11:00', 'Kazinga Channel boat cruise'], ['12:52', 'Back on land, north to Fort Portal']] },
      { n: '03', title: 'The hills of', em: 'Lake Kyaninga', photo: 'rim-hikers', place: 'Kyaninga → Kampala',
        text: 'A local guide walks you through hillside food farms to Lake Kyaninga, then up the hills around it for the best view of the crater. A few hours up there, snacks in Fort Portal, and home.',
        plan: [['10:30', 'Check out, meet the Kyaninga guide'], ['10:45', 'Walk through the farmland'], ['11:30', 'Hike the hills above the crater'], ['13:30', 'Snacks in Fort Portal, head home'], ['19:30', 'Back in Kampala']] },
    ],
  },
  {
    id: 'moyo', name: 'Moyo &', em: 'Mt. Buce', days: '4 days, 3 nights', when: 'Ran May 2026',
    blurb: 'The far north-west: up the Nile road, across the Albert Nile on the Laropi ferry at sunset, and a summit hike on the South Sudan border with the river winding far below.',
    // TODO: set a real price — until then the site shows "Quote within 24 h". Check the day plan and inclusions too.
    price: null,
    cover: 'b-summit-crew', route: 'Kampala → Laropi ferry → Moyo → Mt. Buce',
    highlights: ['Mt. Buce summit hike', 'Albert Nile ferry', 'West Nile hills', 'Grilled goat & bonfires'],
    season: 'Dry Dec–Mar, greenest May–Jun',
    includes: ['Transport from Kampala & fuel', 'Local hiking guides', 'Laropi ferry crossings', '3 nights in Moyo, meals as listed'],
    excludes: ['Drinks & tips', 'Travel insurance'],
    days_: [
      { n: '01', title: 'Up the', em: 'Nile road', photo: 'y-roadstop', place: 'Kampala → Adjumani → Laropi → Moyo',
        text: 'A long, happy drive north past Atiak and Adjumani, roadside grilled-meat stops, and the Laropi ferry across the Albert Nile as the sun goes down. Moyo by dark.',
        plan: [['06:00', 'Depart Kampala'], ['13:00', 'Roadside lunch on the B250'], ['17:00', 'Laropi ferry over the Albert Nile'], ['19:00', 'Arrive Moyo']] },
      { n: '02', title: 'Climb', em: 'Mt. Buce', photo: 'b-hat-nile', place: 'Mt. Buce and the Moyo hills',
        text: 'With local guides from the villages below, up red-earth paths, through tall grass and woodland to the summit cliffs. The Albert Nile winds across the plains far below, with South Sudan on the horizon.',
        plan: [['07:00', 'Meet the local guides'], ['08:00', 'Village trail & meadow'], ['11:30', 'Summit cliffs & Nile views'], ['16:00', 'Back down, laughing all the way']] },
      { n: '03', title: 'Moyo,', em: 'slowly', photo: 'y-grass-cow', place: 'Moyo town & countryside',
        text: 'Mangoes off the tree, grilled goat on a drum grill, green hills full of long-horned cattle, and a bonfire that runs late.',
        plan: [['10:00', 'Moyo town & market'], ['14:00', 'Grilled goat on the drum grill'], ['18:30', 'Sunset over the hills'], ['20:00', 'Bonfire night']] },
      { n: '04', title: 'The Nile', em: 'at dusk', photo: 'y-canoe', place: 'Albert Nile shore → Kampala',
        text: 'Canoes on the Nile shore at golden hour, one last crossing, and the road south with a thousand new photos.',
        plan: [['07:00', 'Nile shore & fishing canoes'], ['09:00', 'Laropi ferry back over the Nile'], ['18:00', 'Arrive Kampala']] },
    ],
  },
];

// Pillar 3 — proof others trusted you. Replace the sample words with real guests' words
// (the fear they had before booking, and the moment it disappeared).
// The "Make it yours" card after the trips
export const customTrip = { photo: 'm-top-sign' };

// the two photos set into the words of "The idea", the big quote's background and the film
export const manifestoPhotos = ['m-elephant-nile', 'crater-reflect'];
export const quote = { photo: 'm-falls-top' };
export const film = { key: 'v-film' };

export const stories = [
  { photo: 'm-laugh-1', name: 'Guest name', trip: 'Murchison, July 2026', sample: true,
    fear: 'I was worried a group trip would feel like a bus tour.',
    moment: 'By the second morning we were sitting on the roof of the van, screaming at hyenas. It felt like a road trip with friends.' },
  { photo: 'm-laugh-2', name: 'Guest name', trip: 'Murchison, July 2026', sample: true,
    fear: 'I thought the animals would be far away, dots through binoculars.',
    moment: 'A tusker walked down to the river right next to our boat. Nobody said a word.' },
  { photo: 'arms-lake', name: 'Guest name', trip: 'Fort Portal, September 2026', sample: true,
    fear: 'Waking at 4 am sounded like a terrible idea.',
    moment: 'Then a leopard walked out of the grass at 8:37 and I stopped complaining forever.' },
];

// Pillar 4 — answer every silent question before the guest has to ask it.
export const faqs = [
  { q: 'What happens after I enquire?', a: 'A guide replies within 24 hours on WhatsApp or email with a route, the timings and one all-in price. No call centre, no copy-paste packages.' },
  { q: 'Who will I actually be talking to?', a: 'The guide who will drive you. You get their name and number from the first message, and the same person picks you up.' },
  { q: 'What does the price include?', a: 'Private 4x4 or pop-up-roof safari van with fuel, driver-guide, park entry, boat cruises, and the accommodation and meals listed in your itinerary. Chimp permits are quoted separately at the official Uganda Wildlife Authority rate.' },
  { q: 'How long is the drive to Fort Portal?', a: 'About six and a half hours with stops. In September we left Kampala at 7:00 via Busega and were in Fort Portal by 1:30, with a short stop in Mubende and a long break in Kyenjojo. It\'s mostly tarmac, with some road works and murram patches around Kalamba and Kiganda.' },
  { q: 'Which trip has the better boat cruise?', a: 'Honestly? Murchison. The Kazinga Channel in Queen Elizabeth is great for hippos, buffalo and elephant, but the Nile cruise to the foot of Murchison Falls is far more exciting. If the boat is your must-do, pick Murchison — or do both.' },
  { q: 'Which animals will I see?', a: 'Elephant and buffalo on both safaris. Giraffe only in Murchison — there are none in Queen Elizabeth. Queen Elizabeth is the one for lion on the Kasenyi plains and hippos on the Kazinga Channel. But a game drive is a game of luck: we\'ll tell you what we saw last time, and never promise.' },
  { q: 'What should I pack?', a: 'Closed shoes and long trousers for the cave and crater walks (small ants on the Amabere path like to climb aboard), a warm layer for the 4–5 am starts, a rain jacket for the crater-lake storms, and a power bank. You will take more photos than you think.' },
  { q: 'What happens after I pay?', a: 'You receive a written confirmation, then your park permits are booked in your names with UWA and the confirmations sent to you. Two days before departure, your guide messages to confirm pick-up.' },
  { q: 'What if I need to cancel or change dates?', a: 'Our cancellation and change terms are sent in writing with your quote — before you pay anything. Park permits follow UWA rules; we\'ll tell you exactly which parts are refundable.' },
  { q: 'Is it safe?', a: 'Game drives stay in the vehicle, walks are with armed UWA rangers, and our guides read animal behaviour for a living. We carry first aid, and know the nearest clinic on every route.' },
  { q: 'When should I go?', a: 'The dry seasons — June to September and December to February — are best for game viewing and hiking. The wet months are greener, quieter and often cheaper.' },
  { q: 'Do East African residents get local rates?', a: 'Yes. UWA charges separate citizen and resident rates for park entry and permits, and we quote them that way.' },
];

// Facts checked against UWA / UNESCO reporting (Oct 2026). Re-check fees before publishing.
export const ledger = [
  { num: 3840, suffix: 'km²', title: 'Murchison Falls NP', text: 'Uganda\'s largest national park, split by the Victoria Nile. 450+ bird species.' },
  { num: 5109, suffix: 'm', title: 'Margherita Peak', text: 'The Rwenzori — Mountains of the Moon — Africa\'s third-highest summit, UNESCO-listed.' },
  { num: 95, suffix: '+', title: 'Mammal species', text: 'In Queen Elizabeth National Park, with 600+ bird species across 1,978 km².' },
  { num: 50, suffix: '+', title: 'Crater lakes', text: 'Scattered across the hills around Fort Portal.' },
];

export const about = {
  photo: 'b-cheer', // one group portrait; the rest of the photos live in the album
  title: 'Hineni means', em: '“here I am.”',
  text: [
    'It\'s what you say when you finally arrive somewhere you were meant to be. At the edge of Murchison Falls with spray on your face. Three metres from a tusker. On a crater rim as the storm comes in.',
    'We\'re a small team running group trips to the places we love most. Every photo and video of our trips was shot by our own travellers in 2026 — no stock, no filters, nothing staged. The only exceptions are a few places on the map we haven\'t taken a group to yet; those photos are credited to their photographers.',
  ],
};


// The desktop nav's mega menus: columns of links and a photo that follows the hovered link.
// href + data (rendered as data-* attributes) reuse the page's own link hooks:
// data-days opens a trip's day-by-day, data-book picks it in the form, data-exp-cat filters the experiences.
// sub: where the experience runs, unless the trip name alone would mislead
const exp = (id, icon, sub) => {
  const e = experiences.find((x) => x.id === id);
  return { label: e.title, sub: sub || e.trip, icon, photo: e.photo, href: '#experiences', data: { 'exp-cat': e.cat } };
};
// built when the page renders (not at import), so trip and experience names edited in the portal show here too
export const navMenus = () => ({
  trips: [
    { title: 'Pick a trip', items: [
      ...itineraries.map((it, i) => ({
        label: `${it.name} ${it.em}`, sub: it.days, icon: ['wave', 'crater', 'flag'][i] || 'pin', photo: it.cover, href: '#itinerary', data: { days: i },
      })),
      { label: 'Custom trip', sub: 'Your dates and route', icon: 'pen', photo: customTrip.photo, href: '#enquire', data: { book: 'custom' } },
    ] },
    { title: 'Planning', items: [
      { label: 'Route map', sub: 'Every stop on all three trips', icon: 'pin', photo: 'm-giraffes', href: '#journey' },
      { label: 'Questions', sub: 'Payment, changes and contacts', icon: 'chat', photo: 'lioness-vehicle', href: '#faq' },
    ] },
  ],
  experiences: [
    { title: 'Hikes and adventure', items: [exp('crater-hike', 'crater'), exp('waterfalls', 'drop'), exp('buce-hike', 'flag')] },
    { title: 'On the water', items: [exp('nile-cruise', 'boat'), exp('laropi', 'sun'), exp('deck', 'wave')] },
    { title: 'Wildlife and evenings', items: [
      exp('game-drive', 'paw', 'Murchison and Queen Elizabeth'), exp('chimps', 'leaf', 'Kibale, add to any trip'), exp('nights', 'music'),
    ] },
  ],
});
