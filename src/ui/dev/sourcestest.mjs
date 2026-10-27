#!/usr/bin/env node
// Citation links (dev only, no browser): every citation the UI shows must link to Sefaria, except the kinds that are
// plain text on purpose (EXEMPT, each with its reason). Fails on any other unlinked citation and on a wrong URL in CASES.
//   node src/ui/dev/sourcestest.mjs            offline: parser cases + every sources array in the data
//   node src/ui/dev/sourcestest.mjs --online   also asks the Sefaria API for every distinct URL (network)
import { parseCitation, parseSources } from '../sources.js';
import { EVENTS } from '../../data/schedule.js';
import { ZONE_CONTENT } from '../../data/zones-content.js';
import * as OFFERINGS from '../../data/offerings.js';
import { LADDER_SOURCES } from '../data.js';
import { ABOUT_SOURCES } from '../console/sections/learn.js';

const S = 'https://www.sefaria.org/';
/** kinds of citation that stay plain text, and why (keep in step with the comment at the top of sources.js) */
const EXEMPT = [
  [/^Report\b/, 'the project report, not a published text'],
  [/^Reconstruction\b/, 'a label for the model\'s own reconstruction'],
  [/^(Ezrat Kohanim|EK)\b/, 'not on Sefaria'],
  [/^(Shiltei HaGiborim|SG)\b/, 'Portaleone 1612 is not on Sefaria; Sefaria\'s "Shiltei HaGiborim" is a different work'],
  [/^Tosefta\b/, 'Sefaria\'s Tosefta numbers its halachot differently (Sanhedrin 2:6 is its 2:2): a link would open another passage'],
  [/^(Yerushalmi|Y\.)\s/, 'Sefaria\'s Yerushalmi uses halachah/segment numbering, not the daf of the citations'],
];

const CASES = [
  ['Tamid 3:9', 'Mishnah_Tamid.3.9'],
  ['Middot 5:1–2', 'Mishnah_Middot.5.1-2'],
  ['Tamid 3:9–4:1', 'Mishnah_Tamid.3.9-4.1'],
  ['Yoma 21b', 'Yoma.21b'],
  ['Yoma 16a–b', 'Yoma.16a-16b'],
  ['Yoma 30b–31a', 'Yoma.30b-31a'],
  ['Yoma 5:2 (53b)', 'Mishnah_Yoma.5.2'],
  ['Avot 5:5', 'Pirkei_Avot.5.5'],
  ['Bamidbar 28:9–10', 'Numbers.28.9-10'],
  ['Psalms 48', 'Psalms.48'],
  ['Shmuel I 21:7', 'I_Samuel.21.7'],
  ['1 Divrei HaYamim 9:17–27', 'I_Chronicles.9.17-27'],
  ['I Melachim 6:2', 'I_Kings.6.2'],
  ['Rambam BhB 7:12–22', 'Mishneh_Torah,_The_Chosen_Temple.7.12-22'],
  ['BhB 5:1', 'Mishneh_Torah,_The_Chosen_Temple.5.1'],
  ['Rambam MK 13:12', 'Mishneh_Torah,_Sacrificial_Procedure.13.12'],
  ['Rambam MK 6:1–18', 'Mishneh_Torah,_Sacrificial_Procedure.6.1-18'],
  ['Rambam Pesulei HaMukdashin 19:4–5', 'Mishneh_Torah,_Sacrifices_Rendered_Unfit.19.4-5'],
  ['Rambam Bikkurim 3:12', 'Mishneh_Torah,_First_Fruits_and_other_Gifts_to_Priests_Outside_the_Sanctuary.3.12'],
  ['Bikkurim 3:2', 'Mishnah_Bikkurim.3.2'],
  ["Rambam Hilchot Bi'at Mikdash 2:1", 'Mishneh_Torah,_Admission_into_the_Sanctuary.2.1'],
  ['Rambam TuM 1:7', 'Mishneh_Torah,_Daily_Offerings_and_Additional_Offerings.1.7'],
  ['Kesef Mishneh on Rambam TuM 1:7', 'Kessef_Mishneh_on_Mishneh_Torah,_Daily_Offerings_and_Additional_Offerings.1.7'],
  ['Ritva on Yoma ch. 1 (in Kesef Mishneh TuM 1:7)', 'Kessef_Mishneh_on_Mishneh_Torah,_Daily_Offerings_and_Additional_Offerings.1.7'],
  ['Bartenura on Middot 1:4–5', 'Bartenura_on_Mishnah_Middot.1.4-5'],
  ['Rashi on Shabbat 90a', 'Rashi_on_Shabbat.90a'],
  ['Kinnim 1:1', 'Mishnah_Kinnim.1.1'],
  ['Negaim 14:7–10', 'Mishnah_Negaim.14.7-10'],
  ['Nazir 6:7–9', 'Mishnah_Nazir.6.7-9'],
  ['Temurah 2:1', 'Mishnah_Temurah.2.1'],
  ['Temurah 14a', 'Temurah.14a'],
  ['Bekhorot 9:5', 'Mishnah_Bekhorot.9.5'],
  ['Eruvin 10:14', 'Mishnah_Eruvin.10.14'],
  ['Eruvin 32a', 'Eruvin.32a'],
  ['Ketubot 106a', 'Ketubot.106a'],
  ['Shevuot 2:3', 'Mishnah_Shevuot.2.3'],
  ['Report §10.8', null],
  ['Tosefta Sanhedrin 2:6', null],
  ['MK 16a', null], // could be Moed Katan: never guessed as the Rambam
];

let fails = 0;
const fail = (msg) => { console.log(`FAIL  ${msg}`); fails++; };
for (const [text, want] of CASES) {
  const got = parseCitation(text).url;
  if (got !== (want ? S + want : null)) fail(`${text} → ${got} (want ${want ? S + want : null})`);
}
console.log(`cases: ${CASES.length}`);

// every sources array the UI can show: events, zones, offerings (types and steps), the ladder, the About panel
const all = [];
const walk = (o, depth = 0) => {
  if (!o || typeof o !== 'object' || depth > 10) return;
  if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
  for (const [k, v] of Object.entries(o)) {
    if (k === 'sources' && Array.isArray(v)) all.push(...parseSources(v));
    else walk(v, depth + 1);
  }
};
walk(EVENTS); walk(ZONE_CONTENT); walk(Object.values(OFFERINGS));
all.push(...parseSources(LADDER_SOURCES), ...parseSources(ABOUT_SOURCES));
const unlinked = new Map();
for (const c of all) {
  if (c.url || EXEMPT.some(([re]) => re.test(c.text.trim()))) continue;
  unlinked.set(c.text, (unlinked.get(c.text) || 0) + 1);
}
for (const [t, n] of unlinked) fail(`unlinked citation: "${t}" (${n}×)`);
const urls = [...new Set(all.map((c) => c.url).filter(Boolean))];
console.log(`data: ${all.length} citations, ${all.filter((c) => c.url).length} linked, ${unlinked.size} distinct unlinked outside the exempt kinds, ${urls.length} distinct URLs`);

if (process.argv.includes('--online')) {
  let bad = 0, i = 0;
  const next = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      const ref = decodeURIComponent(u.slice(S.length));
      try {
        const get = () => fetch(`${S}api/v3/texts/${encodeURIComponent(ref)}?return_format=text_only`, { signal: AbortSignal.timeout(20000) }).then((r) => r.json());
        // the API now and then answers with an HTML page: one retry
        const j = await get().catch(() => new Promise((res) => { setTimeout(res, 1500); }).then(get));
        const text = JSON.stringify(j.versions?.[0]?.text ?? '');
        if (j.error || text.length < 8) { bad++; fail(`Sefaria has no text at ${u}${j.error ? `: ${j.error}` : ''}`); }
      } catch (e) { bad++; fail(`${u}: ${e.message}`); }
    }
  };
  await Promise.all([next(), next(), next(), next()]);
  console.log(`online: ${urls.length - bad}/${urls.length} URLs resolve on Sefaria`);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
