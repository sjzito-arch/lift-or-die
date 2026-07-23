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
