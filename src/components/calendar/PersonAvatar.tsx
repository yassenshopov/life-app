'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PersonAvatarProps {
  person: {
    id: string;
    name: string;
    image?: any;
    image_url?: string | null;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

// Helper to get image URL - prefer image_url from Supabase Storage, fallback to extracting from JSONB
function getImageUrl(person: PersonAvatarProps['person']): string | null {
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

export function PersonAvatar({ person, size = 'sm', className, onClick }: PersonAvatarProps) {
  const imageUrl = getImageUrl(person);
  const sizeClasses = {
    xs: 'w-4 h-4', // 16px
    sm: 'w-5 h-5', // 20px - bigger for better visibility
    md: 'w-6 h-6', // 24px
    lg: 'w-8 h-8', // 32px
  };
  const textSizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const avatarContent = (
    <span
      className={cn(
        'inline-block rounded-full overflow-hidden bg-primary/20 relative cursor-pointer',
        sizeClasses[size],
        onClick && 'hover:opacity-80 transition-opacity',
        className
      )}
      style={{ 
        verticalAlign: 'middle',
        lineHeight: 1,
        display: 'inline-block',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={person.name}
    >
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
      <span
        className={cn(
          'font-medium text-primary absolute inset-0 flex items-center justify-center',
          textSizeClasses[size]
        )}
        style={{ display: imageUrl ? 'none' : 'flex' }}
      >
        {person.name.charAt(0)}
      </span>
    </span>
  );

  return avatarContent;
}

