'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { HQTodayAgenda } from '@/components/HQTodayAgenda';
import { HQWeekAgenda } from '@/components/HQWeekAgenda';
import { HealthMetricsTrends } from '@/components/HealthMetricsTrends';
import { Weather } from '@/components/Weather';
import { Outfit } from 'next/font/google';
import { TrackingEntry } from '@/components/TrackingView';
import { getColorPalette, getDefaultBgColor } from '@/lib/spotify-color';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Settings } from 'lucide-react';
import { HQSettingsDialog } from '@/components/HQSettingsDialog';

const outfit = Outfit({ subsets: ['latin'] });

interface CurrentlyPlaying {
  isPlaying: boolean;
  item?: {
    name: string;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
    external_urls: { spotify: string };
  };
  progress_ms?: number;
  is_playing?: boolean;
}

export default function HQPage() {
  const [trackingEntries, setTrackingEntries] = React.useState<TrackingEntry[]>([]);
  const [loadingTracking, setLoadingTracking] = React.useState(true);
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
  const [isConnected, setIsConnected] = React.useState(false);
  const currentTrackIdRef = React.useRef<string | null>(null);
  const lastTrackRef = React.useRef<CurrentlyPlaying['item'] | null>(null);
  const [sectionPreferences, setSectionPreferences] = React.useState<
    Record<string, { visible: boolean }>
  >({});
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [loadingPreferences, setLoadingPreferences] = React.useState(true);

  // Update background color based on currently playing track
  const updateBackgroundColor = React.useCallback((track: CurrentlyPlaying['item'] | null) => {
    if (!track?.album?.images || track.album.images.length === 0) {
      if (!lastTrackRef.current) {
        const defaultColor = getDefaultBgColor();
        setColorPalette({
          primary: defaultColor,
          secondary: defaultColor,
          accent: defaultColor,
        });
      }
      return;
    }

    // Use the largest available image for better color extraction
    const imageUrl =
      track.album.images[0]?.url || track.album.images[1]?.url || track.album.images[2]?.url;
    if (imageUrl) {
      getColorPalette(imageUrl)
        .then((palette) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('Color palette extracted:', palette);
          }
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
    } else {
      const defaultColor = getDefaultBgColor();
      setColorPalette({
        primary: defaultColor,
        secondary: defaultColor,
        accent: defaultColor,
      });
    }
  }, []);

  // Check Spotify connection and fetch currently playing
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/spotify/profile');
        const connected = response.ok;
        setIsConnected(connected);
        if (connected) {
          // Fetch immediately to get current track
          const playingResponse = await fetch('/api/spotify/currently-playing');
          if (playingResponse.ok) {
            const data: CurrentlyPlaying = await playingResponse.json();
            if (data.item) {
              lastTrackRef.current = data.item;
              const trackId = data.item.album?.images?.[0]?.url || data.item.name || null;
              currentTrackIdRef.current = trackId;
              updateBackgroundColor(data.item);
            }
          }
        }
      } catch (error) {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, [updateBackgroundColor]);

  const fetchCurrentlyPlaying = React.useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/currently-playing');
      if (response.ok) {
        const data: CurrentlyPlaying = await response.json();
        
        // Only update color if track changed
        const trackId = data.item?.album?.images?.[0]?.url || null;
        if (trackId !== currentTrackIdRef.current) {
          currentTrackIdRef.current = trackId;
          
          // Store last track info if we have a track
          if (data.item) {
            lastTrackRef.current = data.item;
            updateBackgroundColor(data.item);
          } else if (!data.isPlaying && !data.is_playing) {
            // If paused and no current track, use last track or reset
            if (lastTrackRef.current) {
              updateBackgroundColor(lastTrackRef.current);
            } else {
              const defaultColor = getDefaultBgColor();
              setColorPalette({
                primary: defaultColor,
                secondary: defaultColor,
                accent: defaultColor,
              });
            }
          }
        }
      }
    } catch {
      // Silently handle errors
    }
  }, [updateBackgroundColor]);

  // Poll for currently playing track
  React.useEffect(() => {
    if (!isConnected) return;

    const pollInterval = setInterval(() => {
      fetchCurrentlyPlaying();
    }, 5000); // Poll every 5 seconds

    // Initial fetch
    fetchCurrentlyPlaying();

    return () => clearInterval(pollInterval);
  }, [isConnected, fetchCurrentlyPlaying]);

  React.useEffect(() => {
    const fetchTrackingEntries = async () => {
      try {
        // Check if tracking is connected
        const connectionsResponse = await fetch('/api/tracking/connections');
        const connectionsData = await connectionsResponse.json();

        if (connectionsData.connections?.daily?.connected) {
          const entriesResponse = await fetch('/api/tracking/daily');
          const entriesData = await entriesResponse.json();
          setTrackingEntries(entriesData.entries || []);
        }
      } catch (error) {
        console.error('Error fetching tracking entries:', error);
      } finally {
        setLoadingTracking(false);
      }
    };

    fetchTrackingEntries();
  }, []);

  // Load section preferences
  React.useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/hq/preferences');
        if (response.ok) {
          const data = await response.json();
          setSectionPreferences(data.preferences || {});
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadPreferences();
  }, []);

  // Save section preferences
  const handleSavePreferences = async (
    preferences: Record<string, { visible: boolean }>
  ) => {
    try {
      const response = await fetch('/api/hq/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        setSectionPreferences(preferences);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      throw error;
    }
  };

  // Helper to check if a section should be visible (defaults to true if not set)
  const isSectionVisible = (sectionId: string): boolean => {
    return sectionPreferences[sectionId]?.visible ?? true;
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
      // Handle HSL format (convert to RGB)
      if (color.startsWith('hsl(')) {
        const matches = color.match(/[\d.]+/g);
        if (matches && matches.length >= 3) {
          const h = parseFloat(matches[0]) / 360;
          const s = parseFloat(matches[1]) / 100;
          const l = parseFloat(matches[2]) / 100;
          
          const c = (1 - Math.abs(2 * l - 1)) * s;
          const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
          const m = l - c / 2;
          
          let r = 0, g = 0, b = 0;
          if (h < 1/6) { r = c; g = x; b = 0; }
          else if (h < 2/6) { r = x; g = c; b = 0; }
          else if (h < 3/6) { r = 0; g = c; b = x; }
          else if (h < 4/6) { r = 0; g = x; b = c; }
          else if (h < 5/6) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          
          return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255),
          };
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

    // More prominent opacity values for better visibility
    return {
      primary: `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.5)`,
      secondary: `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.35)`,
      accent: `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.2)`,
    };
  }, [colorPalette]);

  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar colorPalette={isConnected && gradientColors ? colorPalette : null} />
      <main className="flex-1 overflow-y-auto">
        <div
          className={`min-h-screen p-6 md:p-8 transition-all duration-1000 ease-in-out ${
            !isConnected || !gradientColors
              ? 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950'
              : ''
          }`}
          style={{
            background: isConnected && gradientColors
              ? `linear-gradient(135deg, ${gradientColors.primary}, ${gradientColors.secondary}, ${gradientColors.accent})`
              : undefined,
          }}
        >
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-foreground">
                  Mission HQ
                </h1>
                <p className="text-muted-foreground mt-2">Your command center</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Bento Grid */}
            {!loadingPreferences && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Row 1: Today's Agenda (narrower) */}
                {isSectionVisible('todayAgenda') && (
                  <div className="lg:col-span-1 flex">
                    <div className="flex-1 flex flex-col">
                      <HQTodayAgenda colorPalette={isConnected && gradientColors ? colorPalette : null} />
                    </div>
                  </div>
                )}

                {/* Row 1: 7-Day Agenda (wider) */}
                {isSectionVisible('weekAgenda') && (
                  <div
                    className={`flex ${
                      isSectionVisible('todayAgenda')
                        ? 'lg:col-span-2'
                        : 'lg:col-span-3'
                    }`}
                  >
                    <div className="flex-1 flex flex-col">
                      <HQWeekAgenda colorPalette={isConnected && gradientColors ? colorPalette : null} />
                    </div>
                  </div>
                )}

                {/* Row 2: Weather */}
                {isSectionVisible('weather') && (
                  <div
                    className={`flex ${
                      isSectionVisible('healthMetrics')
                        ? 'lg:col-span-1'
                        : 'lg:col-span-3'
                    }`}
                  >
                    <div className="flex-1 flex flex-col">
                      <Weather colorPalette={isConnected && gradientColors ? colorPalette : null} />
                    </div>
                  </div>
                )}

                {/* Row 2: Health Metrics Trends (full width) */}
                {isSectionVisible('healthMetrics') && (
                  <div
                    className={`${
                      isSectionVisible('weather')
                        ? 'lg:col-span-2'
                        : 'lg:col-span-3'
                    }`}
                  >
                    {!loadingTracking && trackingEntries.length > 0 ? (
                      <HealthMetricsTrends 
                        entries={trackingEntries} 
                        viewMode="daily" 
                        colorPalette={isConnected && gradientColors ? colorPalette : null}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        {loadingTracking
                          ? 'Loading health metrics...'
                          : 'Connect your tracking database to see health metrics trends'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Settings Dialog */}
      <HQSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={sectionPreferences}
        onSave={handleSavePreferences}
        onPreferencesChange={(prefs) => {
          // Optimistically update the page layout
          setSectionPreferences(prefs);
        }}
      />
    </div>
  );
}


