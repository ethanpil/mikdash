# gate-core — decisions

The final QA gate's two core findings: a lost WebGL context left the view black for good, and the cold first view on the
low tier took 24–28 s. Format: **Choice** — why — alternative. Shots: `shots/gate-core/` (`ctxloss/` the context-loss
runs, `firstframe-*` first drawn frames with and without the deferral, `before|after-*` shot-mode views). Measuring
scripts (scratch, not in the repo) are described where used; the "before" build is the working tree with only this
task's edits reverted (the other gate fixers' work is uncommitted), built and checked the same way on the same machine.

## 1. A lost WebGL context

- **Reload where the visitor stood, rather than rebuild in place.** three re-creates its own state on
  `webglcontextrestored`, but env's uniform block buffer, the GPU-baked material textures (render targets), the probes,
  the shadow caches and every program of the page belonged to the old context. Rebuilding all of that is a second boot
  with new failure modes; a reload is that second boot, and certain. — Alternative: recreate UniformBlock's buffer and
  re-bake every material on restore (the QA's "much more work"), and still miss state nobody listed.
- **main.js listens on the canvas: `preventDefault()` (else the browser never restores), the loop stops and stays
  stopped (`engine.lost`: `start()` is a no-op, so the boot's warm-up cannot restart it), a notice covers view and HUD
  ("Graphics were reset — reloading…", the boot screen's own box, `body.gfx-reset`, z-index over the UI), the pointer
  lock is released.** The reload happens on `webglcontextrestored`, or after RESTORE_WAIT (4 s) if none comes (a GPU
  process that restarts without telling the page).
- **A second loss within a minute of such a reload does not reload by itself: it offers a Reload button** with a line on
  memory. A phone that cannot keep the context would otherwise reload in a loop (data, battery). sessionStorage
  `mikdash.gfxReset` holds the time of the last automatic reload.
- **The resume logic is in core: `src/core/resume.js` (`resumeURL`, `reloadHere`).** Same place (eye `pos`, replacing
  `at`), `look`, sim `t` (HH:MM) and `date` as the settings panel's reload, plus sessionStorage `mikdash.resume` so the
  UI skips its intro — only when the visitor was past it (`booted` and no `.mk-intro-open`); a loss during the boot or
  on the intro keeps the URL's own values and shows the intro again. The settings panel (ui-owned) still carries its
  own copy: requested to call `reloadHere(ctx, { edit, delay: 250 })` (see the report).
- **A boot error raised while the context is gone is not shown** (`showBootError` returns): the notice is up and the page
  reloads.
- Verified (production build, `WEBGL_lose_context`, the QA's view `t=sunrise+20&at=250,300`): low and high — lost →
  notice → restore → reload at `t=06:16&pos=250.00,300.00,9.38&look=270.0,4.0&date=2026-11-02`, intro skipped, the same
  view drawn (233 / 618 draw calls as before the loss), a jump to n3 renders; no restore → reload after 4 s; a second
  loss → the button, no reload. Console: one warning per loss (was 257 GL errors in 9 s). `shots/gate-core/ctxloss/`.

## 2. Cold first view

### What the time was

Profiled per program on a cold production boot at the dawn start (low, play): `ready` 7 s → `compiled` 20.4 s, 28
programs linking, every one of them drawn (three culls by frustum, not occlusion). Isolated compile cost of each
(sources relinked with a nonce in a fresh context, HD 4600, low): the people's detail programs 4.8–7.9 s each (figure
LOD0 7.9, animal LOD0 4.9, prop LOD0 4.8), the far figures' 3.2, world lit programs 0.8–2.6 (water 1.9, whitewash 2.6,
altar wood 2.0, glass 1.7), env / FX / generators ≤ 1. About 43 s of compile on a pool that links three programs at a
time (measured: the 4th waits). At the dawn start every one of the 53 figures is a LOD3 silhouette, and hiding each
program's meshes in turn changed 0 px of the view for terrain, rock, water, olive groves, whitewash, the altar's wood and
the glass: ≈ 28 s of that compile was for nothing the first view shows. Medium: ≈ 100 s of compile (people 6–11 s each,
world 3.5–4.8 s), the same programs unseen.

### People: held programs (src/people, minimal)

- **Every figure and prop program but the far figures' (LOD2/3, one program) and the props' LOD1 is held during the
  boot** (`system.held(m)`, keyed by the material options, `userData.warmKey`): not issued at people init, skipped in the
  boot's compiles, not drawn — a figure needing one draws at a coarser LOD that is linked (people's existing fallback)
  or waits. Released at 'firstFrame'. — Alternative: hold only the LOD0-only programs (tried first: on medium LOD0 is
  LOD1's program, so that held nothing there).
- **A held key is released before the first frame when a figure that asked for it is in sight** (`people.wanted` =
  [key, position] collected in the discovery frames; main.js `inSight`: a ray from the eye to the figure's middle or
  head that no collider stops). Deep links with figures close keep their first view as before (slaughter / flaying
  views: 2–3 keys released, LODs identical, first frames identical but for edges). — Alternatives: release whenever a
  held batch is drawn (tried: from the dawn start the penned animals and the altar's limbs are in the frustum behind
  walls, and the 11 s animal program then set `compiled`); an id pass over the people (needs the GPU idle, see below).
- **A batch whose program is not linked, with nothing coarser to draw it, is not drawn until it links — for any program
  but the two never held** (`_waits`): the figure appears when ready instead of the frame freezing 3–11 s on a
  synchronous link. This also applies after the boot (a new animal right after a jump). — Alternative: draw it and stall
  (as before; it was rare when everything compiled at boot, and is no longer rare).
- **People's other variants are queued after the first view behind the world's deferred programs**
  (`compileLater`, 'warmup:issued'), no longer at 'warmup:tail' (they were exactly the held programs).

### World: materials the boot camera cannot see (render/warmup.js, main.js)

- **An id pass from the boot camera** (one ShaderMaterial override, each mesh its colour, depth-tested; opaque first,
  then transparent / alpha-tested meshes against that depth, picked by a layer of their own) **finds the lit materials
  none of whose meshes shows**; they are hidden (`material.visible`, so the sim's own `visible` toggles are untouched),
  left out of the boot's compiles, and compiled after the first view. — Alternatives: a static list of "not visible
  from dawn" (wrong for every deep link); CPU rays against colliders (decorative meshes are not colliders).
- **At the drawing-buffer size** (≤ 1600 px wide): at 400 px the soreg's 12 cm top rail was missed (866 px of the south
  view). Check (shot boot, everything shown, hide each deferred material in turn, diff the frame; the shadow passes kept
  as in play): low, 9 views (dawn start, Azarah d2, Heichal d3, instrument chamber, south Mount, aerial, east at n3,
  outside the walls d3, slaughter): 0 px in 8, 1 px (a parochet edge) in one; medium 4 views and high 3 views: 0 px.
- **First pass before people issue their programs; re-check after the view's programs are linked.** A pass links its own
  small programs at their first draw and reads pixels back: queued behind the boot's compiles that took 0.8 s (first
  pass after people init) and 2.3–3 s (re-check during the warm-up); before any is queued 0.17 s, after they are linked
  ≈ 0.1 s. The re-check redraws everything posed by the discovery frames (gates the sim opened, meshes made since):
  a material that shows after all is compiled before the first frame.
- **Deferred casters still cast** (medium+): the shadow-map render is wrapped to show them for the shadow passes only —
  depth programs, no lit compile. Hiding them there would also have left them out of the key light's cached map
  (render/shadow-cache.js re-draws only when its casters move). The probes, which capture without them, capture again
  once all are shown.
- **Revealed through one throttled queue after the first view** (`compileLater`: at most two programs linking, one new
  program per frame, each shown as it links, env bound on link). With all issued at once a program the frame needed
  synchronously (the probes' metering shader, a shadow depth variant) waited behind them: 2.3–3.3 s on medium, 5–16 s
  on high. The queue starts SETTLE_MS (2 s) after the first frame in play — the probes' first capture compiles with no
  queue ahead (224 ms → 3.3 s behind two) — at once in shot mode, where the screenshot waits for everything shown.
  warmHidden goes through the same queue. Order: what turning on the spot shows first (three yawed id passes at boot),
  then nearest. From the dawn start nothing deferred is seen by turning (the Mount's walls hide the Mount of Olives).
- **The people's shadow depth / distance programs are warmed at boot** (`compileDepth`), keyed as the shadow pass keys
  them: three draws a shadow map before it counts the frame's lights, so the key has a shadow but no lights, and the
  depth material's side flipped. Compiled with a light scene holding one bare `Light` that casts (registers a shadow,
  counts as no light type) and the side set as WebGLShadowMap sets it; verified by cache key (no second program later).
  They used to link inside the first frame; at dawn no figure casts then, and the first lamb at LOD1 froze medium 5 s
  and high 16 s (point-light distance variant) later.

### Results (HD 4600, Edge, cold production, `tools/warmup-check.mjs`; first frame, s)

| tier | before (this machine, today) | after | worst frame in the 5 s after (play) |
|---|---|---|---|
| low | 20.3 play / 20.9 shot | **12.8** play / 13.8 shot | 0.87 → 0.77 s |
| medium | 35.4 / 36.7 | **22.3** / 22.5 | 1.49 → 0.93 s |
| high | 52.5 / 51.8 | **29.9** / 32.4 | 1.65 → 1.17 s |
| ultra | 64.5 / 65.2 | **37.4** / 37.1 | 1.59 → 2.39 s (a probe read-back, `getBufferSubData`, both runs) |

`firstImage` follows `firstFrame` by 0.8–1 s on low. The QA's repro (`tools/shot.mjs --prod "t=alot-6"`): firstImage
low 22.8 → 14.7 s, high 51.5 → 33.0 s; the shot images before / after differ only at edges and one kneeling figure's
pose phase (`shots/gate-core/{before,after,diff}-{low,high}`). A screenshot boot itself now takes longer in total (it
waits for the deferred programs too). Deferred materials shown (play): low ≈ 4–6 s after the first frame, medium
≈ 16–18 s, high ≈ 22 s, ultra ≈ 32 s, behind the intro; from the dawn start none is in view until the visitor walks.

### Verification

- `node tools/warmup-check.mjs` all tiers × modes PASS (no material with two programs, also after the deferred ones are
  shown; it now waits for bootTimes.shown and reports it). `npm run build` passes.
- First drawn frame with and without the deferral (`?defer=0`), play, clock paused, low (8 views) and high (2 hero views):
  differences are the later material groups' bake progress (they start at the first frame, now earlier) and edges; no
  missing surface (the check above). `shots/gate-core/firstframe-*`.
- Context loss in the warm-up (lost right after people's init, low and high): the notice stays up (the boot's progress
  label stands down), reload at the same place, intro shown (the visitor never passed it).
- Sim: `jumps.js` deterministic, `views.js` ok (no stand / watch failures), `firstnight.js` ok. People: `propcheck` bad
  0, `covercheck` all clean. UI: `uitest.mjs` all passed. `validate-schedule` no gaps, `coverage` longest gap 7 min,
  `nav-coverage --q low` all reachable.

### Not done / for others

- env: the probes' metering shader (probes.js MEAN_FS) links at its first use after the first frame (224 ms idle on
  medium); adding it to `env.warmupMaterials()` would take it off the first seconds of play.
- ui: settingspanel.js reload() should call core/resume.js `reloadHere(ctx, { edit, delay: 250 })` (one resume path).
- 'warmup:tail' is still emitted but nothing listens to it now.

### Debug

`?defer=0` turns both the people hold and the world deferral off (A/B). `ctx.bootDeferred` = { world: [names], late,
people, released }; bootTimes gains `unseen` (after the first id pass) and `shown` (all deferred shown).
