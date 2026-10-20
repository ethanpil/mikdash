// render-env-2: named views × times in ONE boot (dev only; nothing imports it).
//   VIEWS=en-gate,altar-n TAG=before node src/render/dev/session.mjs src/render/dev/env2-views.mjs --q medium --out shots/render-env-2
// A view: at [X, Y(, Z)] site amot (or pos: eye [X, Y, Z]), look [heading, pitch], t (time string, ctx.time.parse).
// Logs the exposure, the camera's room and the fire light slots at each view.
export const VIEWS = {
  'en-gate': { at: [440, 330.5], look: [270, 12], t: 'alot-6' },
  'pv-court': { at: [238, 385], look: [200, 0], t: 'n3' },
  'pv-kodesh': { at: [136, 330.5], look: [270, 5], t: 'n3' },
  'altar-n': { at: [217, 362], look: [180, 4], t: 'alot-6' },
  'altar-nw': { at: [190, 360], look: [140, 6], t: 'alot-6' },
  'kod-menorah': { at: [139, 332], look: [225, 0], t: 'alot-6' },
  'kod-west-n': { at: [150, 330.5], look: [270, 4], t: 'n3' },
  'kod-west-d': { at: [150, 330.5], look: [270, 4], t: 'd3' },
  'kod-east-d': { at: [122, 330.5], look: [90, 6], t: 'd3' },
  'khk-d': { at: [113, 333], look: [250, -6], t: 'd3' },
  'khk-lul': { at: [101, 330.5], look: [270, 2], t: 'd3' },
  'even': { at: [104, 331.5], look: [262, -30], t: 'd3' },
  'ulam-in': { at: [171, 331], look: [270, 32], t: 'd3' },
  'ulam-court': { at: [196, 331], look: [270, 18], t: 'd3' },
  'niches': { at: [168, 368], look: [0, 10], t: 'd3' },
  'facade': { at: [205, 300], look: [300, 16], t: 'd3' },
  'lintels': { at: [214, 345], look: [258, 30], t: 'd3' },
  'lintels-pm': { at: [214, 345], look: [258, 30], t: 'd7' },
  'sovev': { at: [238, 297], look: [290, 2], t: 'sunrise+50' },
  'sovev-2': { at: [238, 297], look: [290, 2], t: 'sunrise+110' },
  'sovev-3': { at: [236, 312], look: [225, 4], t: 'sunrise+150' },
  'sovev-am': { at: [234, 299], look: [300, 12], t: 'd2' },
  'sovev-am3': { at: [233, 300], look: [305, 18], t: 'd3' },
  'lintel-close': { pos: [196, 330.5, 58], look: [270, 8], t: 'd2.5' },
  'lintel-ground': { at: [214, 330.5], look: [270, 38], t: 'd2.5' },
  'ulam-curtain': { at: [192, 336], look: [250, 25], t: 'd2' },
  'court-dawn': { at: [215, 285], look: [60, -6], t: 'sunrise+40' },
  'court-pm': { at: [120, 300], look: [80, 4], t: 'd10' },
  'nwing': { at: [142, 382], look: [125, 14], t: 'd8' },
  'nwing-am': { at: [142, 382], look: [125, 14], t: 'd3' },
  'nivreshet': { at: [210, 345], look: [252, 28], t: 'sunrise+16' },
  'smoke': { at: [246, 350], look: [240, 24], t: 'd4' },
  'moked': { fire: 'courts.moked.hearth', dist: 4.5, look: [0, -8], t: 'n3' },
  'moked-up': { fire: 'courts.moked.hearth', dist: 3.5, look: [0, 35], t: 'n3' },
  'haze': { pos: [250, 250, 260], look: [90, -2], t: 'd4' },
  'haze-w': { pos: [250, 250, 260], look: [270, -2], t: 'd9' },
  // render-env-2-fix (the review's views)
  'court-n3': { at: [238, 385], look: [200, 0], t: 'n3' },
  'altar-nw3': { at: [190, 360], look: [140, 6], t: 'n3' },
  'altar-n3': { at: [217, 362], look: [180, 4], t: 'n3' },
  'court-s-n3': { at: [236, 272], look: [350, 2], t: 'n3' },
  'ey-nw-n': { at: [246, 392], look: [235, 8], t: 'n3' },
  'khk-n3': { at: [113, 333], look: [250, -6], t: 'n3' },
  'kod-west-n3': { at: [150, 330.5], look: [270, 4], t: 'n3' },
  'kod-west-d3': { at: [150, 330.5], look: [270, 4], t: 'd3' },
  'kod-menorah-n3': { at: [139, 332], look: [225, 0], t: 'n3' },
  'kod-menorah-d3': { at: [139, 332], look: [225, 0], t: 'd3' },
  'ulam-altar-n': { at: [205, 331, 25], look: [270, 14], t: 'alot-6' },
  'ulam-altar-d': { at: [205, 331, 25], look: [270, 14], t: 'd3' },
  'moked-n3': { fire: 'courts.moked.hearth', dist: 4.5, look: [0, -8], t: 'n3' },
  'niv-18': { at: [210, 345], look: [252, 28], t: 'sunrise+18' },
  'niv-22': { at: [210, 345], look: [252, 28], t: 'sunrise+22' },
  'niv-far': { at: [236, 331], look: [270, 16], t: 'sunrise+20' },
  'kitchen-n': { at: [100, 300], look: [90, 0], t: 'n3' },
  'lintel-close-d1': { pos: [196, 330.5, 58], look: [270, 8], t: 'd1' },
  'lintel-close-d3': { pos: [196, 330.5, 58], look: [270, 8], t: 'd3' },
}

export default async function (h) {
  const pick = (process.env.VIEWS || Object.keys(VIEWS).join(',')).split(',').filter(Boolean);
  const tag = process.env.TAG ? `-${process.env.TAG}` : '';
  const settle = +(process.env.SETTLE || 4000);
  let lastT = null;
  for (const name of pick) {
    const v = VIEWS[name];
    if (!v) { h.log(`unknown view ${name}`); continue; }
    if (v.t !== lastT) { await h.ev((t) => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse(t)); }, v.t); lastT = v.t; }
    await h.ev((v) => {
      const c = globalThis.__mikdash;
      if (v.fire) {
        // stand `dist` m from the fire, opposite the look heading
        const f = c.fx.fires.get(v.fire), A = c.units.AMAH;
        const h = v.look[0] * Math.PI / 180, X = f.pos.x / A - Math.sin(h) * v.dist / A, Y = -f.pos.z / A - Math.cos(h) * v.dist / A;
        c.player.setMode('walk'); c.player.teleport({ at: [X, Y, f.pos.y / A] });
      } else if (v.pos) { c.player.setMode('fly'); c.player.teleport({ pos: v.pos }); } else { c.player.setMode('walk'); c.player.teleport({ at: v.at }); }
      c.player.setLook(v.look[0], v.look[1]);
    }, v);
    await h.wait(settle);
    const s = await h.ev(() => {
      const c = globalThis.__mikdash, e = c.env, ci = e.interiors?.camera;
      const owner = new Map();
      for (const p of c.fx?._lights?.pools || []) for (const [k, st] of p.weights) if (st.slot >= 0) owner.set(p.lights[st.slot], k);
      const lights = (c.fx?.pointLights?.() || []).map((l) => `${l.name.replace('fx:firelight', '')}=${(owner.get(l) || '-').replace(/^(heichal|altar|courts|mount)\./, '')}:${l.intensity.toExponential(1)}`);
      const st = e.interiors?.stats || {};
      const mt = e._meter; return { meter: mt ? { Lopen: +mt.Lopen.toPrecision(3), Lf: +mt.Lf.toPrecision(3), Lroom: +mt.Lroom.toPrecision(3), probe: mt.probe } : null, glint: c.fx?.stats?.glint, occ: st.occLights, grid: `${st.gridCells}/${st.gridOverflow} sel ${st.selected}`, P: +e.preExposure.toPrecision(3), La: +e.luminance.toPrecision(3), V: ci ? +ci.V.toPrecision(3) : null, vol: ci?.vol?.id || null, fxP: c.fx?.stats?.P, viewLaf: c.fx?.stats?.viewLaf, lights: lights.join(' '), ms: c.post?.stats?.ms, calls: c.renderer.info.render.calls, wb: e.whiteBalance.toArray().map((x) => +x.toFixed(2)) };
    });
    const file = await h.shot(`${name}-${h.q}${tag}`);
    // CROP=x,y,w,h: also save that region (for close inspection)
    if (process.env.CROP || v.crop) {
      const [x, y, w, hh] = (process.env.CROP ? process.env.CROP.split(',').map(Number) : v.crop);
      const { resolve } = await import('node:path');
      await h.page.screenshot({ path: resolve(h.out, `${name}-${h.q}${tag}-crop.png`), clip: { x, y, width: w, height: hh } });
    }
    // image statistics of the shot: mean display luminance (linear) and mean sRGB channels
    const { readFileSync } = await import('node:fs');
    s.img = await h.page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = new OffscreenCanvas(img.width, img.height), g = cv.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      let L = 0, r = 0, gg = 0, b = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { L += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      return { Lmean: +(L / n).toFixed(4), rgb: [r / n, gg / n, b / n].map((x) => Math.round(x)) };
    }, readFileSync(file).toString('base64'));
    h.log(`${name}`, JSON.stringify(s));
  }
}
