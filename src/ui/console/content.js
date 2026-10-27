// Reference content for cards, Learn and the fallback search, loaded after 'firstFrame' (never in front of the boot).
// import.meta.glob so the optional files (B's people-info.js and objects.js) may be absent and the build still passes.
const GLOB = import.meta.glob(['../../data/glossary.js', '../../data/offerings.js', '../../data/people-info.js', '../../data/objects.js', '../../data/schedule.js', '../../people/roles.js']);
const pick = (suffix) => Object.entries(GLOB).find(([k]) => k.endsWith(suffix))?.[1] || null;

export function createContent() {
  const c = {
    loaded: false,
    glossary: null, offerings: null, stations: null, rolesInfo: null, animalsInfo: null, propsInfo: null, objects: null,
    eventsFor: null, roles: null, animals: null,
  };
  let p = null;
  c.load = () => {
    if (p) return p;
    const get = async (suffix) => { const f = pick(suffix); if (!f) return null; try { return await f(); } catch (e) { console.error(`[ui] content ${suffix}`, e); return null; } };
    p = Promise.all([get('/glossary.js'), get('/offerings.js'), get('/people-info.js'), get('/objects.js'), get('/schedule.js'), get('/roles.js')])
      .then(([gl, off, pi, ob, sch, ro]) => {
        c.glossary = gl?.GLOSSARY || null;
        c.offerings = off?.OFFERING_TYPES || null;
        c.stations = off?.STATIONS || null;
        c.rolesInfo = pi?.ROLES_INFO || null;
        c.animalsInfo = pi?.ANIMALS_INFO || null;
        c.propsInfo = pi?.PROPS_INFO || null;
        c.objects = ob?.OBJECTS || null;
        c.eventsFor = sch?.eventsFor || null;
        c.roles = ro?.ROLES || null;
        c.animals = ro?.ANIMALS || null;
        c.loaded = true;
        return c;
      });
    return p;
  };
  return c;
}
