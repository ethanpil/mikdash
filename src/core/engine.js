// Engine: renderer, scene, camera, and the frame loop.
// Subsystems register per-frame work with engine.onUpdate(fn, priority). Lower priority runs first.
// The render/ subsystem may replace the final draw with engine.setRenderFn(fn).
import {
  WebGLRenderer, Scene, PerspectiveCamera, Timer, SRGBColorSpace, ACESFilmicToneMapping,
  PCFShadowMap,
} from 'three';

export const PRIORITY = {
  time: 0, sim: 10, people: 20, player: 30, env: 40, fx: 50, audio: 60, ui: 70, render: 100,
};

export class Engine {
  constructor(canvas, params) {
    this.canvas = canvas;
    this.params = params;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false, // AA is handled by the post pipeline per tier
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!params.shot,
      stencil: false,
      logarithmicDepthBuffer: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = PCFShadowMap; // PCFSoftShadowMap was removed in r186
    // perf-fix-2: no shader-error checks in the production bundle (`?shadercheck=1` turns them back on): three's check
    // reads the program and both shader info logs at each program's first use, three synchronous queries to the GPU
    // process (a failed generator bake still falls back: world/materials/gen/baker.js checks the link status itself)
    this.renderer.debug.checkShaderErrors = !import.meta.env?.PROD || !!params.raw?.has?.('shadercheck');

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(params.fov || 62, 1, 0.08, 9000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.timer = new Timer();
    this.updaters = [];
    this.renderFn = () => this.renderer.render(this.scene, this.camera);
    this.frame = 0;
    // false while the boot warms shaders up: updaters run, nothing is drawn (perf-1, render/warmup.js)
    this.drawing = true;
    this.lost = false; // the WebGL context was lost: the loop stays stopped (main.js reloads the page)
    this.fps = 60;
    this.running = false;
    this.pixelRatio = 1;

    this._onResize = () => this.resize();
    globalThis.addEventListener?.('resize', this._onResize);
  }

  /** Apply the quality tier's pixel ratio and size the drawing buffer. */
  configure(quality) {
    this.quality = quality;
    this.renderer.shadowMap.enabled = !!quality.shadows;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || globalThis.innerWidth;
    const h = this.canvas.clientHeight || globalThis.innerHeight;
    const q = this.quality || { pixelRatioCap: 1, renderScale: 1 };
    this.pixelRatio = Math.min(globalThis.devicePixelRatio || 1, q.pixelRatioCap) * (q.renderScale || 1);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this.resizeListeners || []) fn(w, h, this.pixelRatio);
  }

  onResize(fn) { (this.resizeListeners ||= []).push(fn); }

  /** fn(dt_seconds, ctx). Returns an unregister function. */
  onUpdate(fn, priority = 50) {
    const entry = { fn, priority };
    this.updaters.push(entry);
    this.updaters.sort((a, b) => a.priority - b.priority);
    return () => { this.updaters = this.updaters.filter((e) => e !== entry); };
  }

  setRenderFn(fn) { this.renderFn = fn; }

  start(ctx) {
    this.ctx = ctx;
    if (this.lost) return; // gate-core: the graphics context is gone; the page reloads (main.js)
    this.running = true;
    this.timer.reset?.();
    this.renderer.setAnimationLoop((ts) => this.tick(ts));
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  tick(ts) {
    this.timer.update(ts);
    const dt = Math.max(0, Math.min(this.timer.getDelta(), 0.1)); // Timer can return a negative first delta
    this.fps = this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    for (const u of this.updaters) {
      try { u.fn(dt, this.ctx); } catch (e) {
        if (!u.failed) console.error('[engine] updater failed', e);
        u.failed = true;
      }
    }
    if (this.drawing) this.renderFn(dt);
    this.frame++;
  }
}
