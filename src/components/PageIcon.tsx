import React, { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';

interface PageIconProps {
  icon?: any;
  iconUrl?: string | null; // Supabase Storage URL or Notion CDN URL
  className?: string;
  fallbackIcon?: React.ReactNode;
  assetId?: string; // Optional: asset ID for API endpoint
  placeId?: string; // Optional: place ID for API endpoint
}

// Helper to convert Supabase Storage URL to API endpoint URL
function convertToApiUrl(iconUrl: string, assetId?: string, placeId?: string): string {
  try {
    const url = new URL(iconUrl);
    
    // Check if it's a Supabase Storage URL for finances-icons
    const financesIconsMatch = url.pathname.match(/\/storage\/v1\/object\/public\/finances-icons\/[^/]+\/([^/]+)\./);
    if (financesIconsMatch) {
      const extractedAssetId = financesIconsMatch[1];
      return `/api/finances/icons/${extractedAssetId}`;
    }
    
    // Check if it's a Supabase Storage URL for finances-place-icons
    const placeIconsMatch = url.pathname.match(/\/storage\/v1\/object\/public\/finances-place-icons\/[^/]+\/([^/]+)\./);
    if (placeIconsMatch) {
      const extractedPlaceId = placeIconsMatch[1];
      return `/api/finances/place-icons/${extractedPlaceId}`;
    }
    
    // If we have explicit IDs, use them
    if (assetId) {
      return `/api/finances/icons/${assetId}`;
    }
    if (placeId) {
      return `/api/finances/place-icons/${placeId}`;
    }
    
    // Not a Supabase Storage URL, return as-is
    return iconUrl;
  } catch {
    // Invalid URL, return as-is
    return iconUrl;
  }
}

export function PageIcon({ icon, iconUrl, className = 'w-4 h-4', fallbackIcon, assetId, placeId }: PageIconProps) {
  const [iconUrlFailed, setIconUrlFailed] = useState(false);
  const [notionIconFailed, setNotionIconFailed] = useState(false);

  // Convert Supabase Storage URL to API endpoint URL if applicable
  const apiIconUrl = useMemo(() => {
    if (!iconUrl) return null;
    return convertToApiUrl(iconUrl, assetId, placeId);
  }, [iconUrl, assetId, placeId]);

  // Determine which icon source to use based on availability and failure state
  const shouldUseIconUrl = apiIconUrl && !iconUrlFailed;
  const shouldUseNotionIcon = icon && !shouldUseIconUrl && !notionIconFailed;

  // Prefer iconUrl (Supabase Storage via API) if available and hasn't failed
  if (shouldUseIconUrl) {
    return (
      <img 
        src={apiIconUrl} 
        alt="Page icon" 
        className={`rounded ${className}`}
        onError={() => {
          console.warn('Failed to load iconUrl:', apiIconUrl);
          setIconUrlFailed(true);
        }}
      />
    );
  }

  // Use Notion icon if available and iconUrl failed or wasn't provided
  if (shouldUseNotionIcon) {
    if (icon.type === 'emoji') {
      return <span className={`text-sm ${className}`}>{icon.emoji}</span>;
    } else if (icon.type === 'external') {
      return (
        <img 
          src={icon.external.url} 
          alt="Page icon" 
          className={`rounded ${className}`}
          onError={() => {
            console.warn('Failed to load Notion external icon:', icon.external.url);
            setNotionIconFailed(true);
          }}
        />
      );
    } else if (icon.type === 'file') {
      return (
        <img 
          src={icon.file.url} 
          alt="Page icon" 
          className={`rounded ${className}`}
          onError={() => {
            console.warn('Failed to load Notion file icon:', icon.file.url);
            setNotionIconFailed(true);
          }}
        />
      );
    }
  }

  // Fallback to provided icon or default
  return fallbackIcon || <FileText className={className} />;
}
