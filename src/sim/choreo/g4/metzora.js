// The healed metzora's asham at Sha'ar Nikanor (Negaim 14:7–10): the rite's clock and the walk of the kohen who takes
// its blood in a vessel to the altar (the NE corner, then the SW, below the red line, the rest on the southern yesod —
// Zevachim 5:5). nikanor-stations stages it; private-offerings (G5) books the altar's corners for exactly the minutes this
// kohen holds them, before it lays the day's offerings — so both read the same pure itinerary from here.
import { Itin } from './lib.js';

/** the rite's clock, minutes from the metzora event's start — the sources give the order, the minutes are ⚙ */
export const METZORA_T = { atGate: 15, wave: [16, 17.5], lean: [17.6, 19.0], lead: 19.1, slaughter: 19.6, blood: 20.4, bohen: [21.6, 23.6], oil: [24.0, 28.4] };

// Pinchas' chamber door to Ezrat Yisrael (the kohanim's way in and out) ⚙
export const PINCHAS = [[251.5, 341.5, 13.5], [246.6, 341.5, 13.5], [246.2, 337.0, 13.5]];
// the asham: from Nikanor over the duchan to its ring in the north ⚙
export const TO_RING = [[253.4, 330.0, 13.5], [246.0, 334.6, 13.5], [244.4, 335.0, 13.5], [241.6, 336.2, 16], [234.5, 345.5, 16], [230.6, 352.4, 16], [229.8, 354.4, 16]];
// the asham's blood to the altar: the NE corner and the SW corner below the red line, the rest on the southern yesod
export const NE = [233.9, 338.6, 16], SW = [200.2, 304.6, 16];
export const BLOOD_WAY = [[230.2, 356.6, 16], [235.6, 345, 16], NE];
export const NE_TO_SW = [NE, [236.2, 318, 16], [236.2, 273.0, 16], [206.5, 273.0, 16], [203.6, 279, 16], [199.4, 300.6, 16], SW];
export const SW_BACK = [SW, [199.4, 300.6, 16], [203.6, 279, 16], [206.5, 273.0, 16], [236.2, 273.0, 16], [236.2, 318, 16], [241.6, 326.6, 16], [244.4, 327.0, 13.5], [252.2, 328.4, 13.5]];

/** minutes from the event's start at which the vessel kohen's itinerary begins (out of Pinchas' door) */
export const VESSEL_START = METZORA_T.atGate - 1.5;

/**
 * Kohen B: out of Pinchas' door with the mizrak; waits; follows to the ring; receives; the NE and SW corners; back for
 * the oil (Negaim 14:8–10). Minutes from VESSEL_START. Pure: the same itinerary for the stager and for G5's booking.
 */
export function vesselKohen(T = METZORA_T) {
  const C0 = VESSEL_START;
  const KB = new Itin();
  KB.walkTo([...PINCHAS, [251.4, 334.6, 13.5]], 1.1, { prop: 'mizrak_silver' });
  const bArr = KB.T;
  KB.stand(T.lead + 0.15 - C0, 300, { prop: 'mizrak_silver' });
  KB.walkTo([[251.4, 334.6, 13.5], ...TO_RING.slice(1, -1), [229.0, 353.8, 16]], 1.0, { prop: 'mizrak_silver' });
  const bRing = KB.T;
  KB.stand(Math.max(0.2, T.slaughter - T.lead - 0.15 - (bRing - bArr)), 180, { at: [229.0, 353.8, 16], prop: 'mizrak_silver' });
  KB.stand(T.blood - T.slaughter, 180, { at: [229.0, 353.8, 16], pose: 'receive', prop: 'mizrak_silver' });
  const bBlood = KB.T;
  KB.walkTo(BLOOD_WAY, 1.1, { prop: 'mizrak_silver' });
  KB.stand(0.3, 225, { pose: 'throw', phase: (q) => q, prop: 'mizrak_silver' });
  KB.walkTo(NE_TO_SW, 1.15, { prop: 'mizrak_silver' });
  KB.stand(0.3, 45, { pose: 'throw', phase: (q) => q, prop: 'mizrak_silver' });
  KB.stand(0.3, 20, { at: [200.6, 304.9, 16], pose: 'pour', phase: (q) => q, prop: 'mizrak_silver' });
  KB.walkTo(SW_BACK, 1.15, { prop: null });
  const bBack = KB.T;
  KB.stand(Math.max(0.3, T.oil[0] - C0 - bBack), 90);
  KB.stand(0.8, 60, { at: [253.0, 329.2, 13.5], pose: 'pour', prop: 'oil_flask' });
  KB.stand(T.oil[1] - T.oil[0] - 0.8, 90, { at: [253.0, 329.2, 13.5], prop: 'oil_flask' });
  KB.stand(1.5, 90, { at: [253.0, 329.2, 13.5] });
  KB.walkTo([[253.0, 329.2, 13.5], [250.0, 336.0, 13.5], ...[...PINCHAS].reverse()], 1.1);
  KB.done();
  return { it: KB, blood: [bBlood, bBack] };
}

const _s = {};
/**
 * The minutes [a, b] (absolute, from the event's start w0) in which the vessel kohen is within r amot of each place
 * { c: [X, Y], r, z: [z0, z1] } while he takes the blood round the altar — sampled every 0.01 min, edges refined by
 * bisection to 1e-4 min. null for a place he never reaches.
 */
export function vesselAt(w0, places, T = METZORA_T) {
  const { it, blood } = vesselKohen(T);
  const t0 = w0 + VESSEL_START;
  const inside = (u, P) => { it.sample(u, _s); return _s.Z > P.z[0] && _s.Z < P.z[1] && Math.hypot(_s.X - P.c[0], _s.Y - P.c[1]) < P.r; };
  const edge = (a, b, P, inA) => { for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (inside(m, P) === inA) a = m; else b = m; } return (a + b) / 2; };
  return places.map((P) => {
    let a = NaN, b = NaN, prev = inside(blood[0], P), u0 = blood[0];
    for (let u = blood[0] + 0.01; u <= blood[1] + 1e-9; u += 0.01) {
      const cur = inside(u, P);
      if (cur && !prev && !(a === a)) a = edge(u0, u, P, false);
      if (!cur && prev) b = edge(u0, u, P, true);
      prev = cur; u0 = u;
    }
    if (prev && !(b === b)) b = blood[1];
    return a === a && b === b ? [t0 + a, t0 + b] : null;
  });
}
