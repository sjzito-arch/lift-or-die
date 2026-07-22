# Development Workflow

Use this loop for every slice.

1. Identify the current slice and its acceptance criteria.
2. Read only the relevant spec sections and source files.
3. Claude gives a short plan and names likely changed files.
4. The user approves or simplifies the plan when needed.
5. Claude implements only that slice.
6. Claude performs the smallest meaningful verification.
7. Claude checks `Definition-of-Done.md`.
8. Claude reports what changed, exact manual test steps, and any deviation.
9. The user tests on phone as soon as the flow is usable.
10. Fix observed problems before starting the next slice.

Do not bundle slices. Do not “improve” unrelated areas.

## Short session opener

> Read CLAUDE.md and docs/Workflow.md. Determine the current slice from the project state. Give me a brief plan for that slice only; do not code yet.

## Feedback loop

Describe observed behavior, action taken, expected behavior, and whether it reproduces. Gym observations outrank speculative improvements.

