// render-env-2-fix: dump ANGLE's translated HLSL of one lit program (dev only): which of the interior patch's branches
// reach FXC as [branch] / [flatten] / plain if. three deletes shader objects after linking, so the translation is taken
// at compile time: gl.compileShader is wrapped and one lit material recompiled.
//   NAME=<material name substring> node src/render/dev/session.mjs src/render/dev/hlsl-dump.mjs --q medium
export default async function (h) {
  await h.wait(3000);
  const r = await h.ev(async (name) => {
    const c = globalThis.__mikdash, gl = c.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_shaders');
    if (!ext) return { error: 'no WEBGL_debug_shaders' };
    let got = null;
    const orig = gl.compileShader.bind(gl);
    gl.compileShader = (s) => { orig(s); if (!got) { const t = ext.getTranslatedShaderSource(s); if (t.includes('mkRoom')) got = t; } };
    let mat = null;
    c.scene.traverse((o) => { const m = o.material; if (!mat && m?.isMeshStandardMaterial && (m.name || m.userData?.matKey || '').includes(name)) mat = m; });
    if (!mat) c.scene.traverse((o) => { if (!mat && o.material?.isMeshStandardMaterial) mat = o.material; });
    mat.defines = { ...(mat.defines || {}), MK_DUMP: String(Math.random()).slice(2, 7) };
    mat.needsUpdate = true;
    for (let i = 0; i < 20 && !got; i++) await new Promise((res) => requestAnimationFrame(res));
    gl.compileShader = orig;
    return got ? { name: mat.name || mat.userData?.matKey, len: got.length, src: got } : { error: 'not captured' };
  }, process.env.NAME || 'herodian');
  if (r.error) { h.log(JSON.stringify(r)); return; }
  const { writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const f = resolve(h.out, 'translated.hlsl');
  writeFileSync(f, r.src);
  h.log('program', r.name, 'length', r.len, '->', f);
}
