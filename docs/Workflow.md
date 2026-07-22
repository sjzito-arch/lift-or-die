# Development Workflow

Use this loop for every slice.

1. Identify the current slice and its acceptance criteria.
2. Read only the relevant spec sections and source files.
3. Claude writes a short plan to `CURRENT-SLICE.md` (scope, files likely to change, acceptance checks, blockers) and summarizes it in chat.
4. The user approves or simplifies the plan when needed.
5. Claude implements only that slice, handling routine implementation, automated verification, documentation updates, and preview-server startup/cleanup itself.
6. Claude performs the smallest meaningful verification, using the app on the stable `localhost:8891` preview (`.claude/launch.json`) when a manual look is useful.
7. Claude checks `Definition-of-Done.md`.
8. Claude replaces the plan in `CURRENT-SLICE.md` with the final implementation report and a manual test checklist, and reports what changed, exact manual test steps, and any deviation in chat.
9. The user runs the manual acceptance test; Claude stops and waits here rather than assuming it passed.
10. Claude records the test result in `CURRENT-SLICE.md` and fixes observed problems before starting the next slice.

Do not bundle slices. Do not “improve” unrelated areas.

## When Claude stops and asks

Claude proceeds without repeatedly asking about routine implementation, automated checks, documentation updates, or server management. Claude stops and asks only for: a genuine product decision, a risky or hard-to-reverse action, or the user's manual acceptance test result.

## Short session opener

> Read CLAUDE.md and docs/Workflow.md. Determine the current slice from `CURRENT-SLICE.md` and the project state. Give me a brief plan for that slice only; do not code yet.

## Feedback loop

Describe observed behavior, action taken, expected behavior, and whether it reproduces. Gym observations outrank speculative improvements.

