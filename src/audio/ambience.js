// Ambience director — the base loop stack of report §36.3: the pyre's crackle, the amah's water, doves,
// sheep from the Moked corner, crowd murmur that dies at the magrefah (Tamid 5:6), gentle wind, night
// insects, torches near the observer. Gains follow the sun and the date (ctx.time), the fires' live intensity
// and position (ctx.fx), and a population estimate (overridable). Positions come from the site model; where it
// does not fix a source (the doves) the placement is a labelled reconstruction (docs/decisions/audio.md).
import { Vector3 } from 'three';
import { m2w } from '../core/units.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MAX_DIST = { torch: 16, 'water-channel': 28, sheep: 70, fire: 220 };
// Jerusalem: mean daily minimum temperature by month (°C, modern climate normals) — reconstruction of the
// night's warmth; crickets call fully April–October, sparsely in March and November, not December–February
const TMIN = [6.4, 6.4, 8.4, 11.9, 15.1, 17.3, 18.9, 18.9, 17.6, 15.6, 11.8, 8.0];
const CRICKETS = [0, 0, 0.3, 1, 1, 1, 1, 1, 1, 1, 0.35, 0];

export class Ambience {
  constructor(ctx, engine) {
    this.ctx = ctx;
    this.engine = engine;
    this.enabled = true;
    this.population = null;   // null = automatic estimate
    this.layers = { wind: 1, insects: 1, doves: 1, sheep: 1, crowd: 1, water: 1, fire: 1, torch: 1 };
    this.hushUntil = 0;
    this.hushStart = 0;
    this.prostrateAt = 0;
    this.fireLoops = new Map();
    this.timer = 0;
    this.started = false;
    this.insectTemp = null;
  }

  el(id) { return this.ctx.elOpt?.(id) || this.ctx.site?.elements?.[id] || null; }

  /** a box standing on an element's floor (its top for a floor slab, its bottom for a room), dz amot high */
  slab(id, dz = 3) {
    const e = this.el(id);
    if (!e?.box) return null;
    const z = e.kind === 'floor' ? e.box.max[2] : e.box.min[2];
    return { min: [e.box.min[0], e.box.min[1], z], max: [e.box.max[0], e.box.max[1], z + dz] };
  }

  /** the loops this director plays, with their synthesis options (also used to pre-render them) */
  bedSpecs() {
    const night = (this.ctx.time?.sun?.altitude ?? 10) < -2;
    const { temp, activity } = this.nightClimate();
    return [['wind', {}], ['fire', { size: 1 }], night ? ['night-insects', { temp }] : ['doves', {}], ['crowd-murmur', {}], ['crowd-murmur', { women: 0, sparse: true }], ['torch', {}]]
      .filter(([id]) => id !== 'night-insects' || activity > 0);
  }

  start() {
    if (this.started) return;
    this.started = true;
    const a = this.engine;
    this.wind = a.loop('wind', null, { gain: 0 });
    this.doves = a.loop('doves', null, { gain: 0 });
    // crowd: the kohanim and Levites on duty (men only, sparse) in the Azarah and the Beit HaMoked; the public
    // in Ezrat Nashim and Ezrat Yisrael, each at its own floor, once the gates open; the Mount's plaza
    const staff = [this.slab('azarah.floor'), this.slab('azarah.moked.hall')].filter(Boolean);
    if (staff.length) this.crowdStaff = a.loop('crowd-murmur', null, { gain: 0, people: 1, women: 0, sparse: true, area: staff });
    const courts = [this.slab('en.floor'), this.slab('azarah.ezrat-yisrael')].filter(Boolean);
    if (courts.length) this.crowdCourts = a.loop('crowd-murmur', null, { gain: 0, people: 1, area: courts });
    const plaza = this.slab('mount.floor', 4);
    if (plaza) this.crowdMount = a.loop('crowd-murmur', null, { gain: 0, people: 1, area: plaza });
    // the amah: its open stretches in the Azarah pavement, from the site model (Middot 3:2; Tamid 5:5)
    const segs = this.el('azarah.amah-channel')?.params?.openSegments;
    if (segs?.length) this.water = a.loop('water-channel', null, { gain: 0, area: segs.map((s) => ({ min: s.min, max: [s.max[0], s.max[1], s.max[2] + 0.3] })) });
    // sheep: the chamber of the tamid lambs in the Beit HaMoked (Middot 1:6; Arachin 2:5 — at least six)
    const lambs = this.el('azarah.moked.chamber.lambs');
    if (lambs?.box) this.sheep = a.loop('sheep', [(lambs.box.min[0] + lambs.box.max[0]) / 2, (lambs.box.min[1] + lambs.box.max[1]) / 2, lambs.box.min[2] + 1], { gain: 0 });
    // magrefah → silence (the ketoret); the prostration that follows releases it
    a.onMagrefah = () => this.hush(150);
    a.onProstrate = () => { this.prostrateAt = performance.now(); };
    // a time jump re-poses the day: the clock and population recompute everything, nothing stays hushed
    this.ctx.bus?.on?.('time:jump', () => this.release());
  }

  hush(seconds = 120) { const now = performance.now(); this.hushStart = now; this.hushUntil = now + seconds * 1000; this.prostrateAt = 0; }
  release() { this.hushUntil = 0; this.prostrateAt = 0; }
  setPopulation(n) { this.population = Number.isFinite(n) ? Math.max(0, n) : null; }
  setLayer(name, g) { if (name in this.layers) this.layers[name] = Math.max(0, g); }

  /**
   * Automatic population estimate { staff, courts, plaza }. The kohanim and Levites on duty (~60) are inside
   * from before alot until after sunset; the public (weekday baseline: the ma'amad and visitors, "low hundreds",
   * §36.5) fills the courts and the plaza only after the gates open at sunrise with three blasts (Sukkah 5:5;
   * Tamid 3:7). Festivals: setPopulation().
   */
  autoPopulation(alt, zm, t) {
    if (zm && Number.isFinite(t) && Number.isFinite(zm.sunrise) && Number.isFinite(zm.sunset)) {
      const staff = ss(zm.alot - 80, zm.alot, t) * 60 * (1 - ss(zm.sunset + 30, zm.sunset + 90, t));
      const open = ss(zm.sunrise - 5, zm.sunrise + 45, t) * (1 - ss(zm.sunset - 60, zm.sunset + 40, t));
      return { staff, courts: open * 320, plaza: open * 110 };
    }
    const open = ss(-4, 8, alt);
    return { staff: 60 * ss(-18, -10, alt), courts: 320 * open, plaza: 110 * open };
  }

  /**
   * Night climate for the insects: { temp (°C, whole degrees), activity 0..1 } from the date and the hour —
   * the month's mean minimum, interpolated by day, plus ~4 °C early in the night falling to the minimum by dawn.
   */
  nightClimate() {
    const time = this.ctx.time, d = time?.date;
    if (!d?.m) return { temp: 20, activity: 1 };
    const m = d.m - 1, f = ((d.d ?? 15) - 15) / 30.5;
    const j = f >= 0 ? (m + 1) % 12 : (m + 11) % 12, w = Math.abs(f);
    const tmin = TMIN[m] * (1 - w) + TMIN[j] * w;
    const zm = time.zmanim, t = time.t;
    let warm = 0.5;
    if (zm && Number.isFinite(zm.sunset) && Number.isFinite(zm.sunrise) && Number.isFinite(t)) {
      const len = (zm.sunrise - zm.sunset + 1440) % 1440 || 1, into = (t - zm.sunset + 1440) % 1440;
      warm = into <= len ? 1 - into / len : 1;
    }
    const temp = Math.round(tmin + 4 * warm);
    return { temp, activity: CRICKETS[m] * ss(10, 13, temp) };
  }

  update(dt) {
    if (!this.started || !this.enabled) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    const ctx = this.ctx, time = ctx.time, now = performance.now();
    const alt = time?.sun?.altitude ?? 20;
    const night = ss(-2, -10, alt), day = ss(-8, 3, alt), dawn = ss(-10, -3, alt) * (1 - ss(6, 14, alt));
    const zone = this.engine.zoneId || '';
    const high = zone === 'roof' || zone === 'har-hamishchah' ? 1.8 : 1;
    const L = this.layers;
    this.wind?.setGain((0.65 + 0.35 * day) * high * L.wind, 2);
    this.updateInsects(night * L.insects);
    this.doves?.setGain((day * 0.8 + dawn * 0.5) * L.doves, 3);
    this.sheep?.setGain((0.35 + 0.65 * day + 0.4 * dawn) * L.sheep * this.near(this.sheep, 'sheep'), 2);
    this.water?.setGain(L.water * this.near(this.water, 'water-channel'), 1);

    // crowd: population, hush during the ketoret, quieter while the Levites sing
    const auto = this.autoPopulation(alt, time?.zmanim, time?.t);
    const pop = this.population !== null ? { staff: auto.staff, courts: this.population * 0.75, plaza: this.population * 0.25 } : auto;
    // the prostration after the ketoret releases the hush (only one that came after this hush began)
    if (this.prostrateAt > this.hushStart + 1000 && now - this.prostrateAt > 4000) this.release();
    let hush = now < this.hushUntil ? 0.06 : 1;
    for (const v of this.engine.voices) if (v.def.cat === 'music' && v.nodes) { hush = Math.min(hush, 0.45); break; }
    const { staff, courts, plaza } = pop;
    const fall = hush < 1 ? 1.5 : 3;
    if (this.crowdStaff) { this.crowdStaff.setPeople(Math.max(1, staff)); this.crowdStaff.setGain(staff > 4 ? hush * L.crowd : 0, fall); }
    if (this.crowdCourts) { this.crowdCourts.setPeople(Math.max(1, courts)); this.crowdCourts.setGain(courts > 8 ? hush * L.crowd : 0, fall); }
    if (this.crowdMount) { this.crowdMount.setPeople(Math.max(1, plaza)); this.crowdMount.setGain(plaza > 8 ? Math.max(hush, 0.5) * L.crowd : 0, 3); }

    this.updateFires();
  }

  /** the insects bed at tonight's temperature: re-rendered (cross-faded) when it moves by 2 °C */
  updateInsects(g) {
    const { temp, activity } = this.nightClimate();
    const gain = g * activity;
    if (gain > 0.01 && (this.insectTemp === null || Math.abs(temp - this.insectTemp) >= 2)) {
      this.insects?.stop(3);
      this.insectTemp = temp;
      this.insects = this.engine.loop('night-insects', null, { gain: 0, temp });
    }
    this.insects?.setGain(gain, 3);
  }

  /** 0..1 distance gate for small sources (keeps them virtual beyond where they could be heard) */
  near(handle, id) {
    const v = [...this.engine.loops].find((l) => l.handle === handle);
    if (!v) return 0;
    const d = this.engine.sourcePos(v).distanceTo(this.engine.listener);
    return 1 - ss(MAX_DIST[id] * 0.7, MAX_DIST[id], d);
  }

  /** one loop per fire, following it (carried torches) and ending with it (fx.remove) */
  updateFires() {
    const ctx = this.ctx;
    const list = ctx.fx?.list?.() || (ctx.fires || []).map((f) => ({ id: f.id, kind: f.kind, intensity: f.intensity ?? 1, pos: f.pos }));
    const listener = this.engine.listener, seen = new Set(), torches = [];
    for (const f of list) {
      if (!f?.pos || f.id == null) continue;
      const kind = f.kind;
      if (kind === 'lamp' || kind === 'menorah') continue; // oil lamps are silent
      seen.add(f.id);
      const pos = f.pos.isVector3 ? f.pos : Array.isArray(f.pos) ? m2w(f.pos[0], f.pos[1], f.pos[2] ?? 0) : new Vector3(f.pos.x, f.pos.y, f.pos.z);
      let h = this.fireLoops.get(f.id);
      if (!h) {
        if (kind === 'torch') h = this.engine.loop('torch', pos, { gain: 0 });
        else if (kind === 'pyre') h = this.engine.loop('fire', pos, { gain: 0, size: 1 });
        else h = this.engine.loop('fire', pos, { gain: 0, size: 0.35, levelDb: -9 }); // hearth (the Moked's medurah), brazier
        this.fireLoops.set(f.id, h);
      } else h.setPosition(pos);
      const inten = Math.max(0, Math.min(1.5, f.intensity ?? 1)), d = pos.distanceTo(listener);
      if (kind === 'torch') { torches.push({ h, d, inten }); continue; }
      h.setGain(inten > 0.02 ? (0.35 + 0.65 * Math.min(1, inten)) * this.layers.fire * (1 - ss(MAX_DIST.fire * 0.7, MAX_DIST.fire, d)) : 0, 1.5);
    }
    for (const [id, h] of this.fireLoops) if (!seen.has(id)) { h.stop(0.5); this.fireLoops.delete(id); }
    // only the nearest few torches are voiced (dozens burn on the walls at night)
    const k = this.engine.tier === 'low' ? 1 : this.engine.tier === 'medium' ? 2 : 3;
    torches.sort((a, b) => a.d - b.d);
    torches.forEach((t, i) => t.h.setGain(i < k && t.inten > 0.05 && t.d < MAX_DIST.torch ? Math.min(1, t.inten) * this.layers.torch * (1 - ss(MAX_DIST.torch * 0.6, MAX_DIST.torch, t.d)) : 0, 1));
  }
}
