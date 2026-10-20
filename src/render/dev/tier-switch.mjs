// lighting-polish-fix: runtime tier switch low -> medium -> low inside the Kodesh (probe compile switch, atlas).
export default async function (h) {
  const sw = (k) => h.ev(async (k) => {
    const c = globalThis.__mikdash;
    const { TIERS } = await import('/src/core/quality.js');
    c.quality = { ...TIERS[k], key: k };
    c.bus.emit('quality:change');
  }, k);
  const st = () => h.ev(() => { const c = globalThis.__mikdash; const k = c.env.probes?.probes.find((p) => p.id === 'kodesh'); return { tier: c.quality.key, probes: !!c.env.probes, stats: c.env.probes?.stats?.captures, fps: Math.round(c.engine.fps), meanL: k?.meanL ?? null, P: +c.env.preExposure.toPrecision(3), env: c.scene.environment?.image?.width }; });
  await h.ev(() => { const t = globalThis.__mikdash.time; t.set(t.fromZmani('night', 3)); globalThis.__mikdash.player.teleport({ at: [139, 332] }); globalThis.__mikdash.player.setLook(225, 0); });
  await h.wait(4000);
  h.log('low', JSON.stringify(await st())); await h.shot('tier-0-low');
  await sw('medium'); for (let i = 0; i < 6; i++) { await h.wait(5000); h.log('...', JSON.stringify(await st())); }
  h.log('medium', JSON.stringify(await st())); await h.shot('tier-1-medium');
  await sw('low'); await h.wait(10000);
  h.log('low again', JSON.stringify(await st())); await h.shot('tier-2-low');
}
