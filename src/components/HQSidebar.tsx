'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Target, PanelLeftClose, PanelLeftOpen, Settings, Users, Music, Film, Calendar, CalendarDays, Wallet, CheckSquare, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Outfit } from 'next/font/google';
import { getColorPalette, getDefaultBgColor } from '@/lib/spotify-color';

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

interface HQSidebarProps {
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export default function HQSidebar({ colorPalette: propColorPalette }: HQSidebarProps) {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [colorPalette, setColorPalette] = useState<{
    primary: string;
    secondary: string;
    accent: string;
  } | null>(propColorPalette || null);
  const [isConnected, setIsConnected] = useState(false);
  const currentTrackIdRef = useRef<string | null>(null);
  const lastTrackRef = useRef<CurrentlyPlaying['item'] | null>(null);

  // Load sidebar state from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    const savedCollapsedState = localStorage.getItem('hq-sidebar-collapsed');
    if (savedCollapsedState !== null) {
      setIsCollapsed(JSON.parse(savedCollapsedState));
    }
  }, []);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('hq-sidebar-collapsed', JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, isMounted]);

  // Update color palette from prop if provided
  useEffect(() => {
    if (propColorPalette) {
      setColorPalette(propColorPalette);
    }
  }, [propColorPalette]);

  // Update background color based on currently playing track (only if prop not provided)
  const updateBackgroundColor = useCallback((track: CurrentlyPlaying['item'] | null) => {
    if (propColorPalette) return; // Don't update if prop is provided

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
          setColorPalette(palette);
        })
        .catch(() => {
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
  }, [propColorPalette]);

  // Check Spotify connection and fetch currently playing (only if prop not provided)
  useEffect(() => {
    if (propColorPalette) return; // Skip if prop is provided

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
  }, [updateBackgroundColor, propColorPalette]);

  const fetchCurrentlyPlaying = useCallback(async () => {
    if (propColorPalette) return; // Skip if prop is provided

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
  }, [updateBackgroundColor, propColorPalette]);

  // Poll for currently playing track (only if prop not provided)
  useEffect(() => {
    if (propColorPalette || !isConnected) return;

    const pollInterval = setInterval(() => {
      fetchCurrentlyPlaying();
    }, 5000); // Poll every 5 seconds

    // Initial fetch
    fetchCurrentlyPlaying();

    return () => clearInterval(pollInterval);
  }, [isConnected, fetchCurrentlyPlaying, propColorPalette]);

  // Listen for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        setIsCollapsed(!isCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCollapsed]);

  const isActive = pathname === '/hq';
  const isPeopleActive = pathname === '/people';
  const isSpotifyActive = pathname === '/spotify';
  const isMediaActive = pathname === '/media';
  const isYouTubeActive = pathname === '/youtube';
  const isTrackingActive = pathname === '/tracking';
  const isCalendarActive = pathname === '/calendar';
  const isFinancesActive = pathname === '/finances';
  const isActionZoneActive = pathname === '/action-zone';

  // Apply color palette to sidebar if available
  const sidebarStyle = colorPalette
    ? {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.35)'),
      }
    : undefined;

  // Helper function to get text color based on dark/light mode
  const getTextColor = () => {
    if (typeof window === 'undefined') return undefined;
    const root = document.documentElement;
    const isDark = getComputedStyle(root).getPropertyValue('color-scheme').includes('dark') ||
      root.classList.contains('dark');
    return isDark ? '#ffffff' : '#000000';
  };

  // Helper function to get link styles based on active state
  const getLinkStyle = (isActive: boolean) => {
    if (!colorPalette) return undefined;
    
    const textColor = getTextColor();
    
    if (isActive) {
      return {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.4)'),
        color: textColor,
      };
    }
    return {
      color: textColor,
    };
  };

  // Helper function for hover styles
  const handleLinkHover = (e: React.MouseEvent<HTMLAnchorElement>, isActive: boolean) => {
    if (colorPalette && !isActive) {
      e.currentTarget.style.backgroundColor = colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.2)');
    }
  };

  const handleLinkLeave = (e: React.MouseEvent<HTMLAnchorElement>, isActive: boolean) => {
    if (colorPalette && !isActive) {
      e.currentTarget.style.backgroundColor = '';
    }
  };

  return (
    <div
      className={cn(
        'h-screen overflow-y-auto transition-all duration-1000 flex flex-col',
        !colorPalette && 'bg-background',
        isCollapsed ? 'w-16' : 'w-64'
      )}
      style={sidebarStyle}
    >
      {/* Header with Logo and Toggle */}
      <div 
        className={cn("p-4 border-b transition-all duration-1000", !colorPalette && "border-border")}
        style={colorPalette ? {
          borderBottomColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)'),
        } : undefined}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center space-y-3">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Frameworked Logo"
                width={32}
                height={32}
                className="invert dark:invert-0"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="Frameworked Logo"
                width={32}
                height={32}
                className="invert dark:invert-0"
              />
              <span className={`font-semibold text-lg ${outfit.className}`}>Frameworked</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-1">
        <Link
          href="/hq"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isActive)}
          onMouseEnter={(e) => handleLinkHover(e, isActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isActive)}
        >
          <Target className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Mission HQ</span>}
        </Link>
        <Link
          href="/people"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isPeopleActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isPeopleActive)}
          onMouseEnter={(e) => handleLinkHover(e, isPeopleActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isPeopleActive)}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">People</span>}
        </Link>
        <Link
          href="/spotify"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isSpotifyActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isSpotifyActive)}
          onMouseEnter={(e) => handleLinkHover(e, isSpotifyActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isSpotifyActive)}
        >
          <Music className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Spotify</span>}
        </Link>
        <Link
          href="/media"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isMediaActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isMediaActive)}
          onMouseEnter={(e) => handleLinkHover(e, isMediaActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isMediaActive)}
        >
          <Film className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Media</span>}
        </Link>
        <Link
          href="/youtube"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isYouTubeActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isYouTubeActive)}
          onMouseEnter={(e) => handleLinkHover(e, isYouTubeActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isYouTubeActive)}
        >
          <Video className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">YouTube</span>}
        </Link>
        <Link
          href="/calendar"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isCalendarActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isCalendarActive)}
          onMouseEnter={(e) => handleLinkHover(e, isCalendarActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isCalendarActive)}
        >
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Calendar</span>}
        </Link>
        <Link
          href="/action-zone"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isActionZoneActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isActionZoneActive)}
          onMouseEnter={(e) => handleLinkHover(e, isActionZoneActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isActionZoneActive)}
        >
          <CheckSquare className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Action Zone</span>}
        </Link>
        <Link
          href="/tracking"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isTrackingActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isTrackingActive)}
          onMouseEnter={(e) => handleLinkHover(e, isTrackingActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isTrackingActive)}
        >
          <Calendar className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Tracking</span>}
        </Link>
        <Link
          href="/finances"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            !colorPalette && 'hover:bg-accent hover:text-accent-foreground',
            !colorPalette && isFinancesActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          style={getLinkStyle(isFinancesActive)}
          onMouseEnter={(e) => handleLinkHover(e, isFinancesActive)}
          onMouseLeave={(e) => handleLinkLeave(e, isFinancesActive)}
        >
          <Wallet className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Finances</span>}
        </Link>
      </div>

      {/* Bottom Section with Settings and Profile */}
      <div 
        className={cn("p-4 border-t space-y-2 transition-all duration-1000", !colorPalette && "border-border")}
        style={colorPalette ? {
          borderTopColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)'),
        } : undefined}
      >
        <Link href="/settings">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start px-3 py-2 h-auto text-sm text-muted-foreground',
              !colorPalette && 'hover:text-foreground hover:bg-accent',
              isCollapsed && 'justify-center px-2'
            )}
            style={
              colorPalette
                ? {
                    color: getTextColor(),
                  }
                : undefined
            }
            onMouseEnter={(e) => {
              if (colorPalette) {
                e.currentTarget.style.backgroundColor = colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.2)');
              }
            }}
            onMouseLeave={(e) => {
              if (colorPalette) {
                e.currentTarget.style.backgroundColor = '';
              }
            }}
          >
            <Settings className="w-4 h-4" />
            {!isCollapsed && <span className="ml-2">Settings</span>}
          </Button>
        </Link>

        {user && (
          <button
            onClick={() => openUserProfile()}
            className={cn(
              'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
              !colorPalette && 'hover:bg-accent',
              isCollapsed && 'justify-center'
            )}
            onMouseEnter={(e) => {
              if (colorPalette) {
                e.currentTarget.style.backgroundColor = colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.2)');
              }
            }}
            onMouseLeave={(e) => {
              if (colorPalette) {
                e.currentTarget.style.backgroundColor = '';
              }
            }}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              {user.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="Profile"
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-foreground">
                    {user.firstName?.charAt(0) ||
                      user.emailAddresses[0]?.emailAddress.charAt(0) ||
                      'U'}
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">
                  {user.firstName || user.emailAddresses[0]?.emailAddress}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.emailAddresses[0]?.emailAddress}
                </div>
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
}


