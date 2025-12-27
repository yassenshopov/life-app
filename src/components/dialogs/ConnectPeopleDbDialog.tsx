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
import { Database, ExternalLink } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface ConnectPeopleDbDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectPeopleDbDialog({
  isOpen,
  onClose,
  onConnected,
}: ConnectPeopleDbDialogProps) {
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch('/api/people/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ database_id: databaseId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect database');
      }

      // Trigger initial sync
      const syncResponse = await fetch('/api/people/sync', {
        method: 'POST',
      });

      if (!syncResponse.ok) {
        console.warn('Initial sync failed, but connection succeeded');
      }

      onConnected();
      onClose();
      setDatabaseUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to connect database');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQuickConnect = async () => {
    // Quick connect will use the database URL input if available, otherwise prompt user
    if (!databaseUrl.trim()) {
      setError('Please enter a Notion database URL first');
      return;
    }
    
    setIsConnecting(true);
    setError(null);

    const databaseId = extractDatabaseId(databaseUrl);
    if (!databaseId) {
      setError('Invalid Notion database URL');
      setIsConnecting(false);
      return;
    }

    try {
      const response = await fetch('/api/people/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          database_id: databaseId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect database');
      }

      // Trigger initial sync
      const syncResponse = await fetch('/api/people/sync', {
        method: 'POST',
      });

      if (!syncResponse.ok) {
        console.warn('Initial sync failed, but connection succeeded');
      }

      onConnected();
      onClose();
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
            Connect People Database
          </DialogTitle>
          <DialogDescription>
            Connect your Notion People database to sync your contacts. You can find
            the database URL by opening your Notion database and copying the URL from
            your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              onClick={handleQuickConnect}
              disabled={isConnecting}
              variant="outline"
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Default People Database
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

