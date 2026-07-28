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

// Carries the progression implication so the result reads as "what happens
// next," not just pass/fail. Short, command-style copy: no trailing period,
// joined with an em dash rather than a mid-string period (Style Guide's
// short-copy punctuation rule). No exclamation points — this repeats once
// per exercise (up to 5 times on the Workout Complete screen), and the app
// reserves its one celebratory flourish for the single workout summary
// screen, not every individual card. Reflects Easy's doubled increment when
// set, since the suggested weight itself changes accordingly.
export function formatResultText(exercise, units) {
  if (!exercise.success) return 'Not every set hit target — same weight next time';
  const increment = exercise.increment * (exercise.easy ? 2 : 1);
  return `All sets hit target — adding ${increment} ${units} next time`;
}
