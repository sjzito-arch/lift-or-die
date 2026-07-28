// One reusable set-progression row, used identically everywhere a set-by-set
// result needs to be shown (active exercise, rest, exercise-transition,
// workout completion, history detail) — a single implementation so all five
// screens can never drift out of sync with each other.
//
// State is purely derived from `setResults.length` vs `targetSets`/`targetReps`
// (same data-driven principle as the screen dispatcher, ADR-009), so calling
// this after any mutation (Set Done, Partial Set, Undo) always reflects the
// current truth with no separate "which box is current" bookkeeping.
//
// Color is never the only signal: a hit is a checkmark, a miss shows its own
// rep count, and current vs. future differ in fill weight, not just tone —
// each box also carries an aria-label describing its state for screen readers,
// since the current/future boxes are intentionally blank on-screen.
export function setProgressionMarkup(exercise) {
  const recorded = exercise.setResults.length;
  const boxes = [];

  for (let i = 1; i <= exercise.targetSets; i++) {
    if (i <= recorded) {
      const reps = exercise.setResults[i - 1].reps;
      const hit = reps >= exercise.targetReps;
      boxes.push(
        hit
          ? `<span class="set-chip set-chip--hit" role="img" aria-label="Set ${i}: hit target">&#10003;</span>`
          : `<span class="set-chip set-chip--miss" role="img" aria-label="Set ${i}: ${reps} of ${exercise.targetReps} reps">${reps}</span>`
      );
    } else if (i === recorded + 1) {
      boxes.push(`<span class="set-chip set-chip--current" role="img" aria-label="Set ${i}: current set"></span>`);
    } else {
      boxes.push(`<span class="set-chip set-chip--future" role="img" aria-label="Set ${i}: not yet started"></span>`);
    }
  }

  return `<div class="set-progression" role="group" aria-label="Set progress: ${recorded} of ${exercise.targetSets} sets recorded">${boxes.join('')}</div>`;
}
