'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { X, Pencil } from 'lucide-react';
import { DayEntry } from '@/types/day-entry';

interface ManualEntryFormProps {
  entries: DayEntry[];
  dateRange: { from: Date; to: Date };
  setEntries: (entries: DayEntry[]) => void;
}

export function ManualEntryForm({
  entries,
  dateRange,
  setEntries,
}: ManualEntryFormProps) {
  const [sleepTime, setSleepTime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [deepSleep, setDeepSleep] = useState('');
  const [remSleep, setRemSleep] = useState('');
  const [awakeTime, setAwakeTime] = useState('');
  const [restingHeartRate, setRestingHeartRate] = useState('');
  const [steps, setSteps] = useState('');
  const [weight, setWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  const todayEntry = entries.find(
    (entry) => entry.date === new Date().toISOString().split('T')[0]
  );

  const hasMeaningfulSleepData =
    todayEntry &&
    (todayEntry.totalSleepHours > 0 || todayEntry.totalSleepMinutes > 0);

  const setFormValues = (entry: DayEntry | undefined) => {
    if (entry) {
      // Convert times to 24-hour format
      const convertTo24Hour = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}`;
      };

      setSleepTime(convertTo24Hour(entry.sleepTime));
      setWakeTime(convertTo24Hour(entry.wakeTime));
      setDeepSleep(Math.round(entry.deepSleepPercentage).toString());
      setRemSleep(Math.round(entry.remSleepPercentage).toString());
      setAwakeTime(Math.round(entry.awakeTimeMinutes).toString());
      setRestingHeartRate(entry.restingHeartRate?.toString() || '');
      setSteps(entry.steps?.toString() || '');
      setWeight(entry.weight?.toString() || '');
    }
  };

  const handleEditClick = () => {
    if (!showUpdateForm) {
      setFormValues(todayEntry);
    } else {
      setSleepTime('');
      setWakeTime('');
      setDeepSleep('');
      setRemSleep('');
      setAwakeTime('');
      setRestingHeartRate('');
      setSteps('');
      setWeight('');
    }
    setShowUpdateForm(!showUpdateForm);
  };

  const handleSubmit = async () => {
    if (!sleepTime || !wakeTime || !deepSleep || !remSleep || !awakeTime) return;

    setIsSubmitting(true);
    setSubmitSuccess(false);

    const [sleepHour, sleepMinute] = sleepTime.split(':');
    const [wakeHour, wakeMinute] = wakeTime.split(':');

    // Find today's entry
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find((entry) => entry.date === today);

    try {
      const response = await fetch('/api/notion/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          pageId: todayEntry?.id,
          GoneToSleepH: parseInt(sleepHour),
          GoneToSleepM: parseInt(sleepMinute),
          AwokeH: parseInt(wakeHour),
          AwokeM: parseInt(wakeMinute),
          deepSleepPercentage: parseInt(deepSleep),
          remSleepPercentage: parseInt(remSleep),
          awakeTimeMinutes: parseInt(awakeTime),
          restingHeartRate: restingHeartRate ? parseInt(restingHeartRate) : null,
          steps: steps ? parseInt(steps) : null,
          weight: weight ? parseFloat(weight) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save entry');

      // Clear form and show success
      setSleepTime('');
      setWakeTime('');
      setDeepSleep('');
      setRemSleep('');
      setAwakeTime('');
      setRestingHeartRate('');
      setSteps('');
      setWeight('');
      setSubmitSuccess(true);

      // Refresh entries
      const updatedEntries = await fetch(
        `/api/notion/entries?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
      ).then((res) => res.json());
      setEntries(updatedEntries);
    } catch (error) {
      console.error('Failed to save entry:', error);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitSuccess(false), 3000);
    }
  };

  return (
    <div className="mb-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
      {todayEntry && hasMeaningfulSleepData ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-wrap gap-3 flex-grow">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-600 dark:text-slate-400">
                  Today&apos;s sleep data has been recorded:{' '}
                  {todayEntry.totalSleepHours}h {todayEntry.totalSleepMinutes}m
                </span>
              </div>
              {todayEntry.restingHeartRate ? (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-slate-600 dark:text-slate-400">
                    RHR recorded: {todayEntry.restingHeartRate} bpm
                  </span>
                </div>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-slate-600 dark:text-slate-400">
                    RHR not yet recorded
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditClick}
              className="whitespace-nowrap"
            >
              {showUpdateForm ? (
                <>
                  <X className="w-4 h-4 inline-block mr-1" />
                  Cancel edit
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 inline-block mr-1" />
                  Edit entry
                </>
              )}
            </Button>
          </div>

          {showUpdateForm && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
                Update Today's Sleep
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Sleep Time (24h)
                  </label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    required
                    step="60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Wake Time (24h)
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    required
                    step="60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Deep Sleep %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={deepSleep}
                    onChange={(e) => setDeepSleep(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    REM Sleep %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={remSleep}
                    onChange={(e) => setRemSleep(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Awake Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={awakeTime}
                    onChange={(e) => setAwakeTime(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Resting Heart Rate (bpm) - Optional
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    value={restingHeartRate}
                    onChange={(e) => setRestingHeartRate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Steps
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Weight (kg) - Optional
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !sleepTime ||
                    !wakeTime ||
                    !deepSleep ||
                    !remSleep ||
                    !awakeTime ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Saving...
                    </span>
                  ) : (
                    'Update Sleep'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            Record Today's Sleep
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Sleep Time (24h)
              </label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                required
                step="60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Wake Time (24h)
              </label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                required
                step="60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Deep Sleep %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={deepSleep}
                onChange={(e) => setDeepSleep(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                REM Sleep %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={remSleep}
                onChange={(e) => setRemSleep(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Awake Time (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={awakeTime}
                onChange={(e) => setAwakeTime(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Resting Heart Rate (bpm) - Optional
              </label>
              <input
                type="number"
                min="30"
                max="200"
                value={restingHeartRate}
                onChange={(e) => setRestingHeartRate(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Steps
              </label>
              <input
                type="number"
                min="0"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Weight (kg) - Optional
              </label>
              <input
                type="number"
                min="30"
                max="200"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
              />
            </div>
          </div>
          {/* Add the button below the grid of inputs */}
          <div className="mt-6">
            <Button
              onClick={handleSubmit}
              disabled={
                !sleepTime ||
                !wakeTime ||
                !deepSleep ||
                !remSleep ||
                !awakeTime ||
                isSubmitting
              }
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Saving...
                </span>
              ) : (
                'Record Sleep'
              )}
            </Button>
            {submitSuccess && (
              <span className="ml-4 text-green-600 dark:text-green-400 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Entry saved successfully!
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
