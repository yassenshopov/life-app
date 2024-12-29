export interface DayEntry {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  totalSleepHours: number;
  totalSleepMinutes: number;
  deepSleepPercentage: number;
  remSleepPercentage: number;
  awakeTimeMinutes: number;
  restingHeartRate: number | null;
  steps: number | null;
  weight: number | null;
} 