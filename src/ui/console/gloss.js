// Plain-English glosses for Hebrew terms on primary surfaces (ux-audit finding 10): a visitor who does not know "tamid"
// or "ma'amad" reads "tamid: the daily burnt-offering of a lamb" beside the first row that uses it. No word list of its
// own: the gloss is the first clause of the glossary's own definition (src/data/glossary.js, loaded with the card
// content after the boot), kept only when that clause is short and whole — a clause cut in the middle is no gloss.
// Places carry their gloss in their own name ("Lishkat HaGazit — the chamber of hewn stone"): zoneGloss reads it.

const MAX = 42;
let index = null, indexOf = null;

/** "The daily burnt-offering of a lamb, one in the morning…" → "the daily burnt-offering of a lamb" (or null) */
export function shortGloss(en) {
  const s = String(en || '').split(/[,.;:(]|\s[—–]\s/)[0].trim();
  if (s.length < 4 || s.length > MAX || /^[A-Z]$/.test(s)) return null;
  return s.replace(/^(The|A|An|One) /, (m) => m.toLowerCase());
}

/** [{ re, term, gloss }] longest terms first: the key and its transliteration (not its English aka's) */
function build(G) {
  const out = [];
  for (const [key, g] of Object.entries(G || {})) {
    const gloss = shortGloss(g?.en);
    if (!gloss) continue;
    const names = new Set([key, (g.translit || '').toLowerCase()].filter((x) => x && x.length >= 3));
    for (const n of names) {
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]");
      out.push({ re: new RegExp(`(^|[^\\p{L}'’])${esc}($|[^\\p{L}'’])`, 'iu'), term: g.translit || key, gloss, n: n.length });
    }
  }
  return out.sort((a, b) => b.n - a.n);
}

/**
 * The first glossary term in text that `seen` has not had yet → { term, gloss } (and it is added to `seen`); null when
 * none, or before the glossary has loaded. seen: a Set shared by one list, so a term is glossed at its first row only.
 */
export function glossIn(app, text, seen = null) {
  const G = app.content?.glossary;
  if (!G) { app.content?.load?.(); return null; }
  if (indexOf !== G) { index = build(G); indexOf = G; }
  for (const it of index) {
    if (!it.re.test(text)) continue;
    const k = it.term.toLowerCase();
    if (seen?.has(k)) continue;
    seen?.add(k);
    return { term: it.term, gloss: it.gloss };
  }
  return null;
}

/** a place's own gloss: the part of its English name after " — " ("the Temple Mount"), or '' */
export function zoneGloss(app, id) {
  const en = app.data.zone(id)?.name?.en || '';
  const i = en.indexOf(' — ');
  return i > 0 ? en.slice(i + 3) : '';
}
