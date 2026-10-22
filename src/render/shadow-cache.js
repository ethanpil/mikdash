// Static / dynamic split of env's key-light shadow map (perf-fix-1; medium: one orthographic sun / moon map, ±80–220 m).
//
// three re-renders a shadow map whole every frame its light is on: on the HD 4600 the key light's pass was 25–35 ms of a
// 70 ms medium frame in the Azarah by day (every world caster over the map's ±80–220 m, front and back faces). Here the
// casters that are not people (the world: walls, terrain proxy, movables …) are drawn into a cached depth target only
// when anything about them or the light's framing changed; each frame three's own pass clears the map, the cached depth
// is copied in (one depth blit) and only the people (people.root: figures, animals, props, shadow proxies) are drawn on
// top with the usual depth test — the same min-depth result as drawing everything together.
//
// The cache is re-drawn when its signature changes: the light's framing (position, target, the shadow camera's extent
// and range, map size) or any static caster's world matrix, draw range, instance count, instance / position buffer
// version or visibility (doors and curtains swinging, the stoas' and trees' instance LODs, the altar's wood, vessels
// shown or hidden), or any material texture set baked in place (ctx.mats.stats.bakes: alpha-tested leaves). env holds
// the framing while the viewer moves within a few metres (env setShadowHold): its
// texel-snapped centre otherwise moved with every step and every turn of the head. `?shadowcache=0` turns it off.
// A caster that keeps changing (the courts' golah wheel turns all day; a door while it swings) would rebuild the cache
// every frame: one that changes twice within 4 frames is drawn every frame with the people instead, outside the
// signature, until it has been still for MOVING_HOLD frames. The two passes select their casters by castShadow
// (toggled on the collected lists for the pass, restored after).
import { WebGLRenderTarget, DepthTexture, UnsignedIntType, DepthFormat, NearestFilter } from 'three';

// frames a moving caster must stay still before it returns to the cached set (one cache re-render then)
const MOVING_HOLD = 300;

export class KeyShadowCache {
  constructor(ctx) {
    this.ctx = ctx;
    this.enabled = ctx.params?.raw?.get?.('shadowcache') !== '0';
    this.rt = null;
    this.sig = NaN;
    this.stats = { statics: 0, frames: 0, moving: 0 };
    this._frame = 0;
    this._blit = false;
    const sm = ctx.renderer.shadowMap;
    const orig = (this._orig = sm.render);
    const self = this;
    sm.render = function (lights, scene, camera) {
      const key = self._key(lights);
      if (!key) return orig.call(this, lights, scene, camera);
      self._render(orig, this, lights, key, scene, camera);
    };
    this._sm = sm;
    ctx.env?.setShadowHold?.(this.enabled);
  }

  /** env's key light when the cache applies to this shadow render, else null */
  _key(lights) {
    if (!this.enabled) return null;
    const env = this.ctx.env;
    const key = env?.keyLight;
    if (!key?.castShadow || !key.shadow?.camera?.isOrthographicCamera || !env.shadowsManaged) return null;
    const sm = this._sm;
    if (sm.autoUpdate === false && sm.needsUpdate === false) return null;
    if (key.shadow.autoUpdate === false && key.shadow.needsUpdate === false) return null;
    if (!lights.includes(key)) return null;
    if (!this.ctx.people?.root) return null;
    return key;
  }

  _render(orig, sm, lights, key, scene, camera) {
    const needs = sm.needsUpdate;
    const others = lights.length > 1 ? lights.filter((l) => l !== key) : null;
    if (others?.length) { orig.call(sm, others, scene, camera); sm.needsUpdate = needs; }
    const shadow = key.shadow;
    const people = this.ctx.people.root;
    const sig = this._scan(key, scene, people);
    const statics = this._statics, dyn = this._dynList;
    const w = shadow.mapSize.x, h = shadow.mapSize.y;
    if (this.rt && (this.rt.width !== w || this.rt.height !== h)) { this.rt.dispose(); this.rt = null; }
    if (!this.rt || sig !== this.sig) {
      // the static casters, into the cache (three's own pass, people and the moving casters left out, the map swapped
      // for the cache)
      if (!this.rt) this.rt = makeTarget(w, h);
      const map = shadow.map, pv = people.visible, kn = shadow.needsUpdate;
      shadow.map = this.rt;
      people.visible = false;
      for (const o of dyn) o.castShadow = false;
      try { orig.call(sm, [key], scene, camera); } finally {
        shadow.map = map; people.visible = pv; shadow.needsUpdate = kn; sm.needsUpdate = needs;
        for (const o of dyn) o.castShadow = true;
      }
      this.sig = sig;
      this.stats.statics++;
    }
    // the frame's map: three clears it, the cache is copied in (getFrustum is three's next call after the clear and the
    // viewport), then only the people and the moving casters are drawn
    for (const o of statics) o.castShadow = false;
    const gf = shadow.getFrustum;
    const self = this;
    shadow.getFrustum = function (i) { self._copy(shadow); return gf.call(this, i); };
    try { orig.call(sm, [key], scene, camera); } finally {
      delete shadow.getFrustum;
      if (shadow.getFrustum !== gf) shadow.getFrustum = gf;
      for (const o of statics) o.castShadow = true;
    }
    this.stats.frames++;
    this.stats.moving = dyn.length;
  }

  /** depth blit cache → the shadow map (bound by three for this pass) */
  _copy(shadow) {
    const r = this.ctx.renderer, gl = r.getContext();
    const src = r.properties.get(this.rt).__webglFramebuffer;
    const dst = r.properties.get(shadow.map).__webglFramebuffer;
    if (!src || !dst) return;
    const w = this.rt.width, h = this.rt.height;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst); // three's state cache holds dst for both targets
  }

  /**
   * Collect this frame's casters outside people.root: the static ones (this._statics) and the moving ones
   * (this._dynList: changed twice within a few frames — the golah wheel turning, a door swinging — drawn every frame
   * with the people until they have been still for MOVING_HOLD frames). Returns a number that changes whenever the
   * static set or the light's framing does.
   */
  _scan(key, scene, people) {
    const c = key.shadow.camera;
    let s = c.left * 1.1 + c.right * 1.3 + c.top * 1.7 + c.bottom * 1.9 + c.near * 2.3 + c.far * 2.9 + key.shadow.mapSize.x * 3.1;
    const a = key.matrixWorld.elements, b = key.target.matrixWorld.elements;
    s += a[12] * 3.7 + a[13] * 4.1 + a[14] * 4.3 + b[12] * 4.7 + b[13] * 5.3 + b[14] * 5.9;
    // perf-fix-2: textures baked in place after 'ready' (the later material groups: alpha-tested leaves among them)
    // change what an alpha-tested caster's depth holds without touching its geometry
    s += (this.ctx.mats?.stats?.bakes ?? 0) * 6.13;
    const statics = (this._statics ||= []), dyn = (this._dynList ||= []), rec = (this._rec ||= new WeakMap());
    statics.length = 0; dyn.length = 0;
    const frame = ++this._frame;
    let i = 0;
    const visit = (o) => {
      if (!o.castShadow || !(o.isMesh || o.isLine || o.isPoints)) return;
      const e = o.matrixWorld.elements, g = o.geometry;
      const dc = g?.drawRange?.count;
      const t = 1 + e[0] * 1.31 + e[1] * 1.37 + e[2] * 1.41 + e[4] * 1.43 + e[5] * 1.47 + e[6] * 1.53 + e[8] * 1.59
        + e[9] * 1.61 + e[10] * 1.67 + e[12] * 1.71 + e[13] * 1.73 + e[14] * 1.79
        // (a draw range's count is Infinity by default: it would make the whole sum Infinity, i.e. never change)
        + (Number.isFinite(dc) ? dc : -1) * 1.83 + (g?.drawRange?.start ?? 0) * 1.87 + (Number.isFinite(o.count) ? o.count : 0) * 1.91
        + (o.instanceMatrix?.version ?? 0) * 1.97 + (g?.attributes?.position?.version ?? 0) * 2.03 + (g?.index?.version ?? 0) * 2.07 + (g?.id ?? 0) * 2.11;
      let r = rec.get(o);
      if (!r) { r = { t, last: -10, moving: false }; rec.set(o, r); }
      if (r.t !== t) {
        if (frame - r.last <= 4) r.moving = true; // changing again within a few frames (a 30 Hz animation too)
        r.t = t; r.last = frame;
      } else if (r.moving && frame - r.last > MOVING_HOLD) r.moving = false;
      if (r.moving) { dyn.push(o); return; }
      statics.push(o);
      s += ++i * 0.618034 * t;
    };
    for (const ch of scene.children) if (ch !== people && ch.visible) ch.traverseVisible(visit);
    return s;
  }

  dispose() {
    if (this._sm.render !== this._orig) this._sm.render = this._orig;
    this.rt?.dispose();
    this.rt = null;
    this.ctx.env?.setShadowHold?.(false);
  }
}

function makeTarget(w, h) {
  // the same attachments as three's own directional shadow map (WebGLShadowMap): the depth formats must match to blit
  const rt = new WebGLRenderTarget(w, h);
  rt.depthTexture = new DepthTexture(w, h, UnsignedIntType);
  rt.depthTexture.format = DepthFormat;
  rt.depthTexture.minFilter = NearestFilter;
  rt.depthTexture.magFilter = NearestFilter;
  rt.texture.name = rt.depthTexture.name = 'render:key-shadow-cache';
  return rt;
}
