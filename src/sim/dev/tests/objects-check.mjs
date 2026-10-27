#!/usr/bin/env node
// Content check for the inspect cards (console-design §6.2 "Coverage required"), in node — no browser:
//   objects.js      every element of kind fixture, gate, chamber, curtain, stair, ramp and opening has an entry; ≥ 60 of
//                   them have a sourced purpose; no purpose / use / notes text without sources; every inAction event
//                   exists in the schedule; every alias is a known movable (the world's, listed below) or a site
//                   element; every glossary key and zone named exists; pick boxes are well formed
//   people-info.js  every role of people/roles.js, every animal kind and every prop has an entry; every who / attire /
//                   what text has sources
// Run: node src/sim/dev/tests/objects-check.mjs   (exits 1 on any failure)
import { SITE, CANONICAL_ZONES } from '../../../data/site.js';
import { EVENTS } from '../../../data/schedule.js';
import { GLOSSARY } from '../../../data/glossary.js';
import { OBJECTS, ALIASES } from '../../../data/objects.js';
import { ROLES_INFO, ANIMALS_INFO, PROPS_INFO, ROLE_PARTICIPANTS } from '../../../data/people-info.js';
import { ROLE_NAMES, ANIMAL_NAMES } from '../../../people/roles.js';
import { PROP_NAMES } from '../../../people/props.js';

// the world's movables (ctx.movables keys at boot, 2026-10; door:/curtain:/wheel: of a site element are accepted too)
const MOVABLES = new Set(['parah.pyre', 'azarah.moked.keys-slab', 'altar.libation-cup.water', 'altar.libation-cup.wine', 'altar.libation-cups',
  'altar.maarachah.great.pile', 'altar.tapuach', 'altar.two-logs', 'altar.machtah', 'altar.kiyor', 'heichal.nivreshet', 'heichal.shulchan.bread',
  'heichal.shulchan.bread.incoming', 'door:en.music-chambers.n', 'door:en.music-chambers.s', 'door:azarah.chamber.pinchas.door',
  'door:azarah.chamber.chavitin.door', 'door:azarah.chamber.gazit.east', 'door:azarah.chamber.gazit.west', 'door:azarah.gate.moked.pishpash',
  'curtain:azarah.mikveh.mayim-roof.screen', 'curtain:azarah.chamber.parvah.screen', 'door:azarah.underground.privy',
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => `heichal.menorah.lamp-${i}`)]);
const KINDS = new Set(['fixture', 'gate', 'chamber', 'curtain', 'stair', 'ramp', 'opening']);
const fails = [];
const fail = (m) => fails.push(m);
const els = SITE.elements;
const events = new Set(EVENTS.map((e) => e.id));
const zones = new Set([...(CANONICAL_ZONES || []), ...Object.keys(SITE.zones || {})]);
const sourced = (x) => !x || (typeof x.en === 'string' && x.en.length > 0 && Array.isArray(x.sources) && x.sources.length > 0 && x.sources.every((s) => typeof s === 'string' && s.trim()));

// ------------------------------------------------------------------------------------------------ objects
const required = Object.values(els).filter((e) => KINDS.has(e.kind));
const missing = required.filter((e) => !OBJECTS[e.id]).map((e) => e.id);
if (missing.length) fail(`objects: ${missing.length} required elements without an entry: ${missing.join(', ')}`);
const withPurpose = required.filter((e) => OBJECTS[e.id]?.purpose).length;
if (withPurpose < 60) fail(`objects: only ${withPurpose} required elements have a sourced purpose (< 60)`);
let inAction = 0;
for (const [id, o] of Object.entries(OBJECTS)) {
  const isEl = !!els[id], isFire = id.startsWith('fire:');
  if (!isEl && !isFire && !o.pickBoxes) fail(`objects: ${id} is neither a site element, a fire nor has a pick box`);
  for (const k of ['purpose', 'use', 'notes']) if (o[k] && !sourced(o[k])) fail(`objects: ${id}.${k} has text without sources`);
  if (o.title && !o.title.en) fail(`objects: ${id}.title has no en`);
  if (!isEl && !o.title) fail(`objects: ${id} needs a title (no element name to fall back on)`);
  if (o.glossary && !GLOSSARY[o.glossary]) fail(`objects: ${id}.glossary "${o.glossary}" not in the glossary`);
  for (const z of [o.zone, ...(o.zones || [])].filter(Boolean)) if (!zones.has(z)) fail(`objects: ${id} names unknown zone "${z}"`);
  for (const ia of o.inAction || []) {
    inAction++;
    if (!events.has(ia.event)) fail(`objects: ${id}.inAction event "${ia.event}" not in the schedule`);
    if (!ia.label?.en) fail(`objects: ${id}.inAction "${ia.event}" has no label`);
  }
  for (const a of o.aliases || []) {
    const m = /^(door|curtain|wheel):(.+)$/.exec(a);
    const ok = MOVABLES.has(a) || els[a] || (m && els[m[2]]);
    if (!ok) fail(`objects: ${id}.alias "${a}" is not a known movable or element`);
  }
  for (const b of o.pickBoxes || []) if (!(b.min?.length === 3 && b.max?.length === 3 && b.min.every((v, i) => v < b.max[i]))) fail(`objects: ${id} has a bad pick box`);
}
for (const [a, id] of Object.entries(ALIASES)) if (!OBJECTS[id]) fail(`objects: alias ${a} → missing ${id}`);

// ------------------------------------------------------------------------------------------------ people
for (const r of ROLE_NAMES) {
  const x = ROLES_INFO[r];
  if (!x) { fail(`people-info: role "${r}" has no entry`); continue; }
  if (!x.title?.en || !x.title?.he) fail(`people-info: role "${r}" title needs en and he`);
  if (!sourced(x.who)) fail(`people-info: role "${r}".who has no sources`);
  if (!sourced(x.attire)) fail(`people-info: role "${r}".attire has no sources`);
  if (x.glossary && !GLOSSARY[x.glossary]) fail(`people-info: role "${r}".glossary "${x.glossary}" not in the glossary`);
  if (!ROLE_PARTICIPANTS[r]) fail(`people-info: role "${r}" missing in ROLE_PARTICIPANTS`);
}
for (const k of ANIMAL_NAMES) {
  const x = ANIMALS_INFO[k];
  if (!x) { fail(`people-info: animal "${k}" has no entry`); continue; }
  if (!x.title?.en || !x.title?.he || !sourced(x.what)) fail(`people-info: animal "${k}" needs title en/he and a sourced what`);
}
for (const p of PROP_NAMES) {
  const x = PROPS_INFO[p];
  if (!x) { fail(`people-info: prop "${p}" has no entry`); continue; }
  if (!x.title?.en) fail(`people-info: prop "${p}" has no title`);
  if (x.what && !sourced(x.what)) fail(`people-info: prop "${p}".what has no sources`);
  if (x.glossary && !GLOSSARY[x.glossary]) fail(`people-info: prop "${p}".glossary "${x.glossary}" not in the glossary`);
}

const summary = {
  objects: Object.keys(OBJECTS).length, required: required.length, withPurpose, inAction, aliases: Object.keys(ALIASES).length,
  roles: Object.keys(ROLES_INFO).length, animals: Object.keys(ANIMALS_INFO).length, props: Object.keys(PROPS_INFO).length,
  propsWithWhat: Object.values(PROPS_INFO).filter((x) => x.what).length,
};
console.log(JSON.stringify(summary));
if (fails.length) { console.error(`objects-check: ${fails.length} failures\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('objects-check: ok');
