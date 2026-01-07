'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Outfit } from 'next/font/google';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { YouTubeAnalytics } from '@/components/YouTubeAnalytics';

const outfit = Outfit({ subsets: ['latin'] });

export default function YouTubePage() {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{
    synced: number;
    total: number;
    dateRange?: { oldest: string; newest: string; daysBack: number };
  } | null>(null);
  const [hasHistory, setHasHistory] = React.useState(false);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    checkHistory();
  }, []);

  const checkHistory = async () => {
    try {
      const response = await fetch('/api/youtube/recently-watched');
      if (response.ok) {
        const data = await response.json();
        setHasHistory(data.video !== null);
      }
    } catch {
      setHasHistory(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsSyncing(true);
      setSyncResult(null);

      const text = await file.text();
      let historyData;

      try {
        historyData = JSON.parse(text);
      } catch (parseError) {
        toast({
          title: 'Invalid JSON',
          description: 'Please upload a valid JSON file from Google Takeout',
          variant: 'destructive',
        });
        return;
      }

      // Ensure it's an array
      const historyArray = Array.isArray(historyData) ? historyData : [historyData];

      const response = await fetch('/api/youtube/sync-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(historyArray),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync history');
      }

      const result = await response.json();
      setSyncResult(result);
      setHasHistory(true);

      toast({
        title: 'Success!',
        description: `Synced ${result.synced} new videos from your history`,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh the page to show analytics
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync YouTube history',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                  YouTube
                </h1>
                <p className="text-muted-foreground mt-2">
                  {hasHistory 
                    ? 'Explore insights from your YouTube watch history'
                    : 'Sync your YouTube watch history from Google Takeout'}
                </p>
              </div>
            </div>

            {/* Show Analytics if history exists, otherwise show upload form */}
            {hasHistory ? (
              <YouTubeAnalytics />
            ) : (
              <>

                {/* Instructions Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-5 h-5 text-red-500" />
                      How to Sync Your YouTube History
                    </CardTitle>
                    <CardDescription>
                      Export your YouTube watch history from Google Takeout and upload it here
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
                      <li>
                        Go to{' '}
                        <a
                          href="https://takeout.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Google Takeout
                        </a>
                      </li>
                      <li>Select "YouTube and YouTube Music"</li>
                      <li>Choose "History" and select the JSON format</li>
                      <li>Create export and download the archive</li>
                      <li>Extract the archive and find the "Watch History.json" file</li>
                      <li>Upload the JSON file below</li>
                    </ol>

                    <div className="pt-4 border-t">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="youtube-history-upload"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSyncing}
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        size="lg"
                      >
                        {isSyncing ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Watch History JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Sync Result */}
                {syncResult && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {syncResult.synced > 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                        )}
                        Sync Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Videos synced:</span>
                        <span className="font-semibold">{syncResult.synced}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total videos processed:</span>
                        <span className="font-semibold">{syncResult.total}</span>
                      </div>
                      {syncResult.dateRange && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Date range:</span>
                            <span className="font-semibold text-sm">
                              {syncResult.dateRange.daysBack} days
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            <p>
                              Oldest: {new Date(syncResult.dateRange.oldest).toLocaleDateString()}
                            </p>
                            <p>
                              Newest: {new Date(syncResult.dateRange.newest).toLocaleDateString()}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

