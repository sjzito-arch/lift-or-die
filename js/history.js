import { getAllRecords, getRecord, putRecord, deleteRecord } from './db.js';
import { STORES, EXERCISE_ORDER } from './schema.js';
import { computeWorkoutVolume, formatSetSummary } from './statsCalculations.js';
import { formatPerSideText } from './loadCalculations.js';
import { computeSuccess } from './session.js';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return 'n/a';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Local components, not `toISOString()` — that renders in UTC, which shows
// (and, if left untouched, would silently re-save) the wrong wall-clock time
// for any user not at UTC+0.
function dateInputValue(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeInputValue(iso) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function getSortedWorkouts() {
  const workouts = await getAllRecords(STORES.storedWorkouts.name);
  return workouts.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

// Simple V1 progress (spec §13): original vs current weight per exercise,
// lifetime votes, recent dates, highest successful working weight per
// exercise. No charts, no analytics — just these plain facts.
async function computeProgress(settings, workouts) {
  const exerciseConfigs = await Promise.all(
    EXERCISE_ORDER.map((id) => getRecord(STORES.exerciseConfigs.name, id))
  );

  const highestByExercise = {};
  for (const w of workouts) {
    for (const ex of w.exerciseResults) {
      if (ex.success && (highestByExercise[ex.exerciseId] == null || ex.targetWeight > highestByExercise[ex.exerciseId])) {
        highestByExercise[ex.exerciseId] = ex.targetWeight;
      }
    }
  }

  return {
    exerciseConfigs,
    highestByExercise,
    lifetimeVotes: settings.lifetimeVotes ?? 0,
  };
}

// History (spec §13): list + detail, with edit/delete (spec §13 correction
// requirements — Slice 7).
export async function renderHistoryList(root, settings, { onBack }) {
  const workouts = await getSortedWorkouts();
  const progress = await computeProgress(settings, workouts);

  root.innerHTML = `
    <main class="history">
      <h1>History</h1>

      <section class="progress-section">
        <h2>Progress</h2>
        <ul class="progress-list">
          ${progress.exerciseConfigs
            .map(
              (ex) => `
            <li>
              <span class="exercise-name">${ex.name}</span>
              <span class="muted">${ex.originalWeight ?? '—'} → ${ex.currentWeight ?? '—'} ${settings.units}${
                progress.highestByExercise[ex.id] != null
                  ? ` · best ${progress.highestByExercise[ex.id]} ${settings.units}`
                  : ''
              }</span>
            </li>`
            )
            .join('')}
        </ul>
        <p class="muted">Lifetime votes for Future You: ${progress.lifetimeVotes}</p>
        <p class="muted">Total workouts logged: ${workouts.length}</p>
      </section>

      <section>
        <h2>Workouts</h2>
        ${
          workouts.length === 0
            ? `<p class="muted">No workouts yet — finish one and it'll show up here.</p>`
            : `<ul class="history-list">
                ${workouts
                  .map(
                    (w) => `
                  <li data-id="${w.id}" class="history-row" tabindex="0" role="button">
                    <div class="history-row-main">
                      <span class="exercise-name">Workout ${w.type}</span>
                      <span class="muted">${formatDate(w.startedAt)}</span>
                    </div>
                    <div class="muted">${w.status === 'completed' ? 'Completed' : 'Incomplete'} · ${formatDuration(w.durationSeconds)}</div>
                  </li>`
                  )
                  .join('')}
              </ul>`
        }
      </section>

      <div class="stacked-actions">
        <button id="history-back-btn" class="secondary-action">Back to Home</button>
      </div>
    </main>
  `;

  document.querySelectorAll('.history-row').forEach((row) => {
    const openDetail = () =>
      renderHistoryDetail(root, row.dataset.id, settings, {
        onBack: () => renderHistoryList(root, settings, { onBack }),
      });
    row.addEventListener('click', openDetail);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail();
      }
    });
  });

  document.getElementById('history-back-btn').addEventListener('click', onBack);
}

async function renderHistoryDetail(root, workoutId, settings, { onBack }) {
  const workout = await getRecord(STORES.storedWorkouts.name, workoutId);
  if (!workout) {
    root.innerHTML = `
      <main class="history">
        <p>That workout couldn't be found.</p>
        <div class="stacked-actions">
          <button id="history-detail-back" class="secondary-action">Back</button>
        </div>
      </main>
    `;
    document.getElementById('history-detail-back').addEventListener('click', onBack);
    return;
  }

  const volume = computeWorkoutVolume(workout.exerciseResults);

  root.innerHTML = `
    <main class="history">
      <h1>Workout ${workout.type}</h1>
      <p class="muted">${formatDate(workout.startedAt)} · ${workout.status === 'completed' ? 'Completed' : 'Incomplete'}${workout.updatedAt ? ' · edited' : ''}</p>
      <p class="muted">Duration: ${formatDuration(workout.durationSeconds)} · Volume: ${volume} ${settings.units}</p>

      ${workout.exerciseResults
        .map(
          (ex) => `
        <div class="completion-exercise">
          <div class="review-name">
            <span>${ex.name}</span>
            <span class="review-sets">${ex.targetSets}×${ex.targetReps}</span>
          </div>
          <div class="review-stats">${ex.targetWeight} ${settings.units} · bar ${ex.barWeight} ${settings.units} · ${formatPerSideText(ex.targetWeight, ex.barWeight, settings.units)}</div>
          <p class="muted">${formatSetSummary(ex) || 'No sets recorded'}</p>
          <p class="muted">${ex.success == null ? 'Not recorded' : ex.success ? 'Successful' : 'Not every set hit target'}</p>
        </div>`
        )
        .join('')}

      <div class="stacked-actions">
        <button id="history-detail-edit" class="secondary-action">Edit</button>
        <button id="history-detail-back" class="secondary-action">Back to History</button>
      </div>
      <div class="stacked-actions">
        <button id="history-detail-delete" class="tertiary-action">Delete this workout</button>
        <div id="delete-confirm" class="discard-panel" hidden>
          <p>Delete this workout permanently? This does not reverse any progression already applied.</p>
          <p class="error" id="delete-error" hidden></p>
          <div class="step-actions">
            <button id="delete-cancel" class="secondary-action">Cancel</button>
            <button id="delete-confirm-btn" class="primary-action">Delete</button>
          </div>
        </div>
      </div>
    </main>
  `;

  document.getElementById('history-detail-back').addEventListener('click', onBack);
  document.getElementById('history-detail-edit').addEventListener('click', () => {
    renderHistoryEdit(root, workout, settings, {
      onBack: () => renderHistoryDetail(root, workoutId, settings, { onBack }),
    });
  });
  document.getElementById('history-detail-delete').addEventListener('click', () => {
    document.getElementById('delete-confirm').hidden = false;
  });
  document.getElementById('delete-cancel').addEventListener('click', () => {
    document.getElementById('delete-confirm').hidden = true;
  });
  document.getElementById('delete-confirm-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('delete-error');
    errEl.hidden = true;
    try {
      await deleteRecord(STORES.storedWorkouts.name, workoutId);
      onBack();
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not delete this workout. Check your storage and try again.';
      errEl.hidden = false;
    }
  });
}

// Completed-workout correction (spec §13): date/time, target weight, bar
// weight, reps per set. Preserves `updatedAt`; never touches other workout
// records or silently changes current working weight. If an edit flips an
// exercise's success, the current working weight adjustment is offered,
// never applied automatically.
function renderHistoryEdit(root, workout, settings, { onBack }) {
  let dirty = false;

  root.innerHTML = `
    <main class="history">
      <h1>Edit Workout ${workout.type}</h1>
      <label>Date
        <input type="date" id="edit-date" value="${dateInputValue(workout.startedAt)}">
      </label>
      <label>Time
        <input type="time" id="edit-time" value="${timeInputValue(workout.startedAt)}">
      </label>

      ${workout.exerciseResults
        .map(
          (ex, exIndex) => `
        <div class="completion-exercise" data-exercise-index="${exIndex}">
          <div class="review-name"><span>${ex.name}</span><span class="review-sets">${ex.targetSets}×${ex.targetReps}</span></div>
          <label>Target weight
            <input type="number" class="edit-target-weight" data-exercise-index="${exIndex}" value="${ex.targetWeight}" min="0" step="0.5">
          </label>
          <label>Bar weight
            <input type="number" class="edit-bar-weight" data-exercise-index="${exIndex}" value="${ex.barWeight}" min="0" step="0.5">
          </label>
          ${ex.setResults
            .map(
              (s, setIndex) => `
            <label>Set ${s.setNumber} reps (0–${ex.targetReps})
              <input type="number" class="edit-reps" data-exercise-index="${exIndex}" data-set-index="${setIndex}" value="${s.reps}" min="0" max="${ex.targetReps}" step="1">
            </label>`
            )
            .join('')}
        </div>`
        )
        .join('')}

      <p class="error" id="edit-error" hidden></p>

      <div class="stacked-actions">
        <button id="edit-save-btn" class="primary-action">Save</button>
        <button id="edit-cancel-btn" class="secondary-action">Cancel</button>
      </div>
      <div id="edit-discard-confirm" class="discard-panel" hidden>
        <p>Discard unsaved changes?</p>
        <div class="step-actions">
          <button id="edit-discard-cancel" class="secondary-action">Keep Editing</button>
          <button id="edit-discard-confirm-btn" class="primary-action">Discard</button>
        </div>
      </div>
    </main>
  `;

  root.addEventListener('input', () => { dirty = true; });

  document.getElementById('edit-cancel-btn').addEventListener('click', () => {
    if (dirty) {
      document.getElementById('edit-discard-confirm').hidden = false;
    } else {
      onBack();
    }
  });
  document.getElementById('edit-discard-cancel').addEventListener('click', () => {
    document.getElementById('edit-discard-confirm').hidden = true;
  });
  document.getElementById('edit-discard-confirm-btn').addEventListener('click', onBack);

  document.getElementById('edit-save-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('edit-error');
    errEl.hidden = true;

    const dateVal = document.getElementById('edit-date').value;
    const timeVal = document.getElementById('edit-time').value;
    if (!dateVal || !timeVal) {
      e.target.disabled = false;
      errEl.textContent = 'Please enter a valid date and time.';
      errEl.hidden = false;
      return;
    }
    const newStartedAt = new Date(`${dateVal}T${timeVal}`);
    if (Number.isNaN(newStartedAt.getTime())) {
      e.target.disabled = false;
      errEl.textContent = 'Please enter a valid date and time.';
      errEl.hidden = false;
      return;
    }

    const updatedExerciseResults = [];
    const successChanges = [];
    for (let exIndex = 0; exIndex < workout.exerciseResults.length; exIndex++) {
      const ex = workout.exerciseResults[exIndex];
      const targetWeight = Number(document.querySelector(`.edit-target-weight[data-exercise-index="${exIndex}"]`).value);
      const barWeight = Number(document.querySelector(`.edit-bar-weight[data-exercise-index="${exIndex}"]`).value);
      if (Number.isNaN(targetWeight) || targetWeight < 0 || Number.isNaN(barWeight) || barWeight < 0) {
        e.target.disabled = false;
        errEl.textContent = `Please enter valid, non-negative weights for ${ex.name}.`;
        errEl.hidden = false;
        return;
      }

      const repInputs = document.querySelectorAll(`.edit-reps[data-exercise-index="${exIndex}"]`);
      const setResults = [];
      for (const input of repInputs) {
        const setIndex = Number(input.dataset.setIndex);
        const reps = parseInt(input.value, 10);
        if (!Number.isInteger(reps) || reps < 0 || reps > ex.targetReps) {
          e.target.disabled = false;
          errEl.textContent = `Enter a whole number from 0 to ${ex.targetReps} for every set of ${ex.name}.`;
          errEl.hidden = false;
          return;
        }
        setResults.push({ ...ex.setResults[setIndex], reps });
      }

      const updatedExercise = { ...ex, targetWeight, barWeight, setResults };
      updatedExercise.success = computeSuccess(updatedExercise);
      if (updatedExercise.success !== ex.success) {
        successChanges.push({ exIndex, name: ex.name, oldSuccess: ex.success, newSuccess: updatedExercise.success });
      }
      updatedExerciseResults.push(updatedExercise);
    }

    // Shift endedAt by the same amount startedAt moved, so duration (and any
    // other endedAt-derived display) stays internally consistent — this is
    // an edit to when the workout happened, not to how long it lasted.
    const deltaMs = newStartedAt.getTime() - new Date(workout.startedAt).getTime();
    const newEndedAt = workout.endedAt ? new Date(new Date(workout.endedAt).getTime() + deltaMs).toISOString() : workout.endedAt;

    const updatedWorkout = {
      ...workout,
      startedAt: newStartedAt.toISOString(),
      endedAt: newEndedAt,
      exerciseResults: updatedExerciseResults,
      updatedAt: new Date().toISOString(),
    };

    try {
      await putRecord(STORES.storedWorkouts.name, updatedWorkout);
      dirty = false;
      if (workout.status === 'completed' && successChanges.length > 0) {
        await renderSuccessChangeOffer(root, updatedWorkout, successChanges, settings, { onDone: onBack });
      } else {
        onBack();
      }
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not save these changes. Check your storage and try again.';
      errEl.hidden = false;
    }
  });
}

// Offers (never forces) a working-weight correction per exercise whose
// success verdict changed as a result of an edit (spec §10/§13). Only shown
// for completed workouts, since only those ever applied progression.
async function renderSuccessChangeOffer(root, updatedWorkout, successChanges, settings, { onDone }) {
  const exerciseConfigs = {};
  for (const change of successChanges) {
    const exerciseId = updatedWorkout.exerciseResults[change.exIndex].exerciseId;
    exerciseConfigs[exerciseId] = await getRecord(STORES.exerciseConfigs.name, exerciseId);
  }

  root.innerHTML = `
    <main class="history">
      <h1>Result changed</h1>
      <p class="muted">Editing this workout changed whether these exercises count as successful. Correcting current working weight is optional — nothing is applied unless you choose to.</p>
      ${successChanges
        .map((change) => {
          const ex = updatedWorkout.exerciseResults[change.exIndex];
          const config = exerciseConfigs[ex.exerciseId];
          const delta = change.newSuccess ? ex.increment : -ex.increment;
          const suggested = (config.currentWeight ?? 0) + delta;
          return `
          <div class="completion-exercise" data-exercise-id="${ex.exerciseId}" data-suggested="${suggested}">
            <div class="review-name"><span>${change.name}</span></div>
            <p class="muted">Now: ${change.newSuccess ? 'Successful' : 'Not every set hit target'} (was: ${change.oldSuccess ? 'Successful' : 'Not every set hit target'})</p>
            <p class="muted">Current working weight: ${config.currentWeight} ${settings.units}. Adjust to ${suggested} ${settings.units}?</p>
            <div class="step-actions">
              <button type="button" class="secondary-action offer-skip" data-exercise-id="${ex.exerciseId}">Skip</button>
              <button type="button" class="primary-action offer-apply" data-exercise-id="${ex.exerciseId}">Adjust to ${suggested}</button>
            </div>
          </div>`;
        })
        .join('')}
      <div class="stacked-actions">
        <button id="offer-done-btn" class="secondary-action">Done</button>
      </div>
    </main>
  `;

  document.querySelectorAll('.offer-apply').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const card = btn.closest('.completion-exercise');
      const exerciseId = card.dataset.exerciseId;
      const suggested = Number(card.dataset.suggested);
      const config = await getRecord(STORES.exerciseConfigs.name, exerciseId);
      await putRecord(STORES.exerciseConfigs.name, { ...config, currentWeight: suggested });
      card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      card.insertAdjacentHTML('beforeend', '<p class="muted">Adjusted.</p>');
    });
  });
  document.querySelectorAll('.offer-skip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.completion-exercise');
      card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      card.insertAdjacentHTML('beforeend', '<p class="muted">Skipped.</p>');
    });
  });
  document.getElementById('offer-done-btn').addEventListener('click', onDone);
}
