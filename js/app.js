import { getRecord } from './db.js';
import { renderSetupStep } from './setup.js';
import { STORES } from './schema.js';

const root = document.getElementById('app');

async function boot() {
  const settings = await getRecord(STORES.appSettings.name, 'settings');

  if (!settings || !settings.setupComplete) {
    await renderSetupStep(root, boot);
  } else {
    await renderHome(settings);
  }
}

async function renderHome(settings) {
  const template = await getRecord(STORES.workoutTemplates.name, settings.firstWorkoutChoice);
  const exercises = await Promise.all(
    (template?.exerciseIds ?? []).map((id) => getRecord(STORES.exerciseConfigs.name, id))
  );

  root.innerHTML = `
    <main class="home">
      <h1>Lift or Die</h1>
      <p class="muted">Next workout: ${settings.firstWorkoutChoice}</p>
      <ul class="exercise-list">
        ${exercises
          .map(
            (ex) => `
          <li>
            <span class="exercise-name">${ex.name}</span>
            <span class="exercise-weight">${ex.currentWeight != null ? ex.currentWeight + ' ' + settings.units : 'not set'}</span>
          </li>`
          )
          .join('')}
      </ul>
      <p class="muted">Program start: ${settings.programStartDate ?? 'not set'}</p>
    </main>
  `;
}

boot();
