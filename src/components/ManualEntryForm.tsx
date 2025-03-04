'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { X, Pencil, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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
  autoOpen?: boolean;
}

export function ManualEntryForm({
  entries,
  dateRange,
  setEntries,
  autoOpen = false,
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
  const [selectedDate, setSelectedDate] = useState(new Date());

  const selectedEntry = Array.isArray(entries)
    ? entries.find((entry) => entry.date === selectedDate.toISOString().split('T')[0])
    : undefined;

  const hasMeaningfulSleepData =
    selectedEntry && (selectedEntry.totalSleepHours > 0 || selectedEntry.totalSleepMinutes > 0);

  const setFormValues = (entry: DayEntry | undefined) => {
    if (entry) {
      // Set the values directly in 24-hour format
      setSleepTime(entry.sleepTime);
      setWakeTime(entry.wakeTime);
      setDeepSleep(Math.round(entry.deepSleepPercentage).toString());
      setRemSleep(Math.round(entry.remSleepPercentage).toString());
      setAwakeTime(Math.round(entry.awakeTimeMinutes).toString());
      setRestingHeartRate(entry.restingHeartRate?.toString() || '');
      setSteps(entry.steps?.toString() || '');
      setWeight(entry.weight?.toString() || '');
    }
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);

    if (Array.isArray(entries)) {
      setFormValues(entries.find((entry) => entry.date === newDate.toISOString().split('T')[0]));
    }
  };

  const fetchEntries = useCallback(
    async (databaseId: string) => {
      const response = await fetch(
        `/api/notion/entries?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}&databaseId=${databaseId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      const data = await response.json();
      setEntries(data);
    },
    [dateRange]
  );

  const handleSubmit = async () => {
    if (!sleepTime || !wakeTime || !deepSleep || !remSleep || !awakeTime) return;

    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const credentialsResponse = await fetch('/api/user/notion-credentials');
      if (!credentialsResponse.ok) {
        throw new Error('Failed to fetch Notion credentials');
      }
      const credentials = await credentialsResponse.json();

      if (!credentials.notionDatabaseId) {
        throw new Error('Notion database ID not found');
      }

      const [sleepHour, sleepMinute] = sleepTime.split(':');
      const [wakeHour, wakeMinute] = wakeTime.split(':');

      // Convert hour 24 to 0
      const normalizedSleepHour = parseInt(sleepHour) === 24 ? 0 : parseInt(sleepHour);

      // Convert 24-hour format to 12-hour format for display
      const sleepHour12 =
        normalizedSleepHour > 12
          ? normalizedSleepHour - 12
          : normalizedSleepHour === 0
          ? 12
          : normalizedSleepHour;

      const wakeHour12 =
        parseInt(wakeHour) > 12
          ? parseInt(wakeHour) - 12
          : parseInt(wakeHour) === 0
          ? 12
          : parseInt(wakeHour);

      const entryDate = selectedDate.toISOString().split('T')[0];
      const existingEntry = entries.find((entry) => entry.date === entryDate);

      const payload = {
        date: entryDate,
        pageId: existingEntry?.id,
        databaseId: credentials.notionDatabaseId,
        GoneToSleepH: sleepHour12, // Use 12-hour format
        GoneToSleepM: parseInt(sleepMinute),
        AwokeH: wakeHour12, // Use 12-hour format
        AwokeM: parseInt(wakeMinute),
        deepSleepPercentage: parseInt(deepSleep),
        remSleepPercentage: parseInt(remSleep),
        awakeTimeMinutes: parseInt(awakeTime),
        restingHeartRate: restingHeartRate ? parseInt(restingHeartRate) : null,
        steps: steps ? parseInt(steps) : null,
        weight: weight ? parseFloat(weight) : null,
      };

      console.log('Submitting payload:', payload);

      const response = await fetch('/api/notion/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save entry');
      }

      setSubmitSuccess(true);
      await fetchEntries(credentials.notionDatabaseId);
    } catch (error) {
      console.error('Failed to save entry:', error);
      setSubmitSuccess(false);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitSuccess(false), 3000);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedDate(new Date());
    }
  };

  useEffect(() => {
    // When the dialog opens, set the form values for the selected date
    if (isOpen && Array.isArray(entries)) {
      const entry = entries.find(
        (entry) => entry.date === selectedDate.toISOString().split('T')[0]
      );
      setFormValues(entry);
    }
  }, [isOpen, selectedDate, entries]);

  // Add this useEffect to initialize with today's data when component mounts
  useEffect(() => {
    if (Array.isArray(entries)) {
      const today = new Date();
      const todayEntry = entries.find((entry) => entry.date === today.toISOString().split('T')[0]);
      setFormValues(todayEntry);
    }
  }, [entries]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = Array.isArray(entries)
      ? entries.find((entry) => entry.date === today)
      : undefined;

    // Only auto-open if there's no meaningful sleep data for today AND autoOpen is true
    const hasMeaningfulData =
      todayEntry && (todayEntry.totalSleepHours > 0 || todayEntry.totalSleepMinutes > 0);

    if (!hasMeaningfulData && autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen, entries]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {selectedEntry && hasMeaningfulSleepData ? (
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
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              Record Data for <br />
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </DialogTitle>
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange(-1)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDateChange(1)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
            <label className="text-sm font-medium cursor-pointer">Resting Heart Rate (bpm)</label>
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
              <label className="text-sm font-medium cursor-pointer">Steps</label>
              <input
                type="text"
                value={steps ? Number(steps).toLocaleString() : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/[^\d]/g, '');
                  setSteps(rawValue);
                }}
                className="w-full rounded-md border border-gray-200 bg-white dark:bg-gray-950 dark:border-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium cursor-pointer">Weight (kg)</label>
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
              !sleepTime || !wakeTime || !deepSleep || !remSleep || !awakeTime || isSubmitting
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
