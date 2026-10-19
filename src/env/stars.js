// Stars and planets as GPU points on the celestial sphere, rotated by local sidereal time.
// Bright stars (V < ~3.7) are the REAL stars (J2000 positions, V magnitude, B-V colour) so constellations are
// where they belong; the faint background (to V≈6.5) is procedural, denser toward the galactic plane.
// Brightness is perceptual: each star's contrast over the sky behind it follows its magnitude (extinguished by
// the air mass) relative to the naked-eye limiting magnitude for that sky luminance, so stars fade in at dusk and
// out at dawn as they do for the eye, and Venus/Jupiter show in twilight even though a pixel is 4' wide.
import {
  Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial, AdditiveBlending, Matrix3, Vector3,
} from 'three';
import { NIGHT_FLOOR_GLSL } from './atmosphere.js';

// [RA hours, Dec deg, V mag, B-V] — J2000.
const BRIGHT = [
  [6.7525, -16.716, -1.46, 0.00], [6.3992, -52.696, -0.74, 0.15], [14.2610, 19.182, -0.05, 1.23],
  [14.6600, -60.834, -0.27, 0.71], [18.6156, 38.784, 0.03, 0.00], [5.2782, 45.998, 0.08, 0.80],
  [5.2423, -8.202, 0.13, -0.03], [7.6550, 5.225, 0.34, 0.42], [1.6286, -57.237, 0.46, -0.16],
  [5.9195, 7.407, 0.50, 1.85], [14.0637, -60.373, 0.61, -0.23], [19.8464, 8.868, 0.76, 0.22],
  [12.4433, -63.099, 0.77, -0.24], [4.5987, 16.509, 0.86, 1.54], [16.4901, -26.432, 0.96, 1.83],
  [13.4199, -11.161, 0.97, -0.23], [7.7553, 28.026, 1.14, 1.00], [22.9608, -29.622, 1.16, 0.09],
  [20.6905, 45.280, 1.25, 0.09], [12.7953, -59.689, 1.25, -0.23], [10.1395, 11.967, 1.35, -0.11],
  [6.9771, -28.972, 1.50, -0.21], [7.5767, 31.888, 1.58, 0.03], [12.5194, -57.113, 1.63, 1.60],
  [17.5601, -37.104, 1.62, -0.22], [5.4189, 6.350, 1.64, -0.22], [5.4382, 28.608, 1.65, -0.13],
  [9.2200, -69.717, 1.68, 0.07], [5.6036, -1.202, 1.69, -0.18], [22.1372, -46.961, 1.74, -0.07],
  [5.6793, -1.943, 1.77, -0.21], [12.9005, 55.960, 1.77, -0.02], [11.0621, 61.751, 1.79, 1.07],
  [3.4054, 49.861, 1.79, 0.48], [7.1399, -26.393, 1.84, 0.68], [17.6220, -42.998, 1.86, 0.40],
  [18.4029, -34.385, 1.85, -0.03], [8.3752, -59.510, 1.86, 1.28], [13.7923, 49.313, 1.86, -0.19],
  [5.9921, 44.948, 1.90, 0.08], [16.8111, -69.028, 1.91, 1.44], [6.6285, 16.399, 1.93, 0.00],
  [20.4275, -56.735, 1.94, -0.20], [8.7451, -54.709, 1.96, 0.04], [6.3783, -17.956, 1.98, -0.23],
  [9.4598, -8.659, 1.98, 1.44], [2.5303, 89.264, 1.98, 0.60], [2.1196, 23.462, 2.00, 1.15],
  [10.3328, 19.842, 2.01, 1.13], [0.7265, -17.987, 2.02, 1.02], [18.9211, -26.297, 2.05, -0.13],
  [14.1114, -36.370, 2.06, 1.01], [0.1398, 29.090, 2.06, -0.11], [1.1622, 35.621, 2.05, 1.58],
  [5.7959, -9.670, 2.09, -0.17], [14.8451, 74.156, 2.08, 1.47], [17.5822, 12.560, 2.08, 0.15],
  [3.1361, 40.956, 2.12, -0.05], [2.0650, 42.330, 2.10, 1.37], [11.8177, 14.572, 2.14, 0.09],
  [12.6920, -48.960, 2.17, -0.01], [8.0598, -40.003, 2.21, -0.27], [9.2848, -59.275, 2.21, 0.18],
  [15.5781, 26.715, 2.22, -0.02], [9.1333, -43.433, 2.21, 1.66], [13.3988, 54.925, 2.23, 0.02],
  [20.3705, 40.257, 2.23, 0.67], [0.6751, 56.537, 2.24, 1.17], [17.9434, 51.489, 2.24, 1.52],
  [5.5334, -0.299, 2.23, -0.22], [0.1529, 59.150, 2.28, 0.34], [16.0056, -22.622, 2.29, -0.12],
  [16.8361, -34.293, 2.29, 1.15], [13.6648, -53.466, 2.30, -0.22], [14.6988, -47.388, 2.30, -0.15],
  [11.0307, 56.382, 2.37, -0.02], [14.7498, 27.074, 2.37, 0.97], [21.7364, 9.875, 2.39, 1.53],
  [0.4381, -42.306, 2.40, 1.09], [11.8972, 53.695, 2.44, 0.04], [17.1730, -15.725, 2.43, 0.06],
  [23.0629, 28.083, 2.42, 1.67], [21.3097, 62.586, 2.45, 0.26], [7.4016, -29.303, 2.45, -0.08],
  [23.0793, 15.205, 2.48, -0.04], [0.9451, 60.717, 2.47, -0.15], [3.0380, 4.090, 2.54, 1.64],
  [11.2351, 20.524, 2.56, 0.12], [5.5455, -17.822, 2.58, 0.21], [12.2634, -17.542, 2.59, -0.11],
  [15.2834, -9.383, 2.61, -0.07], [14.8480, -16.042, 2.75, 0.15], [15.7378, 6.426, 2.63, 1.17],
  [1.4302, 60.235, 2.68, 0.13], [0.2206, 15.184, 2.83, -0.23], [12.2571, 57.033, 3.31, 0.08],
  [3.7914, 24.105, 2.87, -0.09], [3.8193, 24.054, 3.62, -0.07], [3.7479, 24.113, 3.70, -0.11],
  [3.7636, 24.368, 3.87, -0.07], [3.7720, 23.948, 4.18, -0.06], [3.7535, 24.467, 4.30, -0.11],
  [19.7710, 10.613, 2.72, 1.52], [19.5120, 27.960, 3.05, 1.13], [20.7702, 33.970, 2.48, 1.03],
  [19.7496, 45.131, 2.87, -0.03], [13.0363, 10.959, 2.83, 0.94], [12.6943, -1.449, 2.74, 0.36],
  [12.4977, -16.515, 2.94, -0.05], [12.5734, -23.397, 2.65, 0.89], [12.1688, -22.620, 3.00, 1.33],
  [12.9338, 38.318, 2.89, -0.12], [13.9114, 18.398, 2.68, 0.58], [14.5347, 38.308, 3.03, 0.19],
  [15.0324, 40.390, 3.49, 0.96], [17.5072, 52.301, 2.79, 0.98], [14.0731, 64.376, 3.65, -0.05],
  [16.5037, 21.490, 2.78, 0.94], [17.2441, 14.390, 3.10, 1.44], [16.6881, 31.603, 2.81, 0.65],
  [18.8347, 33.363, 3.52, 0.00], [18.9824, 32.690, 3.25, -0.05], [21.7840, -16.127, 2.85, 0.29],
  [21.5260, -5.571, 2.90, 0.83], [22.0964, -0.320, 2.95, 0.98], [20.3502, -14.781, 3.08, 0.79],
  [4.4776, 15.871, 3.40, 0.18], [4.4769, 19.180, 3.53, 1.01], [4.3299, 15.628, 3.65, 0.99],
  [4.3823, 17.543, 3.76, 0.98], [5.5856, 9.934, 3.39, -0.16], [5.5903, -5.910, 2.77, -0.24],
  [4.8302, 6.961, 3.19, 0.45], [6.3386, -30.063, 3.02, -0.16], [7.0503, -23.833, 3.02, -0.08],
  [6.3827, 22.514, 2.88, 1.64], [6.7322, 25.131, 2.98, 1.40], [6.2479, 22.507, 3.31, 1.60],
  [7.3354, 21.982, 3.53, 0.34], [10.2782, 23.417, 3.43, 0.31], [9.7642, 23.774, 2.98, 0.80],
  [11.2373, 15.430, 3.33, -0.01], [10.1222, 16.763, 3.48, -0.03], [9.8794, 26.007, 3.88, 1.22],
  [4.9498, 33.166, 2.69, 1.53], [5.9954, 37.213, 2.62, -0.08], [5.0328, 43.823, 2.99, 0.54],
  [5.1086, 41.234, 3.17, -0.18], [3.9642, 40.010, 2.88, -0.20], [3.9022, 31.884, 2.85, 0.12],
  [3.7154, 47.788, 3.01, -0.13], [3.0799, 53.506, 2.93, 0.70], [1.9066, 63.670, 3.38, -0.15],
  [2.1590, 34.987, 3.00, 0.14], [1.9107, 20.808, 2.64, 0.13], [1.1431, -10.182, 3.45, 1.16],
  [0.3236, -8.824, 3.56, 1.22], [1.7344, -15.937, 3.50, 0.72], [1.8577, -10.335, 3.73, 1.14],
  [5.1308, -5.086, 2.79, 0.13], [3.9672, -13.509, 2.95, 1.59], [2.9710, -40.305, 2.88, 0.14],
  [5.6608, -34.074, 2.65, -0.12], [5.8492, -35.768, 3.12, 1.16], [7.2857, -37.097, 2.70, 1.62],
  [8.1258, -24.304, 2.78, 0.43], [5.4709, -20.759, 2.84, 0.82], [22.6910, 10.831, 3.40, -0.09],
  [22.7167, 30.221, 2.94, 0.86], [0.6555, 30.861, 3.27, 1.28], [19.4249, 3.115, 3.36, 0.32],
  [19.0902, 13.863, 2.99, 0.01], [20.1884, -0.821, 3.23, -0.07], [16.5980, -28.216, 2.82, -0.25],
  [16.0906, -19.806, 2.62, -0.07], [15.9809, -26.114, 2.89, -0.19], [16.3531, -25.593, 2.89, 0.13],
  [17.7081, -39.030, 2.39, -0.17], [17.7930, -40.127, 2.99, 0.51], [16.8645, -38.047, 3.08, -0.20],
  [17.2025, -43.239, 3.32, 0.41], [18.3499, -29.828, 2.70, 1.38], [18.4662, -25.422, 2.81, 1.04],
  [19.0435, -29.880, 2.60, 0.08], [18.7609, -26.991, 3.17, -0.11], [19.1157, -27.671, 3.32, 1.19],
  [18.0968, -30.424, 2.98, 1.00], [16.6193, -10.567, 2.56, 0.04], [16.2391, -3.694, 2.73, 1.58],
  [17.7245, 4.567, 2.76, 1.17], [16.9612, 9.375, 3.20, 1.15], [16.3053, -4.693, 3.24, 0.96],
  [8.9868, 48.042, 3.14, 0.19], [9.5475, 51.677, 3.17, 0.46], [10.3720, 41.499, 3.06, 1.59],
  [11.1610, 44.498, 3.01, 1.14], [11.3080, 33.094, 3.48, 1.40], [15.3455, 71.834, 3.00, 0.05],
  [16.7662, 82.037, 4.21, 0.89], [17.5369, 86.586, 4.35, 0.02], [15.7343, 77.795, 4.32, 0.04],
  [16.2918, 75.755, 4.95, 0.37], [16.3999, 61.514, 2.74, 0.91], [17.1464, 65.715, 3.17, -0.12],
  [15.4155, 58.966, 3.29, 1.16], [19.2093, 67.662, 3.07, 1.00], [17.8921, 56.873, 3.75, 1.18],
  [21.4777, 70.561, 3.23, -0.22], [23.6558, 77.632, 3.21, 1.03], [22.1809, 58.201, 3.35, 1.57],
  [17.2508, 36.809, 3.16, 1.44], [16.7149, 38.922, 3.48, 0.92], [17.2505, 24.839, 3.14, 0.08],
  [17.7745, 27.720, 3.42, 0.75], [15.2582, 33.315, 3.47, 0.95], [22.9108, -15.821, 3.27, 0.07],
  [21.6682, -16.662, 3.69, 0.32], [22.7111, -46.885, 2.15, 1.60], [7.4525, 8.289, 2.90, -0.09],
  [19.9219, 6.407, 3.71, 0.86], [5.4078, -2.397, 3.35, -0.24], [2.7217, 3.236, 3.47, 0.09],
  [1.5248, 15.346, 3.62, 0.97], [2.8330, 27.260, 3.63, -0.10], [1.8847, 29.579, 3.41, 0.49],
  [9.3509, 34.393, 3.13, 1.55], [6.7548, 12.896, 3.35, 0.43],
];

const PLANET_COLOR = {
  mercury: [1.0, 0.92, 0.82], venus: [1.0, 0.98, 0.92], mars: [1.0, 0.68, 0.48],
  jupiter: [1.0, 0.95, 0.86], saturn: [1.0, 0.92, 0.74],
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** B-V -> linear RGB (luminance 1): Ballesteros temperature, Planck at 610/550/465 nm relative to 6500 K. */
function bvToRGB(bv) {
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const planck = (lnm, t) => { const l = lnm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4388e-2 / (l * t)) - 1)); };
  const c = [610, 550, 465].map((l) => planck(l, T) / planck(l, 6500));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // the eye sees little colour in point sources: keep ~55% of the saturation
  return c.map((v) => 1 + (v / L - 1) * 0.55);
}

// equatorial (J2000) -> galactic rotation
export const EQ_TO_GAL = new Matrix3().set(
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.4448296300, 0.7469822445,
  -0.8676661490, -0.1980763734, 0.4559837762,
);

function eqVector(raDeg, decDeg) {
  const a = raDeg * Math.PI / 180, d = decDeg * Math.PI / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

const STAR_VERT = /* glsl */`
#define RG 6360.0
attribute float aMag;
attribute vec3 aColor;
attribute float aSeed;
uniform mat3 uCelestial;
uniform sampler2D uSkyLUT;   // sky-view LUT: the background each star must be seen against
uniform float uLutPhys;      // LUT -> cd/m²
uniform float uObsR;
uniform float uBgFloor;      // night-sky floor scale (cd/m², × nightFloorShape: the dome's exact floor)
uniform float uOut;          // preExposure
uniform vec3 uTau;           // zenith optical depth
uniform float uTime;
uniform float uTwinkle;
uniform float uSizeScale;
uniform float uDynamic;      // 1: position is already a world direction (planets)
varying vec3 vColor;
${NIGHT_FLOOR_GLSL}
vec2 skyUV( vec3 dir ) {
  float horizon = - acos( clamp( RG / uObsR, -1.0, 1.0 ) );
  float el = asin( clamp( dir.y, -1.0, 1.0 ) );
  float v = el >= horizon
    ? 0.5 + 0.5 * sqrt( ( el - horizon ) / ( 1.5707963 - horizon ) )
    : 0.5 - 0.5 * sqrt( ( horizon - el ) / ( 1.5707963 + horizon ) );
  float az = ( abs( dir.x ) + abs( dir.z ) < 1e-6 ) ? 0.0 : atan( dir.x, - dir.z );
  return vec2( fract( az / 6.2831853 ), v );
}
void main() {
  vec3 dir = uDynamic > 0.5 ? position : uCelestial * position;
  float sAlt = dir.y;
  if ( sAlt < -0.03 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); gl_PointSize = 0.0; vColor = vec3( 0.0 ); return; }
  float zen = degrees( acos( clamp( sAlt, -1.0, 1.0 ) ) );
  float X = 1.0 / ( max( sAlt, 0.0 ) + 0.50572 * pow( max( 96.07995 - zen, 0.5 ), -1.6364 ) ); // Kasten-Young
  vec3 T = exp( - uTau * X );
  float Tl = max( dot( T, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-6 );
  // Perceptual visibility (as the eye sees a point source, not as a 4-arcmin pixel would average it):
  // naked-eye limiting magnitude from the local sky luminance, fitted to dark sky 6.5 @ 2e-4 cd/m²,
  // moonlit 4.3 @ 7e-3, first stars ~0.5 in civil twilight, Venus at the limit in daylight.
  float Lbg = dot( textureLod( uSkyLUT, skyUV( dir ), 0.0 ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) * uLutPhys
            + uBgFloor * nightFloorShape( sAlt, Tl );
  float mlim = 1.25 - 1.42 * log2( max( Lbg, 1e-7 ) ) * 0.30103;
  float m = aMag - 2.5 * log2( Tl ) * 0.30103;
  float tw = 1.0 + uTwinkle * ( 0.12 + 0.3 * min( X / 6.0, 1.0 ) ) * sin( uTime * ( 7.0 + 9.0 * aSeed ) + aSeed * 61.0 )
                 * sin( uTime * ( 3.1 + 5.0 * aSeed ) + aSeed * 17.0 );
  // contrast over the background: ~1 at the limiting magnitude (a faint but sure dot on a display),
  // x2.5 per magnitude brighter — a 2nd-magnitude star at night reads near white, Venus dazzles
  float c = exp2( -1.3287712 * ( m - mlim ) ) * tw;
  float size = clamp( 2.0 + 1.0 * log2( max( c, 1e-3 ) ) * 0.30103, 2.0, 6.0 ) * uSizeScale;
  vColor = aColor * ( T / Tl ) * Lbg * c * uOut;
  if ( c < 0.1 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); gl_PointSize = 0.0; return; }
  vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * dir, 1.0 );
  gl_Position = p.xyww;
  gl_PointSize = size;
}
`;

const STAR_FRAG = /* glsl */`
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float w = exp( - 2.0 * dot( c, c ) );
  gl_FragColor = vec4( min( vColor * w, vec3( 6.0e4 ) ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function starMaterial(shared) {
  return new ShaderMaterial({
    name: 'env.stars',
    uniforms: { ...shared, uDynamic: { value: 0 } },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
}

/** Star geometry: the real bright stars + `count` procedural faint stars to `magLimit` (deterministic per seed). */
function buildStarGeometry(count, magLimit, seed) {
  const rnd = mulberry32(seed);
  const pos = [], mag = [], col = [], sd = [];
  const push = (v, m, c) => { pos.push(...v); mag.push(m); col.push(...c); sd.push(rnd()); };
  for (const [ra, dec, v, bv] of BRIGHT) push(eqVector(ra * 15, dec), v, bvToRGB(bv));

  // procedural faint stars: V in [3.8, magLimit], N(<m) ∝ 10^(0.48 m), galactic-plane concentration
  const k = 0.48, m0 = 3.8, m1 = magLimit;
  const a0 = 10 ** (k * m0), a1 = 10 ** (k * m1);
  const galInv = EQ_TO_GAL.clone().transpose(); // galactic -> equatorial
  const tmp = new Vector3();
  let n = 0;
  while (n < count) {
    // uniform direction in galactic coordinates, accept by latitude density
    const z = rnd() * 2 - 1, phi = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const bAbs = Math.abs(Math.asin(z)) * 180 / Math.PI;
    if (rnd() > (1 + 2.2 * Math.exp(-bAbs / 12)) / 3.2) continue;
    tmp.set(r * Math.cos(phi), r * Math.sin(phi), z).applyMatrix3(galInv);
    const m = Math.log10(a0 + rnd() * (a1 - a0)) / k;
    const bv = Math.min(1.7, Math.max(-0.25, 0.55 + (rnd() + rnd() + rnd() - 1.5) * 0.7));
    push([tmp.x, tmp.y, tmp.z], m, bvToRGB(bv));
    n++;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aMag', new Float32BufferAttribute(mag, 1));
  g.setAttribute('aColor', new Float32BufferAttribute(col, 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(sd, 1));
  return g;
}

/**
 * Builds the star field (count procedural stars by tier) and the planets.
 * Returns { stars, planets, uniforms, setCelestial(lst, lat), updatePlanets(list), rebuild({count, magLimit}) }.
 */
export function createStarfield({ count = 3000, magLimit = 6.5, seed = 5786 } = {}) {
  const uniforms = {
    uCelestial: { value: new Matrix3() },
    uSkyLUT: { value: null },
    uLutPhys: { value: 16 },
    uObsR: { value: 6360.75 },
    uBgFloor: { value: 2e-4 },
    uOut: { value: 1 },
    uTau: { value: new Vector3(0.1, 0.15, 0.3) },
    uTime: { value: 0 },
    uTwinkle: { value: 0 },
    uSizeScale: { value: 1 },
  };

  const stars = new Points(buildStarGeometry(count, magLimit, seed), starMaterial(uniforms));
  stars.name = 'env.stars';
  stars.frustumCulled = false;
  stars.renderOrder = -1000; // first among transparents: smoke & flames blend over the stars

  const pg = new BufferGeometry();
  pg.setAttribute('position', new Float32BufferAttribute(new Float32Array(15), 3));
  pg.setAttribute('aMag', new Float32BufferAttribute(new Float32Array(5).fill(30), 1));
  pg.setAttribute('aColor', new Float32BufferAttribute(Object.values(PLANET_COLOR).flat(), 3));
  pg.setAttribute('aSeed', new Float32BufferAttribute([0.11, 0.37, 0.59, 0.73, 0.91], 1));
  const pmat = starMaterial(uniforms);
  pmat.uniforms.uDynamic.value = 1;
  const planets = new Points(pg, pmat);
  planets.name = 'env.planets';
  planets.frustumCulled = false;
  planets.renderOrder = -999;

  const M = uniforms.uCelestial.value;
  return {
    stars, planets, uniforms,
    get count() { return stars.geometry.attributes.aMag.count; },
    /** runtime quality change: replace the star geometry (same Points object, same material) */
    rebuild({ count: c = count, magLimit: m = magLimit } = {}) {
      const old = stars.geometry;
      stars.geometry = buildStarGeometry(c, m, seed);
      old.dispose();
    },
    /** world = M · equatorial (x: RA 0h, y: RA 6h, z: NCP); lst & lat in degrees */
    setCelestial(lstDeg, latDeg, target = M) {
      const L = lstDeg * Math.PI / 180, f = latDeg * Math.PI / 180;
      const sL = Math.sin(L), cL = Math.cos(L), sf = Math.sin(f), cf = Math.cos(f);
      target.set(
        -sL, cL, 0,
        cf * cL, cf * sL, sf,
        sf * cL, sf * sL, -cf,
      );
      return target;
    },
    /** list: ctx.time.planets (world dirs + magnitudes) */
    updatePlanets(list) {
      const p = pg.attributes.position, m = pg.attributes.aMag;
      list.forEach((pl, i) => {
        if (i > 4) return;
        p.setXYZ(i, pl.dir.x, pl.dir.y, pl.dir.z);
        m.setX(i, pl.mag);
      });
      p.needsUpdate = true; m.needsUpdate = true;
    },
  };
}
