/**
 * Map Google Calendar colorId to hex color.
 * Google Calendar uses predefined color IDs (1-11) that map to specific colors.
 */
export function getColorFromColorId(
  colorId: string | undefined | null,
  defaultColor: string = '#4285f4'
): string {
  if (!colorId) {
    return defaultColor;
  }

  const colorMap: Record<string, string> = {
    '1': '#a4bdfc', // Lavender
    '2': '#7ae7bf', // Sage
    '3': '#dbadff', // Grape
    '4': '#ff887c', // Flamingo
    '5': '#fbd75b', // Banana
    '6': '#ffb878', // Tangerine
    '7': '#46d6db', // Peacock
    '8': '#e1e1e1', // Graphite
    '9': '#5484ed', // Blueberry
    '10': '#51b749', // Basil
    '11': '#dc2127', // Tomato
  };

  return colorMap[colorId] || defaultColor;
}
