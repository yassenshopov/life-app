import React from 'react';
import { FileText } from 'lucide-react';

interface PageIconProps {
  icon?: any;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export function PageIcon({ icon, className = 'w-4 h-4', fallbackIcon }: PageIconProps) {
  // Use Notion icon if available
  if (icon) {
    if (icon.type === 'emoji') {
      return <span className={`text-sm ${className}`}>{icon.emoji}</span>;
    } else if (icon.type === 'external') {
      return <img src={icon.external.url} alt="Page icon" className={`rounded ${className}`} />;
    } else if (icon.type === 'file') {
      return <img src={icon.file.url} alt="Page icon" className={`rounded ${className}`} />;
    }
  }

  // Fallback to provided icon or default
  return fallbackIcon || <FileText className={className} />;
}
