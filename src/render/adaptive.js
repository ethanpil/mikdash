// Adaptive render resolution: scales the drawing buffer between MIN and 1.0 (× the tier's base pixel
// ratio) to hold the target frame rate. Steps of 0.1 with hysteresis so it never thrashes:
//   * down a step after the smoothed fps stays below 90 % of target for 1.5 s
//   * up a step only after fps sits at the vsync ceiling (or ≥ 125 % of target) for 4 s
//   * a scale that failed (dropped back within 5 s of an increase) becomes a ceiling for 30 s
//   * 2 s cooldown after any change; hitches (>250 ms frames, tab switches) are ignored
// Disabled in shot mode so screenshots are deterministic.
const STEP = 0.1;
export const MIN_SCALE = 0.5;

export class AdaptiveResolution {
  constructor({ target = 55, enabled = true, onChange }) {
    this.target = target;
    this.enabled = enabled;
    this.onChange = onChange;
    this.scale = 1;
    this.fps = target;
    this.ms = 1000 / target;
    this.low = 0;
    this.high = 0;
    this.cool = 1.5;
    this.ceiling = 1;
    this.ceilingT = 0;
    this.lastUp = -1e9;
    this.t = 0;
  }

  /** dt in seconds (unclamped real frame time preferred). */
  sample(dt) {
    this.t += dt;
    if (!(dt > 0) || dt > 0.25) return; // hitch / hidden tab: ignore
    const a = 1 - Math.exp(-dt / 0.5);    // ~0.5 s time constant
    this.ms += (dt * 1000 - this.ms) * a;
    this.fps = 1000 / this.ms;
    if (!this.enabled) return;
    if (this.cool > 0) { this.cool -= dt; return; }
    if (this.ceilingT > 0) { this.ceilingT -= dt; if (this.ceilingT <= 0) this.ceiling = 1; }
    const t = this.target;
    const upFps = Math.min(t * 1.25, 57.5);
    if (this.fps < t * 0.9) { this.low += dt; this.high = 0; } else if (this.fps >= upFps) { this.high += dt; this.low = 0; } else { this.low = 0; this.high = 0; }
    if (this.low > 1.5 && this.scale > MIN_SCALE + 1e-6) {
      if (this.t - this.lastUp < 5) { this.ceiling = this.scale - STEP; this.ceilingT = 30; }
      this.set(this.scale - STEP);
    } else if (this.high > 4 && this.scale < Math.min(1, this.ceiling) - 1e-6) {
      this.lastUp = this.t;
      this.set(this.scale + STEP);
    }
  }

  set(s) {
    const v = Math.round(Math.min(1, Math.max(MIN_SCALE, s)) * 10) / 10;
    this.low = 0;
    this.high = 0;
    this.cool = 2;
    if (v === this.scale) return;
    this.scale = v;
    this.onChange?.(v);
  }
}
