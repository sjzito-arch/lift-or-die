import { getRecord, getAllRecords, putRecord, deleteRecord } from './db.js';
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
    uiState: 'active-placeholder',
    exerciseResults,
    completionTransactionId: null,
  };

  await putRecord(STORES.workoutSessions.name, session);
  return { session, error: null };
}

export async function discardSession(sessionId) {
  await deleteRecord(STORES.workoutSessions.name, sessionId);
}

export function discardControlMarkup() {
  return `
    <button id="discard-btn" class="secondary-action">Discard Workout</button>
    <div id="discard-confirm" class="discard-panel" hidden>
      <p>Discard this workout? This removes the unsaved session only. History and settings are unaffected.</p>
      <div class="step-actions">
        <button id="discard-cancel" class="secondary-action">Cancel</button>
        <button id="discard-confirm-btn" class="primary-action">Confirm Discard</button>
      </div>
    </div>
  `;
}

export function attachDiscardHandlers(sessionId, onDiscarded) {
  document.getElementById('discard-btn').addEventListener('click', () => {
    document.getElementById('discard-confirm').hidden = false;
  });
  document.getElementById('discard-cancel').addEventListener('click', () => {
    document.getElementById('discard-confirm').hidden = true;
  });
  document.getElementById('discard-confirm-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    await discardSession(sessionId);
    onDiscarded();
  });
}

// Placeholder active-workout screen. Slice 3 replaces the body with the real
// one-exercise-at-a-time flow; the session shape created here is what it will read.
export function renderActiveSession(root, session, settings, { onDiscarded }) {
  root.innerHTML = `
    <main class="active-session">
      <h1>Workout ${session.type}</h1>
      <p class="muted">Warming up. Set tracking starts soon.</p>
      <ul class="exercise-list">
        ${session.exerciseResults
          .map(
            (ex) => `
          <li>
            <span class="exercise-name">${ex.name}</span>
            <span class="exercise-weight">${ex.targetWeight} ${settings.units} · ${ex.targetSets}×${ex.targetReps}</span>
          </li>`
          )
          .join('')}
      </ul>
      <div class="stacked-actions">
        ${discardControlMarkup()}
      </div>
    </main>
  `;

  attachDiscardHandlers(session.id, onDiscarded);
}
