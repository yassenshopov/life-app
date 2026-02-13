'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { OriginOfConnectionBadges } from '@/components/OriginOfConnectionBadge';
import { cn } from '@/lib/utils';
import { MapPin, Calendar, Briefcase, Star, Users, Phone, List, User, Globe, Gift, Clock, Award, Tag, Hash } from 'lucide-react';

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

// Helper to get image URL - prefer image_url from Supabase Storage, fallback to extracting from JSONB
function getImageUrl(person: PersonWithDetails): string | null {
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

// Helper to extract zodiac sign from emoji/symbol-prefixed string
// Strips both emoji (🦀) and misc symbols (♈♎⚖) so "♎ Libra" / "⚖ Libra" -> "Libra"
function extractZodiacSign(starSign: string | null): string {
  if (!starSign) return '';
  return starSign.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\s\uFE0F]*/u, '').trim() || starSign;
}

// Helper to extract flag from location string
function extractFlag(location: string | null): { flag: string; text: string } {
  if (!location) return { flag: '', text: '' };
  const flagMatch = location.match(/^[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (flagMatch) {
    return {
      flag: flagMatch[0],
      text: location.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '').trim(),
    };
  }
  return { flag: '', text: location };
}

import { Person } from '@/lib/people-matching';
import { getTierColor, getTierName } from '@/lib/tier-colors';
import { FlagImage } from '@/lib/flag-utils';

// Extend Person interface for full details
interface PersonWithDetails extends Person {
  tier?: string[] | Array<{ name: string; color?: string }> | null;
  origin_of_connection?: string[] | null;
  star_sign?: string | null;
  currently_at?: string | null;
  from_location?: string | null;
  birth_date?: string | null;
  occupation?: string | null;
  contact_freq?: string | null;
  image_url?: string | null;
  age?: any;
  birthday?: any;
}

interface PersonDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: PersonWithDetails | null;
  /** Full people list for resolving origin-of-connection to person avatars */
  allPeople?: PersonWithDetails[] | Person[];
}

// Helper to format age from JSONB
function formatAge(age: any): string {
  if (!age) return '';
  if (typeof age === 'number') return String(age);
  if (typeof age === 'string') return age;
  if (typeof age === 'object' && age.number) return String(age.number);
  return '';
}

// Helper to format birthday from JSONB
function formatBirthday(birthday: any): string {
  if (!birthday) return '';
  if (typeof birthday === 'string') return birthday;
  if (typeof birthday === 'object' && birthday.string) return birthday.string;
  return '';
}

export function PersonDetailModal({ isOpen, onClose, person, allPeople = [] }: PersonDetailModalProps) {
  if (!person) return null;

  const imageUrl = getImageUrl(person);
  const zodiacSign = extractZodiacSign(person.star_sign);
  const zodiacSymbol = zodiacSign ? zodiacSymbols[zodiacSign] || '' : '';
  const fromLocation = extractFlag(person.from_location);
  const currentlyAt = extractFlag(person.currently_at);
  const age = formatAge(person.age);
  const birthday = formatBirthday(person.birthday);

  // Field component for consistent styling
  const Field = ({ 
    label, 
    value, 
    icon: Icon, 
    children 
  }: { 
    label: string; 
    value?: React.ReactNode; 
    icon?: React.ComponentType<{ className?: string }>;
    children?: React.ReactNode;
  }) => {
    if (!value && !children) return null;
    
    return (
      <div className="flex items-start gap-4 py-2 border-b border-border/50 last:border-b-0">
        <div className="w-[140px] flex items-center gap-2 flex-shrink-0">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <div className="flex-1 min-w-0">
          {children || <span className="text-sm">{value}</span>}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{person.name}</DialogTitle>
        </DialogHeader>
        <div className="p-8">
          {/* Header with large avatar and name */}
          <div className="flex items-end gap-4 mb-8">
            {imageUrl && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <Image
                  src={imageUrl}
                  alt={person.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-semibold mb-1">
                {person.name}
              </h1>
            </div>
          </div>

          {/* Fields list */}
          <div className="space-y-0">
            {age && (
              <Field label="Age" value={age} icon={Hash} />
            )}

            {person.birth_date && (
              <Field 
                label="Birth Date" 
                value={new Date(person.birth_date).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })} 
                icon={Calendar} 
              />
            )}

            {zodiacSign && (
              <Field 
                label="Star sign" 
                icon={Star}
              >
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                  {zodiacSymbol} {zodiacSign}
                </Badge>
              </Field>
            )}

            {person.tier && person.tier.length > 0 && (
              <Field label="Tier" icon={Award}>
                <div className="flex flex-wrap gap-1">
                  {person.tier.map((t, idx) => {
                    const tierOption = typeof t === 'string' ? { name: t, color: 'default' } : t;
                    const tierName = typeof t === 'string' ? t : t.name;
                    return (
                      <Badge key={idx} variant="secondary" className={getTierColor([tierOption])}>
                        {tierName}
                      </Badge>
                    );
                  })}
                </div>
              </Field>
            )}

            {currentlyAt.text && (
              <Field 
                label="Currently at" 
                icon={MapPin}
              >
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-100">
                  {currentlyAt.flag && (
                    <FlagImage
                      flagEmoji={currentlyAt.flag}
                      width={16}
                      height={12}
                      className="mr-1"
                      alt="Country flag"
                    />
                  )}
                  {currentlyAt.text}
                </Badge>
              </Field>
            )}

            {birthday && (
              <Field label="Birthday" value={birthday} icon={Gift} />
            )}

            {person.contact_freq && (
              <Field 
                label="Contact Freq." 
                icon={Clock}
              >
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                  {person.contact_freq}
                </Badge>
              </Field>
            )}

            {fromLocation.text && (
              <Field 
                label="From" 
                icon={MapPin}
              >
                <Badge variant="secondary" className="bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100">
                  {fromLocation.flag && (
                    <FlagImage
                      flagEmoji={fromLocation.flag}
                      width={16}
                      height={12}
                      className="mr-1"
                      alt="Country flag"
                    />
                  )}
                  {fromLocation.text}
                </Badge>
              </Field>
            )}

            {person.occupation && (
              <Field label="Occupation" value={person.occupation} icon={Briefcase} />
            )}

            {person.origin_of_connection && person.origin_of_connection.length > 0 && (
              <Field label="Origin of connection" icon={Users}>
                <OriginOfConnectionBadges origins={person.origin_of_connection} people={allPeople} />
              </Field>
            )}

            {fromLocation.text && (
              <Field 
                label="Birth country" 
                icon={Globe}
              >
                <div className="flex items-center gap-1">
                  {fromLocation.flag && (
                    <FlagImage
                      flagEmoji={fromLocation.flag}
                      width={16}
                      height={12}
                      className="mr-1"
                      alt="Country flag"
                    />
                  )}
                  <span>{fromLocation.text}</span>
                </div>
              </Field>
            )}

            {person.nicknames && person.nicknames.length > 0 && (
              <Field label="Nicknames" icon={Tag}>
                <div className="flex flex-wrap gap-1">
                  {person.nicknames.map((nickname, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-pink-100 text-pink-900 dark:bg-pink-900/30 dark:text-pink-100">
                      {nickname}
                    </Badge>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

