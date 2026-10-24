// Draws the FX scene (flames, glow, embers, smoke) into the composer's current buffer AFTER ambient
// occlusion, depth-testing in the shader against the composer's stable scene-depth texture
// (soft intersections, and AO never darkens a flame).
//
// qa-r2-fix-env-render: the buffer's alpha is reset to 1 first, so that after this pass it holds the emitter mask the FX
// materials write (fx/materials.js setBlend: 1 − the flames', embers' and glows' coverage) — the world's own alpha
// (alpha-tested leaves, transparent materials) would otherwise read as emitters. One colour-masked clear.
import { Pass } from 'postprocessing';

export class FXPass extends Pass {
  constructor(fx, camera) {
    super('FXPass', fx.scene, camera);
    this.fx = fx;
    this.needsSwap = false;
    this.needsDepthTexture = true;
    this.depthTexture = null;
  }

  setDepthTexture(depthTexture) { this.depthTexture = depthTexture; }

  getDepthTexture() { return this.depthTexture; }

  render(renderer, inputBuffer) {
    if (!this.depthTexture) return;
    this.fx.setDepth(this.depthTexture, inputBuffer.width, inputBuffer.height, this.camera);
    renderer.setRenderTarget(this.renderToScreen ? null : inputBuffer);
    if (!this.renderToScreen) {
      const gl = renderer.getContext(), color = renderer.state.buffers.color;
      color.setMask(true); // three's cached mask now matches what is restored below
      color.setClear(0, 0, 0, 1);
      gl.colorMask(false, false, false, true);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.colorMask(true, true, true, true);
    }
    renderer.render(this.scene, this.camera);
  }

  dispose() { /* fx owns its scene and materials */ }
}
