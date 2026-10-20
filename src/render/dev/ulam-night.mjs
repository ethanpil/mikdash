// render-env-2: the Ulam at night with / without its probe (dev only). Logs the probe's replay state.
//   T=alot-6,d3 node src/render/dev/session.mjs src/render/dev/ulam-night.mjs --q medium --out shots/render-env-2/wip
const VIEWS = { 'en-gate': { at: [440, 330.5], look: [270, 12] }, 'ulam-in': { at: [171, 331], look: [270, 32] }, 'ulam-court': { at: [196, 331], look: [270, 18] } };
export default async function (h) {
  for (const t of (process.env.T || 'alot-6').split(',')) {
  await h.ev((t) => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse(t)); }, t);
  for (const [name, v] of Object.entries(VIEWS)) {
    await h.ev((v) => { const c = globalThis.__mikdash; c.player.setMode('walk'); c.player.teleport({ at: v.at }); c.player.setLook(v.look[0], v.look[1]); }, v);
    await h.wait(5000);
    for (const mode of ['on', 'off']) {
      const s = await h.ev((mode) => {
        const c = globalThis.__mikdash, p = c.env.probes.probes.find((q) => q.id === 'ulam');
        if (!p) return { none: true };
        if (mode === 'off') { p._valid = p.valid; p.valid = false; } else if (p._valid !== undefined) p.valid = p._valid;
        let Ef = 0;
        try { Ef = c.fx.illuminanceAt(p.world); } catch { /* */ }
        return { valid: p.valid, Pcap: p.Pcap, Ecap: p.Ecap, P: c.env.preExposure, Ef, V: c.env.interiors.at(p.world).V, Eg: c.env.globalIlluminance, meanColor: p.meanColor };
      }, mode);
      await h.wait(1500);
      await h.shot(`ulam-${t}-${name}-${h.q}-${mode}`);
      h.log(t, name, mode, JSON.stringify(s));
    }
    await h.ev(() => { const p = globalThis.__mikdash.env.probes.probes.find((q) => q.id === 'ulam'); if (p && p._valid !== undefined) p.valid = p._valid; });
  }
  }
}
