import {
  completeWorkout,
  computeSuggestedWeight,
  setExerciseEasy,
  markCardShown,
  undoControlMarkup,
  attachUndoHandler,
  endWorkoutControlMarkup,
  attachEndWorkoutHandlers,
} from './session.js';
import { computeWorkoutVolume, formatResultText } from './statsCalculations.js';
import { setProgressionMarkup } from './setProgression.js';
import { pickCompletionHeadline } from './restCards.js';

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

// Manual next-weight overrides, keyed by session id then exercise id — kept
// outside the render function so a full re-render (triggered by toggling
// Easy or Undo) doesn't wipe out something the user already typed. Marking
// or unmarking Easy only updates a weight field that hasn't been manually
// touched; an existing override always wins (spec: "predictable" behavior).
const manualOverridesBySession = new Map();

// Workout completion (spec §11): review every exercise's result and
// suggested next weight (editable) before committing progression. The
// dispatcher only reaches this screen once the last exercise is complete.
export function renderWorkoutCompletionScreen(root, session, settings, { onSessionEnded, rerender }) {
  const index = session.activeExerciseIndex ?? 0;
  const lastExercise = session.exerciseResults[index];
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(session.createdAt).getTime()) / 1000));
  const volume = computeWorkoutVolume(session.exerciseResults);

  if (!manualOverridesBySession.has(session.id)) {
    manualOverridesBySession.set(session.id, {});
  }
  const overrides = manualOverridesBySession.get(session.id);

  root.innerHTML = `
    <main class="workout-completion">
      <h1>Workout Complete</h1>
      <p class="muted">Duration: ${formatDuration(elapsedSeconds)} · Volume: ${volume} ${settings.units}</p>

      ${session.exerciseResults
        .map(
          (ex, exIndex) => `
        <div class="completion-exercise">
          <div class="review-name">
            <span>${ex.name}</span>
            <span class="review-sets">${ex.targetSets}×${ex.targetReps}</span>
          </div>
          <div class="review-stats">${ex.targetWeight} ${settings.units}</div>
          ${setProgressionMarkup(ex)}
          <p class="muted">${formatResultText(ex, settings.units)}</p>
          ${ex.success ? `
          <label class="checkbox-label easy-toggle">
            <input type="checkbox" class="easy-checkbox" data-exercise-index="${exIndex}" ${ex.easy ? 'checked' : ''}>
            Felt Easy
          </label>` : ''}
          <label>Next working weight
            <input type="number" class="next-weight-input" data-exercise-id="${ex.exerciseId}" value="${overrides[ex.exerciseId] ?? computeSuggestedWeight(ex)}" min="0" step="0.5">
          </label>
        </div>`
        )
        .join('')}
      <p class="error" id="easy-error" hidden></p>

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

  // Track manual edits into the session-scoped overrides map so a later
  // Easy toggle (which re-renders this whole screen) knows not to clobber a
  // value the user already typed.
  document.querySelectorAll('.next-weight-input').forEach((input) => {
    input.addEventListener('input', () => {
      overrides[input.dataset.exerciseId] = input.value;
    });
  });

  document.querySelectorAll('.easy-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', async (e) => {
      const checked = e.target.checked;
      const exerciseIndex = Number(e.target.dataset.exerciseIndex);
      e.target.disabled = true;
      const errEl = document.getElementById('easy-error');
      errEl.hidden = true;
      try {
        const updated = await setExerciseEasy(session, exerciseIndex, checked);
        rerender(updated);
      } catch (err) {
        e.target.checked = !checked;
        e.target.disabled = false;
        errEl.textContent = 'Could not update Easy. Check your storage and try again.';
        errEl.hidden = false;
      }
    });
  });

  document.getElementById('complete-workout-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('completion-error');
    errEl.hidden = true;

    const submittedOverrides = {};
    let invalid = false;
    document.querySelectorAll('.next-weight-input').forEach((input) => {
      const value = Number(input.value);
      if (input.value.trim() === '' || Number.isNaN(value) || value < 0) {
        invalid = true;
      }
      submittedOverrides[input.dataset.exerciseId] = value;
    });

    if (invalid) {
      e.target.disabled = false;
      errEl.textContent = 'Enter a valid, non-negative weight for every exercise.';
      errEl.hidden = false;
      return;
    }

    try {
      // Pick the one-time completion headline before committing — it must
      // share the same repetition history as rest cards (a phrase used as a
      // rest card this workout can't reappear here), so it's recorded onto
      // the still-active session (markCardShown) before completeWorkout's
      // own fresh read carries that into the stored workout's history.
      const headline = await pickCompletionHeadline(session, settings);
      if (headline) {
        await markCardShown(session, { key: headline.key, family: headline.family });
      }
      const storedWorkout = await completeWorkout(session, submittedOverrides);
      manualOverridesBySession.delete(session.id);
      renderWorkoutSummaryScreen(root, storedWorkout, settings, { onDone: onSessionEnded }, headline?.text ?? null);
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
function renderWorkoutSummaryScreen(root, storedWorkout, settings, { onDone }, headlineText) {
  const volume = computeWorkoutVolume(storedWorkout.exerciseResults);
  const durationText = formatDuration(storedWorkout.durationSeconds);
  const allSuccess = storedWorkout.exerciseResults.every((ex) => ex.success);
  const headline = headlineText;

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
