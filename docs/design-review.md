# Design review: the 10 rules

Reviewed 28 October 2026. Scope: every screen of the public site (`index.html`) and the photo admin portal (`admin.html`).

The rules:

1. Remove middle-dot separators.
2. Cut helper text that makes up for a confusing layout, and fix the layout.
3. Write for the actual user: clear language, appropriate tone, no made-up words.
4. Use Radix colors and follow Radix's usage guidance.
5. Use 3 text sizes, 4 at most, nothing below 12px; build hierarchy from weight, color and spacing.
6. Align elements optically and make nested corner radii concentric.
7. Use 0.5px borders and dividers.
8. Remove arbitrary rounding, decorative shadows and colored left-edge stripes on cards.
9. Keep animation minimal; when it's needed, use 250ms ease-out.
10. Remove unnecessary choices, and put necessary decisions where users already expect them.

Line numbers are where each problem was found, before it was fixed. Everything under "Violations found and fixed" is fixed.

## Violations found and fixed

### Public site

| # | Rule | Where (before the fix) | Problem | Fix |
|---|---|---|---|---|
| 1 | 4 · accessibility | `src/styles/main.css:192` | Gold buttons: white on Radix gold 9 is 3.65:1, below the 4.5:1 that small text needs. Affects Book a trip, Book this trip, Plan my trip and Play the journey. | Text on a step-9 fill uses `--on-solid` (#101211): 5.15:1, and 4.53:1 on hover. |
| 2 | 4 · accessibility | `main.css:642`, `:644` | "Added to trip": white on gold 9 (3.65:1) | Dark `--on-solid` text and icon |
| 3 | 4 · accessibility | `main.css:744` | Checked form chips: white on gold 9 (3.65:1) | Dark `--on-solid` text |
| 4 | 4 · accessibility | `main.css:982` | Phone bar's "See trips & book": white on gold 9 (3.65:1) | Dark `--on-solid` text |
| 5 | 4 · accessibility | `main.css:980` | Phone bar's WhatsApp button: white on grass 9 (3.03:1) | Dark `--on-solid` text (6.21:1) |
| 6 | 4 · accessibility | `main.css:850` | Story "sample" badge: white on red 9 (3.91:1) | Radix subtle pair, red 11 on red 3 (4.54:1 light, 7.75:1 dark) |
| 7 | 4 | `main.css:62` | Text selection: white on gold 9 | Dark `--on-solid` |
| 8 | 4 · accessibility | `main.css:437` | Map stop list: text at 50% opacity, about 4.4:1 at 13px | `--bone-dim` (gray 11, 8.98:1) |
| 9 | 4 · accessibility | `main.css:464` | Map drive log: older entries at opacity 0.55 | Gray 11 text instead of transparency |
| 10 | 4 · accessibility | `main.css:479` | "Also nearby" line at 60% opacity | Gray 11 |
| 11 | 9 | `main.css:366–367` | "Loading satellite terrain…" pulsed in a 1.6s infinite loop | Plain static text |
| 12 | 6 | `main.css:918` | "3 days, 2 nights" pill sits 12px inside a 22px corner, so its corners weren't concentric | 14px inset, 8px radius (22 − 14) |
| 13 | 6 | `main.css:610` | Experience trip label: a pill 14px inside a 22px corner | 8px radius (22 − 14) |
| 14 | 6 | `main.css:613` | Experience play button: a circle 14px inside a 22px corner | 8px radius |
| 15 | 6 | `main.css:271` | Hero slide place line: right-aligned with trailing letter-spacing, so it sat 0.12em left of the title's edge | Letter-spacing taken back with `margin-right: -0.12em` |
| 16 | 6 | `main.css:935` | "Book this trip" wrapped onto two lines inside its pill on phones, with the text off-centre | Labels stay on one line; the second button moves to its own row when the two don't fit |
| 17 | 3 | `index.html:189` | "Big species, zero stock": "stock" is unclear | "Big species, none from stock photos" |
| 18 | 3 | `index.html:190` | "3 days per trip" is wrong now that Moyo runs 4 days | "3–4" |
| 19 | 2 | `src/modules/ui.js:88` | "Hover to play" tooltip makes up for an icon, and phones have no hover | "Has a video" |

### Admin portal

| # | Rule | Where (before the fix) | Problem | Fix |
|---|---|---|---|---|
| 20 | 1 | `admin.html:7` | "Photo admin · Hineni" | "Hineni photo admin" |
| 21 | 1 | `src/admin/admin.js:168`, `:187` | Middle dots between spot names, and between "Put back" and "Delete for good" | Commas; the two links are separated by spacing |
| 22 | 1 | `src/data/slots.js:12–13, 17–18, 20`; `admin.js:373–374, 431` | Spot groups and labels such as "Hero slideshow · computers" and "Fort Portal & · card" (the trip name was also cut off) | "Hero slideshow on computers"; "Fort Portal & Queen Elizabeth: card". Stored spot IDs are unchanged. |
| 23 | 3 | `admin.js:344` | "Making web sizes…" is jargon | "Preparing for the website…" |
| 24 | 4 | `src/admin/admin.css:2–16` | Its own paper, forest, green and terracotta palette | The Radix light scales used by the site's light sections: sage, gold and red |
| 25 | 5 | `admin.css:25, 37, 49, 52, 55–56, 61, 63, 69, 74–75, 77, 88, 91, 98, 111, 120–121, 133, 144, 147, 153, 155, 161–162, 171, 177, 179–180, 189–190, 198, 208–210, 212, 217` | About nine text sizes, from 11px to 44px | Three sizes: 13px, 16px, and 22–30px |
| 26 | 7 | `admin.css:36, 51, 61, 82, 105, 116, 137, 147, 193, 206, 211` | 1px and 2px borders, including a 2px dashed drop zone | 0.5px everywhere |
| 27 | 8 | `admin.css:73`, `:138`, `:217` | Sign-in card shadow, the "new photo" glow ring, and the toast shadow | Removed; a new photo is marked by a gold border and tint instead |
| 28 | 8 · 6 | `admin.css:20` and the mixed 6, 8, 10, 12, 16 and 18px radii | Arbitrary rounding | 4, 8, 14 and 22px tokens; nested pieces use outer radius minus inset (badges and thumbnails 14 − 8 = 6) |
| 29 | 9 | `admin.css:37, 105, 125, 126, 168, 171, 173, 218` | 0.2s and 0.5s transitions, an infinite pulse on the processing bar, zoom on hover, and a sliding toast | Every state change is a 250ms ease-out fade or color change; no loops, zooms or slides |
| 30 | 4 | Primary buttons, selected tabs, chips | Forest fill with hand-picked hover colors | Radix high-contrast neutral: gray 12 fill with gray 1 text (16:1), hovering to gray 11 |

## Interaction changes for your review

**This pass** (visual only; no workflow changed):

- Admin, Spots on the page: photos no longer zoom on hover. The "Change photo" label fades in instead of sliding.
- Admin, upload queue: while a photo is processing, the bar no longer pulses. Its status line still says "Preparing for the website…".
- Admin, photo picker: the current photo is marked by its "Now" tag and a 0.5px dark border; the border used to be 2px.
- Admin, toasts fade instead of sliding up.

**Earlier passes (not yet reviewed):**

- The custom cursor is gone. Album photos show the normal pointer cursor instead of a "View" label.
- Trip cards lost "See all N photos" and "See the route on the map"; both sections are in the nav.
- The custom-trip card lost "Ask on WhatsApp", and the About section lost "Talk to a guide on WhatsApp". The enquiry form, which can send by WhatsApp or email, is the one place to start.
- The Trips mega menu lost its "On the map" column and its "Day by day" link.
- Hints removed: "Scroll", the album's "Scroll to travel…", the phone swipe hint, and "keep scrolling".
- Motion removed or shortened:
  - the loader curtain and title slide-in
  - heading line reveals and counting-up stats
  - hover zooms and the slow zoom on hero photos
  - the wildlife flash, shake and blur
  - the map card zoom
  - the hero crossfade, from 1.2s to 0.25s
- Removed outright: the scrolling word strip under the hero, and the giant footer wordmark.
- On screens 820px tall or less, the hero's thumbnail strip and its second paragraph are hidden.
- The map's licence credits moved from over the map to below it.
- The wildlife timecode is hidden on phones.

## Interaction changes made after review (all ten approved)

These were listed here as "needs your call" and are now done. The two wildlife and album items under "Earlier passes" above no longer apply, because those sequences are gone.

| Rule | Was | Now | Where |
|---|---|---|---|
| 9 | Smooth scrolling (Lenis), and 1.4s animated jumps to anchors | The browser's own scrolling; links jump straight to their section. The `lenis` package is uninstalled. Modals lock the page with an `is-locked` class. | `src/main.js`, `src/modules/ui.js`, `package.json` |
| 9 | The hero slideshow advanced by itself every 6s, with a countdown bar | It moves only on the arrows, thumbnails, a swipe or the keyboard. The bars show which photo you're on. The hero no longer parallaxes as you scroll. | `src/modules/hero.js` |
| 9 | Map camera flights took 1.3–3.4s with ease-in-out | Every camera move and route fade is 250ms ease-out | `src/modules/terrain.js` (`flyTo`, `view.apply`) |
| 9 | Wildlife, album and manifesto were pinned scroll sequences | Wildlife is a grid of eight sighting cards. Clips show a poster and play only when someone presses play, with the browser's own controls, and one at a time. The album is the photo wall, in the page. The manifesto is still text. The about-photo and quote parallax are gone too. | `index.html`, `src/modules/game.js` (rewritten), `src/modules/tunnel.js` (deleted), `ui.js` |
| 10 | The map's trip bar had trip chips plus Explore a region and Build your own; the drive bar had Pause, speed and Skip | Trip chips and "More", which reveals the two modes. The drive bar shows Pause and "More", which reveals speed and Skip and stays open from leg to leg. | `terrain.js` |
| 10 | Experiences could be picked on the cards and again as form chips | They're picked on the cards only. The form lists them under "Experiences in your trip", each with a remove button, or "None yet. Choose experiences". The form keeps chips only for the extras that have no card (lion and leopard, elephants, photography). | `index.html`, `ui.js` (`renderPicks`) |
| 2 · 10 | Two send buttons, so the email field needed "(not needed for WhatsApp)" | "Reply to me on: WhatsApp / Email" comes first. The email field shows only for email, and one send button follows the choice. The helper text is gone. | `index.html`, `ui.js` (`syncVia`) |
| 10 | The album had two rows of filter buttons | One row of trip buttons, plus a "What it shows" select at its end | `ui.js` (`initGallery`) |
| 10 | A sound toggle in the nav | Removed. Each wildlife clip has its own sound control, and the hover previews on experience cards stay muted. | `index.html`, `ui.js` |
| 9 | A loader held the page for up to 2.5s with a counter | No loader; the page shows straight away | `index.html`, `src/main.js` |

Also changed along the way:
- Photos elsewhere on the page open in the photo viewer and step through their trip's photos; they used to fly you into the 3D album.
- The form's "Both — make it a week" option now reads "Two trips as one week".
- WhatsApp messages include the experiences picked on the cards, and an email address only when replying by email.

Checked after these changes:
- No loader, no Lenis, no sound toggle.
- The slideshow stays still for 7 seconds and moves on the arrow.
- No pinned or scrubbed ScrollTriggers are left.
- None of the wildlife clips play on their own.
- Album filters by trip, then by trip and type, and resets.
- A photo elsewhere on the page opens the viewer and locks the page behind it.
- The map's "More" shows and hides the modes.
- The form's trip list adds and removes, and stays in sync with the cards.
- The reply channel switches the email field and the button label.
- A blank name blocks sending.
- The WhatsApp text lists the picked experiences.
- Anchor links jump.
- At 375px there's no horizontal overflow.
- The production build passes.

**Not checked live:** the drive bar's "More". The browser pane was hidden, so the map's animation frames were paused and a drive never started. Only the code was checked.

## Checks run

- **Static audit** of `src/styles/main.css` and `src/admin/admin.css`:
  - no raw pixel font sizes (every size is a token)
  - no border or divider thicker than 0.5px
  - no `box-shadow`
  - every transition is 250ms ease-out
  - the only keyframe animations are 250ms fades
- **Contrast** (WCAG): every text and fill pair in both palettes passes AA. The tightest are 4.53:1 (dark text on gold on hover, light sections) and 4.54:1 (the red badge). The odometer's tenths digit stays white on red 9 (3.91:1), which passes as large text at 30px bold.
- **Rendered page, desktop 1440×900:**
  - exactly four text sizes (13, 16, 30 and 81px)
  - no middle dots
  - no solid-background text below AA, except a false positive on the hidden sticky trip bar (light text on a 92%-opaque dark bar, checked by hand at 16:1)
- **Workflows**, all working as before:
  - Add to my trip: the nav badge, form chip and sticky bar all update
  - experience filter
  - itinerary tabs
  - lightbox open and close
  - the mega menu's "Custom trip" opens the form with "Something custom" selected
- **Phone screens (375px):** hero, trips, experiences, field notes, form, map, wildlife, footer, admin sign-in.
- **Production build** (`vite build`) passes.

## Unresolved

- **Admin, signed-in screens** (album, spots, trips, picker): not viewed in a browser. They need the API server and an account, so they were checked by audit only.
- **Overlays on photos** use sage 1 and sage 12 at partial opacity. That's close to Radix's published sageA alpha scale, but not those exact values.
- **WebGL scenes**: the album's chapter cards, map lighting and floating particles are drawn in WebGL. Their colors now follow the palette, but text drawn inside 3D scenes isn't covered by the CSS text-size rule.
- **Optical alignment** was checked on the hero, the cards and the buttons. Desktop layouts were measured rather than reviewed pixel by pixel, because the preview pane is narrower than 1440px.
- **Admin radius**: badges and queue thumbnails use 6px. That's the concentric value (14 − 8) and sits outside the four radius tokens.

## Follow-up: the 3D album on large desktop screens

You asked to keep the zooming album on big screens, so the 3D fly-through is back there. This brings back the scroll-pinned motion that rule 9 asked us to cut, but only on large desktop screens.

- **Large desktop screens** (1200px or wider, with a mouse or trackpad): the 3D fly-through, with its trip buttons and "Back". Its "Grid view" opens the photo wall as a panel. Photos elsewhere on the page fly you into the album at that photo.
- **Phones, tablets and smaller laptops:** the photo wall in the page, as before. Photos elsewhere open in the viewer.
- **The choice is made once, when the page loads.** Resizing a window across 1200px doesn't switch modes until a reload.
- **Code:** `albumIs3D()` and `mountAlbum3D()` in `src/modules/tunnel.js`, restored from backup. Its scroll jumps now use the browser's own scrolling. The fly-through's markup waits in `<template id="albumTunnel">` in `index.html`.
- **Also fixed:** the trip label "Fort Portal & QE" now reads "Fort Portal & Queen Elizabeth".
