import { getRecord, putRecord } from './db.js';
import { STORES, EXERCISE_ORDER, CARD_CATEGORIES } from './schema.js';

const STEPS = ['global', ...EXERCISE_ORDER, 'review'];

export async function renderSetupStep(root, onComplete) {
  const settings = await getRecord(STORES.appSettings.name, 'settings');
  const stepIndex = Math.min(Math.max(settings.setupStep ?? 0, 0), STEPS.length - 1);
  const step = STEPS[stepIndex];

  if (step === 'global') {
    await renderGlobalStep(root, settings, stepIndex, onComplete);
  } else if (step === 'review') {
    await renderReviewStep(root, settings, stepIndex, onComplete);
  } else {
    await renderExerciseStep(root, settings, stepIndex, step, onComplete);
  }
}

function stepHeader(current, total) {
  return `<p class="step-indicator">Step ${current + 1} of ${total}</p>`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function goToStep(root, onComplete, delta) {
  const settings = await getRecord(STORES.appSettings.name, 'settings');
  const next = Math.max(0, Math.min(STEPS.length - 1, (settings.setupStep ?? 0) + delta));
  await putRecord(STORES.appSettings.name, { ...settings, setupStep: next });
  await renderSetupStep(root, onComplete);
}

function renderToggleCheckboxes(toggles) {
  return CARD_CATEGORIES.map(
    (c) => `
      <label class="checkbox-label">
        <input type="checkbox" name="toggle_${c.key}" ${toggles?.[c.key] ? 'checked' : ''}>
        ${c.label}
      </label>`
  ).join('');
}

function collectToggles(form) {
  const toggles = {};
  for (const c of CARD_CATEGORIES) {
    toggles[c.key] = form.querySelector(`[name="toggle_${c.key}"]`).checked;
  }
  return toggles;
}

async function renderGlobalStep(root, settings, stepIndex, onComplete) {
  root.innerHTML = `
    <main class="setup">
      ${stepHeader(stepIndex, STEPS.length)}
      <h1>Let's set up Lift or Die</h1>
      <form id="global-form">
        <label>Units
          <select name="units">
            <option value="lb" ${settings.units === 'lb' ? 'selected' : ''}>Pounds (lb)</option>
            <option value="kg" ${settings.units === 'kg' ? 'selected' : ''}>Kilograms (kg)</option>
          </select>
        </label>
        <label>Program start date
          <input type="date" name="programStartDate" value="${settings.programStartDate ?? todayISO()}" required>
        </label>
        <label>First workout
          <select name="firstWorkoutChoice">
            <option value="A" ${settings.firstWorkoutChoice === 'A' ? 'selected' : ''}>Workout A</option>
            <option value="B" ${settings.firstWorkoutChoice === 'B' ? 'selected' : ''}>Workout B</option>
          </select>
        </label>
        <label>Humor level
          <select name="humorLevel">
            <option value="off" ${settings.humorLevel === 'off' ? 'selected' : ''}>Off</option>
            <option value="light" ${settings.humorLevel === 'light' ? 'selected' : ''}>Light</option>
            <option value="mixed" ${settings.humorLevel === 'mixed' ? 'selected' : ''}>Mixed</option>
          </select>
        </label>
        <label>Personal motivation (optional)
          <textarea name="motivation" rows="2">${settings.motivation ?? ''}</textarea>
        </label>
        <label>Default bar weight
          <input type="number" name="globalDefaultBarWeight" value="${settings.globalDefaultBarWeight}" min="0" step="0.5" required>
        </label>
        <label>Default rest (seconds)
          <input type="number" name="globalDefaultRestSeconds" value="${settings.globalDefaultRestSeconds}" min="0" step="5" required>
        </label>
        <fieldset>
          <legend>Rest card categories</legend>
          ${renderToggleCheckboxes(settings.cardCategoryToggles)}
        </fieldset>
        <p class="error" id="global-error" hidden></p>
        <button type="submit" class="primary-action">Next</button>
      </form>
    </main>
  `;

  document.getElementById('global-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const barWeight = Number(data.get('globalDefaultBarWeight'));
    const restSeconds = Number(data.get('globalDefaultRestSeconds'));
    const programStartDate = data.get('programStartDate');

    const errorEl = document.getElementById('global-error');
    if (!programStartDate || Number.isNaN(barWeight) || barWeight < 0 || Number.isNaN(restSeconds) || restSeconds < 0) {
      errorEl.textContent = 'Please fill in all fields with valid values.';
      errorEl.hidden = false;
      return;
    }

    const updated = {
      ...settings,
      units: data.get('units'),
      programStartDate,
      firstWorkoutChoice: data.get('firstWorkoutChoice'),
      humorLevel: data.get('humorLevel'),
      motivation: data.get('motivation').trim(),
      globalDefaultBarWeight: barWeight,
      globalDefaultRestSeconds: restSeconds,
      cardCategoryToggles: collectToggles(form),
      setupStep: stepIndex + 1,
    };

    await putRecord(STORES.appSettings.name, updated);
    await renderSetupStep(root, onComplete);
  });
}

async function renderExerciseStep(root, settings, stepIndex, exerciseId, onComplete) {
  const exercise = await getRecord(STORES.exerciseConfigs.name, exerciseId);

  root.innerHTML = `
    <main class="setup">
      ${stepHeader(stepIndex, STEPS.length)}
      <h1>${exercise.name}</h1>
      <form id="exercise-form">
        <label>Original starting weight
          <input type="number" name="originalWeight" value="${exercise.originalWeight ?? settings.globalDefaultBarWeight}" min="0" step="0.5" required>
        </label>
        <label>Current working weight
          <input type="number" name="currentWeight" value="${exercise.currentWeight ?? ''}" min="0" step="0.5" required>
        </label>
        <p class="muted setup-hint">First time? Use the same as your starting weight above.</p>
        <label>Weight increment
          <input type="number" name="increment" value="${exercise.increment ?? 5}" min="0" step="0.5" required>
        </label>
        <label>Bar weight (blank uses default of ${settings.globalDefaultBarWeight})
          <input type="number" name="barWeight" value="${exercise.barWeight ?? ''}" min="0" step="0.5">
        </label>
        <label>Rest seconds (blank uses default of ${settings.globalDefaultRestSeconds})
          <input type="number" name="restSecondsOverride" value="${exercise.restSecondsOverride ?? ''}" min="0" step="5">
        </label>
        <label>Target sets
          <input type="number" name="targetSets" value="${exercise.targetSets}" min="1" step="1" required>
        </label>
        <label>Target reps
          <input type="number" name="targetReps" value="${exercise.targetReps}" min="1" step="1" required>
        </label>
        <p class="error" id="exercise-error" hidden></p>
        <div class="step-actions">
          <button type="button" id="back-btn" class="secondary-action">Back</button>
          <button type="submit" class="primary-action">Next</button>
        </div>
      </form>
    </main>
  `;

  document.getElementById('back-btn').addEventListener('click', () => goToStep(root, onComplete, -1));

  document.getElementById('exercise-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const originalWeight = Number(data.get('originalWeight'));
    const currentWeight = Number(data.get('currentWeight'));
    const increment = Number(data.get('increment'));
    const targetSets = parseInt(data.get('targetSets'), 10);
    const targetReps = parseInt(data.get('targetReps'), 10);
    const barWeightRaw = data.get('barWeight');
    const restRaw = data.get('restSecondsOverride');

    const errorEl = document.getElementById('exercise-error');
    const numericFields = [originalWeight, currentWeight, increment];
    if (
      numericFields.some((n) => Number.isNaN(n) || n < 0) ||
      !Number.isInteger(targetSets) || targetSets < 1 ||
      !Number.isInteger(targetReps) || targetReps < 1
    ) {
      errorEl.textContent = 'Please enter valid, non-negative values.';
      errorEl.hidden = false;
      return;
    }

    const updatedExercise = {
      ...exercise,
      originalWeight,
      currentWeight,
      increment,
      barWeight: barWeightRaw ? Number(barWeightRaw) : null,
      restSecondsOverride: restRaw ? Number(restRaw) : null,
      targetSets,
      targetReps,
    };

    await putRecord(STORES.exerciseConfigs.name, updatedExercise);
    await putRecord(STORES.appSettings.name, { ...settings, setupStep: stepIndex + 1 });
    await renderSetupStep(root, onComplete);
  });
}

async function renderReviewStep(root, settings, stepIndex, onComplete) {
  const exercises = await Promise.all(
    EXERCISE_ORDER.map((id) => getRecord(STORES.exerciseConfigs.name, id))
  );

  root.innerHTML = `
    <main class="setup">
      ${stepHeader(stepIndex, STEPS.length)}
      <h1>Review</h1>
      <ul class="review-list">
        ${exercises
          .map(
            (ex) => `
          <li>
            <div class="review-name">
              <span>${ex.name}</span>
              <span class="review-sets">${ex.targetSets}×${ex.targetReps}</span>
            </div>
            <div class="review-stats">
              ${ex.originalWeight} → ${ex.currentWeight} ${settings.units} (+${ex.increment}) ·
              bar ${ex.barWeight ?? settings.globalDefaultBarWeight} ·
              rest ${ex.restSecondsOverride ?? settings.globalDefaultRestSeconds}s
            </div>
          </li>`
          )
          .join('')}
      </ul>
      <p class="muted">First workout: ${settings.firstWorkoutChoice}</p>
      <div class="step-actions">
        <button type="button" id="back-btn" class="secondary-action">Back</button>
        <button type="button" id="finish-btn" class="primary-action">Finish Setup</button>
      </div>
    </main>
  `;

  document.getElementById('back-btn').addEventListener('click', () => goToStep(root, onComplete, -1));
  document.getElementById('finish-btn').addEventListener('click', async () => {
    await putRecord(STORES.appSettings.name, { ...settings, setupComplete: true });
    await onComplete();
  });
}
