// Contact shadows (qa-r1 PPL-6): where the tier draws no shadow maps (low) or only the near figures cast (medium), every
// person and animal gets a soft dark ellipse on the floor under the part of its body that is near the ground — the
// occlusion a body makes where it meets the floor. ONE instanced draw call for all of them: a unit quad scaled to each
// figure's footprint, alpha-blended black (dst × (1 − a)), faded out with distance and with the figure's own fade.
// The footprint comes from the baked pose (the joints below 55 % of the figure's height, in figure space), so a
// standing man gets a small blob between his feet and a prostrate one a long one under his whole length.
import {
  InstancedMesh, PlaneGeometry, BufferGeometry, ShaderMaterial, InstancedBufferAttribute, DynamicDrawUsage, Sphere, Vector3,
} from 'three';
import { MAX_BONES } from './rig.js';

const FLOATS_PER_FRAME = MAX_BONES * 12;
const LIFT = 0.012;                 // metres above the figure's floor (with polygon offset: no z-fighting)
const MARGIN = 0.11;                // around the low joints (the feet, shins and robe hem reach past the joints)
const MIN_PX = 3;                   // the least height on screen of a shadow seen at a grazing angle (see VERT)

// Seen at a grazing angle a flat ellipse shrinks to a line thinner than a pixel and vanishes: the ellipse is stretched
// along the line of sight (toward and away from the camera) until it covers about MIN_PX rows on screen — from above it
// would be long, but from where it is stretched it reads as the thin dark band under the feet a real shadow makes.
const VERT = /* glsl */`
uniform float uFocal;   // pixels per metre at 1 m (viewport height / (2 tan(fov / 2)))
attribute float cAlpha;
varying vec2 vQ;
varying float vA;
void main() {
  vQ = position.xz;
  vA = cAlpha;
  mat4 M = modelMatrix * instanceMatrix;
  vec3 c = (M * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec4 w = M * vec4(position, 1.0);
  vec3 v = c - cameraPosition;
  float L = length(v) + 1e-3;
  vec2 dir = v.xz / (length(v.xz) + 1e-3);
  float sinT = clamp(-v.y / L, 0.02, 1.0);
  vec3 ax = (M * vec4(1.0, 0.0, 0.0, 0.0)).xyz, az = (M * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
  float rAlong = length(vec2(dot(ax.xz, dir), dot(az.xz, dir)));
  float k = clamp(${MIN_PX.toFixed(1)} * L / (2.0 * uFocal * sinT * max(rAlong, 0.05)), 1.0, 4.0);
  w.xz += dir * dot(w.xz - c.xz, dir) * (k - 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// a soft ellipse: dark in the middle, a long smooth falloff (no visible rim)
const FRAG = /* glsl */`
uniform float uStrength;
varying vec2 vQ;
varying float vA;
void main() {
  float r2 = dot(vQ, vQ);
  if (r2 >= 1.0) discard;
  float a = (1.0 - r2) * (1.0 - r2) * mix(1.0, 0.55, smoothstep(0.0, 0.6, r2)) * uStrength * vA;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

export class ContactShadows {
  constructor(parent, cap = 128) {
    const g = new PlaneGeometry(2, 2, 1, 1);
    g.rotateX(-Math.PI / 2);                     // in the XZ plane, facing up
    this.geo = g;
    this.mat = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uStrength: { value: 0.5 }, uFocal: { value: 600 } },
      transparent: true, depthWrite: false, depthTest: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mat.name = 'people-contact-shadow';
    this.parent = parent;
    this.cap = 0;
    this.n = 0;
    this.mesh = null;
    this._alloc(cap);
  }
  _alloc(cap) {
    const old = this.mesh;
    const g = new BufferGeometry();          // a fresh geometry sharing the quad's attributes
    for (const k of Object.keys(this.geo.attributes)) g.setAttribute(k, this.geo.attributes[k]);
    g.setIndex(this.geo.index);
    this.alpha = new InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(DynamicDrawUsage);
    g.setAttribute('cAlpha', this.alpha);
    g.boundingSphere = new Sphere(new Vector3(), 1e6);
    const m = new InstancedMesh(g, this.mat, cap);
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.matrixAutoUpdate = false;
    m.matrixWorldAutoUpdate = false;
    m.renderOrder = 1;                          // after the opaque floor it darkens
    m.name = 'people:contact-shadows';
    m.count = 0;
    m.visible = false;
    if (old) {
      m.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.n * 16));
      this.alpha.array.set(this._oldAlpha.array.subarray(0, this.n));
      this._release(old);
    }
    this._oldAlpha = this.alpha;
    this.mesh = m;
    this.cap = cap;
    this.parent.add(m);
  }
  _release(m) {
    this.parent.remove(m);
    for (const k of Object.keys(this.geo.attributes)) m.geometry.deleteAttribute(k);
    m.geometry.setIndex(null);
    m.geometry.dispose();
    m.dispose();
  }
  /** a geometry with the instanced mesh's attribute layout, for compiling the program ahead (never released) */
  warmGeometry() {
    const g = new BufferGeometry();
    for (const k of Object.keys(this.geo.attributes)) g.setAttribute(k, this.geo.attributes[k]);
    g.setIndex(this.geo.index);
    g.setAttribute('cAlpha', new InstancedBufferAttribute(new Float32Array(1), 1));
    return g;
  }
  begin() { this.n = 0; }
  /** e16: the figure's instance matrix (world, scaled); fp: [cx, cz, rx, rz] in figure space; a: opacity 0..1 */
  push(e16, fp, a) {
    if (a <= 0.01) return;
    if (this.n >= this.cap) this._alloc(this.cap * 2);
    const i = this.n++;
    const o = i * 16, E = this.mesh.instanceMatrix.array;
    const [cx, cz, rx, rz] = fp;
    // M = e16 · (T(cx, LIFT/s, cz) · S(rx, 1, rz))
    for (let r = 0; r < 3; r++) {
      E[o + r] = e16[r] * rx;
      E[o + 4 + r] = e16[4 + r];
      E[o + 8 + r] = e16[8 + r] * rz;
    }
    E[o + 3] = 0; E[o + 7] = 0; E[o + 11] = 0;
    const sy = Math.hypot(e16[4], e16[5], e16[6]) || 1;
    const ly = LIFT / sy;
    E[o + 12] = e16[0] * cx + e16[4] * ly + e16[8] * cz + e16[12];
    E[o + 13] = e16[1] * cx + e16[5] * ly + e16[9] * cz + e16[13];
    E[o + 14] = e16[2] * cx + e16[6] * ly + e16[10] * cz + e16[14];
    E[o + 15] = 1;
    this.alpha.array[i] = a;
  }
  end() {
    const m = this.mesh, n = this.n;
    m.count = n;
    m.visible = n > 0;
    if (!n) return;
    m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, n * 16); m.instanceMatrix.needsUpdate = true;
    this.alpha.clearUpdateRanges(); this.alpha.addUpdateRange(0, n); this.alpha.needsUpdate = true;
  }
  dispose() {
    if (this.mesh) this._release(this.mesh);
    this.mesh = null;
    this.geo.dispose();
    this.mat.dispose();
  }
}

/**
 * The footprint of a figure's pose at baked frame F: [cx, cz, rx, rz] (figure space, metres) — the box of the joints
 * below yCut, plus a margin, into out; null when no joint is that low (a bird in flight). master: the atlas' Float32 rows.
 */
export function poseFootprint(master, rig, F, yCut, out = [0, 0, 0, 0]) {
  const o0 = F * FLOATS_PER_FRAME;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, any = false;
  for (let b = 0; b < rig.n; b++) {
    const p = rig.rest[b], o = o0 + b * 12;
    const y = master[o + 4] * p.x + master[o + 5] * p.y + master[o + 6] * p.z + master[o + 7];
    if (y > yCut) continue;
    const x = master[o] * p.x + master[o + 1] * p.y + master[o + 2] * p.z + master[o + 3];
    const z = master[o + 8] * p.x + master[o + 9] * p.y + master[o + 10] * p.z + master[o + 11];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
    any = true;
  }
  if (!any) return null;
  const m = MARGIN * Math.min(1, Math.max(0.35, rig.dims.H / 1.6));
  out[0] = (x0 + x1) / 2; out[1] = (z0 + z1) / 2; out[2] = Math.max(0.12, (x1 - x0) / 2 + m); out[3] = Math.max(0.12, (z1 - z0) / 2 + m);
  return out;
}
