// Budgeted real lights for fires. A constant pool of `max` PointLights stays in the scene (unused ones at
// intensity 0) so the number of lights — and therefore every material's shader — never changes.
// Fires closer than MERGE metres are clustered into one light (e.g. the menorah's seven lamps = one light).
//
// Two fixed sub-pools:
//   shadow slots (high 1, ultra 2): castShadow from boot; only STATIC big fires (pyre / hearth / brazier) use
//     them — the altar fire on its 10-amot altar must shadow the Azarah floor, columns and steps must cast.
//     Cube shadow maps are rendered on assignment and refreshed slowly (moving actors), never every frame.
//   plain slots: everything else (torches, lamps, carried torches, further big fires).
// Each cluster has a weight per pool that eases toward 1 when it is among that pool's top-N by score
// (intensity / distance²) and toward 0 otherwise; a slot is only handed over once its previous owner has
// faded out => no popping. A cluster moving between pools cross-fades (both weights ease at the same rate).
import { PointLight, Vector3, Color } from 'three';

const MERGE = 1.6;
const FADE_RATE = 2.5;   // weight units per second
const KEEP_BONUS = 1.35; // hysteresis for the currently-lit clusters
const SHADOW_KINDS = new Set(['pyre', 'hearth', 'brazier']);
/**
 * per tier: shadow-casting slots, cube face size, refresh period (s) for moving casters, PCF radius.
 * A 2 m fire casts SOFT shadows (penumbra ≈ fire size × (receiver − blocker) / blocker distance: metres at
 * the altar's own edge, ~0.5 m for a column 30 m away). r186's point PCF takes 5 Vogel taps at up to
 * radius / 2 texels: small faces (bilinear softness) with taps ≤ 2 texels apart give ≈ 0.025 rad of blur
 * without the halftone grain a wide kernel on a large face shows. Bias is mostly a world-space normal
 * offset: a depth bias grows with distance² on a cube map and would detach distant shadows.
 */
export const FIRE_SHADOWS = {
  low: { slots: 0 },
  medium: { slots: 0 },
  high: { slots: 1, mapSize: 128, refresh: 0.25, radius: 3, normalBias: 0.12, bias: -1.5e-4 },
  ultra: { slots: 2, mapSize: 160, refresh: 0.125, radius: 4, normalBias: 0.1, bias: -1.5e-4 },
};
// fire-shadow cameras (render-env-2-fix): near plane = this × the fire's size, within [min, max] m (also the cap of the
// normal offset)
const NEAR_PER_SIZE = 0.25, NEAR_MIN = 0.05, NEAR_MAX = 0.3;
const _pos = new Vector3();
const _col = new Color();
// occlusion-aware ranking (lighting-polish): a fire in another room than the viewer counts with the light that
// can pass both rooms' openings, but never below this share × how open both rooms are (a great fire still lights
// what is seen through an open door; a closed room neither lets its lamps out nor the court's fires in — render-env-2)
const OCC_FLOOR = 0.05;
// render-env-2: a fire in the viewer's own room is what the viewer sees lit (the Menorah from inside the Kodesh)
const SAME_ROOM = 3;
// …and an open-air fire behind a court's walls (fire occluder records, env/interiors.js) counts at most this share:
// what it lights over the walls (the tops of the walls, the Heichal) is still in view
const WALL_FLOOR = 0.03;

class Pool {
  constructor(lights, shadow) {
    this.lights = lights;
    this.shadow = shadow;
    this.weights = new Map(); // clusterKey -> { w, slot }
    this.want = new Set();
  }
}

export class FireLights {
  constructor(scene, max, shadowCfg = FIRE_SHADOWS.low) {
    this.scene = scene;
    this.lights = [];
    this.clusters = [];
    this.pools = [];
    this.structureDirty = true;
    this.refreshClock = 0;
    this.gain = 0;
    /** optional (worldPos, out) -> { V, vol }: sky visibility / room at a point (env.interiors.at) */
    this.visibility = null;
    /** optional env.interiors: room openness, fire occluder records (render-env-2) */
    this.interiors = null;
    this.camIns = { V: 1, vol: null, s: 0 };
    this.setMax(max, shadowCfg);
  }

  setMax(max, shadowCfg = this.shadowCfg || FIRE_SHADOWS.low) {
    for (const l of this.lights) { this.scene.remove(l); l.dispose(); }
    this.lights = [];
    this.order = null;
    this.max = Math.max(0, max | 0);
    this.shadowCfg = shadowCfg;
    const nShadow = Math.min(this.max, shadowCfg.slots || 0);
    const shadowLights = [];
    const plainLights = [];
    for (let i = 0; i < this.max; i++) {
      const l = new PointLight(0xff9040, 0, 10, 2);
      const sh = i < nShadow;
      l.name = sh ? `fx:firelight-shadow${i}` : `fx:firelight${i}`;
      l.castShadow = sh;
      if (sh) {
        const s = l.shadow;
        s.mapSize.set(shadowCfg.mapSize, shadowCfg.mapSize);
        s.camera.near = 0.3;
        s.bias = shadowCfg.bias ?? -1.5e-4;
        s.normalBias = shadowCfg.normalBias ?? 0.1;
        s.radius = shadowCfg.radius ?? 3;
        s.autoUpdate = false;  // rendered on assignment / slow refresh only
        s.needsUpdate = true;  // a never-rendered map would leave its sampler bound to a non-depth texture
        l.userData.shadowOwner = null;
        l.userData.shadowPhase = (i / Math.max(1, nShadow)) * (shadowCfg.refresh || 1);
        shadowLights.push(l);
      } else {
        plainLights.push(l);
      }
      this.scene.add(l);
      this.lights.push(l);
    }
    this.pools = [new Pool(shadowLights, true), new Pool(plainLights, false)];
  }

  /** Rebuild clusters (call when fires are added/removed; carried torches are never merged). */
  cluster(fires) {
    const out = [];
    for (const f of fires) {
      if (!f.preset.light || f.spec?.light === false) continue; // light:false — flames and glow only
      let c = null;
      if (!f.follow) {
        for (const k of out) {
          if (!k.mobile && k.anchor.distanceTo(f.pos) < MERGE && k.kind === f.kind) { c = k; break; }
        }
      }
      if (!c) {
        c = { key: f.id, kind: f.kind, anchor: f.pos.clone(), mobile: !!f.follow, fires: [] };
        out.push(c);
      }
      c.fires.push(f);
    }
    for (const c of out) {
      c.shadowable = !c.mobile && SHADOW_KINDS.has(c.kind);
      c.size = Math.max(...c.fires.map((f) => f.size || 0));
      c.rec = undefined; // fire occluder record: resolved once the cluster's light position is known
    }
    this.clusters = out;
    const live = new Set(out.map((c) => c.key));
    for (const p of this.pools) {
      for (const k of [...p.weights.keys()]) {
        const w = p.weights.get(k);
        if (!live.has(k)) { if (w.slot >= 0) p.lights[w.slot].intensity = 0; p.weights.delete(k); }
      }
    }
    // static fires may have moved (setPosition): re-render the shadow maps
    for (const l of this.pools[0]?.lights || []) l.shadow.needsUpdate = true;
  }

  /** the fire occluder record of a static cluster (env/interiors.js fireRecord), -1 none */
  record(c) {
    if (c.mobile || !c.pos || !this.interiors?.fireRecord) return -1;
    if (c.rec === undefined) { c.rec = this.interiors.fireRecord(c.pos); c.recR = this.interiors.fireRadius?.(c.size) ?? 0.3; }
    return c.rec;
  }

  /** light transport factor from cluster c to a viewer at `at` whose room is `ins` */
  occ(c, ins, at = null) {
    if (!this.visibility || !ins) return 1;
    if (!c.ins || c.mobile) c.ins = this.visibility(c.pos, c.ins || { V: 1, vol: null, s: 0 });
    const I = this.interiors;
    if (c.ins.vol === ins.vol) {
      if (ins.vol) return SAME_ROOM;
      // both in the open: the court's walls and the altar's top (no shadow map on most tiers and slots)
      const r = this.record(c);
      return r >= 0 && at && I?.fireVisibility ? Math.max(I.fireVisibility(r, c.pos, at, c.recR, false), WALL_FLOOR) : 1;
    }
    const open = I?.openness ? I.openness(c.ins.vol) * I.openness(ins.vol) : 1;
    return Math.max(c.ins.V * (ins.Vap ?? ins.V), OCC_FLOOR * open); // into the viewer's room through its apertures only
  }

  /** gain = scene units per candela (env.preExposure × fireScale) */
  update(dt, camPos, time, gain) {
    const cs = this.clusters;
    const pos = _pos;
    const col = _col;
    this.gain = gain;
    const ins = this.visibility ? this.visibility(camPos, this.camIns) : null;
    // aggregate each cluster
    for (const c of cs) {
      let I = 0;
      pos.set(0, 0, 0);
      col.setRGB(0, 0, 0);
      let wsum = 0;
      for (const f of c.fires) {
        const i = f.lightCandela * f.cur;
        I += i;
        const w = Math.max(i, 1e-6);
        pos.addScaledVector(f.lightPos, w);
        col.r += f.lightColor.r * w; col.g += f.lightColor.g * w; col.b += f.lightColor.b * w;
        wsum += w;
      }
      c.I = I;
      c.pos = (c.pos || new Vector3()).copy(pos).multiplyScalar(1 / wsum);
      c.color = (c.color || new Color()).setRGB(col.r / wsum, col.g / wsum, col.b / wsum);
      c.distance = c.fires[0].lightDistance * Math.sqrt(Math.max(1, c.fires.length) / 1);
      const d2 = Math.max(c.pos.distanceToSquared(camPos), 4);
      let lit = false;
      for (const p of this.pools) { const st = p.weights.get(c.key); if (st && st.w > 0) lit = true; }
      c.score = (I / d2) * (lit ? KEEP_BONUS : 1) * this.occ(c, ins, camPos);
      // a light far beyond its reach cannot matter
      if (d2 > (c.distance * 1.4) ** 2 || I <= 1e-4) c.score = 0;
    }
    const ranked = cs.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
    const [shadowPool, plainPool] = this.pools;
    shadowPool.want = new Set(ranked.filter((c) => c.shadowable).slice(0, shadowPool.lights.length).map((c) => c.key));
    plainPool.want = new Set(ranked.filter((c) => !shadowPool.want.has(c.key)).slice(0, plainPool.lights.length).map((c) => c.key));
    for (const p of this.pools) this.updatePool(p, dt, time, gain);
    this.refreshShadows(dt);
    let active = 0;
    for (const l of this.lights) if (l.intensity > 0) active++;
    this.active = active;
  }

  updatePool(p, dt, time, gain) {
    const used = new Set();
    for (const v of p.weights.values()) if (v.slot >= 0) used.add(v.slot);
    for (const c of this.clusters) {
      let st = p.weights.get(c.key);
      const target = p.want.has(c.key) ? 1 : 0;
      if (!st) {
        if (!target) continue;
        st = { w: 0, slot: -1 };
        p.weights.set(c.key, st);
      }
      if (target > 0 && st.slot < 0) {
        // claim a free slot; otherwise wait until a fading cluster releases one
        for (let s = 0; s < p.lights.length; s++) if (!used.has(s)) { st.slot = s; used.add(s); break; }
      }
      if (st.slot < 0) { st.w = 0; continue; }
      st.w += Math.sign(target - st.w) * Math.min(Math.abs(target - st.w), FADE_RATE * dt);
      const l = p.lights[st.slot];
      if (st.w <= 0 && target === 0) {
        l.intensity = 0;
        l.userData.mkRec = -1;
        if (p.shadow) l.userData.shadowOwner = null;
        used.delete(st.slot);
        st.slot = -1;
        continue;
      }
      const f0 = c.fires[0];
      const flick = 1 + f0.preset.light.flicker * (
        0.5 * Math.sin(time * 7.3 + f0.seed * 13.0) + 0.3 * Math.sin(time * 12.9 + f0.seed * 7.0)
        + 0.2 * Math.sin(time * 21.7 + f0.seed * 3.0));
      const sw = st.w * st.w * (3 - 2 * st.w); // smoothstep easing
      // × the sky visibility at the fire (env interiors): a fragment outside every room takes the light as it comes
      // — through the openings of the fire's room — without reading the light's room from the uniform block (a
      // memory load per light per fragment on Intel iGPUs); fragments in rooms undo it (interiors-glsl.js mkPtOcc)
      if (this.visibility) c.ins = this.visibility(c.pos, c.ins || { V: 1, vol: null, s: 0 }); // doors move
      const V = c.ins && this.visibility ? c.ins.V : 1;
      l.intensity = c.I * sw * flick * gain * V;
      l.userData.mkV = V;
      // the court walls / altar top occluding a plain slot's fire (a shadow slot's cube map does it there)
      l.userData.mkRec = p.shadow ? -1 : this.record(c);
      l.userData.mkRecPos = c.pos; // unjittered (the occluder test needs no flicker)
      l.userData.mkRecR = c.recR;
      l.color.copy(c.color);
      if (p.shadow) {
        // shadow slots stay put (no positional jitter): the cube map is rendered only now and then
        if (l.userData.shadowOwner !== c.key || l.position.distanceToSquared(c.pos) > 1e-4 || l.distance !== c.distance) {
          l.userData.shadowOwner = c.key;
          l.shadow.needsUpdate = true;
          // render-env-2-fix: near plane and normal offset scale with the fire (builders-2-inner-fix): at 0.3 m the
          // kitchen hearth's stones and pot, a hand's breadth from its flames, cast nothing and its light reached the
          // pavement behind them; a 12 cm normal offset lifted the lookup over stones that size
          const near = Math.min(NEAR_MAX, Math.max(NEAR_MIN, NEAR_PER_SIZE * c.size));
          if (l.shadow.camera.near !== near) { l.shadow.camera.near = near; l.shadow.camera.updateProjectionMatrix(); }
          l.shadow.normalBias = Math.min(this.shadowCfg.normalBias ?? 0.1, Math.max(NEAR_MIN, NEAR_PER_SIZE * c.size));
        }
        l.distance = c.distance; // = the shadow camera's far plane
        l.position.copy(c.pos);
      } else {
        l.distance = c.distance;
        const j = 0.035 * f0.size;
        l.position.set(
          c.pos.x + j * Math.sin(time * 9.1 + f0.seed),
          c.pos.y + j * 0.5 * Math.sin(time * 6.7 + f0.seed * 2),
          c.pos.z + j * Math.cos(time * 8.3 + f0.seed),
        );
      }
    }
  }

  /** the point lights in the order three's shaders see them (shadow casters first, then the rest; stable) */
  shaderOrder() {
    if (!this.order || this.order.length !== this.lights.length) {
      this.order = [...this.lights].sort((a, b) => (b.castShadow ? 1 : 0) - (a.castShadow ? 1 : 0));
    }
    return this.order;
  }

  /**
   * Temporarily light the scene as a viewer at `pos` would see it (probe captures): the plain slots go to the
   * clusters ranking highest from there (no fading); shadow slots keep their fires (their cube maps stay valid).
   * Returns a function that restores the frame's assignment.
   */
  assignFor(pos, gain = this.gain) {
    const saved = this.lights.map((l) => ({ l, i: l.intensity, p: l.position.clone(), c: l.color.clone(), d: l.distance }));
    const ins = this.visibility ? this.visibility(pos, { V: 1, vol: null, s: 0 }) : null;
    const owners = new Set();
    // `gain` without the viewer's local adaptation to firelight (fx/index.js lightsFor): the capture is normalised
    // by env's exposure alone — beside the altar the viewer's factor is ≈ 1e-4 and the Kodesh was captured black
    // (lighting-polish-fix). The shadow slots keep their fires; rescale them the same way.
    const k = this.gain > 0 ? gain / this.gain : 1;
    for (const l of this.pools[0]?.lights || []) if (l.intensity > 0) { owners.add(l.userData.shadowOwner); l.intensity *= k; }
    const ranked = this.clusters
      .filter((c) => c.pos && c.I > 1e-4 && !owners.has(c.key))
      .map((c) => ({ c, s: (c.I / Math.max(c.pos.distanceToSquared(pos), 4)) * this.occ(c, ins, pos) }))
      .filter((e) => e.c.pos.distanceToSquared(pos) < (e.c.distance * 1.4) ** 2)
      .sort((a, b) => b.s - a.s);
    const plain = this.pools[1]?.lights || [];
    const saved2 = this.lights.map((l) => [l.userData.mkV, l.userData.mkRec, l.userData.mkRecPos, l.userData.mkRecR]);
    plain.forEach((l, k) => {
      const e = ranked[k];
      if (!e) { l.intensity = 0; l.userData.mkRec = -1; return; }
      if (this.visibility && !e.c.ins) e.c.ins = this.visibility(e.c.pos, { V: 1, vol: null, s: 0 });
      const V = e.c.ins && this.visibility ? e.c.ins.V : 1; // as updatePool
      l.intensity = e.c.I * gain * V;
      l.userData.mkV = V;
      l.userData.mkRec = this.record(e.c);
      l.userData.mkRecPos = e.c.pos;
      l.userData.mkRecR = e.c.recR;
      l.color.copy(e.c.color);
      l.position.copy(e.c.pos);
      l.distance = e.c.distance;
    });
    return () => { saved.forEach((s, k) => { s.l.intensity = s.i; s.l.position.copy(s.p); s.l.color.copy(s.c); s.l.distance = s.d; [s.l.userData.mkV, s.l.userData.mkRec, s.l.userData.mkRecPos, s.l.userData.mkRecR] = saved2[k]; }); };
  }

  /** slow, staggered refresh of the shadow cube maps (people and other moving casters) */
  refreshShadows(dt) {
    const period = this.shadowCfg.refresh;
    const lights = this.pools[0]?.lights || [];
    if (!period || !lights.length) return;
    const prev = this.refreshClock;
    this.refreshClock += dt;
    for (const l of lights) {
      if (l.intensity <= 0) continue;
      const ph = l.userData.shadowPhase;
      if (Math.floor((this.refreshClock + ph) / period) !== Math.floor((prev + ph) / period)) l.shadow.needsUpdate = true;
    }
  }

  dispose() {
    for (const l of this.lights) { this.scene.remove(l); l.dispose(); }
    this.lights = [];
    this.pools = [];
  }
}
