import { advanceToNextExercise, undoLastSet, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { formatPerSideText, computeLoadDifferenceText } from './loadCalculations.js';

function formatSetSummary(exercise) {
  return exercise.setResults
    .map((s) => `Set ${s.setNumber}: ${s.reps}${s.reps < exercise.targetReps ? ' (short)' : ''}`)
    .join(' · ');
}

function formatResultText(exercise) {
  return exercise.success ? 'All sets hit target.' : 'Not every set hit target — still counted.';
}

function undoControlMarkup(exercise) {
  if (exercise.justUndone) return '';
  return `
    <button id="undo-btn" class="tertiary-action">Undo Last Set</button>
    <p class="error" id="undo-error" hidden></p>
  `;
}

function attachUndoHandler(session, index, rerender) {
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

// Exercise transition (spec §9): summary of the just-finished exercise, the
// next exercise's target/per-side load, and the per-side difference between
// them (add/remove/no change), with a large "Start [next exercise]" button.
export function renderExerciseCompleteScreen(root, session, settings, { onSessionEnded, rerender }) {
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
      <p class="muted">${formatSetSummary(exercise)}</p>
      <p>${formatResultText(exercise)}</p>

      <h2>Next: ${nextExercise.name}</h2>
      <p class="target-weight">${nextExercise.targetWeight} ${settings.units}</p>
      <p class="muted">${formatPerSideText(nextExercise.targetWeight, nextExercise.barWeight, settings.units)}</p>
      <p class="muted">${diffText}</p>
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

// After the last exercise's final set, real completion/progression is Slice
// 6 — not started yet. This screen gives the same summary treatment as any
// other exercise completion, then offers the End Workout choices already
// built in Slice 2/3 instead of inventing completion mechanics early.
export function renderAllExercisesDoneScreen(root, session, settings, { onSessionEnded, rerender }) {
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];

  root.innerHTML = `
    <main class="exercise-transition">
      <h1>Exercise Complete</h1>
      <p class="set-status">${exercise.name} — ${exercise.targetWeight} ${settings.units}</p>
      <p class="muted">${formatSetSummary(exercise)}</p>
      <p>${formatResultText(exercise)}</p>
      <p class="muted">That was the last exercise today. Workout completion and progression arrive in a later slice — for now, save what you did or discard.</p>

      <div class="stacked-actions">
        ${undoControlMarkup(exercise)}
        ${endWorkoutControlMarkup(session)}
      </div>
    </main>
  `;

  attachUndoHandler(session, index, rerender);
  attachEndWorkoutHandlers(session, onSessionEnded);
}
