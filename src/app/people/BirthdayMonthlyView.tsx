'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { Cake } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Person {
  id: string;
  name: string;
  tier: string[] | Array<{ name: string; color?: string }> | null;
  birth_date: string | null;
  image: any;
  image_url?: string | null;
  star_sign: string | null;
}

interface BirthdayMonthlyViewProps {
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

import { getTierColor, getTierName } from '@/lib/tier-colors';

// Get birthday month and day from birth date
function getBirthdayMonthDay(birthDate: string | null): { month: number; day: number } | null {
  if (!birthDate) return null;
  
  try {
    const birth = new Date(birthDate);
    return {
      month: birth.getMonth(),
      day: birth.getDate(),
    };
  } catch {
    return null;
  }
}

// Check if today is someone's birthday (ignoring year)
function isBirthdayToday(birthDate: string | null): boolean {
  if (!birthDate) return false;
  
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    return birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate();
  } catch {
    return false;
  }
}

interface MonthData {
  monthIndex: number;
  monthName: string;
  people: Person[];
  peopleCount: number;
}

export function BirthdayMonthlyView({
  people,
  onPersonClick,
}: BirthdayMonthlyViewProps) {
  // Group people by birthday month
  const monthsData = useMemo(() => {
    const monthsMap = new Map<number, MonthData>();
    
    people.forEach((person) => {
      const monthDay = getBirthdayMonthDay(person.birth_date);
      if (!monthDay) return;
      
      const { month } = monthDay;
      
      if (!monthsMap.has(month)) {
        const monthDate = new Date(2024, month, 1); // Use 2024 as a reference year for formatting
        monthsMap.set(month, {
          monthIndex: month,
          monthName: format(monthDate, 'MMMM'),
          people: [],
          peopleCount: 0,
        });
      }
      
      const monthData = monthsMap.get(month)!;
      monthData.people.push(person);
      monthData.peopleCount++;
    });
    
    // Sort people within each month by day
    monthsMap.forEach((monthData) => {
      monthData.people.sort((a, b) => {
        const dateA = getBirthdayMonthDay(a.birth_date);
        const dateB = getBirthdayMonthDay(b.birth_date);
        if (!dateA || !dateB) return 0;
        return dateA.day - dateB.day;
      });
    });
    
    return Array.from(monthsMap.values()).sort((a, b) => 
      a.monthIndex - b.monthIndex
    );
  }, [people]);

  // Get all 12 months, filling in empty months
  const displayMonths = useMemo(() => {
    const months: MonthData[] = [];
    
    // Generate all 12 months
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(2024, i, 1);
      const existingMonth = monthsData.find(m => m.monthIndex === i);
      
      if (existingMonth) {
        months.push(existingMonth);
      } else {
        months.push({
          monthIndex: i,
          monthName: format(monthDate, 'MMMM'),
          people: [],
          peopleCount: 0,
        });
      }
    }
    
    return months;
  }, [monthsData]);

  const isCurrentMonth = (monthIndex: number) => {
    const today = new Date();
    return today.getMonth() === monthIndex;
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Months Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {displayMonths.map((month) => {
              const isCurrent = isCurrentMonth(month.monthIndex);
              const { people: monthPeople, peopleCount } = month;
              const hasData = peopleCount > 0;

              return (
                <Card
                  key={month.monthIndex}
                  className={cn(
                    'p-4 transition-all',
                    !hasData && 'opacity-60'
                  )}
                >
                  <div className="space-y-3">
                    {/* Month Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {month.monthName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {peopleCount} {peopleCount === 1 ? 'birthday' : 'birthdays'}
                        </div>
                      </div>
                      {isCurrent && (
                        <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                          Current
                        </div>
                      )}
                    </div>

                    {/* People Badges */}
                    {hasData ? (
                      <div className="space-y-2">
                        {monthPeople.map((person) => {
                          const imageUrl = getImageUrl(person);
                          const monthDay = getBirthdayMonthDay(person.birth_date);
                          const isToday = isBirthdayToday(person.birth_date);
                          const tier = getTierName(person.tier);
                          
                          // Format the date using a reference year
                          const referenceDate = monthDay 
                            ? new Date(2024, monthDay.month, monthDay.day)
                            : null;
                          
                          return (
                            <div
                              key={person.id}
                              onClick={() => onPersonClick?.(person)}
                              className={cn(
                                'flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer hover:shadow-sm',
                                isToday && 'bg-primary/5 border-primary/20',
                                !isToday && 'bg-muted/30 border-border hover:bg-muted/50'
                              )}
                            >
                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden relative border border-border">
                                {imageUrl ? (
                                  <Image
                                    src={imageUrl}
                                    alt={person.name}
                                    fill
                                    className="object-cover rounded-full"
                                    unoptimized
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className="hidden w-full h-full items-center justify-center text-xs font-semibold text-foreground">
                                  {getInitials(person.name)}
                                </div>
                              </div>

                              {/* Person Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">
                                    {person.name}
                                  </span>
                                  {isToday && (
                                    <Cake className="w-3 h-3 text-primary flex-shrink-0" />
                                  )}
                                </div>
                                {referenceDate && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {format(referenceDate, 'MMM d')}
                                  </div>
                                )}
                              </div>

                              {/* Tier Badge */}
                              {tier && (
                                <Badge
                                  variant="secondary"
                                  className={cn('text-xs px-1.5 py-0 flex-shrink-0', getTierColor(person.tier))}
                                >
                                  {String(tier)}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground py-4 text-center">
                        No birthdays this month
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
    </div>
  );
}

