// "See in action" for the inspect core (console-design §4.1, §4.2, §6.2): choosing the moment to show, and the director
// that warps or jumps the clock, places the observer and frames (or follows) the subject — with a Return snapshot so
// Cancel and "↶ Back" restore date, time, place, view, speed and pause.
//
//   momentActions(ctx, spec) -> Action[]      the see-in-action actions for a window (rules: the table in §4.1)
//   createDirector(ctx, { schedule, runtime, inspect }) -> { seeInAction, run, back, frame, follow, show, canBack, backLabel }
//
// Uses only public APIs: ctx.time (set, setDate, setSpeed, pause), ctx.player (teleport, setLook, cancel, setMode),
// ctx.ui.fade, ctx.audio.setMaster (restored from ctx.settings 'volume'), ctx.schedule.viewOf and runtime.plans.done.
// Emits bus 'inspect:show' { id, phase, mode, progress?, label:{en} } at each phase (≤ 4 Hz while warping).
import { Vector3 } from 'three';
import { PRIORITY } from '../core/engine.js';
import { m2w, w2m } from '../core/units.js';

const DAY = 1440;
const WARP_MAX_GAP = 20;          // sim minutes: up to this a warp, beyond it a jump
const WARP_SECONDS = 4;           // real seconds a warp takes
const LAND_BEFORE = 0.1;          // sim minutes: land this much before the moment (its cues fire in continuous play)
const EASE_LAST = 0.5;            // sim minutes over which a warp eases to 1×
const PLACE_FAR = 20;             // m: farther than this from the view, the director places the observer
const PITCH_MIN = -25, PITCH_MAX = 10;
const FOLLOW_RATE = 90;           // deg/s
const FOLLOW_MAX = 180;           // s
const SEEK_MS = 20000;            // ms: a figure not found at the landing is looked for this long, then framed when it comes
const BACK_CHIP = 600;            // s: the Back chip lasts this long

const wrap = (t) => ((t % DAY) + DAY) % DAY;
const since = (t, t0) => wrap(t - t0);
const within = (t, a, b) => (a <= b ? t >= a && t < b : t >= a || t < b);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const hhmm = (t) => { const m = Math.round(wrap(t)); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const dur = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h${r ? ` ${r}` : ''}` : `${r} min`; };

/** 'YYYY-MM-DD' plus n days */
export function addDays(ds, n) {
  const [y, m, d] = String(ds).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
/** day type of a date string (weekday | friday | shabbat) */
export function dayTypeOf(ds) {
  const [y, m, d] = String(ds).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 5 ? 'friday' : wd === 6 ? 'shabbat' : 'weekday';
}

/** minutes from (dateA, tA) to (dateB, tB), across dates */
export function minutesBetween(dateA, tA, dateB, tB) {
  const day = (ds) => { const [y, m, d] = String(ds).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  return (day(dateB) - day(dateA)) * DAY + (tB - tA);
}

/**
 * The see-in-action actions for a moment window (§4.1 "Choosing the moment"). Moments carry a date: a window in
 * progress that began before midnight starts on the previous date; a start just after midnight is a warp across it.
 * spec: { t0, t1 (sim minutes, may wrap), what: { en } (what is shown), eventId?, focus?, view?, follow?, subjectKey?,
 *         choreo?, dayTypes? (for "tomorrow"), tomorrow? (false: never offer it — a dynamic instance), stepT0? (the
 *         subject's own start, when later than the window's), another? ({ t0, t1, label, eventId?, subjectKey?, view? }:
 *         the next instance of a kind, for a dynamic instance already over) }
 */
export function momentActions(ctx, spec, t = ctx.time?.t) {
  const out = [];
  if (!spec || !Number.isFinite(spec.t0)) return out;
  const t0 = wrap(spec.t0), t1 = Number.isFinite(spec.t1) ? wrap(spec.t1) : wrap(spec.t0 + 15);
  const base = {
    kind: 'see-in-action', eventId: spec.eventId, focus: spec.focus, view: spec.view, follow: !!spec.follow,
    subjectKey: spec.subjectKey, choreo: spec.choreo, what: spec.what,
  };
  // a trip in progress is stopped by a show (§4.1 step 1): the card says so
  if (ctx.player?.trip || ctx.player?.mode === 'auto') base.note = { en: 'This stops your walk' };
  const what = spec.what?.en || 'this';
  const date = ctx.time?.dateString;
  const prevDate = date ? addDays(date, -1) : date, nextDate = date ? addDays(date, 1) : date;
  const recurs = (d) => spec.tomorrow !== false && (!spec.dayTypes || spec.dayTypes.includes(dayTypeOf(d)));
  const id = (s) => `see:${spec.eventId || spec.subjectKey || what}:${s}`;
  const ahead = (gap) => (gap < 1 ? '▸ Skip ahead: it begins in a moment' : `▸ Skip ahead ${dur(gap)}`);
  if (within(t, t0, t1)) {
    const left = since(t1, t);
    out.push({ ...base, id: id('now'), label: { en: `▸ Watch now (≈${dur(left)} left)` }, mode: 'now', t, date, primary: true });
    let s0 = Number.isFinite(spec.stepT0) && within(wrap(spec.stepT0), t0, t1) ? wrap(spec.stepT0) : t0;
    if (since(t, s0) > since(t, t0)) s0 = t0;
    // it began before midnight: its start is on the previous date
    if (since(t, s0) > 1) out.push({ ...base, id: id('start'), label: { en: `▸ From the start (≈${hhmm(s0)})` }, mode: 'jump', t: s0, date: s0 > t ? prevDate : date });
    return out;
  }
  if (t0 > t) {
    const gap = t0 - t;
    if (gap <= WARP_MAX_GAP) out.push({ ...base, id: id('warp'), label: { en: ahead(gap) }, mode: 'warp', t: t0, date, primary: true });
    else out.push({ ...base, id: id('later'), label: { en: `▸ Skip to ≈${hhmm(t0)} (in ${dur(gap)})` }, mode: 'jump', t: t0, date, primary: true });
    return out;
  }
  // it starts again just after midnight: a warp across the date
  if (date && t0 + DAY - t <= WARP_MAX_GAP && recurs(nextDate) && !spec.another) {
    out.push({ ...base, id: id('warp'), label: { en: ahead(t0 + DAY - t) }, mode: 'warp', t: t0, date: nextDate, primary: true });
    return out;
  }
  // already over today: a rewind; tomorrow when it recurs
  if (spec.another && Number.isFinite(spec.another.t0)) {
    const a = spec.another;
    const live = Number.isFinite(a.t1) && within(t, wrap(a.t0), wrap(a.t1));
    const gap = !live && a.t0 > t ? a.t0 - t : null;
    out.push({ ...base, id: id('another'), label: { en: live ? `▸ Show me another ${a.label?.en || what} (now)` : gap != null ? `▸ Show me another ${a.label?.en || what} (≈ in ${dur(gap)})` : `▸ Show me another ${a.label?.en || what} (≈${hhmm(a.t0)})` },
      mode: live ? 'now' : gap != null && gap <= WARP_MAX_GAP ? 'warp' : 'jump', t: live ? t : a.t0, date, primary: true,
      eventId: a.eventId || spec.eventId, subjectKey: a.subjectKey, focus: a.subjectKey ? a.focus : (a.focus || (spec.subjectKey ? undefined : spec.focus)), view: a.view || spec.view });
    return out;
  }
  out.push({ ...base, id: id('rewind'), label: { en: `▸ Rewind to ≈${hhmm(t0)}` }, mode: 'jump', t: t0, date, primary: true });
  if (date && recurs(nextDate)) {
    out.push({ ...base, id: id('tomorrow'), label: { en: `▸ Tomorrow, ≈${hhmm(t0)}` }, mode: 'jump', t: t0, date: nextDate });
  }
  return out;
}

// --------------------------------------------------------------------------------------------------- the director
export function createDirector(ctx, { schedule, runtime, inspect }) {
  const bus = ctx.bus;
  let current = null;              // ShowHandle in progress or showing
  let last = null;                 // { snap, at: performance.now(), label }
  let seq = 0;
  let follow = null;               // { subject, until, locateAt, pos }
  let seek = null;                 // { h, action, until, at }: the show's figure, not found yet
  const _v = new Vector3(), _e = new Vector3();

  const vol = () => { const v = +ctx.settings?.get?.('volume'); return Number.isFinite(v) ? (v > 1 ? v / 100 : v) : 1; };
  const dip = (on) => { try { ctx.audio?.setMaster?.(on ? vol() * 0.25 : vol()); } catch { /* audio off */ } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // the veil never holds the director: a fade that does not settle is given up after its time + 0.7 s
  const fade = (to, ms) => { try { return Promise.race([Promise.resolve(ctx.ui?.fade?.(to, ms)).catch(() => {}), sleep((+ms || 0) + 700)]); } catch { return Promise.resolve(); } };
  // rAF stops in a hidden tab: a frame wait is capped so the director cannot hang there either
  const frames = (n = 1) => Promise.race([new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), sleep(100 * n + 400)]);
  /** where to land for a moment: LAND_BEFORE ahead of it, on the previous date when that crosses midnight */
  const landing = (date, t) => { const l = t - LAND_BEFORE; return l < 0 ? { date: addDays(date, -1), t: l + DAY } : { date, t: l }; };

  function emit(h, extra = {}) {
    try { bus.emit('inspect:show', { id: h.id, phase: h.phase, mode: h.mode, progress: h.progress, label: h.label, ...extra }); } catch { /* listeners */ }
  }

  function snapshot() {
    const time = ctx.time, p = ctx.player;
    return {
      date: time?.dateString, t: time?.t, speed: time?.speed ?? 1, paused: !!time?.paused,
      feet: p?.position?.clone?.() || null, heading: p?.heading ?? 0, pitch: p?.pitch ?? 0, mode: p?.mode === 'fly' ? 'fly' : 'walk',
      zone: ctx.zones?.current || null,
    };
  }
  async function restore(s) {
    if (!s) return false;
    follow = null;
    await fade(1, 220);
    const time = ctx.time;
    if (s.date && time?.dateString !== s.date) { time.setDate(s.date); await waitPlans(); }
    if (Number.isFinite(s.t)) time?.set(s.t);
    time?.setSpeed?.(s.speed);
    time?.pause?.(s.paused);
    dip(false);
    if (s.feet) {
      try { ctx.player?.teleport?.(s.feet, { fade: false }); } catch { /* player missing */ }
      if (s.mode === 'fly') ctx.player?.setMode?.('fly');
    }
    ctx.player?.setLook?.(s.heading, s.pitch);
    await frames(2);
    await fade(0, 220);
    return true;
  }
  async function waitPlans(cap = 8000) {
    const t0 = performance.now();
    await frames(2);
    const P = runtime?.plans;
    while (P && !P.done && performance.now() - t0 < cap) await sleep(60);
  }

  // ------------------------------------------------------------------------------------- where the subject is
  /**
   * The point to frame for a show's subject at the clock's time now: { p, on } with on = 'subject' (the figure found
   * by its key), 'focus' (an element, fire, place or a site point), 'event' (where the event is), or null. A figure is
   * never guessed: while its key finds no one, the event (or the focus) stands in for it. Figures and events are
   * framed at chest height, elements at their middle (at most 1.5 m above their base).
   */
  function subjectAim(action, target = new Vector3()) {
    if (action.subjectKey && action.choreo) {
      const p = inspect.locate(action.choreo, action.subjectKey, target);
      if (p) return { p: chest(p), on: 'subject' };
    }
    const f = action.focus;
    const focusPoint = () => {
      if (!f) return null;
      if (Array.isArray(f.at)) return m2w(f.at[0], f.at[1], f.at[2] ?? 16, target);
      if (f.kind === 'actor') return null;              // a figure is found by its key, never by its pooled slot
      const p = inspect.anchorOf(f);
      if (!p) return null;
      target.copy(p);
      if (f.kind === 'el') { const hgt = inspect.heightOf?.(f) ?? 0; target.y += Math.min(1.5, hgt / 2); }
      return target;
    };
    if (f && !action.subjectKey) { const p = focusPoint(); if (p) return { p, on: 'focus' }; }
    if (action.eventId) {
      const ev = schedule?.byId?.(action.eventId);
      const p = ev && schedule.positionOf(ev, target);
      if (p) return { p: chest(p), on: 'event' };
    }
    const p = focusPoint();
    return p ? { p, on: 'focus' } : null;
  }
  const subjectPos = (action, target) => subjectAim(action, target)?.p || null;
  /** a goTo target to watch from; fresh: the event's own view read now (a dynamic event's stand sees its figure now) */
  function viewFor(action, fresh = false) {
    const ev = action.eventId && schedule?.byId?.(action.eventId);
    if (fresh && ev?.dynamic) { const v = schedule.viewOf(ev); if (v) return v; }
    if (action.view?.at) return { at: action.view.at, heading: action.view.heading };
    if (ev) { const v = schedule.viewOf(ev); if (v) return v; }
    return null;
  }
  const viewEye = (v) => m2w(v.at[0], v.at[1], v.at[2] ?? (ctx.player?.position ? w2m(ctx.player.position).Z : 16), new Vector3()).add(_v.set(0, 1.6, 0));
  function lineOfSight(from, to) {
    const ph = ctx.physics;
    if (!ph?.raycast) return true;
    _e.copy(to).sub(from);
    const d = _e.length();
    if (d < 0.5) return true;
    const h = ph.raycast(from, _e.normalize(), d);
    return !h || h.distance >= d - 0.6;
  }
  /** the heading and pitch that put a world point at the free area's centre */
  function lookAt(p) {
    const eye = ctx.player?.eye || ctx.camera.position;
    const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z;
    const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const flat = Math.hypot(dx, dz);
    let pitch = Math.atan2(dy, flat) * 180 / Math.PI;
    // the free area's centre is off the screen's: turn the camera the other way by the angle that offset subtends
    const inset = inspect.viewInset || { left: 0, right: 0, top: 0, bottom: 0 };
    const W = globalThis.innerWidth || 1280, H = globalThis.innerHeight || 720;
    const cam = ctx.camera;
    const vfov = (cam.fov || 60) * Math.PI / 180;
    const tanV = Math.tan(vfov / 2), tanH = tanV * (cam.aspect || W / H);
    const ox = ((inset.left || 0) - (inset.right || 0)) / 2, oy = ((inset.top || 0) - (inset.bottom || 0)) / 2;
    const yawOff = Math.atan((ox / (W / 2)) * tanH) * 180 / Math.PI;
    const pitchOff = Math.atan((oy / (H / 2)) * tanV) * 180 / Math.PI;
    pitch = clamp(pitch + pitchOff, PITCH_MIN, PITCH_MAX);
    return { heading: (bearing - yawOff + 360) % 360, pitch };
  }
  /** chest height of a figure at the subject's feet point */
  const chest = (p) => p.clone().add(new Vector3(0, 1.3, 0));

  async function frameTo(p, ms = 400) {
    if (!p) return;
    const target = lookAt(p);
    const pl = ctx.player;
    if (!pl?.setLook) return;
    const h0 = pl.heading ?? 0, p0 = pl.pitch ?? 0;
    let dh = ((target.heading - h0 + 540) % 360) - 180;
    if (!(ms > 0)) { pl.setLook(target.heading, target.pitch); return; }
    const t0 = performance.now();
    while (true) {
      const u = clamp((performance.now() - t0) / ms, 0, 1);
      const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
      pl.setLook((h0 + dh * e + 360) % 360, p0 + (target.pitch - p0) * e);
      if (u >= 1) break;
      await frames(1);
    }
  }

  // ------------------------------------------------------------------------------------- seeInAction
  function seeInAction(action) {
    if (!action) return null;
    const time = ctx.time;
    // a show still on its way is superseded: it stops where it is (no restore of its own), the new show waits for it to
    // settle, and the Return point stays the one taken before the first (never a mid-warp clock, speed or volume)
    const prev = current && !['done', 'cancelled', 'failed', 'showing'].includes(current.phase) ? current : null;
    if (prev) { prev.superseded = true; prev.cancelled = true; }
    const snap = prev?.snap || snapshot();
    const mode = action.mode || 'now';
    const date = action.date || time?.dateString;
    const tTarget = Number.isFinite(action.t) ? wrap(action.t) : time?.t;
    // what is shown (the bar and the chip put their own words round it: "Showing: …")
    const label = { en: action.what?.en || String(action.label?.en || '').replace(/^▸\s*/, '') || 'this moment' };
    let resolve;
    const h = {
      id: `show-${++seq}`, action, mode, label, phase: 'placing', snap,
      from: { date: snap.date, t: snap.t }, target: { date, t: tTarget },
      progress: mode === 'warp' ? 0 : null, etaReal: mode === 'warp' ? WARP_SECONDS : null,
      done: new Promise((r) => { resolve = r; }),
      cancelled: false, skipped: false, superseded: false, framedOn: null,
      skip() { if (h.phase === 'warping') h.skipped = true; },
      cancel() {
        if (['done', 'cancelled', 'failed'].includes(h.phase)) return;
        h.cancelled = true;
        if (h.phase === 'showing') { h.phase = 'cancelled'; seek = null; emit(h); restore(snap); return; }
      },
    };
    current = h;
    seek = null;
    last = { snap, at: performance.now(), label: backLabelOf(snap) };
    // an active trip stops (the card said "This stops your walk")
    try { if (ctx.player?.trip || ctx.player?.mode === 'auto') ctx.player.cancel?.(); } catch { /* player */ }
    run1().then((ok) => resolve(ok), (e) => { console.error('[inspect] show failed', e); h.phase = 'failed'; emit(h); dip(false); resolve(false); });

    async function abortIfCancelled() {
      if (!h.cancelled) return false;
      h.phase = 'cancelled';
      emit(h);
      dip(false);
      // superseded by a new show or by back(): that one places, sets the clock or restores
      if (!h.superseded) await restore(snap);
      return true;
    }

    async function run1() {
      if (prev) { await Promise.race([prev.done, sleep(3000)]); dip(false); }
      // 2. place: far from the view, or no line of sight to where the subject is now (its place at the moment, when
      // it moves, is only known after the clock is set — the frame step looks again)
      emit(h);
      const view = viewFor(action);
      let veiled = false;
      const eyeNow = ctx.player?.eye || ctx.camera.position;
      if (view) {
        const vw = m2w(view.at[0], view.at[1], view.at[2] ?? (ctx.player?.position ? w2m(ctx.player.position).Z : 16));
        const far = Math.hypot(vw.x - eyeNow.x, vw.z - eyeNow.z) > PLACE_FAR;
        const sp = subjectPos(action, new Vector3());
        const blocked = sp ? !lineOfSight(eyeNow, sp) : false;
        if (far || blocked) {
          await fade(1, 220);
          veiled = true;
          try { ctx.player?.teleport?.({ at: view.at, heading: view.heading }, { fade: false }); } catch (e) { console.warn('[inspect] teleport failed', e); }
        }
      }
      if (await abortIfCancelled()) return false;

      // 3. time (moments across midnight: the gap and the landing count dates)
      const gapAbs = time ? minutesBetween(time.dateString, time.t, date, tTarget) : 0;
      const land = landing(date, tTarget);
      if (mode === 'now') {
        if (time?.paused) time.pause(false);
        time?.setSpeed(1);
      } else if (mode === 'warp' && gapAbs > LAND_BEFORE && gapAbs <= WARP_MAX_GAP + 5) {
        if (veiled) { await frames(2); await fade(0, 220); veiled = false; }
        h.phase = 'warping';
        emit(h);
        dip(true);
        const ok = await warp(h, gapAbs - LAND_BEFORE, land);
        dip(false);
        if (!ok) { if (await abortIfCancelled()) return false; }
        if (h.skipped && !h.cancelled) {
          await fade(1, 220); veiled = true;
          if (land.date !== time.dateString) { time.setDate(land.date); await waitPlans(); }
          time.set(land.t);
        }
        time.pause(false);
        time.setSpeed(1);
      } else {
        // jump (also a warp whose target is no longer ahead)
        h.phase = 'jumping';
        emit(h, { note: land.date !== time?.dateString ? { en: "Preparing that day's service…" } : null });
        if (!veiled) { await fade(1, 220); veiled = true; }
        if (land.date && land.date !== time.dateString) { time.setDate(land.date); await waitPlans(); }
        time.set(land.t);
        time.pause(false);
        time.setSpeed(1);
      }
      if (await abortIfCancelled()) return false;

      // 4. frame: the subject after the clock change (the runtime re-poses on the next frame; a figure that has just
      // come in is placed a few frames later, so its key is asked again for a moment before the event stands in)
      h.phase = 'framing';
      emit(h);
      await frames(3);
      let aim = subjectAim(action, new Vector3());
      for (let k = 0, n = mode === 'now' ? 2 : 6; k < n && action.subjectKey && aim?.on !== 'subject'; k++) {
        if (await abortIfCancelled()) return false;
        await sleep(100);
        aim = subjectAim(action, new Vector3());
      }
      if (aim) {
        // the place may not see it now (a moving subject, an offering further on): a stand the event gives now
        const eye = ctx.player?.eye || ctx.camera.position;
        if (!lineOfSight(eye, aim.p)) {
          const fresh = viewFor(action, true);
          if (fresh?.at && lineOfSight(viewEye(fresh), aim.p)) {
            if (!veiled) { await fade(1, 220); veiled = true; }
            try { ctx.player?.teleport?.({ at: fresh.at, heading: fresh.heading }, { fade: false }); } catch { /* */ }
            await frames(2);
            aim = subjectAim(action, new Vector3()) || aim;
          }
        }
        // a stand-in point at the observer's own feet (an event not staged yet, whose place is its stand): the view's
        // own heading, level, rather than a look at the floor
        const e2 = ctx.player?.eye || ctx.camera.position;
        const vh = viewFor(action);
        if (aim.on !== 'subject' && Math.hypot(aim.p.x - e2.x, aim.p.z - e2.z) < 2.5 && Number.isFinite(vh?.heading)) ctx.player?.setLook?.(vh.heading, 0);
        else await frameTo(aim.p, veiled ? 0 : 400);
      }
      h.framedOn = aim?.on || null;
      if (veiled) { await frames(1); await fade(0, 220); }
      if (await abortIfCancelled()) return false;

      // 5. follow; a figure not found yet is looked for a while longer, and framed when it comes
      if (action.subjectKey && aim?.on !== 'subject') seek = { h, action, until: performance.now() + SEEK_MS, at: 0 };
      else if (action.follow && (action.subjectKey || action.focus)) startFollow(action);
      h.phase = 'showing';
      h.progress = 1;
      emit(h);
      return true;
    }
    return h;
  }

  /**
   * The warp: speed v = clamp(gap·60/4, 10, 600), easing to 1× over the last 0.5 sim min; resolves after `gap` sim
   * minutes (across midnight too: the clock plays into the next date) at the landing { date, t }.
   */
  function warp(h, gap, land) {
    const time = ctx.time;
    const tStart = time.t;
    gap = Math.max(0.01, gap);
    const v = clamp(gap * 60 / WARP_SECONDS, 10, 600);
    if (time.paused) time.pause(false);
    time.setSpeed(v);
    let lastEmit = 0;
    return new Promise((resolve) => {
      const off = ctx.engine.onUpdate(() => {
        if (h.cancelled || h.skipped) { off(); resolve(false); return; }
        const done = since(time.t, tStart);
        const left = gap - done;
        if (left <= 0 || done > gap + 5) {
          off();
          // a long frame can carry the clock over midnight past a landing just before it
          if (land.date && time.dateString !== land.date) time.setDate(land.date);
          time.set(land.t);
          time.setSpeed(1);
          h.progress = 1;
          resolve(true);
          return;
        }
        // eased toward 1× over the last 0.5 sim min — down to v/8, the last step to 1× at the end (a linear ease all the
        // way to 1× spends 1–2 s of the 4 at modest speeds)
        const floor = Math.max(1, v / 8), ease = Math.min(EASE_LAST, gap * 0.25);
        time.setSpeed(left < ease ? floor + (v - floor) * (left / ease) : v);
        h.progress = clamp(done / gap, 0, 1);
        h.etaReal = left * 60 / Math.max(1, time.speed);
        const now = performance.now();
        if (now - lastEmit > 250) { lastEmit = now; emit(h); }
      }, PRIORITY.player - 1);
    });
  }

  // ------------------------------------------------------------------------------------- follow
  function startFollow(subject) {
    if (!subject) { follow = null; return; }
    follow = { subject, until: performance.now() + FOLLOW_MAX * 1000, locateAt: 0, pos: null };
  }
  bus.on('player:intent', (e) => { if (e?.kind === 'look' || e?.kind === 'move' || e?.kind === 'fly') { follow = null; seek = null; } });
  /** a follow subject's point now (chest height), or null when it cannot be found */
  function followPoint(s) {
    if (s.kind === 'see-in-action' || s.subjectKey) {
      const a = subjectAim(s, new Vector3());
      return a && (!s.subjectKey || a.on === 'subject') ? a.p : null;
    }
    const p = inspect.anchorOf(s);
    return p ? chest(p) : null;
  }
  ctx.engine.onUpdate((dt) => {
    const now = performance.now();
    // the show's figure came in after the landing: frame it now (and follow it when the show follows)
    const sk = seek;
    if (sk) {
      if (sk.h !== current || sk.h.phase !== 'showing' || now > sk.until) seek = null;
      else if (now >= sk.at) {
        sk.at = now + 250;
        const a = subjectAim(sk.action, new Vector3());
        if (a?.on === 'subject') {
          seek = null;
          sk.h.framedOn = 'subject';
          frameTo(a.p, 400).then(() => { if (sk.action.follow && current === sk.h && sk.h.phase === 'showing') startFollow(sk.action); });
        }
      }
    }
    const f = follow;
    if (!f) return;
    if (now > f.until) { follow = null; return; }
    if (now >= f.locateAt) {
      f.locateAt = now + 500;
      const p = followPoint(f.subject);
      if (!p) { follow = null; return; }
      f.pos = p;
    }
    if (!f.pos || !ctx.player?.setLook) return;
    const target = lookAt(f.pos);
    const h0 = ctx.player.heading ?? 0, p0 = ctx.player.pitch ?? 0;
    const max = FOLLOW_RATE * Math.min(0.1, dt || 0.016);
    const dh = clamp(((target.heading - h0 + 540) % 360) - 180, -max, max);
    const dp = clamp(target.pitch - p0, -max, max);
    if (Math.abs(dh) > 0.05 || Math.abs(dp) > 0.05) ctx.player.setLook((h0 + dh + 360) % 360, p0 + dp);
  }, PRIORITY.player - 1);

  function backLabelOf(s) {
    const zone = s.zone && String(ctx.zones?.info?.(s.zone)?.name?.en || '').split(' — ')[0];
    return { en: `Back to ${hhmm(s.t)}${zone ? ` at ${zone}` : ''}` };
  }

  // ------------------------------------------------------------------------------------- tours / narration steps
  function run(steps, { label } = {}) {
    const snap = snapshot();
    let resolve;
    const h = {
      id: `run-${++seq}`, action: { kind: 'run', steps }, mode: 'run', label: label || { en: 'Guided' }, phase: 'placing',
      from: { date: snap.date, t: snap.t }, target: { date: snap.date, t: snap.t }, progress: 0, etaReal: null,
      done: new Promise((r) => { resolve = r; }), cancelled: false,
      skip() {}, cancel() { h.cancelled = true; },
    };
    current = h;
    last = { snap, at: performance.now(), label: backLabelOf(snap) };
    (async () => {
      for (let i = 0; i < (steps || []).length; i++) {
        if (h.cancelled) break;
        const s = steps[i];
        h.progress = i / steps.length;
        if (s.go) {
          const tgt = s.go.target || (s.go.subject && inspect.anchorOf(s.go.subject));
          if (tgt) await ctx.player?.goTo?.(tgt, s.go.way || 'walk');
        } else if (s.time) {
          const a = { kind: 'see-in-action', mode: s.time.mode || 'jump', t: s.time.t, date: s.time.date };
          await seeInAction(a)?.done;
        } else if (s.frame) {
          const p = inspect.anchorOf(s.frame);
          if (p) await frameTo(chest(p), 400);
        } else if (s.say) {
          bus.emit('caption', { text: s.say.text, duration: (s.say.ms || 4000) / 1000, source: 'narration' });
          await sleep(s.say.ms || 4000);
        } else if (s.wait != null) {
          if (s.wait === 'event-start') { /* the clock reaches its moment by itself */ } else await sleep(+s.wait || 0);
        } else if (s.follow) startFollow(s.follow);
      }
      h.phase = h.cancelled ? 'cancelled' : 'done';
      emit(h);
      resolve(!h.cancelled);
    })();
    return h;
  }

  return {
    seeInAction,
    run,
    frame: (subject, { ms = 400 } = {}) => {
      if (subject?.kind === 'see-in-action') return frameTo(subjectPos(subject, new Vector3()), ms);
      const p = inspect.anchorOf(subject);
      return frameTo(p ? chest(p) : null, ms);
    },
    follow: (subject) => startFollow(subject),
    get following() { return !!follow; },
    get show() { return current; },
    async back() {
      if (!last) return false;
      const s = last.snap;
      last = null;
      seek = null;
      // a show still on its way stops where it is (it does not restore as well), then the Return point is restored
      const c = current;
      current = null;
      if (c && !['done', 'cancelled', 'failed', 'showing'].includes(c.phase)) {
        c.superseded = true; c.cancelled = true;
        await Promise.race([c.done, sleep(3000)]);
      }
      return restore(s);
    },
    get canBack() { return !!last && performance.now() - last.at < BACK_CHIP * 1000; },
    get backLabel() { return last ? last.label : null; },
  };
}
