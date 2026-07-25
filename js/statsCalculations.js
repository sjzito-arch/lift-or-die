// Total volume = reps × weight, summed across every recorded set of every
// exercise (spec §11/§13). Weight is constant per exercise within a session
// (the bar isn't reloaded set-to-set in this program), so summing recorded
// reps and multiplying once per exercise is equivalent to summing per set.
export function computeWorkoutVolume(exerciseResults) {
  return exerciseResults.reduce((total, ex) => {
    const repsTotal = ex.setResults.reduce((sum, set) => sum + set.reps, 0);
    return total + repsTotal * ex.targetWeight;
  }, 0);
}

// A single restrained, canned humorous headline (spec §11: "at most one
// humorous headline"; examples per §16/style guide). This is intentionally
// minimal — the full rest-card system (categories, no-repeat-in-workout,
// personalized cards) is Slice 8, not reproduced here.
const HUMOR_HEADLINES = [
  'Sexy is as sexy lifts.',
  'Gravity is reviewing the incident.',
  'The barbell has filed another complaint.',
];

export function pickHumorousHeadline(humorLevel) {
  if (humorLevel === 'off') return null;
  return HUMOR_HEADLINES[Math.floor(Math.random() * HUMOR_HEADLINES.length)];
}

// Shared exercise-result formatting, used on exercise transition, the
// workout completion review, and History detail.
export function formatSetSummary(exercise) {
  return exercise.setResults
    .map((s) => `Set ${s.setNumber}: ${s.reps}${s.reps < exercise.targetReps ? ' (short)' : ''}`)
    .join(' · ');
}

// Carries the progression implication so the result reads as "what happens
// next," not just pass/fail. No exclamation points here — this repeats once
// per exercise (up to 5 times on the Workout Complete screen), and the app
// reserves its one celebratory flourish for the single workout summary
// screen, not every individual card.
export function formatResultText(exercise, units) {
  return exercise.success
    ? `All sets hit target. Adding ${exercise.increment} ${units} next time.`
    : 'Not every set hit target. Same weight next time.';
}

// A row of per-set result chips (Exercise Complete / Workout Complete): a
// hit is a plain checkmark (the rep count is already known from the target,
// so restating it is redundant); a miss shows the actual rep count instead,
// styled as a neutral outline rather than a warning color — this app never
// shames a missed set, so red is deliberately avoided here.
export function setChipsMarkup(exercise) {
  return `<div class="set-chips">${exercise.setResults
    .map((s) =>
      s.reps >= exercise.targetReps
        ? `<div class="set-chip set-chip--hit">&#10003;</div>`
        : `<div class="set-chip set-chip--miss">${s.reps}</div>`
    )
    .join('')}</div>`;
}
