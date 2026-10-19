// Tiered frame pipeline.
//   low      : direct render with renderer tone mapping; FX drawn as a second depth-tested scene. No post.
//   medium+  : post.js (loaded on demand): HDR composer, AO (high+), FX after AO, bloom, grade, SMAA.
// Exposure (env.exposure) is applied at tone mapping in both paths.
import { NoToneMapping, AgXToneMapping, ACESFilmicToneMapping, NeutralToneMapping, CustomToneMapping } from 'three';
import { installGradeChunk } from './tonemap.js';
import { exposure } from './env-link.js';

installGradeChunk();

/** Tone-mapping operators compared for gold / white marble / firelight (see docs/decisions/render.md). */
export const TONE_MAPPERS = {
  agx: { three: AgXToneMapping, post: 'AGX' },
  aces: { three: ACESFilmicToneMapping, post: 'ACES_FILMIC' },
  neutral: { three: NeutralToneMapping, post: 'NEUTRAL' },
  agxl: { three: CustomToneMapping, post: 'grade' }, // AgX + mild punchy look (tonemap.js) — default
};
export const DEFAULT_TONE_MAPPER = 'agxl';

/**
 * Exposure parity: env's exposure is tuned against three's ACESFilmic. These gains make 18 % grey land on
 * the same display value (sRGB ≈ 0.50) with each operator (solved numerically from the curves).
 */
export const TM_GAIN = { agx: 0.99, aces: 1.0, neutral: 1.41, agxl: 1.15 };


export class Pipeline {
  constructor(ctx, fx) {
    this.ctx = ctx;
    this.fx = fx;
    this.post = null;
    this.mode = 'direct';
    this.exposureTotal = 1;
    const req = ctx.params?.raw?.get?.('tm');
    this.toneMapper = TONE_MAPPERS[req] ? req : DEFAULT_TONE_MAPPER;
  }

  get composer() { return this.post?.composer || null; }

  async build(quality) {
    const r = this.ctx.renderer;
    const tm = TONE_MAPPERS[this.toneMapper];
    let next = null;
    if (quality.post) {
      const { buildPost } = await import('./post.js');
      next = buildPost(this.ctx, this.fx, quality, tm.post);
    }
    this.dispose();
    this.quality = quality;
    if (next) {
      this.mode = 'post';
      r.toneMapping = NoToneMapping;
      this.post = next;
    } else {
      this.mode = 'direct';
      r.toneMapping = tm.three;
      r.autoClear = true;
    }
  }

  updateFrame() {
    const ctx = this.ctx;
    const ex = exposure(ctx) * (TM_GAIN[this.toneMapper] ?? 1);
    this.exposureTotal = ex;
    ctx.renderer.toneMappingExposure = ex;
    this.post?.update(ex);
  }

  render(dt) {
    if (this.post) { this.post.render(dt); return; }
    const { renderer: r, scene, camera } = this.ctx;
    r.autoClear = true;
    r.render(scene, camera);
    r.autoClear = false;
    r.render(this.fx.scene, camera);
    r.autoClear = true;
  }

  setSize(w, h) { this.post?.setSize(w, h); }

  dispose() {
    this.post?.dispose();
    this.post = null;
  }
}
