'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Users, Calendar, Plus, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, Database, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FilterMenu } from '@/components/FilterMenu';
import { ConnectPeopleDbDialog } from '@/components/dialogs/ConnectPeopleDbDialog';
import { useTableFilters } from '@/hooks/useTableFilters';
import { FilterState } from '@/types/filters';
import { cn } from '@/lib/utils';
import { PersonDetailsModal } from '@/app/people/PersonDetailsModal';
import { BirthdayMonthlyView } from '@/app/people/BirthdayMonthlyView';
import { PeopleActivitySummary } from '@/components/PeopleActivitySummary';

// Zodiac sign symbols mapping
const zodiacSymbols: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

// Helper to extract zodiac sign from emoji-prefixed string
function extractZodiacSign(starSign: string | null): string {
  if (!starSign) return '';
  // Remove emoji and get sign name (e.g., "🦀 Cancer" -> "Cancer")
  return starSign.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim() || starSign;
}

// Helper to extract flag from location string
function extractFlag(location: string | null): { flag: string; text: string } {
  if (!location) return { flag: '', text: '' };
  // Extract flag emoji (usually at the end)
  const flagMatch = location.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  const flag = flagMatch ? flagMatch[0] : '';
  const text = location.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/u, '').trim();
  return { flag, text };
}

import { getTierColor, getTierName, getTierBgColor } from '@/lib/tier-colors';

// Helper to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Helper to calculate age from birth date
function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Helper to get image URL - prefer image_url from Supabase Storage, fallback to extracting from JSONB
function getImageUrl(person: Person): string | null {
  // Prefer Supabase Storage URL if available
  if (person.image_url) {
    return person.image_url;
  }
  
  // Fallback to extracting from Notion JSONB (for backward compatibility)
  const imageData = person.image;
  if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
    return null;
  }

  const firstFile = imageData[0];
  if (firstFile.type === 'external' && firstFile.external?.url) {
    return firstFile.external.url;
  }
  if (firstFile.type === 'file' && firstFile.file?.url) {
    return firstFile.file.url;
  }

  return null;
}

interface Person {
  id: string;
  name: string;
  tier: string[] | Array<{ name: string; color?: string }> | null;
  origin_of_connection: string[] | null;
  star_sign: string | null;
  currently_at: string | null;
  from_location: string | null;
  birth_date: string | null;
  occupation: string | null;
  contact_freq: string | null;
  image: any;
  image_url?: string | null;
  age: any;
  birthday: any;
}

type ViewType = 'activity' | 'default' | 'card' | 'birthdays';

// Properties for filter menu
const properties = {
  name: { name: 'Name', type: 'title' },
  tier: { name: 'Tier', type: 'multi_select' },
  origin_of_connection: { name: 'Origin of connection', type: 'multi_select' },
  birth_date: { name: 'Birth Date', type: 'date' },
  star_sign: { name: 'Star sign', type: 'select' },
  occupation: { name: 'Occupation', type: 'rich_text' },
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'tier', label: 'Tier' },
  { key: 'origin_of_connection', label: 'Origin of connection' },
  { key: 'birth_date', label: 'Birth Date' },
  { key: 'star_sign', label: 'Star sign' },
  { key: 'age', label: 'Age' },
  { key: 'currently_at', label: 'Currently at' },
  { key: 'from_location', label: 'From' },
  { key: 'occupation', label: 'Occupation' },
];

export function PeopleView() {
  const [viewType, setViewType] = useState<ViewType>('activity');
  const [filters, setFilters] = useState<FilterState>({ groups: [] });
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [personEvents, setPersonEvents] = useState<Record<string, any[]>>({});
  const [isLinkingEvents, setIsLinkingEvents] = useState(false);
  const [loadingPersonEvents, setLoadingPersonEvents] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);

  // Check connection status
  useEffect(() => {
    checkConnection();
  }, []);

  // Fetch people when connected
  useEffect(() => {
    if (isConnected) {
      fetchPeople();
    }
  }, [isConnected]);

  // Don't fetch events for all people automatically - only fetch when needed
  // (when card view is shown or when a row is expanded)

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/people/connection');
      const data = await response.json();
      
      if (data.connected) {
        setIsConnected(true);
        setConnectionInfo(data.database);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPeople = async () => {
    try {
      const response = await fetch('/api/people');
      const data = await response.json();
      setPeople(data.people || []);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/people/sync', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchPeople();
        await checkConnection(); // Update last_sync time
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchPersonEvents = async (personId: string) => {
    setLoadingPersonEvents(personId);
    try {
      const response = await fetch(`/api/people/${personId}/events`);
      const data = await response.json();
      if (response.ok) {
        setPersonEvents((prev) => ({
          ...prev,
          [personId]: data.events || [],
        }));
      }
    } catch (error) {
      console.error('Error fetching person events:', error);
    } finally {
      setLoadingPersonEvents(null);
    }
  };

  const handleLinkEvents = async () => {
    if (!confirm('This will link all existing calendar events to people based on title matching. Continue?')) {
      return;
    }

    setIsLinkingEvents(true);
    try {
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 1);
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 1);

      const response = await fetch('/api/events/link-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Success! Linked ${data.linked} events to people.\nTotal events processed: ${data.totalEvents}`);
        // Refresh person events to show newly linked ones
        Object.keys(personEvents).forEach((personId) => {
          fetchPersonEvents(personId);
        });
      } else {
        alert(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error linking events:', error);
      alert('Failed to link events. Please try again.');
    } finally {
      setIsLinkingEvents(false);
    }
  };

  const handleConnected = () => {
    setIsConnected(true);
    checkConnection();
    fetchPeople();
  };

  const { searchQuery, setSearchQuery, sortConfig, handleSort, filteredAndSortedData } =
    useTableFilters({
      data: people,
      searchFields: ['name', 'occupation', 'star_sign'],
      filters,
      getSortValue: (item, key) => {
        if (key === 'currently_at') {
          const { text } = extractFlag(item.currently_at);
          return text;
        }
        if (key === 'from_location') {
          const { text } = extractFlag(item.from_location);
          return text;
        }
        if (key === 'age') {
          return calculateAge(item.birth_date);
        }
        return item[key as keyof Person];
      },
    });

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, setSearchQuery]);

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-3 h-3" />;
    }
    if (sortConfig.direction === 'desc') {
      return <ArrowDown className="w-3 h-3" />;
    }
    return <ArrowUpDown className="w-3 h-3 opacity-50" />;
  };

  const handleClearFilters = () => {
    setFilters({ groups: [] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="relative w-full h-48 md:h-64 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-200/60 via-green-300/50 to-blue-400/60 dark:from-orange-300/40 dark:via-green-400/30 dark:to-blue-500/40" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,165,0,0.4),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.3),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_50%,rgba(255,165,0,0.3),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.2),transparent_50%)]" />
            <div className="absolute inset-0 backdrop-blur-sm" />
          </div>
          <div className="relative z-10 h-full flex flex-col justify-end p-6">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-foreground" />
              <h1 className="text-3xl font-bold text-foreground">People</h1>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <Card className="p-12 text-center">
            <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your People Database</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your Notion People database to sync and view your contacts. Once connected,
              you can view, search, and filter your people data.
            </p>
            <Button onClick={() => setShowConnectDialog(true)} size="lg">
              <Database className="w-4 h-4 mr-2" />
              Connect Database
            </Button>
          </Card>
        </div>

        <ConnectPeopleDbDialog
          isOpen={showConnectDialog}
          onClose={() => setShowConnectDialog(false)}
          onConnected={handleConnected}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Background Image */}
      <div className="relative w-full h-48 md:h-64 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-200/60 via-green-300/50 to-blue-400/60 dark:from-orange-300/40 dark:via-green-400/30 dark:to-blue-500/40" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,165,0,0.4),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.3),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_50%,rgba(255,165,0,0.3),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.2),transparent_50%)]" />
          <div className="absolute inset-0 backdrop-blur-sm" />
        </div>
        <div className="relative z-10 h-full flex flex-col justify-end p-6">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-foreground" />
            <h1 className="text-3xl font-bold text-foreground">People</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* View Options and Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="default">Default view</TabsTrigger>
              <TabsTrigger value="card">Card</TabsTrigger>
              <TabsTrigger value="birthdays">Birthdays</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh from Notion"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLinkEvents}
              disabled={isLinkingEvents}
              title="Link existing calendar events to people"
            >
              <Database className={cn('w-4 h-4 mr-2', isLinkingEvents && 'animate-spin')} />
              {isLinkingEvents ? 'Linking...' : 'Link Events'}
            </Button>
            <FilterMenu
              properties={properties}
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={handleClearFilters}
            />
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Activity Summary View */}
        {viewType === 'activity' && (
          <PeopleActivitySummary
            people={filteredAndSortedData}
            onPersonClick={(person) => {
              setSelectedPerson(person);
              setIsPersonModalOpen(true);
              // Fetch events when opening modal
              if (!personEvents[person.id]) {
                fetchPersonEvents(person.id);
              }
            }}
          />
        )}

        {/* People Grid - Grouped by Tier */}
        {viewType === 'card' && (() => {
          // Group people by tier
          const groupedByTier = filteredAndSortedData.reduce((acc, person) => {
            const tier = getTierName(person.tier) || 'Other';
            if (!acc[tier]) {
              acc[tier] = [];
            }
            acc[tier].push(person);
            return acc;
          }, {} as Record<string, typeof filteredAndSortedData>);

          // Sort tiers: Me first, then alphabetically
          const tierOrder = ['Tier Me', 'Tier L', 'Tier CR', 'Tier F', 'Tier MU', 'Tier SA', 'Tier A'];
          const sortedTiers = Object.keys(groupedByTier).sort((a, b) => {
            const aIndex = tierOrder.indexOf(a);
            const bIndex = tierOrder.indexOf(b);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.localeCompare(b);
          });

          if (sortedTiers.length === 0) {
            return (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No people found</p>
              </Card>
            );
          }

          return (
            <div className="space-y-6">
              {sortedTiers.map((tier) => {
                const peopleInTier = groupedByTier[tier];
                const firstPerson = peopleInTier[0];
                return (
                  <div key={tier} className="space-y-3">
                    {/* Tier Header */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn('text-sm px-3 py-1', getTierColor(firstPerson.tier))}
                      >
                        {String(tier)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {peopleInTier.length} {peopleInTier.length === 1 ? 'person' : 'people'}
                      </span>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                      {peopleInTier.map((person) => {
                        const zodiacSign = extractZodiacSign(person.star_sign);
                        const currentlyAt = extractFlag(person.currently_at);
                        const age = calculateAge(person.birth_date);
                        const imageUrl = getImageUrl(person);

                        return (
                          <Card
                            key={person.id}
                            className={cn(
                              "group overflow-hidden hover:shadow-lg transition-all cursor-pointer",
                              getTierBgColor(person.tier)
                            )}
                            onClick={async () => {
                              setSelectedPerson(person);
                              setIsPersonModalOpen(true);
                              // Fetch events when opening modal
                              if (!personEvents[person.id]) {
                                fetchPersonEvents(person.id);
                              }
                            }}
                          >
                            {/* Profile Image - Smaller */}
                            <div className="h-20 w-full overflow-hidden bg-muted/20 relative">
                              {imageUrl ? (
                                <>
                                  {/* Blurred background image */}
                                  <div className="absolute inset-0">
                                    <Image
                                      src={imageUrl}
                                      alt=""
                                      fill
                                      className="object-cover blur-md scale-110 opacity-50"
                                      unoptimized
                                      aria-hidden="true"
                                    />
                                  </div>
                                  {/* Actual image - centered and fitted */}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="relative w-16 h-16 rounded-full overflow-hidden">
                                      <Image
                                        src={imageUrl}
                                        alt={person.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                        onError={(e) => {
                                          // Fallback to initials if image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.closest('.relative')?.parentElement?.style.setProperty('display', 'none');
                                          const fallback = target.closest('.h-20')?.querySelector('.fallback-initials') as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                    </div>
                                  </div>
                                </>
                              ) : null}
                              <div
                                className={cn(
                                  'fallback-initials w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900',
                                  imageUrl && 'hidden'
                                )}
                              >
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-lg font-semibold text-primary">
                                    {person.name.charAt(0)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Content */}
                            <div className="p-3 space-y-2">
                              {/* Name */}
                              <h3 className="font-semibold text-xs leading-tight group-hover:text-primary transition-colors line-clamp-1">
                                {person.name}
                              </h3>

                              {/* Birth Date */}
                              {person.birth_date && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{formatDate(person.birth_date)}</span>
                                </div>
                              )}

                              {/* Star Sign */}
                              {zodiacSign && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <span className="text-sm">
                                    {zodiacSymbols[zodiacSign] || '⭐'}
                                  </span>
                                  <span className="truncate">{zodiacSign}</span>
                                </div>
                              )}

                              {/* Location */}
                              {currentlyAt.text && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {currentlyAt.flag && <span>{currentlyAt.flag}</span>}
                                  <span className="truncate">{currentlyAt.text}</span>
                                </div>
                              )}

                              {/* Calendar Events Count */}
                              {personEvents[person.id] && personEvents[person.id].length > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span>{personEvents[person.id].length} event{personEvents[person.id].length !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Default/Table View */}
        {viewType === 'default' && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className="text-xs font-medium cursor-pointer hover:bg-muted/70 transition-colors group"
                        onClick={() => handleSort(column.key)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{column.label}</span>
                          {getSortIcon(column.key)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                        No people found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedData.map((person) => {
                      const zodiacSign = extractZodiacSign(person.star_sign);
                      const currentlyAt = extractFlag(person.currently_at);
                      const fromLocation = extractFlag(person.from_location);
                      const age = calculateAge(person.birth_date);
                      const tier = getTierName(person.tier);
                      const imageUrl = getImageUrl(person);
                      const events = personEvents[person.id] || [];

                      return (
                        <React.Fragment key={person.id}>
                          <TableRow
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={async () => {
                              setSelectedPerson(person);
                              setIsPersonModalOpen(true);
                              // Fetch events when opening modal
                              if (!personEvents[person.id]) {
                                fetchPersonEvents(person.id);
                              }
                            }}
                          >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                                {imageUrl ? (
                                  <Image
                                    src={imageUrl}
                                    alt={person.name}
                                    fill
                                    className="object-cover rounded-full"
                                    unoptimized
                                    onError={(e) => {
                                      // Fallback to initials if image fails to load
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <span
                                  className={cn(
                                    'text-xs font-medium text-primary',
                                    imageUrl && 'hidden'
                                  )}
                                >
                                  {person.name.charAt(0)}
                                </span>
                              </div>
                              <span className="text-sm font-medium">{person.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {tier && (
                              <Badge
                                variant="secondary"
                                className={cn('text-xs px-2 py-0.5', getTierColor(person.tier))}
                              >
                                {String(tier)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {person.origin_of_connection && person.origin_of_connection.length > 0 && (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                {person.origin_of_connection.join(', ')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {person.birth_date ? formatDate(person.birth_date) : ''}
                          </TableCell>
                          <TableCell>
                            {zodiacSign && (
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="text-base">
                                  {zodiacSymbols[zodiacSign] || '⭐'}
                                </span>
                                <span>{zodiacSign}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{age !== null ? age : ''}</TableCell>
                          <TableCell>
                            {currentlyAt.text && (
                              <div className="flex items-center gap-1.5 text-sm">
                                {currentlyAt.flag && <span className="text-base">{currentlyAt.flag}</span>}
                                <span>{currentlyAt.text}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {fromLocation.text && (
                              <div className="flex items-center gap-1.5 text-sm">
                                {fromLocation.flag && <span className="text-base">{fromLocation.flag}</span>}
                                <span>{fromLocation.text}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{person.occupation || ''}</TableCell>
                        </TableRow>
                      </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Footer Stats */}
            <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>COUNT {filteredAndSortedData.length}</span>
              {searchQuery && <span>(filtered from {people.length})</span>}
              <span>UNIQUE {new Set(filteredAndSortedData.map((p) => getTierName(p.tier)).filter(Boolean)).size}</span>
              {filteredAndSortedData.length > 0 && (
                <span>
                  AVERAGE{' '}
                  {(
                    filteredAndSortedData
                      .map((p) => calculateAge(p.birth_date))
                      .filter((a): a is number => a !== null)
                      .reduce((sum, a) => sum + a, 0) /
                    filteredAndSortedData.filter((p) => calculateAge(p.birth_date) !== null).length
                  ).toFixed(2)}
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Birthdays View */}
        {viewType === 'birthdays' && (
          <BirthdayMonthlyView
            people={filteredAndSortedData}
            onPersonClick={(person) => {
              setSelectedPerson(person);
              setIsPersonModalOpen(true);
              // Fetch events when opening modal
              if (!personEvents[person.id]) {
                fetchPersonEvents(person.id);
              }
            }}
          />
        )}
      </div>

      {/* Person Details Modal */}
      <PersonDetailsModal
        person={selectedPerson}
        isOpen={isPersonModalOpen}
        onClose={() => {
          setIsPersonModalOpen(false);
          setSelectedPerson(null);
        }}
        onFetchEvents={fetchPersonEvents}
        events={selectedPerson ? (personEvents[selectedPerson.id] || []) : []}
        isLoadingEvents={selectedPerson ? (loadingPersonEvents === selectedPerson.id) : false}
      />
    </div>
  );
}
