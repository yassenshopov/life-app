import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getMultiSelectColorClass, getSelectColorClass } from '@/lib/notion-colors';

interface NotionBadgeProps {
  option:
    | {
        name: string;
        color?: string;
      }
    | string;
  variant?: 'outline' | 'secondary' | 'default';
  className?: string;
  maxWidth?: string;
}

export function NotionBadge({
  option,
  variant = 'outline',
  className = '',
  maxWidth = '100px',
}: NotionBadgeProps) {
  // Handle both string and object formats
  const name = typeof option === 'string' ? option : option.name;
  const color = typeof option === 'string' ? 'default' : option.color || 'default';

  // Get the appropriate color class
  const colorClass =
    typeof option === 'string'
      ? getMultiSelectColorClass({ name, color })
      : getMultiSelectColorClass(option);

  return (
    <Badge
      variant={variant}
      className={`text-xs hover:bg-transparent hover:text-current ${colorClass} ${className}`}
    >
      <span className="truncate block" style={{ maxWidth }}>
        {name}
      </span>
    </Badge>
  );
}

interface NotionBadgeListProps {
  options: (string | { name: string; color?: string })[];
  variant?: 'outline' | 'secondary' | 'default';
  className?: string;
  maxWidth?: string;
  containerMaxWidth?: string;
  limit?: number;
}

export function NotionBadgeList({
  options,
  variant = 'outline',
  className = '',
  maxWidth = '100px',
  containerMaxWidth = '200px',
  limit,
}: NotionBadgeListProps) {
  const displayOptions = limit ? options.slice(0, limit) : options;
  const hasMore = limit && options.length > limit;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`} style={{ maxWidth: containerMaxWidth }}>
      {displayOptions.map((option, index) => (
        <NotionBadge key={index} option={option} variant={variant} maxWidth={maxWidth} />
      ))}
      {hasMore && (
        <span className="text-xs text-muted-foreground">+{options.length - limit} more</span>
      )}
    </div>
  );
}
