import { addRestTime, skipRest, undoLastSet, markCardShown, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { weightDisplayMarkup } from './loadCalculations.js';
import { setRecordingMarkup, attachSetRecordingHandlers } from './setRecording.js';
import { playChime } from './audio.js';
import { pickNextCard } from './restCards.js';
import { acquireWakeLock } from './wakeLock.js';
import { setProgressionMarkup } from './setProgression.js';

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
  acquireWakeLock();
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const restEndsAtMs = new Date(exercise.restEndsAt).getTime();
  const setsRecorded = exercise.setResults.length;
  const nextSetNumber = setsRecorded + 1;
  const initiallyExpired = restEndsAtMs - Date.now() <= 0;
  // Rest screen only ever renders when another set remains (the dispatcher
  // never starts a rest countdown after an exercise's final set), so the
  // only condition needed here is whether the just-recorded set was short.
  const lastSet = exercise.setResults[exercise.setResults.length - 1];
  const wasShort = lastSet != null && lastSet.reps < exercise.targetReps;

  root.innerHTML = `
    <main class="rest-screen">
      <p class="muted">Exercise ${index + 1} of ${session.exerciseResults.length}</p>
      <h1>${exercise.name}</h1>
      ${weightDisplayMarkup(exercise.targetWeight, exercise.barWeight, settings.units)}
      ${setProgressionMarkup(exercise)}
      ${wasShort ? `<p class="rest-recommendation" id="rest-recommendation">That set fell short. Consider adding 30 seconds to this rest</p>` : ''}

      <div class="stacked-actions" id="add-rest-block">
        <button id="add-rest-btn" class="add-rest-action">+30 sec</button>
      </div>

      <p class="rest-timer" id="rest-timer">${formatCountdown(restEndsAtMs - Date.now())}</p>
      <p class="rest-overtime-text" id="rest-overtime-text" hidden></p>

      <div class="stacked-actions" id="skip-rest-block">
        <button id="skip-rest-btn" class="skip-rest-action">Skip Rest</button>
      </div>

      <div class="rest-card" id="rest-card" hidden>
        <p class="rest-card-text" id="rest-card-text"></p>
        <button type="button" id="next-tip-btn" class="tertiary-action">Next Tip</button>
      </div>

      <p class="set-status" id="set-status" hidden>Begin set ${nextSetNumber} of ${exercise.targetSets} now</p>
      <p class="error" id="rest-error" hidden></p>

      <div id="set-recording-block" hidden>
        ${setRecordingMarkup(exercise)}
      </div>

      <div class="stacked-actions">
        <div class="undo-row" id="undo-row">
          <button id="undo-btn" class="tertiary-action">&lsaquo; Undo Last Set</button>
          <button id="undo-reveal-btn" class="undo-reveal-action" type="button">Undo</button>
        </div>
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
  const addRestBlock = document.getElementById('add-rest-block');
  const skipRestBlock = document.getElementById('skip-rest-block');
  const setStatusEl = document.getElementById('set-status');
  const cardEl = document.getElementById('rest-card');
  const recommendationEl = document.getElementById('rest-recommendation');

  // Don't chime for a rest that already expired while backgrounded/reloaded —
  // spec calls for the chime only "while visible." A live crossover from
  // counting-down to overtime during this render always chimes exactly once.
  let hasChimed = initiallyExpired;
  let isExpired = false;

  function enterOvertimeState() {
    isExpired = true;
    timerEl.classList.add('rest-timer--expired');
    overtimeTextEl.textContent = 'Rest finished';
    overtimeTextEl.hidden = false;
    addRestBlock.hidden = true;
    skipRestBlock.hidden = true;
    cardEl.hidden = true;
    if (recommendationEl) recommendationEl.hidden = true;
    setStatusEl.hidden = false;
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

  // Undo: the always-visible link executes directly (deliberate tap, no
  // confirm needed). The swipe-revealed button is the one at risk of firing
  // by accident (phone jostling on the ground/bag), so it requires its own
  // confirming tap rather than undoing on swipe completion.
  async function performUndo(button) {
    button.disabled = true;
    const errEl = document.getElementById('rest-error');
    errEl.hidden = true;
    try {
      const updated = await undoLastSet(session, index);
      stopTicking();
      rerender(updated);
    } catch (err) {
      button.disabled = false;
      errEl.textContent = 'Could not undo that set. Check your storage and try again.';
      errEl.hidden = false;
    }
  }

  document.getElementById('undo-btn').addEventListener('click', (e) => performUndo(e.target));

  const undoRevealBtn = document.getElementById('undo-reveal-btn');
  undoRevealBtn.addEventListener('click', (e) => performUndo(e.target));

  // Swipe-right anywhere on the screen (not anchored to the left edge, which
  // would conflict with iOS Safari's own edge-swipe-back gesture) reveals the
  // Undo button sliding in from the left. A tap elsewhere while revealed
  // dismisses it without undoing anything.
  let revealed = false;
  function showReveal() {
    revealed = true;
    undoRevealBtn.classList.add('undo-reveal-action--shown');
  }
  function hideReveal() {
    revealed = false;
    undoRevealBtn.classList.remove('undo-reveal-action--shown');
  }

  let touchStartX = null;
  let touchStartY = null;
  root.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (touchStartX == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchStartX = null;
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showReveal();
    } else if (revealed && !undoRevealBtn.contains(e.target)) {
      hideReveal();
    }
  }, { passive: true });

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
    if (isExpired) return;
    const card = await pickNextCard(session, settings, session.shownCardKeys ?? []);
    if (!card) {
      cardEl.hidden = true;
      return;
    }
    document.getElementById('rest-card-text').textContent = card.text;
    cardEl.hidden = false;
    try {
      const updated = await markCardShown(session, { key: card.key, family: card.family });
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
