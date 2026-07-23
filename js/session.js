import { getRecord, getAllRecords, putRecord, deleteRecord, putThenDeleteAtomic } from './db.js';
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
    setResults: [],
    success: null,
    justUndone: false,
  };
}

function isValidSnapshot(ex) {
  return (
    typeof ex.targetWeight === 'number' && !Number.isNaN(ex.targetWeight) &&
    typeof ex.barWeight === 'number' && !Number.isNaN(ex.barWeight) &&
    typeof ex.restSeconds === 'number' && !Number.isNaN(ex.restSeconds) &&
    Number.isInteger(ex.targetSets) && ex.targetSets > 0 &&
    Number.isInteger(ex.targetReps) && ex.targetReps > 0
  );
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

// Success is only ever true/false once every prescribed set for the exercise
// has been recorded; otherwise it's null. Undo relies on this recomputation
// to fall back to null the moment a set is removed (spec: an exercise can't
// carry a stale success verdict once it's no longer fully recorded).
function computeSuccess(exercise) {
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

export async function recordSet(session, exerciseIndex, reps) {
  const exercise = session.exerciseResults[exerciseIndex];
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
  return persistExerciseChange(session, exerciseIndex, updatedExercise);
}

// justUndone is persisted on the exercise (not just held in memory) so the
// single-level undo guard survives a reload: after an undo, another undo
// stays unavailable until a new set is recorded, even across app reopen.
export async function undoLastSet(session, exerciseIndex) {
  const exercise = session.exerciseResults[exerciseIndex];
  if (exercise.setResults.length === 0) return session;
  const updatedExercise = {
    ...exercise,
    setResults: exercise.setResults.slice(0, -1),
    justUndone: true,
  };
  updatedExercise.success = computeSuccess(updatedExercise);
  return persistExerciseChange(session, exerciseIndex, updatedExercise);
}

// Writes the session's real set data to history and removes the active
// session in one atomic transaction (spec §11: preserve recorded sets,
// apply no progression, count no Lift vote). Reuses the session's own id as
// the stored workout's id so a retry after a partial failure just re-puts
// the same record and re-deletes an already-gone session — both idempotent.
export async function saveIncompleteSession(session) {
  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt) - new Date(session.createdAt)) / 1000));
  const storedWorkout = {
    id: session.id,
    type: session.type,
    status: 'incomplete',
    startedAt: session.createdAt,
    endedAt,
    durationSeconds,
    exerciseResults: session.exerciseResults,
    updatedAt: null,
  };
  await putThenDeleteAtomic(
    STORES.storedWorkouts.name,
    storedWorkout,
    STORES.workoutSessions.name,
    session.id
  );
  return storedWorkout;
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
