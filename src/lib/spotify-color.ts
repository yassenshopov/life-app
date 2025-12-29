// Shared utility for extracting dominant color from Spotify album art

// Get default background color from CSS variables (returns RGB for consistency)
export function getDefaultBgColor(): string {
  if (typeof window === 'undefined') {
    return 'rgb(241, 245, 249)'; // slate-100 default
  }
  const root = document.documentElement;
  const isDark = getComputedStyle(root).getPropertyValue('color-scheme').includes('dark') ||
    root.classList.contains('dark');
  
  // Return RGB defaults based on theme
  return isDark ? 'rgb(0, 0, 0)' : 'rgb(241, 245, 249)';
}

// Extract multiple colors from image for richer color scheme
export function getColorPalette(imageUrl: string): Promise<{ primary: string; secondary: string; accent: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const defaultColor = getDefaultBgColor();
    const defaultPalette = {
      primary: defaultColor,
      secondary: defaultColor,
      accent: defaultColor,
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(defaultPalette);
          return;
        }

        // Use larger canvas for better color extraction
        const maxSize = 150;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Collect color samples from different regions
        const colors: Array<{ r: number; g: number; b: number; weight: number }> = [];
        const step = Math.max(1, Math.floor(data.length / 4 / 500)); // Sample more pixels

        for (let i = 0; i < data.length; i += step * 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Calculate position in image for regional weighting
          const pixelIndex = i / 4;
          const x = pixelIndex % canvas.width;
          const y = Math.floor(pixelIndex / canvas.width);
          
          // Weight center more, edges less
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const distFromCenter = Math.sqrt(
            Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
          );
          const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
          const weight = 1 - (distFromCenter / maxDist) * 0.5; // Center weighted

          colors.push({ r, g, b, weight });
        }

        if (colors.length === 0) {
          resolve(defaultPalette);
          return;
        }

        // Calculate weighted average for primary color
        let totalWeight = 0;
        let rSum = 0, gSum = 0, bSum = 0;
        colors.forEach((c) => {
          rSum += c.r * c.weight;
          gSum += c.g * c.weight;
          bSum += c.b * c.weight;
          totalWeight += c.weight;
        });

        const primaryR = Math.floor(rSum / totalWeight);
        const primaryG = Math.floor(gSum / totalWeight);
        const primaryB = Math.floor(bSum / totalWeight);

        // Create secondary (lighter) and accent (darker) variants
        const secondaryR = Math.min(255, Math.floor(primaryR * 1.3));
        const secondaryG = Math.min(255, Math.floor(primaryG * 1.3));
        const secondaryB = Math.min(255, Math.floor(primaryB * 1.3));

        const accentR = Math.max(0, Math.floor(primaryR * 0.6));
        const accentG = Math.max(0, Math.floor(primaryG * 0.6));
        const accentB = Math.max(0, Math.floor(primaryB * 0.6));

        resolve({
          primary: `rgb(${primaryR}, ${primaryG}, ${primaryB})`,
          secondary: `rgb(${secondaryR}, ${secondaryG}, ${secondaryB})`,
          accent: `rgb(${accentR}, ${accentG}, ${accentB})`,
        });
      } catch {
        resolve(defaultPalette);
      }
    };

    img.onerror = () => {
      resolve(defaultPalette);
    };

    setTimeout(() => {
      if (!img.complete) {
        resolve(defaultPalette);
      }
    }, 3000);

    img.src = imageUrl;
  });
}

// Extract dominant color from image (backward compatibility)
export function getDominantColor(imageUrl: string): Promise<string> {
  return getColorPalette(imageUrl).then((palette) => palette.primary);
}

