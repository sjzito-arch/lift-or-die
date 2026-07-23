import { addRestTime, skipRest, undoLastSet, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { formatPerSideText } from './loadCalculations.js';
import { playChime } from './audio.js';

function formatCountdown(msRemaining) {
  const totalSeconds = Math.max(0, Math.round(msRemaining / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Rest state (spec §8). The countdown is driven entirely by an absolute
// `restEndsAt` timestamp, not by decrementing a counter, so backgrounding or
// suspending the tab can never drift the displayed time — each tick just
// recomputes from the clock.
export function renderRestScreen(root, session, settings, { onSessionEnded, rerender }) {
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  let restEndsAtMs = new Date(exercise.restEndsAt).getTime();
  const setsRecorded = exercise.setResults.length;
  const nextSetNumber = setsRecorded + 1;

  root.innerHTML = `
    <main class="rest-screen">
      <p class="muted">Exercise ${index + 1} of ${session.exerciseResults.length}</p>
      <h1>${exercise.name}</h1>
      <p class="target-weight">${exercise.targetWeight} ${settings.units}</p>
      <p class="muted">${formatPerSideText(exercise.targetWeight, exercise.barWeight, settings.units)}</p>
      <p class="rest-timer" id="rest-timer">${formatCountdown(restEndsAtMs - Date.now())}</p>
      <p class="set-status">Set ${setsRecorded} done. Ready for Set ${nextSetNumber} of ${exercise.targetSets}.</p>
      <p class="error" id="rest-error" hidden></p>
      <div class="stacked-actions">
        <button id="add-rest-btn" class="secondary-action">+30 sec</button>
        <button id="skip-rest-btn" class="secondary-action">Skip Rest</button>
        <button id="undo-btn" class="tertiary-action">Undo Last Set</button>
      </div>
      <div class="stacked-actions">
        <button id="end-workout-btn" class="secondary-action">End Workout</button>
        <div id="end-workout-panel" hidden>
          ${endWorkoutControlMarkup(session)}
        </div>
      </div>
    </main>
  `;

  const timerEl = document.getElementById('rest-timer');
  let settled = false;

  const intervalId = setInterval(() => {
    const remaining = restEndsAtMs - Date.now();
    if (remaining <= 0) {
      timerEl.textContent = formatCountdown(0);
      if (!settled) {
        settled = true;
        playChime();
        clearInterval(intervalId);
        skipRest(session, index)
          .then((updated) => rerender(updated))
          .catch(() => {
            // Transient failure right at expiry: leave the countdown at
            // 0:00; the next manual action (Skip/Undo/Set Done) will retry.
          });
      }
      return;
    }
    timerEl.textContent = formatCountdown(remaining);
  }, 250);

  function stopTicking() {
    clearInterval(intervalId);
  }

  document.getElementById('add-rest-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('rest-error');
    errEl.hidden = true;
    try {
      await addRestTime(session, index, 30);
      restEndsAtMs += 30000;
      e.target.disabled = false;
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not add rest time. Check your storage and try again.';
      errEl.hidden = false;
    }
  });

  document.getElementById('skip-rest-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('rest-error');
    errEl.hidden = true;
    try {
      const updated = await skipRest(session, index);
      stopTicking();
      rerender(updated);
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not skip rest. Check your storage and try again.';
      errEl.hidden = false;
    }
  });

  document.getElementById('undo-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('rest-error');
    errEl.hidden = true;
    try {
      const updated = await undoLastSet(session, index);
      stopTicking();
      rerender(updated);
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not undo that set. Check your storage and try again.';
      errEl.hidden = false;
    }
  });

  document.getElementById('end-workout-btn').addEventListener('click', () => {
    document.getElementById('end-workout-panel').hidden = false;
  });
  attachEndWorkoutHandlers(session, () => {
    stopTicking();
    onSessionEnded();
  });
}
