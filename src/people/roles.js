// Roles → archetypes (mesh recipe + rig) and their variation (palettes, optional garment parts).
// Population: Jews of the late Second Temple period — olive to light-brown skin, dark hair, adult men bearded.
// Ordinary dress (reconstruction, see docs/decisions/people.md): undyed / natural wool and linen tunics,
// some with darker clavi stripes, mantles (tallit) with tzitzit; women in long garments, head covered.
// Priestly dress per report Part VIII §34. Levites: NO Mishnaic uniform — plain light garments (flagged).
import { Color } from 'three';

const pal = (skin, hair, ga, gb, stripe) => [...skin, ...hair, ...ga, ...gb, ...stripe].map((h) => new Color(h));
const SKIN = ['#c89c78', '#86593a'];
const HAIR = ['#1c1611', '#a69f95'];
const LINEN = ['#efeadf', '#f2eee5', '#ebe5d9', '#f0ece2'];

export const ARCHETYPES = {
  kohen: { rig: 'man', recipe: 'kohen', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  kg_gold: { rig: 'man', recipe: 'kg_gold', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  kg_white: { rig: 'man', recipe: 'kg_white', palette: pal(SKIN, HAIR, LINEN, LINEN, ['#5c3a2c', '#3c3a46']) },
  levi: {
    rig: 'man', recipe: 'levi',
    palette: pal(SKIN, HAIR, ['#dccdaf', '#d3c3a2', '#e2d5b8', '#cdbb98'], ['#c3ad88', '#b49f7d', '#cfbf9e', '#a28e6c'], ['#6a4a35', '#4f4a3e']),
  },
  israelite: {
    rig: 'man', recipe: 'israelite',
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
 *         prop / pose defaults, scale: [min,max] }
 */
export const ROLES = {
  // offduty: in 'sleep' / 'lie' the figure wears its own clothes and sleeps on the folded holy garments (Tamid 1:1)
  kohen: { arch: 'kohen', grey: [0, 0.35], scale: [0.95, 1.05], offduty: true },
  segan: { arch: 'kohen', grey: [0.2, 0.55], scale: [0.98, 1.04], offduty: true },
  kohen_gadol: { arch: 'kg_gold', grey: [0.15, 0.5], scale: [1.0, 1.04], lowBlessing: true, offduty: true },
  kohen_gadol_white: { arch: 'kg_white', grey: [0.15, 0.5], scale: [1.0, 1.04], lowBlessing: true, offduty: true },
  // a kohen out of the holy garments: his own tunic and mantle, head bare (Tamid 1:1 "they cover themselves
  // with their own clothes"); pose sleep/lie adds the folded garments under his head
  kohen_offduty: { arch: 'israelite', mantle: 1, headcloth: 0, grey: [0, 0.35], scale: [0.95, 1.05], offduty: true },
  levi: { arch: 'levi', mantle: 0.55, grey: [0, 0.3], scale: [0.95, 1.05] },
  guard_levi: { arch: 'levi', mantle: 1, grey: [0, 0.3], scale: [0.97, 1.05], prop: 'torch', pose: 'torch' },
  levi_boy: { arch: 'boy', grey: [0, 0], scale: [0.92, 1.06] },
  israelite: { arch: 'israelite', mantle: 0.85, headcloth: 0.3, grey: [0, 0.45], scale: [0.94, 1.05] },
  nazir: { arch: 'nazir', mantle: 0.8, grey: [0, 0.2], scale: [0.95, 1.04] },
  woman: { arch: 'woman', grey: [0, 0.4], scale: [0.95, 1.05] },
  elder: { arch: 'elder', mantle: 1, headcloth: 0.35, grey: [0.55, 1], scale: [0.96, 1.03] },
  sanhedrin: { arch: 'elder', mantle: 1, headcloth: 1, grey: [0.45, 1], scale: [0.97, 1.03] },
  child: { arch: 'child', grey: [0, 0], scale: [0.88, 1.08] },
};

export const ANIMALS = {
  lamb: { rig: 'lamb', build: 'sheep', palette: pal(['#efe9dc', '#ddd2bf'], ['#e8dfd0', '#c9bba4'], ['#efe9dc', '#e9e2d3', '#f2ede2', '#e4dccb'], ['#e9dfd0', '#dbcfbc', '#efe7da', '#d5c8b2'], ['#2a2420', '#3a302a']) },
  ram: { rig: 'ram', build: 'sheep', horns: true, palette: pal(['#e6dfd0', '#d2c6b0'], ['#e0d6c4', '#bfae94'], ['#e8e1d2', '#ded6c4', '#ece6d9', '#d8cfbd'], ['#e2d8c7', '#d2c6b2', '#e8dfd1', '#c9bca6'], ['#2a2420', '#3a302a']) },
  goat: { rig: 'goat', build: 'goat', palette: pal(['#2a2420', '#1a1614'], ['#2a2420', '#1a1614'], ['#2b2522', '#211c1a', '#3a302a', '#2a2420'], ['#2b2522', '#211c1a', '#3a302a', '#2a2420'], ['#1a1614', '#2a2420']) },
  bull: { rig: 'bull', build: 'bull', palette: pal(['#7a4a2e', '#5e3722'], ['#7a4a2e', '#5e3722'], ['#7c4b2f', '#6a3f27', '#86553a', '#5f3a25'], ['#7c4b2f', '#6a3f27', '#86553a', '#5f3a25'], ['#2a2420', '#3a302a']) },
  dove: { rig: 'dove', build: 'dove', palette: pal(['#8f97a3', '#7d8591'], ['#8f97a3', '#7d8591'], ['#9aa1ab', '#8b929d', '#a3a8b0', '#868d98'], ['#9aa1ab', '#8b929d', '#a3a8b0', '#868d98'], ['#3d4a45', '#4a3d52']) },
};

export const ROLE_NAMES = Object.keys(ROLES);
export const ANIMAL_NAMES = Object.keys(ANIMALS);
