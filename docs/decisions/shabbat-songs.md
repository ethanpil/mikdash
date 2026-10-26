# shabbat-songs — decisions

The Shabbat musaf and the Shabbat afternoon concerts sing their own songs (Rosh HaShanah 31a) instead of Psalm 92's
chant; the Ezrat Nashim text names the thirteen shofarot. Files: `src/sim/choreo/g3/song.js`, `src/sim/choreo/g6/musaf.js`,
`src/sim/choreo/g6/common.js`, `src/data/zones-content.js`. Format: **choice** — why — alternative. This log supersedes
choreo-g3-sanctuary.md "Shabbat afternoon … the melody is Psalm 92's with its own caption off" and "the audio is the
same separate cues with G6's Psalm 92 stand-in and its captions off", and choreo-g6-shabbat.md "The audio has no
Ha'azinu: Psalm 92's melody stands in" (DECISIONS-TO-REVISIT G5, L4).

- **The musaf sings this Shabbat's section of Ha'azinu, the afternoon the Shirah of the week.** The week is the one
  the captions already use: G6's `haazinuSection` and G3's `shirahOfDate`, whole weeks from Shabbat 2026-01-03 ⚙.
  It goes to the audio as `{ song: 'haazinu' | 'shirah', week }`, and the audio resolves it (`resolveSong`:
  'haazinu-1'…'haazinu-6', 'az-yashir' | 'mi-chamocha' | 'az-yashir-yisrael'). — Rosh HaShanah 31a; the audio has
  had the texts since audio-2. The alternative was the audio's own count (`shabbatWeek` of the date). It gives the same
  numbers, but the captions read G6's and G3's count, so the song is taken from that count too.
- **The concerts are timed by the audio's clock for that song.** `g6/common.js concertClock` calls
  `ctx.audio.libationTimeline`. Before `ctx.audio` exists (the sim initialises before the audio), it uses the pure
  `src/audio/timeline.js` export instead. Every option is given (song, week, style, walk), so the two agree.
  - G6's back-to-back concert (the fallback trumpeters; `musafConcert` sets/blow/cym/ch/prost/end) is that clock
    unchanged.
  - G3 spreads it over the window as `plan.js spreadTimeline` spreads the psalm of the day (`song.js songTimeline`;
    plan.js is not this task's file). The sets, the ends of the blowing, the prostrations, the cymbals, the start and
    last note of each part and each part's 'choir' loop window all come from the clock.
  - Against spreadTimeline's psalm numbers, the blowing ends 0.02 s earlier (the last blast's end, not D_SET − 0.48),
    and a part's last note is the audio's `singEnd`, 0.55 s before the old melody-plus-breath end.
  - Weekday concerts and the Shabbat morning tamid's Psalm 92 are untouched.
- **The song reaches the audio through `T.psalm`.** ketoret-morning (not this task's file) cues each part and the
  'choir' loop with `{ psalm: T.psalm }`. The audio resolves a song id given as the psalm (`src/audio/index.js
  concert().music`: a psalm that is not a daily one goes through `resolveSong`, as `{ psalm: 30 }` does for the
  bikkurim song). `T.song` holds the same id. — Requested from sim: ketoret-morning should pass `song: T.song`, which
  is clearer. shabbat-musaf.js's fallback `ctx.audio.libation()` still passes `psalm: PSALM_STAND_IN` (92) and
  should pass `song: plan.song.song`. Until it does, the fallback (used only when libation-song does not claim the
  musaf) sings Psalm 92 while its trumpeters keep Ha'azinu's time. `PSALM_STAND_IN` stays exported only for that
  call.
- **Captions: the audio captions both concerts.** It shows the section heading and each verse as it is sung,
  as it does on weekdays. G3's three per-part Shirah headings ("the chant heard is a stand-in") are removed, because
  the audio's heading at each part says the same. One 'song-shirah' line at afternoon-song-shabbat t0 + 0.5 names the
  week's song and its verses, taken from the audio's title and verse refs, as 'song-day' names the psalm in the
  morning. G6 still captions the musaf's pour with the Ha'azinu section. — The alternative was to keep the audio's
  captions off with G3's per-part headings, which would show no verses.
- **Ezrat Nashim names the thirteen shofarot** (Shekalim 6:1, 6:5–6). Its text gives the inscriptions, the shofar
  shape (Bartenura on Shekalim 2:1) and the yoledet's use of the kinnin chest (Eruvin 32a). It also says the ring
  near the foot of the fifteen steps is the model's placement (world-4; DECISIONS-TO-REVISIT B20). The kinnin chest
  must be within her reach, since she may not enter Ezrat Yisrael before her offering (Kelim 1:8).
