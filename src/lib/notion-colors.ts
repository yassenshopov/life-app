/**
 * Maps Notion color names to Tailwind CSS classes
 * Uses the shared color mapping utility for consistency
 */
import { getNotionOptionColor } from './notion-color-mapping';

/**
 * Gets the color class for a multi-select option
 * @deprecated Use getNotionOptionColor from './notion-color-mapping' instead
 */
export function getMultiSelectColorClass(option: { name: string; color?: string } | string): string {
  return getNotionOptionColor(option, 'outline');
}

/**
 * Gets the color class for a select option
 * @deprecated Use getNotionOptionColor from './notion-color-mapping' instead
 */
export function getSelectColorClass(option: { name: string; color: string }): string {
  return getNotionOptionColor(option, 'outline');
}

/**
 * Gets the color class for a status option
 * @deprecated Use getNotionOptionColor from './notion-color-mapping' instead
 */
export function getStatusColorClass(option: { name: string; color: string }): string {
  return getNotionOptionColor(option, 'outline');
}

/**
 * Maps Notion color names to our CSS classes
 * @deprecated Use getNotionBadgeColor from './notion-color-mapping' instead
 */
export function getNotionColorClass(color: string): string {
  return getNotionOptionColor({ name: '', color: color as any }, 'outline');
}
