# kodesh-night-fx — the night Kodesh on low was black

Scope: render/fx's local adaptation to firelight. Format: **choice** — why — alternative. Found while building
lowend-visuals (docs/decisions/lowend-visuals.md, "Found, not changed").

## What was wrong

- **Low's Kodesh at night (`q=low&at=136,330.5&look=270,5&t=n3`) rendered black but for the Menorah's steps.** fx scales
  every fire's light and emission by the viewer's local adaptation to firelight (`fx.stats.P` = env's exposure × a gain
  ≤ 1). That gain fell to 0.055 of env's there on every tier: `viewFireLuminance` (the firelit surfaces in view, sampled
  by five rays from the eye) read 0.525 cd/m² of firelight from fires outside the room, where the room itself is lit to
  ≈ 0.009 cd/m². Low's room light is the Menorah's point light and the room's fire fill (env/interiors.js `updateFill`),
  both at fx's gain: ≈ 20× too dark. Medium and up hid it: their Kodesh probe is captured at env's exposure.
- **The cause: the centre ray (40 % of the weight) did not end in the Kodesh.** The parochot are not colliders (curtains are
  movables, out of the collision soup), nor is the lul's curtain: the ray passed both curtains, the KhK and the lul slot in
  the west wall and hit the Azarah's strip behind the Heichal (site X 83). There the fire occluders (the courts' walls and
  the altar's top) do not hold the Heichal itself, so the altar counted at 13.7 lx.

## Choices

- **From inside a room, a view ray that leaves the room's box anywhere but an open aperture ends at the box**
  (`roomExit` in render/fx/index.js: the exit face and point against the room's apertures from env/interiors.js, open above
  5 %). — the eye cannot see through a wall, a shut door or a drawn curtain; whatever the colliders leave out (curtains,
  door leaves, slots) the room's box and apertures already describe. The sample then reads the room's own wall there: in
  the Kodesh, firelight from the Menorah (same room: env meters it) and the court through the gate (× the room's
  visibility). "Inside" is env's insideness > 0.5, so the outer face of a wall or a doorway's mouth is not clipped.
- Alternatives: make the curtains colliders (the player and nav would then collide with a curtain's folded leaves — a
  world-builder and player change, and the parochot are passed by the Kohen Gadol); raycast the curtains' geometry
  (they have no meshes of their own: a movable node drives merged geometry); add the Heichal to the fire occluders (true
  but separate: the strip behind the Heichal is not where the eye was).
- **Every tier changes where the eye is in a room at night with fires outside it** (the gain was low on all of them); see
  the comparison below. Outdoors (no room) nothing changes.
- **The fire fill of a gilded room is halved (`FILL_GOLD` 0.5, env/interiors.js).** — the fill stands in for the room's
  probe where there is none (low's Kodesh; medium+'s while its probe is stale, and during its first capture). Never seen at
  its real strength (the bug held it at ≈ 1/20), at 1 it lit low's Kodesh 2.6× medium's (linear mean), the gold walls 7×.
  Calibrated against medium's probe in the night Kodesh looking west: at 0.5 the floor and the parochet match it (0.0165 /
  0.0018 vs 0.0162 / 0.0016); the gold walls stay ≈ 2.8× medium's (they mirror the fill's even glow, not the probe's dark
  far end). Non-gilded rooms keep their fill. Alternative: a probe on low (each face redraws the world).

## Results

- **fx's firelight gain in the night Kodesh** (n3, looking west; `fx.stats.P` / env's `preExposure`): 0.055 → ≈ 0.85 of
  env's on low and medium (the sampled other-room firelight 0.525 → 0.0017 cd/m²).
- **Golden comparison** (`tools/goldens.mjs`, 6 views × 4 tiers against main's goldens; a second capture of this build
  differs by ≤ 0.09/255): 20 of 24 identical to main; the night Kodesh changes on every tier — low 13.5/255 mean (black → lit;
  luminance distance to ultra's image 6.1 → 5.1), medium 4.7, high 4.2, ultra 4.0 (the parochet, black on main, now a dark
  crimson in the Menorah's light; walls ≈ 1.8×, floor ≈ 2× in linear terms). Grid: `kodesh-night-fx/kodesh-n3.jpg`.

| night Kodesh, linear mean luminance (whole / gold wall / parochet / floor) | main | this fix |
|---|---|---|
| low | ≈ 0 (black) | 0.0071 / 0.0103 / 0.0018 / 0.0165 |
| medium | 0.0035 / 0.0025 / 0.0002 / 0.0096 | 0.0068 / 0.0045 / 0.0020 / 0.0181 |
| high | 0.0032 / 0.0026 / 0.0002 / 0.0087 | 0.0063 / 0.0047 / 0.0017 / 0.0170 |
| ultra | 0.0027 / 0.0024 / 0.0002 / 0.0072 | 0.0053 / 0.0043 / 0.0017 / 0.0137 |

- **Other night interiors** (medium, fx gain before → after): the Gazit and the Ulam unchanged; Beit HaMoked looking at its
  shut gate 0.71 → 1.0 — its view sampled the courts' firelight through the shut leaves (1.29 cd/m²); the hearth's light on
  the doors is a little brighter, nowhere near the burn-out SAME_ROOM_VIEW guards against.
