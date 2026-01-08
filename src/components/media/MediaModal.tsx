'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, BookOpen, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

// Extract dominant color from image
function getDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
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
          r = Math.max(0, Math.floor((r / count) * 0.7));
          g = Math.max(0, Math.floor((g / count) * 0.7));
          b = Math.max(0, Math.floor((b / count) * 0.7));
          
          const toHex = (n: number) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          };
          resolve(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        } else {
          resolve('#8b5cf6');
        }
      } catch (error) {
        resolve('#8b5cf6');
      }
    };
    
    img.onerror = () => resolve('#8b5cf6');
    setTimeout(() => {
      if (!img.complete) resolve('#8b5cf6');
    }, 3000);
    
    img.src = imageUrl;
  });
}

// Typed text animation component
function TypedText({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) {
  const [displayedText, setDisplayedText] = React.useState('');
  const [isComplete, setIsComplete] = React.useState(false);

  React.useEffect(() => {
    if (!text) return;
    
    setDisplayedText('');
    setIsComplete(false);
    
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(typingInterval);
        }
      }, 30); // Typing speed

      return () => clearInterval(typingInterval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
}

export interface MediaModalProps {
  item: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedItem: any) => void;
  colorPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
}

export function MediaModal({ item, isOpen, onClose, onUpdate, colorPalette }: MediaModalProps) {
  const [bgColor, setBgColor] = React.useState('#8b5cf6');
  const [isFillingDescription, setIsFillingDescription] = React.useState(false);
  const [shouldAnimateDescription, setShouldAnimateDescription] = React.useState(false);
  const [localItem, setLocalItem] = React.useState(item);
  const { toast } = useToast();
  
  // Update local item when prop changes
  React.useEffect(() => {
    setLocalItem(item);
  }, [item]);
  
  const thumbnailUrl = localItem?.thumbnail_url || (() => {
    if (!localItem?.thumbnail || !Array.isArray(localItem.thumbnail) || localItem.thumbnail.length === 0) {
      return null;
    }
    const firstFile = localItem.thumbnail[0];
    if (firstFile.type === 'external' && firstFile.external?.url) {
      return firstFile.external.url;
    }
    if (firstFile.type === 'file' && firstFile.file?.url) {
      return firstFile.file.url;
    }
    return null;
  })();

  React.useEffect(() => {
    // Prioritize Spotify color palette if available
    if (colorPalette?.primary) {
      // Convert RGB to hex for consistency
      const rgbMatch = colorPalette.primary.match(/\d+/g);
      if (rgbMatch && rgbMatch.length >= 3) {
        const r = parseInt(rgbMatch[0]);
        const g = parseInt(rgbMatch[1]);
        const b = parseInt(rgbMatch[2]);
        const toHex = (n: number) => {
          const hex = n.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        setBgColor(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
        return;
      }
    }
    
    // Fallback to thumbnail color extraction
    if (thumbnailUrl && localItem) {
      setBgColor('#8b5cf6');
      getDominantColor(thumbnailUrl)
        .then((color) => setBgColor(color))
        .catch(() => setBgColor('#8b5cf6'));
    } else {
      setBgColor('#8b5cf6');
    }
  }, [thumbnailUrl, localItem, colorPalette]);

  React.useEffect(() => {
    setShouldAnimateDescription(false);
  }, [localItem?.id]);

  const handleFillDescription = async () => {
    if (!localItem || !localItem.id) return;
    
    setIsFillingDescription(true);
    try {
      const response = await fetch(`/api/media/${localItem.id}/fill-description`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fill description');
      }

      setLocalItem(data.media);
      setShouldAnimateDescription(true);
      
      // Call onUpdate if provided
      if (onUpdate) {
        onUpdate(data.media);
      }
      
      toast({
        title: 'Description filled',
        description: 'The description has been fetched and updated successfully.',
      });
    } catch (error: any) {
      console.error('Error filling description:', error);
      toast({
        title: 'Failed to fill description',
        description: error.message || 'Failed to fetch description. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsFillingDescription(false);
    }
  };

  if (!localItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AnimatePresence mode="wait">
        {isOpen && localItem && (
          <DialogContent 
            className="sm:max-w-[900px] h-[650px] p-0 border-white/10 overflow-hidden"
            key={localItem.id}
          >
            <motion.div
              key={localItem.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex h-full w-full transition-all duration-500"
              style={{
                backgroundColor: bgColor,
                backgroundImage: `linear-gradient(135deg, ${bgColor}ee, ${bgColor}cc)`,
              } as React.CSSProperties}
            >
              <DialogTitle className="sr-only">{localItem.name}</DialogTitle>
              
              <div className="flex h-full w-full">
                {/* Left: Thumbnail */}
                <motion.div
                  key={`thumbnail-${localItem.id}`}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                  className="w-64 h-full flex-shrink-0 relative"
                >
                  {thumbnailUrl ? (
                    <>
                      <motion.img
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        src={thumbnailUrl}
                        alt={localItem.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/40" />
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <BookOpen className="w-24 h-24 text-white/80" />
                    </div>
                  )}
                </motion.div>

                {/* Right: Info */}
                <motion.div
                  key={`info-${localItem.id}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-1 flex flex-col p-6 text-white overflow-y-auto"
                >
                  <div className="flex items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold mb-1">{localItem.name}</h2>
                      {localItem.by && localItem.by.length > 0 && (
                        <p className="text-white/90 text-lg mb-1">
                          {localItem.by.join(', ')}
                        </p>
                      )}
                      {localItem.category && (
                        <p className="text-white/70 text-sm mb-2">{localItem.category}</p>
                      )}
                      {localItem.status && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-1 bg-white/20 text-white border-white/30"
                        >
                          {localItem.status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* AI Synopsis */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-white/90">Synopsis</h3>
                      {(!localItem.ai_synopsis || localItem.ai_synopsis.trim().length === 0) && localItem.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30"
                          onClick={handleFillDescription}
                          disabled={isFillingDescription}
                        >
                          {isFillingDescription ? (
                            <>
                              <Spinner size="sm" className="mr-1" />
                              Filling...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Fill Description
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="h-32 max-h-32 overflow-y-auto pr-2">
                      {localItem.ai_synopsis ? (
                        <p className="text-white/80 text-sm leading-relaxed">
                          {shouldAnimateDescription ? (
                            <TypedText text={localItem.ai_synopsis} delay={200} />
                          ) : (
                            localItem.ai_synopsis
                          )}
                        </p>
                      ) : (
                        <p className="text-white/50 text-sm italic">No description available</p>
                      )}
                    </div>
                  </div>

                  {/* Topics */}
                  {localItem.topic && localItem.topic.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold mb-2 text-white/90">Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {localItem.topic.map((topic: string, idx: number) => (
                          <Badge 
                            key={idx} 
                            variant="secondary" 
                            className="text-xs px-2 py-1 bg-white/20 text-white border-white/30"
                          >
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Created Date */}
                  {localItem.created && (
                    <div className="mb-4">
                      <p className="text-white/70 text-sm">
                        Added: {format(new Date(localItem.created), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto pt-4">
                    {localItem.url && (() => {
                      const url = localItem.url.toLowerCase();
                      const isIMDB = url.includes('imdb.com');
                      const isGoodreads = url.includes('goodreads.com');
                      
                      return (
                        <Button
                          className={`w-full font-semibold border-white/30 ${
                            isIMDB 
                              ? 'bg-[#F5C518] hover:bg-[#F5C518]/90 text-black' 
                              : isGoodreads 
                              ? 'bg-[#382110] hover:bg-[#382110]/90 text-white' 
                              : 'bg-white/20 hover:bg-white/30 text-white'
                          }`}
                          onClick={() => window.open(localItem.url!, '_blank')}
                        >
                          {isIMDB ? (
                            <>
                              <img 
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/IMDb_Logo_Square.svg/2048px-IMDb_Logo_Square.svg.png" 
                                alt="IMDb" 
                                className="mr-2 h-5 w-5 object-contain"
                              />
                              <span>View on IMDb</span>
                            </>
                          ) : isGoodreads ? (
                            <>
                              <img 
                                src="https://static.vecteezy.com/system/resources/previews/055/030/405/non_2x/goodreads-circle-icon-logo-symbol-free-png.png" 
                                alt="Goodreads" 
                                className="mr-2 h-5 w-5 object-contain"
                              />
                              <span>View on Goodreads</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Link
                            </>
                          )}
                        </Button>
                      );
                    })()}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

