'use client';

import React, { useMemo, useState } from 'react';
import {
  Heart,
  Scale,
  Footprints,
  Moon,
  LineChart as LineChartIcon,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrackingEntry, formatStoredPropertyValue } from '@/components/TrackingView';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  addQuarters,
  subQuarters,
  getQuarter,
  startOfYear,
  endOfYear,
  addYears,
  subYears,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface HealthMetricsTrendsProps {
  entries: TrackingEntry[];
  viewMode?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

type TimePeriod = 7 | 14 | 30 | 90 | 180 | 365 | 'all';
type WeekPeriod = 2 | 4 | 8 | 12 | 24 | 52 | 'all';
type MonthPeriod = 3 | 6 | 12 | 24 | 36 | 'all';
type QuarterPeriod = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 'all';
type YearPeriod = 1 | 2 | 3 | 5 | 10 | 'all';

const DAILY_TIME_PERIODS: { days: TimePeriod; label: string }[] = [
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 180, label: '180d' },
  { days: 365, label: '1y' },
  { days: 'all', label: 'All' },
];

const WEEKLY_TIME_PERIODS: { weeks: WeekPeriod; label: string }[] = [
  { weeks: 2, label: '2w' },
  { weeks: 4, label: '4w' },
  { weeks: 8, label: '8w' },
  { weeks: 12, label: '12w' },
  { weeks: 24, label: '24w' },
  { weeks: 52, label: '1y' },
  { weeks: 'all', label: 'All' },
];

const MONTHLY_TIME_PERIODS: { months: MonthPeriod; label: string }[] = [
  { months: 3, label: '3m' },
  { months: 6, label: '6m' },
  { months: 12, label: '1y' },
  { months: 24, label: '2y' },
  { months: 36, label: '3y' },
  { months: 'all', label: 'All' },
];

const QUARTERLY_TIME_PERIODS: { quarters: QuarterPeriod; label: string }[] = [
  { quarters: 1, label: '1q' },
  { quarters: 2, label: '2q' },
  { quarters: 3, label: '3q' },
  { quarters: 4, label: '1y' },
  { quarters: 5, label: '1.25y' },
  { quarters: 6, label: '1.5y' },
  { quarters: 8, label: '2y' },
  { quarters: 10, label: '2.5y' },
  { quarters: 'all', label: 'All' },
];

const YEARLY_TIME_PERIODS: { years: YearPeriod; label: string }[] = [
  { years: 1, label: '1y' },
  { years: 2, label: '2y' },
  { years: 3, label: '3y' },
  { years: 5, label: '5y' },
  { years: 10, label: '10y' },
  { years: 'all', label: 'All' },
];

// Helper to extract value from property (memoized for performance)
const extractPropertyValueCache = new WeakMap();
function extractPropertyValue(
  prop: { type: string; value: any } | undefined | Record<string, never>
): any {
  if (
    !prop ||
    typeof prop !== 'object' ||
    !('type' in prop) ||
    !('value' in prop) ||
    prop.value === null ||
    prop.value === undefined
  )
    return null;

  // Check cache first
  if (extractPropertyValueCache.has(prop)) {
    return extractPropertyValueCache.get(prop);
  }

  const { value } = prop;
  let result: any = null;

  // Handle formula results
  if (prop.type === 'formula' && value && typeof value === 'object') {
    if (value.type === 'number' && value.number !== undefined) result = value.number;
    else if (value.type === 'string' && value.string) result = value.string;
    else if (value.type === 'boolean' && value.boolean !== undefined) result = value.boolean;
  }

  // Handle nested structures
  if (result === null && value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.date) result = value.date;
    else if (value.number !== undefined) result = value.number;
  }

  if (result === null) {
    result = value;
  }

  // Cache the result
  extractPropertyValueCache.set(prop, result);
  return result;
}

// Optimized date extraction with caching
const dateExtractionCache = new WeakMap();
function extractEntryDate(entry: TrackingEntry): string | null {
  if (dateExtractionCache.has(entry)) {
    return dateExtractionCache.get(entry);
  }

  const dateProp = entry.properties?.['Date'] || entry.properties?.['date'];
  if (!dateProp) {
    const titleMatch = entry.title?.match(/\d{4}-\d{2}-\d{2}/);
    const result = titleMatch ? titleMatch[0] : null;
    dateExtractionCache.set(entry, result);
    return result;
  }

  const dateValue = extractPropertyValue(dateProp);
  const dateStr = typeof dateValue === 'string' ? dateValue : dateValue?.start || '';

  if (!dateStr) {
    const titleMatch = entry.title?.match(/\d{4}-\d{2}-\d{2}/);
    const result = titleMatch ? titleMatch[0] : null;
    dateExtractionCache.set(entry, result);
    return result;
  }

  dateExtractionCache.set(entry, dateStr);
  return dateStr;
}

// Cookie helper functions
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

export function HealthMetricsTrends({
  entries,
  viewMode = 'daily',
  colorPalette,
}: HealthMetricsTrendsProps) {
  const [selectedDaysPeriod, setSelectedDaysPeriod] = useState<TimePeriod>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-days-period');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([7, 14, 30, 90, 180, 365].includes(parsed)) {
          return parsed as TimePeriod;
        }
      }
    }
    return 30;
  });
  const [selectedWeeksPeriod, setSelectedWeeksPeriod] = useState<WeekPeriod>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-weeks-period');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([2, 4, 8, 12, 24, 52].includes(parsed)) {
          return parsed as WeekPeriod;
        }
      }
    }
    return 8;
  });
  const [selectedMonthsPeriod, setSelectedMonthsPeriod] = useState<MonthPeriod>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-months-period');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([3, 6, 12, 24, 36].includes(parsed)) {
          return parsed as MonthPeriod;
        }
      }
    }
    return 12;
  });
  const [selectedQuartersPeriod, setSelectedQuartersPeriod] = useState<QuarterPeriod>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-quarters-period');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([1, 2, 3, 4, 5, 6, 8, 10].includes(parsed)) {
          return parsed as QuarterPeriod;
        }
      }
    }
    return 4;
  });
  const [selectedYearsPeriod, setSelectedYearsPeriod] = useState<YearPeriod>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-years-period');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([1, 2, 3, 5, 10].includes(parsed)) {
          return parsed as YearPeriod;
        }
      }
    }
    return 3;
  });
  const [chartType, setChartType] = useState<'line' | 'bar'>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-chart-type');
      if (saved && ['line', 'bar'].includes(saved)) {
        return saved as 'line' | 'bar';
      }
    }
    return 'line';
  });
  const [showAdvancedBodyComposition, setShowAdvancedBodyComposition] = useState(false);
  const [showWeightComposition, setShowWeightComposition] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-weight-composition');
      return saved === 'true';
    }
    return false;
  });

  // Prepare chart data for the selected time period
  const chartData = useMemo(() => {
    if (entries.length === 0) return [];

    // Early filter: pre-extract dates and filter invalid entries and future dates to reduce processing
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const validEntries = entries.filter((entry) => {
      const dateStr = extractEntryDate(entry);
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d <= today;
    });

    if (validEntries.length === 0) return [];

    if (viewMode === 'yearly') {
      // Group by year
      const cutoffDate =
        selectedYearsPeriod === 'all'
          ? new Date(0) // Very old date to include all data
          : subYears(new Date(), selectedYearsPeriod);
      const yearsMap = new Map<
        string,
        {
          yearStart: Date;
          yearEnd: Date;
          entries: TrackingEntry[];
          rhrValues: number[];
          weightValues: number[];
          stepsValues: number[];
          sleepValues: number[];
          deepSleepValues: number[];
          lightSleepValues: number[];
          remSleepValues: number[];
          awakeValues: number[];
        }
      >();

      validEntries.forEach((entry) => {
        const dateStr = extractEntryDate(entry);
        if (!dateStr) return;

        try {
          const entryDate = new Date(dateStr);
          if (entryDate < cutoffDate) return;

          const yearStart = startOfYear(entryDate);
          const yearEnd = endOfYear(entryDate);
          const yearKey = format(yearStart, 'yyyy');

          if (!yearsMap.has(yearKey)) {
            yearsMap.set(yearKey, {
              yearStart,
              yearEnd,
              entries: [],
              rhrValues: [],
              weightValues: [],
              stepsValues: [],
              sleepValues: [],
              deepSleepValues: [],
              lightSleepValues: [],
              remSleepValues: [],
              awakeValues: [],
            });
          }

          const yearData = yearsMap.get(yearKey)!;
          yearData.entries.push(entry);

          const rhrProp = entry.properties?.['RHR [bpm]'] || entry.properties?.['RHR'];
          const rhrValue = extractPropertyValue(rhrProp);
          if (typeof rhrValue === 'number') yearData.rhrValues.push(rhrValue);

          const weightProp = entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'];
          const weightValue = extractPropertyValue(weightProp);
          if (typeof weightValue === 'number') yearData.weightValues.push(weightValue);

          const stepsProp = entry.properties?.['Steps'];
          const stepsValue = extractPropertyValue(stepsProp);
          if (typeof stepsValue === 'number') yearData.stepsValues.push(stepsValue);

          const sleepProp = entry.properties?.['Sleep [h]'] || entry.properties?.['Sleep'];
          const sleepValue = extractPropertyValue(sleepProp);
          if (typeof sleepValue === 'number') yearData.sleepValues.push(sleepValue);

          // Extract sleep stage percentages
          const deepSleepPercent = extractPropertyValue(entry.properties?.['Deep Sleep %']);
          const deepSleepHours = extractPropertyValue(entry.properties?.['Deep Sleep [h]']);
          const lightSleepPercent = extractPropertyValue(entry.properties?.['Light Sleep %']);
          const remSleepPercent = extractPropertyValue(entry.properties?.['REM Sleep %']);
          const remSleepHours = extractPropertyValue(entry.properties?.['REM Sleep [h]']);
          const awakeTime = extractPropertyValue(entry.properties?.['AwakeTime [min]']);

          // Calculate percentages (handle both decimal and percentage formats)
          if (sleepValue && typeof sleepValue === 'number' && sleepValue > 0) {
            const deepPercent =
              deepSleepPercent !== null
                ? deepSleepPercent < 1
                  ? deepSleepPercent * 100
                  : deepSleepPercent
                : deepSleepHours !== null && typeof deepSleepHours === 'number'
                ? (deepSleepHours / sleepValue) * 100
                : null;
            if (deepPercent !== null && typeof deepPercent === 'number')
              yearData.deepSleepValues.push(deepPercent);

            const remPercent =
              remSleepPercent !== null
                ? remSleepPercent < 1
                  ? remSleepPercent * 100
                  : remSleepPercent
                : remSleepHours !== null && typeof remSleepHours === 'number'
                ? (remSleepHours / sleepValue) * 100
                : null;
            if (remPercent !== null && typeof remPercent === 'number')
              yearData.remSleepValues.push(remPercent);

            const awakePercent =
              awakeTime !== null && typeof awakeTime === 'number'
                ? (awakeTime / 60 / sleepValue) * 100
                : null;
            if (awakePercent !== null) yearData.awakeValues.push(awakePercent);

            const lightPercent =
              lightSleepPercent !== null
                ? lightSleepPercent < 1
                  ? lightSleepPercent * 100
                  : lightSleepPercent
                : deepPercent !== null && remPercent !== null && awakePercent !== null
                ? Math.max(0, 100 - deepPercent - remPercent - (awakePercent || 0))
                : null;
            if (lightPercent !== null && typeof lightPercent === 'number')
              yearData.lightSleepValues.push(lightPercent);
          }
        } catch {
          // Skip invalid dates
        }
      });

      // Convert to chart data with yearly averages
      return Array.from(yearsMap.values())
        .sort((a, b) => a.yearStart.getTime() - b.yearStart.getTime())
        .map((yearData) => {
          const rhr =
            yearData.rhrValues.length > 0
              ? Math.round(
                  yearData.rhrValues.reduce((a, b) => a + b, 0) / yearData.rhrValues.length
                )
              : null;
          const weight =
            yearData.weightValues.length > 0
              ? Math.round(
                  (yearData.weightValues.reduce((a, b) => a + b, 0) /
                    yearData.weightValues.length) *
                    100
                ) / 100
              : null;
          const steps =
            yearData.stepsValues.length > 0
              ? Math.round(
                  yearData.stepsValues.reduce((a, b) => a + b, 0) / yearData.stepsValues.length
                )
              : null;
          const sleep =
            yearData.sleepValues.length > 0
              ? Math.round(
                  (yearData.sleepValues.reduce((a, b) => a + b, 0) / yearData.sleepValues.length) *
                    100
                ) / 100
              : null;
          const deepSleep =
            yearData.deepSleepValues.length > 0
              ? Math.round(
                  (yearData.deepSleepValues.reduce((a, b) => a + b, 0) /
                    yearData.deepSleepValues.length) *
                    100
                ) / 100
              : null;
          const lightSleep =
            yearData.lightSleepValues.length > 0
              ? Math.round(
                  (yearData.lightSleepValues.reduce((a, b) => a + b, 0) /
                    yearData.lightSleepValues.length) *
                    100
                ) / 100
              : null;
          const remSleep =
            yearData.remSleepValues.length > 0
              ? Math.round(
                  (yearData.remSleepValues.reduce((a, b) => a + b, 0) /
                    yearData.remSleepValues.length) *
                    100
                ) / 100
              : null;
          const awake =
            yearData.awakeValues.length > 0
              ? Math.round(
                  (yearData.awakeValues.reduce((a, b) => a + b, 0) / yearData.awakeValues.length) *
                    100
                ) / 100
              : null;

          const displayDate = format(yearData.yearStart, 'yyyy');

          return {
            date: displayDate,
            fullDate: format(yearData.yearStart, 'yyyy'),
            rhr,
            weight,
            steps,
            sleep,
            deepSleep,
            lightSleep,
            remSleep,
            awake,
          };
        });
    } else if (viewMode === 'quarterly') {
      // Group by quarter
      const cutoffDate =
        selectedQuartersPeriod === 'all'
          ? new Date(0) // Very old date to include all data
          : subQuarters(new Date(), selectedQuartersPeriod);
      const quartersMap = new Map<
        string,
        {
          quarterStart: Date;
          quarterEnd: Date;
          entries: TrackingEntry[];
          rhrValues: number[];
          weightValues: number[];
          stepsValues: number[];
          sleepValues: number[];
          deepSleepValues: number[];
          lightSleepValues: number[];
          remSleepValues: number[];
          awakeValues: number[];
        }
      >();

      validEntries.forEach((entry) => {
        const dateStr = extractEntryDate(entry);
        if (!dateStr) return;

        try {
          const entryDate = new Date(dateStr);
          if (entryDate < cutoffDate) return;

          const quarterStart = startOfQuarter(entryDate);
          const quarterEnd = endOfQuarter(entryDate);
          const quarter = getQuarter(entryDate);
          const year = format(quarterStart, 'yyyy');
          const quarterKey = `${year}-Q${quarter}`;

          if (!quartersMap.has(quarterKey)) {
            quartersMap.set(quarterKey, {
              quarterStart,
              quarterEnd,
              entries: [],
              rhrValues: [],
              weightValues: [],
              stepsValues: [],
              sleepValues: [],
              deepSleepValues: [],
              lightSleepValues: [],
              remSleepValues: [],
              awakeValues: [],
            });
          }

          const quarterData = quartersMap.get(quarterKey)!;
          quarterData.entries.push(entry);

          const rhrProp = entry.properties?.['RHR [bpm]'] || entry.properties?.['RHR'];
          const rhrValue = extractPropertyValue(rhrProp);
          if (typeof rhrValue === 'number') quarterData.rhrValues.push(rhrValue);

          const weightProp = entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'];
          const weightValue = extractPropertyValue(weightProp);
          if (typeof weightValue === 'number') quarterData.weightValues.push(weightValue);

          const stepsProp = entry.properties?.['Steps'];
          const stepsValue = extractPropertyValue(stepsProp);
          if (typeof stepsValue === 'number') quarterData.stepsValues.push(stepsValue);

          const sleepProp = entry.properties?.['Sleep [h]'] || entry.properties?.['Sleep'];
          const sleepValue = extractPropertyValue(sleepProp);
          if (typeof sleepValue === 'number') quarterData.sleepValues.push(sleepValue);

          // Extract sleep stage percentages
          const deepSleepPercent = extractPropertyValue(entry.properties?.['Deep Sleep %']);
          const deepSleepHours = extractPropertyValue(entry.properties?.['Deep Sleep [h]']);
          const lightSleepPercent = extractPropertyValue(entry.properties?.['Light Sleep %']);
          const remSleepPercent = extractPropertyValue(entry.properties?.['REM Sleep %']);
          const remSleepHours = extractPropertyValue(entry.properties?.['REM Sleep [h]']);
          const awakeTime = extractPropertyValue(entry.properties?.['AwakeTime [min]']);

          // Calculate percentages (handle both decimal and percentage formats)
          if (sleepValue && typeof sleepValue === 'number' && sleepValue > 0) {
            const deepPercent =
              deepSleepPercent !== null
                ? deepSleepPercent < 1
                  ? deepSleepPercent * 100
                  : deepSleepPercent
                : deepSleepHours !== null && typeof deepSleepHours === 'number'
                ? (deepSleepHours / sleepValue) * 100
                : null;
            if (deepPercent !== null && typeof deepPercent === 'number')
              quarterData.deepSleepValues.push(deepPercent);

            const remPercent =
              remSleepPercent !== null
                ? remSleepPercent < 1
                  ? remSleepPercent * 100
                  : remSleepPercent
                : remSleepHours !== null && typeof remSleepHours === 'number'
                ? (remSleepHours / sleepValue) * 100
                : null;
            if (remPercent !== null && typeof remPercent === 'number')
              quarterData.remSleepValues.push(remPercent);

            const awakePercent =
              awakeTime !== null && typeof awakeTime === 'number'
                ? (awakeTime / 60 / sleepValue) * 100
                : null;
            if (awakePercent !== null) quarterData.awakeValues.push(awakePercent);

            const lightPercent =
              lightSleepPercent !== null
                ? lightSleepPercent < 1
                  ? lightSleepPercent * 100
                  : lightSleepPercent
                : deepPercent !== null && remPercent !== null && awakePercent !== null
                ? Math.max(0, 100 - deepPercent - remPercent - (awakePercent || 0))
                : null;
            if (lightPercent !== null && typeof lightPercent === 'number')
              quarterData.lightSleepValues.push(lightPercent);
          }
        } catch {
          // Skip invalid dates
        }
      });

      // Convert to chart data with quarterly averages
      return Array.from(quartersMap.values())
        .sort((a, b) => a.quarterStart.getTime() - b.quarterStart.getTime())
        .map((quarterData) => {
          const rhr =
            quarterData.rhrValues.length > 0
              ? Math.round(
                  quarterData.rhrValues.reduce((a, b) => a + b, 0) / quarterData.rhrValues.length
                )
              : null;
          const weight =
            quarterData.weightValues.length > 0
              ? Math.round(
                  (quarterData.weightValues.reduce((a, b) => a + b, 0) /
                    quarterData.weightValues.length) *
                    100
                ) / 100
              : null;
          const steps =
            quarterData.stepsValues.length > 0
              ? Math.round(
                  quarterData.stepsValues.reduce((a, b) => a + b, 0) /
                    quarterData.stepsValues.length
                )
              : null;
          const sleep =
            quarterData.sleepValues.length > 0
              ? Math.round(
                  (quarterData.sleepValues.reduce((a, b) => a + b, 0) /
                    quarterData.sleepValues.length) *
                    100
                ) / 100
              : null;
          const deepSleep =
            quarterData.deepSleepValues.length > 0
              ? Math.round(
                  (quarterData.deepSleepValues.reduce((a, b) => a + b, 0) /
                    quarterData.deepSleepValues.length) *
                    100
                ) / 100
              : null;
          const lightSleep =
            quarterData.lightSleepValues.length > 0
              ? Math.round(
                  (quarterData.lightSleepValues.reduce((a, b) => a + b, 0) /
                    quarterData.lightSleepValues.length) *
                    100
                ) / 100
              : null;
          const remSleep =
            quarterData.remSleepValues.length > 0
              ? Math.round(
                  (quarterData.remSleepValues.reduce((a, b) => a + b, 0) /
                    quarterData.remSleepValues.length) *
                    100
                ) / 100
              : null;
          const awake =
            quarterData.awakeValues.length > 0
              ? Math.round(
                  (quarterData.awakeValues.reduce((a, b) => a + b, 0) /
                    quarterData.awakeValues.length) *
                    100
                ) / 100
              : null;

          const quarter = getQuarter(quarterData.quarterStart);
          const year = format(quarterData.quarterStart, 'yyyy');
          const displayDate = `${year} Q${quarter}`;

          return {
            date: displayDate,
            fullDate: format(quarterData.quarterStart, 'yyyy-MM'),
            rhr,
            weight,
            steps,
            sleep,
            deepSleep,
            lightSleep,
            remSleep,
            awake,
          };
        });
    } else if (viewMode === 'monthly') {
      // Group by month
      const cutoffDate =
        selectedMonthsPeriod === 'all'
          ? new Date(0) // Very old date to include all data
          : subMonths(new Date(), selectedMonthsPeriod);
      const monthsMap = new Map<
        string,
        {
          monthStart: Date;
          monthEnd: Date;
          entries: TrackingEntry[];
          rhrValues: number[];
          weightValues: number[];
          stepsValues: number[];
          sleepValues: number[];
          deepSleepValues: number[];
          lightSleepValues: number[];
          remSleepValues: number[];
          awakeValues: number[];
        }
      >();

      validEntries.forEach((entry) => {
        const dateStr = extractEntryDate(entry);
        if (!dateStr) return;

        try {
          const entryDate = new Date(dateStr);
          if (entryDate < cutoffDate) return;

          const monthStart = startOfMonth(entryDate);
          const monthEnd = endOfMonth(entryDate);
          const monthKey = format(monthStart, 'yyyy-MM');

          if (!monthsMap.has(monthKey)) {
            monthsMap.set(monthKey, {
              monthStart,
              monthEnd,
              entries: [],
              rhrValues: [],
              weightValues: [],
              stepsValues: [],
              sleepValues: [],
              deepSleepValues: [],
              lightSleepValues: [],
              remSleepValues: [],
              awakeValues: [],
            });
          }

          const monthData = monthsMap.get(monthKey)!;
          monthData.entries.push(entry);

          const rhrProp = entry.properties?.['RHR [bpm]'] || entry.properties?.['RHR'];
          const rhrValue = extractPropertyValue(rhrProp);
          if (typeof rhrValue === 'number') monthData.rhrValues.push(rhrValue);

          const weightProp = entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'];
          const weightValue = extractPropertyValue(weightProp);
          if (typeof weightValue === 'number') monthData.weightValues.push(weightValue);

          const stepsProp = entry.properties?.['Steps'];
          const stepsValue = extractPropertyValue(stepsProp);
          if (typeof stepsValue === 'number') monthData.stepsValues.push(stepsValue);

          const sleepProp = entry.properties?.['Sleep [h]'] || entry.properties?.['Sleep'];
          const sleepValue = extractPropertyValue(sleepProp);
          if (typeof sleepValue === 'number') monthData.sleepValues.push(sleepValue);

          // Extract sleep stage percentages
          const deepSleepPercent = extractPropertyValue(entry.properties?.['Deep Sleep %']);
          const deepSleepHours = extractPropertyValue(entry.properties?.['Deep Sleep [h]']);
          const lightSleepPercent = extractPropertyValue(entry.properties?.['Light Sleep %']);
          const remSleepPercent = extractPropertyValue(entry.properties?.['REM Sleep %']);
          const remSleepHours = extractPropertyValue(entry.properties?.['REM Sleep [h]']);
          const awakeTime = extractPropertyValue(entry.properties?.['AwakeTime [min]']);

          // Calculate percentages (handle both decimal and percentage formats)
          if (sleepValue && typeof sleepValue === 'number' && sleepValue > 0) {
            const deepPercent =
              deepSleepPercent !== null
                ? deepSleepPercent < 1
                  ? deepSleepPercent * 100
                  : deepSleepPercent
                : deepSleepHours !== null && typeof deepSleepHours === 'number'
                ? (deepSleepHours / sleepValue) * 100
                : null;
            if (deepPercent !== null && typeof deepPercent === 'number')
              monthData.deepSleepValues.push(deepPercent);

            const remPercent =
              remSleepPercent !== null
                ? remSleepPercent < 1
                  ? remSleepPercent * 100
                  : remSleepPercent
                : remSleepHours !== null && typeof remSleepHours === 'number'
                ? (remSleepHours / sleepValue) * 100
                : null;
            if (remPercent !== null && typeof remPercent === 'number')
              monthData.remSleepValues.push(remPercent);

            const awakePercent =
              awakeTime !== null && typeof awakeTime === 'number'
                ? (awakeTime / 60 / sleepValue) * 100
                : null;
            if (awakePercent !== null) monthData.awakeValues.push(awakePercent);

            const lightPercent =
              lightSleepPercent !== null
                ? lightSleepPercent < 1
                  ? lightSleepPercent * 100
                  : lightSleepPercent
                : deepPercent !== null && remPercent !== null && awakePercent !== null
                ? Math.max(0, 100 - deepPercent - remPercent - (awakePercent || 0))
                : null;
            if (lightPercent !== null && typeof lightPercent === 'number')
              monthData.lightSleepValues.push(lightPercent);
          }
        } catch {
          // Skip invalid dates
        }
      });

      // Convert to chart data with monthly averages
      return Array.from(monthsMap.values())
        .sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime())
        .map((monthData) => {
          const rhr =
            monthData.rhrValues.length > 0
              ? Math.round(
                  monthData.rhrValues.reduce((a, b) => a + b, 0) / monthData.rhrValues.length
                )
              : null;
          const weight =
            monthData.weightValues.length > 0
              ? Math.round(
                  (monthData.weightValues.reduce((a, b) => a + b, 0) /
                    monthData.weightValues.length) *
                    100
                ) / 100
              : null;
          const steps =
            monthData.stepsValues.length > 0
              ? Math.round(
                  monthData.stepsValues.reduce((a, b) => a + b, 0) / monthData.stepsValues.length
                )
              : null;
          const sleep =
            monthData.sleepValues.length > 0
              ? Math.round(
                  (monthData.sleepValues.reduce((a, b) => a + b, 0) /
                    monthData.sleepValues.length) *
                    100
                ) / 100
              : null;
          const deepSleep =
            monthData.deepSleepValues.length > 0
              ? Math.round(
                  (monthData.deepSleepValues.reduce((a, b) => a + b, 0) /
                    monthData.deepSleepValues.length) *
                    100
                ) / 100
              : null;
          const lightSleep =
            monthData.lightSleepValues.length > 0
              ? Math.round(
                  (monthData.lightSleepValues.reduce((a, b) => a + b, 0) /
                    monthData.lightSleepValues.length) *
                    100
                ) / 100
              : null;
          const remSleep =
            monthData.remSleepValues.length > 0
              ? Math.round(
                  (monthData.remSleepValues.reduce((a, b) => a + b, 0) /
                    monthData.remSleepValues.length) *
                    100
                ) / 100
              : null;
          const awake =
            monthData.awakeValues.length > 0
              ? Math.round(
                  (monthData.awakeValues.reduce((a, b) => a + b, 0) /
                    monthData.awakeValues.length) *
                    100
                ) / 100
              : null;

          const displayDate = format(monthData.monthStart, 'MMM yyyy');

          return {
            date: displayDate,
            fullDate: format(monthData.monthStart, 'yyyy-MM'),
            rhr,
            weight,
            steps,
            sleep,
            deepSleep,
            lightSleep,
            remSleep,
            awake,
          };
        });
    } else if (viewMode === 'weekly') {
      // Group by week
      const cutoffDate =
        selectedWeeksPeriod === 'all'
          ? new Date(0) // Very old date to include all data
          : subWeeks(new Date(), selectedWeeksPeriod);
      const weeksMap = new Map<
        string,
        {
          weekStart: Date;
          weekEnd: Date;
          entries: TrackingEntry[];
          rhrValues: number[];
          weightValues: number[];
          stepsValues: number[];
          sleepValues: number[];
          deepSleepValues: number[];
          lightSleepValues: number[];
          remSleepValues: number[];
          awakeValues: number[];
        }
      >();

      validEntries.forEach((entry) => {
        const dateStr = extractEntryDate(entry);
        if (!dateStr) return;

        try {
          const entryDate = new Date(dateStr);
          if (entryDate < cutoffDate) return;

          const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(entryDate, { weekStartsOn: 1 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');

          if (!weeksMap.has(weekKey)) {
            weeksMap.set(weekKey, {
              weekStart,
              weekEnd,
              entries: [],
              rhrValues: [],
              weightValues: [],
              stepsValues: [],
              sleepValues: [],
              deepSleepValues: [],
              lightSleepValues: [],
              remSleepValues: [],
              awakeValues: [],
            });
          }

          const weekData = weeksMap.get(weekKey)!;
          weekData.entries.push(entry);

          const rhrProp = entry.properties?.['RHR [bpm]'] || entry.properties?.['RHR'];
          const rhrValue = extractPropertyValue(rhrProp);
          if (typeof rhrValue === 'number') weekData.rhrValues.push(rhrValue);

          const weightProp = entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'];
          const weightValue = extractPropertyValue(weightProp);
          if (typeof weightValue === 'number') weekData.weightValues.push(weightValue);

          const stepsProp = entry.properties?.['Steps'];
          const stepsValue = extractPropertyValue(stepsProp);
          if (typeof stepsValue === 'number') weekData.stepsValues.push(stepsValue);

          const sleepProp = entry.properties?.['Sleep [h]'] || entry.properties?.['Sleep'];
          const sleepValue = extractPropertyValue(sleepProp);
          if (typeof sleepValue === 'number') weekData.sleepValues.push(sleepValue);

          // Extract sleep stage percentages
          const deepSleepPercent = extractPropertyValue(entry.properties?.['Deep Sleep %']);
          const deepSleepHours = extractPropertyValue(entry.properties?.['Deep Sleep [h]']);
          const lightSleepPercent = extractPropertyValue(entry.properties?.['Light Sleep %']);
          const remSleepPercent = extractPropertyValue(entry.properties?.['REM Sleep %']);
          const remSleepHours = extractPropertyValue(entry.properties?.['REM Sleep [h]']);
          const awakeTime = extractPropertyValue(entry.properties?.['AwakeTime [min]']);

          // Calculate percentages (handle both decimal and percentage formats)
          if (sleepValue && typeof sleepValue === 'number' && sleepValue > 0) {
            const deepPercent =
              deepSleepPercent !== null
                ? deepSleepPercent < 1
                  ? deepSleepPercent * 100
                  : deepSleepPercent
                : deepSleepHours !== null && typeof deepSleepHours === 'number'
                ? (deepSleepHours / sleepValue) * 100
                : null;
            if (deepPercent !== null && typeof deepPercent === 'number')
              weekData.deepSleepValues.push(deepPercent);

            const remPercent =
              remSleepPercent !== null
                ? remSleepPercent < 1
                  ? remSleepPercent * 100
                  : remSleepPercent
                : remSleepHours !== null && typeof remSleepHours === 'number'
                ? (remSleepHours / sleepValue) * 100
                : null;
            if (remPercent !== null && typeof remPercent === 'number')
              weekData.remSleepValues.push(remPercent);

            const awakePercent =
              awakeTime !== null && typeof awakeTime === 'number'
                ? (awakeTime / 60 / sleepValue) * 100
                : null;
            if (awakePercent !== null) weekData.awakeValues.push(awakePercent);

            const lightPercent =
              lightSleepPercent !== null
                ? lightSleepPercent < 1
                  ? lightSleepPercent * 100
                  : lightSleepPercent
                : deepPercent !== null && remPercent !== null && awakePercent !== null
                ? Math.max(0, 100 - deepPercent - remPercent - (awakePercent || 0))
                : null;
            if (lightPercent !== null && typeof lightPercent === 'number')
              weekData.lightSleepValues.push(lightPercent);
          }
        } catch {
          // Skip invalid dates
        }
      });

      // Convert to chart data with weekly averages
      return Array.from(weeksMap.values())
        .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
        .map((weekData) => {
          const rhr =
            weekData.rhrValues.length > 0
              ? Math.round(
                  weekData.rhrValues.reduce((a, b) => a + b, 0) / weekData.rhrValues.length
                )
              : null;
          const weight =
            weekData.weightValues.length > 0
              ? Math.round(
                  (weekData.weightValues.reduce((a, b) => a + b, 0) /
                    weekData.weightValues.length) *
                    100
                ) / 100
              : null;
          const steps =
            weekData.stepsValues.length > 0
              ? Math.round(
                  weekData.stepsValues.reduce((a, b) => a + b, 0) / weekData.stepsValues.length
                )
              : null;
          const sleep =
            weekData.sleepValues.length > 0
              ? Math.round(
                  (weekData.sleepValues.reduce((a, b) => a + b, 0) / weekData.sleepValues.length) *
                    100
                ) / 100
              : null;
          const deepSleep =
            weekData.deepSleepValues.length > 0
              ? Math.round(
                  (weekData.deepSleepValues.reduce((a, b) => a + b, 0) /
                    weekData.deepSleepValues.length) *
                    100
                ) / 100
              : null;
          const lightSleep =
            weekData.lightSleepValues.length > 0
              ? Math.round(
                  (weekData.lightSleepValues.reduce((a, b) => a + b, 0) /
                    weekData.lightSleepValues.length) *
                    100
                ) / 100
              : null;
          const remSleep =
            weekData.remSleepValues.length > 0
              ? Math.round(
                  (weekData.remSleepValues.reduce((a, b) => a + b, 0) /
                    weekData.remSleepValues.length) *
                    100
                ) / 100
              : null;
          const awake =
            weekData.awakeValues.length > 0
              ? Math.round(
                  (weekData.awakeValues.reduce((a, b) => a + b, 0) / weekData.awakeValues.length) *
                    100
                ) / 100
              : null;

          const displayDate = format(weekData.weekStart, 'MMM d');

          return {
            date: displayDate,
            fullDate: format(weekData.weekStart, 'yyyy-MM-dd'),
            rhr,
            weight,
            steps,
            sleep,
            deepSleep,
            lightSleep,
            remSleep,
            awake,
          };
        });
    } else {
      // Daily view - original logic
      const cutoffDate =
        selectedDaysPeriod === 'all'
          ? new Date(0) // Very old date to include all data
          : subDays(new Date(), selectedDaysPeriod);

      // Sort entries by date
      const sortedEntries = [...validEntries].sort((a, b) => {
        const dateA = extractEntryDate(a) || '';
        const dateB = extractEntryDate(b) || '';
        return dateA.localeCompare(dateB);
      });

      // Filter entries within the time period
      const filteredEntries = sortedEntries.filter((e) => {
        const dateStr = extractEntryDate(e);
        if (!dateStr) return false;

        try {
          const entryDate = new Date(dateStr);
          return entryDate >= cutoffDate;
        } catch {
          return false;
        }
      });

      // Map to chart data format
      return filteredEntries
        .map((e) => {
          const dateStr = extractEntryDate(e);

          const rhrProp = e.properties?.['RHR [bpm]'] || e.properties?.['RHR'];
          const rhrValue = extractPropertyValue(rhrProp);
          const rhr = typeof rhrValue === 'number' ? rhrValue : null;

          const weightProp = e.properties?.['Weight [kg]'] || e.properties?.['Weight'];
          const weightValue = extractPropertyValue(weightProp);
          const weight = typeof weightValue === 'number' ? weightValue : null;

          const stepsProp = e.properties?.['Steps'];
          const stepsValue = extractPropertyValue(stepsProp);
          const steps = typeof stepsValue === 'number' ? stepsValue : null;

          const sleepProp = e.properties?.['Sleep [h]'] || e.properties?.['Sleep'];
          const sleepValue = extractPropertyValue(sleepProp);
          const sleep = typeof sleepValue === 'number' ? sleepValue : null;

          const bfPercentProp = e.properties?.['BF%'];
          const bfPercentValue = extractPropertyValue(bfPercentProp);
          const bfPercent = typeof bfPercentValue === 'number' ? bfPercentValue : null;

          const boneMineralPercentProp = e.properties?.['Bone Mineral %'];
          const boneMineralPercentValue = extractPropertyValue(boneMineralPercentProp);
          const boneMineralPercent =
            typeof boneMineralPercentValue === 'number' ? boneMineralPercentValue : null;

          const musclePercentProp = e.properties?.['Muscle %'];
          const musclePercentValue = extractPropertyValue(musclePercentProp);
          const musclePercent = typeof musclePercentValue === 'number' ? musclePercentValue : null;

          // Extract sleep stage percentages
          const deepSleepPercent = extractPropertyValue(e.properties?.['Deep Sleep %']);
          const deepSleepHours = extractPropertyValue(e.properties?.['Deep Sleep [h]']);
          const lightSleepPercent = extractPropertyValue(e.properties?.['Light Sleep %']);
          const remSleepPercent = extractPropertyValue(e.properties?.['REM Sleep %']);
          const remSleepHours = extractPropertyValue(e.properties?.['REM Sleep [h]']);
          const awakeTime = extractPropertyValue(e.properties?.['AwakeTime [min]']);

          // Calculate percentages (handle both decimal and percentage formats)
          let deepSleep = null;
          let lightSleep = null;
          let remSleep = null;
          let awake = null;

          if (sleep !== null && sleep > 0) {
            deepSleep =
              deepSleepPercent !== null
                ? deepSleepPercent < 1
                  ? deepSleepPercent * 100
                  : deepSleepPercent
                : deepSleepHours !== null && typeof deepSleepHours === 'number'
                ? (deepSleepHours / sleep) * 100
                : null;

            remSleep =
              remSleepPercent !== null
                ? remSleepPercent < 1
                  ? remSleepPercent * 100
                  : remSleepPercent
                : remSleepHours !== null && typeof remSleepHours === 'number'
                ? (remSleepHours / sleep) * 100
                : null;

            awake =
              awakeTime !== null && typeof awakeTime === 'number'
                ? (awakeTime / 60 / sleep) * 100
                : null;

            lightSleep =
              lightSleepPercent !== null
                ? lightSleepPercent < 1
                  ? lightSleepPercent * 100
                  : lightSleepPercent
                : deepSleep !== null && remSleep !== null && awake !== null
                ? Math.max(0, 100 - deepSleep - remSleep - (awake || 0))
                : null;
          }

          let displayDate = '';
          try {
            if (dateStr) {
              const date = new Date(dateStr);
              displayDate = format(date, 'MMM d');
            } else {
              displayDate = e.title || '';
            }
          } catch {
            displayDate = e.title || '';
          }

          return {
            date: displayDate,
            fullDate: dateStr,
            rhr,
            weight,
            steps,
            sleep,
            deepSleep,
            lightSleep,
            remSleep,
            awake,
            bfPercent,
            boneMineralPercent,
            musclePercent,
          };
        })
        .filter((d) => d.fullDate); // Only include entries with valid dates
    }
  }, [
    entries,
    selectedDaysPeriod,
    selectedWeeksPeriod,
    selectedMonthsPeriod,
    selectedQuartersPeriod,
    selectedYearsPeriod,
    viewMode,
  ]);

  const hasRHR = chartData.some((d) => d.rhr !== null);
  const hasWeight = chartData.some((d) => d.weight !== null);
  const hasSteps = chartData.some((d) => d.steps !== null);
  const hasSleep = chartData.some((d) => d.sleep !== null);
  const hasSleepStages = chartData.some(
    (d) => d.deepSleep !== null || d.lightSleep !== null || d.remSleep !== null || d.awake !== null
  );
  const hasBFPercent = chartData.some((d) => d.bfPercent !== null);
  const hasBoneMineralPercent = chartData.some((d) => d.boneMineralPercent !== null);
  const hasMusclePercent = chartData.some((d) => d.musclePercent !== null);
  const hasBodyComposition = hasBFPercent || hasBoneMineralPercent || hasMusclePercent;
  const hasAnyData =
    hasRHR || hasWeight || hasSteps || hasSleep || hasSleepStages || hasBodyComposition;

  // Calculate weight domain to ensure it doesn't start from 0
  const weightDomain = useMemo(() => {
    if (!hasWeight) return ['dataMin', 'dataMax'];
    const weightValues = chartData.map((d) => d.weight).filter((w): w is number => w !== null);
    if (weightValues.length === 0) return ['dataMin', 'dataMax'];
    const minWeight = Math.min(...weightValues);
    const maxWeight = Math.max(...weightValues);
    const range = maxWeight - minWeight;
    // Calculate margin: use 5% of range or at least 2kg, whichever is larger
    const margin = Math.max(range * 0.05, 2);
    // Don't force minimum to 0 - allow it to go below if needed
    const minDomain = minWeight - margin;
    const maxDomain = maxWeight + margin;
    // Return as array of numbers, not strings, to prevent Recharts from starting at 0
    return [minDomain, maxDomain];
  }, [chartData, hasWeight]);

  // Calculate body composition domain to ensure it doesn't start from 0
  const bodyCompositionDomain = useMemo(() => {
    if (!hasBodyComposition) return ['dataMin', 'dataMax'];
    // Get all weight values (both regular weight and composition totals)
    const allValues: number[] = [];
    chartData.forEach((d) => {
      if (d.weight !== null) {
        // Check if this entry has composition data
        const hasAllValues =
          d.bfPercent !== null &&
          d.boneMineralPercent !== null &&
          d.musclePercent !== null &&
          d.musclePercent < 100;

        if (hasAllValues) {
          // Calculate total from composition (percentages are already in decimal form, e.g., 0.20 for 20%)
          const total =
            d.bfPercent * d.weight + d.boneMineralPercent * d.weight + d.musclePercent * d.weight;
          allValues.push(total);
        } else {
          // Just use weight
          allValues.push(d.weight);
        }
      }
    });
    if (allValues.length === 0) return ['dataMin', 'dataMax'];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    const margin = Math.max(range * 0.05, 2);
    // Don't force minimum to 0 - allow it to go below if needed
    const minDomain = minValue - margin;
    const maxDomain = maxValue + margin;
    return [minDomain, maxDomain];
  }, [chartData, hasBodyComposition]);

  // Get latest values from entries for the metric cards
  const latestValues = useMemo(() => {
    if (entries.length === 0)
      return {
        rhr: null,
        weight: null,
        steps: null,
        sleep: null,
        deepSleep: null,
        remSleep: null,
        lightSleep: null,
        bfPercent: null,
        boneMineralPercent: null,
        musclePercent: null,
      };

    // Sort entries by date (most recent first)
    const sortedEntries = [...entries].sort((a, b) => {
      const dateA = extractEntryDate(a);
      const dateB = extractEntryDate(b);
      if (!dateA || !dateB) return 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    // Find the most recent entry with each metric
    let rhr: number | null = null;
    let weight: number | null = null;
    let steps: number | null = null;
    let sleep: number | null = null;
    let deepSleep: number | null = null;
    let remSleep: number | null = null;
    let lightSleep: number | null = null;
    let bfPercent: number | null = null;
    let boneMineralPercent: number | null = null;
    let musclePercent: number | null = null;

    for (const entry of sortedEntries) {
      if (rhr === null) {
        const rhrProp = entry.properties?.['RHR [bpm]'] || entry.properties?.['RHR'];
        const rhrValue = extractPropertyValue(rhrProp);
        if (typeof rhrValue === 'number') rhr = rhrValue;
      }
      if (weight === null) {
        const weightProp = entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'];
        const weightValue = extractPropertyValue(weightProp);
        if (typeof weightValue === 'number') weight = weightValue;
      }
      if (steps === null) {
        const stepsProp = entry.properties?.['Steps'];
        const stepsValue = extractPropertyValue(stepsProp);
        if (typeof stepsValue === 'number') steps = stepsValue;
      }
      if (sleep === null) {
        const sleepProp = entry.properties?.['Sleep [h]'] || entry.properties?.['Sleep'];
        const sleepValue = extractPropertyValue(sleepProp);
        if (typeof sleepValue === 'number') sleep = sleepValue;
      }
      if (deepSleep === null) {
        const deepSleepPercentProp = entry.properties?.['Deep Sleep %'];
        const deepSleepPercentValue = extractPropertyValue(deepSleepPercentProp);
        if (typeof deepSleepPercentValue === 'number') {
          deepSleep =
            deepSleepPercentValue < 1 ? deepSleepPercentValue * 100 : deepSleepPercentValue;
        }
      }
      if (remSleep === null) {
        const remSleepPercentProp = entry.properties?.['REM Sleep %'];
        const remSleepPercentValue = extractPropertyValue(remSleepPercentProp);
        if (typeof remSleepPercentValue === 'number') {
          remSleep = remSleepPercentValue < 1 ? remSleepPercentValue * 100 : remSleepPercentValue;
        }
      }
      if (lightSleep === null) {
        const lightSleepPercentProp = entry.properties?.['Light Sleep %'];
        const lightSleepPercentValue = extractPropertyValue(lightSleepPercentProp);
        if (typeof lightSleepPercentValue === 'number') {
          lightSleep =
            lightSleepPercentValue < 1 ? lightSleepPercentValue * 100 : lightSleepPercentValue;
        }
      }
      if (bfPercent === null) {
        const bfPercentProp = entry.properties?.['BF%'];
        const bfPercentValue = extractPropertyValue(bfPercentProp);
        if (typeof bfPercentValue === 'number') bfPercent = bfPercentValue;
      }
      if (boneMineralPercent === null) {
        const boneMineralPercentProp = entry.properties?.['Bone Mineral %'];
        const boneMineralPercentValue = extractPropertyValue(boneMineralPercentProp);
        if (typeof boneMineralPercentValue === 'number')
          boneMineralPercent = boneMineralPercentValue;
      }
      if (musclePercent === null) {
        const musclePercentProp = entry.properties?.['Muscle %'];
        const musclePercentValue = extractPropertyValue(musclePercentProp);
        if (typeof musclePercentValue === 'number') musclePercent = musclePercentValue;
      }
      if (
        rhr !== null &&
        weight !== null &&
        steps !== null &&
        sleep !== null &&
        bfPercent !== null &&
        boneMineralPercent !== null &&
        musclePercent !== null
      )
        break;
    }

    return {
      rhr,
      weight,
      steps,
      sleep,
      deepSleep,
      remSleep,
      lightSleep,
      bfPercent,
      boneMineralPercent,
      musclePercent,
    };
  }, [entries]);

  // Apply color palette to card if available
  const cardStyle = colorPalette
    ? {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.3)'),
      }
    : undefined;

  return (
    <Card className="p-6 transition-all duration-1000" style={cardStyle}>
      <div className="space-y-6">
        {/* Header with time period selector and chart type toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Health Metrics Trends</h2>
          <div className="flex items-center gap-2">
            {/* Chart Type Toggle */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={chartType === 'line' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setChartType('line');
                  setCookie('tracking-chart-type', 'line');
                }}
                className="h-7 px-2"
              >
                <LineChartIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setChartType('bar');
                  setCookie('tracking-chart-type', 'bar');
                }}
                className="h-7 px-2"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
            </div>
            {/* Time Period Selectors */}
            {viewMode === 'yearly'
              ? YEARLY_TIME_PERIODS.map((period) => (
                  <Button
                    key={period.years}
                    variant={selectedYearsPeriod === period.years ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedYearsPeriod(period.years);
                      setCookie('tracking-years-period', period.years.toString());
                    }}
                    className="h-8 px-3"
                  >
                    {period.label}
                  </Button>
                ))
              : viewMode === 'quarterly'
              ? QUARTERLY_TIME_PERIODS.map((period) => (
                  <Button
                    key={period.quarters}
                    variant={selectedQuartersPeriod === period.quarters ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedQuartersPeriod(period.quarters);
                      setCookie('tracking-quarters-period', period.quarters.toString());
                    }}
                    className="h-8 px-3"
                  >
                    {period.label}
                  </Button>
                ))
              : viewMode === 'monthly'
              ? MONTHLY_TIME_PERIODS.map((period) => (
                  <Button
                    key={period.months}
                    variant={selectedMonthsPeriod === period.months ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedMonthsPeriod(period.months);
                      setCookie('tracking-months-period', period.months.toString());
                    }}
                    className="h-8 px-3"
                  >
                    {period.label}
                  </Button>
                ))
              : viewMode === 'weekly'
              ? WEEKLY_TIME_PERIODS.map((period) => (
                  <Button
                    key={period.weeks}
                    variant={selectedWeeksPeriod === period.weeks ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedWeeksPeriod(period.weeks);
                      setCookie('tracking-weeks-period', period.weeks.toString());
                    }}
                    className="h-8 px-3"
                  >
                    {period.label}
                  </Button>
                ))
              : DAILY_TIME_PERIODS.map((period) => (
                  <Button
                    key={period.days}
                    variant={selectedDaysPeriod === period.days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedDaysPeriod(period.days);
                      setCookie('tracking-days-period', period.days.toString());
                    }}
                    className="h-8 px-3"
                  >
                    {period.label}
                  </Button>
                ))}
          </div>
        </div>

        {/* Metric Cards */}
        {(latestValues.rhr !== null ||
          latestValues.weight !== null ||
          latestValues.steps !== null ||
          latestValues.sleep !== null ||
          latestValues.deepSleep !== null ||
          latestValues.remSleep !== null ||
          latestValues.lightSleep !== null ||
          latestValues.bfPercent !== null ||
          latestValues.boneMineralPercent !== null ||
          latestValues.musclePercent !== null) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {latestValues.rhr !== null && (
              <div className="bg-red-100 dark:bg-red-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Heart className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-red-700 dark:text-red-300 font-medium">
                    Resting Heart Rate
                  </div>
                  <div className="text-xl font-bold text-red-900 dark:text-red-100">
                    {latestValues.rhr} bpm
                  </div>
                </div>
              </div>
            )}
            {latestValues.weight !== null && (
              <div className="bg-yellow-100 dark:bg-yellow-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Scale className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                    Weight
                  </div>
                  <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">
                    {latestValues.weight.toFixed(1)} kg
                  </div>
                </div>
              </div>
            )}
            {latestValues.sleep !== null && (
              <div className="bg-purple-100 dark:bg-purple-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                    Sleep
                  </div>
                  <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {latestValues.sleep.toFixed(1)} h
                  </div>
                </div>
              </div>
            )}
            {latestValues.steps !== null && (
              <div className="bg-green-100 dark:bg-green-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Footprints className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                    Steps
                  </div>
                  <div className="text-xl font-bold text-green-900 dark:text-green-100">
                    {latestValues.steps.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
            {latestValues.deepSleep !== null && (
              <div className="bg-purple-100 dark:bg-purple-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                    Deep Sleep %
                  </div>
                  <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    {latestValues.deepSleep.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
            {latestValues.remSleep !== null && (
              <div className="bg-cyan-100 dark:bg-cyan-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Moon className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">
                    REM Sleep %
                  </div>
                  <div className="text-xl font-bold text-cyan-900 dark:text-cyan-100">
                    {latestValues.remSleep.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
            {latestValues.lightSleep !== null && (
              <div className="bg-blue-100 dark:bg-blue-900/40 px-5 py-4 rounded-2xl flex items-center gap-3">
                <Moon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Light Sleep %
                  </div>
                  <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {latestValues.lightSleep.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
            {latestValues.bfPercent !== null && (
              <div
                className="px-5 py-4 rounded-2xl flex items-center gap-3"
                style={{ backgroundColor: 'rgba(139, 69, 19, 0.1)' }}
              >
                <Scale className="w-5 h-5 flex-shrink-0" style={{ color: '#8b4513' }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: '#8b4513' }}>
                    Body Fat %
                  </div>
                  <div className="text-xl font-bold" style={{ color: '#8b4513' }}>
                    {(latestValues.bfPercent < 1
                      ? latestValues.bfPercent * 100
                      : latestValues.bfPercent
                    ).toFixed(1)}
                    %
                  </div>
                </div>
              </div>
            )}
            {latestValues.boneMineralPercent !== null && (
              <div
                className="px-5 py-4 rounded-2xl flex items-center gap-3"
                style={{ backgroundColor: 'rgba(245, 245, 220, 0.3)' }}
              >
                <Scale className="w-5 h-5 flex-shrink-0" style={{ color: '#8b7355' }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: '#8b7355' }}>
                    Bone Mineral %
                  </div>
                  <div className="text-xl font-bold" style={{ color: '#8b7355' }}>
                    {(latestValues.boneMineralPercent < 1
                      ? latestValues.boneMineralPercent * 100
                      : latestValues.boneMineralPercent
                    ).toFixed(1)}
                    %
                  </div>
                </div>
              </div>
            )}
            {latestValues.bfPercent !== null && latestValues.boneMineralPercent !== null && (
              <div
                className="px-5 py-4 rounded-2xl flex items-center gap-3"
                style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}
              >
                <Scale className="w-5 h-5 flex-shrink-0" style={{ color: '#dc2626' }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: '#dc2626' }}>
                    Muscle %
                  </div>
                  <div className="text-xl font-bold" style={{ color: '#dc2626' }}>
                    {(() => {
                      // Calculate muscle % from BF% and Bone Mineral %
                      const bf =
                        latestValues.bfPercent < 1
                          ? latestValues.bfPercent * 100
                          : latestValues.bfPercent;
                      const bone =
                        latestValues.boneMineralPercent < 1
                          ? latestValues.boneMineralPercent * 100
                          : latestValues.boneMineralPercent;
                      const muscle = Math.max(0, 100 - bf - bone);
                      return muscle.toFixed(1);
                    })()}
                    %
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasAnyData ? (
          <div className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No health metrics data available</div>
            <div className="text-sm text-muted-foreground">
              Data will appear here once you have entries with RHR, Weight, or Steps
            </div>
          </div>
        ) : (
          /* Charts Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* RHR Chart */}
            {hasRHR && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-foreground">Resting Heart Rate</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  {chartType === 'line' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="rhrAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={['dataMin - 5', 'dataMax + 5']}
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'bpm',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                            return (
                              <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                <p className="text-xs font-medium">
                                  {data.date} {year && !data.date.includes(year) && `(${year})`}
                                </p>
                                <p className="text-sm font-bold text-red-500">{data.rhr} bpm</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="rhr"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2.5}
                        fill="url(#rhrAreaGradient)"
                        dot={(props: any) => {
                          const { cx, cy } = props;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={2}
                              fill="hsl(var(--destructive))"
                              opacity={0.6}
                            />
                          );
                        }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="rhrGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.8} />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--destructive))"
                            stopOpacity={0.3}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={['dataMin - 5', 'dataMax + 5']}
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'bpm',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                            return (
                              <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                <p className="text-xs font-medium">
                                  {data.date} {year && !data.date.includes(year) && `(${year})`}
                                </p>
                                <p className="text-sm font-bold text-red-500">{data.rhr} bpm</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="rhr" fill="url(#rhrGradient)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Weight Chart */}
            {hasWeight && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-foreground">Weight</span>
                  </div>
                  {hasBodyComposition && (
                    <div className="flex items-center gap-1 border rounded-md p-1">
                      <Button
                        variant={!showWeightComposition ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setShowWeightComposition(false);
                          setCookie('tracking-weight-composition', 'false');
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Weight
                      </Button>
                      <Button
                        variant={showWeightComposition ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setShowWeightComposition(true);
                          setCookie('tracking-weight-composition', 'true');
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Composition
                      </Button>
                    </div>
                  )}
                </div>
                {showWeightComposition &&
                hasBodyComposition &&
                chartData.some((d) => {
                  // Only show stacked chart if ALL three composition values are present and muscle % is not 100
                  return (
                    d.bfPercent !== null &&
                    d.boneMineralPercent !== null &&
                    d.musclePercent !== null &&
                    d.musclePercent < 100
                  );
                }) ? (
                  // Body Composition Stacked Chart
                  (() => {
                    // Transform chartData to show actual kg values instead of percentages
                    // Percentages already come as percentages (not decimals), so no need to divide by 100
                    // Include ALL entries - show weight bar when composition is missing
                    const bodyCompositionData = chartData.map((d) => {
                      const totalWeight = d.weight || 0;
                      // Check if this entry has all three values and muscle % is not 100
                      const hasAllValues =
                        d.bfPercent !== null &&
                        d.boneMineralPercent !== null &&
                        d.musclePercent !== null &&
                        d.musclePercent < 100;

                      if (!hasAllValues) {
                        // Missing composition data - show weight bar if weight is available
                        return {
                          ...d,
                          bfKg: null,
                          boneMineralKg: null,
                          muscleKg: null,
                          weightKg: d.weight !== null ? d.weight : null, // Show weight as a separate bar
                        };
                      }

                      return {
                        ...d,
                        bfKg:
                          d.bfPercent !== null && totalWeight > 0
                            ? d.bfPercent * totalWeight
                            : null,
                        boneMineralKg:
                          d.boneMineralPercent !== null && totalWeight > 0
                            ? d.boneMineralPercent * totalWeight
                            : null,
                        muscleKg:
                          d.musclePercent !== null && totalWeight > 0
                            ? d.musclePercent * totalWeight
                            : null,
                        weightKg: null, // Don't show weight bar when we have composition data
                      };
                    });
                    // Don't filter - keep all entries

                    // Add a calculated total field for Y-axis scaling
                    // This ensures Recharts can properly calculate dataMin/dataMax ignoring null values
                    const bodyCompositionDataWithTotal = bodyCompositionData.map((d) => {
                      let total = null;
                      // If we have composition data, calculate total
                      if (d.bfKg !== null || d.boneMineralKg !== null || d.muscleKg !== null) {
                        total = (d.bfKg || 0) + (d.boneMineralKg || 0) + (d.muscleKg || 0);
                      } else if (d.weightKg !== null) {
                        // Otherwise use weight
                        total = d.weightKg;
                      }
                      return {
                        ...d,
                        total, // This will be used for Y-axis domain calculation
                      };
                    });

                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={bodyCompositionDataWithTotal}
                          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="bfKgGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b4513" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#8b4513" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="boneMineralKgGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f5f5dc" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#f5f5dc" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="muscleKgGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#dc2626" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="weightKgGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#eab308" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#eab308" stopOpacity={0.3} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            domain={bodyCompositionDomain}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => `${value.toFixed(1)}kg`}
                            label={{
                              value: 'kg',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 10 },
                            }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                    <p className="text-xs font-medium mb-2">
                                      {data.date} {year && !data.date.includes(year) && `(${year})`}
                                    </p>
                                    {data.bfKg !== null && (
                                      <p className="text-xs text-amber-800">
                                        Body Fat: {Number(data.bfKg).toFixed(2)}kg (
                                        {data.bfPercent !== null
                                          ? Number(data.bfPercent).toFixed(1)
                                          : '-'}
                                        %)
                                      </p>
                                    )}
                                    {data.boneMineralKg !== null && (
                                      <p className="text-xs text-amber-700">
                                        Bone Mineral: {Number(data.boneMineralKg).toFixed(2)}kg (
                                        {data.boneMineralPercent !== null
                                          ? Number(data.boneMineralPercent).toFixed(1)
                                          : '-'}
                                        %)
                                      </p>
                                    )}
                                    {data.muscleKg !== null && (
                                      <p className="text-xs text-red-600">
                                        Muscle: {Number(data.muscleKg).toFixed(2)}kg (
                                        {data.musclePercent !== null
                                          ? Number(data.musclePercent).toFixed(1)
                                          : '-'}
                                        %)
                                      </p>
                                    )}
                                    {data.weightKg !== null && (
                                      <p className="text-xs text-yellow-600">
                                        Weight: {Number(data.weightKg).toFixed(2)}kg
                                      </p>
                                    )}
                                    {data.weight !== null && (
                                      <p className="text-xs font-semibold mt-1 text-foreground">
                                        Total: {data.weight?.toFixed(2)}kg
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar
                            dataKey="bfKg"
                            stackId="body"
                            fill="url(#bfKgGradient)"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="boneMineralKg"
                            stackId="body"
                            fill="url(#boneMineralKgGradient)"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="muscleKg"
                            stackId="body"
                            fill="url(#muscleKgGradient)"
                            radius={[0, 0, 0, 0]}
                          />
                          {/* Weight bar for entries missing composition data */}
                          <Bar
                            dataKey="weightKg"
                            stackId="body"
                            fill="url(#weightKgGradient)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  // Regular Weight Chart
                  <ResponsiveContainer width="100%" height={200}>
                    {chartType === 'line' ? (
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <defs>
                          <linearGradient id="weightAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis
                          domain={weightDomain}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'kg',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fontSize: 10 },
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                              return (
                                <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                  <p className="text-xs font-medium">
                                    {data.date} {year && !data.date.includes(year) && `(${year})`}
                                  </p>
                                  <p className="text-sm font-bold text-yellow-500">
                                    {data.weight?.toFixed(2)} kg
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="weight"
                          stroke="#eab308"
                          strokeWidth={2.5}
                          fill="url(#weightAreaGradient)"
                          dot={(props: any) => {
                            const { cx, cy } = props;
                            return <circle cx={cx} cy={cy} r={2} fill="#eab308" opacity={0.6} />;
                          }}
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    ) : (
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <defs>
                          <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#eab308" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#eab308" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis
                          domain={weightDomain}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'kg',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fontSize: 10 },
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                              return (
                                <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                  <p className="text-xs font-medium">
                                    {data.date} {year && !data.date.includes(year) && `(${year})`}
                                  </p>
                                  <p className="text-sm font-bold text-yellow-500">
                                    {data.weight?.toFixed(2)} kg
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="weight" fill="url(#weightGradient)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Steps Chart */}
            {hasSteps && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-foreground">Steps</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  {chartType === 'line' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="stepsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={[0, 'dataMax + 1000']}
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'steps',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                            return (
                              <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                <p className="text-xs font-medium">
                                  {data.date} {year && !data.date.includes(year) && `(${year})`}
                                </p>
                                <p className="text-sm font-bold text-green-500">
                                  {data.steps.toLocaleString()} steps
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="steps"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        fill="url(#stepsAreaGradient)"
                        dot={(props: any) => {
                          const { cx, cy } = props;
                          return <circle cx={cx} cy={cy} r={2} fill="#22c55e" opacity={0.6} />;
                        }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={[0, 'dataMax + 1000']}
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'steps',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                            return (
                              <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                <p className="text-xs font-medium">
                                  {data.date} {year && !data.date.includes(year) && `(${year})`}
                                </p>
                                <p className="text-sm font-bold text-green-500">
                                  {data.steps.toLocaleString()} steps
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="steps" fill="url(#stepsGradient)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Sleep Chart */}
            {hasSleep && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-foreground">Sleep</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  {chartType === 'line' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="sleepAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={[0, 'dataMax + 1']}
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'h',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                            return (
                              <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                <p className="text-xs font-medium">
                                  {data.date} {year && !data.date.includes(year) && `(${year})`}
                                </p>
                                <p className="text-sm font-bold text-purple-500">
                                  {data.sleep?.toFixed(2)} h
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sleep"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        fill="url(#sleepAreaGradient)"
                        dot={(props: any) => {
                          const { cx, cy } = props;
                          return <circle cx={cx} cy={cy} r={2} fill="#a855f7" opacity={0.6} />;
                        }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis
                        domain={[0, 'dataMax + 1']}
                        tick={{ fontSize: 10 }}
                        label={{
                          value: 'h',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 10 },
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                            return (
                              <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                <p className="text-xs font-medium">
                                  {data.date} {year && !data.date.includes(year) && `(${year})`}
                                </p>
                                <p className="text-sm font-bold text-purple-500">
                                  {data.sleep?.toFixed(2)} h
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="sleep" fill="url(#sleepGradient)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Advanced Body Composition Section */}
            {hasBodyComposition && (
              <div className="md:col-span-3 space-y-3">
                <button
                  onClick={() => setShowAdvancedBodyComposition(!showAdvancedBodyComposition)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-foreground focus:outline-none"
                >
                  <span>Advanced Body Composition</span>
                  {showAdvancedBodyComposition ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {showAdvancedBodyComposition && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* BF% Chart */}
                    {hasBFPercent && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-amber-800" />
                          <span className="text-sm font-semibold text-foreground">Body Fat %</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          {chartType === 'line' ? (
                            <AreaChart
                              data={chartData.filter(
                                (d) => d.bfPercent !== null && d.bfPercent < 100
                              )}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient
                                  id="bfPercentAreaGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="5%" stopColor="#8b4513" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#8b4513" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                domain={['dataMin - 1', 'dataMax + 1']}
                                tick={{ fontSize: 10 }}
                                label={{
                                  value: '%',
                                  angle: -90,
                                  position: 'insideLeft',
                                  style: { fontSize: 10 },
                                }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const year = data.fullDate
                                      ? data.fullDate.substring(0, 4)
                                      : null;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                        <p className="text-xs font-medium">
                                          {data.date}{' '}
                                          {year && !data.date.includes(year) && `(${year})`}
                                        </p>
                                        <p className="text-sm font-bold text-amber-800">
                                          {(data.bfPercent < 1
                                            ? data.bfPercent * 100
                                            : data.bfPercent
                                          )?.toFixed(2)}
                                          %
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="bfPercent"
                                stroke="#8b4513"
                                strokeWidth={2.5}
                                fill="url(#bfPercentAreaGradient)"
                                dot={(props: any) => {
                                  const { cx, cy } = props;
                                  return (
                                    <circle cx={cx} cy={cy} r={2} fill="#8b4513" opacity={0.6} />
                                  );
                                }}
                                activeDot={{ r: 4 }}
                              />
                            </AreaChart>
                          ) : (
                            <BarChart
                              data={chartData.filter(
                                (d) => d.bfPercent !== null && d.bfPercent < 100
                              )}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient id="bfPercentGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#8b4513" stopOpacity={0.8} />
                                  <stop offset="100%" stopColor="#8b4513" stopOpacity={0.3} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                domain={['dataMin - 1', 'dataMax + 1']}
                                tick={{ fontSize: 10 }}
                                label={{
                                  value: '%',
                                  angle: -90,
                                  position: 'insideLeft',
                                  style: { fontSize: 10 },
                                }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const year = data.fullDate
                                      ? data.fullDate.substring(0, 4)
                                      : null;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                        <p className="text-xs font-medium">
                                          {data.date}{' '}
                                          {year && !data.date.includes(year) && `(${year})`}
                                        </p>
                                        <p className="text-sm font-bold text-amber-800">
                                          {(data.bfPercent < 1
                                            ? data.bfPercent * 100
                                            : data.bfPercent
                                          )?.toFixed(2)}
                                          %
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar
                                dataKey="bfPercent"
                                fill="url(#bfPercentGradient)"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Bone Mineral % Chart */}
                    {hasBoneMineralPercent && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-amber-700" />
                          <span className="text-sm font-semibold text-foreground">
                            Bone Mineral %
                          </span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          {chartType === 'line' ? (
                            <AreaChart
                              data={chartData.filter(
                                (d) => d.boneMineralPercent !== null && d.boneMineralPercent < 100
                              )}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient
                                  id="boneMineralPercentAreaGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="5%" stopColor="#f5f5dc" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#f5f5dc" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                tick={{ fontSize: 10 }}
                                label={{
                                  value: '%',
                                  angle: -90,
                                  position: 'insideLeft',
                                  style: { fontSize: 10 },
                                }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const year = data.fullDate
                                      ? data.fullDate.substring(0, 4)
                                      : null;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                        <p className="text-xs font-medium">
                                          {data.date}{' '}
                                          {year && !data.date.includes(year) && `(${year})`}
                                        </p>
                                        <p className="text-sm font-bold text-amber-700">
                                          {(data.boneMineralPercent < 1
                                            ? data.boneMineralPercent * 100
                                            : data.boneMineralPercent
                                          )?.toFixed(2)}
                                          %
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="boneMineralPercent"
                                stroke="#f5f5dc"
                                strokeWidth={2.5}
                                fill="url(#boneMineralPercentAreaGradient)"
                                dot={(props: any) => {
                                  const { cx, cy } = props;
                                  return (
                                    <circle cx={cx} cy={cy} r={2} fill="#f5f5dc" opacity={0.6} />
                                  );
                                }}
                                activeDot={{ r: 4 }}
                              />
                            </AreaChart>
                          ) : (
                            <BarChart
                              data={chartData.filter(
                                (d) => d.boneMineralPercent !== null && d.boneMineralPercent < 100
                              )}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient
                                  id="boneMineralPercentGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="0%" stopColor="#f5f5dc" stopOpacity={0.8} />
                                  <stop offset="100%" stopColor="#f5f5dc" stopOpacity={0.3} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                                tick={{ fontSize: 10 }}
                                label={{
                                  value: '%',
                                  angle: -90,
                                  position: 'insideLeft',
                                  style: { fontSize: 10 },
                                }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const year = data.fullDate
                                      ? data.fullDate.substring(0, 4)
                                      : null;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                        <p className="text-xs font-medium">
                                          {data.date}{' '}
                                          {year && !data.date.includes(year) && `(${year})`}
                                        </p>
                                        <p className="text-sm font-bold text-amber-700">
                                          {(data.boneMineralPercent < 1
                                            ? data.boneMineralPercent * 100
                                            : data.boneMineralPercent
                                          )?.toFixed(2)}
                                          %
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar
                                dataKey="boneMineralPercent"
                                fill="url(#boneMineralPercentGradient)"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Muscle % Chart */}
                    {hasMusclePercent && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-semibold text-foreground">Muscle %</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          {chartType === 'line' ? (
                            <AreaChart
                              data={chartData.filter(
                                (d) => d.musclePercent !== null && d.musclePercent < 100
                              )}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient
                                  id="musclePercentAreaGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                domain={['dataMin - 1', 'dataMax + 1']}
                                tick={{ fontSize: 10 }}
                                label={{
                                  value: '%',
                                  angle: -90,
                                  position: 'insideLeft',
                                  style: { fontSize: 10 },
                                }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const year = data.fullDate
                                      ? data.fullDate.substring(0, 4)
                                      : null;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                        <p className="text-xs font-medium">
                                          {data.date}{' '}
                                          {year && !data.date.includes(year) && `(${year})`}
                                        </p>
                                        <p className="text-sm font-bold text-red-600">
                                          {(data.musclePercent < 1
                                            ? data.musclePercent * 100
                                            : data.musclePercent
                                          )?.toFixed(2)}
                                          %
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="musclePercent"
                                stroke="#dc2626"
                                strokeWidth={2.5}
                                fill="url(#musclePercentAreaGradient)"
                                dot={(props: any) => {
                                  const { cx, cy } = props;
                                  return (
                                    <circle cx={cx} cy={cy} r={2} fill="#dc2626" opacity={0.6} />
                                  );
                                }}
                                activeDot={{ r: 4 }}
                              />
                            </AreaChart>
                          ) : (
                            <BarChart
                              data={chartData.filter(
                                (d) => d.musclePercent !== null && d.musclePercent < 100
                              )}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient
                                  id="musclePercentGradient"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.8} />
                                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.3} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                domain={['dataMin - 1', 'dataMax + 1']}
                                tick={{ fontSize: 10 }}
                                label={{
                                  value: '%',
                                  angle: -90,
                                  position: 'insideLeft',
                                  style: { fontSize: 10 },
                                }}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const year = data.fullDate
                                      ? data.fullDate.substring(0, 4)
                                      : null;
                                    return (
                                      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                        <p className="text-xs font-medium">
                                          {data.date}{' '}
                                          {year && !data.date.includes(year) && `(${year})`}
                                        </p>
                                        <p className="text-sm font-bold text-red-600">
                                          {(data.musclePercent < 1
                                            ? data.musclePercent * 100
                                            : data.musclePercent
                                          )?.toFixed(2)}
                                          %
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar
                                dataKey="musclePercent"
                                fill="url(#musclePercentGradient)"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sleep Stages Chart */}
            {hasSleepStages &&
              (() => {
                // Transform chartData to show actual sleep hours instead of percentages
                const sleepStagesData = chartData.map((d) => {
                  const totalSleep = d.sleep || 0;
                  return {
                    ...d,
                    deepSleepHours:
                      d.deepSleep !== null && totalSleep > 0
                        ? (d.deepSleep / 100) * totalSleep
                        : null,
                    lightSleepHours:
                      d.lightSleep !== null && totalSleep > 0
                        ? (d.lightSleep / 100) * totalSleep
                        : null,
                    remSleepHours:
                      d.remSleep !== null && totalSleep > 0
                        ? (d.remSleep / 100) * totalSleep
                        : null,
                  };
                });

                // Calculate max sleep hours for Y-axis domain
                const maxSleepHours = Math.max(
                  ...sleepStagesData.map((d) => {
                    const total =
                      (d.deepSleepHours || 0) + (d.lightSleepHours || 0) + (d.remSleepHours || 0);
                    return total;
                  }),
                  0
                );

                return (
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-semibold text-foreground">Sleep Stages</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={sleepStagesData}
                        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="deepSleepGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#9333ea" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#9333ea" stopOpacity={0.3} />
                          </linearGradient>
                          <linearGradient id="lightSleepGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                          </linearGradient>
                          <linearGradient id="remSleepGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis
                          domain={[0, maxSleepHours > 0 ? maxSleepHours + 1 : 10]}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => `${value.toFixed(1)}h`}
                          label={{
                            value: 'hours',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fontSize: 10 },
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const year = data.fullDate ? data.fullDate.substring(0, 4) : null;
                              return (
                                <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                  <p className="text-xs font-medium mb-2">
                                    {data.date} {year && !data.date.includes(year) && `(${year})`}
                                  </p>
                                  {data.deepSleepHours !== null && (
                                    <p className="text-xs text-purple-600">
                                      Deep: {Number(data.deepSleepHours).toFixed(2)}h (
                                      {data.deepSleep !== null
                                        ? Number(data.deepSleep).toFixed(1)
                                        : '-'}
                                      %)
                                    </p>
                                  )}
                                  {data.lightSleepHours !== null && (
                                    <p className="text-xs text-blue-500">
                                      Light: {Number(data.lightSleepHours).toFixed(2)}h (
                                      {data.lightSleep !== null
                                        ? Number(data.lightSleep).toFixed(1)
                                        : '-'}
                                      %)
                                    </p>
                                  )}
                                  {data.remSleepHours !== null && (
                                    <p className="text-xs text-cyan-400">
                                      REM: {Number(data.remSleepHours).toFixed(2)}h (
                                      {data.remSleep !== null
                                        ? Number(data.remSleep).toFixed(1)
                                        : '-'}
                                      %)
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="deepSleepHours"
                          stackId="sleep"
                          fill="url(#deepSleepGradient)"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="lightSleepHours"
                          stackId="sleep"
                          fill="url(#lightSleepGradient)"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="remSleepHours"
                          stackId="sleep"
                          fill="url(#remSleepGradient)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
          </div>
        )}
      </div>
    </Card>
  );
}
