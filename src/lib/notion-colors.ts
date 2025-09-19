/**
 * Maps Notion color names to our CSS classes
 */
export function getNotionColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    default: 'notion-color-default',
    gray: 'notion-color-gray',
    brown: 'notion-color-brown',
    orange: 'notion-color-orange',
    yellow: 'notion-color-yellow',
    green: 'notion-color-green',
    blue: 'notion-color-blue',
    purple: 'notion-color-purple',
    pink: 'notion-color-pink',
    red: 'notion-color-red',
  };

  return colorMap[color] || 'notion-color-default';
}

/**
 * Gets the color class for a multi-select option
 */
export function getMultiSelectColorClass(option: { name: string; color: string }): string {
  return getNotionColorClass(option.color);
}

/**
 * Gets the color class for a select option
 */
export function getSelectColorClass(option: { name: string; color: string }): string {
  return getNotionColorClass(option.color);
}

/**
 * Gets the color class for a status option
 */
export function getStatusColorClass(option: { name: string; color: string }): string {
  return getNotionColorClass(option.color);
}
