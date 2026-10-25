// Shader warm-up (perf-1). On ANGLE/D3D11 a lit program of this project costs 0.5–5 s to compile; compiled on first
// draw, all of them stalled the first frame for 30–60 s on an HD 4600. With KHR_parallel_shader_compile the GPU
// process compiles on worker threads (≈ 3× faster on 4 cores) and the main thread keeps running: renderer.compile()
// only creates the programs; the boot polls them (COMPLETION_STATUS_KHR, non-blocking) and draws once they are linked.
//
//   const job = compileScene(renderer, scene, camera)      // issue every program the scene's meshes need
//   await whenReady(renderer, job, (done, total) => …)    // resolves when all are linked (or at once without the ext)
import {
  WebGLRenderTarget, HalfFloatType, InstancedBufferAttribute, BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial,
  ShaderMaterial, Color, DoubleSide, FrontSide, BackSide, Vector2, Vector3, Scene, Light,
} from 'three';

let _target = null;
let _frameLights = null;

/**
 * perf-fix-1: run `fn` with the light state the frame draws with. On high / ultra render/shadows.js hides env's key light
 * and takes its shadow over only for the duration of a frame (SunShadows.beforeRender): a compile outside a frame
 * counted one more directional light and one less sun light, built programs no frame used, and the first frame then
 * compiled every lit program synchronously (50–90 s on the HD 4600). render/index.js registers the hook.
 */
export function setFrameLights(hook) { _frameLights = hook; }

/**
 * perf-fix-1: true when programs link on the GPU process's worker threads (KHR_parallel_shader_compile). Without it a
 * program issued ahead links at its first query — env's uniform binders query every new program — so warming up
 * programs a view may never draw would only add synchronous compiles.
 */
export function parallelCompile(renderer) {
  try { return !!renderer.extensions.has('KHR_parallel_shader_compile'); } catch { return false; }
}
export function withFrameLights(fn) { return _frameLights ? _frameLights(fn) : fn(); }

/**
 * true when the frame draws the scene into an offscreen target (the post pipeline, medium+): three keys programs by
 * the output colour space and tone mapping, which differ between the canvas and a render target, so a warm-up must
 * compile against the same kind of target the frame uses or it builds programs the frame never draws with
 */
export function rendersOffscreen(ctx) {
  return ctx?.post?.pipeline?.mode === 'post';
}

/**
 * Issue the programs of every material in `scene` (lights, fog and environment from `lightScene`, default `scene`),
 * as drawn onto the canvas or, `offscreen`, into a render target. Returns the Set of materials. three compiles every
 * mesh's material, shown or hidden; gate-core: `skip(material)` true leaves one out (the boot's deferred programs).
 */
export function compileScene(renderer, scene, camera, lightScene = null, offscreen = false, skip = null) {
  const prev = renderer.getRenderTarget();
  const held = [];
  try {
    if (skip) {
      scene.traverse((o) => {
        const m = o.material;
        if (!m) return;
        if (Array.isArray(m)) { if (m.some(skip)) { held.push([o, m]); o.material = m.filter((x) => !skip(x)); } } else if (skip(m)) { held.push([o, m]); o.material = null; }
      });
    }
    if (offscreen) {
      _target ||= new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true });
      renderer.setRenderTarget(_target);
    }
    return withFrameLights(() => renderer.compile(scene, camera, lightScene || scene));
  } catch (e) {
    console.warn('[warmup] compile failed', e);
    return new Set();
  } finally {
    for (const [o, m] of held) o.material = m;
    if (offscreen) renderer.setRenderTarget(prev);
  }
}

// ---------------------------------------------------------------------------------------------- deferred world (gate-core)
// The first view waited for every world program, also those of surfaces the start camera cannot see (from the dawn
// start: the terrain and olive groves behind the viewer, the courts' whitewash, the altar's wood, the water, the glass —
// 0 px of the view; ≈ 11 s of compile on the HD 4600 at low, ≈ 25 s at medium). An id pass from the boot camera (one
// cheap program, every mesh in a colour of its own, depth-tested) finds the materials none of whose meshes shows; those
// are hidden (material.visible: their meshes keep their own visibility, which the sim may toggle) and left out of the
// boot's compiles, then compiled after the first view and shown as each links. Hidden, they still cast their shadows:
// the shadow passes draw them (depth programs only) — a caster missing at boot would also stay missing from the cached
// key-light map (render/shadow-cache.js re-draws only when its casters move). The reflection probes (medium+) capture
// without them and are re-captured once all are shown.

const ID_VS = /* glsl */`
#include <common>
#include <batching_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
void main() {
  #include <batching_vertex>
  #include <skinbase_vertex>
  #include <morphinstance_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
}`;
const ID_FS = /* glsl */`
uniform vec3 uId;
void main() { gl_FragColor = vec4( uId, 1.0 ); }`;

const ID_LAYER = 30; // (render/prepass.js uses 29)

/** a surface that does not hide what is behind it (drawn in the id pass's second, depth-read-only round) */
function seeThrough(m) {
  return !m || m.transparent || m.alphaTest > 0 || m.alphaHash || !m.depthWrite || !m.colorWrite;
}

/**
 * The meshes under `scene` (not under any of `exclude`) of which at least one pixel shows from `camera`: opaque surfaces
 * first, then the see-through ones (transparent, alpha-tested) against their depth. At the frame's drawing-buffer size
 * (at most 1600 px wide), so a thin feature covers the pixels it covers in the frame (the soreg's 12 cm rail was missed
 * at 400 px). Points, lines and sprites neither hide nor count. Synchronous (one read-back per round).
 *
 * Each kind of mesh (plain, instanced, with or without uv1 …) is a program of its own, linked at its first draw here,
 * and the read-back waits for the GPU process: a pass while long programs are being compiled waits for them (2.3–3 s
 * measured on low). The boot runs its first pass before it issues any, and its re-check once they are linked.
 */
export function seenMeshes(renderer, scene, camera, { exclude = [] } = {}) {
  const size = renderer.getDrawingBufferSize(new Vector2());
  const W = Math.max(16, Math.min(1600, size.x || 400));
  const H = Math.max(16, Math.round(W / Math.max(0.2, camera.aspect || 1.6)));
  const mat = new ShaderMaterial({ name: 'warmup:id', uniforms: { uId: { value: new Color() } }, vertexShader: ID_VS, fragmentShader: ID_FS, side: DoubleSide });
  const list = [];
  const ids = new Map();
  mat.onBeforeRender = (r, s, c, g, o) => {
    const i = ids.get(o) ?? 0;
    mat.uniforms.uId.value.setRGB((i & 255) / 255, ((i >> 8) & 255) / 255, ((i >> 16) & 255) / 255);
    mat.uniformsNeedUpdate = true;
  };
  const skipRoots = new Set(exclude.filter(Boolean));
  const opaque = [], clear = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (let p = o; p; p = p.parent) if (skipRoots.has(p)) return;
    ids.set(o, list.length + 1);
    list.push(o);
    ([].concat(o.material).some(seeThrough) ? clear : opaque).push(o);
  });
  // each round draws only its meshes, picked by a layer of their own (a mesh's layers are its own, not inherited, so
  // a parent left out never hides a child; three still honours every object's and parent's visibility)
  const masks = list.map((o) => o.layers.mask);
  const rt = new WebGLRenderTarget(W, H, { depthBuffer: true });
  const sm = renderer.shadowMap;
  const saved = {
    target: renderer.getRenderTarget(), autoClear: renderer.autoClear, color: renderer.getClearColor(new Color()), alpha: renderer.getClearAlpha(),
    override: scene.overrideMaterial, background: scene.background, autoUpdate: sm.autoUpdate, needsUpdate: sm.needsUpdate,
    camMask: camera.layers.mask,
  };
  const seen = new Set();
  const buf = new Uint8Array(W * H * 4);
  const read = () => {
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    for (let k = 0; k < buf.length; k += 4) {
      const i = buf[k] | (buf[k + 1] << 8) | (buf[k + 2] << 16);
      if (i) seen.add(list[i - 1]);
    }
  };
  const pick = (objs, on) => { for (const o of objs) o.layers.mask = on ? 1 << ID_LAYER : 0; };
  try {
    sm.autoUpdate = false; sm.needsUpdate = false;
    scene.overrideMaterial = mat;
    scene.background = null;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rt);
    camera.layers.set(ID_LAYER);
    renderer.clear(true, true, false);
    pick(opaque, true); pick(clear, false);
    renderer.render(scene, camera);
    read();
    if (clear.length) {
      pick(opaque, false); pick(clear, true);
      mat.depthWrite = false;
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
      read();
    }
  } finally {
    list.forEach((o, i) => { o.layers.mask = masks[i]; });
    camera.layers.mask = saved.camMask;
    renderer.setRenderTarget(saved.target);
    renderer.autoClear = saved.autoClear;
    renderer.setClearColor(saved.color, saved.alpha);
    scene.overrideMaterial = saved.override;
    scene.background = saved.background;
    sm.autoUpdate = saved.autoUpdate; sm.needsUpdate = saved.needsUpdate;
    rt.dispose();
    mat.dispose();
  }
  return seen;
}

/**
 * The lit world materials (MeshStandard/Physical, shown) under `scene` none of whose meshes `seen` holds, each with its
 * meshes: Map material → mesh[]. A material of an excluded subtree (people, FX) is never deferred.
 */
export function unseenMaterials(scene, seen, { exclude = [] } = {}) {
  const skipRoots = new Set(exclude.filter(Boolean));
  const out = new Map(), shown = new Set();
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (let p = o; p; p = p.parent) if (skipRoots.has(p)) return;
    for (const m of [].concat(o.material)) {
      if (!m?.isMeshStandardMaterial) continue;
      if (seen.has(o) || !m.visible) { shown.add(m); continue; }
      if (!out.has(m)) out.set(m, []);
      out.get(m).push(o);
    }
  });
  for (const m of shown) out.delete(m);
  return out;
}

/**
 * gate-core: whether a figure standing at world (x, y, z) can be seen from the camera: a ray to its middle or its head
 * that no collider (walls, floors, closed doors) stops short of it. Without physics: true.
 */
const _eye = new Vector3(), _to = new Vector3();
export function inSight(ctx, x, y, z, heights = [0.5, 1.5]) {
  const ph = ctx.physics;
  if (!ph?.raycast) return true;
  ctx.camera.getWorldPosition(_eye);
  for (const h of heights) {
    _to.set(x, y + h, z).sub(_eye);
    const d = _to.length();
    if (d < 0.5) return true;
    _to.multiplyScalar(1 / d);
    const hit = ph.raycast(_eye, _to, d);
    if (!hit || hit.distance > d - 0.4) return true;
  }
  return false;
}

/**
 * gate-core: issue the shadow-pass programs of the casters under `root` that bring their own depth material
 * (customDepthMaterial: the people's figures and props), keyed as three keys them in the shadow pass: drawn into a
 * render target, before the frame's lights are counted (no lights, but a shadow: the light scene holds one bare Light
 * that casts — it is of no counted kind), the material's side flipped as WebGLShadowMap sets it. Linked at its first
 * shadow draw otherwise, which no longer falls in the first frame from the dawn start (no figure near enough to cast):
 * 5 s of frozen frames on medium when the first one did, with the compiler threads busy. With a shadow-casting point
 * light in `lightRoot` (the fires' cube shadows, high / ultra) the customDistanceMaterial too (16 s on high). Returns
 * the Set of materials.
 */
const SHADOW_SIDE = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide };
let _shadowOnly = null;
export function compileDepth(renderer, root, camera, lightRoot = null) {
  const out = new Set();
  if (!renderer.shadowMap.enabled) return out;
  let point = false;
  lightRoot?.traverse((l) => { if (l.isPointLight && l.castShadow) point = true; });
  const seen = new Set();
  root.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    if (o.customDepthMaterial) one(o, o.customDepthMaterial);
    if (point && o.customDistanceMaterial) one(o, o.customDistanceMaterial);
  });
  return out;

  function one(o, dm) {
    const key = `${dm.id}:${!!o.isInstancedMesh}:${!!o.isBatchedMesh}:${!!o.isSkinnedMesh}:${!!o.morphTargetInfluences}`;
    if (seen.has(key)) return;
    seen.add(key);
    const m = o.material, side = dm.side;
    const om = Array.isArray(m) ? m[0] : m;
    if (!_shadowOnly) {
      _shadowOnly = new Scene();
      const l = new Light();
      l.castShadow = true;
      _shadowOnly.add(l);
    }
    const prev = renderer.getRenderTarget();
    try {
      o.material = dm;
      dm.side = om?.shadowSide ?? SHADOW_SIDE[om?.side ?? FrontSide];
      _target ||= new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true });
      renderer.setRenderTarget(_target);
      for (const x of renderer.compile(o, camera, _shadowOnly)) if (x === dm) out.add(x);
    } catch (e) {
      console.warn('[warmup] depth compile failed', e);
    } finally {
      o.material = m;
      dm.side = side;
      renderer.setRenderTarget(prev);
    }
  }
}

const _hidden = new Set();
let _smWrap = null;
/** hide deferred materials from every pass but the shadow maps' (see above) */
export function hideDeferred(renderer, mats) {
  for (const m of mats) { m.visible = false; _hidden.add(m); }
  if (_smWrap || !_hidden.size) return;
  const sm = renderer.shadowMap, inner = sm.render;
  const wrap = function (...args) {
    for (const m of _hidden) m.visible = true;
    try { return inner.apply(this, args); } finally { for (const m of _hidden) m.visible = false; }
  };
  _smWrap = { sm, inner, wrap };
  sm.render = wrap;
}
/** a deferred material's program is linked: show it (the last one restores the shadow map's render) */
export function showDeferred(m) {
  _hidden.delete(m);
  m.visible = true;
  if (_hidden.size || !_smWrap) return;
  if (_smWrap.sm.render === _smWrap.wrap) _smWrap.sm.render = _smWrap.inner; // (wrapped again since: ours stays, idle)
  _smWrap = null;
}

/**
 * The meshes seen from the camera's place when it turns (yaw +90°, 180°, 270°; the same pitch and field of view): what
 * the visitor sees first after the first view. As seenMeshes, so run it while no long program is queued.
 */
export function seenAround(renderer, scene, camera, opts) {
  const out = new Set();
  const cam = camera.clone();
  cam.layers.mask = camera.layers.mask;
  camera.updateMatrixWorld();
  for (let k = 1; k < 4; k++) {
    camera.matrixWorld.decompose(cam.position, cam.quaternion, cam.scale);
    cam.rotation.setFromQuaternion(cam.quaternion, 'YXZ');
    cam.rotation.y += (k * Math.PI) / 2;
    cam.updateMatrixWorld(true);
    for (const o of seenMeshes(renderer, scene, cam, opts)) out.add(o);
  }
  return out;
}

/**
 * gate-core: programs compiled after the first view, in one queue with at most BG_INFLIGHT of them still linking. A
 * program a frame needs at once (compiled synchronously at its first draw: the probes' metering shader, a shadow depth
 * variant of a figure that came into range) then finds a compiler thread free: with every deferred program issued at
 * once it waited behind all of them, 3–8 s of frozen frames on medium+ on the HD 4600. At most one new program is
 * created per frame (creating one preprocesses ~140 KB of GLSL: 0.1–0.25 s of this thread). Each linked program's first
 * use (uniform reads) and env's binding happen here too, not in the frame that first draws it.
 *   compileLater(ctx, object, { priority }) -> Promise (linked)
 *   compileLater(ctx, null, { issue }) -> Promise   `issue()` creates its programs and returns a promise of them linked
 *                                                     (the material baker's generator programs: world/materials)
 * `priority` (default 2; lower first, in order of call within one): 0 the deferred world materials (surfaces missing until
 * shown), 1 the baker's later texture groups (surfaces flat until baked), 2 hidden meshes and the people's variants.
 *
 * gate-core-r2: the budget is of PROGRAMS NOT YET LINKED, all of the renderer's (the queue's, a frame's own, any other
 * caller's), not of queued objects. The GPU process links on a pool of worker threads (three on the HD 4600's 4-thread
 * CPU); a program issued while every worker is busy blocks the GPU process's main thread until one frees (ANGLE resolves
 * the shaders' compile inside linkProgram), and every frame waits with it. Counting objects let 5 of the queue's
 * programs and up to 8 of the baker's (which issued on its own) be pending at once: 1–8 s frozen frames in the first
 * seconds of play. `backgroundPolicy.limit()` (main.js) says how many may be pending: logical cores − 2 (2 on the HD 4600's
 * machine), 0 for a quiet spell right after Enter.
 */
const BG_INFLIGHT = 2;
const BG_STUCK_MS = 60000; // a program pending this long no longer counts (a driver that never reports completion)
const _bg = { queue: [], pumping: false, since: new WeakMap() };
/** main.js: `limit()` → how many unlinked programs the queue may leave pending before it issues the next */
export const backgroundPolicy = { limit: () => BG_INFLIGHT };
export function compileLater(ctx, object, { issue = null, priority = 2 } = {}) {
  return new Promise((resolve) => {
    const q = _bg.queue;
    let i = q.length;
    while (i > 0 && q[i - 1].priority > priority) i--;
    q.splice(i, 0, { ctx, object, issue, priority, resolve });
    if (!_bg.pumping) { _bg.pumping = true; requestAnimationFrame(pump); }
  });
}
/** the queue's state (profiling, tools/warmup-check.mjs): queued entries and the renderer's unlinked programs */
export function backgroundState(renderer) {
  return { queued: _bg.queue.length, pending: renderer ? pendingPrograms(renderer) : 0 };
}
function pendingPrograms(r) {
  const now = performance.now();
  let n = 0;
  for (const p of r.info.programs || []) {
    let ok = true;
    try { ok = p.isReady(); } catch { ok = true; } // (three caches a linked program's answer: no query)
    if (ok) continue;
    const t = _bg.since.get(p);
    if (t === undefined) _bg.since.set(p, now);
    else if (now - t > BG_STUCK_MS) continue;
    n++;
  }
  return n;
}
function pump() {
  const t0 = performance.now();
  let made = false;
  let room = -1;
  while (_bg.queue.length && !made && performance.now() - t0 < 12) {
    const { ctx, object, issue, resolve } = _bg.queue[0];
    const r = ctx.renderer;
    if (room < 0) room = backgroundPolicy.limit() - pendingPrograms(r);
    if (room <= 0) break;
    _bg.queue.shift();
    const n0 = r.info.programs.length;
    const bind = (v) => {
      try { ctx.env?.bindPrograms?.(); } catch { /* the frame binds it */ }
      resolve(v);
    };
    if (issue) {
      let p;
      try { p = Promise.resolve(issue()); } catch (e) { p = Promise.reject(e); }
      p.then(bind, (e) => { console.warn('[warmup] background compile failed', e); resolve(null); });
    } else {
      const set = compileScene(r, object, ctx.camera, ctx.scene, rendersOffscreen(ctx));
      whenReady(r, set).then(() => bind(set));
    }
    made = r.info.programs.length !== n0; // (one new program per frame: creating one costs this thread 0.1–0.25 s)
  }
  if (_bg.queue.length) requestAnimationFrame(pump); else _bg.pumping = false;
}

/**
 * After the first view: compile the deferred materials (Map material → meshes; hideDeferred) — those in `first` (seen
 * by turning on the spot, seenAround) first, then nearest first — through compileLater, and show each once its programs
 * are linked. All are queued at once (ahead of what is queued later: the people's variants); returns a promise of all
 * shown, after which the probes (medium+), which captured the scene without them, capture again.
 */
export function warmDeferred(ctx, deferred, first = new Set()) {
  const cam = ctx.camera;
  const c = new Vector3();
  const near = (objs) => {
    let d = Infinity;
    for (const o of objs) {
      const g = o.geometry;
      if (!g) continue;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const s = g.boundingSphere;
      c.copy(s.center).applyMatrix4(o.matrixWorld);
      d = Math.min(d, c.distanceTo(cam.position) - s.radius * o.matrixWorld.getMaxScaleOnAxis());
    }
    return d;
  };
  const order = [...deferred].map(([m, objs]) => [m, objs, near(objs) - (objs.some((o) => first.has(o)) ? 1e7 : 0)]).sort((a, b) => a[2] - b[2]);
  const shown = order.map(([m, objs]) => Promise.all(objs.map((o) => compileLater(ctx, o, { priority: 0 }))).then(() => {
    showDeferred(m);
    deferred.delete(m);
  }));
  // (gate-core-r2: in play amortised, one face a frame — a sync capture of every probe froze a frame 1 s on high, 2.2 s
  // on ultra; a screenshot, taken a few frames after, keeps the sync capture)
  return Promise.all(shown).then(() => {
    try {
      const pr = ctx.env?.probes;
      if (pr?.refresh && !ctx.params?.shot) pr.refresh(); else pr?.capture?.();
    } catch { /* the next refresh */ }
    return shown.length;
  });
}

/**
 * Issue the programs of fullscreen pass materials ([{ material, toScreen, geometry }], render/post.js
 * warmupMaterials): offscreen unless the pass draws onto the canvas. Returns the Set of materials.
 */
export function compilePasses(renderer, list, camera) {
  const prev = renderer.getRenderTarget();
  const out = new Set();
  let g = null;
  try {
    for (const { material, toScreen, geometry } of list) {
      if (!geometry && !g) g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3));
      const mesh = new Mesh(geometry || g, material);
      mesh.frustumCulled = false;
      _target ||= new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true });
      renderer.setRenderTarget(toScreen ? null : _target);
      try { for (const m of renderer.compile(mesh, camera)) out.add(m); } catch (e) { console.warn('[warmup] pass compile failed', e); }
    }
  } finally {
    renderer.setRenderTarget(prev);
  }
  return out;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/**
 * Draw the plain lit meshes under `root` through three's instancing path, as one instance at the identity (perf-1).
 * A material drawn by both plain and instanced meshes compiles two programs (instancing is part of three's program
 * key): most world materials are, so this halves those pairs (≈ 1–2 s of compile each on ANGLE/D3D11). The object
 * stays the same Mesh (movables, colliders and anchors keep their references): it gains the fields three's renderer
 * reads from an InstancedMesh (isInstancedMesh, instanceMatrix, count, instanceColor, morphTexture) and
 * userData.mkSingle, for code that must still tell it apart (nav/doors.js). Its world matrix × identity = as before.
 */
export function singleInstance(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh || o.userData.mkSingle) return;
    const g = o.geometry;
    if (!g?.attributes?.position || g.morphAttributes?.position) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (!ms.length || !ms.every((m) => m?.isMeshStandardMaterial)) return;
    o.isInstancedMesh = true;
    o.instanceMatrix = new InstancedBufferAttribute(IDENTITY.slice(), 16);
    o.instanceColor = null;
    o.morphTexture = null;
    o.count = 1;
    o.userData.mkSingle = true;
    n++;
  });
  return n;
}

/** every program a material holds (a material drawn by plain and instanced meshes has one of each) */
function programsOf(renderer, m) {
  const p = renderer.properties.get(m);
  const out = [];
  p.programs?.forEach?.((prog) => out.push(prog));
  if (p.currentProgram && !out.includes(p.currentProgram)) out.push(p.currentProgram);
  return out;
}

/**
 * Resolve once every program of `materials` (a Set or array, or several) is linked. Polls every `interval` ms;
 * `onProgress(done, total)` after each poll. Without KHR_parallel_shader_compile three reports programs ready at once
 * (the first draw then compiles them, as before).
 */
export function whenReady(renderer, materials, onProgress = null, interval = 40) {
  const progs = new Set();
  const lists = Array.isArray(materials) ? materials : [materials];
  for (const list of lists) for (const m of list || []) for (const p of programsOf(renderer, m)) progs.add(p);
  const total = progs.size;
  const firstUse = parallelCompile(renderer);
  return new Promise((resolve) => {
    const poll = () => {
      for (const p of progs) {
        let ok = true;
        try { ok = p.isReady(); } catch { ok = true; }
        if (!ok) continue;
        progs.delete(p);
        // perf-fix-2: a linked program's first use (three reads its uniforms and attributes — synchronous queries — and
        // builds its uniform setters) happens now, in the warm-up's idle time, not inside the first frame. (A synchronous
        // query in a frame waits for the GPU process to drain the work queued before it: on the HD 4600 the first
        // frame's queries waited 0.15–0.6 s, but that is the frame's own GPU work, not the query.)
        if (firstUse) try { p.getUniforms(); } catch { /* the draw reports it */ }
      }
      onProgress?.(total - progs.size, total);
      if (!progs.size) resolve(total);
      else setTimeout(poll, interval);
    };
    poll();
  });
}

/** shown: the object and all its ancestors visible */
function isShown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * qa-r1-fix-env-render (ENV-5): after the first view, warm in idle slices what the boot's warm-up could not see —
 *  - the meshes that exist but are hidden (three's compile walks visible objects only): a pyre shown on its day, a
 *    curtain or prop switched on by the sim; each is compiled as it is, made visible for that call only;
 *  - stand-ins for programs that lazily created meshes will need: a plain MeshStandardMaterial on a plain mesh is the
 *    program of the people's lead ropes (people/system.js RopeSet, made at the first led animal — at the gates' opening
 *    before sunrise its first frame compiled it synchronously: 1.5–1.9 s on the HD 4600 at low).
 * One object per slice (a synchronous program query waits for the GPU's queued work; issuing during the boot's warm-up
 * competes with the first view — hence after 'firstFrame'); each linked program's first use (uniform reads) happens
 * here too, not in the frame that first draws it.
 */
export function warmHidden(ctx, { delay = 400 } = {}) {
  const r = ctx.renderer;
  const queue = [];
  const plain = new Mesh(new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3))
    .setAttribute('normal', new Float32BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3)), new MeshStandardMaterial());
  plain.name = 'warmup:plain-standard';
  plain.frustumCulled = false;
  queue.push(plain);
  const seen = new Set();
  const own = ctx.people?.root || null; // the figures warm their own pools and LODs (people/index.js)
  ctx.scene.traverse((o) => {
    if (!(o.isMesh || o.isLine || o.isPoints) || isShown(o)) return;
    for (let p = o; p; p = p.parent) if (p === own) return;
    const ms = (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
    if (!ms.length || ms.every((m) => seen.has(m))) return;
    for (const m of ms) seen.add(m);
    queue.push(o);
  });
  const stats = { queued: queue.length, issued: 0, programs: 0 };
  const idle = (fn) => (globalThis.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 50));
  const step = () => {
    const o = queue.shift();
    // (the stand-in is kept: disposing its material would release the program it warmed, and three deletes a program
    // nothing uses — the ropes' first frame then rebuilt it, 130 ms even from the driver's shader cache)
    if (!o) return;
    // the scene may have changed meanwhile: an object shown or removed since is the frame's business
    if (o !== plain && (!o.parent || isShown(o))) { idle(step); return; }
    stats.issued++;
    // gate-core: through compileLater's queue (three r186 compiles hidden meshes too), one at a time as before; there
    // env's uniform binders query each new program once linked, not in a later frame while the next compile is queued
    // (warmup-check: a 435 ms getUniformBlockIndex on low)
    compileLater(ctx, o).then(() => {
      stats.programs = r.info.programs?.length ?? 0;
      idle(step);
    });
  };
  setTimeout(() => idle(step), delay);
  return stats;
}
