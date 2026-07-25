import { recordSet } from './session.js';
import { isRapidRepeatTap, markRecordAttempt, resetRecordAttempt } from './rapidTapGuard.js';
import { unlockAudio } from './audio.js';

// Set Done / Partial-set entry, shared between the ready screen
// (activeExercise.js) and the post-rest overtime screen (rest.js) — tapping
// Set Done must behave identically wherever it's reached from.
export function setRecordingMarkup(exercise) {
  return `
    <div class="stacked-actions">
      <button id="set-done-btn" class="set-done-action">Set Done</button>
      <button id="partial-btn" class="secondary-action">Partial Set</button>
    </div>
    <p class="error" id="set-done-error" hidden></p>
    <div id="partial-panel" class="discard-panel" hidden>
      <label for="partial-reps">Reps completed (0–${exercise.targetReps})</label>
      <div class="rep-stepper">
        <button type="button" id="rep-decrement" class="rep-stepper-btn" aria-label="Decrease reps">&minus;</button>
        <input type="number" id="partial-reps" min="0" max="${exercise.targetReps}" step="1" value="${exercise.targetReps}">
        <button type="button" id="rep-increment" class="rep-stepper-btn" aria-label="Increase reps">+</button>
      </div>
      <p class="error" id="partial-error" hidden></p>
      <div class="step-actions">
        <button id="partial-cancel" class="secondary-action">Cancel</button>
        <button id="partial-confirm" class="primary-action">Record Set</button>
      </div>
    </div>
  `;
}

export function attachSetRecordingHandlers(session, index, exercise, rerender) {
  const setDoneBtn = document.getElementById('set-done-btn');
  const partialBtn = document.getElementById('partial-btn');

  setDoneBtn.addEventListener('click', async () => {
    if (isRapidRepeatTap()) return;
    markRecordAttempt();
    unlockAudio();
    setDoneBtn.disabled = true;
    partialBtn.disabled = true;
    const errEl = document.getElementById('set-done-error');
    errEl.hidden = true;
    try {
      const updated = await recordSet(session, index, exercise.targetReps);
      rerender(updated);
    } catch (err) {
      resetRecordAttempt();
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

  // Stepper buttons avoid the keyboard for the common case; the input
  // itself stays tappable/typable as a fallback for a big jump.
  document.getElementById('rep-decrement').addEventListener('click', () => {
    const input = document.getElementById('partial-reps');
    input.value = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
  });
  document.getElementById('rep-increment').addEventListener('click', () => {
    const input = document.getElementById('partial-reps');
    input.value = Math.min(exercise.targetReps, (parseInt(input.value, 10) || 0) + 1);
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
    markRecordAttempt();
    unlockAudio();
    errEl.hidden = true;
    e.target.disabled = true;
    try {
      const updated = await recordSet(session, index, reps);
      rerender(updated);
    } catch (err) {
      resetRecordAttempt();
      e.target.disabled = false;
      errEl.textContent = 'Could not save that set. Check your storage and try again.';
      errEl.hidden = false;
    }
  });
}
