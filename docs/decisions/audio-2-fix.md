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

# Second review (audio-2-review, 2026-10-20 evening)

This part supersedes, in `audio-2.md`: "No tier pre-renders the song at unlock", the one buffer per section and its
per-buffer level ("CPU and memory", "A late-rendered section joins in progress"), and corrects "The sections".

## Jumping into the song: sections render and play verse by verse

- **A sung section is rendered as one buffer per verse (a "chunk": `synth/chant.js` `melodyChunks`) and played by
  starting each at its place on the section's clock as soon as it is rendered — for the choir-psalm cue and the
  'choir' loop alike.** — A whole section took 13–56 s of Worker time in the page, so the UI's jump to the song (G3
  then starts the 'choir' loop of a cold section) stayed silent that long and joined 13–56 s in (review: Ps 48 low
  13.2 s; Ps 94 low 34 s, medium 55.8 s). Now a join waits for one verse: the chunk being sung renders first, or the
  next one when the render-speed estimate (`renderer.musicRate`, a running mean of the music lane's Worker seconds per
  second of audio; +1.5 s for a cold Worker) says it would finish after its verse ends; a chunk that arrives late joins
  in progress with a 0.5 s fade. The alternative was the review's minimum alone (pre-render section 1 at unlock), which
  leaves low and sections 2–3 cold.
- **Where a section is cut:** every verse ends with a cadence and a breath of at least 0.55 s in which no voice sounds
  (measured: 45–124 dB below the singing), so a chunk starts 0.35 s before its verse's first note (onset consonants
  ≤ 0.2 s, the singers' lag and jitter ≤ 0.06 s) and ends 2 s after its breath — about 4 s after the cadence's nevel
  pluck, which the next chunk's own plucks then cover; chunks overlap there and are summed. The last chunk ends where the
  whole section did. To make a chunk the whole section's notes: each singer's timing is still drawn for every note of
  the section, the next verse's first note is passed as a ghost (it ends the last syllable as in the whole section), and
  each note's string plucks draw from their own random stream. What differs is only each voice's free-running phase,
  vibrato and drift, which start afresh in each chunk.
- Cost (node, low, songs-test): the first verse renders in 0.3–0.7 s; all chunks of a section take about the time of the
  whole (0.98–1.33×); memory 1.09–1.23× (the overlaps). In the page the music lane ran at about 0.55 s per second of
  audio on low.
- Measured live (song-live.js, low): a cold section (Ha'azinu 2, part 2) cued at once sang after 5.9 s, joined at 5.94 s
  on its clock (6 ms error); the next verse joined 2.5 s late, so about 3 s had only the strings' tail (audio-2: the whole
  section joined after 13.8 s). A cold 'choir' loop asked for 30 s into Psalm 94 part 2 (69 s) sang after 4.8 s, at
  34.82 s on its clock, exactly where the clock was; the next three verses started on time. The libation concert played
  every part within 10 ms of `libationTimeline`; a time jump still clears the verse captions.
- Jump probe (the review's scenario: unlock, 6 s, the UI's jump to song-weekday at 1×, G3's 'choir' loop of section 1;
  `shots/audio-2-fix/probe-jump-song.*`). First singing after the jump, and where it joined on the section's clock:
  Monday, Psalm 48, low: 0.16 s, 0.11 s in (review: 13.2 s, 13.19 s in); verse 2 then joined 1.8 s late while it
  rendered, the rest on time. Wednesday, Psalm 94, low: 0.16 s, 0.14 s in (review: 34.0 s); medium: 0.33 s, 0.21 s in
  (review: 55.8 s, 55.76 s of 58.6 s in); on Wednesday every later verse started on time, on both passes. The first verse
  was ready from the unlock pre-render; without it (a section 2–3 or a Shabbat song) a join waits about one verse's
  render, 4.8–5.9 s on low (above). The only captions were G3's "song-day" line (finding 3, below). Console clean.

## One level for a whole section

- **The choir's output gain and strings balance are calibrated once per choir configuration, on a fixed phrase it
  sings (Psalm 150:4, which names no Divine Name), and applied to every verse and to whole sections; the standard choirs'
  values (4 tiers × mishnah / sg1612 four voices / sg1612 all × flute day) are precomputed in `synth/choir-cal.js`,
  written and checked by `dev/songs-test.mjs`.** — Normalising each verse on its own loudest 400 ms spread the verses of a
  section over 3–4.4 dB, because the loudest window of a unison choir is a chance alignment of its voices (the old whole
  sections carried the same noise from section to section). With one gain, each verse rendered alone is within ±1.3 dB of
  the same verse in the whole section (the residue is the voices' free-running phase, which differs between any two
  renders). Computing the calibration at run time took 1.5–2.4 s in node, about 5 s in the page, on a Worker's first
  song render; a 5 s phrase was cheaper but varied ±1.2 dB between configurations. A non-standard choir (opts.men)
  is calibrated once per Worker. The alternative was per-verse normalisation with a steadier statistic (the 90th
  percentile: still 1–2.3 dB between verses).
- **Level: `CHOIR_REF_DB` −21 dB for the reference.** A section's loudest 400 ms now has a median of −15.3 dB on low,
  −14.4 on medium, −15.5 on high, −15.0 for sg1612 (was exactly −16 per section); peaks −3.6 to −8 dBFS. The calibration
  holds the reference's gated mean level equal on every tier, which is what is heard. Live (song-live.js B, low): singing
  median −17.9 dBFS, peaks −10.9 dBFS against a −34.2 dBFS bed (audio-2: −17.4 / −11.5 / −33.4).

## What renders when

- **At unlock the music Worker renders the opening of the day's song at idle priority: the first section on medium and
  up (as audio-1 did), its first verse on low.** — The review's minimum; it also starts the Worker (a cold one costs
  ~1.5 s more on the first verse). Priority 0 delays a requested verse by at most the one chunk being rendered.
- **`libation()` waits for the blasts and the first verse of section 1** (was the whole of section 1): the rest renders
  verse by verse during the 15–40 s of the first set, the walk and the pour. When section 1 is a single verse (the Song
  of the Well) the wait is the same as before (live: 10.1 s on low with the blasts rendered cold).

## The sections (review finding 2)

- **Correction: the psalms' division is audio-1's section starts — about equal thirds by verse count — not "the sense
  break nearest each third".** audio-1 sang "the opening verses of each third" (`audio.md`), and the user asked to keep
  that division. 11 of the 14 breaks also fall at a sense break (24:6|7 and 48:9|10 at a Selah; 94:7|8, 94:15|16,
  81:6|7, 81:11|12, 82:5|6, 92:6|7, 92:12|13, 93:2|3, 93:4|5), but three do not: 24:3|4 separates the question "Who may go
  up the mountain of the Lord?" from its answer (4–6), with a blast and a prostration between them; 48:5|6 cuts the story
  of the kings (5–8); 82:3|4 cuts the paired commands (3–4). The audio-2 log's reason against equal counts ("they cut
  24:3/4") was wrong: the kept division makes that very cut. Corrected in `audio-2.md` and the `songs.js` header.
- **Not changed, for the user to decide:** breaks at Selah and sense units would be 24: 1–2 | 3–6 | 7–10, 48: 1–4 |
  5–9 | 10–15, 82: 1–2 | 3–5 | 6–8 (Selah ends 24:6, 24:10, 48:9, 82:2), the rest unchanged. It is a one-line change
  per psalm in `SONGS`; choreographies that stage by `sectionTiming` / `libationTimeline` follow it.

## Smaller fixes

- **tempo reaches the render** (review finding 4): 'tempo' is a synth key of choir-psalm and 'choir' and is passed to
  `renderPsalm`; `music()` drops tempo 1, so it shares the cache entry of a cue that does not name it. songs-test checks
  that a tempo 1.2 render is the length `sectionTiming` gives. The alternative, removing tempo from the timeline, would
  have broken a documented option.
- **A cycle named without its week** ('haazinu', 'shirah'; finding 7): `ctx.audio` takes the week of opts.date or the
  clock's date — `shabbatWeek`, the count `shabbatSong` uses — so it sings this Shabbat's part, not always the first. The
  pure exports take opts.date the same way, else week 0 as before (no date in node).
- **Four words of Ha'azinu in the Sefer Torah's spelling** (finding 5; `make-songs.mjs` SPELLING, checked against Miqra
  according to the Masorah): Dt 32:7 דֹּר־וָדֹר, 32:24 בְּהֵמֹת, 32:27 יָדֵנוּ (Leningrad דּוֹר־וָדוֹר, בְּהֵמוֹת, יָדֵינוּ) — and
  32:34 חָתוּם, where the review had the direction reversed: Leningrad (our caption) has חָתֻם and MAM חָתוּם (the review's
  own MAM comparison and both cached editions agree). Regenerated from the review's cached Leningrad files: only these
  four words changed. The chant is unchanged (the same pronunciation; 32:27 keeps the chant's "ya-dei-nu" vowel colour).
- **Ps 81:4: "at the time the moon is covered"** (finding 6) — Rosh HaShanah 8a–b: the festival on which the moon is
  covered is Rosh HaShanah; "at the full moon" is the modern reading.
- **The 'choir' loop's verse captions after a jump** (finding 3): no audio change. The loop captions with opts.caption:
  true (the first fix made that opt-in because G3 loops Psalm 92 as a Shabbat stand-in); G3 is asked to pass caption:
  true on weekdays and offset = seconds since the section's cue start. The alternative, captioning any loop started with
  an explicit offset, is implicit, and G3 passes no offset today, so it would not help either.
