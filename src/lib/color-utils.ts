/**
 * Color utility functions for calendar events
 */

/**
 * Normalize and validate hex color
 */
function normalizeHexColor(color: string | undefined | null): string {
  if (!color) return '#4285f4'; // Default blue
  
  // Remove whitespace
  let normalized = color.trim();
  
  // Remove # if present
  if (normalized.startsWith('#')) {
    normalized = normalized.substring(1);
  }
  
  // Handle 3-character hex (e.g., 'fff' -> 'ffffff')
  if (normalized.length === 3) {
    normalized = normalized.split('').map(c => c + c).join('');
  }
  
  // Validate it's a valid hex color (6 characters, hex digits only)
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return '#4285f4'; // Default to blue if invalid
  }
  
  return `#${normalized}`;
}

/**
 * Calculate the relative luminance of a color
 * Based on WCAG 2.0 guidelines
 */
function getLuminance(hex: string): number {
  try {
    // Normalize color first
    const bgColor = normalizeHexColor(hex);
    const color = bgColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substring(0, 2), 16) / 255;
    const g = parseInt(color.substring(2, 4), 16) / 255;
    const b = parseInt(color.substring(4, 6), 16) / 255;

    // Apply gamma correction
    const [rLinear, gLinear, bLinear] = [r, g, b].map((val) => {
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    // Calculate relative luminance
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  } catch (error) {
    // Fallback: assume medium brightness
    return 0.5;
  }
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
function getContrastRatio(color1: string, color2: string): number {
  try {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  } catch (error) {
    return 1; // Minimum contrast if calculation fails
  }
}

/**
 * Determine if text should be dark or light based on background color
 * Returns 'dark' for dark text on light background, 'light' for light text on dark background
 * 
 * @param backgroundColor - Hex color string (e.g., '#4285f4' or '4285f4')
 * @returns 'dark' | 'light'
 */
export function getContrastTextColor(backgroundColor: string | undefined | null): 'dark' | 'light' {
  // Normalize and validate color
  const bgColor = normalizeHexColor(backgroundColor);
  
  // Calculate luminance
  const luminance = getLuminance(bgColor);
  
  // Use a threshold of 0.5 for luminance
  // Colors with luminance > 0.5 are light (use dark text)
  // Colors with luminance <= 0.5 are dark (use light text)
  // This is simpler and more reliable than contrast ratio for this use case
  if (luminance > 0.5) {
    return 'dark';
  } else {
    return 'light';
  }
}

/**
 * Get text color class for Tailwind based on background color
 * @param backgroundColor - Hex color string (can be undefined/null)
 * @returns Tailwind text color class
 */
export function getTextColorClass(backgroundColor: string | undefined | null): string {
  const textColor = getContrastTextColor(backgroundColor);
  
  // Return appropriate Tailwind classes
  if (textColor === 'dark') {
    return 'text-gray-900 dark:text-gray-100';
  } else {
    return 'text-white';
  }
}

/**
 * Get a high-contrast text color (hex value) for a given background color
 * Ensures WCAG AA compliance (4.5:1 contrast ratio) by computing actual contrast ratios
 * @param backgroundColor - Hex color string (can be undefined/null)
 * @returns Hex color string for text ('#000000' for dark text, '#ffffff' for light text)
 */
export function getContrastTextColorHex(backgroundColor: string | undefined | null): string {
  const bgColor = normalizeHexColor(backgroundColor);
  
  // Compute actual contrast ratios for both black and white
  const blackContrast = getContrastRatio('#000000', bgColor);
  const whiteContrast = getContrastRatio('#ffffff', bgColor);
  
  // Return whichever has the higher contrast
  const bestContrast = blackContrast > whiteContrast ? '#000000' : '#ffffff';
  const bestRatio = Math.max(blackContrast, whiteContrast);
  
  // Log a warning if both are below WCAG AA minimum (4.5:1)
  if (bestRatio < 4.5) {
    console.warn(
      `Contrast ratio ${bestRatio.toFixed(2)}:1 is below WCAG AA minimum (4.5:1) for background ${bgColor}. ` +
      `Using ${bestContrast} text (black: ${blackContrast.toFixed(2)}:1, white: ${whiteContrast.toFixed(2)}:1)`
    );
  }
  
  return bestContrast;
}

