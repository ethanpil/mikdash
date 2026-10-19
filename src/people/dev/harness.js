// Stand-alone dev harness for people/ (no world, sim or other subsystems): a sunlit ground plane, a neutral
// environment for metals, and the people demo. Lets this module be developed and screenshot even while other
// subsystems are mid-edit. Served by Vite at /src/people/dev/harness.html?pos=X,Y,Z&look=H,P&q=medium&...
// Not part of the production bundle (only index.html is an entry).
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, HemisphereLight, DirectionalLight, Mesh, PlaneGeometry,
  MeshStandardMaterial, PMREMGenerator, AgXToneMapping, SRGBColorSpace, PCFShadowMap, Fog, Timer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TIERS } from '../../core/quality.js';
import { m2w, headingToYaw, EYE_HEIGHT } from '../../core/units.js';
import { init } from '../index.js';

const q = new URLSearchParams(location.search);
const tier = { ...(TIERS[q.get('q')] || TIERS.medium) };
const canvas = document.getElementById('scene');
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatioCap));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = AgXToneMapping;
renderer.toneMappingExposure = parseFloat(q.get('exp') || '1.1');
renderer.shadowMap.enabled = !!tier.shadows;
renderer.shadowMap.type = PCFShadowMap;

const scene = new Scene();
const night = q.get('night') === '1';
scene.background = new Color(night ? 0x0b1020 : 0x8fb3d9);
scene.fog = new Fog(scene.background, 80, 600);
const camera = new PerspectiveCamera(parseFloat(q.get('fov') || '62'), innerWidth / innerHeight, 0.05, 2000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new HemisphereLight(night ? 0x223355 : 0xd6e6ff, night ? 0x111111 : 0x8a7a60, night ? 0.15 : 1.1);
const sun = new DirectionalLight(night ? 0x8899cc : 0xfff1dc, night ? 0.15 : 3.2);
const target = m2w(255, 110, 0);
sun.position.copy(target).add(m2w(0, 0, 0).set(-30, 45, 25));
sun.target.position.copy(target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(hemi, sun, sun.target);
const pm = new PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = night ? 0.05 : 0.45;

const ground = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: 0xcfc4ad, roughness: 0.85 }));
ground.rotation.x = -Math.PI / 2;
ground.position.copy(target).setY(0);
ground.receiveShadow = true;
scene.add(ground);

const updaters = [];
const listeners = new Map();
const ctx = {
  renderer, scene, camera, quality: tier, mats: null, physics: null, fx: null,
  engine: { onUpdate(fn, p = 50) { updaters.push({ fn, p }); updaters.sort((a, b) => a.p - b.p); }, frame: 0 },
  bus: { on(e, f) { (listeners.get(e) || listeners.set(e, []).get(e)).push(f); }, emit(e, d) { for (const f of listeners.get(e) || []) f(d); } },
  params: { debug: new Set((q.get('debug') || 'people').split(',')), raw: q, shot: true },
};
globalThis.__mikdash = ctx;

const pos = (q.get('pos') || '255,94,3.4').split(',').map(Number);
const look = (q.get('look') || '0,-4').split(',').map(Number);
m2w(pos[0], pos[1], pos[2] ?? EYE_HEIGHT / 0.48, camera.position);
camera.rotation.set(look[1] * Math.PI / 180, headingToYaw(look[0]), 0, 'YXZ');

await init(ctx);
if (q.get('eval')) { try { (0, eval)(q.get('eval')); } catch (e) { console.error(e); } }

const timer = new Timer();
let frames = 0;
const advance = parseFloat(q.get('advance') || '0'); // seconds of animation to simulate before the shot
renderer.setAnimationLoop((ts) => {
  timer.update(ts);
  let dt = Math.max(0, Math.min(timer.getDelta(), 0.1));
  if (frames === 1 && advance > 0) { // simulate `advance` seconds in 0.2 s steps (people clamps per-frame dt)
    for (let t = advance; t > 1e-6; t -= 0.2) for (const u of updaters) u.fn(Math.min(t, 0.2), ctx);
  }
  for (const u of updaters) u.fn(dt, ctx);
  renderer.info.reset();
  renderer.render(scene, camera);
  ctx.engine.frame = ++frames;
  if (frames === 20) globalThis.__mikdashReady = true;
});
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
