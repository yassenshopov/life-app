import { MuscleGroup } from '@/constants/muscle-groups';
import { GymSessionType } from '@/constants/exercises';

export interface WorkoutEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  distance?: number;
  duration?: number;
  pace?: string;
  notes?: string;
}

export interface WorkoutExercise {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  sets: Array<{
    reps: number;
    weight: number;
  }>;
}

export interface ExerciseStats {
  name: string;
  totalSets: number;
  maxWeight: number;
  avgWeight: number;
  totalReps: number;
  lastPerformed: string;
  category: GymSessionType;
  affectedMuscles: MuscleGroup[];
} 