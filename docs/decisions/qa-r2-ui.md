# qa-r2-fix-ui — decisions

Fixes from the second QA round in src/ui/** (UI-R2-1 … UI-R2-5). Format: **Choice** — why — alternative.
Evidence: shots/qa-r2-fix-ui/before → after; the drivers beside them (about.mjs, reload.mjs, phone.mjs, dbltap.mjs).

## UI-R2-1 — About → Credits licence link
- **`LICENSES_URL = 'third-party-licenses.md'`, the name vite.config.js `build.license` emits and README links.** The
  `.txt` it pointed to is not built: on Pages a 404, under `vite preview` the SPA fallback page. Checked on a scratch
  production build served at `/mikdash/` with no fallback (about.mjs): the link fetches 200, `# Licenses`, the four
  bundled packages.
- **The line now says "the bundled code above", and the typefaces line links the SIL OFL 1.1 text
  (openfontlicense.org, SIL's official page, checked 200).** The emitted file lists only n8ao, postprocessing,
  three-mesh-bvh and three, so "code and typefaces" overstated it. The fonts are served by Google Fonts, not
  redistributed by us, so a link to the licence is enough. — Alternative: have the build append OFL.txt to the file
  (core owns vite.config.js; worth doing once the fonts are self-hosted, qa-r1 UI-10, since OFL then requires the text
  to travel with them).
- **N8AO credited as README does: "ISC in its package metadata; the LICENSE file it ships is CC0 1.0".**

## UI-R2-2 — Settings reload keeps the other build-time parameter
- **`reload(key)` drops only the URL parameter of the setting just changed (it is read from storage after the reload)
  and keeps the other one: a shared `?amah=chazonish` link survives a quality change, a `?q=medium` link survives an
  amah change.** Repro (reload.mjs): quality low → medium on `amah=chazonish&q=low…` reloaded at Naeh (AMAH 0.576 →
  0.48); amah → Chazon Ish on `q=medium…` reloaded at low (auto-detect on the HD 4600). After: chazonish/0.576 at
  medium, same X/Y; chazonish at medium. — Alternative: `S.set('amah', AMAH_KEY)` before reloading (writes a link's
  choice into the visitor's own stored settings, so every later visit would open at that scale).
- **The Quality control shows the tier a `?q=` link runs (it showed the stored one), and picking any other applies.**
  With `?q=low` and nothing stored it showed "Auto"; picking the stored value was a silent no-op although another tier
  was running.

## UI-R2-3 — Short landscape map card (≤ 520 px high)
- **The activity comes straight under the names; rung, access, "Also here" and "Next here" follow it; the speeds and
  Go share one row (Go as "Go", About and This spot as 40 px icons with aria-labels).** Done in CSS
  (`display: contents` on the scroll box, `order`), plus the storey tag ("Upper storey" / "Below ground") moved into the
  names block on every layout, so it stays with the name. Before: at 844×390, 740×360 and 667×375 the first activity
  row was below the 123 px sticky footer for all 8 places measured (the heading at 179–254 px of a 289–319 px card).
  After: footer 67 px, the first row in view in 32/32 cases (four landscape sizes × eight places, phone.mjs), speed
  buttons still 40 px tall. — Alternatives: a "3 happening here" chip that scrolls to the list (one more tap to see
  what the map is for); a two-column card (leaves the map ~270 px wide).
- **The card gets a 340 px floor in short landscape (`min(350px, max(48%, 340px))`); speed buttons size to their
  labels.** At 667 px the 48 % card (320 px) was 1 px short of the row (the speeds need 193 px at minimum), and
  equal-width buttons ran "InstantSlow" together. This Spot (big places, after a tap on open ground) still wraps the
  actions to a second row; accepted.

## UI-R2-4 — First-run touch hints under panels
- **`#ui-root.mk-panel-open .mk-touchhint { opacity: 0 }` (120 ms), opacity only; the 9 s timer keeps running, so the
  hints come back on close if their time is not over.** The joystick ring, the "Drag to look" pill and the two-finger
  pill showed at full opacity through the time and info panels (phone.mjs: opacity 1 → 0 with a panel open, back to 1
  after close, at 667/740/844/932 wide). — Alternative: end the hints when any panel opens (a visitor who opens the
  clock first never sees how to walk).

## UI-R2-5 — Phone double tap on the map
- **Reproduced by its mechanism, not by load.** On this machine the three maptest cases pass (taps 167–175 ms apart),
  also at 6× CPU throttling (9/9, dbltap.mjs). The failing runs had the taps 247–299 ms apart, inside the 340 ms
  window, so the second tap reached something other than the map: the card's tap guard (mappanel `select`, 380 ms from
  the first tap's handling) lapses before an input event that a busy page or machine delivers late. dbltap.mjs replays
  that with CDP touch events stamped 250 ms apart and delivered ~600 ms apart: 0/3 went before, the second tap landing
  on `.mk-mapcard__meta` / the section heading. The "Walking to the Kiyor" in the QA log was the hidden pill's stale
  text (maptest read `textContent` regardless of `hidden`), not a visible pill.
- **view.js decides a double tap by the events' own times, wherever the second lands: a capture-phase `pointerdown` on
  the map's container claims a pointer that pairs with the last tap (< 340 ms, < 26 px) and hands it to the map; the
  `click` that follows is swallowed so it cannot press what was under the finger.** Without the swallow the late tap
  pressed the card's "Instant" speed button, which then persisted as the travel speed. — Alternative: a longer guard
  (any fixed timer can be outrun by a late event).
- **The window runs from the first tap's up to the second's down (the platforms' convention), and the double tap
  reports the place the first tap named, re-projected into the current view.** By the time a late second tap is
  handled the card's reveal has begun to pan the map, and the second tap's own position named another place (2/3 went
  to the wrong spot). After: 6/6 go, each to the first tap's site point.
- **The HUD pill's text is cleared when it hides, and a synchronous throw from `player.goTo` becomes a rejection** (so
  the pill never outlives a walk). maptest now asserts "the walking pill is hidden unless walking" at six checkpoints,
  reports the pill only when shown, and replays the late double tap; the landscape card and the hints under a panel
  have checks too (maptest, uitest).

## Found while running the harnesses — tag taps on phones (same flaw as UI-R2-5)
- **hud.js times a tap on a floating tag by the pointer events' own stamps, not by when they were handled.** uitest
  "phone: a tap on a tag opens the hour at its event" failed once in three runs here. tagtap.mjs replays a 50 ms tap
  whose touchEnd is delivered 700 ms late: ignored 2/2 before (counted as a long press, `performance.now()` > 500 ms),
  opens 2/2 after; a real 700 ms hold is still ignored.
