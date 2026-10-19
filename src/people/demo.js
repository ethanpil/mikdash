// ?debug=people — a lineup on the test plaza in front of the 'start' anchor (site X≈255, Y≈95, facing north):
//   row A (Y 103): every role standing, facing the camera
//   row B (Y 109) / row C (Y 115): kohanim, Levites and others in every pose, with their props — the sleeping /
//                  lying kohanim are in their own clothes on their folded garments (Tamid 1:1)
//   row D (Y 121): the animals;  row E (Y 127): individual offerings and the tamid at the slaughter place (semichah,
//                  bound lamb held and slaughtered, kabbalah, flaying at the hook, a lamb led on a rope, tenufah,
//                  kemitzah, melikah, stoking, salting); row F (Y 133): the nine limb-bearers of Tamid 4:3 (&carry=walk)
//   row P (Y 99.5): every prop lying/standing free (hung carcasses at hook height)
//   crowd (X 205–245, Y 120–146): Israelites and women (pose via &crowd=stand|prostrate|bow|kneel|walk — a walking
//          region crowd flows along its headings and wraps inside the region); a small flock of lambs
// URL helpers: &pphase=0.5 fixes every one-shot phase; &crowdn=N crowd size.
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

  // row A — every role
  const roles = ['kohen', 'segan', 'kohen_gadol', 'kohen_gadol_white', 'levi', 'guard_levi', 'levi_boy', 'israelite', 'nazir', 'woman', 'elder', 'sanhedrin', 'child', 'kohen_offduty'];
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

  // row P — every prop, free-standing (hung carcasses at hook height)
  const HUNG = new Set(['lamb_hung', 'carcass_flaying', 'carcass_hung']);
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
