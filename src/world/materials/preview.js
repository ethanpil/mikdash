// Material swatch preview (?debug=mats): every library material as a sphere, a box and a small wall patch,
// in labelled rows of 15 at site X 251..300, Y 100 / 104 / … / 116 (just north of the 'start' anchor).
// Vertex-colour materials (terrain_blend) get a rock -> soil -> vegetation weight gradient across the swatch.
// Shots: overview "debug=mats&t=d4&pos=274,88,9&look=0,-24"; one row r (Y_r = 100 + 4r), swatch columns
// X = 251 + 3.5 i: "debug=mats&t=d4&at=<X>,<Y_r - 2.6>&look=0,-28".
import {
  Group, Mesh, SphereGeometry, BoxGeometry, PlaneGeometry, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, Float32BufferAttribute,
} from 'three';
import { m2w, a } from '../../core/units.js';
import { applyWorldUV } from '../geom.js';

const PER_ROW = 15;
const X0 = 251;
const DX = 3.5;            // amot between swatches
const ROWS_Y = [100, 104, 108, 112, 116];

function label(text, sub) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,16,12,0.82)';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#f4ead2';
  g.font = '600 38px system-ui, sans-serif';
  g.textBaseline = 'top';
  g.fillText(text, 14, 8, 484);
  if (sub) {
    g.fillStyle = '#c9b892';
    g.font = '24px system-ui, sans-serif';
    g.fillText(sub, 14, 56, 484);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** rock -> soil -> vegetation weights (vertex colour) across a geometry's x extent, for terrain_blend */
function weightGradient(g) {
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) - min.x) / Math.max(1e-6, max.x - min.x);
    c.set([Math.max(0, 1 - 2 * t), 1 - Math.abs(2 * t - 1), Math.max(0, 2 * t - 1)], i * 3);
  }
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
}

/** Sphere with physically scaled UVs (u around = circumference, v pole-to-pole = half circumference). */
function sphereGeo(r) {
  const g = new SphereGeometry(r, 48, 32);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * Math.PI * r);
  return g;
}

export async function buildPreview(ctx) {
  const t0 = performance.now();
  const grp = new Group();
  grp.name = 'materials-preview';
  const keys = ctx.mats.keys.filter((k) => k !== 'debug' && !ctx.mats.info(k)?.alias && ctx.mats.get(k).name === k);
  keys.forEach((key, i) => {
    const row = Math.floor(i / PER_ROW);
    const col = i % PER_ROW;
    if (row >= ROWS_Y.length) return;
    const X = X0 + col * DX;
    const Y = ROWS_Y[row];
    const base = 0;
    const mat = ctx.mats.get(key);
    const c = m2w(X, Y, 0);
    // wall patch (behind), sphere (left) and box (right) in front
    const wall = new BoxGeometry(1.25, 1.05, 0.1);
    wall.translate(c.x, base + 0.525, c.z - a(1.0));
    applyWorldUV(wall);
    const sph = sphereGeo(0.27);
    sph.translate(c.x - 0.33, base + 0.27, c.z);
    const bx = new BoxGeometry(0.4, 0.4, 0.4);
    bx.translate(c.x + 0.33, base + 0.2, c.z);
    applyWorldUV(bx);
    for (const g of [wall, sph, bx]) {
      if (mat.vertexColors) weightGradient(g);
      const m = new Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = `preview:${key}`;
      grp.add(m);
    }
    const info = ctx.mats.info(key);
    const sub = info?.confidence ? `${info.confidence}${ctx.mats.tile(key) ? ` · tile ${ctx.mats.tile(key).tile.join('×')} m` : ''}` : '';
    const lab = new Mesh(new PlaneGeometry(1.5, 0.28),
      new MeshBasicMaterial({ map: label(key, sub), transparent: true, fog: false, toneMapped: false, depthWrite: false }));
    lab.position.set(c.x, base + 0.012, c.z + 0.42);
    lab.rotation.x = -Math.PI / 2 + 0.35;
    lab.renderOrder = 2;
    grp.add(lab);
  });
  console.info(`[mats] preview: ${keys.length} materials in ${(performance.now() - t0).toFixed(0)} ms`, ctx.mats.stats.MB, 'MB');
  return grp;
}
