import { MuscleGroup } from './muscle-groups';

export type Exercise = {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
};

export type GymSessionType = 'legs' | 'back_and_chest' | 'shoulders_and_arms' | 'cardio' | 'full_body';

export const GYM_SESSION_TYPES: GymSessionType[] = ['legs', 'back_and_chest', 'shoulders_and_arms', 'cardio', 'full_body'];

type ExerciseLibrary = {
  [K in GymSessionType]: readonly Exercise[];
};

export const EXERCISE_LIBRARY: ExerciseLibrary = {
  legs: [
    { name: 'Barbell Squat', primaryMuscle: 'quadriceps', secondaryMuscles: ['hamstrings', 'glutes', 'rectus_abdominis'] },
    { name: 'Leg Press', primaryMuscle: 'quadriceps', secondaryMuscles: ['hamstrings', 'glutes'] },
    { name: 'Leg Extension', primaryMuscle: 'quadriceps' },
    { name: 'Leg Curl', primaryMuscle: 'hamstrings' },
    { name: 'Calf Raises', primaryMuscle: 'calves' },
    { name: 'Hip Adductor Machine', primaryMuscle: 'adductors' },
    { name: 'Romanian Deadlift', primaryMuscle: 'hamstrings', secondaryMuscles: ['glutes', 'lower_back'] },
    { name: 'Hip Thrust', primaryMuscle: 'glutes', secondaryMuscles: ['hamstrings'] },
    { name: 'Standing Calf Raise', primaryMuscle: 'calves' },
  ],
  back_and_chest: [
    { name: 'Bench Press', primaryMuscle: 'mid_chest', secondaryMuscles: ['front_delts', 'triceps'] },
    { name: 'Pec Fly Machine', primaryMuscle: 'mid_chest' },
    { name: 'Incline Bench Press', primaryMuscle: 'upper_chest', secondaryMuscles: ['front_delts'] },
    { name: 'Lat Pulldown Machine', primaryMuscle: 'lats', secondaryMuscles: ['biceps'] },
    { name: 'Lat Row Machine', primaryMuscle: 'lats', secondaryMuscles: ['rhomboids', 'biceps'] },
    { name: 'Pull-ups', primaryMuscle: 'lats', secondaryMuscles: ['biceps'] },
    { name: 'Shrugs', primaryMuscle: 'traps' },
    { name: 'Flat Dumbbell Press', primaryMuscle: 'mid_chest', secondaryMuscles: ['front_delts', 'triceps'] },
    { name: 'Dumbbell Row', primaryMuscle: 'lats', secondaryMuscles: ['rhomboids', 'biceps'] },
    { name: 'Back Extension', primaryMuscle: 'lower_back' },
    { name: 'Seated Cable Row', primaryMuscle: 'rhomboids', secondaryMuscles: ['lats', 'biceps'] },
  ],
  shoulders_and_arms: [
    { name: 'Overhead Press', primaryMuscle: 'front_delts', secondaryMuscles: ['triceps', 'side_delts'] },
    { name: 'Lateral Raises', primaryMuscle: 'side_delts' },
    { name: 'Bicep Curls', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'] },
    { name: 'Tricep Extensions', primaryMuscle: 'triceps' },
    { name: 'Face Pulls', primaryMuscle: 'rear_delts', secondaryMuscles: ['rhomboids'] },
    { name: 'Hammer Curls', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'] },
    { name: 'Triceps Press Machine', primaryMuscle: 'triceps' },
    { name: 'Wrist Curls', primaryMuscle: 'forearms' },
    { name: 'Barbell Curl', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'] },
    { name: 'Skull Crusher', primaryMuscle: 'triceps' },
    { name: 'Incline Dumbbell Curl', primaryMuscle: 'biceps' },
    { name: 'Dead Hang', primaryMuscle: 'forearms', secondaryMuscles: ['lats'] },
    { name: 'Concentration Curl', primaryMuscle: 'biceps' },
    { name: 'Spider Curl', primaryMuscle: 'biceps' },
    { name: 'Close Grip Bench Press', primaryMuscle: 'triceps', secondaryMuscles: ['mid_chest'] },
    { name: 'Arnold Press', primaryMuscle: 'front_delts', secondaryMuscles: ['side_delts', 'rear_delts'] },
    { name: 'Reverse Pec Deck', primaryMuscle: 'rear_delts', secondaryMuscles: ['rhomboids'] },
  ],
  cardio: [
    { name: 'Treadmill', primaryMuscle: 'cardio' },
    { name: 'Rowing Machine', primaryMuscle: 'cardio', secondaryMuscles: ['lats', 'rhomboids', 'rear_delts'] },
    { name: 'Exercise Bike', primaryMuscle: 'cardio', secondaryMuscles: ['quadriceps'] },
    { name: 'Elliptical', primaryMuscle: 'cardio' },
    { name: 'Jump Rope', primaryMuscle: 'cardio', secondaryMuscles: ['calves'] },
  ],
  full_body: [
    { name: 'Deadlift', primaryMuscle: 'lower_back', secondaryMuscles: ['hamstrings', 'glutes', 'traps', 'forearms'] },
    { name: 'Push-ups', primaryMuscle: 'mid_chest', secondaryMuscles: ['front_delts', 'triceps', 'rectus_abdominis'] },
    { name: 'Pull-ups', primaryMuscle: 'lats', secondaryMuscles: ['biceps', 'rhomboids'] },
    { name: 'Dips', primaryMuscle: 'lower_chest', secondaryMuscles: ['triceps', 'front_delts'] },
    { name: 'Lunges', primaryMuscle: 'quadriceps', secondaryMuscles: ['hamstrings', 'glutes'] },
    { name: 'Planks', primaryMuscle: 'rectus_abdominis', secondaryMuscles: ['transverse_abdominis'] },
    { name: 'Russian Twists', primaryMuscle: 'obliques', secondaryMuscles: ['rectus_abdominis'] },
    { name: 'Hanging Leg Raise', primaryMuscle: 'rectus_abdominis'},
    { name: 'Hanging Knee Raise', primaryMuscle: 'rectus_abdominis' },
    { name: 'Side Plank', primaryMuscle: 'obliques', secondaryMuscles: ['transverse_abdominis'] },
    { name: 'Weighted Plank', primaryMuscle: 'rectus_abdominis', secondaryMuscles: ['transverse_abdominis'] },
  ],
} as const;