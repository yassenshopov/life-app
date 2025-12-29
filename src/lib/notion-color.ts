// Shared utility for extracting dominant color from Notion page icons

// Extract dominant color from image
export function getDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    // Check if it's a Supabase Storage URL - always use crossOrigin for those
    const isSupabaseStorage = imageUrl.includes('supabase.co/storage') || imageUrl.includes('supabase.com/storage');
    
    const img = new Image();
    // Always set crossOrigin for Supabase Storage (it supports CORS)
    // For other URLs, try with crossOrigin first
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('Could not get canvas context for color extraction');
          resolve('#8b5cf6');
          return;
        }
        
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0, count = 0;
        const step = Math.max(1, Math.floor(data.length / 4 / 200));
        
        for (let i = 0; i < data.length; i += step * 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        
        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          // Darken the color a bit for better contrast
          r = Math.max(0, Math.floor(r * 0.7));
          g = Math.max(0, Math.floor(g * 0.7));
          b = Math.max(0, Math.floor(b * 0.7));
          
          const toHex = (n: number) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          };
          const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          console.log('Successfully extracted color:', hexColor, 'from:', imageUrl);
          resolve(hexColor);
        } else {
          console.warn('No pixels sampled for color extraction');
          resolve('#8b5cf6');
        }
      } catch (error: any) {
        console.error('Error extracting color from canvas:', error, 'URL:', imageUrl);
        resolve('#8b5cf6');
      }
    };
    
    img.onerror = (error) => {
      console.error('Error loading image for color extraction:', imageUrl, error);
      resolve('#8b5cf6');
    };
    
    setTimeout(() => {
      if (!img.complete) {
        console.warn('Image load timeout for color extraction:', imageUrl);
        resolve('#8b5cf6');
      }
    }, 5000);
    
    img.src = imageUrl;
  });
}

// Helper to get icon URL from Notion icon object
export function getIconUrl(icon: any): string | null {
  if (!icon) return null;
  
  // Handle JSONB stored icon (might be a string that needs parsing)
  if (typeof icon === 'string') {
    try {
      icon = JSON.parse(icon);
    } catch (e) {
      return null;
    }
  }
  
  // Handle emoji icons (no URL available)
  if (icon.type === 'emoji') {
    return null;
  }
  
  if (icon.type === 'external' && icon.external?.url) {
    return icon.external.url;
  }
  if (icon.type === 'file' && icon.file?.url) {
    return icon.file.url;
  }
  return null;
}

