// ?debug=audio — an audition panel (play every cue and loop around the observer) and test hooks:
//   __mikdashAudio.analyze(id, { kind: 'cue'|'loop', opts }) → stats of the rendered buffer
//   __mikdashAudio.renderAll() → stats for every cue and loop
//   __mikdashAudio.throughSpace(id, space) → stats of the cue rendered through that space's reverb
//                                              with an OfflineAudioContext (the live chain, offline)
import { Vector3 } from 'three';
import { analyze } from './synth/dsp.js';
import { CUE_LIB, LOOP_LIB } from './library.js';
import { toAudioBuffer } from './renderer.js';

/** 16-bit PCM WAV (peak-normalised to -1 dBFS) as base64 — for exporting audition files from tests. */
function wavBase64(chs, sr) {
  const n = chs[0].length, nc = chs.length;
  let p = 1e-9; for (const c of chs) for (let i = 0; i < n; i++) p = Math.max(p, Math.abs(c[i]));
  const g = 0.89 / p, dv = new DataView(new ArrayBuffer(44 + n * nc * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * nc * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, nc, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * nc * 2, true);
  dv.setUint16(32, nc * 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { dv.setInt16(o, Math.max(-32767, Math.min(32767, Math.round(chs[c][i] * g * 32767))), true); o += 2; }
  const bytes = new Uint8Array(dv.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function installDebug(ctx, engine, amb) {
  const chans = (b) => Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
  const hooks = {
    engine, amb,
    async analyze(id, { kind = 'cue', opts = {} } = {}) {
      const lib = kind === 'cue' ? CUE_LIB[id] : LOOP_LIB[id];
      const t0 = performance.now();
      const b = await engine.renderer.get(kind, id, engine.synthOpts(lib, opts, opts.v || 0), engine.rateFor(id), { priority: 50 });
      return { id, kind, renderMs: Math.round(performance.now() - t0), ...analyze(chans(b), b.sampleRate) };
    },
    async renderAll() {
      const out = [];
      for (const id of Object.keys(CUE_LIB)) out.push(await hooks.analyze(id));
      for (const id of Object.keys(LOOP_LIB)) out.push(await hooks.analyze(id, { kind: 'loop' }));
      return out;
    },
    async throughSpace(id, space = 'court', { kind = 'cue', send = 0.6, opts = {}, wav = false } = {}) {
      const lib = kind === 'cue' ? CUE_LIB[id] : LOOP_LIB[id];
      const sr = 48000;
      const dry = await engine.renderer.get(kind, id, engine.synthOpts(lib, opts, 0), engine.rateFor(id), { priority: 50 });
      const irB = await engine.renderer.get('ir', space, { maxLen: 6 }, sr, { priority: 50 });
      const len = Math.ceil((dry.duration + irB.duration) * sr);
      const oc = new OfflineAudioContext({ numberOfChannels: 2, length: len, sampleRate: sr });
      const src = new AudioBufferSourceNode(oc, { buffer: dry });
      const conv = new ConvolverNode(oc, { disableNormalization: true, buffer: irB });
      const wet = new GainNode(oc, { gain: send });
      src.connect(oc.destination);
      src.connect(wet).connect(conv).connect(oc.destination);
      src.start();
      const b = await oc.startRendering();
      return { id, space, ...analyze(chans(b), sr), ...(wav ? { wav: wavBase64(chans(b), sr) } : {}) };
    },
    toAudioBuffer,
  };
  globalThis.__mikdashAudio = hooks;
  if (ctx.params?.shot) return;

  // ---- panel
  const css = `#mk-audio{position:fixed;left:8px;bottom:8px;z-index:60;max-height:70vh;overflow:auto;width:300px;padding:8px 10px;
    background:rgba(13,11,8,.88);color:#e8dcc0;font:12px/1.35 system-ui,sans-serif;border:1px solid #3a3226;border-radius:6px}
    #mk-audio h4{margin:6px 0 4px;font-size:12px;color:#d4a640;font-weight:600}
    #mk-audio button{margin:2px;padding:3px 6px;background:#2a241b;color:#e8dcc0;border:1px solid #4a4030;border-radius:4px;cursor:pointer;font:inherit}
    #mk-audio button.on{background:#5a4a20}#mk-audio .st{white-space:pre-wrap;color:#bfb39a;font-size:11px}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'mk-audio';
  root.innerHTML = `<div><b>Audio</b> <button data-a="unlock">unlock</button> <button data-a="stop">stop all</button>
    <label>vol <input type="range" min="0" max="1" step="0.05" value="0.8" data-a="vol" style="width:80px;vertical-align:middle"></label></div>
    <div class="st" data-st></div><h4>Cues (played 12 m ahead)</h4><div data-cues></div><h4>Loops</h4><div data-loops></div>`;
  document.body.appendChild(root);
  const ahead = () => {
    const cam = ctx.camera, d = new Vector3();
    cam.getWorldDirection(d);
    return cam.getWorldPosition(new Vector3()).addScaledVector(d, 12);
  };
  const cueBox = root.querySelector('[data-cues]'), loopBox = root.querySelector('[data-loops]');
  for (const id of Object.keys(CUE_LIB)) {
    const b = document.createElement('button'); b.textContent = id;
    b.onclick = async () => { await ctx.audio.unlock(); ctx.audio.cue(id, ahead()); };
    cueBox.appendChild(b);
  }
  const loops = new Map();
  for (const id of Object.keys(LOOP_LIB)) {
    const b = document.createElement('button'); b.textContent = id;
    b.onclick = async () => {
      await ctx.audio.unlock();
      if (loops.has(id)) { loops.get(id).stop(); loops.delete(id); b.classList.remove('on'); return; }
      const bed = LOOP_LIB[id].bed;
      loops.set(id, ctx.audio.loop(id, bed ? null : ahead(), { gain: 1, people: 400 })); b.classList.add('on');
    };
    loopBox.appendChild(b);
  }
  root.querySelector('[data-a="unlock"]').onclick = () => ctx.audio.unlock();
  root.querySelector('[data-a="stop"]').onclick = () => { ctx.audio.stopAll(); for (const [, h] of loops) h.stop(); loops.clear(); loopBox.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); };
  root.querySelector('[data-a="vol"]').oninput = (e) => ctx.audio.setMaster(+e.target.value);
  const st = root.querySelector('[data-st]');
  setInterval(() => {
    const r = engine.renderer.stats;
    const active = [...engine.loops].filter((l) => l.nodes).map((l) => l.id);
    st.textContent = `state ${ctx.audio.state} · tier ${engine.tier} · ${engine.panningModel || ''}\nzone ${engine.zoneId || '-'} → space ${engine.space || '-'}\n`
      + `voices ${engine.voices.size} · loops ${active.length}/${engine.loops.size} [${active.join(', ')}]\n`
      + `renders ${r.renders} (${Math.round(r.ms)} ms) · cache ${(r.bytes / 1048576).toFixed(1)} MB · queue ${engine.renderer.queue.length}`;
  }, 500);
}
