import { addRestTime, skipRest, undoLastSet, markCardShown, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { formatPerSideText } from './loadCalculations.js';
import { setRecordingMarkup, attachSetRecordingHandlers } from './setRecording.js';
import { playChime } from './audio.js';
import { pickNextCard } from './restCards.js';

function formatCountdown(msRemaining) {
  const totalSeconds = Math.round(msRemaining / 1000);
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

// Rest state (spec §8). The countdown is driven entirely by an absolute
// `restEndsAt` timestamp, not by decrementing a counter, so backgrounding or
// suspending the tab can never drift the displayed time — each tick just
// recomputes from the clock. Reaching zero does not auto-advance or require
// a "Continue" tap: the screen stays up, flips to an expired/ready look
// ("Rest finished."), chimes once, and the timer keeps counting past zero
// as a negative number. +30 sec/Skip Rest no longer apply once expired, so
// they're hidden; Set Done / Partial are exposed right here instead, so the
// lifter can record the next set the moment it's done.
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

      <div class="rest-card" id="rest-card" hidden>
        <p class="rest-card-text" id="rest-card-text"></p>
        <button type="button" id="next-tip-btn" class="tertiary-action">Next Tip</button>
      </div>

      <p class="set-status">Set ${setsRecorded} done. Ready for Set ${nextSetNumber} of ${exercise.targetSets}.</p>
      <p class="error" id="rest-error" hidden></p>

      <div id="set-recording-block" hidden>
        ${setRecordingMarkup(exercise)}
      </div>

      <div class="stacked-actions" id="pre-expiry-actions">
        <button id="add-rest-btn" class="secondary-action">+30 sec</button>
        <button id="skip-rest-btn" class="secondary-action">Skip Rest</button>
      </div>
      <div class="stacked-actions">
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
  const preExpiryActions = document.getElementById('pre-expiry-actions');

  // Don't chime for a rest that already expired while backgrounded/reloaded —
  // spec calls for the chime only "while visible." A live crossover from
  // counting-down to overtime during this render always chimes exactly once.
  let hasChimed = initiallyExpired;
  let isExpired = false;

  function enterOvertimeState() {
    isExpired = true;
    timerEl.classList.add('rest-timer--expired');
    overtimeTextEl.textContent = 'Rest finished.';
    overtimeTextEl.hidden = false;
    preExpiryActions.hidden = true;
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

  // One rest card below the timer, replaced (not scrolled/autoplayed) only
  // on an explicit Next Tip tap (spec §16). Shown keys are tracked on the
  // session so a card doesn't repeat within the same workout.
  async function loadCard() {
    const card = await pickNextCard(session, settings, session.shownCardKeys ?? []);
    const cardEl = document.getElementById('rest-card');
    if (!card) {
      cardEl.hidden = true;
      return;
    }
    document.getElementById('rest-card-text').textContent = card.text;
    cardEl.hidden = false;
    try {
      const updated = await markCardShown(session, card.key);
      session.shownCardKeys = updated.shownCardKeys;
    } catch (err) {
      // Best-effort: if this fails to persist, worst case is an occasional
      // repeated card later in the workout — not worth blocking the rest
      // screen's primary purpose over.
    }
  }
  loadCard();
  document.getElementById('next-tip-btn').addEventListener('click', loadCard);
}
