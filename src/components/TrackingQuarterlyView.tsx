'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Heart, Scale, Footprints, Bed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfQuarter, endOfQuarter, addQuarters, subQuarters, isThisQuarter, getYear, getQuarter } from 'date-fns';
import { TrackingEntry } from '@/components/TrackingView';

interface TrackingQuarterlyViewProps {
  entries: TrackingEntry[];
  currentYear: Date;
  onNavigate: (date: Date) => void;
  onQuarterClick?: (quarterStart: Date, quarterEnd: Date) => void;
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

interface QuarterData {
  quarterStart: Date;
  quarterEnd: Date;
  entries: TrackingEntry[];
  averages: {
    rhr: number | null;
    weight: number | null;
    steps: number | null;
    sleep: number | null;
  };
  entryCount: number;
}

export function TrackingQuarterlyView({
  entries,
  currentYear,
  onNavigate,
  onQuarterClick,
  colorPalette,
}: TrackingQuarterlyViewProps) {
  // Group entries by quarter
  const quartersData = useMemo(() => {
    const quartersMap = new Map<string, QuarterData>();
    const year = getYear(currentYear);
    
    entries.forEach((entry) => {
      const dateStr = getEntryDate(entry);
      if (!dateStr) return;
      
      try {
        const entryDate = new Date(dateStr);
        const entryYear = entryDate.getFullYear();
        
        // Only include entries from the current year
        if (entryYear !== year) return;
        
        const quarterStart = startOfQuarter(entryDate);
        const quarterEnd = endOfQuarter(entryDate);
        const quarter = getQuarter(entryDate);
        const quarterKey = `${year}-Q${quarter}`;
        
        if (!quartersMap.has(quarterKey)) {
          quartersMap.set(quarterKey, {
            quarterStart,
            quarterEnd,
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
        
        const quarterData = quartersMap.get(quarterKey)!;
        quarterData.entries.push(entry);
      } catch {
        // Skip invalid dates
      }
    });
    
    // Calculate averages for each quarter
    Array.from(quartersMap.values()).forEach((quarterData) => {
      const rhrValues: number[] = [];
      const weightValues: number[] = [];
      const stepsValues: number[] = [];
      const sleepValues: number[] = [];
      
      quarterData.entries.forEach((entry) => {
        const rhrProp = entry.properties?.['RHR [bpm]'] || entry.properties?.['RHR'] || {};
        const rhrValue = extractPropertyValue(rhrProp);
        if (typeof rhrValue === 'number') rhrValues.push(rhrValue);
        
        const weightProp = entry.properties?.['Weight [kg]'] || entry.properties?.['Weight'] || {};
        const weightValue = extractPropertyValue(weightProp);
        if (typeof weightValue === 'number') weightValues.push(weightValue);
        
        const stepsProp = entry.properties?.['Steps'] || {};
        const stepsValue = extractPropertyValue(stepsProp);
        if (typeof stepsValue === 'number') stepsValues.push(stepsValue);
        
        const sleepProp = entry.properties?.['Sleep [h]'] || entry.properties?.['Sleep'] || {};
        const sleepValue = extractPropertyValue(sleepProp);
        if (typeof sleepValue === 'number') sleepValues.push(sleepValue);
      });
      
      quarterData.averages.rhr = rhrValues.length > 0
        ? Math.round(rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length)
        : null;
      quarterData.averages.weight = weightValues.length > 0
        ? Math.round((weightValues.reduce((a, b) => a + b, 0) / weightValues.length) * 100) / 100
        : null;
      quarterData.averages.steps = stepsValues.length > 0
        ? Math.round(stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length)
        : null;
      quarterData.averages.sleep = sleepValues.length > 0
        ? Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) * 100) / 100
        : null;
      quarterData.entryCount = quarterData.entries.length;
    });
    
    // Get all 4 quarters for the year
    const allQuarters: QuarterData[] = [];
    for (let q = 1; q <= 4; q++) {
      const quarterDate = new Date(year, (q - 1) * 3, 1);
      const quarterStart = startOfQuarter(quarterDate);
      const quarterEnd = endOfQuarter(quarterDate);
      const quarterKey = `${year}-Q${q}`;
      
      if (quartersMap.has(quarterKey)) {
        allQuarters.push(quartersMap.get(quarterKey)!);
      } else {
        allQuarters.push({
          quarterStart,
          quarterEnd,
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
    
    return allQuarters;
  }, [entries, currentYear]);
  
  const handlePrevYear = () => {
    onNavigate(subQuarters(currentYear, 4));
  };
  
  const handleNextYear = () => {
    onNavigate(addQuarters(currentYear, 4));
  };
  
  const handleThisYear = () => {
    onNavigate(new Date());
  };
  
  const year = getYear(currentYear);
  const currentQuarter = getQuarter(new Date());
  const isCurrentYear = year === getYear(new Date());
  
  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handlePrevYear}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev Year
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{year}</h2>
          {isCurrentYear && (
            <Badge variant="default" className="text-xs">Current</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleThisYear}>
            This Year
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextYear}>
            Next Year
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
      
      {/* Quarters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quartersData.map((quarter, index) => {
          const quarterNum = index + 1;
          const isCurrent = isCurrentYear && quarterNum === currentQuarter;
          const { averages, entryCount } = quarter;
          const hasData = entryCount > 0;
          
          return (
            <Card
              key={`${year}-Q${quarterNum}`}
              className={cn(
                'p-4 cursor-pointer transition-all duration-1000 hover:shadow-md',
                !hasData && 'opacity-60'
              )}
              style={colorPalette ? {
                backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.15)'),
                borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)'),
              } : undefined}
              onClick={() => onQuarterClick?.(quarter.quarterStart, quarter.quarterEnd)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Q{quarterNum}</h3>
                  {isCurrent && (
                    <Badge variant="default" className="text-xs">Current</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              
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
                    <div className="text-sm font-bold text-yellow-900 dark:text-yellow-100 truncate">{averages.weight !== null && averages.weight !== 0 ? `${averages.weight.toFixed(2)} kg` : '-'}</div>
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
            </Card>
          );
        })}
      </div>
    </div>
  );
}

