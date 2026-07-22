# Definition of Done

A slice is done when every applicable item is true or an exception is explicitly documented.

## Scope

- Implements only the approved slice.
- Meets its product-spec acceptance behavior.
- Adds no unapproved feature, dependency, or redesign.
- Contains no unrelated refactor.

## Behavior and data

- Primary happy path works manually.
- Relevant error, empty, accidental-tap, and interruption cases are checked.
- Completed and intentionally saved-incomplete workout behavior is checked when applicable.
- User data is preserved across refresh/reopen where required.
- Duplicate actions do not create duplicate sets, workouts, or progression.
- Destructive actions are confirmed and recoverable where specified.

## Interface

- Primary action and current state are obvious on a phone-sized screen.
- Touch targets and contrast follow the style guide.
- No critical action depends only on long press, color, animation, or swipe.
- No horizontal overflow or safe-area obstruction.
- The Home screen clearly exposes the next workout and primary next action when included in the slice.

## Quality

- App launches without console errors caused by the slice.
- Existing completed flows still work.
- Relevant automated checks pass if they exist; automation is not required before it adds value.
- Significant architecture decisions are recorded.
- User-visible completed work is added to the changelog.

## Handoff

Claude provides:

- A concise change summary.
- Exact manual test steps.
- Files changed.
- Known limitations or spec deviations.
- A clear stop; the next slice is not started automatically.
