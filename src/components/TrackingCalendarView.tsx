'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Heart, Scale, Footprints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TrackingEntry, formatStoredPropertyValue } from '@/components/TrackingView';
import { colorToRgba } from '@/lib/color-utils';

interface TrackingCalendarViewProps {
  entries: TrackingEntry[];
  currentMonth: Date;
  onNavigate: (date: Date) => void;
  onEntryClick?: (entry: TrackingEntry) => void;
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export function TrackingCalendarView({
  entries,
  currentMonth,
  onNavigate,
  onEntryClick,
  colorPalette,
}: TrackingCalendarViewProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    // Adjust for Monday as first day (0 = Sunday, so we shift)
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

    const days: (Date | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < adjustedStart; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  };

  // Find entries for a specific date
  const getEntriesForDate = (date: Date | null): TrackingEntry[] => {
    if (!date) return [];
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return entries.filter((entry) => {
      // Try to find a date property in the entry
      if (!entry.properties) return false;
      
      // Look for common date property names
      const dateProps = ['Date', 'Dates', 'date', 'dates', 'Day', 'day'];
      for (const propKey of dateProps) {
        const prop = entry.properties[propKey];
        if (prop && prop.value) {
          let entryDate: string | null = null;
          
          if (typeof prop.value === 'string') {
            entryDate = prop.value.split('T')[0]; // Extract date part from ISO string
          } else if (prop.value.start) {
            entryDate = prop.value.start.split('T')[0];
          } else if (prop.value.date?.start) {
            entryDate = prop.value.date.start.split('T')[0];
          }
          
          if (entryDate === dateStr) {
            return true;
          }
        }
      }
      
      // Fallback: check if title contains the date
      if (entry.title) {
        const titleDateMatch = entry.title.match(/\d{4}-\d{2}-\d{2}/);
        if (titleDateMatch && titleDateMatch[0] === dateStr) {
          return true;
        }
      }
      
      return false;
    });
  };

  const handlePreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onNavigate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onNavigate(newDate);
  };

  const handleToday = () => {
    onNavigate(new Date());
  };

  // Helper to extract property value
  const extractPropertyValue = (prop: { type: string; value: any } | undefined | Record<string, never>): any => {
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
  };

  // Get important properties for an entry
  const getEntryProperties = (entry: TrackingEntry) => {
    const props = entry.properties || {};
    
    const rhrProp = props['RHR [bpm]'] || props['RHR'] || {};
    const rhrValue = extractPropertyValue(rhrProp);
    const rhr = typeof rhrValue === 'number' ? rhrValue : null;

    const weightProp = props['Weight [kg]'] || props['Weight'] || {};
    const weightValue = extractPropertyValue(weightProp);
    const weight = typeof weightValue === 'number' ? weightValue : null;

    const stepsProp = props['Steps'] || {};
    const stepsValue = extractPropertyValue(stepsProp);
    const steps = typeof stepsValue === 'number' ? stepsValue : null;

    const sleepProp = props['Sleep [h]'] || props['Sleep'] || {};
    const sleepValue = extractPropertyValue(sleepProp);
    const sleep = typeof sleepValue === 'number' ? sleepValue : null;

    return { rhr, weight, steps, sleep };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold ml-2">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <Button variant="outline" onClick={handleToday} size="sm">
          Today
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card 
        className="flex-1 overflow-hidden transition-all duration-1000"
        style={colorPalette ? {
          backgroundColor: colorToRgba(colorPalette.primary, 0.1),
          borderColor: colorToRgba(colorPalette.accent, 0.3),
        } : undefined}
      >
        <div className="h-full overflow-auto">
          <div className="min-w-full">
            {/* Weekday headers */}
            <div
              className={cn(
                "grid border-b sticky top-0 z-10 transition-all duration-1000",
                !colorPalette && "bg-background"
              )}
              style={{
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                ...(colorPalette ? {
                  backgroundColor: colorToRgba(colorPalette.primary, 0.15),
                  borderBottomColor: colorToRgba(colorPalette.accent, 0.2),
                } : {}),
              }}
            >
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className="border-r last:border-r-0 p-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar weeks */}
            <div className="divide-y">
              {weeks.map((week, weekIndex) => (
                <div
                  key={weekIndex}
                  className="grid border-b last:border-b-0"
                  style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
                >
                  {week.map((day, dayIndex) => {
                    const dayEntries = getEntriesForDate(day);
                    const isTodayDate = isToday(day);
                    const isCurrentMonthDate = isCurrentMonth(day);

                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          'border-r last:border-r-0 p-2 min-h-[140px] flex flex-col',
                          !isCurrentMonthDate && 'bg-muted/30',
                          isTodayDate && 'bg-primary/5'
                        )}
                      >
                        {/* Date number */}
                        <div
                          className={cn(
                            'text-sm font-medium mb-1',
                            isTodayDate && 'text-primary font-bold',
                            !isCurrentMonthDate && 'text-muted-foreground'
                          )}
                        >
                          {day ? day.getDate() : ''}
                        </div>

                        {/* Entries */}
                        <div className="flex-1 space-y-1 overflow-y-auto">
                          {dayEntries.slice(0, 2).map((entry) => {
                            const { rhr, weight, steps, sleep } = getEntryProperties(entry);
                            
                            return (
                              <div
                                key={entry.id}
                                onClick={() => onEntryClick?.(entry)}
                                className={cn(
                                  'text-xs p-1.5 rounded cursor-pointer hover:bg-accent transition-colors',
                                  'bg-primary/10 text-primary border border-primary/20'
                                )}
                                title={entry.title}
                              >
                                <div className="truncate font-medium mb-1">{entry.title}</div>
                                <div className="grid grid-cols-2 gap-1 mt-1">
                                  <div className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <Heart className="w-2 h-2 text-red-600 dark:text-red-400 flex-shrink-0" />
                                    <span className="text-[9px] font-semibold text-red-900 dark:text-red-100 truncate">{rhr !== null && rhr !== 0 ? rhr : '-'}</span>
                                  </div>
                                  <div className="bg-yellow-100 dark:bg-yellow-900/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <Scale className="w-2 h-2 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                    <span className="text-[9px] font-semibold text-yellow-900 dark:text-yellow-100 truncate">{weight !== null && weight !== 0 ? weight.toFixed(1) : '-'}</span>
                                  </div>
                                  <div className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <Footprints className="w-2 h-2 text-green-600 dark:text-green-400 flex-shrink-0" />
                                    <span className="text-[9px] font-semibold text-green-900 dark:text-green-100 truncate">{steps !== null && steps !== 0 ? `${(steps / 1000).toFixed(0)}k` : '-'}</span>
                                  </div>
                                  <div className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <span className="text-[9px]">💤</span>
                                    <span className="text-[9px] font-semibold text-blue-900 dark:text-blue-100 truncate">{sleep !== null && sleep !== 0 ? `${sleep.toFixed(1)}h` : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {dayEntries.length > 2 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{dayEntries.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

