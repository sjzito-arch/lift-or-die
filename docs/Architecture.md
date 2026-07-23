# Architecture Decision Log

This is a living record, not a speculative design essay. Add entries only for decisions that meaningfully constrain later work.

## ADR-001 — Offline-first installable web app

- Date: 2026-07-22
- Status: Accepted
- Decision: Build V1 as an installable HTML5 PWA.
- Reason: The required set counter, timer, calculations, local history, and cards are achievable without native distribution. The fastest feedback loop is gym use.
- Tradeoff: Background timer alarms on iOS are not guaranteed.

## ADR-002 — IndexedDB for durable app data

- Date: 2026-07-22
- Status: Accepted
- Decision: Store configuration, active sessions, and history in IndexedDB with explicit schema versions.
- Reason: Data is structured and must survive reloads and interruption. It is a better fit than localStorage.
- Tradeoff: Requires a small persistence layer and migrations.

## ADR-003 — Minimal dependency policy

- Date: 2026-07-22
- Status: Accepted
- Decision: Prefer plain HTML, CSS, and JavaScript for V1.
- Reason: The app is small, personal, and must be easy to inspect and maintain with AI assistance.
- Tradeoff: Some infrastructure must be written locally.

## ADR-004 — Absolute timer timestamps

- Date: 2026-07-22
- Status: Accepted
- Decision: Persist a rest end timestamp and derive remaining time from the clock.
- Reason: Browsers suspend background pages; decrementing a counter would drift.
- Tradeoff: V1 corrects the display on return but cannot promise a background alert.

## ADR-005 — Immediate active-session persistence

- Date: 2026-07-22
- Status: Accepted
- Decision: Save after every meaningful workout action and make completion idempotent.
- Reason: A phone or browser may close mid-workout, and duplicate taps must not duplicate progression.
- Tradeoff: Workout actions depend on a reliable, well-tested persistence boundary.

## ADR-006 — Shared ExerciseConfig for Squat across Workout A and B

- Date: 2026-07-22
- Status: Accepted
- Decision: Squat is a single `ExerciseConfig` record referenced by both Workout A and Workout B, not a separate record per workout.
- Reason: Squat is trained in every session; its working weight and progression must continue across every squat session regardless of A/B alternation.
- Tradeoff: Exercise-to-workout is a many-to-many reference rather than one config per workout slot; setup and progression logic must resolve Squat's single record from either workout context.

## ADR-007 — Workout sessions snapshot exercise data at creation

- Date: 2026-07-22
- Status: Accepted
- Decision: When a `WorkoutSession` is created (Lift tapped), each exercise's current weight, resolved bar weight, resolved rest seconds, and target sets/reps are copied into the session's `exerciseResults` at that instant. Later slices read/write only this snapshot during the active workout, never live `ExerciseConfig` records.
- Reason: Spec §10 requires that settings changes mid-workout affect future workouts only, not an in-progress one. Snapshotting once at creation, inside a single validated read-then-write step before the atomic `put`, is simpler than reconciling live config drift mid-session.
- Alternatives considered: Re-reading `ExerciseConfig` live during the workout and only freezing values at completion; rejected because it would let a mid-workout settings edit silently change an active session's targets, which the spec forbids.
- Tradeoffs: If an `ExerciseConfig` is corrected after a session starts, the active session will not see the fix until the next workout. Per-side weight math is intentionally left out of the snapshot (deferred to Slice 5) — only the raw inputs it will need are captured.

## ADR-008 — Atomic save-incomplete write; success recomputed on every set change

- Date: 2026-07-22
- Status: Accepted
- Decision: `saveIncompleteSession` writes the `storedWorkouts` record and deletes the `workoutSessions` record in one IndexedDB transaction (`db.js`'s new `putThenDeleteAtomic`), reusing the session's own id as the stored workout's id. Separately, an exercise's `success` field is always recomputed from its current `setResults` (null until every `targetSets` is present, else a reps-vs-target check) rather than set once and left stale — so Undo, which removes the last `SetResult`, automatically drops `success` back to `null` with no special-case code.
- Reason: A put-then-delete as two separate calls could leave a duplicated/resumable session sitting alongside an already-saved history entry (or a deleted session with no history record) if the app closed between them — violating "never silently discard an active or completed workout" (spec §18). Reusing the session id as the stored-workout id makes a retry of the whole operation idempotent instead of needing separate dedup logic. Recomputing `success` from scratch avoids a second code path for "the exercise is no longer complete" that a hand-written undo-specific reset would require.
- Alternatives considered: Two sequential `putRecord`/`deleteRecord` calls (rejected — not atomic); a random id for the stored workout with a separate dedup key (rejected — more state to reconcile than reusing the session id).
- Tradeoffs: `putThenDeleteAtomic` is written as a specific two-store helper rather than a generic multi-store transaction wrapper, since Slice 3 has exactly one caller; a future caller needing a different store pair will need its own small helper or a generalization at that point.

## New entry template

```markdown
## ADR-NNN — Short title

- Date: YYYY-MM-DD
- Status: Proposed | Accepted | Superseded
- Decision:
- Reason:
- Alternatives considered:
- Tradeoffs:
```

