# shabbat-songs-fix — decisions

Fixes to the shabbat-songs review. Format: **choice** — why — alternative. Files as shabbat-songs: `src/sim/choreo/g3/song.js`,
`src/sim/choreo/g6/musaf.js`, `src/sim/choreo/g6/common.js`, `src/data/zones-content.js`. The three review points all
need a change in files this task does not own; each is passed on below with the exact change.

- **The musaf's fallback concert: `musaf.js` publishes the style its trumpeters are timed by (`plan.song.style`, with
  `plan.song.song`). Requested from sim (shabbat-musaf.js:94): `ctx.audio.libation({ song: song.song, style: song.style,
  caption: false, trumpets: song.table, benArza: song.benArza, walk: song.walkS })`, then drop the `PSALM_STAND_IN` import,
  after which this task deletes the export.** This replaces shabbat-songs.md's request, which named only the song. — The
  fallback runs only when libation-song does not claim the musaf, and it claimed it in every run. Measured in the page
  (the live `libationTimeline` of each call against the fallback plan's timeline, 2026-10-31 … 12-05, all six sections):
  - As the call stands (`psalm: 92`), the audio's sets and end fall 25–87 s from the trumpeters'.
  - With `song` alone they agree to 0 s under the default musicStyle, but are 1.8 s off under 'sg1612', since the
    trumpeters are timed with 'mishnah'.
  - With `song` and `style` they agree to 0 s on every section under both settings.

  The alternatives were:
  - a constant `PSALM_STAND_IN = 'haazinu'`. The audio resolves a psalm-named song with week 0, so it would always sing
    section 1.
  - a per-date mutable export, which is hidden coupling for a path that is not used today.
  - timing the fallback trumpeters by Psalm 92 again: in step, but the wrong song, and the shabbat-musaf.js fix would
    then need this file changed too.
- **The musaf pour's two captions: requested from sim (shabbat-musaf.js:145–151). When `P.claimed`, the `musaf-song`
  caption names only the pour and the nine blasts (Sukkah 5:5). It keeps the Ha'azinu section only in the fallback,
  whose audio captions are off.** — On the claimed path the audio's heading ("Shabbat musaf: the Levites sing Ha'azinu,
  section 6 of 6: "For I lift up My hand to heaven" (part 1 of 3 …)") comes 0.9 s after the pour, the first verse at
  1.15 s, and G6's caption at 3 s. The HUD keeps two captions, so the third pushes the heading off within about 2 s,
  and two of the three name the same section. The alternative was for ketoret-morning to pass `captionHeading: false`
  on the musaf's first part. Every other concert shows that heading, and it carries the part's verse range, so it stays.
- **Stale text left by shabbat-songs (requests to the owners). This log and shabbat-songs.md supersede all of it:**
  - choreo-g3-sanctuary.md: lines 48–52 (the Shabbat afternoon sung to Psalm 92 with its caption off), 65 (the musaf "with
    G6's Psalm 92 stand-in and its captions off") and 186 ("the Psalm 92 caption off"). Line 214 is a dated verification
    and was true when it was written.
  - choreo-g6-shabbat.md line 88 ("Psalm 92's melody stands in"), and shabbat-musaf.js's header lines 17–19 (the same
    words).
  - DECISIONS-TO-REVISIT:
    - G5 and L4 are resolved: both concerts sing Ha'azinu and the Shirah.
    - B20's "The Ezrat Nashim info text does not mention them" is no longer true: zones-content.js names the thirteen
      shofarot.
  - docs/API.md line 394 "(the Psalm 92 stand-in G3/G6 sing today)" and the `[{}, [0]]` entry of src/audio/index.js
    `songsFor()`, which the audio-2-fix log says can go once both have switched (they have).
  - src/sim/dev/tests/g3.js:
    - Header lines 10–11: the afternoon now has one 'song-shirah' caption, and the audio's own captions are on.
    - `pmCaptionOff` (line 188) now reports false, and nothing asserts on it. It could become a check that the
      afternoon cues `song: shabbatSong('afternoon', date)`.

  The alternative was to edit those files. Each belongs to another task (ARCHITECTURE §2).
