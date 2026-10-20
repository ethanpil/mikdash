# audio-2-fix — decisions

Format: **choice** — why — alternative. Fixes to the audio-2 review. This log supersedes two points of `audio-2.md`:
the 'choir' loop's verse captions are no longer on by default, and the Shabbat musaf / afternoon prefetch is no longer
Ha'azinu / the Shirah alone.

## The render cache

- **Musical options are normalised in one place (index.js `concert().music`): an explicit psalm or song wins, else
  `opts.weekday`, else the clock's weekday. `weekday` is then deleted.** — Before the fix, the scheduler's
  `prefetchLibation({})` was cached as `{psalm, section, style, weekday}`. G3's cue `{psalm, section, style}` was a
  second key, so every section was rendered twice and the cued one joined late (review: Ps 48 section 1 at offset
  23 s). After the fix (live, low, Monday 07:16): there are three entries, no `weekday`, and G3's section 1 starts at
  offset 0. A caller's `weekday` was ignored before (the clock overrode it); it is now honoured, as the pure
  `libationTimeline` already documented. The alternative was to drop 'weekday' from the synth keys. It is only the
  synth's fallback for a missing psalm, so it stays for engine-direct callers.
- **Prefetched concerts are held, not pinned: `renderer.get(…, { hold })` keeps a buffer from eviction until a
  `performance.now()` deadline, which a later request extends but never shortens. A finished render counts as used.** —
  On low the budget is 40 MB, of which about 19.4 MB is pinned beds. The renderer set `used` only at request time, so
  the earlier sections of a 115 s Psalm 94 prefetch were evicted as soon as the third finished. A time-based hold
  expires by itself: there is no unpin to forget, and it cannot clash with the 'choir' loop's own pin/unpin of the
  same buffer. The holds:
  - The scheduler holds a concert until its event ends (the real seconds at the clock's speed, capped at 30 min,
    + 2 min). It refreshes the hold every 10 s while the event is due.
  - `libation()` holds its parts until `timeline.done` + 2 min.
  - `ctx.audio.prefetchLibation(opts)` holds for `opts.holdS` (default 600 s).
  - A follow-on render (below) holds for 10 min.

  Measured (cache-live.js, low): Psalm 94's three sections, 7.2 + 8.5 + 8.7 MB, all still cached 2 min after they
  finished, with other cues rendered meanwhile. The cache then held 53 MB against the 40 MB budget, of which about
  9 MB was stale cues waiting for the next eviction pass. The budget was not raised: the overshoot lasts only through a
  concert, and the other cues give way. The alternative was pinning with an unpin at the event's end, which needs
  bookkeeping per concert and clashes with the loop's unpin.
- **Follow-on: when choir-psalm section s is cued (sound running), sections s+1…2 of the same song are queued at low
  priority.** — Whatever song a choreography actually sings, its later sections are ready before they are due (G3
  cues them minutes apart; libation() already queued them). The cost is no extra work when they are already cached
  (the request is a cache hit). The alternative was to trust the scheduler's guess alone.

## Shabbat

- **The Shabbat musaf / afternoon events prefetch only the opening section of both the psalm of the day (Psalm 92)
  and shabbatSong() (Ha'azinu / the Shirah of the week). The follow-on renders the rest of whichever is cued.** —
  G3 and G6 still sing Psalm 92 there as a stand-in. Fetching only the real songs wasted 1–2 min of Worker time per
  Shabbat, and the Psalm 92 they cue rendered late. This works before and after they switch to
  `song: 'haazinu' | 'shirah'`, without coordination. The waste is one opening section of the song not sung. The musaf's
  Psalm 92 opening is usually still cached from the morning song. Once both have switched, the `[{}, [0]]` entry in
  index.js `songsFor()` can go. The alternative was to fetch the psalm of the day only, which would turn wrong the day
  they switch.

## Captions

- **The 'choir' loop captions its verses only when `opts.caption === true`.** — Before audio-2, loops never captioned.
  Turning that on by default broke the additive rule. On Shabbat, G3 loops Psalm 92 under its own Ha'azinu / Shirah
  headings, and the loop named "Psalm 92:n" against the staged service (review: 08:22 and 14:41 on Shabbat
  2026-10-24). After the fix there are no loop verse captions in either window. The alternative was to inherit
  caption:false from the cue of the same section, but a loop without a cue then has no rule, and opt-in is simpler.

## The concert's clock

- **`libation()`'s handle adds `started`, a Promise of `{ perf, sim }` at t = 0 (the first blast), or null.** — The
  render wait before the first blast varies (3–20 s). A caller of `libation()` (G6's fallback) needs the real t = 0 to
  map `timeline` onto its staging. Measured: 2.1 ms from the first blast's actual start. The alternative was `opts.at`
  (fix t = 0 in advance). The trumpet blasts cannot join in progress the way a sung section can, so an early `at` would
  play them late or drop them.

## Text

- **Ps 82:6 is rendered plainly: "I had said: You are godlike, sons of the Most High, all of you."** — The audio-2
  log cited Rashi for "judges". Rashi (and Metzudat David) read אלהים אתם as angels; Radak reads it as judges, who are
  called elohim when they judge truly. Under either reading the word is not a Divine Name, so the Hebrew still keeps
  אֱלֹהִים unsubstituted. The citation is corrected in `audio-2.md` and `dev/make-songs.mjs`. The alternative was to keep
  "judges like God" and cite Radak, but that puts one commentary's reading into a plain rendering.
