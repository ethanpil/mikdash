// The Levites' song: psalm of the day (Tamid 7:4), sung in three sections with a teki'ah and the people's
// prostration at each break (Tamid 7:3). Minimum 12 Levites on the duchan = 9 kinnorot + 2 nevalim +
// 1 cymbal; boy Levites below sweeten the treble (Arachin 2:3-6, 13b; report §27.1, §29).
//
// The melodies are NOT preserved: everything here is a labelled modal reconstruction (docs/decisions/audio.md).
//  * style 'mishnah' (default): unison psalmody on a reciting tone (intonation · recitation · mediant ·
//    termination), Pythagorean-tuned mode on D with B-flat, men in unison, boys an octave above, kinnorot
//    plucking the melody heterophonically, nevalim sounding the final and fifth. No chalil unless a flute day.
//  * style 'sg1612': the Shiltei HaGiborim (Portaleone, Mantua 1612) Renaissance-lens layer (report §54):
//    four-voice homophonic psalmody (falsobordone) in quarter-comma meantone with cadential musica ficta.
//    A style layer, never the default.
import { Rng, resonate, cents } from './dsp.js';
import { syllabify, buildSegments, renderVoice } from './voice.js';
import { pluck, reedNote, BODY } from './instruments.js';

// Divine names are written in their customary non-liturgical substitutes (Hashem, Elokim, Kel): this is a
// simulation, not liturgy. Sections give the opening verses of each third of the psalm (the Mishnah fixes
// three sections, not where they break — reconstruction). '*' marks penultimate stress.
export const PSALMS = {
  24: {
    sections: [
      'Le-da-vid miz-mor, la-ha-shem ha-a*-retz u-me-lo-ah, te-vel ve-yo-she-vei vah. Ki hu al ya-mim ye-sa-dah, ve-al ne-ha-rot ye-cho-ne-ne-ha.',
      'Ne-ki cha-pa-yim u-var le-vav, a-sher lo na-sa la-shav naf-shi, ve-lo nish-ba le-mir-mah. Yi-sa ve-ra-chah me-et ha-shem, u-tze-da-kah me-e-lo-kei yish-o.',
      'Se-u she-a-rim ra-shei-chem, ve-hi-na-se-u pit-chei o-lam, ve-ya-vo me-lech ha-ka-vod. Mi zeh me-lech ha-ka-vod, ha-shem i-zuz ve-gi-bor, ha-shem gi-bor mil-cha-mah.',
    ],
  },
  48: {
    sections: [
      'Shir miz-mor liv-nei ko-rach. Ga-dol ha-shem u-me-hu-lal me-od, be-ir e-lo-kei-nu har kod-sho.',
      'Hem-mah ra-u ken ta-ma-hu, niv-ha-lu nech-pa-zu. Re-a-dah a-cha-za-tam sham, chil ka-yo-le-dah.',
      'Di-mi-nu e-lo-kim chas-de-cha, be-ke*-rev hei-cha-le-cha. Ke-shim-cha e-lo-kim ken te-hi-la-te-cha al katz-vei e*-retz, tze*-dek ma-le-ah ye-mi-ne-cha.',
    ],
  },
  82: {
    sections: [
      'Miz-mor le-a-saf, e-lo-kim ni-tzav ba-a-dat kel, be-ke*-rev e-lo-kim yish-pot. Ad ma-tai tish-pe-tu a*-vel, u-fe-nei re-sha-im tis-u se-lah.',
      'Pal-tu dal ve-ev-yon, mi-yad re-sha-im ha-tzi-lu. Lo ya-de-u ve-lo ya-vi-nu, ba-cha-she-chah yit-ha-la-chu, yi-mo-tu kol mos-dei a*-retz.',
      'A-ni a-mar-ti e-lo-kim a-tem, u-ve-nei el-yon kul-chem. Ku-mah e-lo-kim shof-tah ha-a*-retz, ki a-tah tin-chal be-chol ha-go-yim.',
    ],
  },
  94: {
    sections: [
      'Kel ne-ka-mot ha-shem, kel ne-ka-mot ho-fi-a. Hi-na-se sho-fet ha-a*-retz, ha-shev ge-mul al ge-im.',
      'Bi-nu bo-a-rim ba-am, u-che-si-lim ma-tai tas-ki-lu. Ha-no-ta o*-zen ha-lo yish-ma, im yo-tzer a*-yin ha-lo ya-bit.',
      'Mi ya-kum li im me-re-im, mi yit-ya-tzev li im po-a-lei a*-ven. Lu-lei ha-shem ez-ra-tah li, kim-at sha-che-nah du-mah naf-shi.',
    ],
  },
  81: {
    sections: [
      'Har-ni-nu le-e-lo-kim u-ze-nu, ha-ri-u le-e-lo-kei ya-a-kov. Se-u zim-rah u-te-nu tof, ki-nor na-im im na-vel.',
      'Ha-si-ro-ti mi-se*-vel shich-mo, ka-pav mi-dud ta-a-vor-nah. Ba-tza-rah ka-ra-ta va-a-chal-tze-ka, e-en-cha be-se*-ter ra-am.',
      'Ve-lo sha-ma a-mi le-ko-li, ve-yis-ra-el lo a-vah li. Lu a-mi sho-me-a li, yis-ra-el bid-ra-chai ye-ha-le-chu.',
    ],
  },
  93: {
    sections: [
      'Ha-shem ma-lach ge-ut la-vesh, la-vesh ha-shem oz hit-a-zar, af ti-kon te*-vel bal ti-mot. Na-chon kis-a-cha me-az, me-o-lam a-tah.',
      'Na-se-u ne-ha-rot ha-shem, na-se-u ne-ha-rot ko-lam, yis-u ne-ha-rot doch-yam. Mi-ko-lot ma*-yim ra-bim, a-di-rim mish-be-rei yam, a-dir ba-ma-rom ha-shem.',
      'E-do-te-cha ne-em-nu me-od, le-vei-te-cha na-a-vah ko*-desh, ha-shem le-o*-rech ya-mim.',
    ],
  },
  92: {
    sections: [
      'Miz-mor shir le-yom ha-sha-bat. Tov le-ho-dot la-ha-shem, u-le-za-mer le-shim-cha el-yon. A-lei a-sor va-a-lei na-vel, a-lei hi-ga-yon be-chi-nor.',
      'Ish ba-ar lo ye-da, uch-sil lo ya-vin et zot. Bif-ro-ach re-sha-im ke-mo e*-sev, va-ya-tzi-tzu kol po-a-lei a*-ven.',
      'Tza-dik ka-ta-mar yif-rach, ke-e*-rez bal-va-non yis-geh. She-tu-lim be-veit ha-shem, be-chatz-rot e-lo-kei-nu yaf-ri-chu.',
    ],
  },
};
export { PSALM_BY_DAY } from './meta.js';

// ---------------------------------------------------------------------------------------------
// Tuning: the mode on D with B-flat (degrees D E F G A Bb C D')
// ---------------------------------------------------------------------------------------------
const PYTH = { D: 1, E: 9 / 8, F: 32 / 27, G: 4 / 3, A: 3 / 2, Bb: 128 / 81, C: 16 / 9, 'C#': 243 / 128, 'F#': 81 / 64 };
// quarter-comma meantone from D (fifths 696.58 c)
const MT_FIFTH = Math.pow(5, 1 / 4);
const mt = (k) => { let r = Math.pow(MT_FIFTH, k); while (r >= 2) r /= 2; while (r < 1) r *= 2; return r; };
const MEANTONE = { D: 1, A: mt(1), E: mt(2), B: mt(3), 'F#': mt(4), 'C#': mt(5), G: mt(-1), C: mt(-2), F: mt(-3), Bb: mt(-4) };
export const D3 = 146.83;
/** frequency of note name with octave offset relative to D3 (octave 3) e.g. ('A', 3) */
export function freq(name, oct = 3, tuning = 'pyth') {
  const t = tuning === 'meantone' ? MEANTONE : PYTH;
  return D3 * t[name] * Math.pow(2, oct - 3);
}

// ---------------------------------------------------------------------------------------------
// Psalm-tone melody (reconstruction): intonation F-G → recite A; mediant: accent Bb→A, after-tones G;
// termination: preparatory accent on A (Bb grace), then G-F-E → D.
// ---------------------------------------------------------------------------------------------
/** Returns [{ t, dur, syl, notes: [[frac, name]], stress, cadence: 'm'|'f'|null, breathAfter }]. */
export function psalmMelody(text, { tempo = 1, firstIntonation = true } = {}) {
  const syl = syllabify(text);
  // split into hemistichs at pauses
  const hemis = []; let cur = [];
  for (const s of syl) { cur.push(s); if (s.pause) { hemis.push({ syl: cur, end: s.pause }); cur = []; } }
  if (cur.length) hemis.push({ syl: cur, end: 2 });
  const out = [];
  let t = 0.25, verseStart = true;
  const U = 0.27 / tempo, S = 0.41 / tempo, M = 0.3 / tempo;
  for (const h of hemis) {
    const n = h.syl.length;
    const stresses = h.syl.map((s, i) => (s.stress ? i : -1)).filter((i) => i >= 0);
    const last = stresses[stresses.length - 1] ?? n - 1, prep = stresses[stresses.length - 2] ?? -1;
    const final = h.end === 2;
    for (let i = 0; i < n; i++) {
      const s = h.syl[i];
      let notes, dur = s.stress ? S : U, cadence = null;
      if (verseStart && firstIntonation && i < 2 && i < last - 1) notes = [[0, i === 0 ? 'F' : 'G']];
      else if (i < last) notes = [[0, final && i === prep ? 'A' : (final && i > prep && prep >= 0 ? 'G' : 'A')]];
      if (final && i === prep) { notes = [[0, 'Bb'], [0.3, 'A']]; dur = S * 1.15; }
      if (i === last) {
        cadence = final ? 'f' : 'm';
        if (final) { notes = i === n - 1 ? [[0, 'G'], [0.25, 'F'], [0.5, 'E'], [0.72, 'D']] : [[0, 'G'], [0.4, 'F'], [0.72, 'E']]; dur = M * (i === n - 1 ? 5.2 : 3); }
        else { notes = i === n - 1 ? [[0, 'Bb'], [0.35, 'A'], [0.7, 'G']] : [[0, 'Bb'], [0.5, 'A']]; dur = M * (i === n - 1 ? 3.4 : 2); }
      } else if (i > last) {
        notes = final ? [[0, i === n - 1 ? 'D' : 'E']] : [[0, 'G']];
        if (i === n - 1) dur = final ? M * 3.2 : M * 2;
      }
      const breathAfter = i === n - 1 ? (final ? 0.55 : 0.3) / tempo : 0;
      out.push({ t, dur: dur + breathAfter, syl: s.syl, notes, stress: s.stress, cadence, breathAfter, hemi: h, gap: breathAfter });
      t += dur + breathAfter;
    }
    verseStart = final;
  }
  return { events: out, length: t };
}

// falsobordone voicing for the SG 1612 layer: melody (tenor) note → [bass, tenor, alto, cantus] (name, octave)
const FB = {
  A: [['D', 3], ['A', 3], ['D', 4], ['F', 4]],
  Bb: [['Bb', 2], ['Bb', 3], ['D', 4], ['F', 4]],
  G: [['G', 2], ['G', 3], ['Bb', 3], ['D', 4]],
  F: [['F', 2], ['F', 3], ['A', 3], ['C', 4]],
  E: [['A', 2], ['E', 3], ['A', 3], ['C#', 4]],
  D: [['D', 2], ['D', 3], ['A', 3], ['F#', 4]],
  Am: [['A', 2], ['A', 3], ['E', 4], ['C#', 4]], // mediant half-cadence (A major with ficta C#)
};

// ---------------------------------------------------------------------------------------------
// Choir renderer
// ---------------------------------------------------------------------------------------------
/**
 * Render a psalm section with voices and the Levites' strings. Mono Float32Array.
 * o: { sr, seed, psalm, section, style, men, boys, kinnorot, nevalim, fluteDay, tempo,
 *      cr, hiGain (per-voice cost: control rate, parallel high-formant branch — weak tiers) }
 */
export function renderPsalm(o) {
  const sr = o.sr, rng = new Rng(o.seed || 48);
  const ps = PSALMS[o.psalm] || PSALMS[48];
  const text = o.text || ps.sections[Math.max(0, Math.min(2, o.section | 0))];
  const style = o.style === 'sg1612' ? 'sg1612' : 'mishnah';
  const tuning = style === 'sg1612' ? 'meantone' : 'pyth';
  const { events, length } = psalmMelody(text, { tempo: o.tempo || 1 });
  const total = length + 3.5;
  const out = new Float32Array(Math.ceil(total * sr));

  const men = o.men ?? 12, boys = style === 'sg1612' ? 0 : (o.boys ?? 4);
  const types = ['bass', 'baritone', 'baritone', 'tenor'];
  // per-singer realisation of the shared melody: own timing, intonation, vibrato, timbre
  const singerNotes = (part, octave, lag, jitter, r) => events.map((e) => {
    const names = part ? part(e) : e.notes;
    const dt = lag + Math.max(-0.035, Math.min(0.035, r.gauss() * jitter));
    return {
      t: e.t + dt, dur: e.dur, syl: e.syl, gap: e.gap, breathAfter: e.breathAfter ? Math.min(0.28, e.breathAfter * 0.6) : 0,
      f0s: names.map(([fr, nm, oc]) => [fr, freq(nm, (oc ?? 3) + octave, tuning)]),
      amp: e.stress ? 1 : 0.86,
    };
  });

  const voices = [];
  if (style === 'mishnah') {
    for (let k = 0; k < men; k++) {
      const r = rng.fork(k + 1), type = types[k % types.length];
      voices.push({
        notes: singerNotes(null, 0, r.uni(0, 0.025), 0.016, r),
        opt: {
          type, tract: r.uni(0.94, 1.06), seed: r.int(1, 1e9), detune: r.gauss() * 7, drift: r.uni(4, 9), jitter: 0.004, shimmer: 0.05,
          vib: { rate: r.uni(4.7, 6.0), depth: r.uni(10, 28), delay: r.uni(0.18, 0.35) }, effort: r.uni(0.55, 0.78), singer: r.uni(3, 6),
          breath: r.uni(0.05, 0.11), glide: r.uni(0.05, 0.09), gain: r.uni(0.8, 1.15), cr: o.cr, hiGain: o.hiGain,
        },
      });
    }
    // boy Levites (tzo'arei haLeviim): the melody an octave up, simpler (no melisma), lighter vibrato
    const simple = (e) => (e.notes.length > 2 ? [e.notes[0], e.notes[e.notes.length - 1]] : e.notes);
    for (let k = 0; k < boys; k++) {
      const r = rng.fork(100 + k);
      voices.push({
        notes: singerNotes(simple, 1, r.uni(0, 0.03), 0.02, r),
        opt: {
          type: 'boy', tract: r.uni(1.02, 1.1), seed: r.int(1, 1e9), detune: r.gauss() * 9, drift: r.uni(5, 10), jitter: 0.005, shimmer: 0.05,
          vib: { rate: r.uni(5.2, 6.3), depth: r.uni(6, 14), delay: 0.3 }, effort: r.uni(0.45, 0.6), singer: 0, breath: r.uni(0.1, 0.16),
          glide: 0.06, gain: r.uni(0.5, 0.65), f1Track: true, hiGain: o.hiGain ?? 0.7, cr: o.cr,
        },
      });
    }
  } else {
    // SG 1612 (Magen I, report §54): each section sung "in four voices" by its group of four Levites; all
    // twelve together in the last section. Four parts: bass, tenor (the psalm tone), alto, cantus.
    const parts = [0, 1, 2, 3];
    const pt = ['bass', 'tenor', 'tenor', 'tenor'];
    const tr = [0.96, 1.0, 1.06, 1.1];
    const singers = (o.section | 0) < 2 ? Math.max(4, Math.round(men / 3)) : men;
    for (let k = 0; k < singers; k++) {
      const r = rng.fork(k + 1), p = parts[k % 4];
      const part = (e) => e.notes.map(([fr, nm]) => {
        const key = e.cadence === 'm' && nm === 'A' ? 'Am' : nm;
        const v = (FB[key] || FB.A)[p];
        return [fr, v[0], v[1]];
      });
      voices.push({
        notes: singerNotes(part, 0, r.uni(0, 0.015), 0.01, r),
        opt: {
          type: pt[p], tract: tr[p] * r.uni(0.97, 1.03), seed: r.int(1, 1e9), detune: r.gauss() * 5, drift: r.uni(3, 6), jitter: 0.004, shimmer: 0.04,
          vib: { rate: r.uni(4.8, 5.8), depth: r.uni(8, 18), delay: 0.3 }, effort: r.uni(0.5, 0.7), singer: r.uni(3, 5), breath: 0.07,
          glide: 0.05, gain: p === 0 ? 1.1 : 0.95, f1Track: p === 3, cr: o.cr, hiGain: o.hiGain,
        },
      });
    }
  }
  for (const v of voices) {
    const segs = buildSegments(v.notes, { type: v.opt.type, tract: v.opt.tract, inhale: 0.035 });
    renderVoice(out, segs, { ...v.opt, sr });
  }
  const voicePeak = peakOf(out);

  // strings: kinnorot (lyres) pluck the melody heterophonically; nevalim (larger, lower) the final & fifth.
  // sg1612 voices Shiltei HaGiborim's identifications (report §54): kinnor = arpa (harp: finger-plucked near
  // mid-string, long ring, soft contact), nevel = liuto (lute: paired courses, plucked near the bridge,
  // strumming the four-part chord); 12 players = 9 harps + 3 lutes (Magen I: "12 singers + 12 players").
  const sg = style === 'sg1612';
  const kinBus = new Float32Array(out.length), nevBus = new Float32Array(out.length);
  const kin = o.kinnorot ?? 9, nev = sg ? 3 : o.nevalim ?? 2;
  const kp = sg ? { decay: 2.8, bright: 0.4, pick: [0.3, 0.45], click: 0.04, clickLp: 2200 } : { decay: 1.6, bright: 0.55, pick: [0.12, 0.22] };
  const kr = rng.fork(777);
  for (const e of events) {
    const [, first] = e.notes[0];
    const key = sg ? (FB[e.cadence === 'm' && first === 'A' ? 'Am' : first] || FB.A) : null;
    if (e.stress || e.cadence || kr.chance(0.35)) {
      const n = Math.max(1, Math.round(kin * (e.cadence ? 0.6 : e.stress ? 0.35 : 0.15)));
      for (let j = 0; j < n; j++) {
        const [fr, nm, oc] = sg ? [0, ...key[1 + (j % 3)]] : kr.pick(e.notes);
        const octave = sg ? oc : kr.chance(0.6) ? 4 : 5;
        const t = e.t + fr * e.dur * 0.8 + kr.uni(-0.02, 0.05) + j * 0.012;
        pluck(kinBus, sr, kr, { t, f: freq(nm, octave, tuning), amp: kr.uni(0.25, 0.45), decay: kp.decay, bright: kp.bright, pick: kr.uni(kp.pick[0], kp.pick[1]), click: kp.click, clickLp: kp.clickLp });
      }
    }
    if ((e.cadence || e === events[0] || (e.stress && kr.chance(0.3))) && nev > 0) {
      if (sg) {
        // lutes: bass, tenor and alto of the chord, thumb then fingers; each note on a paired course
        for (let j = 0; j < nev; j++) key.slice(0, 3).forEach(([nm, oc], m) => {
          const t = e.t + kr.uni(-0.01, 0.04) + j * 0.02 + m * 0.028, f = freq(nm, oc, tuning);
          for (const c of [-1, 1]) pluck(nevBus, sr, kr, { t: t + (c > 0 ? kr.uni(0.003, 0.009) : 0), f: f * cents(c * kr.uni(1.5, 3.5)), amp: kr.uni(0.3, 0.42), decay: 2.2, bright: 0.7, pick: kr.uni(0.09, 0.14), click: 0.07, clickLp: 4500 });
        });
      } else {
        const names = e.cadence === 'f' ? [['D', 2], ['A', 2]] : [['D', 2], ['A', 2]].slice(0, kr.chance(0.5) ? 2 : 1);
        for (let j = 0; j < nev; j++) for (const [nm, oc] of names) {
          pluck(nevBus, sr, kr, { t: e.t + kr.uni(-0.01, 0.06) + j * 0.03, f: freq(nm, oc, tuning) * (j ? 2 : 1), amp: kr.uni(0.45, 0.6), decay: 3.2, bright: 0.35, pick: 0.3 });
        }
      }
    }
  }
  const str = resonate(kinBus, sr, sg ? BODY.harp : BODY.kinnor, 0.7);
  const nb = resonate(nevBus, sr, sg ? BODY.lute : BODY.nevel, 0.6);
  for (let i = 0; i < str.length; i++) str[i] += nb[i] * 0.8;
  // flute days only (Arachin 2:3): the chalil doubles the melody; never on an ordinary weekday
  if (o.fluteDay) chalilLine(str, sr, rng.fork(55), events, tuning);
  const sp = peakOf(str);
  if (sp > 0) { const g = (voicePeak * 0.32) / sp; for (let i = 0; i < out.length; i++) out[i] += str[i] * g; }
  return { buffer: out, length: total, events };
}

function chalilLine(out, sr, r, events, tuning) {
  for (const e of events) {
    if (!e.stress && !e.cadence) continue;
    for (const [fr, nm] of e.notes) reedNote(out, sr, r, e.t + fr * e.dur, Math.max(0.2, e.dur * 0.6), freq(nm, 4, tuning), { amp: 0.35 });
  }
}

function peakOf(b) { let p = 0; for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > p) p = a; } return p; }
