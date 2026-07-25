import { getRecord, runAtomicTransaction, resetAllData } from './db.js';
import { STORES, EXERCISE_ORDER, CARD_CATEGORIES } from './schema.js';

function renderToggleCheckboxes(toggles) {
  return CARD_CATEGORIES.map(
    (c) => `
      <label class="checkbox-label">
        <input type="checkbox" name="toggle_${c.key}" ${toggles?.[c.key] ? 'checked' : ''}>
        ${c.label}
      </label>`
  ).join('');
}

function orderListMarkup(templateId, order, exerciseById) {
  return order
    .map(
      (exId, i) => `
    <li class="order-row" data-id="${exId}">
      <span>${exerciseById[exId]?.name ?? exId}</span>
      <div class="order-buttons">
        <button type="button" class="tertiary-action order-up" data-template="${templateId}" data-index="${i}" ${i === 0 ? 'disabled' : ''}>Up</button>
        <button type="button" class="tertiary-action order-down" data-template="${templateId}" data-index="${i}" ${i === order.length - 1 ? 'disabled' : ''}>Down</button>
      </div>
    </li>`
    )
    .join('');
}

// Settings (spec §14): one scrollable screen rather than a wizard — this is
// a revisit-and-tweak surface, not a first-time flow. A single Save commits
// every field at once; unsaved changes are tracked with a simple dirty flag
// (any input/change marks it) rather than a value-by-value diff.
export async function renderSettings(root, { onBack }) {
  const settings = await getRecord(STORES.appSettings.name, 'settings');
  const exercises = await Promise.all(EXERCISE_ORDER.map((id) => getRecord(STORES.exerciseConfigs.name, id)));
  const exerciseById = Object.fromEntries(exercises.map((ex) => [ex.id, ex]));
  const templateA = await getRecord(STORES.workoutTemplates.name, 'A');
  const templateB = await getRecord(STORES.workoutTemplates.name, 'B');

  let orderA = [...templateA.exerciseIds];
  let orderB = [...templateB.exerciseIds];
  let dirty = false;

  root.innerHTML = `
    <main class="settings">
      <h1>Settings</h1>

      <section class="settings-section">
        <h2>General</h2>
        <label>Units
          <select id="set-units">
            <option value="lb" ${settings.units === 'lb' ? 'selected' : ''}>Pounds (lb)</option>
            <option value="kg" ${settings.units === 'kg' ? 'selected' : ''}>Kilograms (kg)</option>
          </select>
        </label>
        <label>Program start date
          <input type="date" id="set-program-start" value="${settings.programStartDate ?? ''}">
        </label>
        <label>Humor level
          <select id="set-humor-level">
            <option value="off" ${settings.humorLevel === 'off' ? 'selected' : ''}>Off</option>
            <option value="light" ${settings.humorLevel === 'light' ? 'selected' : ''}>Light</option>
            <option value="mixed" ${settings.humorLevel === 'mixed' ? 'selected' : ''}>Mixed</option>
          </select>
        </label>
        <label>Personal motivation (optional)
          <textarea id="set-motivation" rows="2">${settings.motivation ?? ''}</textarea>
        </label>
        <label>Default bar weight
          <input type="number" id="set-global-bar" value="${settings.globalDefaultBarWeight}" min="0" step="0.5">
        </label>
        <label>Default rest (seconds)
          <input type="number" id="set-global-rest" value="${settings.globalDefaultRestSeconds}" min="0" step="5">
        </label>
        <fieldset>
          <legend>Rest card categories</legend>
          ${renderToggleCheckboxes(settings.cardCategoryToggles)}
        </fieldset>
      </section>

      <section class="settings-section">
        <h2>Workout A order</h2>
        <ul class="order-list" id="order-list-A">${orderListMarkup('A', orderA, exerciseById)}</ul>
      </section>

      <section class="settings-section">
        <h2>Workout B order</h2>
        <ul class="order-list" id="order-list-B">${orderListMarkup('B', orderB, exerciseById)}</ul>
      </section>

      <section class="settings-section">
        <h2>Exercises</h2>
        ${exercises
          .map(
            (ex) => `
          <div class="settings-exercise" data-exercise-id="${ex.id}">
            <label>Name
              <input type="text" id="ex-${ex.id}-name" value="${ex.name}">
            </label>
            <label>Original starting weight
              <input type="number" id="ex-${ex.id}-originalWeight" value="${ex.originalWeight ?? ''}" min="0" step="0.5">
            </label>
            <label>Current working weight
              <input type="number" id="ex-${ex.id}-currentWeight" value="${ex.currentWeight ?? ''}" min="0" step="0.5">
            </label>
            <label>Weight increment
              <input type="number" id="ex-${ex.id}-increment" value="${ex.increment ?? ''}" min="0" step="0.5">
            </label>
            <label>Bar weight (blank uses default of ${settings.globalDefaultBarWeight})
              <input type="number" id="ex-${ex.id}-barWeight" value="${ex.barWeight ?? ''}" min="0" step="0.5">
            </label>
            <label>Rest seconds (blank uses default of ${settings.globalDefaultRestSeconds})
              <input type="number" id="ex-${ex.id}-restSecondsOverride" value="${ex.restSecondsOverride ?? ''}" min="0" step="5">
            </label>
            <label>Target sets
              <input type="number" id="ex-${ex.id}-targetSets" value="${ex.targetSets}" min="1" step="1">
            </label>
            <label>Target reps
              <input type="number" id="ex-${ex.id}-targetReps" value="${ex.targetReps}" min="1" step="1">
            </label>
          </div>`
          )
          .join('')}
      </section>

      <p class="error" id="settings-error" hidden></p>

      <div class="stacked-actions">
        <button id="settings-save-btn" class="primary-action">Save</button>
        <button id="settings-back-btn" class="secondary-action">Back</button>
      </div>
      <div id="settings-discard-confirm" class="discard-panel" hidden>
        <p>Discard unsaved changes?</p>
        <div class="step-actions">
          <button id="settings-discard-cancel" class="secondary-action">Keep Editing</button>
          <button id="settings-discard-confirm-btn" class="primary-action">Discard</button>
        </div>
      </div>

      <div class="reset-all-section">
        <button id="reset-all-btn" class="tertiary-action">Reset all data</button>
        <div id="reset-all-confirm" class="discard-panel" hidden>
          <p>This permanently erases every setting, exercise weight, workout history, and progress on this device, and cannot be undone.</p>
          <p class="error" id="reset-all-error" hidden></p>
          <div class="step-actions">
            <button id="reset-all-cancel" class="secondary-action">Cancel</button>
            <button id="reset-all-confirm-btn" class="primary-action">Erase Everything</button>
          </div>
        </div>
      </div>
    </main>
  `;

  root.addEventListener('input', () => { dirty = true; }, { once: false });
  root.addEventListener('change', () => { dirty = true; }, { once: false });

  function rerenderOrderList(templateId) {
    const order = templateId === 'A' ? orderA : orderB;
    const el = document.getElementById(`order-list-${templateId}`);
    el.innerHTML = orderListMarkup(templateId, order, exerciseById);
    attachOrderHandlers(templateId);
  }

  function attachOrderHandlers(templateId) {
    const el = document.getElementById(`order-list-${templateId}`);
    el.querySelectorAll('.order-up').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.index);
        const order = templateId === 'A' ? orderA : orderB;
        [order[i - 1], order[i]] = [order[i], order[i - 1]];
        dirty = true;
        rerenderOrderList(templateId);
      });
    });
    el.querySelectorAll('.order-down').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.index);
        const order = templateId === 'A' ? orderA : orderB;
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
        dirty = true;
        rerenderOrderList(templateId);
      });
    });
  }

  attachOrderHandlers('A');
  attachOrderHandlers('B');

  document.getElementById('settings-back-btn').addEventListener('click', () => {
    if (dirty) {
      document.getElementById('settings-discard-confirm').hidden = false;
    } else {
      onBack();
    }
  });
  document.getElementById('settings-discard-cancel').addEventListener('click', () => {
    document.getElementById('settings-discard-confirm').hidden = true;
  });
  document.getElementById('settings-discard-confirm-btn').addEventListener('click', onBack);

  document.getElementById('settings-save-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('settings-error');
    errEl.hidden = true;

    const globalBar = Number(document.getElementById('set-global-bar').value);
    const globalRest = Number(document.getElementById('set-global-rest').value);
    const programStartDate = document.getElementById('set-program-start').value;

    const toggles = {};
    for (const c of CARD_CATEGORIES) {
      toggles[c.key] = document.querySelector(`[name="toggle_${c.key}"]`).checked;
    }

    if (!programStartDate || Number.isNaN(globalBar) || globalBar < 0 || Number.isNaN(globalRest) || globalRest < 0) {
      e.target.disabled = false;
      errEl.textContent = 'Please fill in all general fields with valid values.';
      errEl.hidden = false;
      return;
    }

    const updatedExercises = [];
    for (const ex of exercises) {
      const name = document.getElementById(`ex-${ex.id}-name`).value.trim();
      const originalWeight = Number(document.getElementById(`ex-${ex.id}-originalWeight`).value);
      const currentWeight = Number(document.getElementById(`ex-${ex.id}-currentWeight`).value);
      const increment = Number(document.getElementById(`ex-${ex.id}-increment`).value);
      const barRaw = document.getElementById(`ex-${ex.id}-barWeight`).value;
      const restRaw = document.getElementById(`ex-${ex.id}-restSecondsOverride`).value;
      const targetSets = parseInt(document.getElementById(`ex-${ex.id}-targetSets`).value, 10);
      const targetReps = parseInt(document.getElementById(`ex-${ex.id}-targetReps`).value, 10);

      const validNumbers = [originalWeight, currentWeight, increment].every((n) => !Number.isNaN(n) && n >= 0);
      const validTargets = Number.isInteger(targetSets) && targetSets > 0 && Number.isInteger(targetReps) && targetReps > 0;
      if (!name || !validNumbers || !validTargets) {
        e.target.disabled = false;
        errEl.textContent = `Please enter valid, non-negative values for ${ex.name || 'every exercise'}.`;
        errEl.hidden = false;
        return;
      }

      updatedExercises.push({
        ...ex,
        name,
        originalWeight,
        currentWeight,
        increment,
        barWeight: barRaw ? Number(barRaw) : null,
        restSecondsOverride: restRaw ? Number(restRaw) : null,
        targetSets,
        targetReps,
      });
    }

    // One atomic transaction across all three affected stores: a failure
    // partway through (e.g. the 3rd of 5 exercise writes) must not leave
    // settings or some exercises updated while others aren't.
    try {
      await runAtomicTransaction(
        [STORES.appSettings.name, STORES.exerciseConfigs.name, STORES.workoutTemplates.name],
        (stores) => {
          stores[STORES.appSettings.name].put({
            ...settings,
            units: document.getElementById('set-units').value,
            programStartDate,
            humorLevel: document.getElementById('set-humor-level').value,
            motivation: document.getElementById('set-motivation').value.trim(),
            globalDefaultBarWeight: globalBar,
            globalDefaultRestSeconds: globalRest,
            cardCategoryToggles: toggles,
          });
          for (const ex of updatedExercises) {
            stores[STORES.exerciseConfigs.name].put(ex);
          }
          stores[STORES.workoutTemplates.name].put({ ...templateA, exerciseIds: orderA });
          stores[STORES.workoutTemplates.name].put({ ...templateB, exerciseIds: orderB });
        }
      );
      dirty = false;
      onBack();
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not save settings. Check your storage and try again.';
      errEl.hidden = false;
    }
  });

  document.getElementById('reset-all-btn').addEventListener('click', () => {
    document.getElementById('reset-all-confirm').hidden = false;
  });
  document.getElementById('reset-all-cancel').addEventListener('click', () => {
    document.getElementById('reset-all-confirm').hidden = true;
  });
  document.getElementById('reset-all-confirm-btn').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const errEl = document.getElementById('reset-all-error');
    errEl.hidden = true;
    try {
      await resetAllData();
      window.location.reload();
    } catch (err) {
      e.target.disabled = false;
      errEl.textContent = 'Could not reset data. Check your storage and try again.';
      errEl.hidden = false;
    }
  });
}
