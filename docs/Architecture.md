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

## ADR-009 — Active-workout screen is derived from data, never from a stored flag

- Date: 2026-07-22
- Status: Accepted
- Decision: A single dispatcher (`js/workoutScreen.js`) decides which of the four active-workout screens (resting, ready-for-set, exercise-complete, all-exercises-done) to render purely from the current exercise's `setResults.length` vs `targetSets` and its `restEndsAt`, plus whether it's the session's last exercise. `session.uiState` is not read for this decision.
- Reason: Spec §12 requires that closing the app during rest, or on an exercise-complete screen, "restore that state without duplicating completion." Deriving the screen from the same data the mutations already write means there is no separate "current screen" value that could fall out of sync with reality after a crash, a partial write, or an out-of-order reload — the screen is always a pure function of the data.
- Alternatives considered: Storing an explicit `currentScreen` string on the session and updating it alongside each mutation; rejected because it doubles the state that has to stay consistent (data plus a label describing the data) for no behavioral benefit, and a missed update would show the wrong screen even though the underlying data was fine.
- Tradeoffs: Every screen-rendering function must recompute its condition from the full exercise object rather than trusting a cheap flag; acceptable given the app's small data size.

## ADR-010 — Rest timer as an absolute per-exercise timestamp; every mutation re-fetches the session fresh

- Date: 2026-07-22
- Status: Accepted
- Decision: `restEndsAt` (ISO string or `null`) lives on each exercise snapshot. `recordSet` sets it after a non-final set and clears it after an exercise's final set; `undoLastSet` always clears it. The rest screen's live countdown recomputes `restEndsAt - Date.now()` on each tick rather than decrementing a counter. Separately, every session-mutating function in `session.js` (`recordSet`, `undoLastSet`, `addRestTime`, `skipRest`, `advanceToNextExercise`, `saveIncompleteSession`) now re-reads the session from IndexedDB before mutating it, instead of trusting the caller's in-memory copy.
- Reason: Spec §8 requires the countdown to survive backgrounding without drifting, which an absolute timestamp guarantees for free — a decrementing counter would need to account for however long the tab was suspended. The fresh-refetch rule closes a real staleness risk introduced by this same milestone: the rest screen deliberately keeps one render alive across a "+30 sec" tap without a full rerender (to avoid restarting the visible countdown), so the in-memory `session` object handed to later actions in that same render could otherwise be one step behind IndexedDB.
- Alternatives considered: Manually threading the updated session object through every closure after each mutation (what Slice 2/3 did); rejected once the rest screen introduced a render that outlives a single mutation, since it would require remembering to update every closure variable by hand instead of removing the staleness risk at its source.
- Tradeoffs: One extra `getRecord` read before every write; negligible for this app's data size, and it removes an entire class of stale-closure bugs as more screens accumulate in later slices.

## ADR-011 — All-exercises-done is a placeholder screen, not early workout completion

- Date: 2026-07-22
- Status: Superseded by ADR-012 (Slice 6 replaced this placeholder with real completion)
- Decision: After the last exercise's final set, the app shows the same Exercise Complete summary treatment as any other exercise, plus a plain statement that workout completion and progression arrive later, and the existing Save as Incomplete / Discard choices from Slice 2/3 — not a new "complete workout" action.
- Reason: Spec §9 says the last exercise should "proceed to workout completion," but progression suggestions, the completion summary, lifetime vote, and A/B alternation are explicitly Slice 6 (§21). Reusing Save as Incomplete here (already spec-correct: "preserving all recorded sets without applying progression or counting a Lift vote") avoids inventing a piece of completion logic ahead of the slice that owns it, and avoids building something Slice 6 would then have to reconcile or replace.
- Alternatives considered: Building a minimal completion flow now (weight suggestions, vote increment) as part of this milestone; rejected as scope creep into Slice 6's explicitly separate acceptance behavior, and because progression math touches `ExerciseConfig` in a way this milestone was not asked to implement.
- Tradeoffs: Finishing a full workout today saves it as "incomplete" rather than "completed" — expected and temporary until Slice 6 lands; noted as a known limitation in `CURRENT-SLICE.md` and the changelog.

## ADR-012 — Real workout completion replaces the all-exercises-done placeholder

- Date: 2026-07-22
- Status: Accepted
- Decision: The last exercise's completion now routes to a real review screen (`js/workoutCompletion.js`): every exercise's result, an editable suggested next weight, duration, and total volume, with a **Complete Workout** action that commits progression. Save as Incomplete / Discard remain available on this screen too, unchanged from ADR-011's placeholder.
- Reason: This is the slice the spec assigns completion/progression to (§21 Slice 6); ADR-011 was an explicit, documented placeholder pending exactly this work.
- Alternatives considered: none new — this is the planned continuation of ADR-011.
- Tradeoffs: none beyond what ADR-011 already accepted.

## ADR-013 — Idempotent workout completion without a separate transaction id

- Date: 2026-07-22
- Status: Accepted
- Decision: `completeWorkout` writes every affected exercise's new `currentWeight`, the `StoredWorkout` record (`status: 'completed'`, id reused from the session), the session's deletion, and the lifetime-vote increment in one atomic transaction (`db.js`'s new `runAtomicTransaction`, generalized from ADR-008's two-store helper). No separate transaction id is written or checked.
- Reason: Spec §10/§11 require progression to commit exactly once even under a double-tap or a reopened completion screen. Because the whole write is one transaction, it either fully commits — in which case the session row is gone, so a retry's `getFreshSession` throws before touching anything else — or it doesn't commit at all, in which case the session is untouched and a retry starts clean. This reuses the same guard already relied on everywhere else in the session lifecycle, rather than introducing the `completionTransactionId` field the data model sketches out.
- Alternatives considered: Writing and checking a `completionTransactionId` on the session before starting the real work; rejected as redundant bookkeeping once the atomic transaction plus the existing "session gone → refuse to proceed" guard already provide the same guarantee.
- Tradeoffs: `completionTransactionId` remains in the `WorkoutSession` shape (data model documents it) but is never populated or read — a harmless unused field rather than a second idempotency mechanism to keep in sync with the first.

## ADR-014 — A/B alternation is derived at read time, not stored

- Date: 2026-07-22
- Status: Accepted
- Decision: Home computes the next proposed workout by looking up the most recently completed `StoredWorkout` and proposing its opposite type, falling back to `firstWorkoutChoice` when none exists yet. No "next proposed workout" field is written during completion.
- Reason: The alternation rule ("propose the opposite of the last completed workout") is a pure function of already-durable data. Storing a redundant derived field would need to be kept in sync with `storedWorkouts` on every completion and correction, for no benefit — and Slice 7's completed-workout editing must not silently rewrite it, which is trivial if it's never stored (spec §13: "does not silently recalculate... other workout records").
- Alternatives considered: Writing `settings.nextProposedType` during `completeWorkout`; rejected as one more piece of state that could drift from the `storedWorkouts` history it's derived from, especially once Slice 7 allows editing a completed workout's type/date after the fact.
- Tradeoffs: Home does one extra `getAllRecords` + filter/sort on every render; negligible at this app's data scale.

## ADR-015 — History is read-only this slice; the humor headline stays minimal

- Date: 2026-07-22
- Status: Accepted
- Decision: `js/history.js` lists and shows workout detail with no edit or delete controls. The post-completion summary shows at most one humorous headline drawn from the three canned examples already given in the spec/style guide, gated on `humorLevel !== 'off'` — not the full rest-card system.
- Reason: Spec §21 splits "History" (Slice 6) from "completed-workout correction" (Slice 7) — building editing now would be scope creep into the next slice's explicit acceptance behavior. Similarly, §16's rest-card system (categories, no-repeat-in-workout, personalized cards) is Slice 8; the one-line completion headline required by §11 doesn't need that infrastructure, so it's implemented as a tiny standalone picker (`statsCalculations.js`) instead of a preview of Slice 8.
- Alternatives considered: Adding a lightweight edit action now since the data is already on screen; rejected to keep this slice's scope matched to the spec's own slice boundary, and because editing has its own requirements (Save/Cancel, `updatedAt`, no retroactive recalculation) that deserve their own slice rather than an afterthought here.
- Tradeoffs: A user correcting a typo'd weight or reps must wait for Slice 7; noted as a known limitation.

## ADR-016 — Atomic transaction helpers must explicitly abort on setup-work failure

- Date: 2026-07-23
- Status: Accepted
- Decision: `putThenDeleteAtomic` and `runAtomicTransaction` (`db.js`) now catch a synchronous throw from their own setup code and call `txn.abort()` before rejecting, instead of just rejecting the promise. Both `onerror` and `onabort` resolve through the same `setupError ?? txn.error ?? new Error(...)` fallback chain.
- Reason: If setup code queues some requests and then throws (e.g. three of five `put()` calls succeed, a fourth line has a bug), IndexedDB has no way to know the driving JS failed partway through unless told to abort — without an explicit `abort()`, the already-queued requests would still commit, silently breaking the "all or nothing" guarantee these helpers exist to provide. A second bug surfaced while fixing the first: a request queued before the abort can fire the transaction's `onerror` (with `txn.error === null`, since that's a caller-initiated abort per spec) *before* `onabort` fires, and a bare `reject(txn.error)` there would resolve the whole promise with `null`, discarding the real error. Both handlers must compute the same rejection value so whichever fires first is still correct.
- Alternatives considered: Only rejecting without aborting (the original implementation — the bug this ADR fixes); rejected because it doesn't actually stop a partial commit. Preventing the bubbling request-error event with `event.preventDefault()` to suppress the `onerror` race instead of unifying the two handlers; rejected as more fragile — it depends on attaching a per-request listener at every call site rather than making the two transaction-level handlers agree once.
- Tradeoffs: None significant; verified directly by forcing a throw after queuing a request in both helpers and confirming the queued write never persisted and the real error message (not `null`) propagated.

## ADR-017 — Completed-workout success-flip correction is offered per exercise, never automatic

- Date: 2026-07-23
- Status: Accepted
- Decision: Editing a completed workout's reps can change whether an exercise counts as successful. When it does, `js/history.js` shows one Skip/Adjust choice per affected exercise with the exact suggested `currentWeight` (± the exercise's own `increment`), applied to `exerciseConfigs` only if the user taps Adjust. Nothing is touched automatically, and only exercises whose success verdict actually changed are shown.
- Reason: Spec §10 is explicit: "offer an explicit, previewed correction... default is no downstream change." A per-exercise choice (rather than one blanket apply-all) keeps the user in control when only some exercises in a multi-exercise workout flip, and reusing the exercise's own stored `increment` for the suggested delta keeps the math consistent with how progression was computed the first time.
- Alternatives considered: Automatically applying the correction; rejected — directly contradicts the spec's explicit default. Recalculating every later workout's progression chain from this point forward; rejected as out of scope ("does not silently recalculate later workouts or current working weights") and because a real recalculation would need to walk forward through every subsequent workout for that exercise, which the spec doesn't ask for.
- Tradeoffs: If a workout several sessions back is edited, the offered correction only affects the *current* working weight, not weights implied by workouts in between — an intentional, spec-directed limitation, not an oversight.

## ADR-018 — Rest cards: weighted random selection over a fixed schedule

- Date: 2026-07-23
- Status: Accepted
- Decision: `js/restCards.js` builds a full candidate pool every time a card is needed (technique, general, personal motivation, humor, recovery, upcoming-exercise, personal progress), assigns each a weight boosted by context (technique early in an exercise, upcoming near an exercise's end, recovery near the workout's end), filters by category toggle and humor level, excludes already-shown keys for the session, then picks weighted-randomly. If every candidate has already been shown this workout, repeats are allowed rather than showing nothing.
- Reason: Spec §16 states *preferences* ("prefer relevant technique early... upcoming setup near an exercise end...") not a rigid schedule, and lists "do not repeat a card in the same workout" as a rule that has to coexist with a workout that might run out of fresh material (e.g. a very long session, or several categories toggled off). Weighting nudges the selection toward the spec's stated preferences without hard-coding "card N is always technique" — the exact set of exercises, toggles, and history data vary per user and per workout.
- Alternatives considered: A fixed per-rest-period schedule (e.g. "always technique on rest 1, always upcoming on the last rest"); rejected as more rigid than the spec asks for and harder to gracefully degrade when a category is toggled off or humor is off. Silently showing nothing once the pool is exhausted; rejected — spec's "do not repeat" reads as a preference to honor when possible, not a mandate to leave the rest screen without a card.
- Tradeoffs: Selection isn't deterministic (two runs with identical state can show cards in a different order) — acceptable for restrained personality content that's explicitly not meant to be data the user depends on.

## ADR-019 — Service worker: cache-first app shell, versioned by a hand-bumped string

- Date: 2026-07-23
- Status: Accepted
- Decision: `sw.js` precaches the full app shell (index.html, manifest.json, styles.css, every `js/*.js` module, and the four icon files) under a single cache keyed by a `CACHE_VERSION` string constant. The fetch handler serves cache-first for every GET request, falling back to network (and caching a successful network response for next time), and falls back to the cached `index.html` for a failed navigation request. There is no build step to hash filenames, so `CACHE_VERSION` must be bumped by hand whenever a precached file's contents change; `activate` deletes any cache whose key doesn't match the current version.
- Reason: Spec §19 requires the app to keep working fully offline after first load, on a personal single-user app with no server-rendered or frequently-changing content — cache-first is simpler and more reliably offline-correct than a network-first or stale-while-revalidate strategy here, since there's nothing external this app needs to stay fresh against. Precaching the exact static file list (rather than caching opportunistically on first visit) guarantees the whole shell is available offline immediately after install, not just whichever screens happened to be visited first.
- Alternatives considered: Network-first with cache fallback; rejected because it would make every normal (online) load wait on the network for no benefit, for an app with no dynamic server content to prefer. A build-time content-hash/versioning tool; rejected as a new dependency this project's minimal-dependency policy doesn't justify for a one-developer static file list of ~25 files.
- Tradeoffs: Forgetting to bump `CACHE_VERSION` after editing a precached file means the old cached copy keeps being served until the version string changes — an accepted manual step, not automated, consistent with the no-build-step constraint.

## ADR-020 — Settings Save is one atomic transaction across all three affected stores

- Date: 2026-07-25
- Status: Accepted
- Decision: `js/settings.js`'s Save handler now writes `appSettings`, every touched `exerciseConfigs` record, and both `workoutTemplates` records inside a single `runAtomicTransaction` call, replacing the previous sequence of independent `putRecord` calls (one transaction per record).
- Reason: A review finding correctly identified that a failure partway through the old sequential writes (e.g. the 4th of 5 exercise saves) would leave settings and the first few exercises already committed while the rest weren't — a genuinely inconsistent state, and a direct violation of "a failure must leave all prior settings unchanged." `runAtomicTransaction` already existed (ADR-013, hardened by ADR-016) for exactly this all-or-nothing guarantee; Settings Save simply hadn't been switched to use it when Slice 7 was built.
- Alternatives considered: Manual rollback logic that re-writes the pre-edit values for anything already committed if a later `putRecord` fails; rejected as strictly more code than reusing the existing atomic-transaction helper, and less reliable — a rollback write can itself fail.
- Tradeoffs: None. Verified directly: forcing a throw on the write for one exercise (with several earlier stores/records already queued in the same transaction) left every store — settings, all exercise configs, both templates — completely unchanged; a subsequent unpatched Save with the same edits committed all of them correctly.

## ADR-021 — History edit date/time fields read and write local time, not UTC

- Date: 2026-07-25
- Status: Accepted
- Decision: `dateInputValue`/`timeInputValue` in `js/history.js` now build the `<input type="date">`/`<input type="time">` values from the `Date` object's local getters (`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes`), not `toISOString()`. Saving also now shifts `endedAt` by the same delta `startedAt` moved, so duration stays internally consistent after a date/time edit.
- Reason: A review finding correctly identified that `toISOString()` renders in UTC, so anyone not at UTC+0 would see (and, if they saved without correcting it, silently re-save) the wrong wall-clock time — a real, silent data-corrupting bug on every edit that didn't deliberately re-enter the exact right local values. Separately, `endedAt` was never touched by the edit at all, so an edited `startedAt` would leave `durationSeconds`/`endedAt` describing a different, now-inconsistent span.
- Alternatives considered: Storing `startedAt`/`endedAt` already split into date/time strings to avoid a conversion at all; rejected as a larger data-model change for a bug that a display/parsing fix already fully resolves.
- Tradeoffs: None. Verified directly with a seeded workout at a known local time under a non-zero UTC offset: the edit fields showed the correct local values (not UTC-shifted), and editing the date shifted both `startedAt` and `endedAt` by the identical delta, leaving `durationSeconds` unchanged.

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

