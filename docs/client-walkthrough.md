# Client walkthrough — Hineni website

**Date:** 27 Oct 2026 · **Build tested:** local dev + production build · **Devices:** desktop 1440×900, phone 375×812

## The client

> "We're four friends planning a trip for December. Three or four days. We want lions and that big waterfall.
> What does it cost, what's included, and how do I book?"

I went through the site start to finish as this person, timing how far they have to scroll and noting
every moment of confusion. I measured scroll distance in *screens* (one screen = one viewport height).

## What works (keep it)

- **The first impression is strong.** Real footage, the dissolving reel and real faces under the headline
  feel nothing like a template safari site.
- **The Game sequence is memorable** — lion, leopard, hyena with timecodes from the actual sightings.
- **The 3D route map** answers "where is all this?" better than any static map.
- **Field notes, the day-by-day itineraries and the FAQ** are exactly the expertise and reassurance the
  TikTok audits asked for. They're just too far down to be found.

## Findings

| # | Severity | What the client experienced | Evidence |
|---|---|---|---|
| 1 | **Critical** | **The trips are buried.** I had to scroll through 30 screens of cinematic sections before seeing a single trip, and 36–41 screens to reach the booking form. Most visitors leave long before that. | Trips start at screen 30.2 (desktop) / 30.5 (phone). Form at 36.4 / 41.4. Page is 38 / 45 screens tall. |
| 2 | **Critical** | **No price, and no "what's included" anywhere.** The first thing I wanted to know, I couldn't find. | No price text on the page; inclusions only inside one FAQ answer. |
| 3 | High | **The hero doesn't say what's for sale.** "Here I am." is beautiful but abstract. On a phone the explanatory sentence is hidden entirely, so I saw only a poetic line over an elephant. | `.hero__sub` hidden under 560 px. |
| 4 | High | **"Plan your journey" skipped me past the trips** straight to an empty form — I hadn't chosen anything yet. | Hero CTA links to `#enquire`. |
| 5 | High | **Navigation was hard to read and use.** Labels like "The Game" and "The Route" don't say what's there; the white-on-video nav nearly vanishes over bright footage; on phones the booking button disappears. | Nav uses `mix-blend-mode: difference`; `.nav .btn` hidden under 560 px. |
| 6 | High | **I felt stuck in the long scroll sections.** The Game, Route map and Gallery each hold the page for 4–9 screens with no way out. | Game ≈ 7 screens, Route ≈ 9, Gallery ≈ 4–5. |
| 7 | Medium | **Booking assumed an email app.** "Send enquiry" tries to open a mail client — on a laptop with webmail nothing happens. WhatsApp, which most East African guests prefer, was a small text link. The trip I'd read about wasn't carried into the form. | `mailto:` submit; WhatsApp link only in the success state. |
| 8 | Medium | **The page was slow to become useful.** 11.9 MB and 74 requests in the first 9 seconds — all 30 gallery photos, every video poster and the 3D map data were fetched before I'd scrolled at all. | Measured with the Performance API on the production build. |
| 9 | Medium | **Videos looked soft and a bit murky.** Heavy compression, phones playing 360p stretched up, plus film grain, a green shadow tint and dark vignettes on top. | 720p @ CRF 31; phone copies from 360p sources; grain opacity 0.07. |
| 10 | Medium | **Small labels were hard to read.** Many 10–11 px uppercase mono labels (card meta, eyebrows) in dim beige. | `.eyebrow` 11 px, `--bone-dim`. |
| 11 | Low | **On a phone, the Experiences row gives no hint that it scrolls sideways**, and the hover videos never play on touch. | Swipe layout, hover-only video. |

## Not fixable in code — needs the business

These would make the biggest difference to bookings and need real information:

1. **Prices.** Even "from USD ___ per person" per trip. The site now shows *"Quote within 24 h"* until a
   price is entered in `src/data/content.js` (`price` on each trip).
2. **Next departure dates** for group trips.
3. **Named guides with photos** — the trust research says a real face in the first 5 seconds.
4. **Real guest quotes** for the stories section (currently hidden in production).
5. **Credentials:** Uganda Tourism Board registration, AUTO membership, insurance — a short line near the
   form.
6. **Real contacts** — WhatsApp number and email are still placeholders.

## What I changed

| Finding | Change |
|---|---|
| 1, 4 | New **"Choose your trip"** section directly under the hero (screen ~1): both signature trips as cards with days, route, highlights, best season, price/quote line, and two clear buttons — *Day by day* and *Book this trip*. A third card for custom trips. The hero's main button now says **See the trips**. |
| 2 | Trip cards and the itinerary show **price (or "Quote within 24 h")** and **what's included / not included**. |
| 3 | Hero now states the offer on every screen size: *Small-group safaris from Kampala — Murchison Falls, Queen Elizabeth & Fort Portal.* |
| 5 | Plain nav labels (**Trips · Wildlife · Route map · Experiences · FAQ**), a solid blurred bar once you scroll so it's always readable, and a booking button that stays visible on phones. |
| 6 | Every long section has a **"Skip ↓"** button, and the pinned scroll lengths are about a third shorter. |
| 7 | The form now offers **Send on WhatsApp** as the main action (pre-filled with the trip, dates and group size) and email as the alternative. *Book this trip* pre-selects the trip in the form. A **sticky WhatsApp / Book bar** appears on phones after the hero. |
| 8 | Lazy loading everywhere: gallery photos, Game media and the 3D map only load as you approach; the hero loads one clip at a time and paints its poster instantly; map heights are compressed (6.7 → 4.1 MB). |
| 9 | Re-encoded every clip at much higher quality (1080p desktop hero, 720p elsewhere, 540p phones cut from 720p sources); lighter grade, half the grain, softer vignettes. |
| 10 | Labels bumped to 12 px with higher contrast. |
| 11 | "Swipe →" hint on the phone Experiences row. |

## Results after the changes

Re-tested with the same method (production build for loading, dev build for flows).

| Measure | Before | After |
|---|---|---|
| Screens until the first trip (desktop / phone) | 30.2 / 30.5 | **1.1 / 1.1** |
| Clicks from a trip to a pre-filled booking | — (no trip-to-form link) | **1** ("Book this trip") |
| Screens until the booking form, scrolling only (desktop / phone) | 36.4 / 41.4 | 32.1 / 40.1 — but the form is now one tap away from every trip card, the nav and the phone action bar |
| Total page length (desktop / phone) | 38 / 45 screens | 33.6 / 43.7 screens, with *Skip* on every long section |
| Requests in the first 9 s | 74 | **12** |
| Data in the first 9 s | 11.9 MB (photos, posters, map data all at once) | ~10 MB, almost all of it the hero video *streaming* while it plays; the page itself (JS, CSS, poster) is ~0.35 MB |
| First thing painted (hero poster) | waited for a video frame, up to 7 s | ~0.1 s on localhost; preloader capped at 2.5 s |
| 3D map data | 6.7 MB, fetched 6 s after load | 4.1 MB, fetched only once the visitor reaches the Wildlife section |
| Video quality | 720p @ CRF 31, phones 360p | 1080p desktop hero, 720p @ CRF 23, phones 540p from 720p sources |
| Booking needs an email app | Yes | No — WhatsApp first, email optional |

Verified flows: *Book this trip* → scrolls to the form with the trip pre-selected and the name field
focused; *Send on WhatsApp* → opens WhatsApp with trip, month ("December 2026"), group size and
interests pre-filled; *Day by day* → opens the matching itinerary with price and inclusions on top.

**Still open (needs the business):** prices, real contacts, guide names/photos, real guest quotes,
licences/credentials, next departure dates — see the list above. Also check that the *Included / Not
included* lists match what you actually provide; I wrote them from the trips in the photos.
