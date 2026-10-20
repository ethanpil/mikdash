# audio-2 — decisions

Format: **choice** — why — alternative. Everything the sources do not fix is reconstruction. This log supersedes two
bullets of `audio.md`: "The cue sings the opening verses of each third" (now whole sections) and "What is pre-rendered
when" (the song is no longer rendered at unlock on any tier).

## The texts (src/audio/songs.js, songs-text.js, dev/make-songs.mjs)

- **Whole sections: every verse of the psalm or song is sung, in three sections.** — The libation concert has three
  sections with a teki'ah and a prostration at each break (Tamid 7:3); singing only the first verses of each and looping
  them misrepresented the service. The alternative was the first verses only (the old behaviour).
- **The Hebrew comes from the Westminster Leningrad Codex** (public domain; tanach.us, through Sefaria's "Tanach with
  Ta'amei Hamikra"). The generator (`src/audio/dev/make-songs.mjs`) fetches it and writes `songs-text.js`. Caption
  Hebrew keeps the vowels, drops the cantillation and uses the qere (Ps 24:6 דֹּרְשָׁיו, Ps 92:16 עַוְלָתָה,
  Dt 32:13 בָּמֳתֵי). — Typing 159 verses from memory risks letter errors. Miqra according to the Masorah would also do,
  but it is CC-BY-SA.
- **Divine Names are written in their customary substitutes: ה׳ for the Tetragrammaton, אֲדֹ-נָי (Ex 15:17),
  אֱלֹקִים / קֵל / קָהּ. The chant sings Hashem / Elokim / Kel / Kah. Elohim and El used of judges or other gods stay as
  written:** Ps 82:1 (the second), Ps 82:6 (Rashi and Metzudat David: angels; Radak: judges, called elohim when they judge truly), Ps 81:10, Dt 32:12, 17, 21, 37, 39. — This follows
  `audio.md` ("a simulation, not liturgy"). The alternative was to substitute every occurrence, which would misrepresent
  the profane uses.
- **English: our own plain rendering, close to the Hebrew.** Divine Names: "the Lord" and "God". Kinnor and nevel keep
  their names in Ps 81:3 and 92:4. — JPS and other modern translations are copyrighted, and the user asked for our own.
- **The chant's syllables are generated from the vowels, with the stress taken from the accents.** The stressed
  syllable is the one carrying the word's non-positional accent: segolta, pashta, telisha, zarqa, yetiv, dehi and
  geresh muqdam are positional. A doubled pashta marks the first syllable; silluq marks the last word. Retracted stress
  (nasog achor, e.g. Ps 24:1 וְיֹ֣שְׁבֵי בָהּ) follows the Masoretic text. Half-verse ',' (the psalm tone's mediant) goes
  after etnach, and in Psalms also after ole-veyored. A half-verse over 18 syllables is split at the strongest
  disjunctive near its middle. A sheva is vocal at the start of a word, after a word-initial shuruk, as the second of
  two shevas, under a strong dagesh, after an accented long vowel, and before the same letter. Qamatz katan applies
  only to unaccented maqaf words (kol-) and to the kodesh / ozen nouns. — The choir need not pronounce the words, but
  the syllable count, stress and phrasing set the melody's timing, and the captions are timed by it. A hand-typed
  transliteration (as in the first version) would be about 4,000 syllables to keep in step with the Hebrew. The
  pronunciation is a neutral Sephardi-like reading. The ancient one is not claimed.

## The sections

- **Psalms keep the first version's division:** the sense break nearest each third. The sections start where that
  version's "opening verses" started: 24: 1–3 | 4–6 | 7–10 · 48: 1–5 | 6–9 | 10–15 · 82: 1–3 | 4–5 | 6–8 ·
  94: 1–7 | 8–15 | 16–23 · 81: 1–6 | 7–11 | 12–17 · 93: 1–2 | 3–4 | 5 · 92: 1–6 | 7–12 | 13–16. Superscriptions are
  sung (81:1, 48:1). — The Mishnah fixes three sections, not where they fall. The alternative was equal verse counts,
  which cut through sense units (e.g. 24:3/4, a question and its answer).
- **Shabbat afternoon (Rosh HaShanah 31a, R' Yochanan; one per Shabbat, "each Shabbat they said one"):** "Az yashir"
  is Shemot 15:1–10, up to "Mi chamocha". "Mi chamocha" is 15:11–18, to the end of the song (Rashi). "Az yashir Yisrael"
  is Bamidbar 21:17–20 (Rashi: "of Ali be'er"). Their three parts: 1–3 | 4–7 | 8–10 (about equal length; the sense
  strophes 1–5 | 6–8 | 9–10 would be 5:3:2), then 11–13 | 14–16 | 17–18 (sense), then 17 | 18 | 19–20. — The Song of
  the Well's extent is not given. 18b–20 is the well's journey in Rashi's reading of Bamidbar 21:18–20. The
  alternative was 17–18 only, two verses for three parts.
- **Shabbat musaf: Ha'azinu in six, one each Shabbat (הזי"ו ל"ך, RH 31a), divided as Rambam Tefillah 13:5 gives the
  synagogue reading: 32:1, 7, 13, 19, 29, 40.** The Gemara says the musaf's division is the synagogue's. G6 already
  stages these six. Each section is sung in three parts of sense: 1–2 | 3–4 | 5–6 · 7–8 | 9–10 | 11–12 ·
  13–14 | 15–16 | 17–18 · 19–21 | 22–25 | 26–28 · 29–31 | 32–35 | 36–39 · 40–41 | 42 | 43. — Rashi on RH 31a reads
  ל and ך as לולי (32:27) and כי ידין (32:36), "eight verses each" after the fourth. That variant is not used.
- **The cycles' phase (which week sings which) is G3/G6's:** whole weeks from Shabbat 2026-01-03, ⚙ not recorded.
  `shabbatSong(service, date)` uses the same count, only to pre-render the right song.
- **The Torah songs are sung to the same psalm tone.** — No melody is preserved (audio.md). One reciting-tone chant
  for all the Levites' song keeps one sound world. Rashi on RH 31a.12 says the sections were divided "by the melody,
  by changing instruments and by trumpet blasts"; the blasts are what we stage.

## Timing and captions

- **Timing is computed from the same code that renders (`synth/chant.js`, pure), not measured.**
  `libationTimeline(opts)` and `sectionTiming(opts, s)` work synchronously, before any render, with sound off, and in
  node. Buffer length = melody + 3.5 s ring-out (checked in node and live: 22.813 s computed and played). The
  alternative was to measure the rendered buffer, which needs the render first and gives no answer with ?audio=0.
- **Captions per verse: a heading at the section start, then each verse (English with its reference, and the Hebrew)
  0.15 s before its first note, shown until the next verse.** The track starts on the real clock when the section is
  due, so the text is not held up by a slow render and shows with sound locked (a viewer with sound off still reads
  the song). While the buffer sounds, it follows the buffer's own playhead on the AudioContext clock, which holds
  through a suspended context. The same audibility gate as the other calls applies. Measured live: within 0.15 s of
  the computed onsets, locked and running. The alternative was one caption per section, which does not show what is
  being sung.
- **A late-rendered section joins in progress** (the playhead and the captions keep the timeline's clock) instead of
  starting late or being dropped after 15 s. Measured: rendered 6 s late, it started at offset 5.98 s (1 ms off), with
  the verse then being sung captioned. `opts.catchUp: false` restores the old behaviour.
- **The 'choir' loop plays the choir-psalm cue's own buffer (one render, one cache entry) on its own real-time clock:
  from `opts.offset`, or straight after a choir-psalm cue of the same section that is still sounding.** It is pinned only
  while some loop uses it. With the old staging, G3's loop started 5 s before the short cue ended; with whole sections
  it would have doubled the singing. The alternative was a second render of the same section for the loop, which
  doubles the Worker time and memory.
- **`libation()` is driven by `libationTimeline()`.** The two cannot disagree (live: every part within 3 ms). It waits
  only for the blasts and section 1; sections 2–3 render meanwhile, more than a minute before they are due.
  `opts.gap` adds a pause after sections 1 and 2, for a concert spread over a long window.

## CPU and memory

- **The song renders in its own Worker lane ('music').** A section is 13–71 s of audio, about 0.12–0.3 s of Worker
  time per second of audio on this machine (contended), so up to ~20 s per section, and must not hold up the crowd
  beds. The alternative was the shared heavy lane, where a bed waits behind a 20 s job.
- **The choir renders at 32 kHz on medium as well as low (CHOIR_RATE).** The longest section is 8.7 MB, not 13 MB, and
  renders about 1.5× faster. Voices and strings sit below 16 kHz. High and ultra stay at 48 kHz.
- **No tier pre-renders the song at unlock.** Every tier fetches the concert a few real minutes before a scheduled song
  (scheduled(); on Shabbat the musaf and afternoon events fetch Ha'azinu / the Shirah of the week).
  `ctx.audio.prefetchLibation(opts)` lets a choreography do it earlier. The alternative was medium+ rendering the
  day's three sections at unlock, now about a minute of Worker CPU for a concert hours away.
- **Playback cost is unchanged:** one AudioBufferSourceNode per section. The caption tracks are a few comparisons per
  frame. Measured render cost on this machine (low, 32 kHz): 0.12–0.3 s of Worker time per second of song in node,
  about 0.4–0.6 s in the page with other agents loading the CPU. A 96 s concert waited 5–7 s for its first section,
  and a Psalm 94 concert is about 1–2 minutes of one Worker core, spread before and during the concert. The DSP was
  not retuned: run-to-run timing varied about 2× here, too noisy to tune against, and caching resonator coefficients
  bought nothing.
