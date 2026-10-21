// ?debug=people — a lineup on the test plaza in front of the 'start' anchor (site X≈255, Y≈95, facing north):
//   row A (Y 103): every role standing, facing the camera
//   row B (Y 109) / row C (Y 115): kohanim, Levites and others in every pose, with their props — the sleeping /
//                  lying kohanim are in their own clothes on their folded garments (Tamid 1:1)
//   row D (Y 121): the animals;  row E (Y 127): individual offerings and the tamid at the slaughter place (semichah,
//                  bound lamb held and slaughtered, kabbalah, flaying at the hook, a lamb led on a rope, tenufah,
//                  kemitzah, melikah, stoking, salting); row F (Y 133): the nine limb-bearers of Tamid 4:3 (&carry=walk)
//   row G (Y 139) / row H (Y 145) / row I (Y 151): the night, Moked and service poses, roles and props of
//                  docs/decisions/people-3.md (elders, breeches, bathing, sit_floor, call, knock, lift_mitre, lock,
//                  staff/strike, windlass, kiddush, rinse, carry_lamb, pour_low, wave_sudar, tend_lamp, warm, bathe,
//                  wood, psachter, charred limbs); &serve=walk walks the walking variants
//   row P (Y 99.5): every prop lying/standing free (hung carcasses at hook height)
//   crowd (X 205–245, Y 120–146): Israelites and women (pose via &crowd=stand|prostrate|bow|kneel|walk — a walking
//          region crowd flows along its headings and wraps inside the region); a small flock of lambs
// URL helpers: &pphase=0.5 fixes every one-shot phase; &crowdn=N crowd size.
import { Mesh, TorusGeometry, BoxGeometry, CylinderGeometry, MeshStandardMaterial, Group } from 'three';
import { m2w, headingToYaw, AMAH } from '../core/units.js';
import { CRANK, KNEAD, WAVE_UNDER } from './clips.js';

export function buildDemo(ctx) {
  const P = ctx.people;
  const q = ctx.params.raw;
  const fixed = q.has('pphase') ? parseFloat(q.get('pphase')) : null;
  const one = (v) => (fixed != null ? fixed : v);

  // &solo=<role|animal|prop>[,more…] — only these, side by side 1.6 m apart from site (255, 103), facing south;
  // &spose=<pose> &sprop=<prop> &shand=left &sheading=deg — for close inspection shots (docs/decisions/people-realism.md)
  if (q.has('solo')) {
    const list = q.get('solo').split(',');
    const pose = q.get('spose') || 'stand', prop = q.get('sprop'), hand = q.get('shand') || 'right';
    const hd = q.has('sheading') ? parseFloat(q.get('sheading')) : 180;
    const out = [];
    list.forEach((name, i) => {
      const X = 255 + (i - (list.length - 1) / 2) * 3.4;
      let a;
      if (P.roles.includes(name)) {
        a = P.spawn({ role: name, seed: 900 + i });
        a.setPose(pose, fixed ?? undefined);
        if (prop) a.setProp(prop, hand);
      } else if (P.animals.includes(name)) {
        a = P.spawnAnimal(name, { seed: 900 + i });
        a.setPose(pose, fixed ?? undefined);
      } else a = P.spawnProp(name);
      a?.setSite(X, 103).setHeading(hd);
      out.push(a);
    });
    ctx.people.demo = { solo: out };
    return;
  }

  // &rows=p4 — only the people-4 rows (docs/decisions/people-4.md), from Y 103, for close inspection
  if (q.get('rows') === 'p4') { ctx.people.demo = people4Rows(P, one, 103); return; }

  // row A — every role
  const roles =['kohen', 'segan', 'kohen_gadol', 'kohen_gadol_white', 'levi', 'guard_levi', 'levi_boy', 'israelite', 'nazir', 'woman', 'elder', 'sanhedrin', 'child', 'kohen_offduty'];
  roles.forEach((role, i) => {
    const a = P.spawn({ role, seed: 100 + i });
    a.setSite(245.2 + i * 1.6, 103).setHeading(180);
    if (role === 'guard_levi') a.setPose('torch');
    else a.setPose('stand');
  });

  // rows B, C — poses with props
  const poses = [
    ['kohen', 'walk'], ['kohen', 'run'], ['kohen', 'carry', 'teni'], ['kohen', 'carry_shoulder', 'lamb_carcass'],
    ['israelite', 'prostrate', null, 0.5], ['kohen', 'bow', null, 0.5], ['woman', 'kneel', null, 0.5],
    ['levi', 'sing'], ['levi', 'play_kinnor', 'kinnor'], ['levi', 'play_nevel', 'nevel'], ['levi', 'play_cymbal', 'cymbal', 0.3],
    ['kohen', 'blow_trumpet', 'trumpet'],
    ['kohen', 'blow_shofar', 'shofar'], ['kohen', 'raise_hands'], ['kohen', 'pour', 'kuz', 0.5], ['kohen', 'throw', 'mizrak_gold', 0.47],
    ['kohen', 'sprinkle', 'mizrak_silver'], ['kohen', 'sleep'], ['kohen', 'lie'], ['sanhedrin', 'sit'], ['guard_levi', 'torch'],
    ['kohen', 'slaughter', 'knife'], ['kohen', 'sweep', 'magrefah'], ['kohen', 'circle_lot', null, 0.5], ['israelite', 'point'],
  ];
  poses.forEach(([role, pose, prop, ph], i) => {
    const row = i < 12 ? 0 : 1;
    const k = row ? i - 12 : i;
    const n = row ? poses.length - 12 : 12;
    const a = P.spawn({ role, seed: 300 + i });
    const X = 255 - (n - 1) * 1.15 + k * 2.3;
    const Y = row ? 115 : 109;
    a.setSite(X, Y).setHeading(pose === 'prostrate' ? 270 : pose === 'sleep' || pose === 'lie' ? 200 : 180);
    if (prop) a.setProp(prop, pose === 'sprinkle' || pose.startsWith('play_k') || pose.startsWith('play_n') ? 'left' : 'right');
    a.setPose(pose, ph != null ? one(ph) : undefined);
  });

  // row D — animals (the tamid lamb also bound, as for shechitah)
  const animals = [['lamb', 'stand'], ['lamb', 'bound'], ['ram', 'walk'], ['goat', 'stand'], ['bull', 'stand'], ['lamb', 'lie'],
    ['turtledove', 'perch'], ['pigeon', 'fly'], ['lamb', 'drink'], ['goat', 'struggle']];
  animals.forEach(([kind, pose], i) => {
    const a = P.spawnAnimal(kind, { seed: 500 + i });
    const X = 245 + i * 2.8 + (kind === 'bull' ? 1 : 0);
    a.setSite(X, 121, (kind === 'pigeon' || kind === 'turtledove') && pose === 'fly' ? 3 : undefined).setHeading(kind === 'dove' || kind === 'turtledove' || kind === 'pigeon' ? 200 : 250);
    a.setPose(pose);
  });

  // row E (Y 127) — individual offerings and the tamid at the slaughter place (docs/decisions/people-realism.md)
  const E = 127;
  const put = (role, X, Y, h, pose, prop, hand, ph) => { const a = P.spawn({ role, seed: Math.round(X * 7 + Y) }); a.setSite(X, Y).setHeading(h); if (prop) a.setProp(prop, hand || 'right'); a.setPose(pose, ph != null ? one(ph) : undefined); return a; };
  const beast = (kind, X, Y, h, pose) => { const a = P.spawnAnimal(kind, { seed: Math.round(X * 3 + Y) }); a.setSite(X, Y).setHeading(h); a.setPose(pose); return a; };
  beast('ram', 245, E + 1.2, 180, 'stand_halter');
  put('israelite', 245, E + 3.1, 180, 'semichah');
  // the bound tamid: head south, the slaughterer east of it facing west, the limb-winners holding its legs
  beast('lamb', 250.5, E, 180, 'bound');
  put('kohen', 252.6, E - 0.6, 270, 'slaughter', 'knife');
  put('kohen', 249.8, E + 1.5, 160, 'hold_legs');
  put('kohen', 251.6, E + 1.6, 200, 'hold_legs');
  put('kohen', 252.2, E - 2.2, 300, 'receive', 'mizrak_gold');
  // flaying at the hook
  const hung = P.spawnProp('carcass_flaying'); hung?.setSite(256, E, 4.2).setHeading(180);
  put('kohen', 256, E - 1.8, 0, 'flay', 'knife_flay');
  // a lamb led on a rope
  const lamb = beast('lamb', 259.5, E + 1.6, 180, 'walk_led');
  const leader = put('kohen', 259.5, E - 0.4, 180, 'lead_walk');
  lamb.setLead(leader);
  // waving the breast and thigh of a shelamim; kemitzah; melikah; stoking the pyre; salting
  put('israelite', 263, E, 180, 'wave').setProps('limb_chazeh', 'limb');
  put('kohen', 265.5, E, 180, 'kemitzah', 'solet', 'left');
  put('kohen', 268, E, 180, 'melikah', 'dove_held', 'left');
  put('kohen', 270.5, E, 180, 'stoke', 'fork');
  put('kohen', 273, E, 180, 'salt', 'salt', 'left');
  put('woman', 275.5, E, 180, 'carry', 'bird_cage');
  put('israelite', 278, E, 180, 'carry', 'loaves_todah');

  // row F (Y 133) — the nine who carry the tamid to the ramp, each as Tamid 4:3 places the limbs in his hands
  const carriers = [['limb_head', 'limb'], ['limb_foreleg', 'limb_foreleg'], ['limb_oketz', 'limb'], ['limb_chazeh', 'limb_gerah'],
    ['limb_dofen', 'limb_dofen'], ['entrails_bazach'], ['solet'], ['chavitin'], ['wine_jug']];
  carriers.forEach(([r, l], i) => {
    const a = P.spawn({ role: 'kohen', seed: 700 + i });
    a.setSite(246 + i * 2.2, 133).setHeading(180);
    if (l) { a.setProps(r, l); a.setPose(q.get('carry') === 'walk' ? 'carry_limbs_walk' : 'carry_limbs'); }
    else { a.setProp(r); a.setPose('carry'); }
  });

  serviceRows(P, one);
  people4Rows(P, one, 157);

  // row P — every prop, free-standing (hung carcasses at hook height)
  const HUNG = new Set(['lamb_hung', 'carcass_flaying', 'carcass_hung', ...P.props.filter((n) => /_hung$|^carcass_flaying_|^carcass_hung_/.test(n))]);
  P.props.forEach((name, i) => {
    const p = P.spawnProp(name);
    p?.setSite(247.5 + i * 0.58, 99.3, HUNG.has(name) ? 4.2 : undefined).setHeading(180 + (i % 2) * 20);
  });

  // a crowd behind the colonnade
  const pose = q.get('crowd') || 'stand';
  const crowd = P.crowd({
    roles: { israelite: 5, woman: 3, elder: 1, child: 1, nazir: 0.3 },
    count: parseInt(q.get('crowdn') || '160', 10),
    region: { min: [205, 120], max: [246, 146] },
    heading: { at: [225, 200] }, pose, phase: fixed ?? undefined, seed: 77,
    layout: pose === 'prostrate' || q.has('pspace') ? 'prostrate' : undefined,
  });
  const flock = P.crowd({ roles: 'lamb', count: 6, region: { min: [228, 111], max: [236, 117] }, heading: 'random', pose: 'graze', seed: 9 });
  ctx.people.demo = { crowd, flock };
}

/** rows G–I: the people-3 additions (docs/decisions/people-3.md) */
function serviceRows(P, one) {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const put = (role, X, Y, h, pose, prop, hand, ph) => {
    const a = P.spawn({ role, seed: Math.round(X * 13 + Y * 7) });
    a.setSite(X, Y).setHeading(h);
    if (Array.isArray(prop)) a.setProps(prop[0], prop[1]); else if (prop) a.setProp(prop, hand || 'right');
    a.setPose(pose, ph != null ? one(ph) : undefined);
    return a;
  };
  // row G — roles and the Moked's night
  let Y = 139, X = 245;
  const step = (d = 2.3) => (X += d);
  put('kohen_elder', X, Y, 180, 'stand'); step();
  put('kohen_elder_offduty', X, Y, 180, 'stand'); step();
  put('kohen_breeches', X, Y, 180, q.get('serve') === 'walk' ? 'walk' : 'stand'); step();
  put('kohen_bathing', X, Y, 180, 'stand'); step();
  put('kohen_elder', X - 0.6, Y + 0.9, 90, 'lie'); step(2.6);             // on the ledge bedding (kesset folded double)
  put('kohen_elder_offduty', X, Y, 200, 'sleep'); step(2.6);
  put('kohen_offduty', X, Y, 180, 'sit_floor'); step();
  put('levi', X, Y, 180, 'call'); step();
  put('kohen', X, Y, 180, 'knock', null, null, 0.26); step();
  // the officer lifting the migba'at off the head of the man before him (Yoma 25a)
  const off = put('kohen', X, Y, 180, 'lift_mitre', 'migbaat', 'right', 0.6);
  const man = put('kohen', X, Y - 1.05, 0, 'stand');
  man.setHeadgear(false);
  void off; step(2.6);
  put('kohen_offduty', X, Y, 180, 'lock', 'keys', 'right', 0.45); step();
  put('levi', X, Y, 180, q.get('serve') === 'walk' ? 'staff_walk' : 'staff', 'staff'); step();
  put('levi', X, Y, 180, 'strike', 'staff', 'right', 0.5);
  put('guard_levi', X - 0.4, Y - 2.4, 90, 'lie').setProp(null); step(2.6);
  // row H — the service
  Y = 145; X = 245;
  put('kohen', X, Y, 180, 'windlass', null, null, 0.1); step(2.6);
  put('kohen', X, Y, 180, 'windlass_raise', null, null, 0.1); step(2.6);
  put('kohen', X, Y, 180, 'kiddush'); step();
  put('kohen', X, Y, 180, 'rinse');
  P.spawnProp('entrails')?.setSite(X, Y - 0.85, 0.72 / 0.48).setHeading(180); step();
  put('kohen', X, Y, 180, q.get('serve') === 'walk' ? 'carry_lamb_walk' : 'carry_lamb', 'lamb_dead'); step(2.6);
  put('kohen', X, Y, 180, 'pour_low', 'wine_jug', 'right', 0.45); step();
  put('kohen', X, Y, 180, 'pour_low', 'machtah_silver', 'right', 0.45);
  P.spawnProp('machtah_gold')?.setSite(X - 0.3, Y - 1.25).setHeading(0); step(2.6);
  put('segan', X, Y, 180, 'wave_sudar', ['sudar', 'sudar'], null, 0.25); step();
  put('kohen', X, Y, 180, 'tend_lamp', ['taper', 'kuz']); step();
  put('kohen_bathing', X, Y, 180, 'warm'); step();
  put('kohen_offduty', X, Y, 180, 'bathe', null, null, 0.2); step();
  put('kohen', X, Y, 180, 'carry', 'folded_garments'); step();
  put('kohen', X, Y, 180, 'carry', 'kaf_covered'); step();
  put('kohen', X, Y, 180, 'stand', 'kaf_covered');
  // row I — the wood and the pile
  Y = 151; X = 245;
  put('kohen', X, Y, 180, q.get('serve') === 'walk' ? 'carry_shoulder_walk' : 'carry_shoulder', 'gizrin_branch'); step();
  put('kohen', X, Y, 180, 'carry_shoulder', 'branch_bundle'); step();
  put('kohen', X, Y, 180, 'carry', 'gizrin_branch'); step();
  for (const [name, dx, dy] of [['gizrin_branch', 0, 0], ['branch_bundle', 0.7, 0], ['psachter', 2.2, 0], ['psachter_inverted', 4.2, 0]]) P.spawnProp(name)?.setSite(X + dx, Y).setHeading(160);
  X += 6;
  ['limb_charred', 'limb_head_charred', 'limb_foreleg_charred', 'limb_oketz_charred', 'limb_chazeh_charred', 'limb_gerah_charred', 'limb_dofen_charred', 'lamb_dead']
    .forEach((name, i) => P.spawnProp(name)?.setSite(X + i * 0.7, Y).setHeading(170 + i * 15));
}

/**
 * rows J–L (from Y0; Y0 = 157 in the full lineup, 103 with &rows=p4): the people-4 additions (docs/decisions/people-4.md)
 *   J: eating, kneading, the Golah crank, tenufah together (wave + wave_under, the same phase), the bikkurim basket waved
 *      by its rims with the kohen's hands beneath, the slain lamb across the shoulders and in the arms, the showbread
 *      stacks, the eimurim, the nazir's basket, the isaron poured, a razor, coins
 *   K: the nazir and the same man shaven (nazir_shaven, same seed), the metzora and the same man shaven all over, the
 *      mourner and the one under a ban in black, an Israelite in white and in black
 *   L: the ewe and the she-goat; the hung, flaying and flayed carcasses of the ram, the goat, the ewe and the she-goat at
 *      hook height; the new free props
 * &p4=walk walks the walking variants; &pphase fixes the phases (the wave pairs always share one). The wave pairs share
 * one scale too, and the kneader and the crank operator are at scale 1 (people-4-fix; &p4seeded leaves each wave pair
 * at its own seeded sizes). With &p4fix the dough lies on the kneading table.
 */
function people4Rows(P, one, Y0) {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const scene = globalThis.__mikdash?.scene;
  // &p4fix: what the poses assume — a kneading table (KNEAD) and the Golah wheel's spokes (CRANK) at the phase shown
  const fixtures = (kx, cx, Y, ph) => {
    if (!scene) return;
    const mat = new MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.8 });
    const table = new Mesh(new BoxGeometry(0.9, 0.05, 0.5), mat);
    table.position.copy(m2w(kx, Y - (KNEAD.reach + 0.05) / AMAH, (KNEAD.surface - 0.025) / AMAH));
    scene.add(table);
    const W = CRANK, g = new Group();
    g.position.copy(m2w(cx, Y, 0));
    g.rotation.y = headingToYaw(180);
    const hub = new Group();
    hub.position.set(W.hub[0], W.hub[1], W.hub[2]);
    hub.rotation.z = W.spin0 + ph * W.perCycle;   // φ grows toward his left (+z rotation of his up axis toward −x)
    const rim = new Mesh(new TorusGeometry(2.1 * AMAH, 0.06 * AMAH, 6, 32), mat);
    hub.add(rim);
    for (let i = 0; i < 8; i++) {
      const sp = new Mesh(new BoxGeometry(0.05, 2.65 * AMAH, 0.05), mat);
      sp.geometry.translate(0, 2.65 * AMAH / 2, 0);
      sp.rotation.z = i * Math.PI / 4;
      hub.add(sp);
    }
    hub.add(new Mesh(new CylinderGeometry(0.08, 0.08, 0.3, 10).rotateX(Math.PI / 2), mat));
    g.add(hub);
    scene.add(g);
  };
  const walk = q.get('p4') === 'walk';
  const out = { actors: [] };
  const put = (role, X, Y, h, pose, prop, hand, ph, seed) => {
    const a = P.spawn({ role, seed: seed ?? Math.round(X * 13 + Y * 7) });
    a.setSite(X, Y).setHeading(h);
    if (Array.isArray(prop)) a.setProps(prop[0], prop[1]); else if (prop) a.setProp(prop, hand || 'right');
    a.setPose(pose, ph != null ? one(ph) : undefined);
    out.actors.push(a);
    return a;
  };
  // row J — the poses
  let Y = Y0, X = 243;
  const step = (d = 2.4) => (X += d);
  put('kohen', X, Y, 180, 'eat', 'bread_piece', 'right', 0.38); step();
  put('kohen', X, Y, 180, 'eat', 'bread_piece', 'right', 0.8); step();
  // the fixtures' poses at scale 1 (their geometry is in metres): the kneader at his table with the dough on it
  put('kohen', X, Y, 180, 'knead', null, null, 0.3).setScale(1);   // (its table: &p4fix)
  if (q.has('p4fix')) P.spawnProp('dough')?.setSite(X, Y - KNEAD.reach / AMAH, KNEAD.surface / AMAH).setHeading(180);
  step();
  const crankPh = 0.25;
  put('levi', X, Y, 180, 'crank', null, null, crankPh).setScale(1);
  if (q.has('p4fix')) fixtures(X - 2.4, X, Y, crankPh);
  step(2.8);
  // tenufah: the owner (west) and the kohen facing him at ONE scale s (the owner's), WAVE_UNDER.partner·s apart, the same
  // phase; &p4seeded leaves each at his own seeded size (the mismatch the rule avoids)
  const wph = 0.12;
  const pair = (prop, hand) => {
    const o = put('israelite', X, Y, 90, 'wave', prop, hand, wph);
    const k = put('kohen', X, Y, 270, 'wave_under', null, null, wph);
    if (!q.has('p4seeded')) k.setScale(o.scale);
    const D = WAVE_UNDER.partner * o.scale / AMAH;
    o.setSite(X - D / 2, Y); k.setSite(X + D / 2, Y);
  };
  pair(['limb_chazeh', 'limb']); step(3.2);
  // the bikkurim: the basket held by its rims and waved, the kohen's hands beneath it
  pair('basket', 'right'); step(3.2);
  put('kohen', X, Y, 180, walk ? 'carry_shoulder_walk' : 'carry_shoulder', 'lamb_slain'); step();
  put('kohen', X, Y, 180, walk ? 'carry_shoulder_walk' : 'carry_shoulder', 'goat_slain'); step();
  put('kohen', X, Y, 180, walk ? 'carry_lamb_walk' : 'carry_lamb', 'lamb_slain'); step(2.6);
  put('kohen', X, Y, 180, walk ? 'carry_walk' : 'carry', 'showbread_stack'); step(2.6);
  put('kohen_gadol', X, Y, 180, 'carry', 'showbread_half'); step(2.6);
  put('kohen', X, Y, 180, walk ? 'carry_walk' : 'carry', 'eimurim'); step();
  put('nazir', X, Y, 180, walk ? 'carry_walk' : 'carry', 'sal_matzot'); step();
  put('kohen', X, Y, 180, 'pour_low', 'measure', 'right', 0.45); step();
  put('nazir', X, Y, 180, 'stand', 'razor'); step();
  put('israelite', X, Y, 180, 'kemitzah', 'coins', 'left'); step();
  put('kohen', X, Y, 180, 'melikah', 'bread_piece', 'left'); step();
  put('israelite', X, Y, 180, 'carry', 'clay_pot');
  // row K — the shaven, the metzora, mourners and garments
  Y = Y0 + 6; X = 245;
  put('nazir', X, Y, 180, 'stand', null, null, null, 4242); step(1.7);
  put('nazir_shaven', X, Y, 180, 'stand', null, null, null, 4242); step(1.7);
  put('nazir', X, Y, 180, 'stand', null, null, null, 4343).setShaven('head'); step(1.7);
  put('metzora', X, Y, 180, 'stand', null, null, null, 5151); step(1.7);
  put('metzora', X, Y, 180, 'stand', null, null, null, 5151).setShaven('all'); step(1.7);
  put('mourner', X, Y, 180, walk ? 'walk' : 'stand'); step(1.7);
  put('menudeh', X, Y, 180, 'stand'); step(1.7);
  put('mourner', X, Y, 180, 'stand').setGarb('white'); step(1.7);
  put('israelite', X, Y, 180, 'stand', null, null, null, 6161).setGarb('white'); step(1.7);
  put('israelite', X, Y, 180, 'stand', null, null, null, 6161).setGarb('black'); step(1.7);
  put('israelite', X, Y, 180, 'stand', null, null, null, 6161);
  // row L — the chatat's females and the carcasses by kind; the new free props
  Y = Y0 + 12; X = 245;
  for (const [kind, pose] of [['ewe', 'stand'], ['she_goat', 'stand'], ['ewe', 'bound'], ['she_goat', 'stand_halter'], ['lamb', 'stand'], ['goat', 'stand']]) {
    const a = P.spawnAnimal(kind, { seed: Math.round(X * 3) });
    a.setSite(X, Y).setHeading(250).setPose(pose);
    out.actors.push(a);
    step(1.9);
  }
  for (const name of ['ram_hung', 'goat_hung', 'ewe_hung', 'she_goat_hung', 'carcass_flaying_ram', 'carcass_flaying_goat', 'carcass_flaying_ewe', 'carcass_flaying_she_goat', 'carcass_flaying', 'carcass_hung_ram', 'carcass_hung_goat', 'carcass_hung']) {
    P.spawnProp(name)?.setSite(X, Y, 4.2).setHeading(160);
    step(name.startsWith('ram') || name.endsWith('_ram') ? 1.9 : 1.6);
  }
  for (const [name, dx] of [['hide_goat', 1.2], ['hide', 1.4], ['lamb_slain', 1.6], ['goat_slain', 1.6], ['showbread_stack', 1.3], ['showbread_half', 1.1], ['eimurim', 0.9], ['eimurim_goat', 0.9],
    ['sal_matzot', 1], ['clay_pot', 0.7], ['clay_pot_broken', 0.9], ['measure', 0.6], ['coins', 0.5], ['razor', 0.5], ['bread_piece', 0.5], ['dough', 0.7]]) {
    P.spawnProp(name)?.setSite(X, Y).setHeading(170);
    step(dx);
  }
  return out;
}
