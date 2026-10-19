// PLACEHOLDER — to be replaced by the site-model task (see ARCHITECTURE.md §Site model).
// The real file is derived from the research report (report/parts/*.md) and the Hebrew primary
// sources, NOT from engine/temple_manifest.json (a sample, used only as a cross-check).
export const SITE = {
  meta: {
    frame: 'X east, Y north, Z up; amot; origin = SW corner of the 500x500 clear interior of Har HaBayit; Z0 = threshold of the eastern gate',
    status: 'placeholder',
  },
  // Elevation ladder — report §0.4 (Middot 2:3–2:6, 3:6; Rambam BhB 6:1–5)
  datums: { mount: 0, ezratNashim: 6, ezratYisrael: 13.5, azarah: 16, heichalFloor: 22, crown: 116 },
  elements: {},
  chains: [],
};
export function el(id) { return SITE.elements[id]; }
