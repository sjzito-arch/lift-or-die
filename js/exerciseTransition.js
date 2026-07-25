import {
  advanceToNextExercise,
  undoControlMarkup,
  attachUndoHandler,
  endWorkoutControlMarkup,
  attachEndWorkoutHandlers,
} from './session.js';
import { formatLoadBreakdownText, computeLoadDifferenceText } from './loadCalculations.js';
import { setChipsMarkup, formatResultText } from './statsCalculations.js';
import { acquireWakeLock } from './wakeLock.js';

// Exercise transition (spec §9): summary of the just-finished exercise, the
// next exercise's target/per-side load, and the per-side difference between
// them (add/remove/no change), with a large "Start [next exercise]" button.
// The dispatcher only calls this for a non-final exercise; the final one
// goes to the workout completion review instead (workoutCompletion.js).
export function renderExerciseCompleteScreen(root, session, settings, { onSessionEnded, rerender }) {
  acquireWakeLock();
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const nextExercise = session.exerciseResults[index + 1];

  const diffText = computeLoadDifferenceText(
    exercise.targetWeight,
    exercise.barWeight,
    nextExercise.targetWeight,
    nextExercise.barWeight,
    settings.units
  );

  root.innerHTML = `
    <main class="exercise-transition">
      <h1>Exercise Complete</h1>
      <p class="set-status">${exercise.name} — ${exercise.targetWeight} ${settings.units}</p>
      ${setChipsMarkup(exercise)}
      <p>${formatResultText(exercise, settings.units)}</p>

      <h2>Next: ${nextExercise.name}</h2>
      <p class="per-side-text">${diffText}</p>
      <p class="load-breakdown">${formatLoadBreakdownText(nextExercise.targetWeight, nextExercise.barWeight, settings.units)}</p>
      <p class="error" id="next-error" hidden></p>

      <div class="stacked-actions">
        <button id="next-exercise-btn" class="primary-action">Start ${nextExercise.name}</button>
      </div>

      <div class="stacked-actions">
        ${undoControlMarkup(exercise)}
        <button id="end-workout-btn" class="secondary-action">End Workout</button>
        <div id="end-workout-panel" hidden>
          ${endWorkoutControlMarkup(session)}
        </div>
      </div>
    </main>
  `;

  document.getElementById('next-exercise-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('next-error');
    errEl.hidden = true;
    try {
      const updated = await advanceToNextExercise(session);
      rerender(updated);
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not move to the next exercise. Check your storage and try again.';
      errEl.hidden = false;
    }
  });

  attachUndoHandler(session, index, rerender);

  document.getElementById('end-workout-btn').addEventListener('click', () => {
    document.getElementById('end-workout-panel').hidden = false;
  });
  attachEndWorkoutHandlers(session, onSessionEnded);
}
