'use client';

import React, { useEffect, useState } from 'react';
import { Home, Trophy, User, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { getDominantColor } from '@/lib/spotify-color';
import { cn } from '@/lib/utils';

function getPersonImageUrl(person: OriginPerson): string | null {
  if (person.image_url) return person.image_url;
  const imageData = person.image;
  if (!imageData || !Array.isArray(imageData) || imageData.length === 0) return null;
  const first = imageData[0];
  if (first?.type === 'external' && first?.external?.url) return first.external.url;
  if (first?.type === 'file' && first?.file?.url) return first.file.url;
  return null;
}

/** Minimal person shape for matching origin string to a person and showing avatar */
export interface OriginPerson {
  id: string;
  name: string;
  nicknames?: string[] | null;
  image?: unknown;
  image_url?: string | null;
}

/** If origin string matches a person's name or nickname (any part), return that person */
export function findPersonForOrigin(
  origin: string,
  people: OriginPerson[]
): OriginPerson | null {
  const raw = origin.trim();
  if (!raw || people.length === 0) return null;
  const lower = raw.toLowerCase();
  for (const person of people) {
    const nameLower = person.name.toLowerCase();
    const nicknames = (person.nicknames || []).map((n) => n.toLowerCase());
    if (lower === nameLower) return person;
    if (nameLower.includes(lower) || lower.includes(nameLower)) return person;
    if (nicknames.some((n) => n === lower || n.includes(lower) || lower.includes(n)))
      return person;
  }
  return null;
}

const TINDER_LOGO_URL =
  'https://cdn.brandfetch.io/id2Hf2OMju/theme/light/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B';
const BUMBLE_LOGO_URL =
  'https://cdn.brandfetch.io/idQupqiqlU/theme/dark/idTpakKOW7.svg?c=1dxbfHSJFAPEGdCLU4o5B';
const STRATHCLYDE_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/en/thumb/2/21/University_of_Strathclyde_Coat_of_Arms.svg/1280px-University_of_Strathclyde_Coat_of_Arms.svg.png';
const FELS_LOGO_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQuLHwHYAB309PGattQEjhqvw-MLFewQ_VYBA&s';
/** People Make Glasgow – logo in public/origins/glasgow.png */
const GLASGOW_LOGO_URL = '/origins/glasgow.png';
const SOU_123_LOGO_URL =
  'https://lh5.googleusercontent.com/-G-8WI35P4nA/UT76I47nvtI/AAAAAAAAcB8/hIRJz5ACRIE/s345/56rtyh.jpg';
const ZARAGOZA_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Bandera_de_Espa%C3%B1a_%28sin_escudo%29.svg/250px-Bandera_de_Espa%C3%B1a_%28sin_escudo%29.svg.png';

export type OriginConfig = {
  label: string;
  bgClass: string;
  textClass: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  /** When set, use this image URL instead of icon (e.g. Brandfetch logo) */
  logoUrl?: string;
};

const ORIGIN_CONFIG: Record<string, OriginConfig> = {
  tinder: {
    label: 'Tinder',
    bgClass: 'bg-[#FE3C72] dark:bg-[#FE3C72]',
    textClass: 'text-white dark:text-white',
    logoUrl: TINDER_LOGO_URL,
  },
  bumble: {
    label: 'Bumble',
    bgClass: 'bg-[#FFC629] dark:bg-[#FFC629]',
    textClass: 'text-black dark:text-black',
    logoUrl: BUMBLE_LOGO_URL,
  },
  strathclyde: {
    label: 'Strathclyde',
    bgClass: 'bg-white dark:bg-white border border-gray-200 dark:border-gray-600',
    textClass: 'text-black dark:text-black',
    logoUrl: STRATHCLYDE_LOGO_URL,
  },
  fels: {
    label: 'FELS',
    bgClass: 'bg-white dark:bg-white border border-gray-200 dark:border-gray-600',
    textClass: 'text-black dark:text-black',
    logoUrl: FELS_LOGO_URL,
  },
  glasgow: {
    label: 'Glasgow',
    bgClass: 'bg-[#E4008C] dark:bg-[#E4008C]',
    textClass: 'text-white dark:text-white',
    logoUrl: GLASGOW_LOGO_URL,
  },
  '123 sou': {
    label: '123 SOU',
    bgClass: 'bg-white dark:bg-white border border-gray-200 dark:border-gray-600',
    textClass: 'text-black dark:text-black',
    logoUrl: SOU_123_LOGO_URL,
  },
  'krasna polyana': {
    label: 'Krasna Polyana',
    bgClass: 'bg-emerald-600 dark:bg-emerald-600',
    textClass: 'text-white dark:text-white',
  },
  zaragoza: {
    label: 'Zaragoza',
    bgClass: 'bg-[#f7be31] dark:bg-[#f7be31]',
    textClass: 'text-black dark:text-black',
    logoUrl: ZARAGOZA_LOGO_URL,
  },
  family: {
    label: 'Family',
    bgClass: 'bg-rose-500 dark:bg-rose-500',
    textClass: 'text-white dark:text-white',
    icon: Home,
  },
  'mutual friends': {
    label: 'Mutual friends',
    bgClass: 'bg-indigo-500 dark:bg-indigo-500',
    textClass: 'text-white dark:text-white',
    icon: UsersRound,
  },
  me: {
    label: 'Me',
    bgClass: 'bg-violet-500 dark:bg-violet-500',
    textClass: 'text-white dark:text-white',
    icon: User,
  },
  competition: {
    label: 'Competition',
    bgClass: 'bg-amber-500 dark:bg-amber-500',
    textClass: 'text-white dark:text-white',
    icon: Trophy,
  },
};

function getOriginConfig(origin: string): OriginConfig | null {
  const key = origin.trim().toLowerCase();
  return ORIGIN_CONFIG[key] ?? null;
}

export const ORIGIN_OPTIONS = Object.keys(ORIGIN_CONFIG);

export interface OriginOfConnectionBadgeProps {
  origin: string;
  /** When set, render as person chip (avatar + name) like people-input, ignoring preset config */
  matchedPerson?: OriginPerson | null;
  className?: string;
  size?: 'sm' | 'default';
}

const DEFAULT_PERSON_BADGE_COLOR = 'hsl(var(--muted))';

export function OriginOfConnectionBadge({
  origin,
  matchedPerson,
  className,
  size = 'default',
}: OriginOfConnectionBadgeProps) {
  const [personBadgeColor, setPersonBadgeColor] = useState<string>(DEFAULT_PERSON_BADGE_COLOR);

  useEffect(() => {
    if (!matchedPerson) return;
    setPersonBadgeColor(DEFAULT_PERSON_BADGE_COLOR);
    const imageUrl = getPersonImageUrl(matchedPerson);
    if (!imageUrl) return;
    let cancelled = false;
    getDominantColor(imageUrl)
      .then((color) => {
        if (!cancelled) setPersonBadgeColor(color);
      })
      .catch(() => {
        if (!cancelled) setPersonBadgeColor(DEFAULT_PERSON_BADGE_COLOR);
      });
    return () => {
      cancelled = true;
    };
  }, [matchedPerson]);

  if (matchedPerson) {
    const avatarSize = size === 'sm' ? 'xs' : 'sm';
    return (
      <Badge
        variant="secondary"
        className={cn(
          'inline-flex items-center justify-center gap-1.5 border-0 font-medium text-white',
          size === 'sm' && 'text-xs px-2 py-0.5',
          size === 'default' && 'text-xs px-2.5 py-0.5',
          className
        )}
        style={{ backgroundColor: personBadgeColor }}
      >
        <PersonAvatar person={matchedPerson} size={avatarSize} />
        <span className="text-center">{origin}</span>
      </Badge>
    );
  }

  const config = getOriginConfig(origin);
  const displayLabel = config?.label ?? origin;

  if (config) {
    const iconSizeClass = size === 'sm' ? 'size-3' : 'size-3.5';
    return (
      <Badge
        variant="secondary"
        className={cn(
          'inline-flex items-center justify-center gap-2.5 border-0 font-semibold',
          config.bgClass,
          config.textClass,
          size === 'sm' && 'text-xs px-2 py-0.5',
          size === 'default' && 'text-xs px-2.5 py-0.5',
          className
        )}
      >
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt=""
            className={cn('shrink-0', iconSizeClass)}
            width={size === 'sm' ? 12 : 14}
            height={size === 'sm' ? 12 : 14}
          />
        ) : config.icon ? (
          <config.icon className={cn(iconSizeClass, config.iconClass)} />
        ) : null}
        <span className="text-center">{displayLabel}</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center justify-center bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100 border-0',
        size === 'sm' && 'text-xs px-2 py-0.5',
        size === 'default' && 'text-xs px-2.5 py-0.5',
        className
      )}
    >
      <span className="text-center">{displayLabel}</span>
    </Badge>
  );
}

export interface OriginOfConnectionBadgesProps {
  /** Array of origins, or comma-separated string; always displayed as separate pills */
  origins: string[] | string | null | undefined;
  /** When provided, any origin that matches a person's name (or nickname) is shown as a person chip with their avatar */
  people?: OriginPerson[];
  className?: string;
  size?: 'sm' | 'default';
}

/** Normalize to array of single values so we always show one pill per origin (never comma-separated in one pill) */
function normalizeToOriginList(origins: string[] | string | null | undefined): string[] {
  if (origins == null) return [];
  const list = Array.isArray(origins) ? origins : [origins];
  return list.flatMap((o) =>
    typeof o === 'string' && o.includes(',')
      ? o.split(',').map((s) => s.trim()).filter(Boolean)
      : typeof o === 'string'
        ? [o.trim()].filter(Boolean)
        : []
  );
}

export function OriginOfConnectionBadges({
  origins,
  people = [],
  className,
  size = 'default',
}: OriginOfConnectionBadgesProps) {
  const list = normalizeToOriginList(origins);
  if (!list.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1 items-center', className)}>
      {list.map((origin, idx) => {
        const config = getOriginConfig(origin);
        const matchedPerson =
          !config && people.length > 0 ? findPersonForOrigin(origin, people) : null;
        return (
          <OriginOfConnectionBadge
            key={idx}
            origin={origin}
            matchedPerson={matchedPerson ?? undefined}
            size={size}
          />
        );
      })}
    </div>
  );
}
