'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Heart, Scale, Footprints, Bed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isThisMonth, getYear } from 'date-fns';
import { TrackingEntry } from '@/components/TrackingView';

interface TrackingMonthlyViewProps {
  entries: TrackingEntry[];
  currentYear: Date;
  onNavigate: (date: Date) => void;
  onMonthClick?: (monthStart: Date, monthEnd: Date) => void;
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

// Helper to extract property value
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

// Get entry date
function getEntryDate(entry: TrackingEntry): string | null {
  const dateProp = entry.properties?.['Date'] || entry.properties?.['date'];
  if (!dateProp) {
    const titleMatch = entry.title?.match(/\d{4}-\d{2}-\d{2}/);
    return titleMatch ? titleMatch[0] : null;
  }
  
  const dateValue = extractPropertyValue(dateProp);
  if (typeof dateValue === 'string') return dateValue.split('T')[0];
  if (dateValue?.start) return dateValue.start.split('T')[0];
  return null;
}

interface MonthData {
  monthStart: Date;
  monthEnd: Date;
  entries: TrackingEntry[];
  averages: {
    rhr: number | null;
    weight: number | null;
    steps: number | null;
    sleep: number | null;
  };
  entryCount: number;
}

export function TrackingMonthlyView({
  entries,
  currentYear,
  onNavigate,
  onMonthClick,
  colorPalette,
}: TrackingMonthlyViewProps) {
  // Group entries by month
  const monthsData = useMemo(() => {
    const monthsMap = new Map<string, MonthData>();
    const year = getYear(currentYear);
    
    entries.forEach((entry) => {
      const dateStr = getEntryDate(entry);
      if (!dateStr) return;
      
      try {
        const entryDate = new Date(dateStr);
        const entryYear = entryDate.getFullYear();
        
        // Only include entries from the current year
        if (entryYear !== year) return;
        
        const monthStart = startOfMonth(entryDate);
        const monthEnd = endOfMonth(entryDate);
        const monthKey = format(monthStart, 'yyyy-MM');
        
        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, {
            monthStart,
            monthEnd,
            entries: [],
            averages: {
              rhr: null,
              weight: null,
              steps: null,
              sleep: null,
            },
            entryCount: 0,
          });
        }
        
        const monthData = monthsMap.get(monthKey)!;
        monthData.entries.push(entry);
      } catch {
        // Skip invalid dates
      }
    });
    
    // Calculate averages for each month
    monthsMap.forEach((monthData) => {
      const rhrValues: number[] = [];
      const weightValues: number[] = [];
      const stepsValues: number[] = [];
      const sleepValues: number[] = [];
      
      monthData.entries.forEach((entry) => {
        const props = entry.properties || {};
        
        const rhrProp = props['RHR [bpm]'] || props['RHR'] || {};
        const rhrValue = extractPropertyValue(rhrProp);
        if (typeof rhrValue === 'number') rhrValues.push(rhrValue);
        
        const weightProp = props['Weight [kg]'] || props['Weight'] || {};
        const weightValue = extractPropertyValue(weightProp);
        if (typeof weightValue === 'number') weightValues.push(weightValue);
        
        const stepsProp = props['Steps'] || {};
        const stepsValue = extractPropertyValue(stepsProp);
        if (typeof stepsValue === 'number') stepsValues.push(stepsValue);
        
        const sleepProp = props['Sleep [h]'] || props['Sleep'] || {};
        const sleepValue = extractPropertyValue(sleepProp);
        if (typeof sleepValue === 'number') sleepValues.push(sleepValue);
      });
      
      monthData.averages.rhr = rhrValues.length > 0 
        ? Math.round(rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length)
        : null;
      monthData.averages.weight = weightValues.length > 0
        ? weightValues.reduce((a, b) => a + b, 0) / weightValues.length
        : null;
      monthData.averages.steps = stepsValues.length > 0
        ? Math.round(stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length)
        : null;
      monthData.averages.sleep = sleepValues.length > 0
        ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
        : null;
      
      monthData.entryCount = monthData.entries.length;
    });
    
    return Array.from(monthsMap.values()).sort((a, b) => 
      a.monthStart.getTime() - b.monthStart.getTime()
    );
  }, [entries, currentYear]);

  // Get all 12 months of the current year
  const displayMonths = useMemo(() => {
    const year = getYear(currentYear);
    const months: MonthData[] = [];
    
    // Generate all 12 months
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(year, i, 1);
      const monthEnd = endOfMonth(monthStart);
      const monthKey = format(monthStart, 'yyyy-MM');
      
      const existingMonth = monthsData.find(m => 
        format(m.monthStart, 'yyyy-MM') === monthKey
      );
      
      if (existingMonth) {
        months.push(existingMonth);
      } else {
        months.push({
          monthStart,
          monthEnd,
          entries: [],
          averages: {
            rhr: null,
            weight: null,
            steps: null,
            sleep: null,
          },
          entryCount: 0,
        });
      }
    }
    
    return months;
  }, [currentYear, monthsData]);

  const isCurrentMonth = (monthStart: Date) => {
    return isThisMonth(monthStart);
  };

  const handlePreviousYear = () => {
    const newDate = subMonths(currentYear, 12);
    onNavigate(newDate);
  };

  const handleNextYear = () => {
    const newDate = addMonths(currentYear, 12);
    onNavigate(newDate);
  };

  const handleThisYear = () => {
    onNavigate(new Date());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Year Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousYear}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextYear}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold ml-2">
            {format(currentYear, 'yyyy')}
          </h2>
        </div>
        <Button variant="outline" onClick={handleThisYear} size="sm">
          This Year
        </Button>
      </div>

      {/* Months Grid */}
      <Card 
        className="flex-1 overflow-hidden transition-all duration-1000"
        style={colorPalette ? {
          backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.1)'),
          borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.3)'),
        } : undefined}
      >
        <div className="h-full overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {displayMonths.map((month, index) => {
              const isCurrent = isCurrentMonth(month.monthStart);
              const { averages, entryCount } = month;
              const hasData = entryCount > 0;

              return (
                <Card
                  key={format(month.monthStart, 'yyyy-MM')}
                  className={cn(
                    'p-4 cursor-pointer transition-all duration-1000 hover:shadow-md',
                    !hasData && 'opacity-60'
                  )}
                  style={colorPalette ? {
                    backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.15)'),
                    borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)'),
                  } : undefined}
                  onClick={() => onMonthClick?.(month.monthStart, month.monthEnd)}
                >
                  <div className="space-y-3">
                    {/* Month Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {format(month.monthStart, 'MMMM')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                        </div>
                      </div>
                      {isCurrent && (
                        <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                          Current
                        </div>
                      )}
                    </div>

                    {/* Averages */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-red-100 dark:bg-red-900/40 px-3 py-2 rounded-xl flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-red-700 dark:text-red-300 font-medium truncate">RHR</div>
                          <div className="text-sm font-bold text-red-900 dark:text-red-100 truncate">{averages.rhr !== null && averages.rhr !== 0 ? `${averages.rhr} bpm` : '-'}</div>
                        </div>
                      </div>
                      <div className="bg-yellow-100 dark:bg-yellow-900/40 px-3 py-2 rounded-xl flex items-center gap-2">
                        <Scale className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-yellow-700 dark:text-yellow-300 font-medium truncate">Weight</div>
                          <div className="text-sm font-bold text-yellow-900 dark:text-yellow-100 truncate">{averages.weight !== null && averages.weight !== 0 ? `${averages.weight.toFixed(1)} kg` : '-'}</div>
                        </div>
                      </div>
                      <div className="bg-green-100 dark:bg-green-900/40 px-3 py-2 rounded-xl flex items-center gap-2">
                        <Footprints className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-green-700 dark:text-green-300 font-medium truncate">Steps</div>
                          <div className="text-sm font-bold text-green-900 dark:text-green-100 truncate">{averages.steps !== null && averages.steps !== 0 ? averages.steps.toLocaleString() : '-'}</div>
                        </div>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-900/40 px-3 py-2 rounded-xl flex items-center gap-2">
                        <Bed className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-blue-700 dark:text-blue-300 font-medium truncate">Sleep</div>
                          <div className="text-sm font-bold text-blue-900 dark:text-blue-100 truncate">{averages.sleep !== null && averages.sleep !== 0 ? `${averages.sleep.toFixed(1)} h` : '-'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

