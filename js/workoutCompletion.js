import {
  completeWorkout,
  computeSuggestedWeight,
  undoControlMarkup,
  attachUndoHandler,
  endWorkoutControlMarkup,
  attachEndWorkoutHandlers,
} from './session.js';
import { computeWorkoutVolume, pickHumorousHeadline, setChipsMarkup, formatResultText } from './statsCalculations.js';

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

// Workout completion (spec §11): review every exercise's result and
// suggested next weight (editable) before committing progression. The
// dispatcher only reaches this screen once the last exercise is complete.
export function renderWorkoutCompletionScreen(root, session, settings, { onSessionEnded, rerender }) {
  const index = session.activeExerciseIndex ?? 0;
  const lastExercise = session.exerciseResults[index];
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(session.createdAt).getTime()) / 1000));
  const volume = computeWorkoutVolume(session.exerciseResults);

  root.innerHTML = `
    <main class="workout-completion">
      <h1>Workout Complete</h1>
      <p class="muted">Duration: ${formatDuration(elapsedSeconds)} · Volume: ${volume} ${settings.units}</p>

      ${session.exerciseResults
        .map(
          (ex) => `
        <div class="completion-exercise">
          <div class="review-name">
            <span>${ex.name}</span>
            <span class="review-sets">${ex.targetSets}×${ex.targetReps}</span>
          </div>
          <div class="review-stats">${ex.targetWeight} ${settings.units}</div>
          ${setChipsMarkup(ex)}
          <p class="muted">${formatResultText(ex, settings.units)}</p>
          <label>Next working weight
            <input type="number" class="next-weight-input" data-exercise-id="${ex.exerciseId}" value="${computeSuggestedWeight(ex)}" min="0" step="0.5">
          </label>
        </div>`
        )
        .join('')}

      <p class="error" id="completion-error" hidden></p>

      <div class="stacked-actions">
        <button id="complete-workout-btn" class="primary-action">Complete Workout</button>
      </div>

      <div class="stacked-actions">
        ${undoControlMarkup(lastExercise)}
        <button id="end-workout-btn" class="secondary-action">End Workout</button>
        <div id="end-workout-panel" hidden>
          ${endWorkoutControlMarkup(session)}
        </div>
      </div>
    </main>
  `;

  document.getElementById('complete-workout-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('completion-error');
    errEl.hidden = true;

    const overrides = {};
    let invalid = false;
    document.querySelectorAll('.next-weight-input').forEach((input) => {
      const value = Number(input.value);
      if (input.value.trim() === '' || Number.isNaN(value) || value < 0) {
        invalid = true;
      }
      overrides[input.dataset.exerciseId] = value;
    });

    if (invalid) {
      e.target.disabled = false;
      errEl.textContent = 'Enter a valid, non-negative weight for every exercise.';
      errEl.hidden = false;
      return;
    }

    try {
      const storedWorkout = await completeWorkout(session, overrides);
      renderWorkoutSummaryScreen(root, storedWorkout, settings, { onDone: onSessionEnded });
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not save this workout. Check your storage and try again.';
      errEl.hidden = false;
    }
  });

  attachUndoHandler(session, index, rerender);

  document.getElementById('end-workout-btn').addEventListener('click', () => {
    document.getElementById('end-workout-panel').hidden = false;
  });
  attachEndWorkoutHandlers(session, onSessionEnded);
}

// One-time restrained summary shown right after a workout is completed
// (spec §11: "restrained summary, meaningful progress, and at most one
// humorous headline"). Purely a dismissible closing screen — the session is
// already gone by the time this renders, so there's nothing left to mutate.
function renderWorkoutSummaryScreen(root, storedWorkout, settings, { onDone }) {
  const volume = computeWorkoutVolume(storedWorkout.exerciseResults);
  const durationText = formatDuration(storedWorkout.durationSeconds);
  const allSuccess = storedWorkout.exerciseResults.every((ex) => ex.success);
  const headline = pickHumorousHeadline(settings.humorLevel);

  root.innerHTML = `
    <main class="workout-summary">
      <h1>Nice work.</h1>
      <p class="set-status">Workout ${storedWorkout.type} complete — ${durationText}, ${volume} ${settings.units} total volume.</p>
      <p class="muted">${allSuccess ? 'Every exercise hit its target today.' : 'A good session — not every set hit target, and that still counts.'}</p>
      ${headline ? `<p class="workout-summary-headline">${headline}</p>` : ''}
      <div class="stacked-actions">
        <button id="summary-done-btn" class="primary-action">Done</button>
      </div>
    </main>
  `;

  document.getElementById('summary-done-btn').addEventListener('click', onDone);
}
