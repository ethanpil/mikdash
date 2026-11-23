// node src/people/dev/walk-variants-check.mjs — the walk variants (lifelike-people r3) against the base walk: every bone
// but the neck and head must sit exactly where the walk puts it (0 mm), and the head's offset in yaw and pitch.
const root = new URL('../', import.meta.url).href;
const { Vector3 } = await import('three');
const { getRig } = await import(root + 'rig.js');
const { PoseBuilder } = await import(root + 'pose.js');
const { HUMAN_CLIPS } = await import(root + 'clips.js');
const keep = ['pelvis', 'foot_l', 'foot_r', 'toe_l', 'toe_r', 'hand_l', 'hand_r', 'farm_l', 'farm_r', 'shin_l', 'shin_r', 'chest'];
for (const rk of ['man', 'woman', 'elder', 'child']) {
  const r = getRig(rk), A = new PoseBuilder(r), B = new PoseBuilder(r);
  for (const v of ['walk~1', 'walk~2', 'walk~3']) {
    let maxKeep = 0, headMin = 1e9, headMax = -1e9, pitch = [1e9, -1e9];
    for (let i = 0; i < 32; i++) {
      const ph = i / 32;
      A.reset(); HUMAN_CLIPS.walk.fn(A, r, ph);
      B.reset(); HUMAN_CLIPS[v].fn(B, r, ph);
      for (const b of keep) { if (!r.index[b] && r.index[b] !== 0) continue; maxKeep = Math.max(maxKeep, A.worldPos(b).distanceTo(B.worldPos(b))); }
      const fa = new Vector3(0, 0, -1).applyQuaternion(A.worldQ('head')), fb = new Vector3(0, 0, -1).applyQuaternion(B.worldQ('head'));
      const dy = (Math.atan2(-fb.x, -fb.z) - Math.atan2(-fa.x, -fa.z)) * 57.3, dp = (Math.asin(fb.y) - Math.asin(fa.y)) * 57.3;
      headMin = Math.min(headMin, dy); headMax = Math.max(headMax, dy); pitch[0] = Math.min(pitch[0], dp); pitch[1] = Math.max(pitch[1], dp);
    }
    console.log(rk, v, 'max diff hips/legs/feet/arms/hands/chest vs walk:', (maxKeep * 1000).toFixed(3), 'mm; head yaw offset', headMin.toFixed(1), '..', headMax.toFixed(1), 'deg; pitch offset', pitch[0].toFixed(1), '..', pitch[1].toFixed(1));
  }
}
