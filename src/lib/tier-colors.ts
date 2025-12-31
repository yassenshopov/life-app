/**
 * Maps Notion color names to Tailwind CSS classes for tier badges
 * Uses the shared color mapping utility for consistency
 */
import { getNotionBadgeColor, getNotionBgColor, type NotionColor } from './notion-color-mapping';

export function getTierColorClass(tierOption: { name: string; color?: string } | null | undefined): string {
  if (!tierOption) {
    return getNotionBadgeColor('default', 'badge');
  }

  return getNotionBadgeColor(tierOption.color || 'default', 'badge');
}

/**
 * Gets the color class for a tier array (supports both old string[] format and new object format)
 * Also handles single object {name, color} format and stringified JSON
 */
export function getTierColor(tier: string[] | Array<{ name: string; color?: string }> | { name: string; color?: string } | string | null | undefined): string {
  if (!tier) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }

  // Handle string (could be stringified JSON)
  if (typeof tier === 'string') {
    // Try to parse as JSON if it looks like JSON
    if (tier.startsWith('{') || tier.startsWith('[')) {
      try {
        const parsed = JSON.parse(tier);
        return getTierColor(parsed); // Recursively handle parsed value
      } catch {
        // If parsing fails, treat as plain string and use fallback logic
        if (tier.includes('Me')) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        if (tier.includes('CR')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (tier.includes('F')) return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      }
    }
    // Plain string - use fallback logic
    if (tier.includes('Me')) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    if (tier.includes('CR')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (tier.includes('F')) return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }

  // Handle single object (not an array)
  if (typeof tier === 'object' && !Array.isArray(tier) && tier !== null && 'name' in tier) {
    return getTierColorClass(tier);
  }

  // Handle array
  if (Array.isArray(tier)) {
    if (tier.length === 0) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }

    const firstTier = tier[0];
    
    // Handle old format (string[])
    if (typeof firstTier === 'string') {
      // Fallback to old logic for backward compatibility
      const tierStr = firstTier;
      if (tierStr.includes('Me')) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      if (tierStr.includes('CR')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      if (tierStr.includes('F')) return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }

    // Handle new format (object with name and color)
    return getTierColorClass(firstTier);
  }

  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
}

/**
 * Gets the tier name from either format
 * Handles: string[], Array<{name, color}>, single object {name, color}, stringified JSON, or null
 * Always returns a string - never returns an object
 */
export function getTierName(tier: any): string {
  if (!tier) return '';
  
  // Handle string (could be stringified JSON or a plain string)
  if (typeof tier === 'string') {
    // Try to parse as JSON if it looks like JSON
    if ((tier.startsWith('{') || tier.startsWith('[')) && tier.trim().length > 1) {
      try {
        const parsed = JSON.parse(tier);
        return getTierName(parsed); // Recursively handle parsed value
      } catch {
        // If parsing fails, treat as plain string
        return tier;
      }
    }
    return tier;
  }
  
  // Handle single object (not an array)
  if (typeof tier === 'object' && !Array.isArray(tier) && tier !== null) {
    // Check if it has a 'name' property
    if ('name' in tier && typeof tier.name === 'string') {
      return tier.name;
    }
    // If it's an object without 'name', try to stringify it (shouldn't happen, but defensive)
    if (Object.keys(tier).length === 0) {
      return '';
    }
    // Last resort: return empty string for unexpected object structure
    return '';
  }
  
  // Handle array
  if (Array.isArray(tier)) {
    if (tier.length === 0) return '';
    const firstTier = tier[0];
    if (typeof firstTier === 'string') {
      return firstTier;
    }
    if (typeof firstTier === 'object' && firstTier !== null && 'name' in firstTier) {
      const name = firstTier.name;
      // Ensure we return a string, not an object
      return typeof name === 'string' ? name : String(name || '');
    }
    // If firstTier is an object but doesn't have 'name', return empty string
    return '';
  }
  
  // Fallback: convert to string if it's something unexpected
  try {
    return String(tier);
  } catch {
    return '';
  }
}

/**
 * Gets border color classes for a tier (for card borders, etc.)
 * Returns border color classes based on the tier's color
 */
export function getTierBorderColor(tier: string[] | Array<{ name: string; color?: string }> | { name: string; color?: string } | string | null | undefined): string {
  if (!tier) {
    return 'border-l-gray-400 dark:border-l-gray-600';
  }

  // Extract color name from tier
  let colorName: NotionColor = 'default';

  // Handle string (could be stringified JSON)
  if (typeof tier === 'string') {
    // Try to parse as JSON if it looks like JSON
    if (tier.startsWith('{') || tier.startsWith('[')) {
      try {
        const parsed = JSON.parse(tier);
        return getTierBorderColor(parsed); // Recursively handle parsed value
      } catch {
        // Fallback logic for plain strings
        if (tier.includes('Me')) colorName = 'gray';
        else if (tier.includes('CR')) colorName = 'green';
        else if (tier.includes('F')) colorName = 'pink';
        else if (tier.includes('MU')) colorName = 'purple';
        else if (tier.includes('SA')) colorName = 'orange';
        else colorName = 'blue';
      }
    } else {
      // Plain string - use fallback logic
      if (tier.includes('Me')) colorName = 'gray';
      else if (tier.includes('CR')) colorName = 'green';
      else if (tier.includes('F')) colorName = 'pink';
      else if (tier.includes('MU')) colorName = 'purple';
      else if (tier.includes('SA')) colorName = 'orange';
      else colorName = 'blue';
    }
  }
  // Handle single object (not an array)
  else if (typeof tier === 'object' && !Array.isArray(tier) && tier !== null && 'name' in tier) {
    colorName = (tier.color || 'default') as NotionColor;
  }
  // Handle array
  else if (Array.isArray(tier)) {
    if (tier.length === 0) {
      return 'border-l-gray-400 dark:border-l-gray-600';
    }
    const firstTier = tier[0];
    
    // Handle old format (string[])
    if (typeof firstTier === 'string') {
      if (firstTier.includes('Me')) colorName = 'gray';
      else if (firstTier.includes('CR')) colorName = 'green';
      else if (firstTier.includes('F')) colorName = 'pink';
      else if (firstTier.includes('MU')) colorName = 'purple';
      else if (firstTier.includes('SA')) colorName = 'orange';
      else colorName = 'blue';
    }
    // Handle new format (object with name and color)
    else if (typeof firstTier === 'object' && firstTier !== null && 'color' in firstTier) {
      colorName = (firstTier.color || 'default') as NotionColor;
    }
  }

  // Map color names to border colors
  const borderColorMap: Record<NotionColor, string> = {
    default: 'border-l-gray-400 dark:border-l-gray-600',
    gray: 'border-l-gray-400 dark:border-l-gray-600',
    brown: 'border-l-amber-400 dark:border-l-amber-600',
    orange: 'border-l-orange-400 dark:border-l-orange-600',
    yellow: 'border-l-yellow-400 dark:border-l-yellow-600',
    green: 'border-l-green-400 dark:border-l-green-600',
    blue: 'border-l-blue-400 dark:border-l-blue-600',
    purple: 'border-l-purple-400 dark:border-l-purple-600',
    pink: 'border-l-pink-400 dark:border-l-pink-600',
    red: 'border-l-red-400 dark:border-l-red-600',
  };

  return borderColorMap[colorName] || borderColorMap.default;
}

/**
 * Gets background color classes for a tier (for card backgrounds, etc.)
 * Returns background color classes based on the tier's color
 */
export function getTierBgColor(tier: string[] | Array<{ name: string; color?: string }> | { name: string; color?: string } | string | null | undefined): string {
  if (!tier) {
    return 'bg-gray-50 dark:bg-gray-900/30';
  }

  // Extract color name from tier
  let colorName: NotionColor = 'default';

  // Handle string (could be stringified JSON)
  if (typeof tier === 'string') {
    // Try to parse as JSON if it looks like JSON
    if (tier.startsWith('{') || tier.startsWith('[')) {
      try {
        const parsed = JSON.parse(tier);
        return getTierBgColor(parsed); // Recursively handle parsed value
      } catch {
        // Fallback logic for plain strings
        if (tier.includes('Me')) colorName = 'gray';
        else if (tier.includes('CR')) colorName = 'green';
        else if (tier.includes('F')) colorName = 'pink';
        else if (tier.includes('MU')) colorName = 'purple';
        else if (tier.includes('SA')) colorName = 'orange';
        else colorName = 'blue';
      }
    } else {
      // Plain string - use fallback logic
      if (tier.includes('Me')) colorName = 'gray';
      else if (tier.includes('CR')) colorName = 'green';
      else if (tier.includes('F')) colorName = 'pink';
      else if (tier.includes('MU')) colorName = 'purple';
      else if (tier.includes('SA')) colorName = 'orange';
      else colorName = 'blue';
    }
  }
  // Handle single object (not an array)
  else if (typeof tier === 'object' && !Array.isArray(tier) && tier !== null && 'name' in tier) {
    colorName = (tier.color || 'default') as NotionColor;
  }
  // Handle array
  else if (Array.isArray(tier)) {
    if (tier.length === 0) {
      return 'bg-gray-50 dark:bg-gray-900/30';
    }
    const firstTier = tier[0];
    
    // Handle old format (string[])
    if (typeof firstTier === 'string') {
      if (firstTier.includes('Me')) colorName = 'gray';
      else if (firstTier.includes('CR')) colorName = 'green';
      else if (firstTier.includes('F')) colorName = 'pink';
      else if (firstTier.includes('MU')) colorName = 'purple';
      else if (firstTier.includes('SA')) colorName = 'orange';
      else colorName = 'blue';
    }
    // Handle new format (object with name and color)
    else if (typeof firstTier === 'object' && firstTier !== null && 'color' in firstTier) {
      colorName = (firstTier.color || 'default') as NotionColor;
    }
  }

  // Use the shared background color utility
  return getNotionBgColor(colorName);
}

