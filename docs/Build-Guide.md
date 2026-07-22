# Lift or Die — Plain-English Claude Build Guide

This guide is for someone who is not a professional developer. Do not ask Claude to build the entire app in one prompt.

## What you need

- A computer with Claude Code available.
- A modern browser.
- An iPhone for real testing.
- This unzipped project kit.
- Optional: UI/UX Pro Max for interface design and review.

## Before coding

1. Unzip this kit into a folder named `lift-or-die`.
2. Open that folder as the project in Claude Code.
3. If desired, install UI/UX Pro Max. It is optional and used only for UI design/review.
4. Give Claude the “First project review” prompt from `Prompt-Library.md`.
5. Resolve only decisions that truly block Slice 1.

Your starting folder should look like this:

```text
lift-or-die/
  CLAUDE.md
  CHANGELOG.md
  README.md
  docs/
    Product-Spec-v1.0.md
    Style-Guide-v1.0.md
    Build-Guide.md
    Workflow.md
    Architecture.md
    Definition-of-Done.md
    Prompt-Library.md
    Gym-Test-Notes.md
```

Claude will create the actual application files later.

## First conversation with Claude

Use the “First project review” prompt in `Prompt-Library.md`. Claude should explain the purpose, scope, UX rules, slices, and actual blockers without writing code or proposing commercial features.

Then use “Plan one slice” for Slice 1. The plan should explain in plain language:

- Proposed application file structure.
- Main data objects.
- How active-workout recovery will work.
- How the architecture stays simple for a personal V1.
- Manual tests for the slice.

If the plan sounds like a corporate system, ask Claude to simplify it before approving.

## Build loop

For each slice:

1. Use the “Plan one slice” prompt.
2. Read the plan. If it adds extras, tell Claude to simplify it.
3. Approve the plan and use “Implement approved slice.”
4. Follow Claude’s manual test steps on the computer.
5. Fix only reproducible problems.
6. Once the main workout flow exists, install it on your iPhone and test there.
7. Record real observations in `Gym-Test-Notes.md`.
8. Do not start the next slice until the current one is usable.

For Slice 1, check the plumbing rather than the appearance:

- The app opens without errors.
- Basic navigation appears.
- Default Workout A and B definitions exist.
- Settings persist after refresh.
- The active-workout record can be restored.
- Reopening setup does not create duplicate exercises.

Report a bug with the exact action, result, expected result, and whether it repeats. Example:

> I changed the bar weight to 35 lb. After refreshing, it returned to 45 lb. Diagnose and fix only this persistence problem, then give me the same test again.

“It doesn’t work” forces Claude to guess and wastes usage.

## The slices

1. App shell, setup, data schema, persistence.
2. Daily Vote and workout creation/resume.
3. Active exercise, Set Done, partial set, undo.
4. Rest timer and interruption recovery.
5. Exercise transitions and per-side calculations.
6. Completion, progression, history.
7. Settings and completed-workout correction.
8. Rest cards, personality, visual polish.
9. Offline install and iPhone gym trial.

## Using UI/UX Pro Max

Install it before visual polish, not before the documents are reviewed. Use the UI/UX review prompt in `Prompt-Library.md`.

Ask for design tokens and low-fidelity layouts for Home, Daily Vote, Active Workout, Rest, Exercise Transition, Summary, History, and Settings. Review those layouts before Claude polishes the screens. The skill is a consultant; it cannot add features or redefine the flow.

## What you should watch for

- Can you always tell which set is next?
- Can you hit Set Done easily without careful aiming?
- Does a double tap record only once?
- Does the timer recover correctly after checking another app?
- Does closing and reopening resume safely?
- Are weights and per-side loads instantly understandable?
- Does humor help, or get in the way?

## Usage-saving habits

- Keep requests limited to one slice or one bug.
- Let Claude inspect project files; do not paste them back into chat.
- Ask for concise plans and reports.
- Do not request repeated full-project reviews.
- Do not regenerate complete files unless necessary.
- Start a new Claude session only when context becomes unwieldy; use the last checkpoint summary.

## When V1 is ready for the gym

You do not need every slice. Start phone testing when you can create a workout, complete sets, see/rest the timer, transition exercises, and recover after reopening. History and richer cards can follow.

Open the app on the iPhone and add it to the Home Screen as soon as installation is available. Try it during a real workout. Record observations such as “I could not see the set number quickly” instead of immediately prescribing a new feature.

## After several workouts

Group observations into:

- Blocks the workout.
- Repeated friction.
- Nice idea, unproven.

Fix the first group, then the second. Do not build the third group until repeated real use supports it.

Promote an idea to V1.1 only when the same problem happens more than once, it causes a serious workout failure, or the correction is extremely small and obviously useful.

## Troubleshooting checklist

When something fails, provide Claude:

- The exact error message, if any.
- What you tapped or changed.
- What you expected.
- What actually happened.
- Whether refresh/reopen changes the result.
- A request to fix only that problem.

Do not request a whole-project rewrite unless the foundation is genuinely broken.
