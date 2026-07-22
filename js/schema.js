export const DB_NAME = 'liftOrDieDB';
export const DB_VERSION = 1;

export const STORES = {
  appSettings: { name: 'appSettings', keyPath: 'id' },
  exerciseConfigs: { name: 'exerciseConfigs', keyPath: 'id' },
  workoutTemplates: { name: 'workoutTemplates', keyPath: 'id' },
  workoutSessions: { name: 'workoutSessions', keyPath: 'id' },
  storedWorkouts: { name: 'storedWorkouts', keyPath: 'id' },
};

export const EXERCISE_ORDER = [
  'squat',
  'bench-press',
  'barbell-row',
  'overhead-press',
  'deadlift',
];

const DEFAULT_EXERCISES = [
  { id: 'squat', name: 'Squat', targetSets: 5, targetReps: 5 },
  { id: 'bench-press', name: 'Bench Press', targetSets: 5, targetReps: 5 },
  { id: 'barbell-row', name: 'Barbell Row', targetSets: 5, targetReps: 5 },
  { id: 'overhead-press', name: 'Overhead Press', targetSets: 5, targetReps: 5 },
  { id: 'deadlift', name: 'Deadlift', targetSets: 1, targetReps: 5 },
];

const DEFAULT_TEMPLATES = [
  { id: 'A', exerciseIds: ['squat', 'bench-press', 'barbell-row'] },
  { id: 'B', exerciseIds: ['squat', 'overhead-press', 'deadlift'] },
];

export const CARD_CATEGORIES = [
  { key: 'technique', label: 'Technique cues' },
  { key: 'generalTraining', label: 'General training reminders' },
  { key: 'personalMotivation', label: 'Personal motivation' },
  { key: 'humor', label: 'Dry gym humor' },
  { key: 'recovery', label: 'Hydration & recovery' },
  { key: 'upcoming', label: 'Upcoming exercise info' },
  { key: 'personalProgress', label: 'Personal progress' },
];

const DEFAULT_SETTINGS = {
  id: 'settings',
  setupComplete: false,
  setupStep: 0,
  units: 'lb',
  programStartDate: null,
  firstWorkoutChoice: 'A',
  humorLevel: 'mixed',
  motivation: '',
  cardCategoryToggles: Object.fromEntries(CARD_CATEGORIES.map((c) => [c.key, true])),
  globalDefaultRestSeconds: 90,
  globalDefaultBarWeight: 45,
};

function getFromStore(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function seedDefaults(db) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(
      [STORES.appSettings.name, STORES.exerciseConfigs.name, STORES.workoutTemplates.name],
      'readwrite'
    );
    const settingsStore = txn.objectStore(STORES.appSettings.name);
    const exerciseStore = txn.objectStore(STORES.exerciseConfigs.name);
    const templateStore = txn.objectStore(STORES.workoutTemplates.name);

    getFromStore(settingsStore, 'settings').then((existing) => {
      if (!existing) settingsStore.put(DEFAULT_SETTINGS);
    });

    for (const exercise of DEFAULT_EXERCISES) {
      getFromStore(exerciseStore, exercise.id).then((existing) => {
        if (!existing) {
          exerciseStore.put({
            id: exercise.id,
            name: exercise.name,
            originalWeight: null,
            currentWeight: null,
            increment: null,
            barWeight: null,
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
            restSecondsOverride: null,
          });
        }
      });
    }

    for (const template of DEFAULT_TEMPLATES) {
      getFromStore(templateStore, template.id).then((existing) => {
        if (!existing) templateStore.put(template);
      });
    }

    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}
