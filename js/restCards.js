import { getAllRecords, getRecord } from './db.js';
import { STORES } from './schema.js';
import { computeLoadDifferenceText, formatPerSideText } from './loadCalculations.js';

// Restrained, dry, non-alarming content per category (spec §16). Technique
// cues are per-exercise; everything else is generic or derived from history.
//
// Every item now carries a `family` — items that are really just variations
// of the same joke/idea share one, so the repetition rules (below) can treat
// them as interchangeable, not just textually identical. Items with no
// natural grouping simply get their own family (their key, effectively).
const TECHNIQUE_CUES = {
  squat: ['Brace before you break parallel.', 'Knees track your toes, not past them.'],
  'bench-press': ['Feet planted, shoulder blades set.', 'Bar path stays over the wrists.'],
  'barbell-row': ['Hinge first, then row — don’t round to get there.', 'Pull to the belly, not the chin.'],
  'overhead-press': ['Squeeze the glutes to keep the ribs down.', 'Press through, not just up — get your head through.'],
  deadlift: ['Bar close to the shins the whole way up.', 'Push the floor away — don’t just pull.'],
};

const GENERAL_TRAINING = [
  { text: 'Consistency beats a perfect program.', family: 'general-consistency' },
  { text: 'Warm up the movement, not just the muscle.', family: 'general-warmup' },
  { text: 'A rep done well counts more than a rushed one.', family: 'general-quality' },
  { text: 'Progress is rarely a straight line. Keep showing up.', family: 'general-persistence' },
  { text: 'Small weekly gains beat big monthly swings.', family: 'general-consistency' },
  { text: 'The best program is the one you actually finish.', family: 'general-persistence' },
  { text: 'Form holds the line, ego moves the goalposts.', family: 'general-quality' },
  { text: 'A missed day is not a missed program.', family: 'general-forgiveness' },
];

// The "barbell/gravity has a complaint" joke was doing a lot of the app's
// comedic heavy lifting — grouping it into one family (rather than deleting
// it) caps how often that specific idea can surface, while the expanded
// list overall gives the rotation much more room before repeating anything.
const HUMOR_LINES = [
  { text: 'Sexy is as sexy lifts.', family: 'humor-sexy' },
  { text: 'Gravity is reviewing the incident.', family: 'humor-complaint' },
  { text: 'The barbell has filed another complaint.', family: 'humor-complaint' },
  { text: 'The bar loads the same whether or not you complain about it.', family: 'humor-complaint' },
  { text: 'Chalk: because sweaty hands and heavy bars don’t mix.', family: 'humor-chalk' },
  { text: 'A spoonful of protein helps the waistline go down.', family: 'humor-nutrition' },
  { text: 'The plates don’t know you skipped leg day. Yet.', family: 'humor-plates' },
  { text: 'Your spotter is a folding chair. Choose wisely.', family: 'humor-spotter' },
  { text: 'Somewhere, a foam roller waits patiently.', family: 'humor-foamroller' },
  { text: 'The mirror is not a certified judge.', family: 'humor-mirror' },
  { text: 'Legend says the last rep is always the heaviest.', family: 'humor-lastrep' },
];

const RECOVERY_LINES = [
  { text: 'Water is free progress. Drink some.', family: 'recovery-water' },
  { text: 'A bit of protein after training helps recovery.', family: 'recovery-protein' },
  { text: 'Save the deep stretching for after — not between heavy sets.', family: 'recovery-stretching' },
  { text: 'Sleep is when the actual adaptation happens.', family: 'recovery-sleep' },
  { text: 'A short walk afterward helps the legs feel human again.', family: 'recovery-walk' },
  { text: 'Protein and sleep do more than any supplement stack.', family: 'recovery-protein' },
  { text: 'Cold water isn’t magic, but it isn’t nothing either.', family: 'recovery-water' },
];

function buildTechniqueCard(exercise) {
  const cues = TECHNIQUE_CUES[exercise.exerciseId];
  if (!cues) return null;
  return cues.map((text, i) => ({
    key: `technique:${exercise.exerciseId}:${i}`,
    family: `technique:${exercise.exerciseId}:${i}`,
    category: 'technique',
    text,
  }));
}

function buildGeneralCards() {
  return GENERAL_TRAINING.map((item, i) => ({ key: `general:${i}`, family: item.family, category: 'generalTraining', text: item.text }));
}

function buildMotivationCard(settings) {
  if (!settings.motivation) return [];
  return [{ key: 'motivation:own', family: 'motivation:own', category: 'personalMotivation', text: settings.motivation }];
}

function buildHumorCards() {
  return HUMOR_LINES.map((item, i) => ({ key: `humor:${i}`, family: item.family, category: 'humor', text: item.text }));
}

function buildRecoveryCards() {
  return RECOVERY_LINES.map((item, i) => ({ key: `recovery:${i}`, family: item.family, category: 'recovery', text: item.text }));
}

// Value-keyed: the next exercise's actual load can differ meaningfully
// workout to workout even though the sentence template is the same, so the
// key includes the real numbers — a genuinely different load is treated as
// fresh content, not a repeat, while the family still ties every "upcoming"
// card for this exercise together for within-workout variety.
function buildUpcomingCard(session, index, settings) {
  const nextExercise = session.exerciseResults[index + 1];
  if (!nextExercise) return [];
  const diff = computeLoadDifferenceText(
    session.exerciseResults[index].targetWeight,
    session.exerciseResults[index].barWeight,
    nextExercise.targetWeight,
    nextExercise.barWeight,
    settings.units
  );
  const perSide = formatPerSideText(nextExercise.targetWeight, nextExercise.barWeight, settings.units);
  return [{
    key: `upcoming:${nextExercise.exerciseId}:${nextExercise.targetWeight}:${nextExercise.barWeight}`,
    family: `upcoming:${nextExercise.exerciseId}`,
    category: 'upcoming',
    text: `Next up: ${nextExercise.name} — ${nextExercise.targetWeight} ${settings.units} (${perSide}). ${diff}`,
  }];
}

// Also value-keyed for the same reason: "3 workouts in the last 30 days" is
// meaningfully different content from "5 workouts in the last 30 days," even
// though it's produced by the same template.
async function buildProgressCards(settings) {
  const workouts = await getAllRecords(STORES.storedWorkouts.name);
  const completed = workouts.filter((w) => w.status === 'completed');
  const cards = [];

  const votes = settings.lifetimeVotes ?? 0;
  cards.push({ key: `progress:votes:${votes}`, family: 'progress:votes', category: 'personalProgress', text: `Lifetime votes for Future You: ${votes}.` });
  cards.push({ key: `progress:total:${workouts.length}`, family: 'progress:total', category: 'personalProgress', text: `Total workouts logged: ${workouts.length}.` });

  if (completed.length > 0) {
    const sorted = [...completed].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    const daysSince = Math.round((Date.now() - new Date(sorted[0].startedAt).getTime()) / 86400000);
    if (daysSince > 0) {
      cards.push({ key: `progress:daysSince:${daysSince}`, family: 'progress:daysSince', category: 'personalProgress', text: `${daysSince} day${daysSince === 1 ? '' : 's'} since your last workout.` });
    }
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentCount = completed.filter((w) => new Date(w.startedAt).getTime() >= thirtyDaysAgo).length;
    cards.push({ key: `progress:recent30:${recentCount}`, family: 'progress:recent30', category: 'personalProgress', text: `${recentCount} workout${recentCount === 1 ? '' : 's'} in the last 30 days.` });
  }

  return cards;
}

async function buildOriginalVsCurrentCards() {
  const exercises = await Promise.all(['squat', 'bench-press', 'barbell-row', 'overhead-press', 'deadlift'].map((id) => getRecord(STORES.exerciseConfigs.name, id)));
  return exercises
    .filter((ex) => ex.originalWeight != null && ex.currentWeight != null && ex.currentWeight !== ex.originalWeight)
    .map((ex) => ({
      key: `progress:original:${ex.id}:${ex.originalWeight}:${ex.currentWeight}`,
      family: `progress:original:${ex.id}`,
      category: 'personalProgress',
      text: `${ex.name}: up from ${ex.originalWeight} to ${ex.currentWeight} since you started.`,
    }));
}

// A session created before this rework may still carry a few legacy
// bare-string entries in `shownCardKeys` — normalize to their own family so
// the exclusion checks below never have to special-case the shape.
function normalizeEntry(entry) {
  return typeof entry === 'string' ? { key: entry, family: entry } : entry;
}

// The last 3 *completed* workouts' content history, expanded into the set of
// keys/families that must be excluded now (spec addendum: "avoid repeating
// it during the next three completed workouts"). Read fresh each time a pick
// is needed — this app's history is small enough that this is cheap, and it
// avoids caching anything that could go stale mid-workout.
async function buildHistoricalExclusions() {
  const workouts = await getAllRecords(STORES.storedWorkouts.name);
  const completed = workouts
    .filter((w) => w.status === 'completed')
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 3);

  const excludedKeys = new Set();
  const excludedFamilies = new Set();
  for (const w of completed) {
    for (const rawEntry of w.contentHistory ?? []) {
      const entry = normalizeEntry(rawEntry);
      excludedKeys.add(entry.key);
      excludedFamilies.add(entry.family);
    }
  }
  return { excludedKeys, excludedFamilies };
}

// Shared selection: excludes anything already shown this workout (by key or
// family) and anything excluded by the last 3 completed workouts' history,
// then weighted-picks one survivor. Returns null — show nothing — rather
// than falling back to a repeat once the eligible pool is empty; that
// "graceful exhaustion" is now a real possibility given the exclusion rules,
// not just a theoretical edge case (spec addendum: "show no optional card or
// headline rather than repeat one").
function pickFromPool(pool, shownEntriesThisWorkout, excludedKeys, excludedFamilies) {
  const shownKeys = new Set();
  const shownFamilies = new Set();
  for (const rawEntry of shownEntriesThisWorkout ?? []) {
    const entry = normalizeEntry(rawEntry);
    shownKeys.add(entry.key);
    shownFamilies.add(entry.family);
  }

  const available = pool.filter((c) =>
    !shownKeys.has(c.key) && !shownFamilies.has(c.family) &&
    !excludedKeys.has(c.key) && !excludedFamilies.has(c.family)
  );

  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const card of available) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return available[available.length - 1];
}

// Picks the next rest card to show (spec §8/§16): one card, weighted toward
// the placement the spec prefers (technique early in an exercise, upcoming
// near an exercise's end, recovery near the workout's end), filtered by
// category toggles and humor level, never repeating a key or family shown
// already this workout or within the last 3 completed workouts.
export async function pickNextCard(session, settings, shownEntries) {
  const index = session.activeExerciseIndex ?? 0;
  const exercise = session.exerciseResults[index];
  const isLastExercise = index === session.exerciseResults.length - 1;
  const setsRecorded = exercise.setResults.length;
  const nearExerciseEnd = setsRecorded >= exercise.targetSets - 1;

  const candidates = [
    ...(buildTechniqueCard(exercise) ?? []).map((c) => ({ ...c, weight: setsRecorded <= 1 ? 3 : 1 })),
    ...buildGeneralCards().map((c) => ({ ...c, weight: 1 })),
    ...buildMotivationCard(settings).map((c) => ({ ...c, weight: 1.5 })),
    ...buildHumorCards().map((c) => ({ ...c, weight: settings.humorLevel === 'mixed' ? 1 : 0.5 })),
    ...buildRecoveryCards().map((c) => ({ ...c, weight: isLastExercise ? 3 : 1 })),
    ...buildUpcomingCard(session, index, settings).map((c) => ({ ...c, weight: nearExerciseEnd && !isLastExercise ? 3 : 0.5 })),
    ...(await buildProgressCards(settings)).map((c) => ({ ...c, weight: 1 })),
    ...(await buildOriginalVsCurrentCards()).map((c) => ({ ...c, weight: 1 })),
  ];

  const toggles = settings.cardCategoryToggles ?? {};
  let pool = candidates.filter((c) => toggles[c.category] !== false);
  if (settings.humorLevel === 'off') {
    pool = pool.filter((c) => c.category !== 'humor');
  }

  const { excludedKeys, excludedFamilies } = await buildHistoricalExclusions();
  return pickFromPool(pool, shownEntries, excludedKeys, excludedFamilies);
}

// The one-time workout-completion headline (spec §11: "at most one humorous
// headline") now shares the exact same repetition system as rest cards —
// drawn from the same humor pool, excluded by whatever's already been shown
// as a rest card this workout (a joke can't appear twice, once as a card and
// once as the headline) and by the last 3 completed workouts. Returns null
// (no headline shown) if humor is off or nothing is eligible.
export async function pickCompletionHeadline(session, settings) {
  if (settings.humorLevel === 'off') return null;
  const pool = buildHumorCards();
  const { excludedKeys, excludedFamilies } = await buildHistoricalExclusions();
  return pickFromPool(pool, session.shownCardKeys ?? [], excludedKeys, excludedFamilies);
}
