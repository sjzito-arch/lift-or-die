import { undoLastSet, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { weightDisplayMarkup } from './loadCalculations.js';
import { setRecordingMarkup, attachSetRecordingHandlers } from './setRecording.js';
import { acquireWakeLock } from './wakeLock.js';
import { setProgressionMarkup } from './setProgression.js';

// The "ready for a set" screen (spec §7), scoped to Set Done, partial-set
// entry, and undo. The dispatcher in workoutScreen.js only calls this when
// the current exercise isn't yet fully recorded and isn't resting — rest
// (including the post-expiry overtime state), exercise-complete, and
// all-done are separate screens.
export function renderActiveExercise(root, session, settings, { onSessionEnded, rerender }) {
  acquireWakeLock();
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const setsRecorded = exercise.setResults.length;
  const nextSetNumber = setsRecorded + 1;
  const canUndo = setsRecorded > 0 && !exercise.justUndone;

  root.innerHTML = `
    <main class="active-exercise">
      <p class="muted">Exercise ${index + 1} of ${session.exerciseResults.length}</p>
      <h1>${exercise.name}</h1>
      ${weightDisplayMarkup(exercise.targetWeight, exercise.barWeight, settings.units)}
      ${setProgressionMarkup(exercise)}
      <p class="set-status">Begin set ${nextSetNumber} of ${exercise.targetSets} now</p>
      <p class="muted">Target: ${exercise.targetReps} reps</p>

      ${setRecordingMarkup(exercise)}

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

  attachSetRecordingHandlers(session, index, exercise, rerender);

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
