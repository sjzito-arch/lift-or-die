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

