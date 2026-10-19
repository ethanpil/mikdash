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
const _pos = new Vector3();
const _col = new Color();

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
    this.setMax(max, shadowCfg);
  }

  setMax(max, shadowCfg = this.shadowCfg || FIRE_SHADOWS.low) {
    for (const l of this.lights) { this.scene.remove(l); l.dispose(); }
    this.lights = [];
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
      if (!f.preset.light) continue;
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
    for (const c of out) c.shadowable = !c.mobile && SHADOW_KINDS.has(c.kind);
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

  /** gain = scene units per candela (env.preExposure × fireScale) */
  update(dt, camPos, time, gain) {
    const cs = this.clusters;
    const pos = _pos;
    const col = _col;
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
      c.score = (I / d2) * (lit ? KEEP_BONUS : 1);
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
      l.intensity = c.I * sw * flick * gain;
      l.color.copy(c.color);
      if (p.shadow) {
        // shadow slots stay put (no positional jitter): the cube map is rendered only now and then
        if (l.userData.shadowOwner !== c.key || l.position.distanceToSquared(c.pos) > 1e-4 || l.distance !== c.distance) {
          l.userData.shadowOwner = c.key;
          l.shadow.needsUpdate = true;
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
