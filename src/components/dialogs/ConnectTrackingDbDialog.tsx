'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database, ExternalLink } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

type TrackingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_LABELS: Record<TrackingPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

interface ConnectTrackingDbDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (period: TrackingPeriod) => void;
  defaultPeriod?: TrackingPeriod;
}

export function ConnectTrackingDbDialog({
  isOpen,
  onClose,
  onConnected,
  defaultPeriod = 'daily',
}: ConnectTrackingDbDialogProps) {
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<TrackingPeriod>(defaultPeriod);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setDatabaseUrl('');
      setSelectedPeriod(defaultPeriod);
      setError(null);
    }
  }, [isOpen, defaultPeriod]);

  const extractDatabaseId = (url: string): string | null => {
    if (!url) return null;
    
    // Try to extract 32-char hex ID
    const match = url.match(/[a-f0-9]{32}/i);
    if (match) {
      return match[0];
    }
    
    // Try extracting from URL path
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const id = lastPart.split('?')[0].split('#')[0];
    
    return id.length === 32 ? id : null;
  };

  const handleConnect = async () => {
    if (!databaseUrl.trim()) {
      setError('Please enter a Notion database URL');
      return;
    }

    const databaseId = extractDatabaseId(databaseUrl);
    if (!databaseId) {
      setError('Invalid Notion database URL. Please check the URL and try again.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/tracking/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          database_id: databaseId,
          period: selectedPeriod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect database');
      }

      // Trigger initial sync
      const syncResponse = await fetch(`/api/tracking/${selectedPeriod}/sync`, {
        method: 'POST',
      });

      if (!syncResponse.ok) {
        console.warn('Initial sync failed, but connection succeeded');
      }

      onConnected(selectedPeriod);
      onClose();
      setDatabaseUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to connect database');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Connect Tracking Database
          </DialogTitle>
          <DialogDescription>
            Connect your Notion tracking database to sync your entries. Select the period type
            and paste your Notion database URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="period">Tracking Period</Label>
            <Select
              value={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(value as TrackingPeriod)}
              disabled={isConnecting}
            >
              <SelectTrigger id="period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABELS).map(([period, label]) => (
                  <SelectItem key={period} value={period}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the type of tracking database you're connecting
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database-url">Notion Database URL</Label>
            <Input
              id="database-url"
              placeholder="https://www.notion.so/workspace/abc123..."
              value={databaseUrl}
              onChange={(e) => {
                setDatabaseUrl(e.target.value);
                setError(null);
              }}
              disabled={isConnecting}
            />
            <p className="text-xs text-muted-foreground">
              Paste your Notion database URL here
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !databaseUrl.trim()}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Connect Database
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

