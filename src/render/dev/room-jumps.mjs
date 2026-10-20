// lighting-polish-fix: clock jumps, a time-panel drag and 600× dawn/dusk INSIDE a probe room (the Kodesh), where
// the exposure depends on the room probe's measured luminance. Frame mean (0..255) sampled at fixed delays.
//   node src/render/dev/session.mjs src/render/dev/room-jumps.mjs --q medium --query "at=136,330.5&look=270,5"
// PARTS=jumps,drag,ff (default all)
const probe = () => {
  const c = globalThis.__mikdash, e = c.env;
  const src = c.renderer.domElement;
  const cv = globalThis.__rjCv || (globalThis.__rjCv = Object.assign(document.createElement('canvas'), { width: 64, height: 36 }));
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, 64, 36);
  const d = g.getImageData(0, 0, 64, 36).data;
  let s = 0, white = 0;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; if (l > 245) white++; }
  const k = e.probes?.probes.find((p) => p.id === 'kodesh');
  return { t: +c.time.t.toFixed(1), alt: +c.time.sun.altitude.toFixed(2), mean: +(s / (d.length / 4)).toFixed(1), white: +(100 * white / (d.length / 4)).toFixed(1), La: +e.luminance.toPrecision(3), meanL: k ? +k.meanL.toPrecision(3) : null, est: e._meter ? +(e._meter.Lopen + e._meter.Lf).toPrecision(3) : null };
};
const startRec = () => { const g = globalThis; g.__rjFt = []; let last = performance.now(); g.__rjOn = true; const f = (now) => { g.__rjFt.push(now - last); last = now; if (g.__rjOn) requestAnimationFrame(f); }; requestAnimationFrame(f); };
const stopRec = () => { const g = globalThis; g.__rjOn = false; const a = [...g.__rjFt].sort((x, y) => x - y); return { n: a.length, median: +a[a.length >> 1]?.toFixed(1), p95: +a[Math.floor(a.length * 0.95)]?.toFixed(1), max: +a[a.length - 1]?.toFixed(1) }; };

export default async function (h) {
  const parts = (process.env.PARTS || 'jumps,drag,ff').split(',');
  const set = (expr) => h.ev((x) => { const t = globalThis.__mikdash.time; t.set(new Function('t', `return ${x}`)(t)); }, expr);
  const series = async (label, times) => {
    let prev = 0; const out = [];
    for (const ms of times) { await h.wait(ms - prev); prev = ms; const p = await h.ev(probe); out.push(`${ms}:${p.mean}${p.white > 1 ? `(w${p.white}%)` : ''}`); if (ms === times[times.length - 1]) out.push(`La ${p.La} meanL ${p.meanL} est ${p.est}`); }
    h.log(label, out.join(' '));
  };
  const T = [50, 150, 400, 1000, 3000, 6000];
  if (parts.includes('jumps')) {
    for (const running of [false, true]) {
      const rt = running ? 'run' : 'pause';
      await h.ev((r) => { const t = globalThis.__mikdash.time; t.setSpeed(1); t.pause(!r); }, running);
      await set("t.fromZmani('day', 0.3)"); await h.wait(3000);
      await series(`[${rt}] day0.3 -> alot-6`, (await set('t.zmanim.alot - 6'), T));
      await h.shot(`room-${h.q}-${rt}-back`);
      await series(`[${rt}] -> day4`, (await set("t.fromZmani('day', 4)"), T));
      await h.shot(`room-${h.q}-${rt}-fwd`);
      await series(`[${rt}] -> midnight`, (await set('t.zmanim.midnight'), T));
      await series(`[${rt}] midnight -> noon`, (await set('t.zmanim.chatzot'), T));
    }
  }
  if (parts.includes('drag')) {
    await h.ev(() => { const t = globalThis.__mikdash.time; t.setSpeed(1); t.pause(false); });
    for (const [lab, a, b] of [['day6->night10', ['day', 6], ['night', 10]], ['night10->day3', ['night', 10], ['day', 3]]]) {
      const t0 = await h.ev(([x, y]) => globalThis.__mikdash.time.fromZmani(x, y), a);
      let t1 = await h.ev(([x, y]) => globalThis.__mikdash.time.fromZmani(x, y), b);
      if (lab.startsWith('day')) t1 -= 1440;
      await h.ev((x) => globalThis.__mikdash.time.set(x), t0); await h.wait(2500);
      const c0 = await h.ev(() => globalThis.__mikdash.env.probes?.stats?.captures ?? 0);
      await h.ev(startRec);
      for (let i = 1; i <= 40; i++) { const tt = t0 + (t1 - t0) * (i / 40); await h.ev((x) => globalThis.__mikdash.time.set(((x % 1440) + 1440) % 1440), tt); await h.wait(90); }
      const ft = await h.ev(stopRec);
      const c1 = await h.ev(() => globalThis.__mikdash.env.probes?.stats?.captures ?? 0);
      h.log(`[drag ${lab}] frames`, JSON.stringify(ft), 'captures', c1 - c0);
      await series(`[drag ${lab}] released`, [100, 400, 1000, 3000]);
    }
  }
  if (parts.includes('ff')) {
    for (const [name, start, end] of [['dawn', 't.zmanim.alot - 20', 't.zmanim.sunrise + 40'], ['dusk', 't.zmanim.sunset - 40', 't.zmanim.tzeit + 20']]) {
      await set(start); await h.wait(2500);
      await h.ev(startRec);
      await h.ev(() => { const t = globalThis.__mikdash.time; t.setSpeed(600); t.pause(false); });
      const endT = await h.ev((x) => new Function('t', `return ${x}`)(globalThis.__mikdash.time), end);
      const rows = [];
      for (let i = 0; i < 120; i++) { await h.wait(100); const p = await h.ev(probe); rows.push(p); if (p.t >= endT) break; }
      const f2 = await h.ev(stopRec);
      await h.ev(() => { const t = globalThis.__mikdash.time; t.pause(true); t.setSpeed(1); });
      // flicker: largest frame-to-frame ratio of the mean between consecutive samples
      let worst = 1;
      for (let i = 1; i < rows.length; i++) worst = Math.max(worst, Math.max(rows[i].mean, 1) / Math.max(rows[i - 1].mean, 1), Math.max(rows[i - 1].mean, 1) / Math.max(rows[i].mean, 1));
      h.log(`${name} 600x: ${rows.length} samples, worst step x${worst.toFixed(2)}, frames ${JSON.stringify(f2)}`);
      h.log(rows.filter((_, i) => i % 3 === 0).map((r) => `${r.alt}°:${r.mean}`).join('  '));
    }
  }
}
