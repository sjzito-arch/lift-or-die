# Changelog

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
