// STUB — owned by the audio task. See ARCHITECTURE.md §Audio.
export async function init(ctx) {
  ctx.audio = { cue: () => {}, loop: () => ({ setGain() {}, stop() {} }), unlock: async () => {} };
}
