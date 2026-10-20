// ?debug=sim — a small overlay: clock, zone, sim cost, figure budget, and every choreo (relevance, LOD, figures)
// with its events' windows. Refreshes at 4 Hz. Development aid only (not part of the experience).
import { since, within } from './lib/core.js';

export function installDebug(ctx, runtime) {
  const el = document.createElement('pre');
  el.id = 'mk-sim-debug';
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:6px 8px;max-width:min(560px,calc(100vw - 16px));'
    + 'max-height:46vh;overflow:auto;font:11px/1.35 ui-monospace,Consolas,monospace;color:#e8e2d0;background:rgba(14,12,10,.78);'
    + 'border:1px solid rgba(232,226,208,.18);border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  const fmt = (m) => ctx.time?.format?.(m) ?? (Number.isFinite(m) ? m.toFixed(1) : '--');
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  let acc = 1;
  ctx.engine.onUpdate((dt) => {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    const time = ctx.time, s = runtime.stats;
    const t = time?.t ?? 0;
    const lines = [];
    lines.push(`sim ${fmt(t)} ${time?.toZmani?.(t)?.label ?? ''} · ${time?.dayType ?? ''} · x${time?.paused ? 0 : time?.speed}`);
    lines.push(`zone ${ctx.zones?.current ?? '—'} · ${s.ms.toFixed(3)} ms (peak ${s.msPeak.toFixed(2)}) · figures ${s.figures}/${s.budget} (wanted ${s.wanted})`);
    for (const e of runtime.entries) {
      const shown = e.pools.reduce((n, p) => n + p.slots.filter((x) => x.shown).length, 0);
      const total = e.pools.reduce((n, p) => n + p.count, 0);
      const st = e.failed ? 'FAILED' : e.relevant ? (e.mod.always ? 'always' : 'active') : 'idle';
      lines.push(`${pad(e.id, 15)} ${pad(st, 6)} lod${e.lod} ${pad(Math.round(e.dist) + 'm', 6)} figs ${shown}/${total} ${e.ms.toFixed(3)}ms${e.fixture ? ' [fixture]' : ''}`);
      for (const ev of e.events) {
        const on = Number.isFinite(ev.t0) && within(t, ev.t0, ev.t1);
        const nx = Number.isFinite(ev.t0) && !on ? ` in ${Math.round(since(ev.t0, t))}m` : '';
        lines.push(`   ${on ? '●' : '○'} ${pad(ev.id, 22)} ${fmt(ev.t0)}–${fmt(ev.t1)}${nx}`);
      }
      const extra = e.state && e.mod.debug ? e.mod.debug(e.state) : null;
      if (extra) lines.push(`   ${extra}`);
    }
    const sched = ctx.schedule;
    if (sched && !sched.events.length) lines.push('schedule: src/data/schedule.js missing — choreos on fixtures');
    el.textContent = lines.join('\n');
  }, 75);
}
