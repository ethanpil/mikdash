# world-4-fix — decisions

The review findings on world-4. Scope as world-4: `src/world/**`, including `src/world/materials/**`. Format:
**choice** — why — alternative. ⚙ = reconstruction. Shots: `shots/world-4-fix/{before,after}/{low,medium,high}/`;
tests: `shots/world-4-fix/tests/`.

## Fixed

- **Gazit arm ends closed: the amphitheatre's two end caps take the hint −X (chambers.js `amphitheatre`).** Both caps lie
  in the plane X = sx and face the open side. `Mesher.poly` projects onto the hint's dominant axis, so the old ±Y hint
  projected onto (X, Z), which is a line, and gave 0 triangles. With −X it projects onto (Y, Z): 8 triangles each, area
  10.8 amot², exactly the stepped profile. The caps are in the collide bucket, so the stepped arm ends now block as
  well as show (`gazit-arm-n-day`, `gazit-arm-s-day`, `gazit-benches`). Alternative: a hint from the cap's own normal
  inside `poly` (would change every caller).
- **Shofarot (en.js `shofarot`).** Each chest gains:
  - iron angle-irons at its four corners and two bands round the body;
  - a two-board lid whose lower board overhangs 0.07 amah all round (its lip);
  - on the front (the giver's side, facing out of the ring), a hasp from the lid over a staple, with a hanging lock;
  - two strap hinges at the back;
  - on the front, a framed label field: a `cedar_v` panel inside a cedar frame 2 etzba'ot proud, because "written on
    them" (Shekalim 6:5). The writing itself is not drawn (no text textures).

  ⚙ fittings. Everything goes into buckets the courts already draw on every tier (`cedar`, `cedar_v`, `iron` no-shadow),
  so no draw calls are added (low courts: 42 meshes before and after). The horn is now `copper_worn`, hammered copper
  under a brown oxide film with its ridges rubbed bright. The courts' only other copper users, the nazirite pits' pots
  and the Golah's bucket, are working vessels and moved with it, so `copper_worn` replaces the `copper` bucket instead of
  adding one. Nechoshet is copper or its alloys, so nothing is claimed beyond the source. Alternative: a bronze key for the
  horn. The only one is `bronze_corinthian`, Nikanor's special gold-bright bronze (wrong for alms horns), and it would
  add a draw call.
- **`copper_worn` (materials/gen/sets.js `copperworn`): the oxide film darker and mostly dielectric.** uP3.x 0.4 → 0.7,
  uC1 #4f3328 → #3d271f, tarnish 0.88 → 1 (an even film; 0.9 still read salmon at high), its roughness +0.04; flat
  fallback #6b4535 / 0.45. At 0.4 the film stayed
  metallic, mirrored the bright court and baked as light salmon copper, the same hue as the cedar. That contradicted the
  key's own description ("an even brown oxide film rubbed bright along the ridges"). The key had no users before this
  task. Alternative: darken the cedar (a new material and a draw call; cedar is shared by the courts' woodwork).
- **The gozlei olah label follows the Sages: "birds that are all olot (the Sages; R' Yehudah: young pigeons)".** Shekalim
  6:5 has R' Yehudah identify kinnin as turtledoves and gozlei olah as young pigeons. The Sages say kinnin are one chatat
  and one olah, and gozlei olah are all olot. The old label mixed his identification with their ruling, while the kinnin
  label followed the Sages.
- **The incoming showbread: a second movable `heichal.shulchan.bread.incoming` (vessels.js `breadMovable`).** It is a
  clone of the bread group: same geometry and materials, no added memory, and draw calls only while shown. Its defaults:
  hidden, slid off to the north (`slide(1, false)`), and kanim out, because the new bread is set down on Shabbat and the
  kanim go back in after it (Menachot 11:6). In the exchange the outgoing set is at `slide(f, true)` and the incoming at
  `slide(1 − f, false)`. They stay exactly D = (depth + horns) × amah apart, horn tip beside horn tip, so the table is
  never bare: "these draw and those set down, the handbreadth of this one beside the handbreadth of that" (Menachot
  11:7). Measured: 0.616 m at f = 0, ¼, ½, ¾, 1. At the end both sets are identical, so the sim swaps back (main on the
  table, incoming hidden) and nothing visible changes. The G6 request in world-4.md is rewritten to match. Alternative:
  the incoming bread as carried props (they would need the loaves' geometry, which people/ does not have).
- **Altar bark on low: every billet walnut at detail 0 (fire.js `species`, kitchen.js `species`).** This is what the
  courts already do at detail 0. Low now has one bark mesh in the altar batch and one in the movable pile (was three
  each): altar meshes on low 39–40 → 35. Walnut is `timber_rough`'s set, baked on low anyway, so no texture is added.
  Medium and up keep fig / walnut / pine per billet and the all-fig incense pile. The kevesh brands exist only at
  detail ≥ 1. Alternative: fig at detail 0, true to the incense pile on every tier, but it costs a bark bake on low and the
  4 cm sticks cannot be told apart there.

## Rejected (with evidence)

- **"The minimum gifts (two gizrin, a handful of levonah, a gold dinar) come from Menachot 13:3–4, but every label cites
  Shekalim 6:5–6."** The citation is correct. Shekalim 6:6 itself opens with those minimums (Sefaria, Mishnah Shekalim
  6:6, Hebrew text checked). Menachot 13:3–4 repeats them, and the SHOFAROT comment now names it as the parallel. The
  labels keep "Shekalim 6:5–6".

## Not world's (requests)

- **Sanhedrin judges sunk in the new tiers (sim).** sanhedrin.js:28 `GZ.tz` is still [0.9, 1.5, 2.1, 2.7]. Set it to
  [1, 2, 3, 4], or read anchor `courts.gazit.benches`. The Nasi's stand point (line 121) lies on the 0.35 footstool
  (r 3.85–4.55, |Y − cy| < 0.75): `zf = s.nasi ? GZ.Z + 0.35 : …`, and his `climb` needs a step onto it. The tier
  change must land in the same commit, or be held back until it can.
- **Ulam wing streak (render).** Unchanged: the box-projected probe at the stone's roughness. Keep the render request
  open.

## Verification

- `npx vite build` passes (output deleted). site.js `runChecks()`: ok, 1553 checks, 0 failures (site.js untouched).
- nav-coverage (low): 132 targets; the only failures are `roof` from both origins, as before. 893,581 nodes (as
  world-4); collider triangles 98,350 (98,334 + the two caps' 16).
- Sim tests (low, `tests/`): g4 ok (deterministic; the same one close pair of sim walkers, 0.289 m at 14:15), fires
  ok, g2 ok (0 bad ways), g6 ok, jumps ok, g1-night ok (failed []). validate-schedule 0 errors / 0 warnings; coverage
  no gaps (longest 7 min).
- `tests/fix-check.js` (low and high):
  - both bread movables registered and sharing geometry and materials;
  - the incoming defaults are hidden, f 1 north, kanim out;
  - the gap is 0.616 m at every f;
  - the swap back leaves the main set on the table;
  - low bark meshes: `altar:timber_bark_walnut` and `altar.maarachah.great.pile:timber_bark_walnut` only;
  - courts on low: 42 meshes, as before (`copper` → `copper_worn`).

  Low meshes: courts 42, altar 35 (was 39–40), heichal 44, of which the 4 incoming meshes are not drawn while hidden.
- Console: no errors or warnings in any shot or test. The one logged line is the harness cold-start timeout on the
  first high shot, re-shot with `--timeout 300`.
- Shots read:
  - `gazit-arm-n-day`, `gazit-arm-s-day`, `gazit-benches` (low, medium, high): arm ends closed, no floating slabs.
  - `shofarot`, `-close`, `-front`, `-top` (low, medium, high): bands, corner irons, lipped lids, hasp and lock,
    hinges, label fields; the horns dark oxidised copper beside the cedar at high.
  - `nazirites`: the pots in worn copper.
  - `altar-pile`: walnut on low, mixed on high.
  - `tests/{low,high}/shulchan-*`: at rest, mid-exchange (both sets side by side on the table), done, and swapped back
    with the kanim out.
