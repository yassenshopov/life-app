'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { X, Pencil, Plus } from 'lucide-react';
import { DayEntry } from '@/types/day-entry';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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
  const [isOpen, setIsOpen] = useState(false);

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
    if (!sleepTime || !wakeTime || !deepSleep || !remSleep || !awakeTime)
      return;

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
          restingHeartRate: restingHeartRate
            ? parseInt(restingHeartRate)
            : null,
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {todayEntry && hasMeaningfulSleepData ? (
            <>
              <Pencil className="h-4 w-4" />
              Edit Daily Data
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Record Daily Data
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Record Today's Data <br />(
            {new Date(todayEntry?.date ?? new Date()).toLocaleDateString(
              'en-US',
              {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }
            )}
            )
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">
                Sleep Time (24h) <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                required
                step="60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">
                Wake Time (24h) <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                required
                step="60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">
                Deep Sleep % <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={deepSleep}
                onChange={(e) => setDeepSleep(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">
                REM Sleep % <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={remSleep}
                onChange={(e) => setRemSleep(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium cursor-pointer">
              Awake Time (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={awakeTime}
              onChange={(e) => setAwakeTime(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium cursor-pointer">
              Resting Heart Rate (bpm)
            </label>
            <input
              type="number"
              min="30"
              max="200"
              value={restingHeartRate}
              onChange={(e) => setRestingHeartRate(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">
                Steps
              </label>
              <input
                type="number"
                min="0"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">
                Weight (kg)
              </label>
              <input
                type="number"
                min="30"
                max="200"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button
            onClick={async () => {
              await handleSubmit();
              setIsOpen(false);
            }}
            disabled={
              !sleepTime ||
              !wakeTime ||
              !deepSleep ||
              !remSleep ||
              !awakeTime ||
              isSubmitting
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Saving...
              </span>
            ) : (
              'Save Data'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
