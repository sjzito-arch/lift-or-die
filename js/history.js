import { getAllRecords, getRecord } from './db.js';
import { STORES, EXERCISE_ORDER } from './schema.js';
import { computeWorkoutVolume, formatSetSummary } from './statsCalculations.js';
import { formatPerSideText } from './loadCalculations.js';

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

// History (spec §13), read-only for this slice — editing/deletion is
// Slice 7 ("Settings and completed-workout correction").
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
      <p class="muted">${formatDate(workout.startedAt)} · ${workout.status === 'completed' ? 'Completed' : 'Incomplete'}</p>
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
        <button id="history-detail-back" class="secondary-action">Back to History</button>
      </div>
    </main>
  `;

  document.getElementById('history-detail-back').addEventListener('click', onBack);
}
