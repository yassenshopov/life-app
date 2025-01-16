import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { EXERCISE_LIBRARY, GymSessionType, Exercise } from '@/constants/exercises';
import { ExerciseStats } from '@/types/workout';
import { MuscleGroup } from '@/constants/muscle-groups';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatGymType = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'back_and_chest':
      return 'Back & Chest';
    case 'shoulders_and_arms':
      return 'Shoulders & Arms';
    case 'legs':
      return 'Legs';
    case 'full':
      return 'Full Body';
    case 'cardio':
      return 'Cardio';
    case 'other':
      return 'Other';
    default:
      return type;
  }
};

export const calculateExerciseStats = (gymSessions: any[]): ExerciseStats[] => {
  const exerciseStats = new Map<string, ExerciseStats>();

  (Object.entries(EXERCISE_LIBRARY) as [GymSessionType, readonly Exercise[]][]).forEach(
    ([category, exercises]) => {
      exercises.forEach((exercise) => {
        exerciseStats.set(exercise.name.toLowerCase(), {
          name: exercise.name,
          totalSets: 0,
          maxWeight: 0,
          avgWeight: 0,
          totalReps: 0,
          lastPerformed: '',
          category: category as keyof typeof EXERCISE_LIBRARY,
          affectedMuscles: [exercise.primaryMuscle, ...(exercise.secondaryMuscles || [])] as MuscleGroup[],
        });
      });
    }
  );

  gymSessions.forEach((session) => {
    const sessionDate = new Date(session.date).toISOString().split('T')[0];
    const exerciseLog = session.exercise_log || {};

    Object.entries(exerciseLog).forEach(([exerciseName, data]: [string, any]) => {
      const cleanName = exerciseName.toLowerCase().replace(/_/g, ' ');
      const stats = exerciseStats.get(cleanName);

      if (stats) {
        let sessionTotalWeight = 0;
        let sessionTotalSets = 0;

        data.sets.forEach((set: { weight: number; reps: number }) => {
          stats.totalSets++;
          stats.totalReps += set.reps;
          stats.maxWeight = Math.max(stats.maxWeight, set.weight);
          sessionTotalWeight += set.weight;
          sessionTotalSets++;
        });

        stats.avgWeight = Number(
          ((stats.avgWeight * (stats.totalSets - sessionTotalSets) + sessionTotalWeight) / stats.totalSets).toFixed(1)
        );

        if (!stats.lastPerformed || sessionDate > stats.lastPerformed) {
          stats.lastPerformed = sessionDate;
        }
      }
    });
  });

  return Array.from(exerciseStats.values()).sort((a, b) => {
    if (a.totalSets > 0 && b.totalSets === 0) return -1;
    if (a.totalSets === 0 && b.totalSets > 0) return 1;
    if (a.totalSets > 0 && b.totalSets > 0) {
      return new Date(b.lastPerformed).getTime() - new Date(a.lastPerformed).getTime();
    }
    return a.name.localeCompare(b.name);
  });
};

export const calculateORM = (weight: number, reps: number): number => {
  // Using Brzycki Formula: 1RM = weight × (36 / (37 - reps))
  if (reps === 0 || weight === 0) return 0;
  const orm = weight * (36 / (37 - reps));
  return Math.round(orm);
};
