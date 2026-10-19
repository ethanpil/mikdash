// Draws the FX scene (flames, glow, embers, smoke) into the composer's current buffer AFTER ambient
// occlusion, depth-testing in the shader against the composer's stable scene-depth texture
// (soft intersections, and AO never darkens a flame).
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
    renderer.render(this.scene, this.camera);
  }

  dispose() { /* fx owns its scene and materials */ }
}
