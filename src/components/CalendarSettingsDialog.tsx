'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type TimeFormat = '12h' | '24h';

interface CalendarSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeFormat: TimeFormat;
  onTimeFormatChange: (format: TimeFormat) => void;
}

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  timeFormat,
  onTimeFormatChange,
}: CalendarSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>Customize your calendar display preferences.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Time Format</Label>
            <div className="flex flex-col space-y-2">
              <label
                className={cn(
                  'flex items-center space-x-2 cursor-pointer rounded-md p-3 border transition-colors',
                  timeFormat === '12h'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <input
                  type="radio"
                  name="timeFormat"
                  value="12h"
                  checked={timeFormat === '12h'}
                  onChange={() => onTimeFormatChange('12h')}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm font-medium">12-hour (AM/PM)</span>
              </label>
              <label
                className={cn(
                  'flex items-center space-x-2 cursor-pointer rounded-md p-3 border transition-colors',
                  timeFormat === '24h'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <input
                  type="radio"
                  name="timeFormat"
                  value="24h"
                  checked={timeFormat === '24h'}
                  onChange={() => onTimeFormatChange('24h')}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm font-medium">24-hour (Military)</span>
              </label>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

