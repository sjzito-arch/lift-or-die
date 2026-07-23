import { addRestTime, skipRest, undoLastSet, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { formatPerSideText } from './loadCalculations.js';
import { setRecordingMarkup, attachSetRecordingHandlers } from './setRecording.js';
import { playChime } from './audio.js';

function formatCountdown(msRemaining) {
  const totalSeconds = Math.round(msRemaining / 1000);
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function formatOvertimeText(msRemaining) {
  const overtimeSeconds = Math.max(0, Math.round(-msRemaining / 1000));
  const unit = overtimeSeconds === 1 ? 'second' : 'seconds';
  return `Rest finished — ${overtimeSeconds} ${unit} over.`;
}

// Rest state (spec §8). The countdown is driven entirely by an absolute
// `restEndsAt` timestamp, not by decrementing a counter, so backgrounding or
// suspending the tab can never drift the displayed time — each tick just
// recomputes from the clock. Reaching zero does not auto-advance or require
// a "Continue" tap: the screen stays up, flips to an expired/overtime look,
// chimes once, and keeps counting elapsed time as overtime. Once expired,
// Set Done / Partial are exposed right here so the lifter can record the
// next set the moment it's done, without a separate transition.
export function renderRestScreen(root, session, settings, { onSessionEnded, rerender }) {
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const restEndsAtMs = new Date(exercise.restEndsAt).getTime();
  const setsRecorded = exercise.setResults.length;
  const nextSetNumber = setsRecorded + 1;
  const initiallyExpired = restEndsAtMs - Date.now() <= 0;

  root.innerHTML = `
    <main class="rest-screen">
      <p class="muted">Exercise ${index + 1} of ${session.exerciseResults.length}</p>
      <h1>${exercise.name}</h1>
      <p class="target-weight">${exercise.targetWeight} ${settings.units}</p>
      <p class="muted">${formatPerSideText(exercise.targetWeight, exercise.barWeight, settings.units)}</p>
      <p class="rest-timer" id="rest-timer">${formatCountdown(restEndsAtMs - Date.now())}</p>
      <p class="rest-overtime-text" id="rest-overtime-text" hidden></p>
      <p class="set-status">Set ${setsRecorded} done. Ready for Set ${nextSetNumber} of ${exercise.targetSets}.</p>
      <p class="error" id="rest-error" hidden></p>

      <div id="set-recording-block" hidden>
        ${setRecordingMarkup(exercise)}
      </div>

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
  const overtimeTextEl = document.getElementById('rest-overtime-text');
  const setRecordingBlock = document.getElementById('set-recording-block');

  // Don't chime for a rest that already expired while backgrounded/reloaded —
  // spec calls for the chime only "while visible." A live crossover from
  // counting-down to overtime during this render always chimes exactly once.
  let hasChimed = initiallyExpired;
  let isExpired = false;

  function enterOvertimeState() {
    isExpired = true;
    timerEl.classList.add('rest-timer--expired');
    overtimeTextEl.hidden = false;
    setRecordingBlock.hidden = false;
    // Set Done/Partial succeeding here must stop this screen's own countdown
    // before handing off to the dispatcher — otherwise this interval keeps
    // running detached in the background after the new screen renders.
    attachSetRecordingHandlers(session, index, exercise, (updated) => {
      stopTicking();
      rerender(updated);
    });
  }

  if (initiallyExpired) {
    enterOvertimeState();
  }

  const intervalId = setInterval(() => {
    const remaining = restEndsAtMs - Date.now();
    timerEl.textContent = formatCountdown(remaining);
    if (remaining <= 0) {
      overtimeTextEl.textContent = formatOvertimeText(remaining);
      if (!isExpired) {
        enterOvertimeState();
      }
      if (!hasChimed) {
        hasChimed = true;
        playChime();
      }
    }
  }, 250);

  function stopTicking() {
    clearInterval(intervalId);
  }

  document.getElementById('add-rest-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('rest-error');
    errEl.hidden = true;
    try {
      const updated = await addRestTime(session, index, 30);
      stopTicking();
      rerender(updated);
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
