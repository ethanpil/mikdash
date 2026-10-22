// Shader warm-up (perf-1). On ANGLE/D3D11 a lit program of this project costs 0.5–5 s to compile; compiled on first
// draw, all of them stalled the first frame for 30–60 s on an HD 4600. With KHR_parallel_shader_compile the GPU
// process compiles on worker threads (≈ 3× faster on 4 cores) and the main thread keeps running: renderer.compile()
// only creates the programs; the boot polls them (COMPLETION_STATUS_KHR, non-blocking) and draws once they are linked.
//
//   const job = compileScene(renderer, scene, camera)      // issue every program the scene's meshes need
//   await whenReady(renderer, job, (done, total) => …)    // resolves when all are linked (or at once without the ext)
import { WebGLRenderTarget, HalfFloatType, InstancedBufferAttribute, BufferGeometry, Float32BufferAttribute, Mesh } from 'three';

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
 * as drawn onto the canvas or, `offscreen`, into a render target. Returns the Set of materials.
 */
export function compileScene(renderer, scene, camera, lightScene = null, offscreen = false) {
  const prev = renderer.getRenderTarget();
  try {
    if (offscreen) {
      _target ||= new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true });
      renderer.setRenderTarget(_target);
    }
    return withFrameLights(() => renderer.compile(scene, camera, lightScene || scene));
  } catch (e) {
    console.warn('[warmup] compile failed', e);
    return new Set();
  } finally {
    if (offscreen) renderer.setRenderTarget(prev);
  }
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
