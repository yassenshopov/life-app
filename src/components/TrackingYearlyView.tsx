'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Heart, Scale, Footprints, Bed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfYear, endOfYear, addYears, subYears, isThisYear, getYear } from 'date-fns';
import { TrackingEntry } from '@/components/TrackingView';

interface TrackingYearlyViewProps {
  entries: TrackingEntry[];
  currentYear: Date;
  onNavigate: (date: Date) => void;
  onYearClick?: (yearStart: Date, yearEnd: Date) => void;
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

interface YearData {
  yearStart: Date;
  yearEnd: Date;
  entries: TrackingEntry[];
  averages: {
    rhr: number | null;
    weight: number | null;
    steps: number | null;
    sleep: number | null;
  };
  entryCount: number;
}

export function TrackingYearlyView({
  entries,
  currentYear,
  onNavigate,
  onYearClick,
}: TrackingYearlyViewProps) {
  // Group entries by year
  const yearsData = useMemo(() => {
    const yearsMap = new Map<number, YearData>();
    
    entries.forEach((entry) => {
      const dateStr = getEntryDate(entry);
      if (!dateStr) return;
      
      try {
        const entryDate = new Date(dateStr);
        const entryYear = entryDate.getFullYear();
        
        const yearStart = startOfYear(entryDate);
        const yearEnd = endOfYear(entryDate);
        
        if (!yearsMap.has(entryYear)) {
          yearsMap.set(entryYear, {
            yearStart,
            yearEnd,
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
        
        const yearData = yearsMap.get(entryYear)!;
        yearData.entries.push(entry);
      } catch {
        // Skip invalid dates
      }
    });
    
    // Calculate averages for each year
    Array.from(yearsMap.values()).forEach((yearData) => {
      const rhrValues: number[] = [];
      const weightValues: number[] = [];
      const stepsValues: number[] = [];
      const sleepValues: number[] = [];
      
      yearData.entries.forEach((entry) => {
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
      
      yearData.averages.rhr = rhrValues.length > 0
        ? Math.round(rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length)
        : null;
      yearData.averages.weight = weightValues.length > 0
        ? Math.round((weightValues.reduce((a, b) => a + b, 0) / weightValues.length) * 100) / 100
        : null;
      yearData.averages.steps = stepsValues.length > 0
        ? Math.round(stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length)
        : null;
      yearData.averages.sleep = sleepValues.length > 0
        ? Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) * 100) / 100
        : null;
      yearData.entryCount = yearData.entries.length;
    });
    
    // Sort by year descending (most recent first)
    return Array.from(yearsMap.values()).sort((a, b) => 
      b.yearStart.getTime() - a.yearStart.getTime()
    );
  }, [entries]);
  
  const handlePrev = () => {
    const firstYear = yearsData.length > 0 ? getYear(yearsData[yearsData.length - 1].yearStart) : getYear(currentYear);
    onNavigate(subYears(new Date(firstYear, 0, 1), 1));
  };
  
  const handleNext = () => {
    const lastYear = yearsData.length > 0 ? getYear(yearsData[0].yearStart) : getYear(currentYear);
    onNavigate(addYears(new Date(lastYear, 0, 1), 1));
  };
  
  const handleThisYear = () => {
    onNavigate(new Date());
  };
  
  const currentYearNum = getYear(new Date());
  
  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handlePrev}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">All Years</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleThisYear}>
            This Year
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
      
      {/* Years Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {yearsData.map((yearData) => {
          const year = getYear(yearData.yearStart);
          const isCurrent = year === currentYearNum;
          const { averages, entryCount } = yearData;
          const hasData = entryCount > 0;
          
          return (
            <Card
              key={year}
              className={cn(
                'p-4 cursor-pointer transition-all hover:shadow-md',
                !hasData && 'opacity-60'
              )}
              onClick={() => onYearClick?.(yearData.yearStart, yearData.yearEnd)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{year}</h3>
                  {isCurrent && (
                    <Badge variant="default" className="text-xs">Current</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-red-500">
                    <Heart className="w-3 h-3" />
                    <span className="text-muted-foreground">RHR</span>
                  </div>
                  <span className="font-medium">{averages.rhr !== null ? `${averages.rhr} bpm` : '-'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-yellow-500">
                    <Scale className="w-3 h-3" />
                    <span className="text-muted-foreground">Weight</span>
                  </div>
                  <span className="font-medium">{averages.weight !== null ? `${averages.weight.toFixed(2)} kg` : '-'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-green-500">
                    <Footprints className="w-3 h-3" />
                    <span className="text-muted-foreground">Steps</span>
                  </div>
                  <span className="font-medium">{averages.steps !== null ? averages.steps.toLocaleString() : '-'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-blue-500">
                    <Bed className="w-3 h-3" />
                    <span className="text-muted-foreground">Sleep</span>
                  </div>
                  <span className="font-medium">{averages.sleep !== null ? `${averages.sleep.toFixed(1)} h` : '-'}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

