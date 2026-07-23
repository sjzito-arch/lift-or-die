let sharedContext = null;

// Call from within a real user gesture (e.g. a Set Done tap) so the audio
// context is unlocked before it's needed later when the rest timer expires
// on its own — iOS Safari otherwise blocks audio started outside a gesture.
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!sharedContext) sharedContext = new Ctx();
    if (sharedContext.state === 'suspended') sharedContext.resume();
  } catch (err) {
    // Audio isn't available in this environment; the chime is best-effort.
  }
}

// A short, restrained tone plus a vibration fallback, per spec §8: "use a
// restrained chime/vibration where browser permissions and iOS behavior allow."
export function playChime() {
  try {
    const ctx = sharedContext;
    if (ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (err) {
    // Best effort only.
  }
  if (navigator.vibrate) {
    try {
      navigator.vibrate(200);
    } catch (err) {
      // Best effort only.
    }
  }
}
