import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { WorkoutExercise } from '@/types/workout';
import { Dispatch, SetStateAction } from 'react';

interface ExerciseFormSectionProps {
  selectedExercises: WorkoutExercise[];
  setFormState: Dispatch<SetStateAction<any>>;
  collapsedExercises: Set<number>;
  toggleExercise: (index: number) => void;
}

export const ExerciseFormSection = ({
  selectedExercises,
  setFormState,
  collapsedExercises,
  toggleExercise,
}: ExerciseFormSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {selectedExercises.map((exercise, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 dark:border-slate-700 bg-slate-50/50 dark:bg-transparent shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200">{exercise.name}</h3>
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
                  <span className="text-sm text-slate-600 dark:text-slate-500">×</span>
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
                  <span className="text-sm text-slate-600 dark:text-slate-500">kg</span>
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
                  newExercises[index].sets.push({
                    reps: 0,
                    weight: 0,
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
  );
}; 