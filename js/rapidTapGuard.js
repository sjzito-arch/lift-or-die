// Shared across every screen that can record a set (the ready screen and the
// post-rest overtime screen), so a rapid double-tap is caught even when the
// two taps land on different screens/elements. See ADR notes in
// Architecture.md for why a per-screen module variable isn't enough.
const RAPID_TAP_WINDOW_MS = 500;
let lastRecordAttemptAt = 0;

export function isRapidRepeatTap() {
  return Date.now() - lastRecordAttemptAt < RAPID_TAP_WINDOW_MS;
}

export function markRecordAttempt() {
  lastRecordAttemptAt = Date.now();
}

export function resetRecordAttempt() {
  lastRecordAttemptAt = 0;
}
