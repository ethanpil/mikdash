// Roles → archetypes (mesh recipe + rig) and their variation (palettes, optional garment parts).
// Population: Jews of the late Second Temple period — olive to light-brown skin, dark hair, adult men bearded.
// Ordinary dress (reconstruction, see docs/decisions/people.md): undyed / natural wool and linen tunics,
// some with darker clavi stripes, mantles (tallit) with tzitzit; women in long garments, head covered.
// Priestly dress per report Part VIII §34. Levites: NO Mishnaic uniform — plain light garments (flagged).
import { Color } from 'three';

// palette: skin ×2, hair ×2, garment A ×4, garment B ×4, stripe ×2 — then the garment colours chosen by Actor.setGarb /
// a role's `garb`: black (A, B) and white (A, B) at 14–17 (tint index 4 = black, 5 = white; material.js pPalette)
export const GARB = { black: 4, white: 5 };
const GARB_COL = ['#2a2622', '#1f1c1a', '#ece8dd', '#f2efe7'];
const pal = (skin, hair, ga, gb, stripe) => [...skin, ...hair, ...ga, ...gb, ...stripe, ...GARB_COL].map((h) => new Color(h));
const SKIN = ['#c89c78', '#86593a'];
// (qa-r1: the darkest hair a very dark brown, ~3 % albedo, not a 1 % black — at a distance the beards and hair read as
// flat black masks and helmets; the period's population: dark brown to black hair)
const HAIR = ['#2e221a', '#a69f95'];
const LINEN = ['#efeadf', '#f2eee5', '#ebe5d9', '#f0ece2'];

export const ARCHETYPES = {
  kohen: { rig: 'man', recipe: 'kohen', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  kg_gold: { rig: 'man', recipe: 'kg_gold', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  kg_white: { rig: 'man', recipe: 'kg_white', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  // an elder of the beit av in the four garments (the elder rig, grey); a kohen in the michnasayim only; a bather
  kohen_old: { rig: 'elder', recipe: 'kohen_elder', palette: pal(SKIN, ['#3a342e', '#d7d2c8'], LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  kohen_breeches: { rig: 'man', recipe: 'kohen_breeches', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  kohen_bathing: { rig: 'man', recipe: 'kohen_bathing', palette: pal(SKIN, HAIR, ['#e9e3d4', '#e4dccb', '#ece6d9', '#dfd7c6'], LINEN, ['#5c3a2c', '#3c3a46']) },
  kohen_bathing_old: { rig: 'elder', recipe: 'kohen_bathing', palette: pal(SKIN, ['#3a342e', '#d7d2c8'], ['#e9e3d4', '#e4dccb', '#ece6d9', '#dfd7c6'], LINEN, ['#5c3a2c', '#3c3a46']) },
  levi: {
    rig: 'man', recipe: 'levi',
    palette: pal(SKIN, HAIR, ['#dccdaf', '#d3c3a2', '#e2d5b8', '#cdbb98'], ['#c3ad88', '#b49f7d', '#cfbf9e', '#a28e6c'], ['#6a4a35', '#4f4a3e']),
  },
  israelite: {
    rig: 'man', recipe: 'israelite',
    palette: pal(SKIN, HAIR, ['#dccfb3', '#c6af8a', '#b09572', '#d2c2a2'], ['#d4c7ac', '#ad9878', '#87705a', '#bfb093'], ['#5a2c23', '#4a3328']),
  },
  // a metzora as Vayikra 13:45 describes him: the tunic rent at the breast, the hair let grow (Rashi; Moed Katan 15a)
  metzora: {
    rig: 'man', recipe: 'metzora',
    palette: pal(SKIN, HAIR, ['#cbbd9f', '#b39c79', '#a08867', '#c2b293'], ['#c4b79b', '#9d8a6c', '#7d6a55', '#b0a286'], ['#5a2c23', '#4a3328']),
  },
  // the mourner and the menudeh: the Israelite with the head-cloth wound as the atifah (human.js wrapDrape; people-4-fix)
  mourner: {
    rig: 'man', recipe: 'mourner',
    palette: pal(SKIN, HAIR, ['#dccfb3', '#c6af8a', '#b09572', '#d2c2a2'], ['#d4c7ac', '#ad9878', '#87705a', '#bfb093'], ['#5a2c23', '#4a3328']),
  },
  nazir: {
    rig: 'man', recipe: 'nazir',
    palette: pal(SKIN, HAIR, ['#dccfb3', '#c6af8a', '#b09572', '#d2c2a2'], ['#d4c7ac', '#ad9878', '#87705a', '#bfb093'], ['#5a2c23', '#4a3328']),
  },
  elder: {
    rig: 'elder', recipe: 'elder',
    palette: pal(SKIN, ['#3a342e', '#d7d2c8'], ['#e4dac6', '#d6cab3', '#ebe3d2', '#cdbfa6'], ['#ece5d6', '#d3c9b4', '#bcb098', '#9b8e77'], ['#4b3a2f', '#3b3f52']),
  },
  woman: {
    rig: 'woman', recipe: 'woman',
    palette: pal(SKIN, HAIR, ['#c4ab84', '#9e6249', '#6c7889', '#d4c4a6'], ['#e6ddca', '#c9b593', '#a7aeb4', '#b48d70'], ['#5a2c23', '#3b3f52']),
  },
  boy: {
    rig: 'boy', recipe: 'boy',
    palette: pal(SKIN, HAIR, ['#dccdaf', '#d3c3a2', '#e2d5b8', '#cdbb98'], ['#c3ad88', '#b49f7d', '#cfbf9e', '#a28e6c'], ['#6a4a35', '#4f4a3e']),
  },
  child: {
    rig: 'child', recipe: 'child',
    palette: pal(SKIN, HAIR, ['#dccfb3', '#c6af8a', '#b8a07c', '#d2c2a2'], ['#d4c7ac', '#ad9878', '#87705a', '#bfb093'], ['#5a2c23', '#4a3328']),
  },
};

/**
 * role: { arch, mantle (probability of the mantle), headcloth (probability), grey: [min,max] hair greying,
 *         prop / pose defaults, scale: [min,max],
 *         offduty (in 'sleep' / 'lie': own clothes = offArch (default 'israelite') on offProp (default 'folded_garments')),
 *         bathArch (in 'bathe': the bathing figure) }
 */
export const ROLES = {
  // offduty: in 'sleep' / 'lie' the figure wears its own clothes and sleeps on the folded holy garments (Tamid 1:1)
  kohen: { arch: 'kohen', grey: [0, 0.35], scale: [0.95, 1.05], offduty: true, bathArch: 'kohen_bathing' },
  segan: { arch: 'kohen', grey: [0.2, 0.55], scale: [0.98, 1.04], offduty: true, bathArch: 'kohen_bathing' },
  kohen_gadol: { arch: 'kg_gold', grey: [0.15, 0.5], scale: [1.0, 1.04], lowBlessing: true, offduty: true },
  kohen_gadol_white: { arch: 'kg_white', grey: [0.15, 0.5], scale: [1.0, 1.04], lowBlessing: true, offduty: true },
  // a kohen out of the holy garments: his own tunic and mantle, head bare (Tamid 1:1 "they cover themselves
  // with their own clothes"); pose sleep/lie adds the folded garments under his head
  kohen_offduty: { arch: 'israelite', mantle: 1, headcloth: 0, grey: [0, 0.35], scale: [0.95, 1.05], offduty: true, bathArch: 'kohen_bathing' },
  // the elders of the beit av who sleep on the stone rovadin of Beit HaMoked with the keys (Tamid 1:1): in the four
  // garments when serving; asleep in their own clothes on their folded garments, the kesset folded to fit the ledge,
  // covered by their own mantle. kohen_elder_offduty = the same man in his own clothes when awake.
  kohen_elder: { arch: 'kohen_old', mantle: 1, headcloth: 0, grey: [0.55, 1], scale: [0.96, 1.03], offduty: true, offArch: 'elder', offProp: 'folded_garments_ledge', bathArch: 'kohen_bathing_old' },
  kohen_elder_offduty: { arch: 'elder', mantle: 1, headcloth: 0, grey: [0.55, 1], scale: [0.96, 1.03], offduty: true, offArch: 'elder', offProp: 'folded_garments_ledge', bathArch: 'kohen_bathing_old' },
  // stripped by the chazzanim to the michnasayim only (Tamid 5:3)
  kohen_breeches: { arch: 'kohen_breeches', grey: [0, 0.35], scale: [0.95, 1.05], bathArch: 'kohen_bathing' },
  // immersing, drying and warming himself at the fire in a linen wrap (Tamid 1:1–2; Yoma 3:3)
  kohen_bathing: { arch: 'kohen_bathing', grey: [0, 0.35], scale: [0.95, 1.05] },
  levi: { arch: 'levi', mantle: 0.55, grey: [0, 0.3], scale: [0.95, 1.05] },
  guard_levi: { arch: 'levi', mantle: 1, grey: [0, 0.3], scale: [0.97, 1.05], prop: 'torch', pose: 'torch' },
  levi_boy: { arch: 'boy', grey: [0, 0], scale: [0.92, 1.06] },
  israelite: { arch: 'israelite', mantle: 0.85, headcloth: 0.3, grey: [0, 0.45], scale: [0.94, 1.05] },
  nazir: { arch: 'nazir', mantle: 0.8, grey: [0, 0.2], scale: [0.95, 1.04] },
  // the same man shaven (the same seed gives the same face, skin, build and garments as 'nazir'): his head shaved in the
  // nazirites' chamber at the end of his term (Bamidbar 6:18; Middot 2:5); Actor.setShaven toggles it on one actor
  nazir_shaven: { arch: 'nazir', mantle: 0.8, grey: [0, 0.2], scale: [0.95, 1.04], shaven: 'head' },
  // the metzora of Vayikra 13:45 (torn garments, the hair let grow); on his seventh day he shaves all his hair — head,
  // beard and brows (Vayikra 14:9): setShaven('all'), as he comes to Sha'ar Nikanor on the eighth
  metzora: { arch: 'metzora', mantle: 0.6, headcloth: 0, grey: [0, 0.5], scale: [0.94, 1.04] },
  // the mourner and the one under a ban who go round Har HaBayit to the left (Middot 2:2): wrapped (atifah — the mourner's,
  // Moed Katan 15a; left open there for the menudeh, wrapped here as in G4) round the head and the sides of the face to the
  // beard, a fold over the mouth (Moed Katan 24a; Rambam Avel 5:19 — the 'mourner' archetype) and dressed in black — the period's mourning
  // dress (Josephus, War 2.1: Archelaus put on white after his seven
  // days; Bava Metzia 59b: R' Akiva "dressed in black and wrapped himself in black" to tell R' Eliezer of the ban);
  // setGarb('white') / crowd garb for the other option
  mourner: { arch: 'mourner', mantle: 1, headcloth: 1, grey: [0, 0.5], scale: [0.94, 1.05], garb: 'black' },
  menudeh: { arch: 'mourner', mantle: 1, headcloth: 1, grey: [0, 0.5], scale: [0.94, 1.05], garb: 'black' },
  woman: { arch: 'woman', grey: [0, 0.4], scale: [0.95, 1.05] },
  elder: { arch: 'elder', mantle: 1, headcloth: 0.35, grey: [0.55, 1], scale: [0.96, 1.03] },
  sanhedrin: { arch: 'elder', mantle: 1, headcloth: 1, grey: [0.45, 1], scale: [0.97, 1.03] },
  child: { arch: 'child', grey: [0, 0], scale: [0.88, 1.08] },
};

// Animal palettes — classes: SKIN = bare skin (muzzle), HAIR = (birds) head, GA = fleece / body coat / body
// plumage, GB = the short-haired face and lower legs (sheep, goat) / head and neck (bull) / wings (birds),
// STRIPE = (birds) the neck patch. Breed colours are reconstruction (docs/decisions/people-realism.md):
// fat-tailed sheep with white fleece and brown-to-black face and legs, black goats, red-brown cattle.
const SHEEP_FACE = ['#6e4a30', '#4a3224', '#9a7350', '#2e2420'];
export const ANIMALS = {
  lamb: { rig: 'lamb', build: 'sheep', palette: pal(['#5a4a46', '#3a302e'], ['#e8dfd0', '#c9bba4'], ['#efe7d6', '#e6dcc8', '#f2ecdf', '#ddd1bb'], SHEEP_FACE, ['#2a2420', '#3a302a']) },
  ram: { rig: 'ram', build: 'sheep', horns: true, palette: pal(['#5a4a46', '#3a302e'], ['#e0d6c4', '#bfae94'], ['#e8e0cf', '#ddd3bf', '#ebe4d6', '#d6cab3'], SHEEP_FACE, ['#2a2420', '#3a302a']) },
  goat: { rig: 'goat', build: 'goat', palette: pal(['#2e2626', '#211c1c'], ['#2a2420', '#1a1614'], ['#1c1917', '#232020', '#151312', '#2b2624'], ['#1c1917', '#2a2422', '#151312', '#4a3a2e'], ['#1a1614', '#2a2420']) },
  // the individual's chatat (Vayikra 4:28, 4:32): a she-goat (se'irat izim) or a ewe lamb (kivsah) — female (an udder, no
  // scrotum); the ewe lamb polled (the breed's ewes are hornless, reconstruction), the she-goat's horns and beard smaller
  ewe: { rig: 'lamb', build: 'sheep', female: true, polled: true, palette: pal(['#5a4a46', '#3a302e'], ['#e8dfd0', '#c9bba4'], ['#efe7d6', '#e6dcc8', '#f2ecdf', '#ddd1bb'], SHEEP_FACE, ['#2a2420', '#3a302a']) },
  she_goat: { rig: 'goat', build: 'goat', female: true, hornScale: 0.55, beardScale: 0.55, palette: pal(['#2e2626', '#211c1c'], ['#2a2420', '#1a1614'], ['#1c1917', '#232020', '#151312', '#2b2624'], ['#1c1917', '#2a2422', '#151312', '#4a3a2e'], ['#1a1614', '#2a2420']) },
  bull: { rig: 'bull', build: 'bull', palette: pal(['#3a3030', '#2a2222'], ['#7a4a2e', '#5e3722'], ['#7a4528', '#6b3b22', '#8a5534', '#5c331e'], ['#4e2c18', '#3e2414', '#5e3820', '#2e1c12'], ['#2a2420', '#3a302a']) },
  // birds: the young pigeon (ben yonah) and the turtledove (tor) — Vayikra 1:14, 5:7, 12:8
  dove: { rig: 'dove', build: 'dove', kind: 'pigeon', palette: pal(['#b0545a', '#9a4a50'], ['#6f7680', '#646b75'], ['#8f97a3', '#868e9a', '#9aa1ab', '#7f8793'], ['#9ba2ac', '#8f97a1', '#a5abb3', '#87909b'], ['#3f5e52', '#55456a']) },
  pigeon: { rig: 'dove', build: 'dove', kind: 'pigeon', palette: pal(['#b0545a', '#9a4a50'], ['#6f7680', '#646b75'], ['#8f97a3', '#868e9a', '#9aa1ab', '#7f8793'], ['#9ba2ac', '#8f97a1', '#a5abb3', '#87909b'], ['#3f5e52', '#55456a']) },
  turtledove: { rig: 'dove', build: 'dove', kind: 'turtledove', palette: pal(['#b0545a', '#9a4a50'], ['#8e8f99', '#7e808a'], ['#b39484', '#a88a7a', '#bb9c8a', '#9f8273'], ['#9a6a48', '#8a5e40', '#a6764f', '#7f573c'], ['#a89a92', '#9a8c86']) },
};

export const ROLE_NAMES = Object.keys(ROLES);
export const ANIMAL_NAMES = Object.keys(ANIMALS);
