export type GymSessionType = 'legs' | 'back_and_chest' | 'shoulders_and_arms' | 'cardio' | 'full_body';

type ExerciseLibrary = {
  [K in GymSessionType]: readonly string[];
};

export const EXERCISE_LIBRARY: ExerciseLibrary = {
  legs: [
    'Barbell Squat',
    'Romanian Deadlift',
    'Leg Press',
    'Leg Extension',
    'Leg Curl',
    'Calf Raises',
  ],
  back_and_chest: [
    'Bench Press',
    'Pec Fly Machine', 
    'Incline Bench Press',
    'Barbell Row',
    'Lat Pulldown',
    'Cable Flyes',
    'Pull-ups',
  ],
  shoulders_and_arms: [
    'Overhead Press',
    'Lateral Raises',
    'Bicep Curls',
    'Tricep Extensions',
    'Face Pulls',
    'Hammer Curls',
  ],
  cardio: [
    'Treadmill',
    'Rowing Machine',
    'Exercise Bike',
    'Elliptical',
    'Jump Rope',
  ],
  full_body: [
    'Deadlift',
    'Push-ups',
    'Pull-ups',
    'Dips',
    'Lunges',
    'Planks',
  ],
} as const; 