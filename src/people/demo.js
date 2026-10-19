// ?debug=people — a lineup on the test plaza in front of the 'start' anchor (site X≈255, Y≈95, facing north):
//   row A (Y 103): every role standing, facing the camera
//   row B (Y 109) / row C (Y 115): kohanim, Levites and others in every pose, with their props — the sleeping /
//                  lying kohanim are in their own clothes on their folded garments (Tamid 1:1)
//   row D (Y 121): the animals;  row P (Y 99.5): every prop lying/standing free
//   crowd (X 205–245, Y 120–146): Israelites and women (pose via &crowd=stand|prostrate|bow|kneel|walk — a walking
//          region crowd flows along its headings and wraps inside the region); a small flock of lambs
// URL helpers: &pphase=0.5 fixes every one-shot phase; &crowdn=N crowd size.
export function buildDemo(ctx) {
  const P = ctx.people;
  const q = ctx.params.raw;
  const fixed = q.has('pphase') ? parseFloat(q.get('pphase')) : null;
  const one = (v) => (fixed != null ? fixed : v);

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
  const animals = [['lamb', 'stand'], ['lamb', 'bound'], ['ram', 'walk'], ['goat', 'stand'], ['bull', 'stand'], ['lamb', 'lie'], ['dove', 'stand'], ['dove', 'fly']];
  animals.forEach(([kind, pose], i) => {
    const a = P.spawnAnimal(kind, { seed: 500 + i });
    const X = 245 + i * 2.8 + (kind === 'bull' ? 1 : 0);
    a.setSite(X, 121, kind === 'dove' && pose === 'fly' ? 3 : undefined).setHeading(kind === 'dove' ? 200 : 250);
    a.setPose(pose);
  });

  // row P — every prop, free-standing
  P.props.forEach((name, i) => {
    const p = P.spawnProp(name);
    p?.setSite(247.5 + i * 0.58, 99.3).setHeading(180 + (i % 2) * 20);
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
