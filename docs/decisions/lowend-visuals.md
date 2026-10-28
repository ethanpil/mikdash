# lowend-visuals — better images on weak GPUs (low, and medium where it helps), no bake pipeline

Scope: the user asked to raise the low tier's (and where it helps medium's) visual quality on the HD 4600 without slowing
older hardware or lowering any tier, in the lean form: no lightmap atlases, no UV2 baking, no KTX2 textures, nothing baked at
build time. Format: **choice** — why — alternative. Tools: `tools/goldens.mjs` (new: per-tier golden screenshots and their
comparison), `src/render/dev/lowend-ab.mjs` (new: interleaved cold A/B of two checkouts), `tools/warmup-check.mjs`.

## Capability flags (src/core/quality.js)

| flag | low | medium | high | ultra |
|---|---|---|---|---|
| `shadows` | `'static'` (was `false`) | `'cached'` (was `true`) | `'cascaded'` | `'cascaded'` |
| `aa` | `'fxaa'` (was `'none'`) | `'smaa'` | `'smaa'` | `'smaa'` |
| `ao` | `'volume'` (was `false`) | `'volume'` (was `false`) | `'n8ao'` (was `true`) | `'n8ao'` (was `true`) |
| `interiors` | `'volume'` | `'volume'` | `'exact'` | `'exact'` |
| `shadowMapSize` | 2048 (was 1024, unused) | 2048 | 4096 | 4096 |

- **Every new path is chosen by a flag value, never by the tier's name.** — render/index.js picks the shadow class from
  `shadows`, post.js builds N8AO for `ao === 'n8ao'`, pipeline.js builds FXAA for `aa === 'fxaa'`, env builds the visibility
  volume for `interiors` / `ao === 'volume'`. One helper keeps the figures' rule in one place: `figuresCastShadows(q)` (only
  'cached' and 'cascaded' maps hold figures). Truthiness of `shadows` / `ao` is kept for
  old readers (`renderer.shadowMap.enabled = !!q.shadows`).
- **people/system.js reads `figuresCastShadows`** — three lines; without it low's figures would build shadow proxies and
  depth programs for a map that never draws them. (The one change outside env/ and render/ besides the boot hooks below.)

## Low: static sun shadows (render/shadow-cache.js `figures: false`)

- **'static': no per-frame shadow pass at all.** — `KeyShadowCache({ figures: false })` scans the static casters' signature
  each frame (as medium's cache does) and calls three's shadow render only when it changed: the light's framing, a caster's
  matrix / draw range / instance count / buffers / visibility, or a material bake. The casters are drawn straight into the
  map (no cache target, no depth blit, no figures). Measured: 2 re-renders in the 202 frames of a screenshot boot in the
  Azarah. Alternative: medium's cached map + a per-frame figures pass (a depth blit and every figure's depth draw every frame).
- **Figures keep their contact shadows and cast nothing into it.** — they move every frame, which would need the per-frame
  pass; low already draws contact blobs under every figure (people/contact.js CONTACT tier 0). They receive the map.
- **A caster that keeps changing (the golah wheel, a door mid-swing) is left out of the map until still for 90 frames.** —
  two re-renders per door swing instead of one per frame; the leaf has no sun shadow while it swings.
- **env holds the framing over R / 8 (setShadowHold step) instead of R / 16** — a re-render about every 10 m of walking at
  the Sun's usual ±80 m extent instead of 5 m; the map still reaches ≥ 87 % of R round the ideal centre.
- **The held framing grows with the viewer's height above the ground** (over 25 m: R = 1.4 × height, ≤ 240 m, and it leads
  to where the view meets the ground). — from the aerial view (115 m up) the ±80 m map round the camera missed the courts
  entirely; medium had the same gap. Ground views (height ≈ 1.6 m) are unchanged. Applies wherever render caches the map
  (low and medium); high / ultra's cascades fit the view themselves.
- **One hardware PCF tap on low (`shadowFilter: 'pcf1'`).** — three's lookup is 5 Vogel-disk taps of a hardware 2 × 2
  compare; GPU timer in one page, low Azarah: 4.3 ms of a 22.5 ms frame with 5 taps, 1.6 ms with 1. The penumbra becomes one
  texel (7.8 cm at ±80 m, 2048 map). render/shadows.js `setShadowTaps` swaps only the 2D-map lookup (the fires' cube maps
  keep theirs); a change recompiles the lit materials. Alternative: 5 taps (the medium look) — 2.7 ms more on every frame.
- **2048 map on low** (the tier listed 1024, unused): with no per-frame pass the map's size costs only memory (16 MB) and
  the rare re-render; 1024 would double the texel to 15.6 cm.

## Low: FXAA (render/fxaa.js)

- **Copy the finished canvas, filter it back, instead of drawing into a render target.** — three compiles render-target
  programs without its in-shader tone mapping and output conversion, so drawing low's world into a target would re-key every
  lit program (a second 1–2.5 s compile each on ANGLE/D3D11). `copyFramebufferToTexture` + one full-screen triangle leaves
  every program as it was; the pass's own program is issued with the pipeline, seconds before the first frame.
  Cost (GPU timer, low Azarah): ≈ 0.5 ms (copy ≈ 0.25, filter ≈ 0.25). Alternative: MSAA (a context attribute: the canvas is
  created before the tier is known, and 4× MSAA's bandwidth on an iGPU).
- **The filter is FXAA 3.11 as Jasper Flick restates it**, with an early exit on flat pixels (4 neighbour taps) and a 6-step
  edge walk; luma from the display-referred sRGB values the canvas holds.

## The visibility volume (env/visibility.js, visibility-core.js, visibility.worker.js)

- **Rooms: a brick per room of each opening's share, not the room's V.** — V = base + Σ share × weight is linear in the
  openings' weights (openness × brightness beyond), which the exact path already packs into the uniform block every time a
  door or curtain moves. So the brick holds the shares at weight 1 (RGBA = up to 4 openings: no room has more) and the shader
  takes `dot(shares, weights)`: doors never trigger a recompute, and V is exactly the exact path's sum at each texel
  (`computeRooms` evaluates the shader's own cheap aperture form). Alternative: V itself per texel (a recompute and upload
  on every door step).
- **Per-room bricks, cells 0.4–8 m per axis, ≤ 32 texels along an axis.** — world-space 4 m pages at 0.5 m needed 5 650
  bricks (45 MB): the four 240 m stoas dominate. Per axis the stoa is coarse along its length (its V is constant there) and
  fine across it. 45 rooms → 610 k texels in a 249 × 157 × 33 RGBA16F atlas (10.3 MB; layer / row packing), computed in the
  worker in ≈ 0.1–0.2 s at env init; main.js awaits it before the first frame (it is always ready long before).
- **The room search (plan grid, half-box depth, the shell and join rules) stays exact; only the per-aperture loop goes.** —
  the shell rule (outward faces near a box's boundary count as outside) and the joins (a parochet between two rooms) need
  the fragment's normal against the box, which a sampled field cannot hold. The volume path reads the room's brick (one
  trilinear fetch + three block reads) instead of looping over its ≤ 4 apertures (each: a block read, the solid angle, the
  reflection's exit, the key light's exit, the F1 window slots).
- **What the volume path drops:** the key light's per-aperture mask (`mkSun` = 1: every volume tier has a shadow map, and
  the map's walls and roof are the mask; the windows let the Sun in where they are holes in the geometry), and the exits
  through openings other than the main one (the reflection's exit and a gilded room's analytic environment use the main
  opening alone; the Kodesh's main opening is the great gate). Medium's Kodesh and Ulam reflect from their probes as before.
- **Precinct AO: a 2 m grid of SH L1 obscurance (a + b·n), radius 6 m, 48 rays a cell.** — "large-scale" AO: the feet of the
  courts' walls, under the stoas' roofs, in gate passages, round the altar and the tables, the corners of the rooms. Applied
  to the image-based light only (sky, probes, the rooms' openings, the fire fill): the direct Sun is the shadow map's, the
  fires' light their own. Rough reflections are occluded like the diffuse light (× mix(1, ao, roughness)).
- **Inside a room the AO is divided by the room's mean.** — the room's enclosure is already its V; what remains is the
  corners and the floor under low ceilings. Without it a 5 m chamber was darkened twice.
- **Ray-marched through a 1 m voxelisation, not ray-cast on the BVH.** — three-mesh-bvh's raycastFirst ran ≈ 5 min for the
  10.5 M rays in the browser's worker; marching voxels takes 1.6 s for the same rays (Node) and the voxelisation 0.5 s once
  the large terrain and plaza triangles are clipped to the grid before sampling (unclipped: 225 M samples, 3.2 s). The
  inside of solids is found by flood-filling the open air from the grid's top and sides (no reliance on winding).
- **After the boot's background compiles have drained (bootTimes.drained, ≤ 60 s after the first view; a screenshot starts
  it at once and waits); cached in IndexedDB** under FNV-1a of the soup, the rooms and the grid parameters (four newest
  entries kept). Started 6 s after the view, the worker shared the CPU with ANGLE's post-boot links and took 24–37 s (the
  same computation on the page's own thread: 2.9 s); after the drain it takes a few seconds. The AO fades in over 1.5 s.
  Later visits load it at once.
- **Samplers through three's ShaderLib uniforms, with textures whose clone() returns themselves.** — a sampler a program
  declares but no material binds stays at unit 0, where the material's own sampler2Ds are: "two sampler types on one unit",
  a GL error that drops the draw. Registered in ShaderLib.standard / physical before any lit program compiles, three binds
  them per draw like any map; its per-material uniform clones share the one texture.
- **Exact interiors stay on high / ultra** (`interiors: 'exact'`), with their N8AO; nothing of the volume is built there.

## Medium

- **Medium takes the volume's room path and AO too (`interiors`, `ao`: 'volume'); its shadows (`'cached'`, 5 taps), SMAA,
  probes and bloom are as before.** — the per-aperture loop ran over up to 8 rooms a fragment on medium; its AO had none.
  Its Kodesh and Ulam keep their probes (no exit test there either way).
- **Medium's held shadow framing grows with the viewer's height as low's does** (an aerial: the map covered ±80 m round the
  camera, not the courts in view).

## The guard: tools/goldens.mjs

- **Six views × four tiers, one cold page each, shot mode** (spawn before dawn; the Azarah at day hour 3 from its north-east
  looking at the altar and the Ulam; the Kodesh at night hour 3 and day hour 3 looking west; Har HaMishchah at sunrise; an
  aerial over the south-east corner at day hour 3). Base = main's checkout (a `git worktree`), captured twice: the second
  capture is the noise floor (≤ 0.12/255 mean everywhere but the low spawn, 0.76, whose exposure is still easing).
- **Verdicts.** A tier whose flags did not change must be unchanged: mean and share of pixels over 8/255 within 1.5 × the
  noise + ε, floors 0.35/255 and 1 % (the flames and smoke animate in real time even in shot mode: 0.2–0.8 % of a view with
  fires). A tier whose flags changed (`--expect low,medium`) may change but not move away from the reference tier (ultra) in
  luminance at 1/8 resolution (the lighting, not the edges): "closer to reference", "changed, as close", or FAIL. Writes a
  JSON report, a contact sheet (before | after | difference × 4) and a summary grid.
- Alternative: committed golden PNGs — 24 PNGs of 1–2 MB in a public repository whose base changes with every lighting
  task; the base is one `git worktree` away.

## Found, not changed (follow-ups)

- **Low's Kodesh at night is black on main already.** fx's local adaptation to firelight (render/fx `viewFireLuminance`)
  reads ≈ 0.5 cd/m² of firelight from fires outside the room in that view on every tier, so its gain falls to ≈ 0.05 of
  env's exposure: the Menorah's light and low's fire fill (interiors.js `updateFill`, scaled by fx's gain) are ≈ 20× too
  dark. Medium and up hide it because their Kodesh probe is normalised by env's exposure. Fixing the view estimate changes
  the Menorah's direct light on every tier, so it is left for its own task.
- **The night Kodesh golden stays unchanged on low** for the same reason (nothing of this task lights it).

## Performance (HD 4600, Edge, production bundles, `src/render/dev/lowend-ab.mjs`)

Each sample is a cold browser in normal play (Enter at once); frames are timed for 10 s once the boot's background compiles
have drained and the first-visit AO has landed; main (a worktree of `fd7e239`) and this branch alternate. The machine ran
other processes throughout (the desktop app and Explorer ≈ 3 of 4 threads at times): main's own low spawn read 38.8–45.0 fps
across batches. Compare within a row.

| low, fixed resolution (`fixedres=1`), mean of 2 interleaved pairs | main | this branch |
|---|---|---|
| spawn before dawn (fps) | 43.5 | 39.3 |
| Azarah, day hour 3 (fps) | 40.4 | 37.3 |
| Kodesh, day hour 3 (fps) | 34.2 | 37.5 |
| first view: spawn / Azarah / Kodesh (s) | 14.2 / 19.9 / 11.5 | 14.7 / 18.4 / 11.7 |
| low, adaptive resolution (shipping), 1 pair: fps (scale) | 58.4 (0.50) / 58.8 (0.66) / 59.6 (0.56) | 59.7 (0.54) / 56.3 (0.50) / 59.9 (0.50) |

- **Outdoors low pays ≈ 2.5–3 ms for the three new features at a fixed resolution; in the Kodesh the volume path more than
  pays for them.** GPU timer in one page, low Azarah: one-tap shadow lookup ≈ 1.6 ms (5 taps: 4.3), FXAA ≈ 0.5 ms (copy and
  filter ≈ 0.25 each), AO ≈ 0.5–0.9 ms; run-to-run noise ± 0.5 ms. With adaptive resolution (the shipping behaviour) both
  builds hold 56–60 fps; on this loaded machine both already sit near the 0.5 scale floor there. If outdoor parity at a fixed
  resolution matters more than the images, the flags are the knobs: `ao: false` (−0.5–0.9 ms), `aa: 'none'` (−0.5 ms).
- **Cold boot does not regress:** first view within ± 1.5 s of main in every pair (the volume path's programs are smaller:
  no aperture loop; the room bricks are ready in ≈ 0.1–0.4 s, long before the warm-up ends).
- **Medium** (1 interleaved pair, fixed resolution): spawn 16.3 → 16.0 fps, Azarah 12.9 → 11.5, Kodesh 10.2 → 13.4; first view
  23.6 → 22.3 s, 31.3 → 30.8 s, 19.7 → 19.1 s. (At 60–120 ms frames one pair is noisy; the Kodesh gain is the per-opening loop
  of up to 8 rooms a fragment gone.)
- **The frame after the first view waits ≈ 0.9 s in one synchronous query on low — on main too** (warmup-check, same batch:
  main 934 ms / 874 ms in getUniformBlockIndex, this branch 951 ms / 874 ms; first view 13.6 s vs 13.2 s). perf-fix-2's 0.3 s
  was measured on a less loaded machine.
- **First-visit AO:** the worker starts once `bootTimes.drained` is set and takes 3.7–11.8 s there (24–37 s when it started
  6 s after the view, beside ANGLE's link threads); cached in IndexedDB for later visits.

## Golden comparison (tools/goldens.mjs; main vs this branch, noise = a second capture of main)

Mean absolute difference (/255) and the verdict; for low and medium also the luminance distance to ultra's image at 1/8
resolution before → after (lower is closer). Report: `docs/decisions/lowend-visuals/goldens-final-vs-base.json`; grid:
`docs/decisions/lowend-visuals/summary.jpg` (each view: low before / after, medium before / after, ultra).

| view | low | medium | high | ultra |
|---|---|---|---|---|
| spawn-predawn | 1.09 — closer to reference (3.5 → 3.0) | 0.77 — closer to reference (3.0 → 2.7) | 0.12 — unchanged | 0.03 — unchanged |
| azarah-d3 | 17.31 — closer to reference (18.5 → 13.4) | 2.10 — closer to reference (6.8 → 6.1) | 0.12 — unchanged | 0.03 — unchanged |
| kodesh-n3 | 0.02 — unchanged (6.1 → 6.1) | 0.16 — unchanged (1.6 → 1.4) | 0.00 — unchanged | 0.00 — unchanged |
| kodesh-d3 | 1.16 — changed, as close (24.2 → 24.2) | 1.47 — closer to reference (7.3 → 5.9) | 0.01 — unchanged | 0.00 — unchanged |
| mishchah-sunrise | 0.15 — unchanged (5.4 → 5.4) | 0.01 — unchanged (4.6 → 4.6) | 0.00 — unchanged | 0.00 — unchanged |
| aerial | 6.13 — closer to reference (13.9 → 8.9) | 5.56 — closer to reference (10.4 → 5.3) | 0.00 — unchanged | 0.00 — unchanged |

## Verification

- `tools/goldens.mjs --label final --against base --noise base2 --expect low,medium`: PASS (table above).
- `tools/warmup-check.mjs` (every tier, shot and play, cold production): ALL PASSED. First view in play: low 13.6 s,
  medium 21.9 s, high 33.5 s, ultra 47.5 s (the machine loaded as above). No material with two programs; 'compiled' → first
  frame +108 ms (low) … +377 ms (ultra).
- `tools/validate-schedule.mjs` (0 errors), `tools/coverage.mjs` (no gaps), `tools/nav-coverage.mjs --q low` (all reachable),
  `src/sim/dev/tests/objects-check.mjs` (ok), `src/sim/dev/run.mjs` jumps, firstnight, fires, inspect and inspect-show
  (`inspect=1`) all ok, `src/ui/dev/consoletest.mjs --q low`: ALL PASSED (272 checks).
