/**
 * Shared utility for mapping Notion color names to Tailwind CSS classes
 *
 * Notion supports these colors: default, gray, brown, orange, yellow, green, blue, purple, pink, red
 * This utility provides consistent color mapping across the application
 *
 * All color mappings include dark mode variants using Tailwind's `dark:` prefix
 * Dark mode is automatically handled by Tailwind's class-based dark mode system
 */

export type NotionColor =
  | 'default'
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red';

/**
 * Color mapping for badge-style components (with background and text colors)
 * Includes dark mode variants for proper contrast in dark theme
 * Format: bg-{color}-100 text-{color}-800 dark:bg-{color}-900 dark:text-{color}-200
 */
export const NOTION_BADGE_COLORS: Record<NotionColor, string> = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  brown: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * Color mapping for outline-style badges (lighter backgrounds)
 * Includes dark mode variants with darker backgrounds and lighter text for better contrast
 * Format: bg-{color}-100 text-{color}-700 dark:bg-{color}-900 dark:text-{color}-300
 */
export const NOTION_OUTLINE_BADGE_COLORS: Record<NotionColor, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  brown: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

/**
 * Color mapping for text-only elements
 * Includes dark mode variants with lighter shades for better readability
 * Format: text-{color}-600 dark:text-{color}-400
 */
export const NOTION_TEXT_COLORS: Record<NotionColor, string> = {
  default: 'text-gray-600 dark:text-gray-400',
  gray: 'text-gray-600 dark:text-gray-400',
  brown: 'text-amber-600 dark:text-amber-400',
  orange: 'text-orange-600 dark:text-orange-300',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  green: 'text-green-600 dark:text-green-400',
  blue: 'text-blue-600 dark:text-blue-400',
  purple: 'text-purple-600 dark:text-purple-300',
  pink: 'text-pink-600 dark:text-pink-400',
  red: 'text-red-600 dark:text-red-400',
};

/**
 * Color mapping for background-only elements
 * Includes dark mode variants with semi-transparent backgrounds for subtle effects
 * Format: bg-{color}-100 dark:bg-{color}-900/40
 */
export const NOTION_BG_COLORS: Record<NotionColor, string> = {
  default: 'bg-gray-100 dark:bg-gray-900/40',
  gray: 'bg-gray-100 dark:bg-gray-900/40',
  brown: 'bg-amber-100 dark:bg-amber-900/40',
  orange: 'bg-orange-100 dark:bg-orange-900/40',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/40',
  green: 'bg-green-100 dark:bg-green-900/40',
  blue: 'bg-blue-100 dark:bg-blue-900/40',
  purple: 'bg-purple-100 dark:bg-purple-900/40',
  pink: 'bg-pink-100 dark:bg-pink-900/40',
  red: 'bg-red-100 dark:bg-red-900/40',
};

/**
 * Gets the badge color classes for a Notion color
 * @param color - Notion color name
 * @param variant - Badge variant style ('badge' | 'outline')
 * @returns Tailwind CSS classes for the color
 */
export function getNotionBadgeColor(
  color: NotionColor | string | undefined | null,
  variant: 'badge' | 'outline' = 'badge'
): string {
  const normalizedColor = (color || 'default') as NotionColor;
  const colorMap = variant === 'outline' ? NOTION_OUTLINE_BADGE_COLORS : NOTION_BADGE_COLORS;
  return colorMap[normalizedColor] || colorMap.default;
}

/**
 * Gets the text color classes for a Notion color
 * @param color - Notion color name
 * @returns Tailwind CSS classes for text color
 */
export function getNotionTextColor(color: NotionColor | string | undefined | null): string {
  const normalizedColor = (color || 'default') as NotionColor;
  return NOTION_TEXT_COLORS[normalizedColor] || NOTION_TEXT_COLORS.default;
}

/**
 * Gets the background color classes for a Notion color
 * @param color - Notion color name
 * @returns Tailwind CSS classes for background color
 */
export function getNotionBgColor(color: NotionColor | string | undefined | null): string {
  const normalizedColor = (color || 'default') as NotionColor;
  return NOTION_BG_COLORS[normalizedColor] || NOTION_BG_COLORS.default;
}

/**
 * Gets color classes for a Notion option (select, multi-select, status)
 * @param option - Option with name and optional color
 * @param variant - Badge variant style ('badge' | 'outline')
 * @returns Tailwind CSS classes for the color
 */
export function getNotionOptionColor(
  option: { name: string; color?: string } | string,
  variant: 'badge' | 'outline' = 'badge'
): string {
  const color = typeof option === 'string' ? 'default' : option.color || 'default';
  return getNotionBadgeColor(color, variant);
}
