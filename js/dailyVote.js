import { createWorkoutSession } from './session.js';

// The ritual gate before starting the proposed workout (spec §5).
// "Lift" creates the session snapshot; "Not today" exits without guilt or state change.
export function renderDailyVote(root, workoutType, settings, { onLift, onNotToday }) {
  root.innerHTML = `
    <main class="daily-vote">
      <h1>Lift or Die?</h1>
      <p class="muted">Next up: Workout ${workoutType}</p>
      <p class="error" id="vote-error" hidden></p>
      <div class="stacked-actions">
        <button id="lift-btn" class="primary-action">Lift</button>
        <button id="not-today-btn" class="secondary-action">Not today</button>
      </div>
    </main>
  `;

  const liftBtn = document.getElementById('lift-btn');
  liftBtn.addEventListener('click', async () => {
    liftBtn.disabled = true;
    const { session, error } = await createWorkoutSession(workoutType, settings);
    if (error) {
      liftBtn.disabled = false;
      const errEl = document.getElementById('vote-error');
      errEl.textContent = error;
      errEl.hidden = false;
      return;
    }
    onLift(session);
  });

  document.getElementById('not-today-btn').addEventListener('click', () => {
    root.innerHTML = `
      <main class="daily-vote">
        <h1>Fair enough.</h1>
        <p class="muted">We'll be here.</p>
        <button id="home-btn" class="primary-action">Home</button>
      </main>
    `;
    document.getElementById('home-btn').addEventListener('click', onNotToday);
  });
}
