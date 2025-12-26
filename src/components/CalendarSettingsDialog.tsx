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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LogOut, Link as LinkIcon, Loader2 } from 'lucide-react';

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
  const [isConnected, setIsConnected] = React.useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);

  // Check connection status
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/google-calendar/calendars');
        const data = await response.json();
        setIsConnected(data.calendars && data.calendars.length > 0);
      } catch (error) {
        console.error('Error checking connection:', error);
        setIsConnected(false);
      }
    };

    if (open) {
      checkConnection();
    }
  }, [open]);

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? You will need to reconnect to sync events.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setIsConnected(false);
        // Trigger refresh to update calendar sidebar
        window.dispatchEvent(new CustomEvent('calendar-refresh'));
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to disconnect Google Calendar');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect Google Calendar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google-calendar/auth');
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        alert('Failed to initiate Google Calendar connection');
      }
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Failed to connect Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>Customize your calendar display preferences.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Google Calendar Connection */}
          <div className="space-y-3">
            <Label>Google Calendar</Label>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {isConnected === null ? 'Checking...' : isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="gap-2"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="gap-2"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Time Format */}
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

