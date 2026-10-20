for (let i = 0; i < 160 && !ctx.nav.isReady; i++) await sleep(250);
const { m2w } = await import('/src/core/units.js');
const P = (v) => m2w(v[0], v[1], v[2] ?? 0);
const pts = { sw: [58.7, 253.7], nw: [58.7, 407.3], flightFoot: [28, 381], w20_400: [20, 400], w25_430: [25, 430], n60_440: [60, 440], n100_440: [100, 440], parochet: [148.5, 416.3], n130_420: [130, 421], n120_440: [120, 440] };
const legs = [['sw', 'flightFoot'], ['flightFoot', 'nw'], ['nw', 'w20_400'], ['w20_400', 'w25_430'], ['w25_430', 'n60_440'], ['n60_440', 'n100_440'], ['n100_440', 'parochet'], ['w25_430', 'parochet'], ['nw', 'n130_420'], ['w20_400', 'n120_440'], ['n120_440', 'parochet'], ['nw', 'parochet']];
const out = {};
for (const [a, b] of legs) { const t0 = performance.now(); const p = ctx.nav.findPath(P(pts[a]), P(pts[b])); out[`${a}>${b}`] = p ? `${p.length}pts ${(performance.now() - t0).toFixed(0)}ms` : `null ${ctx.nav.lastExpanded}`; }
return out;
