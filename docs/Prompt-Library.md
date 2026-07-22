# Claude Prompt Library

Copy only the prompt needed. Replace bracketed text.

## First project review

> Read CLAUDE.md and the files in docs. Do not write code. Summarize the V1 purpose, scope, build slices, and any contradiction that blocks Slice 1. Do not propose new features.

## Plan one slice

> Plan Slice [number/name] only. Keep the plan brief. State acceptance criteria, likely files changed, smallest useful verification, and any blocking decision. Do not code yet.

## Implement approved slice

> Implement the approved plan for Slice [number/name] only. Follow CLAUDE.md and Definition-of-Done.md. Make focused edits, verify the result, update Architecture.md or CHANGELOG.md only when warranted, then stop with manual test steps.

## Continue after interruption

> Inspect the current project state and continue only the unfinished work in Slice [number/name]. Do not redo completed work or start the next slice. Briefly state what remains before editing.

## Fix one bug

> Fix this bug only: [observed behavior]. Steps: [steps]. Expected: [expected]. Preserve unrelated behavior. First identify the likely cause briefly, then make the smallest safe fix and tell me how to retest it.

## Review without changing

> Review [screen/flow/files] against the product spec and style guide. Do not edit code. Report only concrete issues that affect the personal gym workflow, ordered by impact. Do not propose extra features.

## UI/UX Pro Max review

> Use UI/UX Pro Max as a review aid, not product owner. Preserve the specified workflow and restrained industrial style. Review hierarchy, thumb reach, touch targets, contrast, text scaling, safe areas, and state clarity. Do not add screens, dashboards, gradients, glass effects, or new features.

## Explain a technical proposal

> Explain this proposal in plain language: [proposal]. Tell me the immediate V1 benefit, cost, simpler alternative, and whether it is needed before gym testing. Do not implement it.

## Targeted refactor

> Refactor only [specific area] to solve [specific current problem]. Preserve behavior. Do not introduce abstractions for hypothetical future needs. Show the verification result and stop.

## Prepare phone test

> Give me a short, nontechnical checklist to test [slice/flow] on my iPhone. Include setup, exact taps, expected result, and what observations to record. Do not change code.

## End-of-slice checkpoint

> Check the current slice against Definition-of-Done.md. List pass/fail/not-applicable briefly. Fix nothing yet. If it passes, give me a compact checkpoint summary I can use in a new session.

