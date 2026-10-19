// One InstancedBufferGeometry quad per FX type => one draw call per type for ALL fires in the world.
// Slots are compacted on free (swap-with-last), so instanceCount stays tight; owners hold slot objects
// whose index is kept current.
import {
  InstancedBufferGeometry, InstancedBufferAttribute, Float32BufferAttribute, Mesh, DynamicDrawUsage,
} from 'three';

export class InstanceBatch {
  /**
   * @param {string} name
   * @param {Record<string, number>} layout attribute name -> itemSize
   * @param {number} capacity max instances
   * @param {{ x0:number, x1:number, y0:number, y1:number }} quad local quad extents (shader interprets them)
   */
  constructor(name, layout, capacity, quad = { x0: -0.5, x1: 0.5, y0: 0, y1: 1 }) {
    const g = new InstancedBufferGeometry();
    const { x0, x1, y0, y1 } = quad;
    g.setAttribute('position', new Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.arrays = {};
    for (const [k, size] of Object.entries(layout)) {
      const arr = new Float32Array(capacity * size);
      const attr = new InstancedBufferAttribute(arr, size);
      attr.setUsage(DynamicDrawUsage);
      g.setAttribute(k, attr);
      this.arrays[k] = { arr, size, attr };
    }
    g.instanceCount = 0;
    this.geometry = g;
    this.capacity = capacity;
    this.slots = [];
    this.dirty = false;
    this.name = name;
    this.mesh = null;
  }

  makeMesh(material) {
    const m = new Mesh(this.geometry, material);
    m.name = `fx:${this.name}`;
    m.frustumCulled = false; // positions are computed in the vertex shader
    m.matrixAutoUpdate = false;
    m.renderOrder = 10;
    this.mesh = m;
    return m;
  }

  get count() { return this.slots.length; }

  alloc() {
    if (this.slots.length >= this.capacity) return null;
    const slot = { i: this.slots.length };
    this.slots.push(slot);
    this.dirty = true;
    return slot;
  }

  free(slot) {
    if (!slot || slot.i < 0) return;
    const last = this.slots.length - 1;
    const i = slot.i;
    if (i !== last) {
      const moved = this.slots[last];
      for (const { arr, size } of Object.values(this.arrays)) {
        arr.copyWithin(i * size, last * size, last * size + size);
      }
      moved.i = i;
      this.slots[i] = moved;
    }
    this.slots.pop();
    slot.i = -1;
    this.dirty = true;
  }

  set(slot, name, a, b, c, d) {
    if (!slot || slot.i < 0) return;
    const { arr, size } = this.arrays[name];
    const o = slot.i * size;
    arr[o] = a;
    if (size > 1) arr[o + 1] = b;
    if (size > 2) arr[o + 2] = c;
    if (size > 3) arr[o + 3] = d;
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    const n = this.slots.length;
    for (const { attr, size } of Object.values(this.arrays)) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, Math.max(1, n * size));
      attr.needsUpdate = true;
    }
    this.geometry.instanceCount = n;
    if (this.mesh) this.mesh.visible = n > 0;
    this.dirty = false;
  }

  dispose() { this.geometry.dispose(); }
}
