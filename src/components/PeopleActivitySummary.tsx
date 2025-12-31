'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addYears, subYears } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTierName, getTierColor } from '@/lib/tier-colors';

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

interface Event {
  id: string;
  title: string;
  start: string;
  htmlLink?: string;
}

interface ActivityData {
  activity: Record<string, Record<string, Event[]>>; // month -> personId -> events
  months: string[];
}

interface PeopleActivitySummaryProps {
  people: Person[];
  onPersonClick?: (person: Person) => void;
}

// Helper to get image URL
function getImageUrl(person: Person): string | null {
  if (person.image_url) {
    return person.image_url;
  }

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

export function PeopleActivitySummary({ people, onPersonClick }: PeopleActivitySummaryProps) {
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date());
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    fetchActivitySummary();
  }, []);

  // Set initial year to the most recent year with activity when data loads
  useEffect(() => {
    if (activityData && activityData.months.length > 0) {
      const years = activityData.months.map((m) => parseInt(m.split('-')[0]));
      const maxYear = Math.max(...years);
      setCurrentYear(new Date(maxYear, 0, 1));
    }
  }, [activityData]);

  const fetchActivitySummary = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/people/activity-summary');
      if (response.ok) {
        const data = await response.json();
        setActivityData(data);
      }
    } catch (error) {
      console.error('Error fetching activity summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="text-muted-foreground">Loading activity summary...</div>
      </Card>
    );
  }

  if (!activityData || activityData.months.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">No activity data available</p>
        <p className="text-sm text-muted-foreground mt-2">
          Link calendar events to people to see activity here
        </p>
      </Card>
    );
  }

  // Get current month key (YYYY-MM) - use current date for "This Month" and "Next Month" labels
  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthKey = format(nextMonth, 'yyyy-MM');

  // Generate all months for the currently selected year
  const generateAllMonths = (): string[] => {
    const selectedYear = currentYear.getFullYear();
    const allMonths: string[] = [];

    // Always generate all 12 months for the selected year
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
      allMonths.push(monthKey);
    }

    // Sort: current month first, next month second, then reverse chronological (newest first)
    return allMonths.sort((a, b) => {
      if (a === currentMonthKey) return -1;
      if (b === currentMonthKey) return 1;
      if (a === nextMonthKey) return -1;
      if (b === nextMonthKey) return 1;
      return b.localeCompare(a); // Reverse chronological
    });
  };

  const allMonths = generateAllMonths();

  // Get people with activity in a month, sorted by unique day count (descending)
  const getPeopleWithActivity = (monthKey: string): Person[] => {
    const monthActivity = activityData.activity[monthKey] || {};
    const personIds = Object.keys(monthActivity);
    const peopleWithActivity = people.filter((p) => personIds.includes(p.id));

    // Sort by unique day count (descending) - multiple events on same day count as one
    return peopleWithActivity.sort((a, b) => {
      const aDays = monthActivity[a.id]?.length || 0;
      const bDays = monthActivity[b.id]?.length || 0;
      return bDays - aDays;
    });
  };

  // Helper to determine if a month is current, next, or past
  const getMonthLabel = (monthKey: string): string => {
    if (monthKey === currentMonthKey) return 'This Month';
    if (monthKey === nextMonthKey) return 'Next Month';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Activity Summary</h2>
          <p className="text-sm text-muted-foreground">People you've interacted with by month</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentYear(addYears(currentYear, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {currentYear.getFullYear()}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentYear(subYears(currentYear, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* All Months Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allMonths.map((monthKey) => {
          const monthPeople = getPeopleWithActivity(monthKey);
          const monthLabel = getMonthLabel(monthKey);
          const hasActivity = monthPeople.length > 0;

          return (
            <Card key={monthKey} className={cn('p-4', !hasActivity && 'opacity-60')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">
                    {format(new Date(monthKey + '-01'), 'MMM yyyy')}
                  </h4>
                  {monthLabel && (
                    <Badge variant="outline" className="text-xs">
                      {monthLabel}
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {monthPeople.length}
                </Badge>
              </div>
              {hasActivity ? (
                <div className="space-y-1">
                  {monthPeople.map((person) => {
                    const days = activityData.activity[monthKey]?.[person.id] || [];
                    const imageUrl = getImageUrl(person);

                    return (
                      <div
                        key={person.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => {
                          setSelectedPerson(person);
                          setSelectedMonth(monthKey);
                          onPersonClick?.(person);
                        }}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0 relative">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={person.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                              <span className="text-xs font-semibold text-primary">
                                {person.name.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs truncate flex-1">{person.name}</span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {days.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-2">No activity</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Selected Person Details Modal */}
      {selectedPerson && selectedMonth && (
        <Card className="p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {(() => {
                const imageUrl = getImageUrl(selectedPerson);
                return (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0 relative">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={selectedPerson.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                        <span className="text-xs font-semibold text-primary">
                          {selectedPerson.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div>
                <h4 className="font-medium text-sm">{selectedPerson.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPerson(null);
                setSelectedMonth(null);
              }}
            >
              Close
            </Button>
          </div>
          <div className="space-y-2">
            {(() => {
              const days = activityData.activity[selectedMonth]?.[selectedPerson.id] || [];
              if (days.length === 0) {
                return <p className="text-sm text-muted-foreground">No activity</p>;
              }
              return days.map((day: any) => (
                <div
                  key={day.id}
                  className="flex items-center gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{day.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(day.start), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {day.htmlLink && (
                    <a
                      href={day.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              ));
            })()}
          </div>
        </Card>
      )}
    </div>
  );
}
