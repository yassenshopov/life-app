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
import { Database, ExternalLink, Wallet } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ConnectFinancesDbDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectFinancesDbDialog({
  isOpen,
  onClose,
  onConnected,
}: ConnectFinancesDbDialogProps) {
  const [assetsUrl, setAssetsUrl] = useState('');
  const [investmentsUrl, setInvestmentsUrl] = useState('');
  const [placesUrl, setPlacesUrl] = useState('');
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
    if (!assetsUrl.trim() || !investmentsUrl.trim() || !placesUrl.trim()) {
      setError('Please enter all three database URLs');
      return;
    }

    const assetsId = extractDatabaseId(assetsUrl);
    const investmentsId = extractDatabaseId(investmentsUrl);
    const placesId = extractDatabaseId(placesUrl);

    if (!assetsId || !investmentsId || !placesId) {
      setError('Invalid Notion database URL(s). Please check the URLs and try again.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/finances/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assets_database_id: assetsId,
          investments_database_id: investmentsId,
          places_database_id: placesId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect databases');
      }

      // Trigger initial sync
      const syncResponse = await fetch('/api/finances/sync', {
        method: 'POST',
      });

      if (!syncResponse.ok) {
        console.warn('Initial sync failed, but connection succeeded');
      }

      onConnected();
      onClose();
      setAssetsUrl('');
      setInvestmentsUrl('');
      setPlacesUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to connect databases');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Connect Finances Databases
          </DialogTitle>
          <DialogDescription>
            Connect your three Notion databases for finances: Assets, Individual Investments, and Net Worth (Places).
            You can find each database URL by opening it in Notion and copying the URL from your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Assets Database</CardTitle>
              <CardDescription>
                Your assets database (e.g., Bitcoin, SPY, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="assets-url">Assets Database URL</Label>
                <Input
                  id="assets-url"
                  placeholder="https://www.notion.so/workspace/abc123..."
                  value={assetsUrl}
                  onChange={(e) => {
                    setAssetsUrl(e.target.value);
                    setError(null);
                  }}
                  disabled={isConnecting}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Individual Investments Database</CardTitle>
              <CardDescription>
                Your individual investments database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="investments-url">Investments Database URL</Label>
                <Input
                  id="investments-url"
                  placeholder="https://www.notion.so/workspace/abc123..."
                  value={investmentsUrl}
                  onChange={(e) => {
                    setInvestmentsUrl(e.target.value);
                    setError(null);
                  }}
                  disabled={isConnecting}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Net Worth (Places) Database</CardTitle>
              <CardDescription>
                Your Net Worth database (bank accounts, brokerage accounts, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="places-url">Net Worth Database URL</Label>
                <Input
                  id="places-url"
                  placeholder="https://www.notion.so/workspace/abc123..."
                  value={placesUrl}
                  onChange={(e) => {
                    setPlacesUrl(e.target.value);
                    setError(null);
                  }}
                  disabled={isConnecting}
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={isConnecting || !assetsUrl.trim() || !investmentsUrl.trim() || !placesUrl.trim()}
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
                Connect All Databases
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

