# Lift or Die Product Specification v1.0

Status: implementation baseline for personal gym testing  
Audience: one user, iPhone PWA  
Product owner: the user

## 1. Product statement

Lift or Die is a fast, offline workout companion for simple strength programs. It tracks the current set, runs rest periods, calculates the load on each side of a bar, saves workout history, and uses useful or funny rest cards to keep gym time from becoming tedious.

Success means the user spends almost no mental energy operating the app and leaves the gym willing to return.

## 2. Soul and values

Consistency beats complexity. Fundamental compound lifts, performed regularly and progressed steadily, can deliver a useful full-body program without an elaborate routine. The initial program is 5×5, but the product philosophy is broader: do the important things well, track them accurately, and make progress obvious.

Training should be challenging without being boring. Useful insights, personal progress, restrained humor, and small moments of delight may improve the workout experience even when they do not directly improve lifting performance.

Every feature must make the workout experience simpler, more enjoyable, or more motivating. If it does not, it does not belong.

Core values:

- Simplicity over complexity.
- Consistency over perfection.
- Compound lifts over endless variety.
- Data should encourage, not overwhelm.
- Humor should motivate, never distract or mock.
- The workout always comes first.
- Errors should be recoverable and never punitive.

## 3. V1 scope

### Program

Workout A:

- Squat: 5 sets × 5 reps
- Bench Press: 5 × 5
- Barbell Row: 5 × 5

Workout B:

- Squat: 5 × 5
- Overhead Press: 5 × 5
- Deadlift: 1 × 5

Completed workouts alternate A/B. The user may override the proposed workout without corrupting the alternation history.

Squat uses a single shared exercise configuration across Workout A and Workout B. Its working weight and progression continue from the most recent squat session regardless of which workout it appeared in; squat is never tracked as two separate exercises.

### Required capabilities

- First-use setup.
- Daily “Lift or Die?” ritual.
- One-exercise-at-a-time active workout.
- Large Set Done action and unmistakable set count.
- Configurable rest timer after all non-final sets.
- No timer after the final set of an exercise.
- Partial/failed set entry and undo.
- Total target weight and weight-per-side calculation.
- Exercise transition and next-load difference.
- Local workout persistence and force-close recovery.
- Workout completion, progression suggestion, and summary.
- History, workout detail, limited correction of completed workouts.
- Settings.
- Canned and personalized rest cards.
- Offline installation and use.

## 4. First-use setup

Collect:

- Program start date (default today).
- Units: pounds or kilograms (default pounds).
- For each exercise: original starting weight, current working weight, increment, bar weight, target sets/reps, and rest duration.
- Optional personal motivation statement.
- Humor level: Off, Light, or Mixed (default).
- Rest-card category toggles.
- Which workout should be proposed first: A or B (default A).

Defaults: 45 lb bar and a global 90-second rest. An exercise may optionally override the global rest duration, but that override is not required for the first gym-test build. The original starting weight is stored separately and remains stable unless the user explicitly edits the baseline.

Setup must be resumable if interrupted. Do not create duplicate exercise records when resumed.

## 5. Daily ritual

The ritual is presented directly on the Home screen (no separate screen) as two buttons:

- **Lift? (Start Workout)** starts the workout directly and records a lifetime “vote for Future You” only when the workout is ultimately completed.
- **Die? (maybe later)** exits kindly without guilt, breaking no streak and creating no failed workout. Suggested copy: “Fair enough. We’ll be here.”
- “Die” is framing, not a punishment: tapping it has no negative consequence beyond returning to Home. It is offered as a real, equally-weighted choice next to Lift, consistent with the app’s forgiving tone — revised from an earlier version of this spec that treated “Die” as something to avoid making tappable.
- Do not show a separate confirmation screen; Home itself is the ritual.
- Do not re-prompt on every app open once a workout is already active; resume the active session instead.

## 6. Home screen

The home screen answers four questions immediately: what workout is next, which exercises and weights it contains, when the last workout occurred, and what to do next.

Required content:

- App name.
- Next workout, A or B.
- Exercise list with current target weights.
- Last completed workout date, or a clear first-workout state.
- Lifetime completed workouts or “votes for Future You.”
- Primary **Start Workout** button.
- Access to History and Settings.
- If an unfinished session exists, **Resume Workout** replaces Start as the primary action.

Keep it simple. Do not turn it into a chart-filled dashboard.

## 7. Active exercise

Show one exercise at a time:

- Exercise name.
- Target total weight.
- Weight to load on each side.
- “Ready for Set N of M.”
- Rep target.
- Overall workout progress, such as “Exercise 1 of 3.”
- One very large **Set Done** button in easy thumb reach.
- Secondary partial-set action.
- Small, discoverable **Undo Last Set** when applicable.
- A guarded **End Workout** action outside the primary tap zone.

Formula:

`weight per side = max(0, (target total weight - bar weight) / 2)`

If target weight is below bar weight, display zero per side and a clear “bar only / configured target below bar” message; do not show a negative load.

If the result cannot be represented by the user's available increment, V1 still displays the exact calculated amount. Plate selection is out of scope.

### Set recording

- A normal tap records the target reps for the current set.
- Partial-set entry records an integer from 0 through target reps.
- A set is successful only when recorded reps meet the prescribed reps.
- After recording, save immediately before changing screens.
- Ignore rapid duplicate activation of the same Set Done action while the first activation is being processed. The UI must provide immediate feedback and temporarily disable the action.
- Undo removes only the latest recorded set in the current exercise, restores the correct current set, and cancels any rest timer caused by that set. Undo itself must be reversible only by recording the set again; no multi-level undo is required.

## 8. Rest state

After every non-final set:

- Start the configured countdown using an absolute end timestamp, not repeated subtraction.
- Keep the timer large and fixed in view.
- Show the next set number.
- Continue showing the current exercise and both the completed and upcoming set numbers.
- Provide **+30 sec**, **Skip Rest**, and **Undo Last Set**.
- Show one rest card below the timer with **Next Tip**.
- When zero is reached while visible, play a restrained chime/vibration exactly once, where browser permissions and iOS behavior allow.
- Reaching zero does not auto-advance the workout and does not require a "Continue" tap. The rest screen stays visible, switches to an expired/ready visual state (e.g. green), and keeps counting elapsed time past zero as overtime, shown as a negative timer with plain text such as "Rest finished — 12 seconds over." The lifter starts the next set in their own time; the app never forces it.
- Once expired, **Set Done** and the partial-set action for the upcoming set are exposed directly on this same screen, so the lifter can record the set the moment it's done without a separate screen. **Undo Last Set** and the guarded **End Workout** action remain available throughout, both before and after expiry.
- If backgrounded or suspended, calculate the correct elapsed time on return, including correctly recomputed overtime if the countdown expired while away. V1 does not promise a background alarm.

After the final set, never start a rest timer.

## 9. Exercise transition

After the final set:

- Show **Exercise Complete**.
- Summarize reps and weight.
- Show the next exercise, its total target, per-side load, and per-side difference from the current exercise (add/remove/no change).
- Provide a large **Next Exercise** button.

After the final exercise, proceed to workout completion.

## 10. Failed sets and progression

An exercise is successful only when every prescribed set contains at least the prescribed reps.

- Successful: suggest `current working weight + configured increment`.
- Unsuccessful: suggest the same working weight.
- The user may override each next weight before final save.
- Zero reps is valid and marks the set unsuccessful.
- Extra reps are out of scope for V1; entry is capped at the prescribed target.
- A negative increment is invalid. Zero increment is allowed and means maintain weight.
- Never apply progression twice if completion is tapped twice or the completion screen is reopened.
- Progression is committed atomically with workout completion. If saving fails, retain the active session and allow retry.
- Editing a completed workout does not silently recalculate later workouts or current working weights. If an edit changes success status, offer an explicit, previewed correction to the current working weight; default is no downstream change.
- Changing settings mid-workout affects future workouts only unless the user explicitly edits the active exercise target.

## 11. Workout completion

Before final save, show:

- Exercises, weights, and reps per set.
- Suggested next weights with editable overrides.
- Duration and total volume.

On confirmation:

- Save exactly one completed workout.
- Apply progression exactly once.
- Clear the active-session marker only after the completed record is durable.
- Alternate the next proposed workout based on the most recently completed A/B workout.
- Increment lifetime Lift votes.
- Show a restrained summary, meaningful progress, and at most one humorous headline.

The user may also end a workout early. Offer two deliberate choices:

- **Save as incomplete**, preserving all recorded sets without applying progression or counting a Lift vote.
- **Discard workout**, removing only the unfinished session after confirmation.

Never present an early-ended workout as personal failure.

## 12. Persistence and interruption recovery

Persist locally in IndexedDB:

- Settings and exercise configuration.
- Original starting weights.
- Active session and current screen/state.
- Each recorded set and timer end timestamp.
- Completed and intentionally saved incomplete workouts.
- Progression state and completion transaction identifiers.
- Rest-card history for the current workout.

Recovery rules:

- Save after every meaningful action.
- On launch, if an unfinished session exists, show **Resume Workout** as primary. Offer **Save as incomplete** as a secondary choice only once at least one set has been recorded in the session; a session with zero recorded sets offers **Resume Workout** and a guarded **Discard Workout** only.
- Discard requires confirmation and explains what will be removed. Completed history and exercise settings are never affected.
- If the app closed during rest, restore using the saved timer end time.
- If it closed on exercise-complete or workout-summary screens, restore that state without duplicating completion.
- If stored data cannot be fully read, preserve what is readable, show a plain-language recovery message, and never overwrite the database with empty defaults automatically.

## 13. History, progress, and editing

History lists completed and saved-incomplete workouts newest first. Each row shows date, A/B, completion status, key exercise weights, and duration when available. Detail shows:

- Start/completion date and time.
- Workout A/B.
- Duration.
- Every exercise, target weight, bar weight, per-side load, and reps per set.
- Success/failure and volume.

Simple V1 progress may show:

- Original starting weight compared with current working weight for each exercise.
- Total completed workouts/lifetime votes.
- Recent workout dates.
- Highest successfully completed working weight per exercise.

Do not add dense charts or advanced analytics.

V1 editing permits correction of date/time, target weight, bar weight, and reps for a completed workout. Requirements:

- Enter editing through a deliberate Edit action.
- Show Save and Cancel; navigation away with unsaved changes asks whether to discard.
- Preserve an `updatedAt` timestamp.
- Do not retroactively rewrite other workout records.
- Deletion is allowed only from workout detail, requires confirmation, and does not automatically reverse current progression.

## 14. Settings

Required settings:

- Units.
- Global default bar weight and per-exercise bar weights.
- Global default rest duration and optional exercise overrides.
- Exercise names and order within Workout A and B.
- Target sets and reps.
- Original starting weight and current working weight.
- Weight increment.
- Program start date.
- Humor level and rest-card category toggles.
- Optional personal motivation statement.
- **Reset all data**.

Reset all data requires an explicit confirmation naming what will be erased. It must not share visual prominence with normal Save actions. Settings changes affect future workouts unless the user deliberately edits the active workout.

Humor level choices are Off, Light, and Mixed (default). No maximum-jokes mode is needed in V1.

## 15. Navigation rules

Primary sections: Today, History, Settings.

- Active workout takes priority; reopening the app returns to it.
- Browser/back gestures during a workout must not silently lose or end the session.
- Back from History detail returns to the prior History position.
- Back from Settings with saved controls returns normally; unsaved form edits require Save/Cancel handling.
- Setup cannot lead to the active app until required valid fields are saved.
- No critical action relies solely on a swipe or long press.
- The primary workout action is never hidden in an overflow menu.

## 16. Rest cards

Sources:

- Exercise-specific technique cues.
- General training reminders.
- Personal motivation.
- Dry gym humor.
- Hydration, recovery, and general post-workout meal ideas.
- Upcoming exercise/load information.
- Personalized progress derived from history.

Examples include progress since starting, last-session comparison, sets/reps today, volume, total workouts, workouts in 30 days, time since last workout, and lifetime Lift votes.

Rules:

- Do not repeat a card in the same workout.
- Prefer relevant technique early, upcoming setup near an exercise end, and recovery/nutrition near workout end.
- Timer remains visually dominant.
- Cards do not autoplay or scroll.
- Humor level controls frequency; Off disables jokes.
- Humor is dry and encouraging, never insulting, sexualized toward the user, medically alarming, or guilt-based.
- Health and nutrition content stays general and avoids diagnosis or rigid promises.
- Avoid static-stretching recommendations between heavy working sets.

Starter humor may include: “Sexy is as sexy lifts,” “Gravity is reviewing the incident,” and “The barbell has filed another complaint.”

## 17. Data model (conceptual)

- `AppSettings`: units, program start date, motivation, humor level, card toggles, setup status.
- `ExerciseConfig`: stable id, name, original weight, current weight, increment, bar weight, target sets/reps, rest seconds, display order. One record exists per unique exercise; Squat has exactly one record referenced by both Workout A and Workout B, not a separate record per workout.
- `WorkoutSession`: stable id, type, status, timestamps, active exercise index, UI state, completion transaction id.
- `ExerciseResult`: exercise snapshot, target/bar/per-side weights, set results, success.
- `SetResult`: order, reps, completed timestamp.
- `StoredWorkout`: completed or intentionally saved-incomplete snapshot plus optional edit timestamp.

Use schema versioning and migrations from the first database release.

## 18. Error and validation behavior

- Explain errors in plain language near the affected control.
- Keep valid user input when validation fails.
- Offer retry for storage failures.
- Disable duplicate submission while saving.
- Never use blame, shame, or catastrophic language.
- Never silently discard an active or completed workout.
- Prefer safe defaults, undo, and confirmation only for destructive actions.

## 19. UX and quality requirements

- One-thumb operation for the active flow.
- Minimum 44×44 CSS-pixel touch targets; primary action substantially larger.
- Current exercise, weight, set number, and timer readable at a glance.
- No horizontal scrolling at supported phone widths.
- Respect iPhone safe areas and text scaling.
- Usable in light and dark environmental conditions; V1 may ship dark-only if contrast is strong.
- Launch/resume should feel immediate on a modern iPhone.
- Normal workout operation works without network access.

## 20. Out of scope

- Accounts, cloud sync, social features, ads, subscriptions, analytics.
- HealthKit, Apple Watch, widgets, Live Activities, push reminders.
- AI coaching or external content feeds.
- Calorie/macronutrient tracking or personalized medical/nutrition advice.
- Plate combination recommendations.
- Complex program builder, supersets, or broad exercise library.
- Public App Store release work.

## 21. Build slices

1. App shell, setup, data schema, persistence.
2. Daily Vote and workout creation/resume.
3. Active exercise, Set Done, partial set, undo.
4. Rest timer and interruption recovery.
5. Exercise transitions and per-side calculations.
6. Completion, progression, history.
7. Settings and completed-workout correction.
8. Rest cards, personality, and visual polish.
9. Manifest, service worker, offline install, iPhone gym trial.

Build and test one slice at a time.

## 22. Initial gym acceptance test

V1 is ready for its first gym test when the user can:

1. Install or open the app on an iPhone.
2. Complete setup and choose the first proposed workout.
3. See the home screen with the correct workout, exercises, and weights.
4. Choose Lift and start Workout A.
5. See the correct squat total and weight per side.
6. Tap Set Done five times with rest periods between non-final sets.
7. Avoid a duplicate record from a rapid double tap and undo an accidental set.
8. Switch apps during rest and return to the correct timer state.
9. Transition to the next exercise with the correct loading difference.
10. Complete all exercises and review suggested next weights.
11. Save exactly one completed workout and find it in History.
12. See Workout B proposed next.
13. Close and reopen during a separate active workout and resume successfully.
14. End a separate workout early and save it as incomplete without applying progression.
15. Correct basic historical data without silently rewriting later progression.
