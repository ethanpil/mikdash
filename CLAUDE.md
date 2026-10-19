# Mikdash — project notes for developers and LLMs

Browser 3D walk-through of Har HaBayit and the Second Temple (three.js r186, WebGLRenderer, Vite).
Read `ARCHITECTURE.md` first: it holds the contracts, ownership map, frames/units and verification tools.

## Ground truth
- The research lives one level up (`../report/parts/*.md`, `../sources/`). It is the authority.
- `../engine/temple_manifest.json`, `../diagrams/`, `../video/` are SAMPLES (the user said so): use them only as
  cross-checks, never as the source of coordinates, timings or visual design.
- Geometry at runtime comes only from `src/data/site.js` (research-derived, self-checked dimension chains).

## Non-obvious choices (keep updated)
- Site frame X east / Y north / Z up in amot; world frame meters with −z north. Default amah 48 cm (R' Chaim Naeh).
- Everything is procedural (no downloaded textures/models/audio) for size, licensing and load speed.
- Simulation is a pure function of sim time so the clock can be scrubbed/jumped instantly.
- `THREE.Clock` is deprecated in r186 → engine uses `THREE.Timer`.
- Dev machine GPU is an Intel HD 4600: the `low` tier is tuned against it.

## Tools
- `npm run dev` / `npm run build`
- `node tools/shot.mjs "at=X,Y&look=heading,pitch&t=sunrise+10"` → `shots/*.png` + console/draw-call report.
