import { useState, useMemo, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Outfit } from 'next/font/google';
import { Exercise, EXERCISE_LIBRARY } from '@/constants/exercises';
import { MuscleGroup } from '@/constants/muscle-groups';
import { Button } from '@/components/ui/button';

const outfit = Outfit({ subsets: ['latin'] });

// Define muscle categories
export const muscleCategories = {
  back: {
    label: 'Back',
    muscles: ['lats', 'traps', 'rhomboids', 'lower_back'],
  },
  legs: {
    label: 'Legs',
    muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors'],
  },
  chest: {
    label: 'Chest',
    muscles: ['upper_chest', 'mid_chest', 'lower_chest'],
  },
  shoulders: {
    label: 'Shoulders',
    muscles: ['front_delts', 'side_delts', 'rear_delts'],
  },
  arms: {
    label: 'Arms',
    muscles: ['biceps', 'triceps', 'forearms'],
  },
  core: {
    label: 'Core',
    muscles: ['rectus_abdominis', 'obliques', 'transverse_abdominis'],
  },
};

// Fix indentation of findExerciseInLibrary function
const findExerciseInLibrary = (
  name: string
): Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'> | undefined => {
  for (const [_, exercises] of Object.entries(EXERCISE_LIBRARY)) {
    const exercise = exercises.find((e) => e.name.toLowerCase() === name.replace(/_/g, ' '));
    if (exercise)
      return {
        primaryMuscle: exercise.primaryMuscle,
        secondaryMuscles: exercise.secondaryMuscles,
      };
  }
  return undefined;
};

// Define recommended sets
const recommendedSets: Record<MuscleGroup, number> = {
  // Back muscles
  lats: 10,
  traps: 8,
  rhomboids: 8,
  lower_back: 6,

  // Leg muscles
  quadriceps: 12,
  hamstrings: 10,
  glutes: 10,
  calves: 8,
  adductors: 6,

  // Chest muscles
  upper_chest: 8,
  mid_chest: 8,
  lower_chest: 6,

  // Shoulder muscles
  front_delts: 6,
  side_delts: 8,
  rear_delts: 8,

  // Arm muscles
  biceps: 10,
  triceps: 10,
  forearms: 6,

  // Core muscles
  rectus_abdominis: 8,
  obliques: 6,
  transverse_abdominis: 6,

  // Other
  cardio: 0,
};

interface MuscleGroupAnalysisProps {
  gymSessions: any[];
  onMuscleClick?: (muscle: MuscleGroup) => void;
  selectedMuscle?: MuscleGroup | null;
}

export function MuscleGroupAnalysis({
  gymSessions,
  onMuscleClick,
  selectedMuscle,
}: MuscleGroupAnalysisProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['all']);

  useEffect(() => {
    if (onMuscleClick) {
      // Add this effect to handle muscle clicks
      const handleHashChange = () => {
        const hash = window.location.hash.slice(1);
        if (hash) {
          handleMuscleClick(hash as MuscleGroup);
        }
      };

      // Handle initial hash
      handleHashChange();

      // Listen for hash changes
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, [onMuscleClick]);

  // Add this effect to respond to selectedMuscle changes
  useEffect(() => {
    if (selectedMuscle) {
      // Find the category containing the selected muscle
      const category = Object.entries(muscleCategories).find(([_, { muscles }]) =>
        muscles.includes(selectedMuscle)
      )?.[0];

      if (category) {
        // Expand only the selected category, collapse others
        setExpandedCategories([category]);
      }
    }
  }, [selectedMuscle]);

  const handleMuscleClick = (muscle: MuscleGroup) => {
    const category = Object.entries(muscleCategories).find(([_, { muscles }]) =>
      muscles.includes(muscle)
    )?.[0];

    if (category) {
      setExpandedCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));

      setTimeout(() => {
        const element = document.getElementById(muscle);
        element?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  };

  const muscleGroupStats = useMemo(() => {
    const stats = new Map<MuscleGroup, { sets: number; volume: number }>();

    // Get sessions from the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyGymSessions = gymSessions.filter((session) => new Date(session.date) >= oneWeekAgo);

    weeklyGymSessions.forEach((session) => {
      Object.entries(session.exercise_log).forEach(([exerciseName, data]: [string, any]) => {
        const exercise = findExerciseInLibrary(exerciseName);
        if (!exercise) return;

        // Count sets for primary muscle
        const primaryStats = stats.get(exercise.primaryMuscle) || {
          sets: 0,
          volume: 0,
        };
        stats.set(exercise.primaryMuscle, {
          sets: primaryStats.sets + data.sets.length,
          volume:
            primaryStats.volume +
            data.sets.reduce((acc: number, set: any) => acc + set.weight * set.reps, 0),
        });

        // Count half sets for secondary muscles
        exercise.secondaryMuscles?.forEach((muscle) => {
          const secondaryStats = stats.get(muscle) || {
            sets: 0,
            volume: 0,
          };
          stats.set(muscle, {
            sets: secondaryStats.sets + Math.ceil(data.sets.length * 0.5),
            volume:
              secondaryStats.volume +
              data.sets.reduce((acc: number, set: any) => acc + set.weight * set.reps, 0) * 0.5,
          });
        });
      });
    });

    return stats;
  }, [gymSessions]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  // Add toggle all function
  const toggleAll = () => {
    setExpandedCategories((prev) =>
      prev.length === Object.keys(muscleCategories).length ? [] : Object.keys(muscleCategories)
    );
  };

  return (
    <div className="space-y-4 mb-8 relative">
      <Button
        onClick={toggleAll}
        variant="outline"
        className="mb-2 w-full sm:w-auto text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {expandedCategories.length === Object.keys(muscleCategories).length
          ? 'Hide All Categories'
          : 'Show All Categories'}
      </Button>

      {Object.entries(muscleCategories).map(([category, { label, muscles }]) => (
        <div
          key={category}
          className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-800"
        >
          <button
            onClick={() => toggleCategory(category)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <h3
              className={`text-lg font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}
            >
              {label}
            </h3>
            <ChevronDown
              className={`w-5 h-5 text-slate-500 transition-transform ${
                expandedCategories.includes(category) ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedCategories.includes(category) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border-t border-slate-200 dark:border-slate-700">
              {muscles.map((muscle) => {
                const stats = muscleGroupStats.get(muscle as MuscleGroup) || {
                  sets: 0,
                  volume: 0,
                };
                const recommended = recommendedSets[muscle as MuscleGroup];
                const percentage = Math.min((stats.sets / recommended) * 100, 100);

                return (
                  <div
                    key={muscle}
                    className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                    id={muscle}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-slate-900 dark:text-slate-100 capitalize">
                        {muscle.replace(/_/g, ' ')}
                      </h4>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {stats.sets}/{recommended} sets
                      </span>
                    </div>

                    <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                          percentage >= 100
                            ? 'bg-green-500'
                            : percentage >= 75
                            ? 'bg-blue-500'
                            : percentage >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between items-center">
                        <span>Weekly Volume:</span>
                        <span className="font-medium">
                          {Math.round(stats.volume).toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
