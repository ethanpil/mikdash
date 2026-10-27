// ONE card renderer (console §3.3.6) for every subject: a person, an animal, an object, a place, a rite, an offering
// type, a word, a role. The skeleton: a type chip; the title (Hebrew large, English, transliteration); NOW, live at 4 Hz
// with progress; the action row (See in action, Follow, Go, Map, Learn, then module actions) right under it, so "see it
// in action" is in view when the card opens; WHY / WHAT IT IS FOR / WHO as a lead sentence with "more ›" and one
// "n sources ›" chip each; the type's sections (the first open, the rest collapsed); SOURCES n ›; the confidence badge.
import { h, he, setText, clear } from '../dom.js';
import { ico } from './icons.js';
import { parseSources } from '../sources.js';
import { sentences } from '../format.js';
import { parseRef, refStr } from './describe.js';

const TYPE = {
  person: 'Person', animal: 'Animal', object: 'Object', place: 'Place', event: 'Rite', offering: 'Offering', term: 'Word',
  role: 'Role', crowd: 'People', fire: 'Fire',
};
const CONF = {
  explicit: ['Sourced', 'mk-badge--gold'],
  ordering: ['Order sourced · minutes reconstructed', ''],
  reconstruction: ['Reconstruction', 'mk-badge--recon'],
};
const CONF_EVENT = { explicit: 'Time sourced', ordering: 'Order sourced · minutes reconstructed', reconstruction: 'Time reconstructed' };

/** a list of citations as Sefaria links (plain text where no link is certain) */
export function sourcesEl(list) {
  const items = parseSources(list);
  if (!items.length) return null;
  return h('div.mk-srcs', items.map((s) => (s.url
    ? h('a.mk-src', { href: s.url, target: '_blank', rel: 'noopener noreferrer', title: `Open ${s.text} on Sefaria (new tab)` }, s.text, ico('ext'))
    : h('span.mk-src', s.text))));
}

const tx = (o) => (o == null ? '' : typeof o === 'string' ? o : (o.en ?? ''));
/** an action label without the glyphs the inspect core writes in it ("▸ Watch now", "◎ Follow", "Go closer ▸"): the
 * button draws its own icon */
const actLabel = (o) => tx(o).replace(/^\s*[▸◎↶►⟶→]\s*/u, '').replace(/\s*[▸►]\s*$/u, '');

/** a lead sentence, with the rest behind "more ›" */
function leadMore(text, lead) {
  const full = tx(text);
  if (!full) return null;
  const ss = sentences(full);
  const first = tx(lead) || ss.slice(0, ss[0]?.length < 40 ? 2 : 1).join(' ');
  const rest = full.slice(first.length).trim();
  const restEl = h('span.mk-card__rest', { hidden: true }, ` ${rest}`);
  const more = rest ? h('button.mk-linkbtn.mk-card__more', {
    type: 'button', 'aria-expanded': 'false',
    on: { click: () => { const on = restEl.hidden; restEl.hidden = !on; more.setAttribute('aria-expanded', on ? 'true' : 'false'); setText(more.firstChild, on ? 'less' : 'more'); } },
  }, h('span', 'more'), ' ›') : null;
  return h('p.mk-card__p', first, restEl, more ? ' ' : null, more);
}
const paras = (text) => String(tx(text)).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => h('p.mk-card__p', p));

/** a block's citations as one "n sources ›" chip that opens them in place (the card's Sources list holds them all) */
function sourcesChip(list) {
  const n = parseSources(list).length;
  if (!n) return null;
  if (n === 1) return sourcesEl(list);
  const box = h('div.mk-card__blksrc', { hidden: true });
  const btn = h('button.mk-chip3.mk-chip3--btn.mk-card__srcchip', {
    type: 'button', 'aria-expanded': 'false',
    on: { click: () => { const on = box.hidden; if (on && !box.childNodes.length) box.append(sourcesEl(list)); box.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); } },
  }, `${n} sources ›`);
  return h('div.mk-card__blksrcs', btn, box);
}

/** HOLDING: each prop a chip that opens what it is for, in place (no hover on touch; read by screen readers) */
function holdingEl(list) {
  const what = h('p.mk-card__p.mk-card__holdwhat', { hidden: true, 'aria-live': 'polite' });
  let openI = -1;
  const chips = list.map((p, i) => {
    const has = !!tx(p.what);
    if (!has) return h('span.mk-chip3', tx(p.title), p.title?.he ? [' ', he(p.title.he)] : null);
    const b = h('button.mk-chip3.mk-chip3--btn', {
      type: 'button', 'aria-expanded': 'false',
      on: {
        click: () => {
          const on = openI !== i;
          for (const c of chips) c.setAttribute?.('aria-expanded', 'false');
          openI = on ? i : -1;
          b.setAttribute('aria-expanded', on ? 'true' : 'false');
          what.hidden = !on;
          if (on) what.replaceChildren(h('b', `${tx(p.title)}: `), tx(p.what));
        },
      },
    }, tx(p.title), p.title?.he ? [' ', he(p.title.he)] : null, ' ›');
    return b;
  });
  return h('div.mk-card__blk', h('span.mk-card__k', 'Holding'), h('div.mk-chips', chips), what);
}

/**
 * card: the Card data (describe). opts: { onBack(), backLabel, pinned, onPin(), sectionsFirst (Here: the live blocks
 * first), now: false (no NOW line), extraSections, augment(card) -> card (re-applied when fresh data arrives) }
 * returns { el, update(t), card, focus(), openSources(), section(id) }. A placeholder card (card.loading: the inspect
 * core's describer still loading) rebuilds itself when the real one arrives.
 */
export function renderCard(app, card, opts = {}) {
  const wrap = h('div.mk-cardwrap');
  let inner = buildCard(app, opts.augment ? opts.augment(card) : card, opts);
  wrap.append(inner.el);
  return {
    el: wrap,
    update(t) {
      inner.update(t);
      const f = inner.fresh;
      if (f) { inner = buildCard(app, opts.augment ? opts.augment(f) : f, opts); wrap.replaceChildren(inner.el); }
    },
    get card() { return inner.card; },
    focus() { inner.focus(); },
    openSources() { inner.openSources(); },
    section(id) { return inner.section(id); },
  };
}

function buildCard(app, card, opts = {}) {
  const { ctx } = app;
  const kind = card.kind || parseRef(card.ref)?.kind;
  const ref = refStr(parseRef(card.ref));
  const titleId = `mk-card-${Math.random().toString(36).slice(2, 8)}`;

  // ---------------- head ----------------
  const typeChip = h('span.mk-card__type', TYPE[kind] || 'About', card.title?.he && kind !== 'place' ? [' · ', he(card.title.he)] : null);
  const headBtns = [];
  if (opts.onPin) headBtns.push(h('button.mk-hbtn.mk-card__pin', { type: 'button', 'aria-pressed': opts.pinned ? 'true' : 'false', on: { click: opts.onPin } }, ico('pin'), h('span', opts.pinned ? 'Pinned' : 'Pin')));
  if (opts.onBack) headBtns.push(h('button.mk-hbtn.mk-card__back', { type: 'button', on: { click: opts.onBack } }, ico('prev'), h('span', opts.backLabel || 'Back')));
  const titleEl = h('h3.mk-card__title', { id: titleId, tabindex: '-1' },
    card.title?.he ? he(card.title.he, 'mk-card__he') : null,
    h('span.mk-card__en', tx(card.title) || ref),
    card.translit ? h('span.mk-card__tr', card.translit) : null);
  const sub = card.subtitle ? h('p.mk-card__sub', tx(card.subtitle)) : null;

  // ---------------- now ----------------
  const nowTxt = h('span.mk-card__nowtxt');
  const nowBar = h('i.mk-card__nowbar');
  const nowEl = h('div.mk-card__now', { hidden: true }, h('span.mk-card__k', 'Now'), nowTxt, h('span.mk-card__nowtrack', nowBar));

  // ---------------- why / what / who ----------------
  const block = (k, label) => {
    const b = card[k];
    if (!b || !tx(b.text)) return null;
    return h(`div.mk-card__blk.mk-card__${k}`, h('span.mk-card__k', label), leadMore(b.text), b.sources?.length ? sourcesChip(b.sources) : null);
  };
  const whatLabel = kind === 'term' ? 'Meaning' : kind === 'offering' ? 'What it is' : kind === 'place' ? 'About' : 'What it is for';
  const blocks = [block('why', 'Why'), block('what', whatLabel), block('who', kind === 'event' ? 'Who' : 'Who')];

  const holding = card.holding?.length ? holdingEl(card.holding) : null;
  const measures = card.measures?.length ? h('div.mk-card__blk', h('span.mk-card__k', 'Measures'),
    h('dl.mk-card__meas', card.measures.flatMap((m) => [h('dt', tx(m.label)), h('dd.num', `${m.amot} amot ≈ ${m.m} m`, m.confidence && m.confidence !== 'explicit' && m.confidence !== 'derived' && m.confidence !== 'locked' ? h('span.mk-badge.mk-badge--recon', m.confidence) : null)]))) : null;

  // ---------------- sections ----------------
  const live = []; // { update(t) } of live parts
  const secEls = [];
  const allSections = [...(card.sections || []), ...(opts.extraSections || []), ...app.modules.cardSections(card)];
  allSections.forEach((s, i) => {
    const body = h('div.mk-card__secbody');
    if (s.mount) { try { const r = s.mount(body); if (r?.update) live.push(r); } catch (e) { console.error('[ui] card section', e); } }
    if (s.lead && s.text) body.append(leadMore(s.text, s.lead));
    else if (s.text) body.append(...paras(s.text));
    if (s.items?.length) {
      body.append(h('ul.mk-list.mk-card__items', s.items.map((it) => {
        const t = typeof it === 'string' ? it : tx(it.text) || tx(it.title);
        const r = it.ref ? (typeof it.ref === 'string' ? it.ref : refStr(it.ref)) : null;
        return h('li', r ? h('button.mk-linkbtn', { type: 'button', on: { click: () => app.card(r) } }, t, ' ›') : t, it.sources?.length ? sourcesEl(it.sources) : null);
      })));
    }
    if (s.refs?.length) {
      body.append(h('div.mk-chips', s.refs.map((r0) => {
        const r = typeof r0 === 'string' ? r0 : refStr(r0.ref ? parseRef(r0.ref) : r0);
        return h('button.mk-chip3.mk-chip3--btn', { type: 'button', on: { click: () => app.card(r) } }, app.titleOf(r) || r, ' ›');
      })));
    }
    if (s.sources?.length) body.append(sourcesEl(s.sources));
    if (!body.childNodes.length) return;
    const title = tx(s.title);
    if (!title) { secEls.push(h('div.mk-card__sec', { 'data-sec': s.id || '' }, body)); return; }
    const d = h('details.mk-card__sec', { 'data-sec': s.id || '' }, h('summary.mk-card__sech', title), body);
    if (i === 0 || s.open || (secEls.length === 0)) d.open = true;
    secEls.push(d);
  });
  const related = card.related?.length ? h('div.mk-card__blk', h('span.mk-card__k', 'Related'),
    h('div.mk-chips', card.related.map((r) => h('button.mk-chip3.mk-chip3--btn', { type: 'button', on: { click: () => app.card(r.ref) } }, tx(r.title), ' ›')))) : null;

  // ---------------- sources + confidence ----------------
  const srcs = card.sources?.length ? sourcesEl(card.sources) : null;
  const n = parseSources(card.sources || []).length;
  let srcList = null, srcBtn = null;
  if (srcs) {
    srcList = h('div.mk-card__srclist', { hidden: !opts.sourcesOpen }, srcs);
    srcBtn = h('button.mk-linkbtn.mk-card__srcbtn', {
      type: 'button', 'aria-expanded': opts.sourcesOpen ? 'true' : 'false',
      on: { click: () => { const on = srcList.hidden; srcList.hidden = !on; srcBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); } },
    }, `Sources ${n} ›`);
  }
  const confTxt = kind === 'event' ? CONF_EVENT[card.confidence] : CONF[card.confidence]?.[0];
  const conf = confTxt ? h(`span.mk-badge.${CONF[card.confidence]?.[1] || 'x'}`, { title: card.confidenceNote || '' }, confTxt) : null;
  const foot = srcBtn || conf ? h('div.mk-card__foot', srcBtn, conf) : null;

  // ---------------- actions ----------------
  const acts = h('div.mk-card__acts');
  const actNote = h('p.mk-card__actnote.mk-muted', { hidden: true });
  function buildActions(c) {
    clear(acts);
    const list = [...(c.actions || [])];
    const order = { 'see-in-action': 0, follow: 1, go: 2, time: 3, map: 4, learn: 5 };
    list.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
    let shown = 0, note = '';
    for (const a of list) {
      if (a.kind === 'see-in-action') {
        if (!ctx.inspect?.seeInAction || shown >= 2) continue;
        shown++;
        // "This stops your walk": a show cancels the trip under way
        if (!note && tx(a.note)) note = tx(a.note);
        acts.append(h(`button.mk-btn${shown === 1 ? '.mk-btn--primary' : ''}`, { type: 'button', 'data-act': 'show', on: { click: () => app.travel.runAction(a, c) } }, ico('show'), actLabel(a.label) || 'Show me'));
      } else if (a.kind === 'follow') {
        if (!ctx.inspect?.follow) continue;
        acts.append(h('button.mk-btn', { type: 'button', 'data-act': 'follow', on: { click: () => app.travel.runAction(a, c) } }, ico('follow'), actLabel(a.label) || 'Follow'));
      } else if (a.kind === 'go') {
        acts.append(app.travel.control(() => app.travel.runAction(a, c), { label: actLabel(a.label) && actLabel(a.label).length < 22 ? actLabel(a.label) : 'Go', primary: !shown }));
      } else if (a.kind === 'time') {
        acts.append(h('button.mk-btn', { type: 'button', 'data-act': 'time', on: { click: () => { app.travel.runAction(a, c); update(); } } }, ico('time'), actLabel(a.label) || 'Set the clock'));
      } else if (a.kind === 'map') {
        acts.append(h('button.mk-btn', { type: 'button', 'data-act': 'map', on: { click: () => app.travel.runAction(a, c) } }, ico('map'), 'Map'));
      } else if (a.kind === 'learn') {
        acts.append(h('button.mk-btn', { type: 'button', 'data-act': 'learn', on: { click: () => app.travel.runAction(a, c) } }, ico('learn'), tx(a.label) || 'Learn ›'));
      }
    }
    for (const a of app.modules.cardActions(c)) {
      acts.append(h('button.mk-btn', { type: 'button', 'data-act': `module-${a.id}`, on: { click: () => { try { a.run(); } catch (e) { console.error('[ui] module action', e); } } } }, a.icon ? ico(a.icon) : null, tx(a.label)));
    }
    acts.hidden = !acts.childNodes.length;
    setText(actNote, note);
    actNote.hidden = !note;
    actKey = actionsKey(c);
  }
  /** what the see-in-action buttons say and do: when it changes (the moment passed, a step ended) the row is rebuilt */
  const actionsKey = (c) => (c.actions || []).filter((a) => a.kind === 'see-in-action').map((a) => `${a.id}|${a.mode}|${tx(a.label)}|${a.mode === 'now' ? '' : Math.round((a.t ?? 0) * 10)}|${a.date || ''}`).join(';');
  let actKey = '', actAt = 0;
  buildActions(card);

  const el = h(`article.mk-card.mk-card--${kind || 'x'}`, { 'aria-labelledby': titleId, 'data-ref': ref },
    h('div.mk-card__head', typeChip, h('span.mk-card__hbtns', headBtns)),
    titleEl, sub, nowEl, acts, actNote, ...(opts.sectionsFirst ? [...secEls, ...blocks] : [...blocks, holding, measures, ...secEls]), opts.sectionsFirst ? holding : null, opts.sectionsFirst ? measures : null, related, foot, srcList);

  // ---------------- live NOW ----------------
  let cur = card, lastNow = '', lastP = '', fresh = null;
  function paintNow(now) {
    const t = tx(now?.text);
    if (t !== lastNow) { lastNow = t; setText(nowTxt, t); nowEl.hidden = !t; }
    const p = Number.isFinite(now?.progress) && now.progress > 0 ? `scaleX(${Math.min(1, now.progress).toFixed(3)})` : '';
    if (p !== lastP) { lastP = p; nowBar.style.transform = p || 'scaleX(0)'; nowBar.parentElement.hidden = !p; }
  }
  if (opts.now !== false) paintNow(card.now);
  let descAt = -1e9;
  function update(t = ctx.time?.t) {
    try {
      // a card without its NOW line (Here) re-describes only for its action labels: at most once a second
      const now0 = performance.now();
      if (opts.now === false && !card.loading && now0 - descAt < 1000) { for (const l of live) { try { l.update(t); } catch { /* ignore */ } } return; }
      descAt = now0;
      const c = app.describe(card.ref, t);
      if (c && card.loading && !c.loading) fresh = c;
      else if (c) {
        cur = c;
        if (opts.now !== false) paintNow(c.now);
        // the label always says what will happen: rebuild the action row (≤ 1 Hz) when its moments change, keeping
        // keyboard focus on the same action
        const now = performance.now();
        if (now - actAt >= 1000) {
          actAt = now;
          if (actionsKey(c) !== actKey) {
            const f = acts.contains(document.activeElement) ? document.activeElement.closest('[data-act]')?.dataset.act : null;
            // the fresh actions, plus those of kinds only the card as built had (Here adds its own Go)
            const fresh = [...(c.actions || [])];
            for (const a of card.actions || []) if (!fresh.some((x) => x.kind === a.kind)) fresh.push(a);
            buildActions({ ...c, actions: fresh });
            if (f) acts.querySelector(`[data-act="${f}"]`)?.focus({ preventScroll: true });
          }
        }
      }
    } catch { /* keep the last */ }
    for (const l of live) { try { l.update(t); } catch { /* ignore */ } }
  }

  return {
    el, update,
    get fresh() { return fresh; },
    get card() { return cur; },
    focus() { titleEl.focus({ preventScroll: true }); },
    openSources() { if (srcList) { srcList.hidden = false; srcBtn.setAttribute('aria-expanded', 'true'); } },
    section(id) { return el.querySelector(`[data-sec="${CSS.escape(id)}"]`); },
  };
}
