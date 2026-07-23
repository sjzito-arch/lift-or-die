import { recordSet, undoLastSet, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';

// Guards Set Done and Partial confirm against a rapid double-tap landing on
// two different button elements: disabling the tapped button isn't enough,
// because a fast save+rerender can present a brand-new enabled button before
// the second physical tap arrives. This timestamp lives at module scope (not
// inside renderActiveExercise) so it survives that rerender. 500ms is well
// above a real accidental double-tap gap and far below any real gap between
// deliberate sets, so normal use never perceives a delay.
const RAPID_TAP_WINDOW_MS = 500;
let lastRecordAttemptAt = 0;

function isRapidRepeatTap() {
  return Date.now() - lastRecordAttemptAt < RAPID_TAP_WINDOW_MS;
}

// One-exercise-at-a-time active workout screen (spec §7), scoped to Set Done,
// partial-set entry, and undo. Rest timing, exercise transitions, and
// per-side weight are out of scope until Slices 4 and 5.
export function renderActiveExercise(root, session, settings, { onSessionEnded }) {
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const setsRecorded = exercise.setResults.length;
  const isExerciseComplete = setsRecorded >= exercise.targetSets;
  const nextSetNumber = setsRecorded + 1;
  // exercise.justUndone is persisted (session.js), so the single-level undo
  // guard survives a reload rather than resetting on every fresh render.
  const canUndo = setsRecorded > 0 && !exercise.justUndone;

  const rerender = (updatedSession) => renderActiveExercise(root, updatedSession, settings, { onSessionEnded });

  root.innerHTML = `
    <main class="active-exercise">
      <p class="muted">Exercise ${index + 1} of ${session.exerciseResults.length}</p>
      <h1>${exercise.name}</h1>
      <p class="target-weight">${exercise.targetWeight} ${settings.units}</p>
      ${
        isExerciseComplete
          ? `<p class="set-status">Exercise complete. ${setsRecorded} of ${exercise.targetSets} sets recorded.</p>`
          : `<p class="set-status">Ready for Set ${nextSetNumber} of ${exercise.targetSets}</p>
             <p class="muted">Target: ${exercise.targetReps} reps</p>`
      }

      ${
        !isExerciseComplete
          ? `
        <div class="stacked-actions">
          <button id="set-done-btn" class="set-done-action">Set Done</button>
          <button id="partial-btn" class="secondary-action">Partial / Failed Set</button>
        </div>
        <p class="error" id="set-done-error" hidden></p>
        <div id="partial-panel" class="discard-panel" hidden>
          <label>Reps completed (0–${exercise.targetReps})
            <input type="number" id="partial-reps" min="0" max="${exercise.targetReps}" step="1" value="${exercise.targetReps}">
          </label>
          <p class="error" id="partial-error" hidden></p>
          <div class="step-actions">
            <button id="partial-cancel" class="secondary-action">Cancel</button>
            <button id="partial-confirm" class="primary-action">Record Set</button>
          </div>
        </div>`
          : ''
      }

      <div class="stacked-actions">
        ${canUndo ? `<button id="undo-btn" class="tertiary-action">Undo Last Set</button>` : ''}
        <p class="error" id="undo-error" hidden></p>
        <button id="end-workout-btn" class="secondary-action">End Workout</button>
        <div id="end-workout-panel" hidden>
          ${endWorkoutControlMarkup(session)}
        </div>
      </div>
    </main>
  `;

  if (!isExerciseComplete) {
    const setDoneBtn = document.getElementById('set-done-btn');
    const partialBtn = document.getElementById('partial-btn');
    setDoneBtn.addEventListener('click', async () => {
      if (isRapidRepeatTap()) return;
      lastRecordAttemptAt = Date.now();
      setDoneBtn.disabled = true;
      partialBtn.disabled = true;
      const errEl = document.getElementById('set-done-error');
      errEl.hidden = true;
      try {
        const updated = await recordSet(session, index, exercise.targetReps);
        rerender(updated);
      } catch (err) {
        lastRecordAttemptAt = 0;
        setDoneBtn.disabled = false;
        partialBtn.disabled = false;
        errEl.textContent = 'Could not save that set. Check your storage and try again.';
        errEl.hidden = false;
      }
    });

    partialBtn.addEventListener('click', () => {
      document.getElementById('partial-panel').hidden = false;
    });
    document.getElementById('partial-cancel').addEventListener('click', () => {
      document.getElementById('partial-panel').hidden = true;
    });
    document.getElementById('partial-confirm').addEventListener('click', async (e) => {
      const input = document.getElementById('partial-reps');
      const reps = parseInt(input.value, 10);
      const errEl = document.getElementById('partial-error');
      if (!Number.isInteger(reps) || reps < 0 || reps > exercise.targetReps) {
        errEl.textContent = `Enter a whole number from 0 to ${exercise.targetReps}.`;
        errEl.hidden = false;
        return;
      }
      if (isRapidRepeatTap()) return;
      lastRecordAttemptAt = Date.now();
      errEl.hidden = true;
      e.target.disabled = true;
      try {
        const updated = await recordSet(session, index, reps);
        rerender(updated);
      } catch (err) {
        lastRecordAttemptAt = 0;
        e.target.disabled = false;
        errEl.textContent = 'Could not save that set. Check your storage and try again.';
        errEl.hidden = false;
      }
    });
  }

  if (canUndo) {
    document.getElementById('undo-btn').addEventListener('click', async (e) => {
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

  document.getElementById('end-workout-btn').addEventListener('click', () => {
    document.getElementById('end-workout-panel').hidden = false;
  });
  attachEndWorkoutHandlers(session, onSessionEnded);
}
