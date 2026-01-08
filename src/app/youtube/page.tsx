'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Upload, CheckCircle2, AlertCircle, Sparkles, MoreVertical, Calendar } from 'lucide-react';
import { Outfit } from 'next/font/google';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { YouTubeAnalytics } from '@/components/YouTubeAnalytics';
import { YouTubeLLMAnalysis } from '@/components/YouTubeLLMAnalysis';
import { YouTubeWatchHistoryCalendar } from '@/components/YouTubeWatchHistoryCalendar';
import { getColorPalette, getDefaultBgColor } from '@/lib/youtube-color';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const outfit = Outfit({ subsets: ['latin'] });

export default function YouTubePage() {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{
    synced: number;
    total: number;
    dateRange?: { oldest: string; newest: string; daysBack: number };
  } | null>(null);
  const [hasHistory, setHasHistory] = React.useState(false);
  const [isEnriching, setIsEnriching] = React.useState(false);
  const [enrichDialogOpen, setEnrichDialogOpen] = React.useState(false);
  const [enrichmentStats, setEnrichmentStats] = React.useState<{
    total: number;
    enriched: number;
    notEnriched: number;
    percentage: number;
  } | null>(null);
  const [apiUsage, setApiUsage] = React.useState<{
    dailyQuota: number;
    todayUsage: number;
    remainingQuota: number;
    quotaPercentage: number;
  } | null>(null);
  const [enrichResult, setEnrichResult] = React.useState<{
    enriched: number;
    total: number;
    processed: number;
    skipped?: number;
    errors?: number;
    message?: string;
    apiUsage?: {
      callsMade: number;
      quotaUsed: number;
      dailyQuota: number;
      note: string;
    };
  } | null>(null);
  const [colorPalette, setColorPalette] = React.useState<{
    primary: string;
    secondary: string;
    accent: string;
  }>(() => {
    const defaultColor = getDefaultBgColor();
    return {
      primary: defaultColor,
      secondary: defaultColor,
      accent: defaultColor,
    };
  });
  const currentVideoIdRef = React.useRef<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isWatchHistoryCalendarOpen, setIsWatchHistoryCalendarOpen] = React.useState(false);

  // Update background color based on recently watched video
  const updateBackgroundColor = React.useCallback((video: { thumbnail_url: string | null; video_id: string } | null) => {
    if (!video?.thumbnail_url) {
      const defaultColor = getDefaultBgColor();
      setColorPalette({
        primary: defaultColor,
        secondary: defaultColor,
        accent: defaultColor,
      });
      return;
    }

    getColorPalette(video.thumbnail_url)
      .then((palette) => {
        setColorPalette(palette);
      })
      .catch((error) => {
        console.error('Error extracting color palette:', error);
        const defaultColor = getDefaultBgColor();
        setColorPalette({
          primary: defaultColor,
          secondary: defaultColor,
          accent: defaultColor,
        });
      });
  }, []);

  const checkHistory = React.useCallback(async () => {
    try {
      const response = await fetch('/api/youtube/recently-watched');
      if (response.ok) {
        const data = await response.json();
        setHasHistory(data.video !== null);
        if (data.video) {
          // Only update color if video changed
          if (data.video.video_id !== currentVideoIdRef.current) {
            currentVideoIdRef.current = data.video.video_id;
            updateBackgroundColor(data.video);
          }
        }
      }
    } catch {
      setHasHistory(false);
    }
  }, [updateBackgroundColor]);

  const fetchEnrichmentStats = React.useCallback(async () => {
    try {
      const response = await fetch('/api/youtube/enrichment-stats');
      if (response.ok) {
        const data = await response.json();
        setEnrichmentStats(data);
      }
    } catch (error) {
      console.error('Error fetching enrichment stats:', error);
    }
  }, []);

  const fetchApiUsage = React.useCallback(async () => {
    try {
      const response = await fetch('/api/youtube/api-usage');
      if (response.ok) {
        const data = await response.json();
        setApiUsage(data);
      }
    } catch (error) {
      console.error('Error fetching API usage:', error);
    }
  }, []);

  React.useEffect(() => {
    checkHistory();
    if (hasHistory) {
      fetchEnrichmentStats();
      fetchApiUsage();
    }
  }, [checkHistory, hasHistory, fetchEnrichmentStats, fetchApiUsage]);

  // Poll for recently watched video to update colors
  React.useEffect(() => {
    if (!hasHistory) return;

    const pollInterval = setInterval(() => {
      checkHistory();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [hasHistory, checkHistory]);

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

      // Refresh analytics
      await checkHistory();
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

  const handleEnrich = async () => {
    try {
      setIsEnriching(true);
      setEnrichResult(null);

      const response = await fetch('/api/youtube/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 5000 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enrich videos');
      }

      const result = await response.json();
      setEnrichResult(result);

      toast({
        title: 'Enrichment Complete!',
        description: `Enriched ${result.enriched} videos with YouTube API data`,
      });

      // Refresh analytics and stats
      await checkHistory();
      await fetchEnrichmentStats();
      await fetchApiUsage();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to enrich YouTube videos',
        variant: 'destructive',
      });
    } finally {
      setIsEnriching(false);
    }
  };

  // Convert RGB colors to RGBA with opacity for gradient
  const gradientColors = React.useMemo(() => {
    const extractRgb = (color: string) => {
      // Handle RGB format
      if (color.startsWith('rgb(')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          return { r: matches[0], g: matches[1], b: matches[2] };
        }
      }
      return null;
    };

    const primary = extractRgb(colorPalette.primary);
    const secondary = extractRgb(colorPalette.secondary);
    const accent = extractRgb(colorPalette.accent);

    if (!primary || !secondary || !accent) {
      return null;
    }

    return {
      primary: `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.5)`,
      secondary: `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.35)`,
      accent: `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.2)`,
    };
  }, [colorPalette]);

  const effectiveColorPalette = hasHistory && gradientColors ? colorPalette : null;

  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar colorPalette={effectiveColorPalette} />
      <main className="flex-1 overflow-y-auto">
        <div
          className={`min-h-screen p-6 md:p-8 transition-all duration-1000 ease-in-out ${
            !hasHistory || !gradientColors
              ? 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950'
              : ''
          }`}
          style={{
            background: hasHistory && gradientColors
              ? `linear-gradient(135deg, ${gradientColors.primary}, ${gradientColors.secondary}, ${gradientColors.accent})`
              : undefined,
          }}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                  YouTube
                </h1>
                <p className="text-muted-foreground mt-2">
                  {hasHistory 
                    ? 'Explore insights from your YouTube watch history'
                    : 'Sync your YouTube watch history from Google Takeout'}
                </p>
                {hasHistory && enrichmentStats && (
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{enrichmentStats.enriched}</span>
                      {' / '}
                      <span className="font-semibold text-foreground">{enrichmentStats.total}</span>
                      {' videos enriched ('}
                      <span className="font-semibold text-foreground">{enrichmentStats.percentage}%</span>
                      {')'}
                    </div>
                    {apiUsage && (
                      <div className="text-xs text-muted-foreground">
                        API Usage: <span className="font-semibold text-foreground">{apiUsage.todayUsage}</span>
                        {' / '}
                        <span className="font-semibold text-foreground">{apiUsage.dailyQuota.toLocaleString()}</span>
                        {' units today ('}
                        <span className={`font-semibold ${apiUsage.quotaPercentage > 80 ? 'text-yellow-500' : apiUsage.quotaPercentage > 95 ? 'text-red-500' : 'text-foreground'}`}>
                          {apiUsage.quotaPercentage.toFixed(1)}%
                        </span>
                        {')'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {hasHistory && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsWatchHistoryCalendarOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Watch History Calendar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEnrichDialogOpen(true)}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Enrich Video Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Show Analytics if history exists, otherwise show upload form */}
            {hasHistory ? (
              <>
                <YouTubeAnalytics colorPalette={effectiveColorPalette} />
                <YouTubeLLMAnalysis colorPalette={effectiveColorPalette} />
              </>
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

      {/* Enrichment Dialog */}
      <Dialog open={enrichDialogOpen} onOpenChange={setEnrichDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Enrich Video Data
            </DialogTitle>
            <DialogDescription>
              Fetch detailed metadata (views, likes, duration, etc.) from YouTube Data API for up to 5,000 videos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {enrichmentStats && (
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="text-sm font-medium">Current Status</div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total videos:</span>
                    <span className="font-semibold">{enrichmentStats.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Enriched:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {enrichmentStats.enriched}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Not enriched:</span>
                    <span className="font-semibold">{enrichmentStats.notEnriched}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-semibold">{enrichmentStats.percentage}%</span>
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={handleEnrich}
              disabled={isEnriching}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
              size="lg"
            >
              {isEnriching ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Enriching videos...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enrich Videos (Up to 5K)
                </>
              )}
            </Button>
            {enrichResult && (
              <div className="space-y-2 text-sm">
                {enrichResult.message && (
                  <div className="p-2 rounded bg-muted text-muted-foreground text-xs">
                    {enrichResult.message}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Videos enriched:</span>
                  <span className="font-semibold">{enrichResult.enriched}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total videos:</span>
                  <span className="font-semibold">{enrichResult.total}</span>
                </div>
                {enrichResult.skipped !== undefined && enrichResult.skipped > 0 && (
                  <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                    <span>Skipped (already enriched):</span>
                    <span className="font-semibold">{enrichResult.skipped}</span>
                  </div>
                )}
                {enrichResult.errors && enrichResult.errors > 0 && (
                  <div className="flex items-center justify-between text-yellow-600">
                    <span>Errors:</span>
                    <span className="font-semibold">{enrichResult.errors}</span>
                  </div>
                )}
                {enrichResult.apiUsage && (
                  <div className="pt-2 border-t space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">API Usage (This Session)</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Quota used:</span>
                      <span className="font-semibold">{enrichResult.apiUsage.quotaUsed}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {enrichResult.apiUsage.note}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Watch History Calendar Overlay */}
      <YouTubeWatchHistoryCalendar
        isOpen={isWatchHistoryCalendarOpen}
        onClose={() => setIsWatchHistoryCalendarOpen(false)}
        colorPalette={effectiveColorPalette}
      />
    </div>
  );
}

