// Depth pre-pass (perf-1). The world is a few dozen merged batches, one per material, and three draws opaque batches
// sorted by program before depth: the expensive lit shaders (interiors, probes, fog — 1–3 k instructions) ran on every
// hidden fragment of the courts behind a wall. The opaque world is first drawn into the depth buffer alone (one cheap
// program, colour writes off); the frame's own pass then keeps that depth (LessEqual), so early-Z shades each pixel once.
// Measured on the HD 4600, low: a wall-filling view 33 → 14 ms of GPU, the Kodesh 30 → 19, the spawn 18 → 15.
//
// Eligible: lit (MeshStandard/Physical) meshes of the world, opaque, not alpha-tested, depth-tested and -writing, front-
// or double-sided (a back-sided mesh's front faces would occlude what it never draws). They carry PREPASS_LAYER besides
// their own layers; the pre-pass renders the real scene graph (so hidden parents hide them) with only that layer.
// Vertex positions are the same expression in both programs (no world material displaces vertices); skinned people,
// alpha-tested lattices / foliage, the sky and the FX are not in it and draw as before.
//
// perf-fix-1: the pre-pass depth sits a polygon offset BEHIND the frame's (factor 1, units 2), so the frame's LessEqual
// test never depends on two different programs computing bit-identical depth (neither declares gl_Position invariant,
// and only ANGLE/D3D11 was measured): a frame fragment of the same surface always passes, and what it writes is its own
// depth, so the result is the same as without the pre-pass; a hidden surface within the offset is merely shaded and then
// overdrawn. Off by default on tile-based GPUs (render/detect.js tiledGpu), which remove hidden fragments themselves.
import { MeshDepthMaterial, FrontSide, DoubleSide, LessEqualDepth, Group, Mesh, InstancedMesh, BufferGeometry, Float32BufferAttribute } from 'three';

export const PREPASS_LAYER = 29;
export const PREPASS_MIN_RADIUS = 8;

/**
 * Mark the eligible meshes under root; returns how many. Only occluders worth a draw call: a mesh whose world-space
 * bounding radius (one instance's, for an instanced one) is at least `minRadius` m — walls, floors, roofs, the big
 * merged batches; a vessel or a lamp costs a draw call on ANGLE in both processes and hides almost nothing.
 */
export function markPrepass(root, minRadius = PREPASS_MIN_RADIUS) {
  let n = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.geometry?.morphAttributes?.position) return;
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere || g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < minRadius) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    // (perf-fix-1: and nothing that moves or offsets its depth: a displacement map, a polygon offset, another depth test)
    if (!ms.length || !ms.every((m) => m?.isMeshStandardMaterial && !m.transparent && !(m.alphaTest > 0) && !m.alphaHash
      && m.depthTest && m.depthWrite && m.colorWrite && (m.side === FrontSide || m.side === DoubleSide) && m.visible
      && !m.displacementMap && !m.polygonOffset && m.depthFunc === LessEqualDepth && !m.wireframe)) return;
    o.layers.enable(PREPASS_LAYER);
    n++;
  });
  return n;
}

export class DepthPrepass {
  constructor() {
    this.material = new MeshDepthMaterial();
    this.material.colorWrite = false;
    this.material.fog = false; // depth only (and the warm-up compiles it without the scene's fog)
    this.material.name = 'depth-prepass';
    // the margin described at the top (perf-fix-1)
    this.material.polygonOffset = true;
    this.material.polygonOffsetFactor = 1;
    this.material.polygonOffsetUnits = 2;
    this.enabled = true;
  }

  /**
   * draw the marked meshes' depth into the current target (cleared by the caller); leaves the frame's state as it was.
   * Returns true when it drew: the scene's world matrices are then up to date (see drawScene)
   */
  render(renderer, scene, camera) {
    if (!this.enabled) return false;
    const sm = renderer.shadowMap;
    const autoUpdate = sm.autoUpdate, needsUpdate = sm.needsUpdate;
    const mask = camera.layers.mask, override = scene.overrideMaterial, background = scene.background;
    const autoClear = renderer.autoClear;
    sm.autoUpdate = false; sm.needsUpdate = false; // the frame's own pass renders the shadow maps, once
    camera.layers.set(PREPASS_LAYER);
    scene.overrideMaterial = this.material;
    scene.background = null;
    renderer.autoClear = false;
    try {
      renderer.render(scene, camera);
    } finally {
      sm.autoUpdate = autoUpdate; sm.needsUpdate = needsUpdate;
      camera.layers.mask = mask;
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.autoClear = autoClear;
    }
    return true;
  }

  /**
   * perf-fix-1: the frame's scene pass after the pre-pass, without updating the scene's world matrices a second time
   * (the pre-pass's render() just did; nothing moves in between)
   */
  drawScene(renderer, scene, camera, draw = () => renderer.render(scene, camera)) {
    const pre = this.render(renderer, scene, camera);
    const auto = scene.matrixWorldAutoUpdate;
    if (pre) scene.matrixWorldAutoUpdate = false;
    try { draw(); } finally { scene.matrixWorldAutoUpdate = auto; }
  }

  /** dummies for the warm-up compile (render/warmup.js): the pre-pass program, plain and instanced */
  warmupObjects() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3));
    g.setAttribute('normal', new Float32BufferAttribute(new Float32Array(9), 3));
    const grp = new Group();
    grp.add(new Mesh(g, this.material), new InstancedMesh(g, this.material, 1));
    for (const o of grp.children) o.frustumCulled = false;
    return grp;
  }

  dispose() { this.material.dispose(); }
}
