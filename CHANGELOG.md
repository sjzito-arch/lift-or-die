# Changelog

## Slice 6 — Completion, progression, history — 2026-07-23

- **Two accepted Slice 4–5 UX carryovers applied first:** overtime text simplified to a static "Rest finished." (no seconds count); **+30 sec** and **Skip Rest** now hide once the rest timer expires, leaving Set Done, Partial / Failed Set, Undo Last Set, and End Workout. Fixed a real bug found along the way: `.stacked-actions` sets `display: flex`, which silently overrode the `hidden` attribute's `display: none` on the `+30`/Skip Rest container — added a global `[hidden] { display: none !important; }` rule so `hidden` always wins regardless of a class's own `display`.
- **Progression (spec §10):** each exercise suggests `currentWeight + increment` when every set met its rep target, else the same weight; editable per-exercise override before final save (`js/session.js`: `computeSuggestedWeight`).
- **Workout completion (spec §11):** the last exercise's completion now opens a real review screen (`js/workoutCompletion.js`) — every exercise's result, editable suggested next weight, duration, total volume, and a **Complete Workout** action, with Undo Last Set and Save as Incomplete / Discard still available. Confirming atomically writes progression to every exercise config, the completed workout record, the session's removal, and the lifetime-vote increment in one IndexedDB transaction (`db.js`'s new `runAtomicTransaction`) — verified idempotent by calling completion twice on the same session and confirming the second call is refused outright (ADR-013), and by simulating a mid-write failure and confirming nothing partially committed before a successful retry.
- A one-time, restrained **workout summary** screen follows completion: duration, volume, an overall result line, and at most one canned humorous headline gated on `humorLevel !== 'off'` (`js/statsCalculations.js`) — intentionally minimal, not the full rest-card system (Slice 8).
- **A/B alternation (spec §3/§6)** is now real: Home proposes the opposite of the most recently completed workout, derived at read time from `storedWorkouts` rather than a stored field (ADR-014) — falls back to `firstWorkoutChoice` until a first workout exists. Home also now shows the last completed workout's date and lifetime votes, and a **History** link.
- **History (spec §13, read-only this slice):** `js/history.js` lists completed and incomplete workouts newest first (date, A/B, status, duration) with a simple progress section (original vs. current weight per exercise, highest successful working weight, lifetime votes, total logged); tapping a row opens full detail (every exercise's target/bar/per-side weight and reps per set, success, total volume). No edit/delete yet — that's Slice 7 (ADR-015).
- Fixed a real bug found during verification: Home displayed a stale `lifetimeVotes` (and could show a stale weight/alternation) after completing a workout, because it reused the settings object captured before the workout instead of re-reading it. `renderHome` now always re-fetches settings fresh.
- Verified end-to-end: two full workouts (A then B) with a mix of successful and failed exercises, correct progression suggestions and overrides, correct duration/volume math, exactly one `storedWorkouts` record with `status: 'completed'` per workout, exactly one vote per completion, alternation A→B→A, History list/detail accuracy, invalid-override validation, save-failure/retry with confirmed atomic rollback, and idempotent double-completion protection. Slice 1–5 regressions re-checked (rapid-tap guard, Discard, the two carryover UX fixes) with no failures.
- Slice 6 passes Definition of Done.

## Slices 4 + 5 (milestone) — Rest timer, interruption recovery, exercise transitions, per-side calculations — 2026-07-22

- Added the rest screen (spec §8): an absolute-timestamp countdown after every non-final set (never after an exercise's final set), **+30 sec**, **Skip Rest**, and **Undo Last Set**.
- Added per-side weight calculations (spec §7 formula: `max(0, (target - bar) / 2)`), including the "bar only" message when target is below bar weight, now shown on every active-exercise, rest, and transition screen (`js/loadCalculations.js`).
- Added the exercise transition screen (spec §9): a plain reps/weight summary of the just-finished exercise, the next exercise's target weight and per-side load, the per-side difference, and a large button to start the next exercise.
- The active-workout screen is now dispatched purely from session data (`js/workoutScreen.js`) — resting, ready-for-set, exercise-complete, or all-exercises-done — never from a separately stored flag, so a reload at any stage restores the exact right screen without any risk of duplicating a transition (ADR-009).
- Undo is available from the exercise-complete and all-exercises-done screens too, not just the ready screen, so a mistaken final set can still be corrected before moving on.
- After the last exercise's final set, the app shows the same completion summary plus a plain note that workout completion and progression arrive in Slice 6, alongside the existing Save as Incomplete / Discard choices — no completion or progression logic invented ahead of that slice (ADR-011).
- Every session-mutating function now re-fetches the session fresh from IndexedDB before writing, closing a staleness risk introduced by the rest screen's long-lived render (ADR-010).
- Set Done, partial confirmation, Undo, +30 sec, Skip Rest, and the next-exercise action all show a plain-language inline error and re-enable on a simulated storage failure; the atomic Save as Incomplete write and existing rapid-tap/undo guards were re-verified against the full 3-exercise flow.
- Verified end-to-end: a full 15-set, 3-exercise workout recorded correct per-side weights and diffs throughout, reached the all-exercises-done screen, and saved via Save as Incomplete with all three exercises marked successful and a correct `durationSeconds`. Slice 1–3 flows (Daily Vote, Change Workout, rapid-tap guard, Discard) re-verified with no regressions.
- Deferred: rest cards/tips (Slice 8, not yet started) — the rest screen intentionally has no card below the timer. Workout completion, progression suggestions, lifetime vote, and A/B alternation remain Slice 6.

**Acceptance-test follow-up (same day):**

- **Rest no longer auto-advances at zero.** The rest screen now stays visible past the countdown, switches to a green "expired" state, chimes/vibrates exactly once, and keeps counting elapsed time as overtime — a negative timer plus plain text ("Rest finished — 12 seconds over."). The lifter starts the next set in their own time; nothing is force-started. This replaces the original auto-advance-and-skip behavior this milestone shipped with initially.
- **Set Done and Partial / Failed Set are now exposed directly on the expired rest screen**, so the next set can be recorded the moment it's done without a separate screen. Undo Last Set and End Workout remain available throughout (before and after expiry). The Set Done/Partial markup and handlers (including the rapid-tap guard) were extracted into a shared `js/setRecording.js` used by both the ready screen and the rest screen, so the two behave identically; the rapid-tap guard itself moved into `js/rapidTapGuard.js` so it's shared across both screens rather than scoped to one.
- **Background/reload recovery recomputes overtime correctly** — verified by expiring a rest in the background and reloading; the shown "N seconds over" matches real elapsed time, not the time at last render.
- **+30 sec now fully re-renders** rather than adjusting an in-memory timestamp in place, so it correctly flips the screen back from the overtime state to a normal countdown when the extension lands in the future — verified directly.
- Renamed the exercise-transition button to **"Start [next exercise name]"** (e.g. "Start Bench Press").
- Reworded the per-side load-difference text from signed numbers ("-10 lb per side") to plain language: **"Add 10 lb per side."** / **"Remove 10 lb per side."** / "No change per side." (unchanged).
- Updated `docs/Product-Spec-v1.0.md` §8 to reflect the approved overtime behavior, replacing the old "show Ready for Set N rather than a negative timer" line.
- Re-verified end-to-end: live overtime counting, chime-once (no repeat), Set Done/Partial/Undo all functioning from the overtime screen, reload recovery at multiple overtime durations, the three diff-text cases (add/remove/no-change), and a full Slice 1–3 regression pass — no console errors.

**Bug fix (same day):** Set Done/Partial succeeding from the overtime screen called the dispatcher's `rerender` without first stopping that screen's own countdown `setInterval`, leaving a detached timer loop running in the background after every set recorded from overtime. Fixed by having `enterOvertimeState` wrap the shared `rerender` with `stopTicking()` first. Verified by instrumenting `setInterval`/`clearInterval` to count live intervals: exactly one active interval at all times, confirmed across Set Done and Partial success from overtime, Undo, Skip Rest, +30 sec, and End Workout (both Save as Incomplete and Discard) — none leave an orphaned interval.
- Milestone (with follow-up) passes Definition of Done.

## Slice 3 — Active exercise, Set Done, partial set, undo — 2026-07-22

- Replaced the Slice 2 active-workout placeholder with the real one-exercise-at-a-time screen (`js/activeExercise.js`): exercise name, target total weight, "Ready for Set N of M," rep target, "Exercise X of Y" progress, a large **Set Done** button, a **Partial / Failed Set** inline entry (0–target reps, no modal), and a small **Undo Last Set**.
- Set Done and partial entry save each `SetResult` (`setNumber`, `reps`, `completedAt`) to IndexedDB immediately and guard against rapid duplicate taps, same pattern as the Slice 2 Lift button.
- An exercise's `success` is recomputed from its current `setResults` on every change (`null` until all `targetSets` are recorded, then a reps-vs-target check) — so Undo automatically resets `success` back to `null` the moment the exercise is no longer fully recorded, with no special-case code (ADR-008).
- Undo is single-level: it hides itself immediately after use until another set is recorded.
- Added **Save as Incomplete** to the guarded End Workout control, appearing alongside Discard only once at least one set has been recorded anywhere in the session (matching the Slice 2 spec clarification to §12); a zero-set session still offers Discard only. Home's launch-recovery view shows the same choices directly.
- Save as Incomplete writes the `storedWorkouts` record and removes the active `workoutSessions` record in one atomic transaction (`db.js`'s new `putThenDeleteAtomic`), reusing the session's own id as the stored workout's id so a retry is idempotent — verified directly by calling it twice with the same session and confirming no duplicate record.
- Saved-incomplete workouts now store `durationSeconds`, computed from the session's `createdAt` to the save timestamp.
- Set Done, partial-set confirmation, Undo, and Save as Incomplete now catch a save failure, show a plain-language inline error, leave all data/input untouched, and re-enable the control so the user can retry — verified by simulating a storage failure and confirming no partial write, then a successful retry.
- Added a data-layer guard in `recordSet` rejecting an attempt to record more than an exercise's `targetSets` — verified directly (throws, no 6th set persisted).
- The single-level undo guard (`justUndone`) is now persisted on the exercise itself, not just held in memory, so it survives a reload: after an undo, another undo stays unavailable until a new set is recorded, even across app reopen — verified by undoing, reloading/resuming, and confirming Undo stayed hidden until the next set was recorded.
- Confirm Discard now catches a save failure the same way as the other controls: inline error, session preserved, button re-enabled for retry — verified by simulating a storage failure and confirming a successful retry afterward.
- Fixed a manual-testing defect: rapidly tapping Set Done could advance two sets (e.g. Set 2 to Set 4) because disabling the tapped button doesn't stop a second tap from landing on the freshly re-rendered replacement button. Set Done and Partial confirm now share a module-scoped timestamp guard that survives re-rendering and ignores any second recording attempt within 500ms of the first, regardless of which button element it lands on. Verified with a controlled-clock test (mocking `Date.now` to remove this environment's timer jitter from the measurement): a genuine 50ms/80ms gap between taps is correctly blocked (only one set recorded) for both Set Done and Partial confirm, while a genuine 600ms+ gap is correctly allowed through (two sets recorded, confirming no perceptible delay in normal use).
- No per-side weight, rest countdown, or exercise transition yet — those stay Slices 4–5 per the spec's own slice ordering; the exercise-complete state is a plain indicator with no auto-advance.
- Verified: Set Done/partial record correctly and immediately; rapid double-tap on Set Done produces exactly one recorded set; partial entry rejects out-of-range values with a plain-language message; Undo removes only the latest set, restores the correct "Ready for Set N," and resets `success` to `null` when undoing out of a completed exercise; reload mid-exercise (via Home Resume) restores the exact same set count and state; End Workout offers Discard-only at zero sets and Save as Incomplete + Discard once sets exist; Save as Incomplete writes exactly one history record with the real set data and `durationSeconds`, applies no progression, and removes the session atomically.
- Manual acceptance test passed: rapid double-tap records only one set, partial set, undo, reload/resume, the persisted undo guard, exercise completion, End Workout, and Save as Incomplete all confirmed working as expected. The absence of a Next Exercise button was acknowledged as planned Slice 5 scope, not a defect.
- Slice 3 passes Definition of Done.

## Slice 2 — Daily Vote and workout creation/resume — 2026-07-22

- Added the **Lift or Die?** daily ritual: Home's Start Workout leads to Lift/Not today; Not today exits with kind copy and changes no state.
- Added a small, secondary **Change Workout** control on Home to override the proposed A/B workout for the workout being started only; confirmed it never writes `firstWorkoutChoice` or alternation state.
- Lift snapshots the chosen template's exercises (weight, bar weight, rest seconds, sets/reps) into a new active `workoutSessions` record atomically, validating first so a missing setting blocks creation with a plain-language message instead of a partial session (ADR-007).
- Added a minimal active-workout placeholder screen (snapshot display + guarded Discard) that Slice 3 will replace with the real one-exercise-at-a-time flow.
- Home now shows **Resume Workout** as primary whenever an active session exists, skipping the Daily Vote step; **Discard Workout** is available both from Home and from the active-workout screen, gated behind an inline confirm/cancel (no modal, no browser `confirm()`).
- Clarified `docs/Product-Spec-v1.0.md` §12: **Save as incomplete** is offered only once at least one set is recorded; a zero-set session offers Resume or guarded Discard only. Slice 2 does not implement Save as incomplete for this reason — it lands with Slice 3's set recording.
- Verified: no-session Home → vote → Not today (no session written); Lift creates exactly one session even under a rapid double-tap; reload mid-session shows Resume (no vote, no Change Workout control); Cancel preserves the session, Confirm Discard removes only the session (settings/history untouched) from both entry points; an incomplete exercise config blocks creation with a plain-language error and no partial session.
- Slice 2 passes Definition of Done.

## Slice 1 — App shell, setup, data schema, persistence — 2026-07-22

- Implemented the app shell and a versioned IndexedDB schema (`appSettings`, `exerciseConfigs`, `workoutTemplates`, `workoutSessions`, `storedWorkouts`).
- Added a step-by-step first-use Setup flow collecting units, program start date, first workout choice, humor level, personal motivation, rest-card category toggles, global default bar weight/rest, and per-exercise starting/current weight, increment, bar/rest overrides, and target sets/reps.
- Squat is stored as a single shared exercise record referenced by both Workout A and Workout B templates (ADR-006); exercise order is owned solely by the workout templates.
- Setup is resumable step-by-step after an interruption without creating duplicate exercise or template records.
- Home shows the next proposed workout with its exercises and current weights, persisted across refresh/reopen.
- Fixed a Setup Review screen defect found during manual testing: it now shows original weight, current weight, increment, effective bar weight, effective rest duration, and target sets×reps for every exercise.
- Manual validation confirmed setup field validation rejects a blank required field and a negative value, in each case blocking progress with a plain-language message.
- Slice 1 passes Definition of Done.

## Project Kit 2.0 — 2026-07-22

- Reconstructed and consolidated the Claude-ready project foundation.
- Strengthened `CLAUDE.md` with role boundaries, authority order, token-efficient workflow, change discipline, and recover-not-punish rules.
- Strengthened the product specification with accidental-tap protection, force-close recovery, failed-set behavior, idempotent progression, completed-workout editing, navigation rules, storage failure handling, and validation philosophy.
- Added architecture decision log, definition of done, prompt library, build workflow, layman build guide, and polished gym-test template.
- Kept V1 oriented toward one user and early gym feedback rather than production-scale process.
- Reconciled against the actual v1.0 archive: restored the explicit Home screen, first-workout selection, incomplete-workout saving/history, simple progress views, full Settings scope, original gym acceptance path, and detailed beginner build guidance.

## Project Kit 1.1 — historical summary

- Added token-efficiency guidance, one-slice workflow, focused edits, and developer anti-patterns.
- Added a reusable workflow document.

## Product Spec 1.0

- Established the personal 5×5 PWA concept, active set flow, rest timer, plate-side calculation, history, progression, rest cards, personality, and offline-first direction.
