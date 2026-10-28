// FXAA for the direct (no post) path — quality.aa 'fxaa' (low; lowend-visuals).
//
// The direct path draws the world with three's in-shader tone mapping straight into the canvas. Drawing it into a render
// target instead would re-key every lit program (three compiles render-target programs without tone mapping or output
// colour conversion): a full second set of 1–2.5 s compiles on ANGLE/D3D11. So the finished frame is copied out of the
// canvas (copyTexSubImage2D: the display-referred sRGB values, which is what FXAA's luma wants) and one full-screen
// triangle draws the filtered image back over it. The pass is a few hundred bytes of GLSL, compiled with the pipeline.
//
// The filter (after NVIDIA's FXAA 3.11 as Jasper Flick's tutorial restates it): local contrast from the 4 neighbours exits
// early on flat pixels (most of a frame); edge pixels read the diagonals for the sub-pixel blend and the edge direction,
// then walk the edge up to 6 steps each way and shift the sample across it.
import {
  FramebufferTexture, LinearFilter, Mesh, OrthographicCamera, Scene, ShaderMaterial, BufferGeometry, Float32BufferAttribute, Vector2,
} from 'three';

const vertexShader = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`;

const fragmentShader = /* glsl */`
uniform sampler2D tColor;
uniform vec2 uTexel;
varying vec2 vUv;
float lumaAt( vec2 uv ) { return dot( texture2D( tColor, uv ).rgb, vec3( 0.299, 0.587, 0.114 ) ); }
void main() {
  vec4 c = texture2D( tColor, vUv );
  float m = dot( c.rgb, vec3( 0.299, 0.587, 0.114 ) );
  float n = lumaAt( vUv + vec2( 0.0, uTexel.y ) ), s = lumaAt( vUv - vec2( 0.0, uTexel.y ) );
  float e = lumaAt( vUv + vec2( uTexel.x, 0.0 ) ), w = lumaAt( vUv - vec2( uTexel.x, 0.0 ) );
  float hi = max( max( max( n, s ), max( e, w ) ), m ), lo = min( min( min( n, s ), min( e, w ) ), m );
  float range = hi - lo;
  // flat: contrast under the absolute (0.0312) or the relative (0.125 of the brightest) threshold
  if ( range < max( 0.0312, 0.125 * hi ) ) { gl_FragColor = c; return; }
  float ne = lumaAt( vUv + uTexel ), nw = lumaAt( vUv + vec2( - uTexel.x, uTexel.y ) );
  float se = lumaAt( vUv + vec2( uTexel.x, - uTexel.y ) ), sw = lumaAt( vUv - uTexel );
  // sub-pixel blend factor
  float f = abs( ( 2.0 * ( n + s + e + w ) + ne + nw + se + sw ) / 12.0 - m ) / range;
  f = smoothstep( 0.0, 1.0, clamp( f, 0.0, 1.0 ) );
  f = f * f * 0.75;
  // edge orientation
  float hz = abs( n + s - 2.0 * m ) * 2.0 + abs( ne + se - 2.0 * e ) + abs( nw + sw - 2.0 * w );
  float vt = abs( e + w - 2.0 * m ) * 2.0 + abs( ne + nw - 2.0 * n ) + abs( se + sw - 2.0 * s );
  bool horz = hz >= vt;
  float pl = horz ? n : e, nl = horz ? s : w;
  float pg = abs( pl - m ), ng = abs( nl - m );
  float stp = horz ? uTexel.y : uTexel.x;
  float gradient, opp;
  if ( pg < ng ) { stp = - stp; opp = nl; gradient = ng; } else { opp = pl; gradient = pg; }
  vec2 uvEdge = vUv;
  if ( horz ) uvEdge.y += stp * 0.5; else uvEdge.x += stp * 0.5;
  vec2 dir = horz ? vec2( uTexel.x, 0.0 ) : vec2( 0.0, uTexel.y );
  float edgeL = ( m + opp ) * 0.5, thr = gradient * 0.25;
  // walk the edge both ways
  vec2 pu = uvEdge + dir, nu = uvEdge - dir;
  float pd = lumaAt( pu ) - edgeL, nd = lumaAt( nu ) - edgeL;
  bool pEnd = abs( pd ) >= thr, nEnd = abs( nd ) >= thr;
  for ( int i = 0; i < 6; i ++ ) {
    float k = i < 2 ? 1.5 : i < 4 ? 2.0 : 4.0;
    if ( ! pEnd ) { pu += dir * k; pd = lumaAt( pu ) - edgeL; pEnd = abs( pd ) >= thr; }
    if ( ! nEnd ) { nu -= dir * k; nd = lumaAt( nu ) - edgeL; nEnd = abs( nd ) >= thr; }
    if ( pEnd && nEnd ) break;
  }
  float pdist = horz ? pu.x - vUv.x : pu.y - vUv.y, ndist = horz ? vUv.x - nu.x : vUv.y - nu.y;
  bool nearPos = pdist <= ndist;
  float dEnd = nearPos ? pdist : ndist, dEndDelta = nearPos ? pd : nd;
  float edgeBlend = ( dEndDelta >= 0.0 ) == ( m - edgeL >= 0.0 ) ? 0.0 : 0.5 - dEnd / ( pdist + ndist );
  float b = max( f, edgeBlend );
  vec2 uv = vUv;
  if ( horz ) uv.y += stp * b; else uv.x += stp * b;
  gl_FragColor = vec4( texture2D( tColor, uv ).rgb, c.a );
}`;

export class FxaaPass {
  constructor() {
    this.tex = null;
    this.size = new Vector2();
    this.geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.material = new ShaderMaterial({
      name: 'render:fxaa',
      uniforms: { tColor: { value: null }, uTexel: { value: new Vector2(1, 1) } },
      vertexShader, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene = new Scene();
    this.scene.add(this.mesh);
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.enabled = true;
  }

  /** after the frame is drawn into the canvas (the renderer's target is the canvas): filter it in place */
  render(renderer) {
    if (!this.enabled) return;
    const db = renderer.getDrawingBufferSize(this.size);
    if (!this.tex || this.tex.image.width !== db.x || this.tex.image.height !== db.y) {
      this.tex?.dispose();
      this.tex = new FramebufferTexture(db.x, db.y);
      this.tex.minFilter = this.tex.magFilter = LinearFilter;
      this.tex.generateMipmaps = false;
      this.tex.name = 'render:fxaa-input';
      this.material.uniforms.tColor.value = this.tex;
      this.material.uniforms.uTexel.value.set(1 / db.x, 1 / db.y);
    }
    renderer.copyFramebufferToTexture(this.tex);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    try { renderer.render(this.scene, this.camera); } finally { renderer.autoClear = ac; }
  }

  dispose() {
    this.tex?.dispose();
    this.tex = null;
    this.material.dispose();
    this.geometry.dispose();
  }
}
