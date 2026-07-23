# Development Workflow

Use this loop for every slice or milestone (a milestone is a set of slices the user explicitly assigns together, e.g. "implement Slices 4 and 5 as one milestone").

1. Identify the current slice(s) or milestone and its acceptance criteria.
2. Read only the relevant spec sections and source files.
3. Claude writes a short plan to `CURRENT-SLICE.md` (scope, files likely to change, acceptance checks, blockers).
4. For routine, already-assigned work, Claude proceeds directly into implementation without waiting for the plan to be approved — the plan is recorded, not submitted for permission. Claude pauses here only if the user asked for a plan-first review, or if planning surfaced a genuine product decision or an unresolved contradiction in the spec/docs/code.
5. Claude implements the assigned scope only, handling routine implementation, automated verification, documentation updates, and preview-server startup/cleanup itself.
6. Claude performs the smallest meaningful verification, reusing the running stable `localhost:8891` preview (`.claude/launch.json`) rather than restarting it, and grouping related checks together to minimize interruptions.
7. Claude checks `Definition-of-Done.md`.
8. Claude keeps `CURRENT-SLICE.md` current throughout, then replaces the plan with the final implementation report and a manual test checklist once work is verified.
9. Claude commits the completed, documented work once checks pass, without waiting for a separate go-ahead on routine or milestone work.
10. Claude reports what changed, exact manual test steps, and any deviation in chat, and stops for the user's manual acceptance test rather than assuming it passed.
11. Claude records the test result in `CURRENT-SLICE.md` and fixes observed problems before starting the next slice or milestone.

Do not bundle unrequested slices together. Do not “improve” unrelated areas.

## When Claude stops and asks

Claude proceeds through planning, implementation, verification, documentation, and committing without pausing for approval between steps on routine or explicitly assigned milestone work, and without relaying intermediate plans or reports for permission. Claude stops and asks only for: a genuine product decision, a destructive or hard-to-reverse action, an unresolved contradiction between the spec/docs/code, or the user's manual acceptance test result.

Claude minimizes permission prompts by reusing the existing `.claude/launch.json` preview server instead of restarting it and by grouping related safe checks together. Claude does not install tools or dependencies, use network access, or modify files outside this project directory without asking first.

## Short session opener

> Read CLAUDE.md and docs/Workflow.md. Determine the current slice from `CURRENT-SLICE.md` and the project state. Give me a brief plan for that slice only; do not code yet.

## Feedback loop

Describe observed behavior, action taken, expected behavior, and whether it reproduces. Gym observations outrank speculative improvements.

