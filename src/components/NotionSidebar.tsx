'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { Outfit } from 'next/font/google';
import {
  Database,
  ChevronDown,
  ChevronRight,
  Heart,
  Target,
  Calendar,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

const outfit = Outfit({ subsets: ['latin'] });

interface NotionDatabase {
  database_id: string;
  database_name: string;
  integration_id: string;
  last_sync: string | null;
  sync_frequency: string;
  properties: {
    [key: string]: {
      type: string;
      required?: boolean;
      description?: string;
    };
  };
  icon?: any;
  cover?: any;
  description?: any[];
  created_time?: string;
  last_edited_time?: string;
  created_by?: any;
  last_edited_by?: any;
}

interface SidebarSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: SidebarItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

interface SidebarItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  href?: string;
  isDatabase?: boolean;
  children?: SidebarItem[];
}

export default function NotionSidebar() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // Initialize state from localStorage if available
    if (typeof window !== 'undefined') {
      const savedExpandedState = localStorage.getItem('sidebar-expanded-sections');
      return savedExpandedState !== null
        ? new Set(JSON.parse(savedExpandedState))
        : new Set(['databases', 'preferences']);
    }
    return new Set(['databases', 'preferences']);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize state from localStorage if available
    if (typeof window !== 'undefined') {
      const savedCollapsedState = localStorage.getItem('sidebar-collapsed');
      return savedCollapsedState !== null ? JSON.parse(savedCollapsedState) : false;
    }
    return false;
  });

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Save expanded sections state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-expanded-sections', JSON.stringify(Array.from(expandedSections)));
  }, [expandedSections]);

  useEffect(() => {
    if (user) {
      fetchDatabases();
    }
  }, [user]);

  // Listen for database sync events to refresh sidebar data
  useEffect(() => {
    const handleDatabaseSynced = (event: CustomEvent) => {
      console.log('Database sync event received:', event.detail);
      fetchDatabases();
    };

    window.addEventListener('database-synced', handleDatabaseSynced as EventListener);
    return () => {
      window.removeEventListener('database-synced', handleDatabaseSynced as EventListener);
    };
  }, []);

  // Listen for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+B (or Cmd+B on Mac)
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

  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/user/notion-credentials');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched databases data:', data);
        // Check for any problematic objects in the data
        data.forEach((db, index) => {
          console.log(`Database ${index}:`, {
            database_id: db.database_id,
            database_name: db.database_name,
            title: db.title, // Check if title field exists
            icon: db.icon,
            description: db.description,
            properties: db.properties,
          });
        });
        // Ensure data is an array and clean any problematic objects
        const cleanData = Array.isArray(data)
          ? data.map((db) => {
              // Deep clean function to remove any objects that might cause React rendering issues
              const deepClean = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean')
                  return obj;
                if (Array.isArray(obj)) return obj.map(deepClean);
                if (typeof obj === 'object') {
                  // Check if this looks like a Notion rich text object
                  if (
                    obj.href !== undefined ||
                    obj.text !== undefined ||
                    obj.type !== undefined ||
                    obj.plain_text !== undefined ||
                    obj.annotations !== undefined
                  ) {
                    return undefined; // Remove rich text objects
                  }
                  // Recursively clean nested objects
                  const cleaned: any = {};
                  for (const [key, value] of Object.entries(obj)) {
                    const cleanedValue = deepClean(value);
                    if (cleanedValue !== undefined) {
                      cleaned[key] = cleanedValue;
                    }
                  }
                  return cleaned;
                }
                return obj;
              };

              return {
                database_id: typeof db.database_id === 'string' ? db.database_id : 'unknown',
                database_name:
                  typeof db.title === 'string'
                    ? db.title // Use title field if available (from sync)
                    : typeof db.database_name === 'string'
                    ? db.database_name
                    : 'Untitled Database',
                integration_id: typeof db.integration_id === 'string' ? db.integration_id : '',
                last_sync: db.last_sync,
                sync_frequency: typeof db.sync_frequency === 'string' ? db.sync_frequency : 'daily',
                properties: deepClean(db.properties) || {},
                // Keep the icon data but clean it safely
                icon: db.icon && typeof db.icon === 'object' && db.icon.type ? db.icon : undefined,
                description: undefined,
                created_time: db.created_time,
                last_edited_time: db.last_edited_time,
                created_by: undefined,
                last_edited_by: undefined,
              };
            })
          : [];
        setDatabases(cleanData);
      }
    } catch (error) {
      console.error('Error fetching databases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getDatabaseIcon = (database: NotionDatabase): React.ReactNode => {
    // Use Notion icon if available and properly structured
    if (database.icon && typeof database.icon === 'object' && database.icon.type) {
      try {
        if (database.icon.type === 'emoji' && typeof database.icon.emoji === 'string') {
          return <span className="text-sm">{database.icon.emoji}</span>;
        } else if (database.icon.type === 'external' && database.icon.external?.url) {
          return (
            <img
              src={database.icon.external.url}
              alt="Database icon"
              className="w-4 h-4 rounded"
              onError={(e) => {
                // Fallback to default icon if image fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          );
        } else if (database.icon.type === 'file' && database.icon.file?.url) {
          return (
            <img
              src={database.icon.file.url}
              alt="Database icon"
              className="w-4 h-4 rounded"
              onError={(e) => {
                // Fallback to default icon if image fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          );
        }
      } catch (error) {
        console.warn('Error rendering Notion icon:', error);
        // Fall through to fallback icons
      }
    }

    // Fallback to name-based icons
    const name = database.database_name.toLowerCase();
    if (name.includes('daily') || name.includes('tracking'))
      return <Calendar className="w-4 h-4" />;
    if (name.includes('fitness') || name.includes('workout')) return <Target className="w-4 h-4" />;
    if (name.includes('financial') || name.includes('investment'))
      return <BarChart3 className="w-4 h-4" />;
    if (name.includes('health') || name.includes('wellness')) return <Heart className="w-4 h-4" />;
    return <Database className="w-4 h-4" />;
  };

  // Only create sections when we have valid data
  const sections: SidebarSection[] = React.useMemo(
    () => [
      {
        id: 'databases',
        title: 'Connected Databases',
        icon: <Database className="w-4 h-4" />,
        collapsible: true,
        defaultExpanded: true,
        items: databases.map((db) => {
          try {
            // Ensure all values are safe for React rendering
            const safeTitle =
              typeof db.database_name === 'string' ? db.database_name : 'Untitled Database';
            const safeId = typeof db.database_id === 'string' ? db.database_id : 'unknown';
            const safeIcon = getDatabaseIcon(db);

            return {
              id: `db-${safeId}`,
              title: safeTitle,
              icon: safeIcon,
              href: `/database/${safeId}`,
              isDatabase: true,
            };
          } catch (error) {
            console.error('Error creating database item:', error, db);
            return {
              id: `db-${db.database_id || 'unknown'}`,
              title: 'Untitled Database',
              icon: <Database className="w-4 h-4" />,
              href: `/database/${db.database_id || 'unknown'}`,
              isDatabase: true,
            };
          }
        }),
      },
      {
        id: 'preferences',
        title: 'Preferences',
        icon: <Settings className="w-4 h-4" />,
        collapsible: true,
        defaultExpanded: true,
        items: [
          {
            id: 'theme-toggle',
            title: 'Theme',
            icon: theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
            href: '#',
            isDatabase: false,
          },
        ],
      },
    ],
    [databases, theme]
  );

  const renderSidebarItem = (item: SidebarItem, level = 0) => {
    const isActive = pathname === item.href;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections.has(item.id);

    // Special handling for theme toggle
    if (item.id === 'theme-toggle') {
      return (
        <div key={item.id} className="relative">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors group w-full',
              'hover:bg-accent hover:text-accent-foreground',
              level > 0 && 'ml-6',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {React.isValidElement(item.icon) ? item.icon : <Database className="w-4 h-4" />}
              </div>
              {!isCollapsed && <span className="truncate">{item.title}</span>}
            </div>
          </button>
        </div>
      );
    }

    return (
      <div key={item.id} className="relative">
        <Link
          href={item.href || '#'}
          className={cn(
            'flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors group',
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground',
            level > 0 && 'ml-6',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {React.isValidElement(item.icon) ? item.icon : <Database className="w-4 h-4" />}
            </div>
            {!isCollapsed && <span className="truncate">{item.title}</span>}
          </div>
        </Link>
        {hasChildren && isExpanded && !isCollapsed && (
          <div className="ml-4">
            {item.children!.map((child) => renderSidebarItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-background border-r border-border h-screen flex items-center justify-center transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <LoadingSpinner />
      </div>
    );
  }

  // Safety check to prevent rendering if there are any issues
  try {
    // Test if sections can be safely created
    const testSections = sections;
  } catch (error) {
    console.error('Error creating sections:', error);
    return (
      <div
        className={cn(
          'bg-background border-r border-border h-screen flex items-center justify-center transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="text-center">
          <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Error loading sidebar</p>
        </div>
      </div>
    );
  }

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
        {sections.map((section) => (
          <div key={section.id} className="space-y-1">
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start px-3 py-2 h-auto text-sm font-medium text-muted-foreground',
                'hover:text-foreground hover:bg-accent',
                isCollapsed && 'justify-center px-2'
              )}
              onClick={() => section.collapsible && toggleSection(section.id)}
            >
              <div className="flex items-center space-x-2 w-full">
                {section.collapsible ? (
                  expandedSections.has(section.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )
                ) : (
                  section.icon
                )}
                {!isCollapsed && <span className="flex-1 text-left">{section.title}</span>}
              </div>
            </Button>

            {(!section.collapsible || expandedSections.has(section.id)) && (
              <div className="space-y-1">
                {section.items.length > 0
                  ? section.items.map((item) => renderSidebarItem(item))
                  : !isCollapsed && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No databases connected yet
                      </div>
                    )}
              </div>
            )}
          </div>
        ))}
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
