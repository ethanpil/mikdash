#!/usr/bin/env node
// Map behaviour checks (dev only; modelled on uitest.mjs). Starts its own Vite server; drives the map with the mouse,
// the keyboard, touch taps and a synthetic two-finger pinch; prints PASS/FAIL and writes a few screenshots.
//   node src/ui/dev/maptest.mjs [--q low] [--out shots/area-map]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const args = process.argv.slice(2);
const q = args.includes('--q') ? args[args.indexOf('--q') + 1] : 'low';
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'shots/area-map';
mkdirSync(resolve(root, out), { recursive: true });
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const server = await createServer({ root, logLevel: 'error', configFile: join(root, 'vite.config.js'), server: { port: 0, host: '127.0.0.1', strictPort: false, hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  — ${extra}` : ''}`); if (!ok) fails++; };
const logs = [];
const pillClear = async (pg) => {
  const r = await pg.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); return e && !e.hidden ? e.getBoundingClientRect() : null; };
    const o = (p, q) => !!(p && q) && p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
    const t = R('.mk-mapv__travel'), p = R('.mk-mapv__presets'), c = R('.mk-mapcard');
    return { shown: !!t, presets: o(t, p), card: o(t, c), cardOpen: !!c };
  });
  return [r.shown && !r.presets && !r.card, JSON.stringify(r)];
};
/**
 * Two touch taps at (x, y) that really are a double tap: Playwright waits for each tap to be handled, so on a busy GPU
 * the second can land > 340 ms after the first (by the events' own time stamps) — that is no double tap, and the card
 * rightly takes it. Then reset() and try again. Returns the gap (ms) or null.
 */
const dblTap = async (pg, x, y, reset) => {
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => {
      globalThis.__taps = [];
      if (!globalThis.__tapRec) { globalThis.__tapRec = true; document.addEventListener('pointerdown', (e) => globalThis.__taps.push(e.timeStamp), true); }
    });
    await pg.touchscreen.tap(x, y); await pg.waitForTimeout(110); await pg.touchscreen.tap(x, y);
    const gap = await pg.evaluate(() => (globalThis.__taps.length >= 2 ? globalThis.__taps[1] - globalThis.__taps[0] : 1e9));
    if (gap < 330) return gap;
    console.log(`  (harness: taps ${Math.round(gap)} ms apart — not a double tap; retrying)`);
    await pg.waitForTimeout(300);
    await reset();
  }
  return null;
};
const overlaps = (rs) => { for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) return `${a.id} × ${b.id}`; } return null; };

async function boot(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}?q=${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__mikdashReady === true, null, { timeout: 180000, polling: 250 });
  await page.evaluate(() => { __mikdash.ui.enter(); __mikdash.time.pause(true); __mikdash.time.set(__mikdash.time.parse('d3')); });
  await page.waitForTimeout(900);
  return page;
}

try {
  // ---------------- desktop ----------------
  const page = await boot({ viewport: { width: 1280, height: 720 } });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const stage = async () => page.locator('.mk-mapv__stage').boundingBox();
  const at = async (X, Y) => { const b = await stage(); const [x, y] = await ev(([a, c]) => __mikdash.ui.map.siteToScreen(a, c), [X, Y]); return [b.x + x, b.y + y]; };

  // the model, list and plan are built in idle time after 'ready': the first open is quick
  await page.waitForFunction(() => !!document.querySelector('[data-panel=map] .mk-mapv__stage') && document.querySelectorAll('.mk-mapl__opt').length > 20, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const openMs = await ev(() => { const t0 = performance.now(); __mikdash.ui.open('map'); const t1 = performance.now(); __mikdash.ui.close(); return t1 - t0; });
  check('prewarmed: the first open costs little main-thread time', openMs < 80, `${openMs.toFixed(1)} ms`);
  await page.waitForTimeout(400);
  // focus returns to the HUD map button when the map closes
  await page.locator('[data-tool=map]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('Esc returns focus to the HUD map button', await ev(() => document.activeElement?.dataset?.tool === 'map'), await ev(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`));

  await ev(() => document.activeElement?.blur?.());
  await page.keyboard.press('m');
  await page.waitForTimeout(700);
  check('M opens the map overlay, focus on the map', await ev(() => __mikdash.ui.panel === 'map' && document.activeElement?.classList.contains('mk-mapv__stage')));
  await ev(() => __mikdash.ui.toast('test toast'));
  check('toasts hide under the map', await ev(() => getComputedStyle(document.querySelector('.mk-toasts')).visibility === 'hidden'));

  // labels never slide onto ground another place owns (the city / the Mount / the Chel along the edge of a court view)
  const slid = async (label) => {
    const r = await ev(() => {
      const m = __mikdash.ui.map;
      const bad = [];
      for (const L of m.labelRects()) {
        const z = m.model().get(L.id);
        if (!z || z.area < 20000) continue; // big places only (small ones may be named just outside their mark)
        const [X, Y] = m.screenToSite((L.l + L.r) / 2, (L.t + L.b) / 2);
        if (!m.owns(L.id, X, Y)) bad.push(L.id);
      }
      return { bad, n: m.labels().length };
    });
    check(`${label}: big places are named only on their own ground`, !r.bad.length, `${r.n} labels; ${r.bad.join(', ') || 'none astray'}`);
  };
  await ev(() => __mikdash.ui.map.setView({ cx: 217, cy: 321, k: 9 }));
  await page.waitForTimeout(500);
  await slid('inside the Azarah (k 9)');
  check('…and the city, the Mount and the Chel are not named there', await ev(() => !__mikdash.ui.map.labels().some((id) => ['outside', 'har-habayit', 'chel'].includes(id))), JSON.stringify(await ev(() => __mikdash.ui.map.labels())));
  for (const p of ['courts', 'sanctuary', 'mount']) { await ev((k) => __mikdash.ui.map.fit(k), p); await page.waitForTimeout(500); await slid(p); }
  // the roof of the Heichal is labelled (a storey over the Heichal) and offered from the Heichal's card
  const roofAt = [];
  for (const k of [6, 9, 16]) { await ev((kk) => __mikdash.ui.map.setView({ cx: 137, cy: 330.5, k: kk }), k); await page.waitForTimeout(400); if ((await ev(() => __mikdash.ui.map.labels())).includes('roof')) roofAt.push(k); }
  check('the roof is labelled when the Heichal is zoomed in', roofAt.length >= 2, `at k ${roofAt.join(', ') || 'none'}`);
  check('the Heichal offers its aliyah and roof under "Also here"', await ev(() => { const o = __mikdash.ui.map.model().otherLevels('heichal'); return o.includes('roof') && o.includes('aliyah'); }));
  // the off-screen "you" chevron keeps clear of the labels and of the controls
  await ev(() => __mikdash.ui.map.setView({ cx: 140, cy: 330, k: 6 }));
  await page.waitForTimeout(600);
  const mk = await ev(() => ({ m: __mikdash.ui.map.marker(), L: __mikdash.ui.map.labelRects() }));
  check('the off-screen chevron is not under a label', !!mk.m?.off && !mk.L.some((r) => mk.m.x + 14 > r.l && mk.m.x - 14 < r.r && mk.m.y + 14 > r.t && mk.m.y - 14 < r.b), JSON.stringify(mk.m));
  const pr = await ev(() => { const r = document.querySelector('[data-panel=map]').getBoundingClientRect(); return [r.width, r.height]; });
  check('desktop overlay is near full-screen with margins', pr[0] > 1180 && pr[0] < 1260 && pr[1] > 640 && pr[1] < 700, JSON.stringify(pr));
  const p0 = await ev(() => __mikdash.player.position.toArray());
  await page.keyboard.down('w'); await page.waitForTimeout(600); await page.keyboard.up('w');
  const p1 = await ev(() => __mikdash.player.position.toArray());
  check('player input is off while the map is open', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.05, `${p0.map((v) => v.toFixed(2))} → ${p1.map((v) => v.toFixed(2))}`);

  await ev(() => __mikdash.ui.map.fit('courts'));
  await page.waitForTimeout(700);
  const lr = await ev(() => __mikdash.ui.map.labelRects());
  check('Courts: many places labelled, no two labels overlap', lr.length >= 25 && !overlaps(lr), `${lr.length} labels; ${overlaps(lr) || 'no overlap'}`);
  const blockers = await ev(() => { const s = document.querySelector('.mk-mapv__stage').getBoundingClientRect(); return [...document.querySelectorAll('.mk-mapv__presets, .mk-mapv__zoom, .mk-mapv__legend')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.className, l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; }); });
  check('labels stay clear of the map controls', !overlaps([...lr, ...blockers].sort((a, b) => (a.id.startsWith('mk') ? 1 : 0) - (b.id.startsWith('mk') ? 1 : 0))) || !lr.some((a) => blockers.some((b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b)));
  await ev(() => __mikdash.ui.map.fit('mount'));
  await page.waitForTimeout(700);
  const nMount = (await ev(() => __mikdash.ui.map.labels())).length;
  await ev(() => __mikdash.ui.map.fit('sanctuary'));
  await page.waitForTimeout(700);
  const sanct = await ev(() => __mikdash.ui.map.labels());
  check('zoomed in: small places appear (Amah Traksin, Beit HaChalifot)', sanct.includes('amah-traksin') && sanct.includes('beit-hachalifot'), `${sanct.length} labels`);
  await ev(() => __mikdash.ui.map.fit('mount'));
  await page.waitForTimeout(600);
  const mountIds = await ev(() => __mikdash.ui.map.labels());
  check('zoomed out: small chambers declutter away', !mountIds.includes('amah-traksin') && !mountIds.includes('medichin'), `${nMount} labels at Mount`);

  // wheel zoom keeps the point under the cursor
  await ev(() => __mikdash.ui.map.fit('courts'));
  await page.waitForTimeout(600);
  const b = await stage();
  const cx = b.x + b.width * 0.4, cy = b.y + b.height * 0.5;
  const before = await ev(([x, y]) => ({ v: __mikdash.ui.map.view(), s: __mikdash.ui.map.screenToSite(x, y) }), [cx - b.x, cy - b.y]);
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  const after = await ev(([x, y]) => ({ v: __mikdash.ui.map.view(), s: __mikdash.ui.map.screenToSite(x, y) }), [cx - b.x, cy - b.y]);
  check('wheel zooms in about the cursor', after.v.k > before.v.k * 1.4 && Math.hypot(after.s[0] - before.s[0], after.s[1] - before.s[1]) < 1.5,
    `k ${before.v.k.toFixed(2)} → ${after.v.k.toFixed(2)}; drift ${Math.hypot(after.s[0] - before.s[0], after.s[1] - before.s[1]).toFixed(2)} amot`);
  // trackpad pinch (ctrl + wheel)
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 40); await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  const pinchK = await ev(() => __mikdash.ui.map.view().k);
  check('trackpad pinch (ctrl+wheel) zooms out', pinchK < after.v.k, `${after.v.k.toFixed(2)} → ${pinchK.toFixed(2)}`);
  // drag pans
  const v0 = await ev(() => __mikdash.ui.map.view());
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + 12 * i, cy + 5 * i);
  await page.mouse.up();
  await page.waitForTimeout(700);
  const v1 = await ev(() => __mikdash.ui.map.view());
  check('drag pans the map', (v0.cx - v1.cx) * v0.k > 100 && (v1.cy - v0.cy) * v0.k > 40, `Δ ${((v0.cx - v1.cx) * v0.k).toFixed(0)}px, ${((v1.cy - v0.cy) * v0.k).toFixed(0)}px`);
  check('a drag does not select', await ev(() => __mikdash.ui.map.selected() === null));
  // keyboard
  await page.locator('.mk-mapv__stage').focus();
  const k0 = await ev(() => __mikdash.ui.map.view());
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('+');
  await page.waitForTimeout(500);
  const k1 = await ev(() => __mikdash.ui.map.view());
  check('arrow keys pan, + zooms', k1.cx > k0.cx && k1.k > k0.k * 1.3);

  // hover tooltip, click selects, label click selects
  await ev(() => __mikdash.ui.map.fit('courts'));
  await page.waitForTimeout(600);
  const [mx, my] = await at(217, 321);
  await page.mouse.move(mx, my, { steps: 3 });
  await page.waitForTimeout(250);
  check('hover shows the place in a tooltip', await ev(() => document.querySelector('.mk-mapv__tip.in')?.textContent.includes('Mizbeach')), await ev(() => document.querySelector('.mk-mapv__tip')?.textContent));
  await page.mouse.click(mx, my);
  await page.waitForTimeout(500);
  check('click selects the place and opens its card', await ev(() => __mikdash.ui.map.selected() === 'mizbeach' && !document.querySelector('.mk-mapcard').hidden && /Mizbeach/.test(document.querySelector('.mk-mapcard__en').textContent)));
  check('screen-reader summary of the selection', await ev(() => /Selected: .*Mizbeach/.test(document.querySelector('.mk-mapv [aria-live]').textContent)));
  await page.screenshot({ path: resolve(root, out, 'test-desk-select.png') });
  const enRect = (await ev(() => __mikdash.ui.map.labelRects())).find((r) => ['heichal', 'azarah', 'kodesh-hakodashim', 'ulam'].includes(r.id));
  if (enRect) {
    await page.mouse.click(b.x + (enRect.l + enRect.r) / 2, b.y + (enRect.t + enRect.b) / 2);
    await page.waitForTimeout(400);
  }
  check('clicking a label selects its place', !!enRect && await ev((id) => __mikdash.ui.map.selected() === id, enRect.id), `${enRect?.id} → ${await ev(() => __mikdash.ui.map.selected())}`);
  await ev(() => __mikdash.ui.map.select('ezrat-nashim'));
  await page.waitForTimeout(500);
  // speed choice is remembered and names the Go button
  await page.click('.mk-mapcard__speed [data-speed=run]');
  check('speed choice is remembered (travelSpeed) and shown on Go', await ev(() => __mikdash.settings.get('travelSpeed') === 'run' && /Run there/.test(document.querySelector('.mk-mapcard__go').textContent)));
  await page.click('.mk-mapcard__speed [data-speed=walk]');
  // stacked levels: chip to the gallery above Ezrat Nashim
  const chip = await page.locator('.mk-mapcard__levels .mk-chip2').count();
  if (chip) { await page.locator('.mk-mapcard__levels .mk-chip2').first().click(); await page.waitForTimeout(500); }
  check('"Also here" selects the storey above (the gallery)', chip > 0 && await ev(() => __mikdash.ui.map.selected() === 'en-gallery' && /upper/i.test(document.querySelector('.mk-mapcard__lvl').textContent)));
  // presets
  await page.click('.mk-mapv__presets [data-preset=sanctuary]');
  await page.waitForTimeout(800);
  check('preset button animates to the Sanctuary', await ev(() => __mikdash.ui.map.view().k > 2.5 && document.querySelector('.mk-mapv__presets [data-preset=sanctuary]').getAttribute('aria-pressed') === 'true'),
    await ev(() => `k ${__mikdash.ui.map.view().k.toFixed(2)} pressed ${[...document.querySelectorAll('.mk-mapv__presets button')].map((b) => b.getAttribute('aria-pressed'))}`));
  // centre on me
  await page.click('.mk-mapv__zoom button[aria-label="Centre on me"]');
  await page.waitForTimeout(800);
  check('centre on me puts the observer in view', await ev(() => {
    const m = __mikdash.ui.map;
    const st = document.querySelector('.mk-mapv__stage');
    const p = __mikdash.player.position, A = 0.48; // default amah (no ?amah= in this test)
    const [x, y] = m.siteToScreen(p.x / A, -p.z / A);
    return x > 0 && y > 0 && x < st.clientWidth && y < st.clientHeight;
  }));

  // search: '/' focuses it, typing filters and selects the first match, arrows move, Esc clears then closes
  await page.locator('.mk-mapv__stage').focus();
  await page.keyboard.press('/');
  await page.keyboard.type('kiyor', { delay: 30 });
  await page.waitForTimeout(500);
  check('"/" + typing filters the places and selects the match', await ev(() => document.activeElement?.classList.contains('mk-mapl__search') && __mikdash.ui.map.selected() === 'kiyor' && document.querySelectorAll('.mk-mapl__opt').length >= 1));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Esc clears the search first (map stays open)', await ev(() => __mikdash.ui.panel === 'map' && document.querySelector('.mk-mapl__search').value === ''));
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  check('ArrowDown moves the selection along the list', await ev(() => __mikdash.ui.map.selected() !== 'kiyor'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('Esc closes the map and gives input back', await ev(() => __mikdash.ui.panel === null));
  const q0 = await ev(() => __mikdash.player.position.toArray());
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  const q1 = await ev(() => __mikdash.player.position.toArray());
  check('after closing, the observer walks again', Math.hypot(q1[0] - q0[0], q1[2] - q0[2]) > 0.1);

  // performance: idle redraws ≤ 15 fps (dyn only), nothing while closed
  await ev(() => __mikdash.ui.open('map'));
  await page.waitForTimeout(1500);
  const sA = await ev(() => __mikdash.ui.map.stats());
  await page.waitForTimeout(2000);
  const sB = await ev(() => __mikdash.ui.map.stats());
  const dynRate = (sB.dyn - sA.dyn) / 2, baseRate = (sB.base - sA.base) / 2;
  check('idle: dynamic layer ≤ 15 fps, static layer not redrawn', dynRate <= 16 && dynRate >= 5 && baseRate <= 0.5,
    `dyn ${dynRate}/s (${sB.dynMs.toFixed(2)} ms), base ${baseRate}/s (${sB.baseMs.toFixed(2)} ms), raster ${sB.rasterMs.toFixed(1)} ms`);
  await ev(() => __mikdash.ui.close());
  const sC = await ev(() => __mikdash.ui.map.stats());
  await page.waitForTimeout(1200);
  const sD = await ev(() => __mikdash.ui.map.stats());
  check('closed: no map drawing at all', sD.dyn === sC.dyn && sD.base === sC.base && sD.raster === sC.raster);

  // double-click = go at the chosen speed; reopening shows the route and a Stop
  await ev(() => __mikdash.ui.open('map'));
  await page.waitForTimeout(600);
  await ev(() => __mikdash.ui.map.fit('courts'));
  await page.waitForTimeout(600);
  // a spot on the altar itself, not on an event marker there (a double-click on a marker goes to watch that event)
  const gs = await ev(() => {
    const m = __mikdash.ui.map;
    const [x0, y0] = m.siteToScreen(205, 333), [x1, y1] = m.siteToScreen(229, 309);
    for (let y = y0; y < y1; y += 6) for (let x = x0; x < x1; x += 6) { const r = m.hit(x, y); if (r.kind !== 'event' && r.id === 'mizbeach') return [x, y]; }
    return m.siteToScreen(217, 321);
  });
  const gb = await stage();
  const [gx, gy] = [gb.x + gs[0], gb.y + gs[1]];
  await page.mouse.dblclick(gx, gy);
  await page.waitForTimeout(800);
  check('double-click goes to the place under the pointer (map closes, walk starts)', await ev(() => __mikdash.ui.panel === null && __mikdash.player.mode === 'auto' && /Mizbeach/.test(document.querySelector('.mk-status').textContent)),
    await ev(() => `${__mikdash.player.mode} · ${document.querySelector('.mk-status').textContent}`));
  await ev(() => __mikdash.ui.open('map'));
  await page.waitForTimeout(900);
  const trip = await ev(() => ({ trip: __mikdash.ui.map.trip(), pill: !document.querySelector('.mk-mapv__travel').hidden, text: document.querySelector('.mk-mapv__travel').textContent }));
  check('reopened during the walk: route + travel pill with Stop', !!trip.trip && trip.pill, JSON.stringify(trip));
  check('desktop: the travel pill is clear of the presets and the card', ...(await pillClear(page)));
  await page.screenshot({ path: resolve(root, out, 'test-desk-walking.png') });
  await page.click('.mk-mapv__travel button');
  await page.waitForTimeout(600);
  check('Stop cancels the walk and hides the pill', await ev(() => __mikdash.player.mode !== 'auto' && document.querySelector('.mk-mapv__travel').hidden));
  // the info button opens the place panel pinned to the selection
  await ev(() => __mikdash.ui.map.select('gazit'));
  await page.waitForTimeout(600);
  await page.click('.mk-mapcard__acts .mk-btn:has-text("About")');
  await page.waitForTimeout(500);
  check('About opens the place panel for the selected place', await ev(() => __mikdash.ui.panel === 'info' && /Gazit/.test(document.querySelector('[data-panel=info] .mk-info__en')?.textContent || '')));
  // a click in a big open place remembers the spot ("This spot")
  await ev(() => __mikdash.ui.open('map'));
  await page.waitForTimeout(500);
  await ev(() => __mikdash.ui.map.fit('mount'));
  await page.waitForTimeout(600);
  const [hx, hy] = await at(150, 120);
  await page.mouse.click(hx, hy);
  await page.waitForTimeout(500);
  check('a click on open ground offers "This spot"', await ev(() => __mikdash.ui.map.selected() === 'har-habayit' && [...document.querySelectorAll('.mk-mapcard__acts .mk-btn')].some((b) => /This spot/.test(b.textContent) && !b.hidden)));
  // reduced motion: views jump instead of easing
  await ev(() => __mikdash.settings.set('reducedMotion', true));
  const rm = await ev(() => { __mikdash.ui.map.select('kodesh-hakodashim'); const m = __mikdash.ui.map; return JSON.stringify(m.view()); });
  await page.waitForTimeout(50);
  const rm2 = await ev(() => JSON.stringify(__mikdash.ui.map.view()));
  check('reduced motion: a fly-to lands at once', rm === rm2, `${rm} vs ${rm2}`);
  await ev(() => { __mikdash.settings.set('reducedMotion', false); localStorage.removeItem('mikdash.reducedMotion'); });
  await ev(() => __mikdash.ui.close());
  await page.close();

  // ---------------- phone (390×844, touch) ----------------
  const ph = await boot({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const pe = (fn, arg) => ph.evaluate(fn, arg);
  await pe(() => __mikdash.ui.open('map'));
  await ph.waitForTimeout(900);
  const fr = await pe(() => { const r = document.querySelector('[data-panel=map]').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  check('phone: the map is a full-screen sheet', fr[0] === 0 && fr[2] === 390 && fr[3] >= 840, JSON.stringify(fr));
  const sb = await ph.locator('.mk-mapv__stage').boundingBox();
  const pAt = async (X, Y) => { const [x, y] = await pe(([a, c]) => __mikdash.ui.map.siteToScreen(a, c), [X, Y]); return [sb.x + x, sb.y + y]; };
  await pe(() => __mikdash.ui.map.fit('courts'));
  await ph.waitForTimeout(600);
  const [tx, ty] = await pAt(330, 330);
  await ph.touchscreen.tap(tx, ty);
  await ph.waitForTimeout(600);
  const card = await pe(() => { const r = document.querySelector('.mk-mapcard').getBoundingClientRect(); return { sel: __mikdash.ui.map.selected(), l: r.left, w: r.width, b: r.bottom, h: r.height }; });
  check('phone: a tap selects; the card is a bottom sheet', card.sel === 'ezrat-nashim' && card.l === 0 && card.w === 390 && Math.abs(card.b - 844) < 2 && card.h < 844 * 0.62, JSON.stringify(card));
  await ph.screenshot({ path: resolve(root, out, 'test-phone-select.png') });
  // two-finger pinch (synthetic pointer events, as a touch screen sends them)
  const k0p = await pe(() => __mikdash.ui.map.view().k);
  await pe(([x, y]) => {
    const el = document.querySelector('.mk-mapv__stage');
    const fire = (type, id, px, py) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: px, clientY: py, bubbles: true, isPrimary: id === 11, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    fire('pointerdown', 11, x - 30, y); fire('pointerdown', 12, x + 30, y);
    for (let i = 1; i <= 8; i++) { fire('pointermove', 11, x - 30 - 10 * i, y); fire('pointermove', 12, x + 30 + 10 * i, y); }
    fire('pointerup', 11, x - 110, y); fire('pointerup', 12, x + 110, y);
  }, [195, 300]);
  await ph.waitForTimeout(300);
  const k1p = await pe(() => __mikdash.ui.map.view().k);
  check('phone: pinch zooms', k1p > k0p * 2, `${k0p.toFixed(2)} → ${k1p.toFixed(2)}`);
  // places list
  await ph.locator('.mk-placesbtn').tap();
  await ph.waitForTimeout(400);
  check('phone: Places opens the list', await pe(() => getComputedStyle(document.querySelector('.mk-mapl')).display !== 'none'));
  await ph.locator('.mk-mapl__opt[data-id="kiyor"]').first().tap();
  await ph.waitForTimeout(700);
  check('phone: choosing a place closes the list and shows its card', await pe(() => getComputedStyle(document.querySelector('.mk-mapl')).display === 'none' && __mikdash.ui.map.selected() === 'kiyor' && !document.querySelector('.mk-mapcard').hidden));
  // a new selection opens its card at the top (name and sanctity in view), not where the last card was scrolled to
  await pe(() => __mikdash.ui.map.select('mizbeach'));
  await ph.waitForTimeout(600);
  await pe(() => { const c = document.querySelector('.mk-mapcard'); c.scrollTop = 300; c.querySelector('.mk-mapcard__scroll').scrollTop = 300; });
  await pe(() => __mikdash.ui.map.select('gazit'));
  await ph.waitForTimeout(500);
  const rs = await pe(() => { const c = document.querySelector('.mk-mapcard'); const n = c.querySelector('.mk-mapcard__he:not([hidden])') || c.querySelector('.mk-mapcard__en'); return { st: c.scrollTop, nameTop: n.getBoundingClientRect().top, cardTop: c.getBoundingClientRect().top }; });
  check('phone: a newly selected place opens at its name', rs.st === 0 && rs.nameTop >= rs.cardTop, JSON.stringify(rs));
  // touch targets
  const tt = await pe(() => {
    const hs = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height));
    return { speed: hs('.mk-mapcard__speed button'), presets: hs('.mk-mapv__presets button'), places: hs('.mk-placesbtn'), close: hs('[data-panel=map] .mk-panel__head .mk-close'), card: hs('.mk-mapcard .mk-close') };
  });
  check('phone: map controls are at least 40 px tall', Object.values(tt).every((a) => a.length && a.every((v) => v >= 40)), JSON.stringify(tt));
  // double tap = go (a place with its card already open, revealed above the sheet)
  const selKiyor = async () => { await pe(() => { __mikdash.player.cancel?.(); if (!__mikdash.ui.panel) __mikdash.ui.open('map'); __mikdash.ui.map.select('kiyor'); }); await ph.waitForTimeout(700); };
  await selKiyor();
  const [dx, dy] = await pAt(...(await pe(() => __mikdash.ui.map.anchor('kiyor'))));
  await dblTap(ph, dx, dy, selKiyor);
  await ph.waitForTimeout(800);
  check('phone: double tap goes there', await pe(() => __mikdash.ui.panel === null && __mikdash.player.mode === 'auto'));
  // reopened during the walk: the pill sits clear of the presets
  await pe(() => __mikdash.ui.open('map'));
  await ph.waitForTimeout(800);
  check('phone: the travel pill is clear of the presets and the card', ...(await pillClear(ph)));
  await ph.screenshot({ path: resolve(root, out, 'test-phone-walking.png') });
  await pe(() => __mikdash.player.cancel());
  await ph.waitForTimeout(300);
  // double tap with no card open, low on the screen, where the card's sheet comes up under the second tap
  const fresh = async () => { await pe(() => { __mikdash.player.cancel?.(); if (!__mikdash.ui.panel) __mikdash.ui.open('map'); __mikdash.ui.map.deselect(); __mikdash.ui.map.fit('courts'); }); await ph.waitForTimeout(600); };
  for (const id of ['har-habayit', 'ezrat-nashim', 'chel']) {
    await fresh();
    const box = await ph.locator('.mk-mapv__stage').boundingBox();
    // a point of that place in the lower part of the map (search a grid; must hit the place itself)
    const pt = await pe(([zid, h]) => {
      const m = __mikdash.ui.map;
      for (let y = h * 0.9; y > h * 0.55; y -= 12) for (let x = 40; x < 300; x += 12) { const r = m.hit(x, y); if (r.kind === 'zone' && r.id === zid) return [x, y]; }
      return null;
    }, [id, box.height]);
    if (!pt) { check(`phone: double tap low on the map (${id})`, false, 'no point found'); continue; }
    const gap = await dblTap(ph, box.x + pt[0], box.y + pt[1], fresh);
    await ph.waitForTimeout(800);
    const r = await pe(() => ({ panel: __mikdash.ui.panel, mode: __mikdash.player.mode, status: document.querySelector('.mk-status')?.textContent }));
    check(`phone: double tap low on the map, no card open, goes (${id} at y ${Math.round(pt[1])} of ${Math.round(box.height)})`, r.panel === null && r.mode === 'auto', `${JSON.stringify(r)} · taps ${gap === null ? '—' : Math.round(gap)} ms apart`);
  }
  await pe(() => __mikdash.player.cancel());
  await ph.close();

  // ---------------- phone landscape (844×390) ----------------
  const ls = await boot({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ls.evaluate(() => { __mikdash.ui.open('map'); });
  await ls.waitForTimeout(800);
  await ls.evaluate(() => __mikdash.ui.map.select('mizbeach'));
  await ls.waitForTimeout(800);
  const lc = await ls.evaluate(() => { const r = document.querySelector('.mk-mapcard').getBoundingClientRect(); const s = document.querySelector('.mk-mapv__stage').getBoundingClientRect(); return { w: r.width, sw: s.width, right: s.right - r.right, h: r.height }; });
  check('landscape: the card sits at the side', lc.w < lc.sw * 0.6 && lc.right < 12, JSON.stringify(lc));
  const lrs = await ls.evaluate(() => __mikdash.ui.map.labelRects());
  check('landscape: labels do not overlap', !overlaps(lrs), `${lrs.length} labels`);
  await ls.evaluate(() => { document.querySelector('.mk-mapcard').scrollTop = 300; });
  await ls.evaluate(() => __mikdash.ui.map.select('beit-hatevilah'));
  await ls.waitForTimeout(500);
  const lsr = await ls.evaluate(() => document.querySelector('.mk-mapcard').scrollTop);
  check('landscape: a newly selected place opens at its name', lsr === 0, `scrollTop ${lsr}`);
  const ltt = await ls.evaluate(() => {
    const hs = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height));
    return { speed: hs('.mk-mapcard__speed button'), presets: hs('.mk-mapv__presets button'), places: hs('.mk-placesbtn'), close: hs('[data-panel=map] .mk-panel__head .mk-close') };
  });
  check('landscape: map controls are at least 40 px tall', Object.values(ltt).every((a) => a.length && a.every((v) => v >= 40)), JSON.stringify(ltt));
  await ls.screenshot({ path: resolve(root, out, 'test-landscape-select.png') });
  await ls.close();
} catch (e) {
  console.error(e);
  fails++;
} finally {
  const mine = logs.filter((l) => /\/ui\/|\[ui\]|map/i.test(l));
  console.log(logs.length ? `console (${logs.length}, ${mine.length} from ui):\n  ${logs.slice(0, 40).join('\n  ')}` : 'console: clean');
  await browser.close();
  await server.close();
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
