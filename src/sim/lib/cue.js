// One-shot cues on the sim clock. The runtime gives every choreo update a crossing interval (from, from + span]:
// the sim minutes that passed in CONTINUOUS play since that choreo's previous update (empty after a jump, a date
// change, while paused or running backwards). cueAt fires when its moment lies in that interval — so a cue fires
// once when the clock runs through it, never when the clock is set past it, and a key never fires twice.
import { wrap } from './core.js';

/** hidden per-choreo handle the runtime attaches to each state object */
export const SIM = Symbol.for('mikdash.sim');

/**
 * Minutes after its event's t0 at which a headline cue (and the visuals tied to it) may first sit. The UI's
 * "jump to event" sets the clock to t0 + 0.25 (ui/app.js jumpToEvent) and jumps never fire cues, so a cue in
 * [t0, t0 + 0.25] would be skipped by exactly the visitor who asked to see that event. Rule for every choreo:
 * no cue in [t0, t0 + CUE_LEAD) of the event it belongs to.
 */
export const CUE_LEAD = 0.5;

/** did the continuous clock pass tCue in this update? (no bookkeeping) */
export function crossed(state, tCue) {
  const c = state?.[SIM]?.crossing;
  if (!c?.ok || !Number.isFinite(tCue)) return false;
  const d = wrap(tCue - c.from);
  return d > 0 && d <= c.span;
}

/**
 * Fire fn exactly once when the sim clock crosses tCue (minutes, cyclic) during continuous play.
 * key identifies the moment (e.g. `shalom:${round}:${post}`); a key that fired is not fired again until the clock
 * jumps or ~12 sim hours of play have passed (the next day's loop). Returns true when it fired.
 */
export function cueAt(state, key, tCue, fn) {
  const h = state?.[SIM];
  if (!h || !crossed(state, tCue)) return false;
  const at = h.fired.get(key);
  if (at !== undefined && h.runtime.playClock - at < 720) return false;
  h.fired.set(key, h.runtime.playClock);
  try { fn?.(); } catch (e) { console.error(`[sim] cue ${key} failed`, e); }
  return true;
}
