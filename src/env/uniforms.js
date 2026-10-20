// Shader data that lives in a GLOBAL shader-chunk patch (not in any material's `uniforms`): a std140 uniform
// block (UBO) owned by env, shared by every program that declares it.
//
// Why a block and not plain uniforms: ANGLE/D3D11 re-uploads a program's whole default uniform block whenever any
// of its uniforms changes — and three sets per-object matrices on every draw — so ~1.8 KB of extra plain uniforms
// made EVERY draw call upload them again: +15 ms a frame on the HD 4600 at low. A uniform block is its own
// constant buffer, written once when the data changes (lighting-polish profiling).
//
// Binding: the block is bound to the LAST binding point (each program is pointed there once) and also to binding
// point 0, the default of a block in a program that was linked this frame (three only allocates binding points
// for material.uniformsGroups, which nothing here uses) — so no draw ever sees an unbound block.
export class UniformBlock {
  /**
   * @param {WebGLRenderer} renderer
   * @param {string} name block name in GLSL
   * @param {Array<[string, number]>} layout member name → number of vec4 (std140: vec4 arrays are tightly packed)
   */
  constructor(renderer, name, layout) {
    this.renderer = renderer;
    this.name = name;
    const gl = (this.gl = renderer.getContext());
    this.offsets = {};
    let n = 0;
    for (const [k, count] of layout) { this.offsets[k] = { at: n * 4, len: count * 4 }; n += count; }
    this.data = new Float32Array(n * 4);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    this.binding = Math.max(1, gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS) - 1);
    this.dirty = true;
    this.seen = new WeakSet();
    this.lastCount = -1;
    this.lastProgram = null;
    this.uploads = 0;
  }

  /** a view of the named member's floats (live: writes go to the block on the next apply) */
  view(name) { const o = this.offsets[name]; return this.data.subarray(o.at, o.at + o.len); }

  /** copy into a member; true when anything changed */
  set(name, arr) {
    const o = this.offsets[name];
    const d = this.data;
    const n = Math.min(o.len, arr.length);
    let changed = false;
    for (let i = 0; i < n; i++) if (d[o.at + i] !== arr[i]) { changed = true; break; }
    if (!changed) return false;
    for (let i = 0; i < n; i++) d[o.at + i] = arr[i];
    this.dirty = true;
    return true;
  }

  /** copy unsigned ints into a member (a uvec4 array in GLSL); true when anything changed */
  setU32(name, arr) {
    const o = this.offsets[name];
    const u = this.u32 || (this.u32 = new Uint32Array(this.data.buffer));
    const n = Math.min(o.len, arr.length);
    let changed = false;
    for (let i = 0; i < n; i++) if (u[o.at + i] !== arr[i] >>> 0) { u[o.at + i] = arr[i] >>> 0; changed = true; }
    if (changed) this.dirty = true;
    return changed;
  }

  /** bind new programs, keep the buffer bound, upload when changed (call before drawing) */
  apply() {
    const gl = this.gl;
    const programs = this.renderer.info.programs;
    if (programs && (programs.length !== this.lastCount || programs[programs.length - 1] !== this.lastProgram)) {
      let pending = false;
      for (const p of programs) {
        if (this.seen.has(p)) continue;
        if (typeof p.isReady === 'function' && !p.isReady()) { pending = true; continue; }
        const idx = gl.getUniformBlockIndex(p.program, this.name);
        if (idx !== gl.INVALID_INDEX) gl.uniformBlockBinding(p.program, idx, this.binding);
        this.seen.add(p);
      }
      this.lastCount = pending ? -1 : programs.length;
      this.lastProgram = programs[programs.length - 1];
    }
    gl.bindBufferBase(gl.UNIFORM_BUFFER, this.binding, this.buffer);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.buffer);
    if (this.dirty) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.data);
      gl.bindBuffer(gl.UNIFORM_BUFFER, null);
      this.dirty = false;
      this.uploads++;
    }
  }

  dispose() { this.gl.deleteBuffer(this.buffer); }
}
