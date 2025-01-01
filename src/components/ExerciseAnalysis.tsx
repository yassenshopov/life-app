'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calculateExerciseStats } from '@/lib/utils';
import { MuscleGroup } from '@/constants/muscle-groups';
import { GymSessionType, GYM_SESSION_TYPES } from '@/constants/exercises';
import { Button } from '@/components/ui/button';

interface ExerciseAnalysisProps {
  gymSessions: any[];
  onMuscleClick?: (muscle: MuscleGroup) => void;
}

export const ExerciseAnalysis = ({ gymSessions, onMuscleClick }: ExerciseAnalysisProps) => {
  const exerciseStats = calculateExerciseStats(gymSessions);
  const defaultCategory = gymSessions.length > 0 
    ? (gymSessions[0].type as GymSessionType) 
    : 'all';
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory);
  const [showUnperformed, setShowUnperformed] = useState<boolean>(false);

  const handleMuscleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    muscle: string
  ) => {
    e.preventDefault();
    if (onMuscleClick) {
      onMuscleClick(muscle as MuscleGroup);
    }
  };

  const filteredStats = exerciseStats.filter(
    (stat) => selectedCategory === 'all' || stat.category === selectedCategory
  );

  return (
    <div className="space-y-6 mb-6">
      <div className="flex items-center gap-4 mb-6">
        <Select
          value={selectedCategory}
          onValueChange={(value: string) => setSelectedCategory(value)}
        >
          <SelectTrigger className="w-[180px] bg-white dark:bg-slate-800">
            <SelectValue placeholder="All Exercises" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exercises</SelectItem>
            {GYM_SESSION_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="flex items-center gap-2">
                <span>
                  {type
                    .split('_')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {filteredStats.length} exercises
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {filteredStats
          .filter(stat => stat.maxWeight > 0 || stat.totalSets > 0)
          .map((stat) => (
            <div key={stat.name} className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  {stat.name}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Max Weight
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.maxWeight}{' '}
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Avg Weight
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.avgWeight}{' '}
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Total Sets
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.totalSets}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Total Reps
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.totalReps}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Affected Muscles:
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stat.affectedMuscles.map((muscle, index) => (
                      <a
                        key={index}
                        href={`#${muscle}`}
                        onClick={(e) => handleMuscleClick(e, muscle)}
                        className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        {muscle.charAt(0).toUpperCase() +
                          muscle.slice(1).replace('_', ' ')}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Last performed:{' '}
                  {new Date(stat.lastPerformed).toLocaleDateString() !== 'Invalid Date'
                    ? new Date(stat.lastPerformed).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '--:--'}
                </div>
              </div>
            </div>
          ))}

        {showUnperformed && filteredStats
          .filter(stat => stat.maxWeight === 0 && stat.totalSets === 0)
          .map((stat) => (
            <div key={stat.name} className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow opacity-60">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  {stat.name}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Max Weight
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.maxWeight}{' '}
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Avg Weight
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.avgWeight}{' '}
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      kg
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Total Sets
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.totalSets}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Total Reps
                  </div>
                  <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                    {stat.totalReps}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Affected Muscles:
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stat.affectedMuscles.map((muscle, index) => (
                      <a
                        key={index}
                        href={`#${muscle}`}
                        onClick={(e) => handleMuscleClick(e, muscle)}
                        className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        {muscle.charAt(0).toUpperCase() +
                          muscle.slice(1).replace('_', ' ')}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Last performed:{' '}
                  {new Date(stat.lastPerformed).toLocaleDateString() !== 'Invalid Date'
                    ? new Date(stat.lastPerformed).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '--:--'}
                </div>
              </div>
            </div>
          ))}

        {filteredStats.filter(stat => stat.maxWeight === 0 && stat.totalSets === 0).length > 0 && (
          <button
            onClick={() => setShowUnperformed(prev => !prev)}
            className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-md opacity-75 hover:opacity-100 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            {showUnperformed ? 'Hide' : `Show ${filteredStats.filter(stat => stat.maxWeight === 0 && stat.totalSets === 0).length}`} unperformed exercises...
          </button>
        )}
      </div>
    </div>
  );
}; 