import { renderActiveExercise } from './activeExercise.js';
import { renderRestScreen } from './rest.js';
import { renderExerciseCompleteScreen, renderAllExercisesDoneScreen } from './exerciseTransition.js';

// Which of the four active-workout screens to show is always derived from
// the session's own data (current exercise's recorded sets vs its target,
// and whether it's resting) — never from a separately stored "current
// screen" flag. That's what lets a reload restore the exact right screen
// without any risk of duplicating a transition (spec §12).
export function renderWorkoutScreen(root, session, settings, callbacks) {
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const isLastExercise = index === session.exerciseResults.length - 1;
  const isExerciseComplete = exercise.setResults.length >= exercise.targetSets;
  // Resting covers both the counting-down and post-expiry overtime states —
  // rest.js itself decides which to show. Only a cleared restEndsAt (via
  // Skip Rest, Undo, or an exercise-ending recordSet) exits this screen.
  const isResting = !isExerciseComplete && exercise.restEndsAt != null;

  const rerender = (updatedSession) => renderWorkoutScreen(root, updatedSession, settings, callbacks);
  const screenCallbacks = { ...callbacks, rerender };

  if (isResting) {
    renderRestScreen(root, session, settings, screenCallbacks);
    return;
  }

  if (!isExerciseComplete) {
    renderActiveExercise(root, session, settings, screenCallbacks);
    return;
  }

  if (isLastExercise) {
    renderAllExercisesDoneScreen(root, session, settings, screenCallbacks);
  } else {
    renderExerciseCompleteScreen(root, session, settings, screenCallbacks);
  }
}
