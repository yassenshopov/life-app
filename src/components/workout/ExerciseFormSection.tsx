import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronUp, Trash2, Scale, Info } from 'lucide-react';
import { WorkoutExercise } from '@/types/workout';
import { Dispatch, SetStateAction } from 'react';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { calculateORM } from '@/lib/utils';

interface ExerciseFormSectionProps {
  selectedExercises: WorkoutExercise[];
  setFormState: Dispatch<SetStateAction<any>>;
  collapsedExercises: Set<number>;
  toggleExercise: (index: number) => void;
  userWeight?: number;
  exerciseHistory?: Record<
    string,
    {
      date: Date;
      sets: { reps: number; weight: number }[];
    }
  >;
  previousSessionExercises?: WorkoutExercise[];
}

const BODYWEIGHT_EXERCISES = new Set(['Pull-ups', 'Push-ups', 'Dips']);

export const ExerciseFormSection = ({
  selectedExercises,
  setFormState,
  collapsedExercises,
  toggleExercise,
  userWeight = 75,
  exerciseHistory = {},
  previousSessionExercises,
}: ExerciseFormSectionProps) => {
  return (
    <>
      {previousSessionExercises && previousSessionExercises.length > 0 && (
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => {
              setFormState((prev: any) => ({
                ...prev,
                selectedExercises: [...previousSessionExercises],
              }));
            }}
            className="w-full sm:w-auto"
          >
            Copy Previous Session Exercises
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectedExercises.map((exercise, index) => (
          <div
            key={index}
            className="border rounded-lg p-4 dark:border-slate-700 bg-slate-50/50 dark:bg-transparent shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">
                  {exercise.name}
                </h3>
                {exerciseHistory[exercise.name] && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-slate-500" />
                      </TooltipTrigger>
                      <TooltipContent className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-800 dark:text-slate-200">
                              Last session:{' '}
                              {format(
                                exerciseHistory[exercise.name].date,
                                'MMM d'
                              )}
                            </span>
                          </div>
                          {exerciseHistory[exercise.name].sets.map((set, i) => (
                            <div
                              key={i}
                              className="text-sm text-slate-500 dark:text-slate-400"
                            >
                              Set {i + 1}: {set.reps}×{set.weight}kg
                            </div>
                          ))}
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                            Best est. 1RM:{' '}
                            {Math.max(
                              ...exerciseHistory[exercise.name].sets.map(
                                (set) => calculateORM(set.weight, set.reps)
                              )
                            )}
                            kg
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newExercises = [...selectedExercises];
                    newExercises.splice(index, 1);
                    setFormState((prev: any) => ({
                      ...prev,
                      selectedExercises: newExercises,
                    }));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExercise(index)}
                >
                  {collapsedExercises.has(index) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {!collapsedExercises.has(index) && (
              <div className="mt-4">
                {exercise.sets.map((set, setIndex) => (
                  <div key={setIndex} className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-500 w-10">
                      Set {setIndex + 1}
                    </span>
                    <input
                      type="number"
                      placeholder="Reps"
                      className="w-20 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-2 shadow-sm focus:border-slate-300 focus:ring-1 focus:ring-slate-300 focus:bg-white"
                      value={set.reps || ''}
                      onChange={(e) => {
                        const newExercises = [...selectedExercises];
                        newExercises[index].sets[setIndex].reps = Number(
                          e.target.value
                        );
                        setFormState((prev: any) => ({
                          ...prev,
                          selectedExercises: newExercises,
                        }));
                      }}
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-500">
                      ×
                    </span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="Weight"
                        className="w-20 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 p-2 shadow-sm focus:border-slate-300 focus:ring-1 focus:ring-slate-300 focus:bg-white"
                        value={set.weight || ''}
                        onChange={(e) => {
                          const newExercises = [...selectedExercises];
                          newExercises[index].sets[setIndex].weight = Number(
                            e.target.value
                          );
                          setFormState((prev: any) => ({
                            ...prev,
                            selectedExercises: newExercises,
                          }));
                        }}
                      />
                      {BODYWEIGHT_EXERCISES.has(exercise.name) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newExercises = [...selectedExercises];
                            newExercises[index].sets[setIndex].weight =
                              userWeight;
                            setFormState((prev: any) => ({
                              ...prev,
                              selectedExercises: newExercises,
                            }));
                          }}
                        >
                          <Scale className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-500">
                      kg
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newExercises = [...selectedExercises];
                        newExercises[index].sets.splice(setIndex, 1);
                        setFormState((prev: any) => ({
                          ...prev,
                          selectedExercises: newExercises,
                        }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent"
                  onClick={() => {
                    const newExercises = [...selectedExercises];
                    const lastSet =
                      newExercises[index].sets[
                        newExercises[index].sets.length - 1
                      ];
                    newExercises[index].sets.push({
                      reps: lastSet?.reps || 0,
                      weight: lastSet?.weight || 0,
                    });
                    setFormState((prev: any) => ({
                      ...prev,
                      selectedExercises: newExercises,
                    }));
                  }}
                >
                  Add Set
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};
