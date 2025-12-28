'use client';

import React, { useMemo } from 'react';
import { Bed, Heart, Scale, Footprints } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TrackingEntry } from '@/components/TrackingView';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface TrackingEntryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: TrackingEntry | null;
  allEntries?: TrackingEntry[];
}

// Helper to extract value from property
function extractPropertyValue(prop: { type: string; value: any } | undefined | Record<string, never>): any {
  if (!prop || typeof prop !== 'object' || !('type' in prop) || !('value' in prop) || prop.value === null || prop.value === undefined) return null;
  
  const { value } = prop;
  
  // Handle formula results
  if (prop.type === 'formula' && value && typeof value === 'object') {
    if (value.type === 'number' && value.number !== undefined) return value.number;
    if (value.type === 'string' && value.string) return value.string;
    if (value.type === 'boolean' && value.boolean !== undefined) return value.boolean;
  }
  
  // Handle nested structures
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.date) return value.date;
    if (value.number !== undefined) return value.number;
  }
  
  return value;
}

// Format duration in hours to "X hr Y min"
function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

// Format duration in minutes to "Xh Ym" or "Ym"
function formatDurationShort(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

// Sleep stage configuration
const SLEEP_STAGES = [
  {
    key: 'awake',
    label: 'Awake',
    color: 'bg-orange-500',
    optimalRange: { min: 0, max: 5 }, // 0-5% of total sleep
  },
  {
    key: 'rem',
    label: 'REM',
    color: 'bg-cyan-400',
    optimalRange: { min: 20, max: 25 }, // 20-25% of total sleep
  },
  {
    key: 'light',
    label: 'Core',
    color: 'bg-blue-500',
    optimalRange: { min: 45, max: 55 }, // 45-55% of total sleep (Light/Core)
  },
  {
    key: 'deep',
    label: 'Deep',
    color: 'bg-purple-600',
    optimalRange: { min: 13, max: 23 }, // 13-23% of total sleep
  },
] as const;

// Progress bar with optimal range indicators
function SleepStageBar({
  label,
  duration,
  percentage,
  color,
  optimalRange,
}: {
  label: string;
  duration: string;
  percentage: number;
  color: string;
  optimalRange: { min: number; max: number };
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground">{duration}</span>
      </div>
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        {/* Optimal range indicators (dotted lines) */}
        <div
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground/30"
          style={{ left: `${optimalRange.min}%` }}
        />
        <div
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground/30"
          style={{ left: `${optimalRange.max}%` }}
        />
        {/* Progress bar */}
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function TrackingEntryDetailModal({
  isOpen,
  onClose,
  entry,
  allEntries = [],
}: TrackingEntryDetailModalProps) {
  // Extract sleep-related data
  const sleepData = useMemo(() => {
    if (!entry) return null;
    if (!entry.properties) return null;

    const props = entry.properties;
    
    // Extract sleep values
    const sleepHours = extractPropertyValue(props['Sleep [h]'] || props['Sleep'] || {});
    const deepSleepPercent = extractPropertyValue(props['Deep Sleep %'] || {});
    const lightSleepPercent = extractPropertyValue(props['Light Sleep %'] || {});
    const remSleepPercent = extractPropertyValue(props['REM Sleep %'] || {});
    const deepSleepHours = extractPropertyValue(props['Deep Sleep [h]'] || {});
    const remSleepHours = extractPropertyValue(props['REM Sleep [h]'] || {});
    const awakeTime = extractPropertyValue(props['AwakeTime [min]'] || {});
    const sleepRange = extractPropertyValue(props['Sleep range'] || {});
    const awoke = extractPropertyValue(props['Awoke'] || {});
    const goneToSleep = extractPropertyValue(props['Gone to Sleep'] || {});
    const rhr = extractPropertyValue(props['RHR [bpm]'] || props['RHR'] || {});
    const tiredness = extractPropertyValue(props['Tiredness'] || {});

    if (sleepHours === null) return null;

    // Calculate percentages (handle both decimal and percentage formats)
    const deepPercent = deepSleepPercent !== null 
      ? (deepSleepPercent < 1 ? deepSleepPercent * 100 : deepSleepPercent)
      : (deepSleepHours !== null && sleepHours > 0 ? (deepSleepHours / sleepHours) * 100 : null);
    
    const remPercent = remSleepPercent !== null
      ? (remSleepPercent < 1 ? remSleepPercent * 100 : remSleepPercent)
      : (remSleepHours !== null && sleepHours > 0 ? (remSleepHours / sleepHours) * 100 : null);

    const awakePercent = awakeTime !== null && sleepHours > 0
      ? (awakeTime / 60 / sleepHours) * 100
      : null;

    // Calculate light sleep percentage
    const lightPercent = lightSleepPercent !== null
      ? (lightSleepPercent < 1 ? lightSleepPercent * 100 : lightSleepPercent)
      : (deepPercent !== null && remPercent !== null && awakePercent !== null
        ? Math.max(0, 100 - deepPercent - remPercent - (awakePercent || 0))
        : null);

    // Calculate hours for each stage
    const totalSleepMinutes = sleepHours * 60;
    const awakeMinutes = awakeTime || 0;
    const deepMinutes = deepSleepHours ? deepSleepHours * 60 : (deepPercent ? (deepPercent / 100) * totalSleepMinutes : 0);
    const remMinutes = remSleepHours ? remSleepHours * 60 : (remPercent ? (remPercent / 100) * totalSleepMinutes : 0);
    const lightMinutes = totalSleepMinutes - deepMinutes - remMinutes - awakeMinutes;

    // Parse sleep range to extract in-bed times
    let inBedStart = null;
    let inBedEnd = null;
    if (sleepRange && typeof sleepRange === 'string') {
      const match = sleepRange.match(/(\d{1,2}):(\d{2})\s*—\s*(\d{1,2}):(\d{2})/);
      if (match) {
        inBedStart = `${match[1].padStart(2, '0')}:${match[2]}`;
        inBedEnd = `${match[3].padStart(2, '0')}:${match[4]}`;
      }
    }

    return {
      sleepHours,
      sleepMinutes: totalSleepMinutes,
      deepSleepPercent: deepPercent,
      lightSleepPercent: lightPercent,
      remSleepPercent: remPercent,
      awakePercent,
      deepSleepHours: deepMinutes / 60,
      remSleepHours: remMinutes / 60,
      lightSleepHours: lightMinutes / 60,
      awakeTime: awakeMinutes,
      sleepRange,
      inBedStart,
      inBedEnd,
      rhr,
      tiredness,
      weight: extractPropertyValue(props['Weight [kg]'] || props['Weight'] || {}),
      steps: extractPropertyValue(props['Steps'] || {}),
    };
  }, [entry]);

  // Get entry date for sorting
  const entryDate = useMemo(() => {
    if (!entry || !entry.properties) return null;
    const dateProp = entry.properties['Date'] || entry.properties['date'];
    if (!dateProp) return null;
    const dateValue = extractPropertyValue(dateProp);
    if (typeof dateValue === 'string') return dateValue;
    if (dateValue?.start) return dateValue.start;
    return null;
  }, [entry]);

  // Early return checks - moved after all hooks
  if (!entry) return null;

  // Prepare sleep stages data
  const sleepStages = useMemo(() => {
    if (!sleepData) return [];
    
    const stages = [];
    
    if (sleepData.awakePercent !== null && sleepData.awakeTime > 0) {
      stages.push({
        ...SLEEP_STAGES[0],
        duration: formatDurationShort(sleepData.awakeTime),
        percentage: sleepData.awakePercent,
      });
    }
    
    if (sleepData.remSleepPercent !== null) {
      stages.push({
        ...SLEEP_STAGES[1],
        duration: formatDuration(sleepData.remSleepHours),
        percentage: sleepData.remSleepPercent,
      });
    }
    
    if (sleepData.lightSleepPercent !== null) {
      stages.push({
        ...SLEEP_STAGES[2],
        duration: formatDuration(sleepData.lightSleepHours),
        percentage: sleepData.lightSleepPercent,
      });
    }
    
    if (sleepData.deepSleepPercent !== null) {
      stages.push({
        ...SLEEP_STAGES[3],
        duration: formatDuration(sleepData.deepSleepHours),
        percentage: sleepData.deepSleepPercent,
      });
    }
    
    return stages;
  }, [sleepData]);

  // Prepare RHR trend data (14 before, current, 14 after)
  const rhrTrendData = useMemo(() => {
    if (!entry || !sleepData?.rhr || allEntries.length === 0) return null;

    // Sort all entries by date
    const sortedEntries = [...allEntries].sort((a, b) => {
      const getDate = (e: TrackingEntry) => {
        const dateProp = e.properties?.['Date'] || e.properties?.['date'];
        if (!dateProp) return '';
        const dateValue = extractPropertyValue(dateProp);
        if (typeof dateValue === 'string') return dateValue;
        if (dateValue?.start) return dateValue.start;
        // Fallback: try to extract from title
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        return titleMatch ? titleMatch[0] : '';
      };
      return getDate(a).localeCompare(getDate(b));
    });

    // Find current entry index
    const currentIndex = sortedEntries.findIndex(e => e.id === entry.id);
    if (currentIndex === -1) return null;

    // Calculate how many entries we can get after current
    const maxAfter = sortedEntries.length - currentIndex - 1;
    const afterCount = Math.min(14, maxAfter);
    
    // Calculate how many entries we need before (14 + any missing after entries)
    const beforeCount = 14 + (14 - afterCount);
    const startIndex = Math.max(0, currentIndex - beforeCount);
    const endIndex = Math.min(sortedEntries.length, currentIndex + afterCount + 1);

    const trendEntries = sortedEntries.slice(startIndex, endIndex);
    
    const data = trendEntries.map((e, idx) => {
      const dateProp = e.properties?.['Date'] || e.properties?.['date'];
      const dateValue = extractPropertyValue(dateProp);
      let dateStr = typeof dateValue === 'string' ? dateValue : dateValue?.start || '';
      
      // Fallback: try to extract from title
      if (!dateStr) {
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        if (titleMatch) dateStr = titleMatch[0];
      }
      
      const rhrProp = e.properties?.['RHR [bpm]'] || e.properties?.['RHR'] || {};
      const rhrValue = extractPropertyValue(rhrProp);
      const rhr = typeof rhrValue === 'number' ? rhrValue : null;

      // Format date for display
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

      // Calculate relative index from current entry
      const relativeIndex = startIndex + idx - currentIndex;

      return {
        date: displayDate,
        rhr: rhr,
        isCurrent: e.id === entry.id,
        isFuture: relativeIndex > 0,
      };
    }).filter(d => d.rhr !== null);

    if (data.length <= 1) return null;

    // Split into past (including current) and future
    const currentIdx = data.findIndex(d => d.isCurrent);
    
    // Create data with separate keys for past and future to ensure proper alignment
    const chartData = data.map((d, idx) => ({
      ...d,
      rhrPast: idx <= currentIdx ? d.rhr : null,
      rhrFuture: idx >= currentIdx ? d.rhr : null,
    }));

    return {
      all: chartData,
      currentIndex: currentIdx,
    };
  }, [entry, allEntries, sleepData.rhr]);

  // Prepare Weight trend data (same logic as RHR)
  const weightTrendData = useMemo(() => {
    if (!entry) return null;
    const weight = extractPropertyValue(entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'] || {});
    if (weight === null || allEntries.length === 0) return null;

    // Sort all entries by date
    const sortedEntries = [...allEntries].sort((a, b) => {
      const getDate = (e: TrackingEntry) => {
        const dateProp = e.properties?.['Date'] || e.properties?.['date'];
        if (!dateProp) return '';
        const dateValue = extractPropertyValue(dateProp);
        if (typeof dateValue === 'string') return dateValue;
        if (dateValue?.start) return dateValue.start;
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        return titleMatch ? titleMatch[0] : '';
      };
      return getDate(a).localeCompare(getDate(b));
    });

    const currentIndex = sortedEntries.findIndex(e => e.id === entry.id);
    if (currentIndex === -1) return null;

    const maxAfter = sortedEntries.length - currentIndex - 1;
    const afterCount = Math.min(14, maxAfter);
    const beforeCount = 14 + (14 - afterCount);
    const startIndex = Math.max(0, currentIndex - beforeCount);
    const endIndex = Math.min(sortedEntries.length, currentIndex + afterCount + 1);

    const trendEntries = sortedEntries.slice(startIndex, endIndex);
    
    const data = trendEntries.map((e, idx) => {
      const dateProp = e.properties?.['Date'] || e.properties?.['date'];
      const dateValue = extractPropertyValue(dateProp);
      let dateStr = typeof dateValue === 'string' ? dateValue : dateValue?.start || '';
      
      if (!dateStr) {
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        if (titleMatch) dateStr = titleMatch[0];
      }
      
      const weightProp = e.properties?.['Weight [kg]'] || e.properties?.['Weight'] || {};
      const weightValue = extractPropertyValue(weightProp);
      const weightVal = typeof weightValue === 'number' ? weightValue : null;

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

      const relativeIndex = startIndex + idx - currentIndex;

      return {
        date: displayDate,
        weight: weightVal,
        isCurrent: e.id === entry.id,
        isFuture: relativeIndex > 0,
      };
    }).filter(d => d.weight !== null);

    if (data.length <= 1) return null;

    const currentIdx = data.findIndex(d => d.isCurrent);
    
    // Create data with separate keys for past and future to ensure proper alignment
    const chartData = data.map((d, idx) => ({
      ...d,
      weightPast: idx <= currentIdx ? d.weight : null,
      weightFuture: idx >= currentIdx ? d.weight : null,
    }));

    return {
      all: chartData,
      currentIndex: currentIdx,
    };
  }, [entry, allEntries]);

  // Prepare Steps trend data (same logic as RHR)
  const stepsTrendData = useMemo(() => {
    if (!entry) return null;
    const steps = extractPropertyValue(entry.properties?.['Steps'] || {});
    if (steps === null || allEntries.length === 0) return null;

    // Sort all entries by date
    const sortedEntries = [...allEntries].sort((a, b) => {
      const getDate = (e: TrackingEntry) => {
        const dateProp = e.properties?.['Date'] || e.properties?.['date'];
        if (!dateProp) return '';
        const dateValue = extractPropertyValue(dateProp);
        if (typeof dateValue === 'string') return dateValue;
        if (dateValue?.start) return dateValue.start;
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        return titleMatch ? titleMatch[0] : '';
      };
      return getDate(a).localeCompare(getDate(b));
    });

    const currentIndex = sortedEntries.findIndex(e => e.id === entry.id);
    if (currentIndex === -1) return null;

    const maxAfter = sortedEntries.length - currentIndex - 1;
    const afterCount = Math.min(14, maxAfter);
    const beforeCount = 14 + (14 - afterCount);
    const startIndex = Math.max(0, currentIndex - beforeCount);
    const endIndex = Math.min(sortedEntries.length, currentIndex + afterCount + 1);

    const trendEntries = sortedEntries.slice(startIndex, endIndex);
    
    const data = trendEntries.map((e, idx) => {
      const dateProp = e.properties?.['Date'] || e.properties?.['date'];
      const dateValue = extractPropertyValue(dateProp);
      let dateStr = typeof dateValue === 'string' ? dateValue : dateValue?.start || '';
      
      if (!dateStr) {
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        if (titleMatch) dateStr = titleMatch[0];
      }
      
      const stepsProp = e.properties?.['Steps'] || {};
      const stepsValue = extractPropertyValue(stepsProp);
      const stepsVal = typeof stepsValue === 'number' ? stepsValue : null;

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

      const relativeIndex = startIndex + idx - currentIndex;

      return {
        date: displayDate,
        steps: stepsVal,
        isCurrent: e.id === entry.id,
        isFuture: relativeIndex > 0,
      };
    }).filter(d => d.steps !== null);

    if (data.length <= 1) return null;

    const currentIdx = data.findIndex(d => d.isCurrent);
    
    // Create data with separate keys for past and future to ensure proper alignment
    const chartData = data.map((d, idx) => ({
      ...d,
      stepsPast: idx <= currentIdx ? d.steps : null,
      stepsFuture: idx >= currentIdx ? d.steps : null,
    }));

    return {
      all: chartData,
      currentIndex: currentIdx,
    };
  }, [entry, allEntries]);

  // Get current entry index for determining future vs past
  const currentEntryIndex = useMemo(() => {
    if (!entry || allEntries.length === 0) return -1;
    const sortedEntries = [...allEntries].sort((a, b) => {
      const getDate = (e: TrackingEntry) => {
        const dateProp = e.properties?.['Date'] || e.properties?.['date'];
        if (!dateProp) return '';
        const dateValue = extractPropertyValue(dateProp);
        if (typeof dateValue === 'string') return dateValue;
        if (dateValue?.start) return dateValue.start;
        const titleMatch = e.title?.match(/\d{4}-\d{2}-\d{2}/);
        return titleMatch ? titleMatch[0] : '';
      };
      return getDate(a).localeCompare(getDate(b));
    });
    return sortedEntries.findIndex(e => e.id === entry.id);
  }, [entry, allEntries]);

  // Early return for no sleep data - moved after all hooks
  if (!sleepData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="py-12 text-center">
            <Bed className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No sleep data available for this entry</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Bed className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Sleep Report</h2>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="px-6 py-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Sleep Summary */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Sleep time</div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {formatDuration(sleepData.sleepHours)}
                </div>
              </div>
              {sleepData.inBedStart && sleepData.inBedEnd && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">In bed</div>
                  <div className="text-base font-medium text-foreground mt-1">
                    {sleepData.inBedStart} - {sleepData.inBedEnd}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sleep Stages */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground">Sleep Stages</h3>
            <div className="space-y-5">
              {sleepStages.map((stage) => (
                <SleepStageBar
                  key={stage.key}
                  label={stage.label}
                  duration={stage.duration}
                  percentage={stage.percentage}
                  color={stage.color}
                  optimalRange={stage.optimalRange}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              Optimal range
            </div>
          </div>

          {/* Health Metrics Grid - RHR, Weight, Steps side by side */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* RHR Section */}
              {sleepData.rhr !== null && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-foreground">Resting Heart Rate</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{sleepData.rhr} bpm</span>
                  </div>
                  
                  {/* RHR Trend Chart */}
                  {rhrTrendData && rhrTrendData.all.length > 1 && (
                    <div className="mt-4">
                      <div className="text-xs text-muted-foreground mb-2">14-day trend</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={rhrTrendData.all} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            domain={['dataMin - 5', 'dataMax + 5']}
                            tick={{ fontSize: 10 }}
                            label={{ value: 'bpm', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                    <p className="text-xs font-medium">{data.date}</p>
                                    <p className="text-sm font-bold text-red-500">
                                      {data.rhr} bpm
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {/* Past line (solid) */}
                          <Line
                            type="monotone"
                            dataKey="rhrPast"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={2.5}
                            connectNulls={false}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (!payload || payload.rhrPast === null || payload.rhrPast === undefined) return null;
                              if (payload.isCurrent) {
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill="hsl(var(--destructive))"
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                  />
                                );
                              }
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
                          {/* Future line (dashed) */}
                          {rhrTrendData.all.some(d => d.rhrFuture !== null && !d.isCurrent) && (
                            <Line
                              type="monotone"
                              dataKey="rhrFuture"
                              stroke="hsl(var(--destructive))"
                              strokeWidth={2.5}
                              strokeDasharray="5 5"
                              connectNulls={false}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload || payload.rhrFuture === null || payload.rhrFuture === undefined) return null;
                                // Don't show dot for current point as it's already shown in past line
                                if (payload.isCurrent) return null;
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
                          )}
                          {rhrTrendData.all.find(d => d.isCurrent) && (
                            <ReferenceLine
                              x={rhrTrendData.all.find(d => d.isCurrent)?.date}
                              stroke="hsl(var(--destructive))"
                              strokeDasharray="2 2"
                              opacity={0.5}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Weight Section */}
              {sleepData.weight !== null && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-foreground">Weight</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{sleepData.weight} kg</span>
                  </div>
                  
                  {/* Weight Trend Chart */}
                  {weightTrendData && weightTrendData.all.length > 1 && (
                    <div className="mt-4">
                      <div className="text-xs text-muted-foreground mb-2">14-day trend</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={weightTrendData.all} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            domain={['dataMin - 1', 'dataMax + 1']}
                            tick={{ fontSize: 10 }}
                            label={{ value: 'kg', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                    <p className="text-xs font-medium">{data.date}</p>
                                    <p className="text-sm font-bold text-yellow-500">
                                      {data.weight} kg
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {/* Past line (solid) */}
                          <Line
                            type="monotone"
                            dataKey="weightPast"
                            stroke="#eab308"
                            strokeWidth={2.5}
                            connectNulls={false}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (!payload || payload.weightPast === null || payload.weightPast === undefined) return null;
                              if (payload.isCurrent) {
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill="#eab308"
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                  />
                                );
                              }
                              return (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={2}
                                  fill="#eab308"
                                  opacity={0.6}
                                />
                              );
                            }}
                            activeDot={{ r: 4 }}
                          />
                          {/* Future line (dashed) */}
                          {weightTrendData.all.some(d => d.weightFuture !== null && !d.isCurrent) && (
                            <Line
                              type="monotone"
                              dataKey="weightFuture"
                              stroke="#eab308"
                              strokeWidth={2.5}
                              strokeDasharray="5 5"
                              connectNulls={false}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload || payload.weightFuture === null || payload.weightFuture === undefined) return null;
                                if (payload.isCurrent) return null;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={2}
                                    fill="#eab308"
                                    opacity={0.6}
                                  />
                                );
                              }}
                              activeDot={{ r: 4 }}
                            />
                          )}
                          {weightTrendData.all.find(d => d.isCurrent) && (
                            <ReferenceLine
                              x={weightTrendData.all.find(d => d.isCurrent)?.date}
                              stroke="#eab308"
                              strokeDasharray="2 2"
                              opacity={0.5}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Steps Section */}
              {sleepData.steps !== null && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Footprints className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-semibold text-foreground">Steps</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{sleepData.steps.toLocaleString()}</span>
                  </div>
                  
                  {/* Steps Trend Chart */}
                  {stepsTrendData && stepsTrendData.all.length > 1 && (
                    <div className="mt-4">
                      <div className="text-xs text-muted-foreground mb-2">14-day trend</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={stepsTrendData.all} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            domain={[0, 'dataMax + 1000']}
                            tick={{ fontSize: 10 }}
                            label={{ value: 'steps', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                    <p className="text-xs font-medium">{data.date}</p>
                                    <p className="text-sm font-bold text-green-500">
                                      {data.steps.toLocaleString()} steps
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          {/* Past line (solid) */}
                          <Line
                            type="monotone"
                            dataKey="stepsPast"
                            stroke="#22c55e"
                            strokeWidth={2.5}
                            connectNulls={false}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (!payload || payload.stepsPast === null || payload.stepsPast === undefined) return null;
                              if (payload.isCurrent) {
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill="#22c55e"
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                  />
                                );
                              }
                              return (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={2}
                                  fill="#22c55e"
                                  opacity={0.6}
                                />
                              );
                            }}
                            activeDot={{ r: 4 }}
                          />
                          {/* Future line (dashed) */}
                          {stepsTrendData.all.some(d => d.stepsFuture !== null && !d.isCurrent) && (
                            <Line
                              type="monotone"
                              dataKey="stepsFuture"
                              stroke="#22c55e"
                              strokeWidth={2.5}
                              strokeDasharray="5 5"
                              connectNulls={false}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload || payload.stepsFuture === null || payload.stepsFuture === undefined) return null;
                                if (payload.isCurrent) return null;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={2}
                                    fill="#22c55e"
                                    opacity={0.6}
                                  />
                                );
                              }}
                              activeDot={{ r: 4 }}
                            />
                          )}
                          {stepsTrendData.all.find(d => d.isCurrent) && (
                            <ReferenceLine
                              x={stepsTrendData.all.find(d => d.isCurrent)?.date}
                              stroke="#22c55e"
                              strokeDasharray="2 2"
                              opacity={0.5}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tiredness */}
          {sleepData.tiredness !== null && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tiredness</span>
                <span className="text-sm font-medium text-foreground">{sleepData.tiredness}/10</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
