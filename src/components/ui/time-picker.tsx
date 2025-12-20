'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value: string; // HH:mm format
  onChange: (value: string) => void;
  timeFormat: TimeFormat;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({
  value,
  onChange,
  timeFormat,
  disabled = false,
  className,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hours, setHours] = React.useState(0);
  const [minutes, setMinutes] = React.useState(0);
  const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM');

  // Parse value on mount and when value changes
  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return; // Skip invalid values
      
      if (timeFormat === '12h') {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        setHours(prev => prev !== hour12 ? hour12 : prev);
        setPeriod(prev => (h >= 12 ? 'PM' : 'AM') !== prev ? (h >= 12 ? 'PM' : 'AM') : prev);
      } else {
        setHours(prev => prev !== h ? h : prev);
      }
      setMinutes(prev => prev !== (m || 0) ? (m || 0) : prev);
    } else {
      // Initialize with default values if no value provided
      setHours(0);
      setMinutes(0);
      setPeriod('AM');
    }
  }, [value, timeFormat]);

  const handleHoursChange = (delta: number) => {
    let newHours = hours + delta;
    
    if (timeFormat === '12h') {
      if (newHours < 1) newHours = 12;
      if (newHours > 12) newHours = 1;
    } else {
      if (newHours < 0) newHours = 23;
      if (newHours > 23) newHours = 0;
    }
    
    setHours(newHours);
    updateValue(newHours, minutes, period);
  };

  const handleMinutesChange = (delta: number) => {
    let newMinutes = minutes + delta;
    if (newMinutes < 0) newMinutes = 59;
    if (newMinutes > 59) newMinutes = 0;
    setMinutes(newMinutes);
    updateValue(hours, newMinutes, period);
  };

  const handlePeriodToggle = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    updateValue(hours, minutes, newPeriod);
  };

  const updateValue = React.useCallback((h: number, m: number, p: 'AM' | 'PM') => {
    let hour24 = h;
    if (timeFormat === '12h') {
      if (p === 'PM' && h !== 12) hour24 = h + 12;
      if (p === 'AM' && h === 12) hour24 = 0;
    }
    const formatted = `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    // Only call onChange if the value actually changed
    if (formatted !== value) {
      onChange(formatted);
    }
  }, [timeFormat, value, onChange]);

  const displayValue = React.useMemo(() => {
    if (!value) return '';
    const [h, m] = value.split(':').map(Number);
    if (timeFormat === '12h') {
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const period = h >= 12 ? 'PM' : 'AM';
      return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }, [value, timeFormat]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-7 px-1.5 py-0.5 bg-background border rounded text-[11px] font-medium cursor-pointer hover:bg-accent transition-colors justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
          style={{ width: timeFormat === '12h' ? '85px' : '70px', fontSize: '11px' }}
        >
          {displayValue || '00:00'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          {/* Hours */}
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleHoursChange(1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="w-12 h-12 flex items-center justify-center text-lg font-semibold border rounded">
              {timeFormat === '12h' ? hours : hours.toString().padStart(2, '0')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleHoursChange(-1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-lg font-semibold">:</span>

          {/* Minutes */}
          <div className="flex flex-col items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleMinutesChange(1)}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <div className="w-12 h-12 flex items-center justify-center text-lg font-semibold border rounded">
              {minutes.toString().padStart(2, '0')}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleMinutesChange(-1)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* AM/PM for 12h format */}
          {timeFormat === '12h' && (
            <div className="flex flex-col items-center ml-2">
              <Button
                variant={period === 'AM' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-12"
                onClick={handlePeriodToggle}
              >
                AM
              </Button>
              <Button
                variant={period === 'PM' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-12"
                onClick={handlePeriodToggle}
              >
                PM
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

