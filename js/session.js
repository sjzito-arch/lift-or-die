import { getRecord, getAllRecords, putRecord, deleteRecord, putThenDeleteAtomic, runAtomicTransaction } from './db.js';
import { STORES } from './schema.js';

export async function getActiveSession() {
  const sessions = await getAllRecords(STORES.workoutSessions.name);
  return sessions.find((s) => s.status === 'active') ?? null;
}

function snapshotExercise(exercise, settings) {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    targetWeight: exercise.currentWeight,
    barWeight: exercise.barWeight ?? settings.globalDefaultBarWeight,
    restSeconds: exercise.restSecondsOverride ?? settings.globalDefaultRestSeconds,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
    increment: exercise.increment,
    setResults: [],
    success: null,
    justUndone: false,
    restEndsAt: null,
    easy: false,
  };
}

function isValidSnapshot(ex) {
  return (
    typeof ex.targetWeight === 'number' && !Number.isNaN(ex.targetWeight) &&
    typeof ex.barWeight === 'number' && !Number.isNaN(ex.barWeight) &&
    typeof ex.restSeconds === 'number' && !Number.isNaN(ex.restSeconds) &&
    typeof ex.increment === 'number' && !Number.isNaN(ex.increment) && ex.increment >= 0 &&
    Number.isInteger(ex.targetSets) && ex.targetSets > 0 &&
    Number.isInteger(ex.targetReps) && ex.targetReps > 0
  );
}

// Successful (every set met its rep target) suggests working weight +
// increment; unsuccessful suggests the same weight (spec §10). `success` is
// `null` only while sets remain unrecorded, which can't happen once a
// workout reaches completion review. Marking an exercise Easy doubles the
// increment rather than using a separate hard-coded jump — a 5 lb increment
// becomes +10 lb, not some other fixed amount.
export function computeSuggestedWeight(exercise) {
  if (!exercise.success) return exercise.targetWeight;
  const multiplier = exercise.easy ? 2 : 1;
  return exercise.targetWeight + exercise.increment * multiplier;
}

// Snapshots the chosen template's exercises at their current settings into a
// new active session so later settings edits can't retroactively change an
// in-progress workout (spec §10).
export async function createWorkoutSession(workoutType, settings) {
  const existing = await getActiveSession();
  if (existing) return { session: existing, error: null };

  const template = await getRecord(STORES.workoutTemplates.name, workoutType);
  if (!template) {
    return { session: null, error: `Workout ${workoutType} isn't configured yet.` };
  }

  const exercises = await Promise.all(
    template.exerciseIds.map((id) => getRecord(STORES.exerciseConfigs.name, id))
  );

  if (exercises.some((ex) => !ex)) {
    return { session: null, error: 'An exercise in this workout is missing. Check Settings.' };
  }

  const exerciseResults = exercises.map((ex) => snapshotExercise(ex, settings));

  if (!exerciseResults.every(isValidSnapshot)) {
    return {
      session: null,
      error: 'Some exercises are missing weight, bar, or rest values. Finish Settings before starting.',
    };
  }

  const now = new Date().toISOString();
  const session = {
    id: crypto.randomUUID(),
    type: workoutType,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    activeExerciseIndex: 0,
    uiState: 'active-exercise',
    exerciseResults,
    completionTransactionId: null,
    // Rest-card history for this workout (spec §12/§16): keys of cards
    // already shown, so the rest screen can avoid repeating one.
    shownCardKeys: [],
  };

  await putRecord(STORES.workoutSessions.name, session);
  return { session, error: null };
}

export async function discardSession(sessionId) {
  await deleteRecord(STORES.workoutSessions.name, sessionId);
}

export function hasAnyRecordedSet(session) {
  return session.exerciseResults.some((ex) => ex.setResults.length > 0);
}

// Every mutation re-reads the session from IndexedDB first rather than
// trusting the caller's in-memory copy. The rest screen in particular keeps
// one render alive across a "+30 sec" tap without a full rerender, so an
// in-memory `session` object can go stale; re-fetching removes that whole
// class of bug instead of threading updated copies through every call site.
async function getFreshSession(sessionId) {
  const fresh = await getRecord(STORES.workoutSessions.name, sessionId);
  if (!fresh) {
    throw new Error('This workout session no longer exists.');
  }
  return fresh;
}

// Success is only ever true/false once every prescribed set for the exercise
// has been recorded; otherwise it's null. Undo relies on this recomputation
// to fall back to null the moment a set is removed (spec: an exercise can't
// carry a stale success verdict once it's no longer fully recorded).
export function computeSuccess(exercise) {
  if (exercise.setResults.length < exercise.targetSets) return null;
  return exercise.setResults.every((s) => s.reps >= exercise.targetReps);
}

async function persistExerciseChange(session, exerciseIndex, updatedExercise) {
  const updatedExerciseResults = session.exerciseResults.map((ex, i) =>
    i === exerciseIndex ? updatedExercise : ex
  );
  const updatedSession = {
    ...session,
    exerciseResults: updatedExerciseResults,
    updatedAt: new Date().toISOString(),
  };
  await putRecord(STORES.workoutSessions.name, updatedSession);
  return updatedSession;
}

// Starts an absolute-timestamp rest countdown after any non-final set, and
// never starts one after an exercise's final set (spec §8). Undo always
// cancels whatever rest the removed set caused.
export async function recordSet(session, exerciseIndex, reps) {
  const fresh = await getFreshSession(session.id);
  const exercise = fresh.exerciseResults[exerciseIndex];
  if (exercise.setResults.length >= exercise.targetSets) {
    throw new Error('This exercise already has all its sets recorded.');
  }
  const setNumber = exercise.setResults.length + 1;
  const updatedExercise = {
    ...exercise,
    setResults: [...exercise.setResults, { setNumber, reps, completedAt: new Date().toISOString() }],
    justUndone: false,
  };
  updatedExercise.success = computeSuccess(updatedExercise);
  const isNowComplete = updatedExercise.setResults.length >= updatedExercise.targetSets;
  updatedExercise.restEndsAt = isNowComplete
    ? null
    : new Date(Date.now() + updatedExercise.restSeconds * 1000).toISOString();
  return persistExerciseChange(fresh, exerciseIndex, updatedExercise);
}

// justUndone is persisted on the exercise (not just held in memory) so the
// single-level undo guard survives a reload: after an undo, another undo
// stays unavailable until a new set is recorded, even across app reopen.
export async function undoLastSet(session, exerciseIndex) {
  const fresh = await getFreshSession(session.id);
  const exercise = fresh.exerciseResults[exerciseIndex];
  if (exercise.setResults.length === 0) return fresh;
  const updatedExercise = {
    ...exercise,
    setResults: exercise.setResults.slice(0, -1),
    justUndone: true,
    restEndsAt: null,
  };
  updatedExercise.success = computeSuccess(updatedExercise);
  // Easy is only ever valid on a fully successful exercise — losing that
  // eligibility (the exercise is no longer complete, or no longer every set
  // hit target) must clear it rather than leave a stale Easy mark the user
  // never re-confirmed against the new, incomplete state.
  if (updatedExercise.success !== true) {
    updatedExercise.easy = false;
  }
  return persistExerciseChange(fresh, exerciseIndex, updatedExercise);
}

// Easy (spec addendum): marks a fully-successful exercise as easy, doubling
// the suggested next-weight increment. Enforced here too, not just hidden in
// the UI, so a stale/racing request can't mark an ineligible exercise.
export async function setExerciseEasy(session, exerciseIndex, easy) {
  const fresh = await getFreshSession(session.id);
  const exercise = fresh.exerciseResults[exerciseIndex];
  if (exercise.success !== true) {
    throw new Error('This exercise is not eligible for Easy.');
  }
  const updatedExercise = { ...exercise, easy: !!easy };
  return persistExerciseChange(fresh, exerciseIndex, updatedExercise);
}

export async function addRestTime(session, exerciseIndex, extraSeconds) {
  const fresh = await getFreshSession(session.id);
  const exercise = fresh.exerciseResults[exerciseIndex];
  const baseMs = exercise.restEndsAt ? new Date(exercise.restEndsAt).getTime() : Date.now();
  const updatedExercise = { ...exercise, restEndsAt: new Date(baseMs + extraSeconds * 1000).toISOString() };
  return persistExerciseChange(fresh, exerciseIndex, updatedExercise);
}

export async function skipRest(session, exerciseIndex) {
  const fresh = await getFreshSession(session.id);
  const exercise = fresh.exerciseResults[exerciseIndex];
  const updatedExercise = { ...exercise, restEndsAt: null };
  return persistExerciseChange(fresh, exerciseIndex, updatedExercise);
}

// Records that a piece of content (a rest card, or the eventual completion
// headline) was shown, so neither it nor anything sharing its "family" (a
// variation of the same joke/idea) repeats later in the same workout (spec
// §12/§16). `entry` is `{ key, family }` — both persisted, not just the key,
// so family-based exclusion can be enforced later (within this workout, and
// via `contentHistory` across the next 3 completed workouts) without having
// to re-derive a family from a bare key against a content library that may
// have changed since. `shownCardKeys` lives on the session, not a single
// exercise, since content shouldn't repeat across the whole workout —
// rest cards and the completion headline share this exact same list.
export async function markCardShown(session, entry) {
  const fresh = await getFreshSession(session.id);
  const updatedSession = {
    ...fresh,
    shownCardKeys: [...(fresh.shownCardKeys ?? []), entry],
    updatedAt: new Date().toISOString(),
  };
  await putRecord(STORES.workoutSessions.name, updatedSession);
  return updatedSession;
}

// A session created before this content-history rework may still have a
// handful of legacy bare-string entries in `shownCardKeys` if it was already
// in progress across the update — normalize those to their own family so
// exclusion logic never has to special-case the shape.
function normalizeContentEntry(entry) {
  return typeof entry === 'string' ? { key: entry, family: entry } : entry;
}

export async function advanceToNextExercise(session) {
  const fresh = await getFreshSession(session.id);
  const updatedSession = {
    ...fresh,
    activeExerciseIndex: fresh.activeExerciseIndex + 1,
    updatedAt: new Date().toISOString(),
  };
  await putRecord(STORES.workoutSessions.name, updatedSession);
  return updatedSession;
}

// Writes the session's real set data to history and removes the active
// session in one atomic transaction (spec §11: preserve recorded sets,
// apply no progression, count no Lift vote). Reuses the session's own id as
// the stored workout's id so a retry after a partial failure just re-puts
// the same record and re-deletes an already-gone session — both idempotent.
export async function saveIncompleteSession(session) {
  const fresh = await getFreshSession(session.id);
  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt) - new Date(fresh.createdAt)) / 1000));
  const storedWorkout = {
    id: fresh.id,
    type: fresh.type,
    status: 'incomplete',
    startedAt: fresh.createdAt,
    endedAt,
    durationSeconds,
    exerciseResults: fresh.exerciseResults,
    contentHistory: (fresh.shownCardKeys ?? []).map(normalizeContentEntry),
    updatedAt: null,
  };
  await putThenDeleteAtomic(
    STORES.storedWorkouts.name,
    storedWorkout,
    STORES.workoutSessions.name,
    fresh.id
  );
  return storedWorkout;
}

// Commits progression, the completed-workout record, the lifetime-vote
// increment, and the session's removal in one atomic transaction (spec
// §11: "Progression is committed atomically with workout completion").
// `overridesByExerciseId` holds the (possibly user-edited) next-weight
// value per exercise from the review screen; falls back to the computed
// suggestion for any exercise without an override.
//
// Idempotent without a separate transaction-id: if the transaction below
// already committed once, the session is gone, so a retry's
// `getFreshSession` throws immediately, before anything else runs — no
// double progression, no double vote. If it never committed (a genuine
// failure), the session is untouched and a retry is safe from scratch.
export async function completeWorkout(session, overridesByExerciseId) {
  const fresh = await getFreshSession(session.id);

  const updatedConfigs = await Promise.all(
    fresh.exerciseResults.map(async (ex) => {
      const override = overridesByExerciseId[ex.exerciseId];
      const nextWeight = typeof override === 'number' && !Number.isNaN(override)
        ? override
        : computeSuggestedWeight(ex);
      const config = await getRecord(STORES.exerciseConfigs.name, ex.exerciseId);
      return { ...config, currentWeight: nextWeight };
    })
  );

  const settings = await getRecord(STORES.appSettings.name, 'settings');
  const updatedSettings = { ...settings, lifetimeVotes: (settings.lifetimeVotes ?? 0) + 1 };

  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt) - new Date(fresh.createdAt)) / 1000));
  const storedWorkout = {
    id: fresh.id,
    type: fresh.type,
    status: 'completed',
    startedAt: fresh.createdAt,
    endedAt,
    durationSeconds,
    exerciseResults: fresh.exerciseResults,
    // Which rest cards / the completion headline were shown this workout —
    // feeds the "don't repeat within the next 3 completed workouts" rule
    // (spec addendum). Absent entirely on records saved before this field
    // existed; readers treat that as an empty history, excluding nothing.
    contentHistory: (fresh.shownCardKeys ?? []).map(normalizeContentEntry),
    updatedAt: null,
  };

  await runAtomicTransaction(
    [STORES.exerciseConfigs.name, STORES.storedWorkouts.name, STORES.workoutSessions.name, STORES.appSettings.name],
    (stores) => {
      for (const config of updatedConfigs) {
        stores[STORES.exerciseConfigs.name].put(config);
      }
      stores[STORES.storedWorkouts.name].put(storedWorkout);
      stores[STORES.workoutSessions.name].delete(fresh.id);
      stores[STORES.appSettings.name].put(updatedSettings);
    }
  );

  return storedWorkout;
}

// Shared Undo control used on any screen showing a completed exercise where
// its last set might still need correcting (exercise transition, the
// last-exercise view, and the workout completion review) — same handler,
// same single-level guard (`justUndone`), everywhere it appears.
export function undoControlMarkup(exercise) {
  if (exercise.justUndone) return '';
  return `
    <button id="undo-btn" class="tertiary-action">Undo Last Set</button>
    <p class="error" id="undo-error" hidden></p>
  `;
}

export function attachUndoHandler(session, index, rerender) {
  const undoBtn = document.getElementById('undo-btn');
  if (!undoBtn) return;
  undoBtn.addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('undo-error');
    errEl.hidden = true;
    try {
      const updated = await undoLastSet(session, index);
      rerender(updated);
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not undo that set. Check your storage and try again.';
      errEl.hidden = false;
    }
  });
}

function discardOnlyMarkup() {
  return `
    <button id="discard-btn" class="secondary-action">Discard Workout</button>
    <div id="discard-confirm" class="discard-panel" hidden>
      <p>Discard this workout? This removes the unsaved session only. History and settings are unaffected.</p>
      <p class="error" id="discard-error" hidden></p>
      <div class="step-actions">
        <button id="discard-cancel" class="secondary-action">Cancel</button>
        <button id="discard-confirm-btn" class="primary-action">Confirm Discard</button>
      </div>
    </div>
  `;
}

function attachDiscardOnlyHandlers(sessionId, onDiscarded) {
  document.getElementById('discard-btn').addEventListener('click', () => {
    document.getElementById('discard-confirm').hidden = false;
  });
  document.getElementById('discard-cancel').addEventListener('click', () => {
    document.getElementById('discard-confirm').hidden = true;
  });
  document.getElementById('discard-confirm-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('discard-error');
    errEl.hidden = true;
    try {
      await discardSession(sessionId);
      onDiscarded();
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not discard this workout. Check your storage and try again.';
      errEl.hidden = false;
    }
  });
}

// The End Workout / launch-recovery choices: Save as Incomplete only appears
// once a set exists anywhere in the session (spec §12); Discard is always
// available and stays behind its own confirm since it's destructive.
export function endWorkoutControlMarkup(session) {
  const showSaveIncomplete = hasAnyRecordedSet(session);
  return `
    <div class="end-workout-choices">
      ${showSaveIncomplete ? `<button id="save-incomplete-btn" class="secondary-action">Save as Incomplete</button>` : ''}
      <p class="error" id="end-workout-error" hidden></p>
      ${discardOnlyMarkup()}
    </div>
  `;
}

export function attachEndWorkoutHandlers(session, onEnded) {
  const saveBtn = document.getElementById('save-incomplete-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      const errEl = document.getElementById('end-workout-error');
      errEl.hidden = true;
      try {
        await saveIncompleteSession(session);
        onEnded();
      } catch (err) {
        saveBtn.disabled = false;
        errEl.textContent = 'Could not save this workout. Check your storage and try again.';
        errEl.hidden = false;
      }
    });
  }
  attachDiscardOnlyHandlers(session.id, onEnded);
}
