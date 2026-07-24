import { getAllRecords, getRecord } from './db.js';
import { STORES } from './schema.js';
import { computeLoadDifferenceText, formatPerSideText } from './loadCalculations.js';

// Restrained, dry, non-alarming content per category (spec §16). Technique
// cues are per-exercise; everything else is generic or derived from history.
const TECHNIQUE_CUES = {
  squat: ['Brace before you break parallel.', 'Knees track your toes, not past them.'],
  'bench-press': ['Feet planted, shoulder blades set.', 'Bar path stays over the wrists.'],
  'barbell-row': ['Hinge first, then row — don’t round to get there.', 'Pull to the belly, not the chin.'],
  'overhead-press': ['Squeeze the glutes to keep the ribs down.', 'Press through, not just up — get your head through.'],
  deadlift: ['Bar close to the shins the whole way up.', 'Push the floor away — don’t just pull.'],
};

const GENERAL_TRAINING = [
  'Consistency beats a perfect program.',
  'Warm up the movement, not just the muscle.',
  'A rep done well counts more than a rushed one.',
  'Progress is rarely a straight line. Keep showing up.',
];

const HUMOR_LINES = [
  'Sexy is as sexy lifts.',
  'Gravity is reviewing the incident.',
  'The barbell has filed another complaint.',
  'Chalk: because sweaty hands and heavy bars don’t mix.',
];

const RECOVERY_LINES = [
  'Water is free progress. Drink some.',
  'A bit of protein after training helps recovery.',
  'Save the deep stretching for after — not between heavy sets.',
  'Sleep is when the actual adaptation happens.',
];

function buildTechniqueCard(exercise) {
  const cues = TECHNIQUE_CUES[exercise.exerciseId];
  if (!cues) return null;
  return cues.map((text, i) => ({ key: `technique:${exercise.exerciseId}:${i}`, category: 'technique', text }));
}

function buildGeneralCards() {
  return GENERAL_TRAINING.map((text, i) => ({ key: `general:${i}`, category: 'generalTraining', text }));
}

function buildMotivationCard(settings) {
  if (!settings.motivation) return [];
  return [{ key: 'motivation:own', category: 'personalMotivation', text: settings.motivation }];
}

function buildHumorCards() {
  return HUMOR_LINES.map((text, i) => ({ key: `humor:${i}`, category: 'humor', text }));
}

function buildRecoveryCards() {
  return RECOVERY_LINES.map((text, i) => ({ key: `recovery:${i}`, category: 'recovery', text }));
}

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
    key: `upcoming:${nextExercise.exerciseId}`,
    category: 'upcoming',
    text: `Next up: ${nextExercise.name} — ${nextExercise.targetWeight} ${settings.units} (${perSide}). ${diff}`,
  }];
}

async function buildProgressCards(settings) {
  const workouts = await getAllRecords(STORES.storedWorkouts.name);
  const completed = workouts.filter((w) => w.status === 'completed');
  const cards = [];

  cards.push({ key: 'progress:votes', category: 'personalProgress', text: `Lifetime votes for Future You: ${settings.lifetimeVotes ?? 0}.` });
  cards.push({ key: 'progress:total', category: 'personalProgress', text: `Total workouts logged: ${workouts.length}.` });

  if (completed.length > 0) {
    const sorted = [...completed].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    const daysSince = Math.round((Date.now() - new Date(sorted[0].startedAt).getTime()) / 86400000);
    if (daysSince > 0) {
      cards.push({ key: 'progress:daysSince', category: 'personalProgress', text: `${daysSince} day${daysSince === 1 ? '' : 's'} since your last workout.` });
    }
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const recentCount = completed.filter((w) => new Date(w.startedAt).getTime() >= thirtyDaysAgo).length;
    cards.push({ key: 'progress:recent30', category: 'personalProgress', text: `${recentCount} workout${recentCount === 1 ? '' : 's'} in the last 30 days.` });
  }

  return cards;
}

async function buildOriginalVsCurrentCards() {
  const exercises = await Promise.all(['squat', 'bench-press', 'barbell-row', 'overhead-press', 'deadlift'].map((id) => getRecord(STORES.exerciseConfigs.name, id)));
  return exercises
    .filter((ex) => ex.originalWeight != null && ex.currentWeight != null && ex.currentWeight !== ex.originalWeight)
    .map((ex) => ({
      key: `progress:original:${ex.id}`,
      category: 'personalProgress',
      text: `${ex.name}: up from ${ex.originalWeight} to ${ex.currentWeight} since you started.`,
    }));
}

// Picks the next rest card to show (spec §8/§16): one card, not repeated
// within the same workout, weighted toward the placement the spec prefers
// (technique early in an exercise, upcoming-exercise info near its end,
// recovery near the workout's end), filtered by category toggles and humor
// level. `shownKeys` is the session's persisted rest-card history.
export async function pickNextCard(session, settings, shownKeys) {
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

  let available = pool.filter((c) => !shownKeys.includes(c.key));
  // Pool exhausted for this workout: allow repeats rather than showing
  // nothing — the spec's "don't repeat" is a preference, not a mandate to
  // go silent once every candidate has had a turn.
  if (available.length === 0) {
    available = pool;
  }
  if (available.length === 0) {
    return null;
  }

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const card of available) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return available[available.length - 1];
}
