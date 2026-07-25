// Keeps the screen from auto-locking while a set of a workout is being
// recorded (spec: phone sits untouched on the ground/bag during rest, which
// is exactly when iOS's idle-timeout would otherwise dim/lock it). The lock
// is released automatically by the browser whenever the tab backgrounds, and
// does not reacquire itself on return — `active` tracks whether we still
// want it, so `visibilitychange` can re-request it when the app comes back.
let sentinel = null;
let active = false;

async function requestSentinel() {
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch {
    // Unsupported, refused, or denied (e.g. low battery) — silently no-op.
    // Losing the wake lock never blocks recording a set.
    sentinel = null;
  }
}

export async function acquireWakeLock() {
  active = true;
  if (!('wakeLock' in navigator) || sentinel) return;
  await requestSentinel();
}

export function releaseWakeLock() {
  active = false;
  if (sentinel) {
    sentinel.release().catch(() => {});
    sentinel = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (active && document.visibilityState === 'visible' && !sentinel) {
      requestSentinel();
    }
  });
}
