// people/ — procedural, research-grounded people and animals (ARCHITECTURE.md §10).
//
//   ctx.people.spawn({ role, seed, site?, heading?, pose?, phase?, prop?, hand? }) -> Actor
//   ctx.people.spawnAnimal('lamb'|'ram'|'goat'|'bull'|'dove'|'pigeon'|'turtledove', { seed }) -> Actor
//        quadruped poses: stand walk graze lie drink bound bound_tied struggle walk_led stand_led stand_halter;
//        birds: stand peck perch fly. animal.setLead(humanActor|null, hand) draws a lead rope to the leader's fist.
//   ctx.people.spawnProp(name) -> Actor-like free prop (setSite / setHeading / setVisible / dispose); a free torch burns
//   ctx.people.crowd({ roles, count, region:{min:[X,Y],max:[X,Y],z?|near?} | points:[[X,Y,Z?] | {pos,heading,near?}],
//                      pose, phase, heading, seed, prop, layout?:'prostrate' })
//        -> { setPose(name, phase), setVisible(b), setCount(n), setHeadings(deg|'random'|{at:[X,Y]}|fn|omitted=points'), setProp, dispose }
//        roles may be person roles or animal kinds (a flock). A region crowd in a walking pose flows along its
//        headings and wraps inside the region (dithering in/out at the edges); a points crowd walks in place.
//        layout 'prostrate' gives each member a 2:1 cell (staggered) so a full-length prostration has room.
//   ctx.people.util.poseAlongPath(points, distanceMeters) -> { pos, heading, length, done, t }
//   ctx.people.util.phaseFor(actor|role, pose, distanceMeters) -> walk/run phase that keeps feet planted
//
// Actor: object3D, setSite(X,Y,Z?), setPosition(v), setHeading(deg), setPose(name, phase?), setProp(name|null, hand),
//        setProps(right, left) (one prop per hand, e.g. the limb-bearers of Tamid 4:3), setLead(leader) (animals),
//        setVisible(b), setSpeed(m/s), dispose(). Phase omitted → the pose animates on its own.
//   ctx.people.tamid.carriers — the nine bearers' hands in Tamid 4:3 order: [{ right, left, pose }]
//   Offering poses: semichah semichah_high hold_legs receive flay carry_limbs carry_limbs_walk lead lead_walk wave
//   kemitzah melikah stoke toss salt (see clips.js); hung carcass props have their origin at the hook.
//        setSite Z: a number = exact height; { near: Z } = the walking floor nearest Z (stairs, galleries, upper
//        rooms); omitted = the walking floor (court/hall floors on the site datums — never a roof or beam above).
//        Floors are re-resolved when the colliders are (re)built.
//        Kohanic roles in 'sleep' / 'lie' wear their own clothes and lie on their folded garments (Tamid 1:1);
//        kohanic roles in 'bathe' show their bathing figure.
//   Night, Moked and service (docs/decisions/people-3.md): roles kohen_elder kohen_elder_offduty kohen_breeches
//   kohen_bathing; poses sit_floor call knock lift_mitre lock staff staff_walk strike windlass kiddush rinse carry_lamb
//   carry_lamb_walk pour_low wave_sudar tend_lamp warm bathe windlass_raise carry_log carry_log_walk;
//   Actor.setHeadgear(on) (the officer lifts the mitre, Yoma 25a); ctx.people.stations = { windlass, windlassRaise,
//   staff, mitreGrasp } (the fixtures' geometry the poses assume, with the wheel ↔ phase coupling); props staff
//   migbaat psachter psachter_inverted kaf_covered gizrin_branch branch_bundle lamb_dead taper entrails
//   folded_garments_ledge and limb*_charred; grip class 'pour'. Ritual vessels in actors' hands stay drawn at LOD 2.
//   A prop may choose its own clip for a pose (PROPS[name].poses): gizrin_branch / branch_bundle turn carry_shoulder(_walk)
//   into carry_log(_walk); kaf / kaf_covered turn stand / walk into stand_hold / walk_hold (the vessel level in a closed
//   fist, that arm steady). The service clips are baked for the men's rigs only (man, elder), sit_floor and warm for all.
//   Tzitzit hang plumb and a seated man's mantle sides hang from the pelvis (material.js, docs/decisions/people-3-fix.md).
//   The sleepers' bedding covers are built ahead in idle time (props.js prewarmBedding, scheduled below).
//   people-4 (docs/decisions/people-4.md): poses eat (all rigs), knead, crank (the Golah wheel), wave_under (the kohen's
//   palms beneath the owner's in tenufah — give both the same phase, WAVE_UNDER.partner apart), wave_basket (the
//   bikkurim basket waved by its rims: the basket chooses it for 'wave'), carry_stack(_walk) (the showbread stacks choose
//   it for carry), carry_slain(_walk) (a slain carcass across the shoulders: chosen for carry_shoulder); roles metzora,
//   nazir_shaven, mourner, menudeh; animals ewe, she_goat; Actor.setShaven('head'|'all'|false), Actor.setGarb('black'|
//   'white'|null) (also spawn({ shaven, garb }), crowd({ garb }), Crowd.setGarb); setProp(null) empties both hands;
//   props showbread_stack showbread_half bread_piece lamb_slain ewe_slain goat_slain she_goat_slain {ram,goat,ewe,
//   she_goat}_hung carcass_flaying_{ram,goat,ewe,she_goat} carcass_hung_{ram,goat} hide_goat eimurim eimurim_goat
//   sal_matzot razor clay_pot clay_pot_broken coins measure; grip class 'rims'; ctx.people.stations.{crank, waveUnder,
//   knead, eat}.
//   people-4-fix (docs/decisions/people-4-fix.md): Actor.setScale(s | null) and spawn({ scale }) / spawnAnimal(kind,
//   { scale }) — the poses that meet a partner or a fixture are made at scale 1: the tenufah pair at ONE scale s
//   (kohen.setScale(owner.scale)) WAVE_UNDER.partner·s apart; the operators of crank / windlass(_raise) / knead at 1. Prop
//   dough (on the KNEAD surface). Roles mourner / menudeh draw the atifah (archetype 'mourner').
//   qa-r1 (docs/decisions/qa-r1-people.md): Actor/Crowd.setGarb(name?, { avnet: false }) — a kohen outside the avodah
//   without the sha'atnez avnet (Rambam KhM 8:11; the sim passes it); pose variants (stand~k, raise_hands~k) chosen per
//   figure; contact shadows on low/medium (contact.js); temporal fades (0.25 s real time, snapped on jump/pause/stills).
// Rendering: GPU-instanced; every figure is skinned in the vertex shader from a baked animation atlas. Beyond
// quality.maxFigures the next figures (up to 3× more) are drawn as LOD3 silhouettes that fade out at the cap.
import { PRIORITY } from '../core/engine.js';
import { PeopleSystem } from './system.js';
import { ROLE_NAMES, ANIMAL_NAMES, ROLES } from './roles.js';
import { PROP_NAMES, setPropMetals, prewarmBedding } from './props.js';
import { whenPrebaked } from './prebake.js';
import { compileScene, rendersOffscreen, parallelCompile } from '../render/warmup.js';
import { HUMAN_CLIPS, MITRE_GRASP, STAFF, WINDLASS, WINDLASS_RAISE, CRANK, WAVE_UNDER, KNEAD, EAT } from './clips.js';
import { QUAD_CLIPS, BIRD_CLIPS } from './animal-clips.js';
import { poseAlongPath } from './util.js';

function matHex(ctx, key) {
  try {
    if (!ctx.mats?.keys?.includes?.(key)) return null;
    const c = ctx.mats.get(key)?.color;
    return c ? `#${c.getHexString()}` : null;
  } catch { return null; }
}

export async function init(ctx) {
  setPropMetals({
    gold: matHex(ctx, 'gold_vessel'), goldGreen: matHex(ctx, 'gold_green'), goldRed: matHex(ctx, 'gold_red'),
    silver: matHex(ctx, 'silver'), copper: matHex(ctx, 'copper'), iron: matHex(ctx, 'iron'), bronze: matHex(ctx, 'bronze_corinthian'),
  });
  const sys = new PeopleSystem(ctx);
  ctx.engine.onUpdate((dt) => {
    sys.update(dt);
    sys.setSnap(false);
  }, PRIORITY.people);
  ctx.bus.on('time:jump', () => {
    sys.setSnap(true);
    for (const a of sys.actors) { a.fade = 0; a.prev = null; }
    for (const c of sys.crowds) c.fade = 0;
  });
  ctx.bus.on('quality:change', () => sys.reconfigure(ctx.quality));
  // perf-1: the figure programs the first view most likely needs are issued now — the GPU process links them on its
  // worker threads while the boot goes on (each costs 1.5–5 s on ANGLE/D3D11) — and every other variant once the
  // first view is up, so a figure or prop that comes near later finds its program ready
  // perf-fix-1: only with KHR_parallel_shader_compile (without it a program issued ahead links synchronously at its first
  // query, as before perf-1 a program linked at its first draw)
  if (parallelCompile(ctx.renderer)) {
    const warm = (all) => compileScene(ctx.renderer, sys.warmupObjects(all), ctx.camera, ctx.scene, rendersOffscreen(ctx));
    warm(false);
    // the other variants one per frame (creating a program object preprocesses ~140 KB of GLSL: 0.1–0.25 s of this
    // thread each). perf-fix-1: once most of the first view's programs are linked ('warmup:tail', main.js), while this
    // thread idles behind the loading screen, instead of stuttering the first seconds of play; a screenshot keeps them
    // after the view (main.js's later warm-up rounds would wait for them)
    let started = false;
    const background = () => {
      if (started) return;
      started = true;
      const objs = [...sys.warmupObjects(true).children];
      const step = () => { const o = objs.shift(); if (!o) return; compileScene(ctx.renderer, o, ctx.camera, ctx.scene, rendersOffscreen(ctx)); requestAnimationFrame(step); };
      step();
    };
    if (!ctx.params?.shot) ctx.bus.on('warmup:tail', background);
    ctx.bus.on('firstFrame', () => setTimeout(background, 1000));
  }
  // the sleepers' bedding covers are draped over the posed body (props.js): costly to build (≈ 0.2–0.7 s on the main
  // thread at a first sleeper's draw), so they are built ahead — a first slice here behind the loader, the rest in idle
  // time (browser only)
  if (typeof requestAnimationFrame === 'function' && !prewarmBedding(120)) {
    const idle = typeof requestIdleCallback === 'function' ? (f) => requestIdleCallback(f, { timeout: 500 }) : (f) => setTimeout(f, 60);
    const step = () => { if (!prewarmBedding(6)) idle(step); };
    idle(step);
  }

  const phaseFor = (who, pose = 'walk', meters = 0) => {
    const arch = typeof who === 'string' ? sys.arch((ROLES[who] || ROLES.israelite).arch) : who?.arch;
    const clip = arch?.clip(pose);
    if (!clip?.stride) return 0;
    const scale = typeof who === 'string' ? 1 : (who.scale || 1);
    const p = meters / (clip.stride * scale);
    return p - Math.floor(p);
  };

  ctx.people = {
    spawn: (o) => sys.spawn(o),
    spawnAnimal: (kind, o) => sys.spawnAnimal(kind, o),
    spawnProp: (name, o) => sys.spawnProp(name, o),
    crowd: (o) => sys.crowd(o),
    util: { poseAlongPath, phaseFor },
    roles: ROLE_NAMES,
    animals: ANIMAL_NAMES,
    props: PROP_NAMES,
    poses: Object.keys(HUMAN_CLIPS).filter((n) => !n.includes('~')),   // (variants 'pose~k' are chosen per figure)
    // Tamid 4:3: "the first with the head and the right leg — the head in his right hand … the leg in his left";
    // 6th the entrails in a bazach with the lower legs on top, 7th the fine flour, 8th the chavitin, 9th the wine
    tamid: {
      carriers: [
        { right: 'limb_head', left: 'limb', pose: 'carry_limbs' }, { right: 'limb_foreleg', left: 'limb_foreleg', pose: 'carry_limbs' },
        { right: 'limb_oketz', left: 'limb', pose: 'carry_limbs' }, { right: 'limb_chazeh', left: 'limb_gerah', pose: 'carry_limbs' },
        { right: 'limb_dofen', left: 'limb_dofen', pose: 'carry_limbs' }, { right: 'entrails_bazach', left: null, pose: 'carry' },
        { right: 'solet', left: null, pose: 'carry' }, { right: 'chavitin', left: null, pose: 'carry' }, { right: 'wine_jug', left: null, pose: 'carry' },
      ],
    },
    // the fixtures' geometry the service poses assume (figure frame: metres, −z ahead, +x his right); the windlass
    // stations carry the wheel angle ↔ pose phase coupling (phaseAt) for lowering (windlass) and raising
    // (windlassRaise, pose windlass_raise) the kiyor; staff.strike.tip = where the blow lands
    // people-4: crank (the Golah wheel's hub, spokes and the wheel angle <-> phase coupling), waveUnder (the tenufah pair's
    // spacing), knead (the working surface), eat (the bite's phase window)
    stations: { windlass: WINDLASS, windlassRaise: WINDLASS_RAISE, staff: STAFF, mitreGrasp: MITRE_GRASP, crank: CRANK, waveUnder: WAVE_UNDER, knead: KNEAD, eat: EAT },
    animalPoses: Object.keys(QUAD_CLIPS),
    birdPoses: Object.keys(BIRD_CLIPS),
    get actors() { return [...sys.actors]; },
    get stats() { return sys.stats; },
    root: sys.root,
    system: sys,
  };

  // the clips baked in the worker since the boot began (prebake.js): figures spawned from here on find their rig ready
  await whenPrebaked(10000);

  if (ctx.params?.debug?.has?.('people')) {
    try {
      const { buildDemo } = await import('./demo.js');
      buildDemo(ctx);
    } catch (e) { console.error('[people] demo failed', e); }
  }
}
