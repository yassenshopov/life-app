'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Target, PanelLeftClose, PanelLeftOpen, Settings, Users, Music, Film, Calendar, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function HQSidebar() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

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
  const isTrackingActive = pathname === '/tracking';
  const isCalendarActive = pathname === '/calendar';

  return (
    <div
      className={cn(
        'bg-background border-r border-border h-screen overflow-y-auto transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className="p-4 border-b border-border">
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
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Target className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Mission HQ</span>}
        </Link>
        <Link
          href="/people"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            'hover:bg-accent hover:text-accent-foreground',
            isPeopleActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">People</span>}
        </Link>
        <Link
          href="/spotify"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            'hover:bg-accent hover:text-accent-foreground',
            isSpotifyActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Music className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Spotify</span>}
        </Link>
        <Link
          href="/media"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            'hover:bg-accent hover:text-accent-foreground',
            isMediaActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Film className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Media</span>}
        </Link>
        <Link
          href="/calendar"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            'hover:bg-accent hover:text-accent-foreground',
            isCalendarActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Calendar</span>}
        </Link>
        <Link
          href="/tracking"
          className={cn(
            'flex items-center space-x-2 px-3 py-2 rounded-md transition-colors w-full',
            'hover:bg-accent hover:text-accent-foreground',
            isTrackingActive && 'bg-accent text-accent-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Calendar className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Tracking</span>}
        </Link>
      </div>

      {/* Bottom Section with Settings and Profile */}
      <div className="p-4 border-t border-border space-y-2">
        <Link href="/settings">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start px-3 py-2 h-auto text-sm text-muted-foreground hover:text-foreground hover:bg-accent',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <Settings className="w-4 h-4" />
            {!isCollapsed && <span className="ml-2">Settings</span>}
          </Button>
        </Link>

        {user && (
          <button
            onClick={() => openUserProfile()}
            className={cn(
              'flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-accent transition-colors w-full',
              isCollapsed && 'justify-center'
            )}
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


