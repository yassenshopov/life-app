export type BackMuscles = 
  | 'lats'
  | 'traps'
  | 'rhomboids'
  | 'lower_back';

export type LegMuscles = 
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors';

export type ChestMuscles = 
  | 'upper_chest'
  | 'mid_chest'
  | 'lower_chest';

export type ShoulderMuscles = 
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts';

export type ArmMuscles = 
  | 'biceps'
  | 'triceps'
  | 'forearms';

export type CoreMuscles = 
  | 'rectus_abdominis'
  | 'obliques'
  | 'transverse_abdominis';

export type MuscleGroup =
  | BackMuscles
  | LegMuscles
  | ChestMuscles
  | ShoulderMuscles
  | ArmMuscles
  | CoreMuscles
  | 'cardio'; 