// The search engine (docs/console-design.md §6.3.2): document sources, prepared fields, ranking. No DOM, no ctx: index.js
// wires it to the app (idle building, the bus, live sources), dev/searchtest.mjs to the data modules in node.
//
// Matching, per field (the best tier wins): exact 1.00 · prefix of the field 0.90 · every query token a prefix of a field
// token 0.80 · substring 0.65 · the same on the consonant / matres skeleton ×0.7 · Damerau-Levenshtein 1 on tokens ≥ 4
// letters (2 on ≥ 8) 0.50. Variants: the query in the Ashkenazi s→t form ×0.9, without a leading "ha" ×0.95, Hebrew
// without a prefix letter ×0.9, re-typed on the other keyboard layout ×0.85; a field's tokens without their article
// (ha / ה) ×0.95 / ×0.9. Score = tier × variant × field weight × doc weight × kind weight × scope (×1.5 from the
// caller) × context (active rite ×1.3, within 60 m ×1.2, same zone ×1.2, recently chosen ×1.1; together ≤ ×1.25).
// Order: the band first (exact › prefix › tokens / substring › skeleton / typo), then the score; ties: the shorter title.
import {
  normHe, heStrip, heArticle, heSkeleton, latinTokens, latinArticle, ashkenazi, skeleton, isHebrew, isLatin,
} from './normalize.js';
import { swapLayout } from './layout.js';

export const KIND_WEIGHT = {
  place: 1, rite: 1, thing: 0.95, offering: 0.95, role: 0.95, setting: 0.95, command: 0.95, word: 0.85, learn: 0.85, help: 0.85,
};
export const FIELD_WEIGHT = { 'title.en': 1, 'title.he': 1, translit: 0.95, aka: 0.9, keywords: 0.6 };
const SKEL = 0.7, FUZZY = 0.5, LAYOUT = 0.85;
/**
 * Ranking bands by tier: the whole field, then its beginning, then words inside it, then a skeleton or typo match. A
 * result never outranks one in a higher band; weights and boosts order results within a band.
 */
const BAND = { exact: 3, prefix: 2, tokens: 1, substring: 1, skeleton: 0, fuzzy: 0 };
/** where you stand, what is happening now and what you chose before together lift a result by at most this */
export const CONTEXT_CAP = 1.25;
/** the fuzzy pass runs when fewer than this many documents matched otherwise */
const FUZZY_BELOW = 8;
/** a prepared static source is built in slices of this many documents between time checks */
const CHUNK = 24;

// ---------------------------------------------------------------- preparing text

const mk = (t, k) => ({ t, f: t.join(' '), c: t.join(''), k });

/** the Latin forms of a string: [base, without articles?] or null */
function latinForms(raw) {
  const t = latinTokens(raw);
  if (!t.length) return null;
  const out = [mk(t, 1)];
  const a = t.map((x) => latinArticle(x) ?? x);
  if (a.some((x, i) => x !== t[i])) out.push(mk(a, 0.95));
  return out;
}
/** the Hebrew forms of a string (doc side: the article ה dropped as a variant) */
function heForms(raw, strip = heArticle, k = 0.9) {
  const n = normHe(raw);
  if (!n) return null;
  const t = n.split(' ');
  const out = [mk(t, 1)];
  const a = t.map((x) => strip(x) ?? x);
  if (a.some((x, i) => x !== t[i])) out.push(mk(a, k));
  return out;
}
const skelL = (forms) => forms.map((F) => mk(F.t.map(skeleton), F.k));
const skelH = (forms) => forms.map((F) => mk(F.t.map(heSkeleton), F.k));
/** query skeletons: only those whose every token keeps ≥ 3 letters (a 2-letter skeleton matches far too much) */
const skelQ = (forms, fn) => forms.map((F) => mk(F.t.map(fn), F.k)).filter((F) => F.t.every((x) => x.length >= 3));

/** a document's searchable fields, prepared once */
export function prepare(doc) {
  const fields = [];
  const seen = new Set();
  const add = (name, raw) => {
    if (raw == null || raw === '') return;
    const s = String(raw);
    // a string already in a field is not prepared again (the fields come in falling weight)
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const L = isLatin(s) ? latinForms(s) : null;
    const H = isHebrew(s) ? heForms(s) : null;
    if (!L && !H) return;
    fields.push({ name, w: FIELD_WEIGHT[name] ?? 0.6, raw: s, L, H, LS: L && skelL(L), HS: H && skelH(H) });
  };
  add('title.en', doc.title?.en);
  add('title.he', doc.title?.he);
  add('translit', doc.translit);
  for (const a of doc.aka || []) add('aka', a);
  for (const k of doc.keywords || []) add('keywords', k);
  // the prefilter: the first three letters of every token of every form (each tier needs each query token to begin a
  // field token, or the query to begin at a word: a substring that starts inside a word is not searched for)
  const blob = [], grams = new Set(), toks = new Set();
  for (const F of fields) {
    for (const G of F.L?.length ? F.L : []) for (const x of G.t) grams.add(x.slice(0, 3));
    for (const G of F.H?.length ? F.H : []) for (const x of G.t) grams.add(x.slice(0, 3));
    for (const G of [...(F.LS || []), ...(F.HS || [])]) for (const x of G.t) grams.add(x.slice(0, 3));
    for (const G of [F.L?.[0], F.H?.[0]]) if (G) { blob.push(G.f); for (const x of G.t) toks.add(x); }
  }
  return { doc, fields, blob: blob.join('|'), grams, toks: [...toks], tlen: String(doc.title?.en ?? doc.title?.he ?? '').length };
}

/** the signature of a live document's text (re-prepared when it changes) */
const sig = (d) => `${d.title?.en}|${d.title?.he}|${d.translit}|${(d.aka || []).join('¦')}|${(d.keywords || []).join('¦')}`;

// ---------------------------------------------------------------- the query

/**
 * q → { L, LS, H, HS: forms (each with the 3-letter keys of its tokens), prefixOnly, raw } | null. Latin needs ≥ 2
 * letters; one Hebrew letter is a prefix search. layout: the query re-typed on the other keyboard layout instead (×0.85;
 * null when it cannot be).
 */
export function prepareQuery(q, { layout = false } = {}) {
  let s = String(q ?? '').trim();
  if (!s) return null;
  let k0 = 1;
  if (layout) { s = swapLayout(s); k0 = LAYOUT; if (!s) return null; }
  const Q = { L: [], H: [], LS: [], HS: [], prefixOnly: false, raw: String(q).trim() };
  if (isLatin(s)) {
    const t = latinTokens(s);
    if (t.length && t.join('').length >= 2) {
      const forms = [mk(t, k0)];
      const ak = t.map((x) => ashkenazi(x) ?? x);
      if (ak.some((x, i) => x !== t[i])) forms.push(mk(ak, k0 * 0.9));
      const ar = t.map((x) => latinArticle(x) ?? x);
      if (ar.some((x, i) => x !== t[i])) forms.push(mk(ar, k0 * 0.95));
      Q.L.push(...forms);
      Q.LS.push(...skelQ(forms, skeleton));
    }
  }
  if (isHebrew(s)) {
    const forms = heForms(s, heStrip, 0.9);
    if (forms) {
      for (const F of forms) F.k *= k0;
      Q.H.push(...forms);
      Q.HS.push(...skelQ(forms, heSkeleton));
      if (forms[0].c.length === 1) Q.prefixOnly = true;
    }
  }
  if (!Q.L.length && !Q.H.length) return null;
  for (const F of [...Q.L, ...Q.LS, ...Q.H, ...Q.HS]) F.keys = [...new Set(F.t.map((x) => x.slice(0, 3)))];
  return Q;
}

const prefixOfAll = (qt, ft) => qt.every((x) => ft.some((y) => y.startsWith(x)));

/** the tier of query form F against field form G (0 = no match); prefixOnly: no substring tier */
function tierOf(F, G, prefixOnly) {
  if (G.f === F.f) return 1;
  if (G.f.startsWith(F.f)) return 0.9;
  if (prefixOfAll(F.t, G.t)) return 0.8;
  if (prefixOnly) return 0;
  if (F.f.length >= 3 && G.f.includes(F.f)) return 0.65;
  if (F.c.length >= 4 && G.c.includes(F.c)) return 0.65;
  return 0;
}
const TIER_NAME = (t) => (t >= 1 ? 'exact' : t >= 0.9 ? 'prefix' : t >= 0.8 ? 'tokens' : 'substring');

/** best of query forms × field forms: [score, tierName] */
function best(QF, GF, prefixOnly, mult, name) {
  let b = 0, tn = null;
  if (!QF.length || !GF) return [0, null];
  for (const F of QF) {
    for (const G of GF) {
      const t = tierOf(F, G, prefixOnly);
      if (!t) continue;
      const s = t * F.k * G.k * mult;
      if (s > b) { b = s; tn = name || TIER_NAME(t); }
    }
  }
  return [b, tn];
}

/** a document against the query (no fuzzy): { score, field, tier } | null */
function matchDoc(P, Q) {
  let bs = 0, bf = null, bt = null;
  for (const fd of P.fields) {
    let [s, t] = best(Q.L, fd.L, Q.prefixOnly, 1);
    const [sh, th] = best(Q.H, fd.H, Q.prefixOnly, 1);
    if (sh > s) { s = sh; t = th; }
    if (!s && !Q.prefixOnly) {
      const [k1] = best(Q.LS, fd.LS, true, SKEL, 'skeleton');
      const [k2] = best(Q.HS, fd.HS, true, SKEL, 'skeleton');
      s = Math.max(k1, k2);
      if (s) t = 'skeleton';
    }
    s *= fd.w;
    if (s > bs) { bs = s; bf = fd.name; bt = t; }
  }
  return bs > 0 ? { score: bs, field: bf, tier: bt } : null;
}

/**
 * The prefilter: could this document match at all? Every tier needs, for some form of the query, each query token's
 * first three letters to begin one of the document's tokens (a shorter key: anywhere in its strings).
 */
function maybe(P, Q) {
  const all = (keys) => {
    for (const k of keys) if (!P.grams.has(k) && (k.length === 3 || !P.blob.includes(k))) return false;
    return true;
  };
  for (const F of Q.L) if (all(F.keys)) return true;
  for (const F of Q.LS) if (all(F.keys)) return true;
  for (const F of Q.H) if (all(F.keys)) return true;
  for (const F of Q.HS) if (all(F.keys)) return true;
  return false;
}

// three reused rows for dl()
let R0 = new Int32Array(64), R1 = new Int32Array(64), R2 = new Int32Array(64);
/**
 * Optimal-string-alignment distance ≤ max, else max + 1 (early exit). prefix: the least distance from a to any beginning
 * of b at least 3 letters long (b's tail is free).
 */
export function dl(a, b, max, prefix = false) {
  const n = a.length, m = b.length;
  if (!prefix && Math.abs(n - m) > max) return max + 1;
  if (m + 1 > R0.length) { R0 = new Int32Array(m + 1); R1 = new Int32Array(m + 1); R2 = new Int32Array(m + 1); }
  let p2 = R0, p1 = R1, cur = R2;
  for (let j = 0; j <= m; j++) p1[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1), ap = i > 1 ? a.charCodeAt(i - 2) : -1;
    for (let j = 1; j <= m; j++) {
      const bj = b.charCodeAt(j - 1);
      let v = p1[j - 1] + (ai === bj ? 0 : 1);
      if (p1[j] + 1 < v) v = p1[j] + 1;
      if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1;
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && ap === bj && p2[j - 2] + 1 < v) v = p2[j - 2] + 1;
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = p2; p2 = p1; p1 = cur; cur = t;
  }
  if (!prefix) return p1[m];
  let best = p1[m];
  for (let j = Math.max(3, n - max); j < m; j++) if (p1[j] < best) best = p1[j];
  return best;
}
const fuzzMax = (tok) => (tok.length >= 8 ? 2 : tok.length >= 4 ? 1 : 0);
/** does query token x match field token y by a typo (whole token, or y's beginning as typed so far)? */
function fuzzyTok(x, y) {
  const mx = fuzzMax(x);
  if (!mx || y.length < 3) return false;
  // one typo leaves the first or the second letter in place, or swaps them
  if (x[0] !== y[0] && x[1] !== y[1] && !(x[0] === y[1] && x[1] === y[0])) return false;
  // the whole token, or its beginning as typed so far (y cut to x's length ± max): one DP covers every cut
  return dl(x, y.length > x.length + mx ? y.slice(0, x.length + mx) : y, mx, y.length > x.length) <= mx;
}

/** a document by typos: every query token a prefix of, or a typo away from, a token of one field (base forms) */
function fuzzyDoc(P, Q, near) {
  let bs = 0, bf = null;
  // near: query token → the dictionary tokens a typo away (static documents); a live document's are measured here
  const typoOf = (x, y) => (near.get(x)?.has(y) ?? false) || (!P.static && fuzzyTok(x, y));
  const tryForms = (QF, fd, GF) => {
    if (!GF) return;
    for (const F of QF) {
      if (F.k < LAYOUT * 0.9) continue;
      const G = GF[0];
      let typo = false;
      const ok = F.t.every((x) => G.t.some((y) => {
        if (y.startsWith(x)) return true;
        if (typoOf(x, y)) { typo = true; return true; }
        return false;
      }));
      if (ok && typo) { const s = FUZZY * F.k * fd.w; if (s > bs) { bs = s; bf = fd.name; } }
    }
  };
  for (const fd of P.fields) { tryForms(Q.L, fd, fd.L); tryForms(Q.H, fd, fd.H); }
  return bs > 0 ? { score: bs, field: bf, tier: 'fuzzy' } : null;
}

// ---------------------------------------------------------------- the engine

/**
 * opts: { amah (m per amah; proximity), recent() -> ids, filter(doc) -> boolean (false hides it), onError(e) }.
 * Sources: { kind, label, docs: Doc[] | (ctx?) => Doc[], live?: boolean, dated?: boolean }; `ctx` is passed to docs().
 */
export function createEngine(opts = {}) {
  const amah = opts.amah || 0.48;
  const recs = [];
  let dict = null; // fuzzy dictionary: token → prepared docs (static sources)
  const liveCache = new Map(); // doc id → { sig, P }
  const warned = new Set();
  const warn = (src, e) => {
    if (warned.has(src)) return;
    warned.add(src);
    (opts.onError || console.error)(`[search] source ${src.kind || '?'} failed`, e);
  };

  function docsOf(rec) {
    try {
      const d = typeof rec.src.docs === 'function' ? rec.src.docs(opts.ctx) : rec.src.docs;
      return Array.isArray(d) ? d.filter((x) => x && x.id && x.kind) : [];
    } catch (e) { warn(rec.src, e); return []; }
  }

  const engine = {
    /** register a source; returns a function that removes it */
    add(src) {
      if (!src) return () => {};
      const rec = { src, live: !!src.live, prepared: null, queue: null, pos: 0 };
      recs.push(rec);
      dict = null;
      return () => { const i = recs.indexOf(rec); if (i >= 0) recs.splice(i, 1); dict = null; };
    },
    /** static sources still to prepare */
    get pending() { return recs.some((r) => !r.live && !r.prepared); },
    /**
     * Prepare static sources until `ms` milliseconds have passed (Infinity = all). Returns true when all are ready.
     * A source's documents are fetched once, then prepared CHUNK at a time between clock checks.
     */
    build(ms = Infinity, now = () => performance.now()) {
      const t0 = now();
      for (const rec of recs) {
        if (rec.live || rec.prepared) continue;
        if (!rec.queue) { rec.queue = docsOf(rec); rec.pos = 0; rec.acc = []; }
        while (rec.pos < rec.queue.length) {
          const end = Math.min(rec.queue.length, rec.pos + CHUNK);
          for (; rec.pos < end; rec.pos++) rec.acc.push(prepare(rec.queue[rec.pos]));
          if (now() - t0 >= ms) return false;
        }
        for (const P of rec.acc) P.static = true;
        rec.prepared = rec.acc;
        rec.queue = rec.acc = null;
        dict = null;
        if (now() - t0 >= ms) return false;
      }
      // last: the typo dictionary (else the first query that needs it builds it)
      if (!dict) buildDict();
      return true;
    },
    /** mark static sources for re-preparing (all, or those pred(src) picks) */
    invalidate(pred = null) {
      for (const rec of recs) if (!rec.live && (!pred || pred(rec.src))) { rec.prepared = null; rec.queue = null; }
      dict = null;
    },
    /** every prepared static document (tests) */
    docs() { return recs.flatMap((r) => (r.prepared || []).map((P) => P.doc)); },

    /**
     * Results for q, best first (synchronous; prepares whatever is still pending first).
     * opts: { scope?: kind | kind[], limit = 40, boost?: { kinds?: { kind: factor }, near?: [X, Y], zone?, recent?: id[] } }
     */
    query(q, { scope = null, limit = 40, boost = null } = {}) {
      const Q = prepareQuery(q);
      const QX = prepareQuery(q, { layout: true });
      if (!Q && !QX) return [];
      if (engine.pending) engine.build(Infinity);
      const kinds = scope ? new Set([].concat(scope)) : null;
      const filter = opts.filter;
      const visible = (d) => (!kinds || kinds.has(d.kind)) && (!filter || filter(d) !== false);
      // the documents: the prepared static ones, and the live sources' (prepared on first sight, re-prepared on change)
      const pool = [], live = [];
      for (const rec of recs) {
        if (!rec.live) { for (const P of rec.prepared || []) pool.push(P); continue; }
        for (const d of docsOf(rec)) {
          const s = sig(d), c = liveCache.get(d.id);
          let P;
          if (c && c.sig === s) { P = c.P; P.doc = d; } else { P = prepare(d); liveCache.set(d.id, { sig: s, P }); }
          pool.push(P); live.push(P);
        }
      }
      if (liveCache.size > 4000) liveCache.clear();
      const found = new Map();
      const keep = (P, m) => {
        const prev = found.get(P.doc.id);
        if (!prev || m.score > prev.m.score) found.set(P.doc.id, { P, m });
      };
      const scan = (Qa) => {
        for (const P of pool) {
          if (!visible(P.doc) || !maybe(P, Qa)) continue;
          const m = matchDoc(P, Qa);
          if (m) keep(P, m);
        }
      };
      if (Q) scan(Q);
      // little found: the query re-typed on the other keyboard layout, then typos (the token dictionary, the live docs)
      if (found.size < FUZZY_BELOW && QX) scan(QX);
      for (const Qa of [Q, QX]) {
        if (!Qa || found.size >= FUZZY_BELOW || Qa.prefixOnly) continue;
        if (![...Qa.L, ...Qa.H].some((F) => F.t.some((x) => fuzzMax(x) > 0))) continue;
        const near = new Map();
        const cands = new Set(live);
        for (const P of fuzzyCandidates(Qa, near)) cands.add(P);
        for (const P of cands) {
          if (found.has(P.doc.id) || !visible(P.doc)) continue;
          const m = fuzzyDoc(P, Qa, near);
          if (m) keep(P, m);
        }
      }
      const raw = (Q || QX).raw;
      // boosts
      const b = boost || {};
      const recent = new Set(b.recent || safe(opts.recent) || []);
      const nearR = 60 / amah;
      const out = [];
      for (const { P, m } of found.values()) {
        const d = P.doc;
        let s = m.score * (d.weight ?? 1) * (KIND_WEIGHT[d.kind] ?? 0.9) * (b.kinds?.[d.kind] ?? 1);
        let c = 1;
        if (b.near && Array.isArray(d.at) && Math.hypot(d.at[0] - b.near[0], d.at[1] - b.near[1]) <= nearR) c *= 1.2;
        if (b.zone && d.zone && d.zone === b.zone) c *= 1.2;
        let active = false;
        try { active = !!d.when?.active; } catch { /* a live getter */ }
        if (active) c *= 1.3;
        if (recent.has(d.id)) c *= 1.1;
        s *= Math.min(c, CONTEXT_CAP);
        out.push({ doc: d, score: s, field: m.field, ranges: ranges(d, m.field, raw), tier: m.tier, _band: BAND[m.tier] ?? 0, _len: P.tlen });
      }
      out.sort((x, y) => y._band - x._band || y.score - x.score || x._len - y._len);
      const res = out.slice(0, limit);
      for (const r of res) { delete r._len; delete r._band; }
      return res;
    },

    /** { he, latin, skeleton, layoutSwapped } */
    normalize(q) {
      const s = String(q ?? '');
      const t = latinTokens(s);
      return { he: normHe(s), latin: t.join(' '), skeleton: t.map(skeleton).join(' '), layoutSwapped: swapLayout(s) };
    },
  };

  /** the typo dictionary: token → documents, the tokens by first and by second letter, every token's beginnings */
  function buildDict() {
    dict = { tok: new Map(), first: new Map(), second: new Map(), starts: new Set() };
    for (const rec of recs) {
      for (const P of rec.prepared || []) {
        for (const t of P.toks) {
          if (t.length < 3) continue;
          let a = dict.tok.get(t);
          if (!a) {
            dict.tok.set(t, (a = []));
            for (const [m, c] of [[dict.first, t[0]], [dict.second, t[1]]]) { let l = m.get(c); if (!l) m.set(c, (l = [])); l.push(t); }
            for (let k = 3; k <= t.length; k++) dict.starts.add(t.slice(0, k));
          }
          a.push(P);
        }
      }
    }
  }
  /**
   * Static documents with a token a typo away from a query token that begins no known word; near collects, per query
   * token, the dictionary tokens it matched (fuzzyDoc reads them instead of measuring again).
   */
  function fuzzyCandidates(Q, near) {
    if (!dict) buildDict();
    const out = new Set();
    for (const F of [...Q.L, ...Q.H]) {
      for (const x of F.t) {
        // a token that begins a known word is spelled right (prefix tiers cover it): only the others are typos
        if (!fuzzMax(x) || dict.starts.has(x)) continue;
        // one typo leaves the first or the second letter in place, or swaps them (fuzzyTok checks the rest)
        const seen = new Set();
        for (const list of [dict.first.get(x[0]), dict.second.get(x[1]), dict.first.get(x[1])]) {
          for (const t of list || []) {
            if (seen.has(t) || t.length < x.length - 2) continue;
            seen.add(t);
            if (fuzzyTok(x, t)) {
              if (!near.has(x)) near.set(x, new Set());
              near.get(x).add(t);
              for (const P of dict.tok.get(t)) out.add(P);
            }
          }
        }
      }
    }
    return out;
  }
  return engine;
}

function safe(fn) { try { return typeof fn === 'function' ? fn() : null; } catch { return null; } }

/** where the query shows in the matched field's raw text (best effort; [] when its spelling differs) */
function ranges(doc, field, raw) {
  const text = field === 'title.en' ? doc.title?.en : field === 'title.he' ? doc.title?.he : field === 'translit' ? doc.translit : null;
  if (!text) return [];
  const i = String(text).toLowerCase().indexOf(raw.toLowerCase());
  return i >= 0 ? [[i, i + raw.length]] : [];
}
