import { getRecord } from './db.js';
import { renderSetupStep } from './setup.js';
import { STORES } from './schema.js';
import { renderDailyVote } from './dailyVote.js';
import { getActiveSession, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { renderActiveExercise } from './activeExercise.js';

const root = document.getElementById('app');

async function boot() {
  const settings = await getRecord(STORES.appSettings.name, 'settings');

  if (!settings || !settings.setupComplete) {
    await renderSetupStep(root, boot);
  } else {
    await renderHome(settings);
  }
}

async function renderHome(settings, overrideType) {
  const activeSession = await getActiveSession();
  const proposedType = overrideType ?? settings.firstWorkoutChoice;
  const otherType = proposedType === 'A' ? 'B' : 'A';
  const template = await getRecord(STORES.workoutTemplates.name, proposedType);
  const exercises = await Promise.all(
    (template?.exerciseIds ?? []).map((id) => getRecord(STORES.exerciseConfigs.name, id))
  );

  root.innerHTML = `
    <main class="home">
      <h1>Lift or Die</h1>
      <p class="muted">Next workout: ${proposedType}</p>
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
      <div class="stacked-actions">
        ${
          activeSession
            ? `<button id="resume-btn" class="primary-action">Resume Workout</button>${endWorkoutControlMarkup(activeSession)}`
            : `<button id="start-btn" class="primary-action">Start Workout</button>
               <button id="change-workout-btn" class="tertiary-action">Change Workout (use ${otherType})</button>`
        }
      </div>
    </main>
  `;

  if (activeSession) {
    document.getElementById('resume-btn').addEventListener('click', () => {
      renderActiveExercise(root, activeSession, settings, {
        onSessionEnded: () => renderHome(settings),
      });
    });
    attachEndWorkoutHandlers(activeSession, () => renderHome(settings));
  } else {
    document.getElementById('start-btn').addEventListener('click', () => {
      renderDailyVote(root, proposedType, settings, {
        onLift: (session) => {
          renderActiveExercise(root, session, settings, {
            onSessionEnded: () => renderHome(settings),
          });
        },
        onNotToday: () => renderHome(settings),
      });
    });
    document.getElementById('change-workout-btn').addEventListener('click', () => {
      renderHome(settings, otherType);
    });
  }
}

boot();
