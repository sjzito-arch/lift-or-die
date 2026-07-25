import { getRecord, getAllRecords } from './db.js';
import { renderSetupStep } from './setup.js';
import { STORES } from './schema.js';
import { getActiveSession, createWorkoutSession, endWorkoutControlMarkup, attachEndWorkoutHandlers } from './session.js';
import { renderWorkoutScreen } from './workoutScreen.js';
import { renderHistoryList } from './history.js';
import { renderSettings } from './settings.js';
import { releaseWakeLock } from './wakeLock.js';

const root = document.getElementById('app');

async function boot() {
  const settings = await getRecord(STORES.appSettings.name, 'settings');

  if (!settings || !settings.setupComplete) {
    await renderSetupStep(root, boot);
  } else {
    await renderHome();
  }
}

// Alternation is derived here at read time, not stored: the next proposal
// is always the opposite of the most recently *completed* workout, falling
// back to the setup-time preference until a first workout exists (spec §3,
// §6). A Change Workout override (below) is session-local and never
// touches this derivation or `firstWorkoutChoice`.
async function getMostRecentCompletedWorkout() {
  const workouts = await getAllRecords(STORES.storedWorkouts.name);
  const completed = workouts.filter((w) => w.status === 'completed');
  completed.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return completed[0] ?? null;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Always re-fetches settings fresh rather than accepting one from the
// caller: a workout that just completed may have changed `lifetimeVotes`
// (and, via Settings in a later slice, anything else), and Home is exactly
// the screen that display-reflects that mutation immediately afterward.
async function renderHome(overrideType) {
  // Home is reachable only once an active workout has ended (Discard, Save
  // as Incomplete, Complete Workout) or the user has stepped away from it via
  // History/Settings — either way, the screen wake lock from the recording
  // screens is no longer wanted.
  releaseWakeLock();
  const settings = await getRecord(STORES.appSettings.name, 'settings');
  const activeSession = await getActiveSession();
  const mostRecentCompleted = await getMostRecentCompletedWorkout();
  const defaultProposal = mostRecentCompleted
    ? (mostRecentCompleted.type === 'A' ? 'B' : 'A')
    : settings.firstWorkoutChoice;
  const proposedType = overrideType ?? defaultProposal;
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
      <p class="muted">${mostRecentCompleted ? `Last workout: ${formatDate(mostRecentCompleted.startedAt)}` : 'No completed workouts yet'}</p>
      <p class="muted">Lifetime votes for Future You: ${settings.lifetimeVotes ?? 0}</p>
      <div class="stacked-actions">
        ${
          activeSession
            ? `<button id="resume-btn" class="primary-action">Resume Workout</button>${endWorkoutControlMarkup(activeSession)}`
            : `<button id="lift-btn" class="primary-action">
                 <span class="btn-headline">Lift?</span>
                 <span class="btn-subtext">(Start Workout)</span>
               </button>
               <button id="die-btn" class="secondary-action">
                 <span class="btn-headline">Die?</span>
                 <span class="btn-subtext">(maybe later)</span>
               </button>
               <p class="error" id="lift-error" hidden></p>
               <button id="change-workout-btn" class="tertiary-action">Change Workout (use ${otherType})</button>`
        }
      </div>
      <div class="stacked-actions">
        <button id="history-btn" class="secondary-action">History</button>
        <button id="settings-btn" class="secondary-action">Settings</button>
      </div>
    </main>
  `;

  document.getElementById('history-btn').addEventListener('click', () => {
    renderHistoryList(root, settings, { onBack: () => renderHome() });
  });
  document.getElementById('settings-btn').addEventListener('click', () => {
    renderSettings(root, { onBack: () => renderHome() });
  });

  if (activeSession) {
    document.getElementById('resume-btn').addEventListener('click', () => {
      renderWorkoutScreen(root, activeSession, settings, {
        onSessionEnded: () => renderHome(),
      });
    });
    attachEndWorkoutHandlers(activeSession, () => renderHome());
  } else {
    const liftBtn = document.getElementById('lift-btn');
    liftBtn.addEventListener('click', async () => {
      liftBtn.disabled = true;
      const { session, error } = await createWorkoutSession(proposedType, settings);
      if (error) {
        liftBtn.disabled = false;
        const errEl = document.getElementById('lift-error');
        errEl.textContent = error;
        errEl.hidden = false;
        return;
      }
      renderWorkoutScreen(root, session, settings, {
        onSessionEnded: () => renderHome(),
      });
    });
    document.getElementById('die-btn').addEventListener('click', () => {
      renderFarewell();
    });
    document.getElementById('change-workout-btn').addEventListener('click', () => {
      renderHome(otherType);
    });
  }

  // The daily ritual's "no" path — same copy as before, now surfaced
  // directly from Home instead of a separate screen. Changes no state.
  function renderFarewell() {
    root.innerHTML = `
      <main class="home">
        <h1>Fair enough.</h1>
        <p class="muted">We'll be here.</p>
        <button id="farewell-home-btn" class="primary-action">Home</button>
      </main>
    `;
    document.getElementById('farewell-home-btn').addEventListener('click', () => renderHome());
  }
}

boot();
