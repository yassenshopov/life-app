/**
 * Utility functions for handling country flags
 */

import React from 'react';

// Convert flag emoji to country code (e.g., 🇺🇸 -> 'US')
export function emojiToCountryCode(flagEmoji: string): string | null {
  if (!flagEmoji) return null;

  // Flag emojis are composed of two regional indicator symbols (U+1F1E6-U+1F1FF)
  // These correspond to letters A-Z where U+1F1E6 = A, U+1F1E7 = B, etc.
  const codePoints = Array.from(flagEmoji).map(char => char.codePointAt(0));

  // Check if we have exactly 2 regional indicator symbols
  if (codePoints.length !== 2 || !codePoints.every(cp => cp && cp >= 0x1F1E6 && cp <= 0x1F1FF)) {
    return null;
  }

  // Convert to country code
  const countryCode = codePoints
    .map(cp => String.fromCharCode((cp || 0) - 0x1F1E6 + 65)) // 65 = 'A'
    .join('');

  return countryCode;
}

// Get flag image URL from country code using flagcdn.com
export function getFlagImageUrl(countryCode: string, size: 'w20' | 'w40' | 'w80' | 'w160' | 'w320' | 'w640' | 'w1280' = 'w40'): string {
  return `https://flagcdn.com/${size}/${countryCode.toLowerCase()}.png`;
}

// Get flag image URL from flag emoji
export function getFlagImageUrlFromEmoji(flagEmoji: string, size: 'w20' | 'w40' | 'w80' | 'w160' | 'w320' | 'w640' | 'w1280' = 'w40'): string | null {
  const countryCode = emojiToCountryCode(flagEmoji);
  if (!countryCode) return null;
  return getFlagImageUrl(countryCode, size);
}

// React component for displaying flag images

interface FlagImageProps {
  countryCode?: string;
  flagEmoji?: string;
  size?: 'w20' | 'w40' | 'w80' | 'w160' | 'w320' | 'w640' | 'w1280';
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

export const FlagImage: React.FC<FlagImageProps> = ({
  countryCode,
  flagEmoji,
  size = 'w40',
  width = 20,
  height = 15,
  className = '',
  alt = 'Flag'
}) => {
  let src: string | null = null;
  let displayEmoji = flagEmoji;

  if (countryCode) {
    src = getFlagImageUrl(countryCode, size);
    displayEmoji = countryCodeToEmoji(countryCode);
  } else if (flagEmoji) {
    // Check if flagEmoji is a country code (2 letters)
    if (flagEmoji.length === 2 && /^[A-Z]{2}$/i.test(flagEmoji)) {
      src = getFlagImageUrl(flagEmoji.toUpperCase(), size);
      displayEmoji = countryCodeToEmoji(flagEmoji.toUpperCase());
    } else {
      // Try to convert flag emoji to country code
      const countryCodeFromEmoji = emojiToCountryCode(flagEmoji);
      if (countryCodeFromEmoji) {
        src = getFlagImageUrl(countryCodeFromEmoji, size);
        displayEmoji = flagEmoji; // Keep original emoji for display
      }
    }
  }



  if (!src) {
    // Fallback to showing the original emoji if conversion failed
    return React.createElement('span', { className }, flagEmoji || '🏳️');
  }

  return React.createElement('img', {
    src,
    alt,
    width,
    height,
    className: `inline-block ${className}`,
    style: { width: `${width}px`, height: `${height}px` },
    onError: (e: any) => {
      console.error('Flag image failed to load:', src);
      // Fallback to showing the original emoji
      const parent = e.target.parentNode;
      if (parent) {
        parent.innerHTML = displayEmoji || '🏳️';
      }
    }
  });
}

// Helper to convert country code to flag emoji
export function countryCodeToEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split('')
      .map(char => 0x1F1E6 + char.charCodeAt(0) - 65)
  );
}
