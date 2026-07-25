# Lift or Die Style Guide v1.0

## Character

Calm, industrial, direct, lightly sarcastic. Like an experienced training partner who remembers the details and occasionally makes a dad joke. Never drill-sergeant, influencer, “bro,” or breathlessly motivational.

Personality intensity: about 4/10. One smile per workout is enough.

## Visual direction

Clean machined steel, not flames and skulls. Avoid neon fitness styling, glassmorphism, busy dashboards, decorative gradients, and cartoon muscles.

Suggested tokens (may be adjusted after contrast testing):

```css
--color-bg: #11161c;
--color-surface: #1a222c;
--color-surface-raised: #232e3a;
--color-text: #f3f6f8;
--color-text-muted: #aab5c0;
--color-primary: #4f86b5;
--color-action: #e58a2b;
--color-success: #45a36b;
--color-rest: #d3a43b;
--color-danger: #c85b5b;
--color-focus: #8fc8ff;
```

Use orange sparingly for immediate action/attention. Green means completed/ready, amber means resting, red is reserved for destructive or genuine error states.

## Typography

- Use the system font stack (`-apple-system`, BlinkMacSystemFont, `Segoe UI`, sans-serif).
- Exercise name: bold, large, short lines.
- Target weight/set count: visually dominant.
- Rest timer: largest numeric element during rest; tabular numerals.
- Body copy: at least 16px; no tiny utility text for essential actions.
- Use sentence case except compact labels where uppercase improves scanning.

## Layout and reach

- Mobile-first; primary target is portrait iPhone.
- Respect `env(safe-area-inset-*)`.
- The main action belongs in the lower thumb zone and should occupy a generous area.
- Minimum touch target 44×44 CSS px; primary Set Done target approximately 72px high or larger.
- Keep primary information above the action; do not require scrolling during a normal set/rest cycle.
- Secondary and destructive actions must be separated from Set Done.

## Components and states

### Set Done

Large, solid, unmistakable. On activation, immediately show pressed/saved feedback and prevent duplicate taps until persistence completes.

### Timer

Large numeric countdown. Amber while resting; transition to green and “Ready” at expiration. Animation must not be necessary to understand state.

### Rest cards

Muted raised surface below the timer. Short heading plus one or two short sentences. Next Tip is secondary. Cards never compete with timer size or contrast.

### Completion

Use restrained green confirmation, a brief summary, and at most one celebratory flourish. No confetti in V1.

### Errors

Plain language, localized near the problem, with Retry when relevant. Preserve entered data. Red communicates the issue; it does not dominate the whole screen.

## Motion and sound

- Minimal motion: short state fades/slides, approximately 150–250ms.
- Respect reduced-motion preferences.
- Subtle set confirmation and rest-finished chime/vibration only.
- No applause, shouting, air horns, or continuous animation.

## Voice

Writing is concise, warm, dry, and specific.

Good:

- “Set 3 saved. Rest.”
- “Gravity is reviewing the incident.”
- “Fair enough. We’ll be here.”
- “Add 35 lb to each side.”

Avoid:

- “YOU ARE A WARRIOR!!!”
- Guilt about missed workouts.
- Medical or longevity guarantees.
- Jokes during errors or data-loss risk.
- Different personalities between functional copy and cards.

## Daily ritual

Brand question: **Lift or Die?** Interaction choices remain positive: **Lift** and **Not today**. “Die” is framing, not a shaming action.

End ritual examples:

- “Today’s verdict: Lift wins.”
- “Another vote for Future You.”
- “Still alive. Nice work.”

Rotate sparingly.

## Distance readability (recording screens)

The ready-for-set, rest/overtime, and exercise-transition screens must stay legible from 2-5 feet, phone flat on the ground or propped on a gym bag, while lifting. This does not apply to Setup, History, Settings, or the post-workout completion review — those are read up close, standing still.

- Exercise name, target weight, per-side weight, the current instruction ("Begin Set N of M now."), the rest timer, and Set Done must all be sized for a glance from a few feet away, not arm's length.
- Per-side weight and any load-difference instruction ("Add/Remove N per side") are promoted to full contrast and a large size — they're actionable, not secondary, even though they were historically styled as muted context.
- Not everything gets bigger. Exercise counters ("Exercise 2 of 5"), target reps, and Undo/End Workout stay small and muted on purpose — the hierarchy depends on a handful of things being large and the rest receding, not on uniform enlargement.
- All numeric values on these screens (weight, set count, timer) use tabular numerals so digits don't shift width as they change.
- A screen change on these three screens must always start scrolled to the top.

## Accessibility basics

- Meet WCAG AA contrast for text and controls.
- Visible keyboard focus even though touch is primary.
- Do not communicate state by color alone.
- Controls have meaningful accessible names.
- Support text enlargement without clipping critical controls.
- Long press may be a shortcut, never the only route to partial reps.
- Prefer semantic HTML buttons, forms, headings, and navigation.
- Use an appropriate live region for set-state and timer-completion feedback without announcing every countdown second.
- Do not hide essential actions behind icon-only controls.
