'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConnectedCalendarEvents } from './ConnectedCalendarEvents';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { getDominantColor } from '@/lib/spotify-color';
// Helper functions (duplicated from PeopleView for modularity)
// Strips both emoji (🦀) and misc symbols (♈♎⚖) so "♎ Libra" / "⚖ Libra" -> "Libra"
function extractZodiacSign(starSign: string | null): string {
  if (!starSign) return '';
  return starSign.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\s\uFE0F]*/u, '').trim() || starSign;
}

function extractFlag(location: string | null): { flag: string; text: string } {
  if (!location) return { flag: '', text: '' };
  const flagMatch = location.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  const flag = flagMatch ? flagMatch[0] : '';
  const text = location.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/u, '').trim();
  return { flag, text };
}

import { getTierColor, getTierName } from '@/lib/tier-colors';
import { FlagImage } from '@/lib/flag-utils';

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

interface PersonDetailsModalProps {
  person: Person | null;
  isOpen: boolean;
  onClose: () => void;
  onFetchEvents: (personId: string) => Promise<void>;
  events: any[];
  isLoadingEvents: boolean;
}

/**
 * Person details modal styled like a Notion page
 */
export function PersonDetailsModal({
  person,
  isOpen,
  onClose,
  onFetchEvents,
  events,
  isLoadingEvents,
}: PersonDetailsModalProps) {
  const [hasFetchedEvents, setHasFetchedEvents] = useState(false);
  const [borderColor, setBorderColor] = useState('#8b5cf6');

  // Fetch events when modal opens
  useEffect(() => {
    if (isOpen && person && !hasFetchedEvents) {
      onFetchEvents(person.id);
      setHasFetchedEvents(true);
    }
  }, [isOpen, person, hasFetchedEvents, onFetchEvents]);

  // Reset fetched flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasFetchedEvents(false);
    }
  }, [isOpen]);

  // Extract color from person's image
  useEffect(() => {
    if (person && isOpen) {
      const imageUrl = getImageUrl(person);
      if (imageUrl) {
        getDominantColor(imageUrl)
          .then((color) => {
            setBorderColor(color);
          })
          .catch(() => {
            // Fallback to default gradient colors
            setBorderColor('#8b5cf6');
          });
      } else {
        // Use default gradient if no image
        setBorderColor('#8b5cf6');
      }
    }
  }, [person, isOpen]);

  if (!person) return null;

  const imageUrl = getImageUrl(person);
  const zodiacSign = extractZodiacSign(person.star_sign);
  const currentlyAt = extractFlag(person.currently_at);
  const fromLocation = extractFlag(person.from_location);
  const age = calculateAge(person.birth_date);
  const tier = getTierName(person.tier);
  const tierColorClass = getTierColor(person.tier);

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-0 shadow-2xl">
        {/* Notion-style header with color matching person's image */}
        <div 
          className="h-1 w-full transition-colors duration-300"
          style={{ 
            background: `linear-gradient(to right, ${borderColor}, ${borderColor}dd, ${borderColor}aa)`
          }}
        />
        
        <div className="p-8">
          {/* Header Section */}
          <DialogHeader className="mb-6">
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden relative border-2 border-border">
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
                <div className="hidden w-full h-full items-center justify-center text-lg font-semibold text-foreground">
                  {getInitials(person.name)}
                </div>
              </div>

              {/* Name and Badges */}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-3xl font-bold mb-3">
                  {person.name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {tier && (
                    <Badge className={tierColorClass}>
                      {String(tier)}
                    </Badge>
                  )}
                  {age !== null && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
                      {age} years old
                    </Badge>
                  )}
                  {zodiacSign && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                      {zodiacSign}
                    </Badge>
                  )}
                  {currentlyAt.text && (
                    <Badge variant="secondary" className="bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100">
                      {currentlyAt.flag && (
                        <FlagImage
                          flagEmoji={currentlyAt.flag}
                          width={14}
                          height={10}
                          className="mr-1"
                          alt="Country flag"
                        />
                      )}
                      {currentlyAt.text}
                    </Badge>
                  )}
                  {fromLocation.text && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100">
                      {fromLocation.flag && (
                        <FlagImage
                          flagEmoji={fromLocation.flag}
                          width={14}
                          height={10}
                          className="mr-1"
                          alt="Country flag"
                        />
                      )}
                      {fromLocation.text}
                    </Badge>
                  )}
                  {person.occupation && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-100">
                      {person.occupation}
                    </Badge>
                  )}
                  {person.contact_freq && (
                    <Badge variant="secondary" className="bg-pink-100 text-pink-900 dark:bg-pink-900/30 dark:text-pink-100">
                      {person.contact_freq}
                    </Badge>
                  )}
                  {person.origin_of_connection && person.origin_of_connection.length > 0 ? (
                    person.origin_of_connection.map((origin, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100">
                        {origin}
                      </Badge>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Calendar Events Section */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Calendar Events
              </h3>
              <ConnectedCalendarEvents 
                events={events} 
                isLoading={isLoadingEvents}
              />
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}

