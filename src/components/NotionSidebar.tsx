'use client';

import { useState, useEffect } from 'react';
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
  Menu,
  ChevronLeft,
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

  const fetchDatabases = async () => {
    try {
      const response = await fetch('/api/user/notion-credentials');
      if (response.ok) {
        const data = await response.json();
        setDatabases(data);
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

  const getDatabaseIcon = (database: NotionDatabase) => {
    // Use Notion icon if available
    if (database.icon) {
      if (database.icon.type === 'emoji') {
        return <span className="text-sm">{database.icon.emoji}</span>;
      } else if (database.icon.type === 'external') {
        return (
          <img src={database.icon.external.url} alt="Database icon" className="w-4 h-4 rounded" />
        );
      } else if (database.icon.type === 'file') {
        return <img src={database.icon.file.url} alt="Database icon" className="w-4 h-4 rounded" />;
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

  const sections: SidebarSection[] = [
    {
      id: 'databases',
      title: 'Connected Databases',
      icon: <Database className="w-4 h-4" />,
      collapsible: true,
      defaultExpanded: true,
      items: databases.map((db) => ({
        id: `db-${db.database_id}`,
        title: db.database_name,
        icon: getDatabaseIcon(db),
        href: `/database/${db.database_id}`,
        isDatabase: true,
      })),
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
  ];

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
              <div className="flex-shrink-0">{item.icon}</div>
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
            <div className="flex-shrink-0">{item.icon}</div>
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

  return (
    <div
      className={cn(
        'bg-background border-r border-border h-screen overflow-y-auto transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="Frameworked Logo"
              width={32}
              height={32}
              className="invert dark:invert-0"
            />
            {!isCollapsed && (
              <span className={`font-semibold text-lg ${outfit.className}`}>Frameworked</span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
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
