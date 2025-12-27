'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Film, Book, BookOpen, ChevronDown, ChevronRight, ExternalLink, Plus, MoreVertical, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterMenu } from '@/components/FilterMenu';
import { PropertyVisibilityMenu } from '@/components/PropertyVisibilityMenu';
import { FilterState } from '@/types/filters';
import { Outfit } from 'next/font/google';
import { format } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { MediaCreationPreview } from '@/components/MediaCreationPreview';
import { MediaRecommendations } from '@/components/MediaRecommendations';

const outfit = Outfit({ subsets: ['latin'] });

interface MediaItem {
  id: string;
  name: string;
  category: string | null;
  status: string | null;
  url: string | null;
  by: string[] | null;
  topic: string[] | null;
  thumbnail: any;
  thumbnail_url: string | null; // Supabase Storage URL
  ai_synopsis: string | null;
  created: string | null;
}

type CategoryTab = 'movies-series' | 'books' | 'recommendations';

// Extract dominant color from image (exactly like SpotifyPlayer)
function getDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    // Use window.Image to avoid conflict with next/image import
    const img = new window.Image();
    // Always set crossOrigin - Supabase Storage should allow this
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('Could not get canvas context');
          resolve('#8b5cf6');
          return;
        }
        
        // Limit canvas size for performance
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0, count = 0;
        const step = Math.max(1, Math.floor(data.length / 4 / 200)); // Sample 200 pixels
        
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
          
          // Convert to hex for easier use in gradients
          const toHex = (n: number) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          };
          const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          console.log('Extracted color:', hexColor, 'from:', imageUrl);
          resolve(hexColor);
        } else {
          console.warn('No pixels sampled');
          resolve('#8b5cf6');
        }
      } catch (error) {
        console.error('Error extracting color:', error);
        resolve('#8b5cf6');
      }
    };
    
    img.onerror = (error) => {
      console.error('Error loading image for color extraction:', imageUrl, error);
      resolve('#8b5cf6');
    };
    
    // Set timeout to avoid hanging
    setTimeout(() => {
      if (!img.complete) {
        console.warn('Image load timeout:', imageUrl);
        resolve('#8b5cf6');
      }
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

// Media Detail Modal Component
function MediaDetailModal({ 
  item, 
  isOpen, 
  onClose,
  mediaList,
  currentIndex,
  onNavigate,
  onUpdate
}: { 
  item: MediaItem | null; 
  isOpen: boolean; 
  onClose: () => void;
  mediaList: MediaItem[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onUpdate: (updatedItem: MediaItem) => void;
}) {
  const [bgColor, setBgColor] = React.useState('#8b5cf6');
  const [isFillingDescription, setIsFillingDescription] = React.useState(false);
  const [shouldAnimateDescription, setShouldAnimateDescription] = React.useState(false);
  const { toast } = useToast();
  
  const thumbnailUrl = item?.thumbnail_url || (() => {
    if (!item?.thumbnail || !Array.isArray(item.thumbnail) || item.thumbnail.length === 0) {
      return null;
    }
    const firstFile = item.thumbnail[0];
    if (firstFile.type === 'external' && firstFile.external?.url) {
      return firstFile.external.url;
    }
    if (firstFile.type === 'file' && firstFile.file?.url) {
      return firstFile.file.url;
    }
    return null;
  })();

  React.useEffect(() => {
    if (thumbnailUrl && item) {
      console.log('Extracting color from:', thumbnailUrl);
      // Reset to default while extracting
      setBgColor('#8b5cf6');
      getDominantColor(thumbnailUrl)
        .then((color) => {
          console.log('Color extracted successfully:', color);
          setBgColor(color);
        })
        .catch((error) => {
          console.error('Error in color extraction promise:', error);
          setBgColor('#8b5cf6');
        });
    } else {
      setBgColor('#8b5cf6');
    }
  }, [thumbnailUrl, item]);

  // Reset animation state when item changes
  React.useEffect(() => {
    setShouldAnimateDescription(false);
  }, [item?.id]);

  const handleFillDescription = async () => {
    if (!item || !item.id) return;
    
    setIsFillingDescription(true);
    try {
      const response = await fetch(`/api/media/${item.id}/fill-description`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fill description');
      }

      // Update local state
      onUpdate(data.media);
      
      // Trigger typing animation
      setShouldAnimateDescription(true);
      
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

  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex < mediaList.length - 1;

  const [isNavigating, setIsNavigating] = React.useState(false);

  const handlePrev = () => {
    if (canNavigatePrev && !isNavigating) {
      setIsNavigating(true);
      onNavigate(currentIndex - 1);
      setTimeout(() => setIsNavigating(false), 300);
    }
  };

  const handleNext = () => {
    if (canNavigateNext && !isNavigating) {
      setIsNavigating(true);
      onNavigate(currentIndex + 1);
      setTimeout(() => setIsNavigating(false), 300);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AnimatePresence mode="wait">
        {isOpen && item && (
              <DialogContent 
                className="sm:max-w-[700px] h-[500px] p-0 border-white/10 overflow-hidden"
                key={item.id}
              >
            <motion.div
              key={item.id}
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
              <DialogTitle className="sr-only">{item.name}</DialogTitle>
              
              {/* Navigation Arrows - Top Left */}
              {mediaList.length > 1 && (
                <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                    onClick={handlePrev}
                    disabled={!canNavigatePrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                    onClick={handleNext}
                    disabled={!canNavigateNext}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div className="flex h-full w-full">
                {/* Left: Thumbnail */}
                <motion.div
                  key={`thumbnail-${item.id}`}
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
                        alt={item.name}
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
                  key={`info-${item.id}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-1 flex flex-col p-6 text-white overflow-y-auto"
                >
            <div className="flex items-start mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold mb-1">{item.name}</h2>
                {item.by && item.by.length > 0 && (
                  <p className="text-white/90 text-lg mb-1">
                    {item.by.join(', ')}
                  </p>
                )}
                {item.category && (
                  <p className="text-white/70 text-sm mb-2">{item.category}</p>
                )}
                {item.status && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-1 bg-white/20 text-white border-white/30"
                  >
                    {item.status}
                  </Badge>
                )}
              </div>
            </div>

            {/* AI Synopsis */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white/90">Synopsis</h3>
                {(!item.ai_synopsis || item.ai_synopsis.trim().length === 0) && item.url && (
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
                {item.ai_synopsis ? (
                  <p className="text-white/80 text-sm leading-relaxed">
                    {shouldAnimateDescription ? (
                      <TypedText text={item.ai_synopsis} delay={200} />
                    ) : (
                      item.ai_synopsis
                    )}
                  </p>
                ) : (
                  <p className="text-white/50 text-sm italic">No description available</p>
                )}
              </div>
            </div>

            {/* Topics */}
            {item.topic && item.topic.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 text-white/90">Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {item.topic.map((topic, idx) => (
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
            {item.created && (
              <div className="mb-4">
                <p className="text-white/70 text-sm">
                  Added: {format(new Date(item.created), 'MMM d, yyyy')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto pt-4">
              {item.url && (() => {
                const url = item.url.toLowerCase();
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
                    onClick={() => window.open(item.url!, '_blank')}
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

// Media Card Component
function MediaCard({ 
  item, 
  onClick, 
  onDelete 
}: { 
  item: MediaItem; 
  onClick: () => void;
  onDelete: () => void;
}) {
  // Use Supabase Storage URL if available, otherwise fallback to Notion URL (for backwards compatibility)
  const thumbnailUrl = item.thumbnail_url || (() => {
    if (!item.thumbnail || !Array.isArray(item.thumbnail) || item.thumbnail.length === 0) {
      return null;
    }
    const firstFile = item.thumbnail[0];
    if (firstFile.type === 'external' && firstFile.external?.url) {
      return firstFile.external.url;
    }
    if (firstFile.type === 'file' && firstFile.file?.url) {
      return firstFile.file.url;
    }
    return null;
  })();

  // Get status color
  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    const statusColors: Record<string, string> = {
      'Done': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Not started': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'DNF': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'In progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const [imageError, setImageError] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card 
        className="p-0 cursor-pointer hover:shadow-lg transition-all group overflow-hidden h-full"
        onClick={onClick}
      >
      {/* Thumbnail */}
      <div className="aspect-video w-full overflow-hidden relative">
        {/* Three dots menu - top right, visible on hover */}
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Blurred background layer */}
        {thumbnailUrl && !imageError && (
          <div
            className="absolute inset-0 blur-xl opacity-50 scale-110"
            style={{
              backgroundImage: `url(${thumbnailUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {/* Fallback gradient if no image or error */}
        {(!thumbnailUrl || imageError) && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500" />
        )}
        {/* Actual image on top */}
        {thumbnailUrl && !imageError ? (
          <img
            src={thumbnailUrl}
            alt={item.name}
            className="relative z-10 w-full h-full object-contain px-2 group-hover:scale-105 transition-transform duration-200"
            onError={() => {
              console.warn('Failed to load image:', thumbnailUrl);
              setImageError(true);
            }}
          />
        ) : (
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-white/80" />
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Status Badge */}
        {item.status && (
          <div className="flex justify-start">
            <Badge
              variant="secondary"
              className={`text-xs px-2 py-1 ${getStatusColor(item.status)}`}
            >
              {item.status}
            </Badge>
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {item.name}
        </h3>

        {/* Category */}
        {item.category && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {item.category}
            </Badge>
          </div>
        )}

        {/* By (Authors/Creators) */}
        {item.by && item.by.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">By:</span> {item.by.join(', ')}
          </div>
        )}

        {/* Created Date */}
        {item.created && (
          <div className="text-xs text-muted-foreground">
            {format(new Date(item.created), 'MMM d, yyyy')}
          </div>
        )}

        {/* Topics */}
        {item.topic && item.topic.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.topic.slice(0, 3).map((topic, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0.5">
                {topic}
              </Badge>
            ))}
            {item.topic.length > 3 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                +{item.topic.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* URL Link */}
        {item.url && (() => {
          const url = item.url.toLowerCase();
          const isIMDB = url.includes('imdb.com');
          const isGoodreads = url.includes('goodreads.com');
          
          return (
            <div className="pt-2">
              <Link
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline inline-flex items-center gap-1 ${
                  isIMDB 
                    ? 'text-[#F5C518]' 
                    : isGoodreads 
                    ? 'text-[#382110] dark:text-[#6B8E5A]' 
                    : 'text-purple-600 dark:text-purple-400'
                }`}
              >
                {isIMDB ? (
                  <>
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/IMDb_Logo_Square.svg/2048px-IMDb_Logo_Square.svg.png" 
                      alt="IMDb" 
                      className="h-3 w-3 object-contain"
                    />
                    <span>IMDb</span>
                  </>
                ) : isGoodreads ? (
                  <>
                    <img 
                      src="https://static.vecteezy.com/system/resources/previews/055/030/405/non_2x/goodreads-circle-icon-logo-symbol-free-png.png" 
                      alt="Goodreads" 
                      className="h-3 w-3 object-contain"
                    />
                    <span>Goodreads</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3 w-3" />
                    <span>View</span>
                  </>
                )}
              </Link>
            </div>
          );
        })()}
      </div>
    </Card>
    </motion.div>
  );
}

// Cookie helper functions
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

export function MediaView() {
  const [media, setMedia] = React.useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<CategoryTab>('movies-series');
  const [filters, setFilters] = React.useState<FilterState>({ groups: [] });
  const [visibleProperties, setVisibleProperties] = React.useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = React.useState<MediaItem | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isNewDialogOpen, setIsNewDialogOpen] = React.useState(false);
  const [newLinkUrl, setNewLinkUrl] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<MediaItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [creationPreview, setCreationPreview] = React.useState<{
    title?: string;
    description?: string;
    authors?: string[];
    thumbnailUrl?: string;
    category?: string;
  } | null>(null);
  const [createdMediaItem, setCreatedMediaItem] = React.useState<MediaItem | null>(null);
  const [isEditingCreated, setIsEditingCreated] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editStatus, setEditStatus] = React.useState('To-do');
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [creationSuccess, setCreationSuccess] = React.useState(false);
  
  const { toast } = useToast();
  
  // Collapsed groups state (from cookies)
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('media-collapsed-groups');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (error) {
          console.warn('Failed to parse collapsed groups from cookie:', error);
          return new Set();
        }
      }
      return new Set();
    }
    return new Set();
  });

  // Save collapsed state to cookies
  React.useEffect(() => {
    setCookie('media-collapsed-groups', JSON.stringify(Array.from(collapsedGroups)));
  }, [collapsedGroups]);

  const toggleGroup = (status: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Fetch media from Supabase
  const fetchMedia = async () => {
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        setMedia(data.media || []);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    fetchMedia();
  }, []);

  // Check for item query parameter and open modal
  React.useEffect(() => {
    if (typeof window !== 'undefined' && media.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const itemId = params.get('item');
      if (itemId) {
        const item = media.find(m => m.id === itemId);
        if (item) {
          setSelectedMedia(item);
          setIsModalOpen(true);
          // Clean up URL
          window.history.replaceState({}, '', '/media');
        }
      }
    }
  }, [media]);

  // Sync from Notion
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/media/sync', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchMedia();
      } else {
        console.error('Sync error:', data.error);
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync media. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle delete
  const handleDeleteClick = (item: MediaItem) => {
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    const itemId = itemToDelete.id;
    const itemName = itemToDelete.name;
    
    // Close dialog immediately to unblock UI
    setDeleteConfirmOpen(false);
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/media/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from local state
        setMedia((prev) => prev.filter((item) => item.id !== itemId));
        setItemToDelete(null);
        toast({
          title: 'Deleted successfully',
          description: `"${itemName}" has been deleted.`,
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Delete failed',
          description: data.error || 'Unknown error occurred',
        });
        // Reset state on error
        setItemToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete media. Please try again.',
      });
      // Reset state on error
      setItemToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and group media by category and status
  const groupedMedia = React.useMemo(() => {
    let filtered = media;

    // Apply category filter
    if (selectedCategory === 'movies-series') {
      filtered = filtered.filter((item) => 
        item.category === 'Movie' || item.category === 'Series'
      );
    } else if (selectedCategory === 'books') {
      filtered = filtered.filter((item) => item.category === 'Book');
    }

    // Apply custom filters
    if (filters && filters.groups.length > 0) {
      // Simple filter implementation - can be enhanced
      filtered = filtered.filter((item) => {
        // Add filter logic here if needed
        return true;
      });
    }

    // Group by status (normalize "Not started" to "To-do")
    const grouped: Record<string, MediaItem[]> = {};
    filtered.forEach((item) => {
      let status = item.status || 'No Status';
      // Normalize "Not started" to "To-do" for display
      if (status === 'Not started') {
        status = 'To-do';
      }
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(item);
    });

    // Sort items within each group by creation time (newest first)
    // Items are already sorted by created date descending from the API,
    // so we maintain that order within each group
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => {
        const dateA = a.created ? new Date(a.created).getTime() : 0;
        const dateB = b.created ? new Date(b.created).getTime() : 0;
        // If both have no created date, maintain original order (newer items added first)
        if (dateA === 0 && dateB === 0) {
          // Find original indices to maintain insertion order
          const indexA = filtered.findIndex(item => item.id === a.id);
          const indexB = filtered.findIndex(item => item.id === b.id);
          return indexA - indexB; // Maintain original order (newer items first)
        }
        return dateB - dateA; // Newest first
      });
    });

    return grouped;
  }, [media, selectedCategory, filters]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          </motion.div>
          <p className="text-muted-foreground">Loading Media Ground...</p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${outfit.className}`}
    >
      <div className="p-6 md:p-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-7xl mx-auto space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Media Ground
              </h1>
              <p className="text-muted-foreground mt-2">
                Your collection of books, movies, series, and more
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsNewDialogOpen(true)}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync from Notion'}
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as CategoryTab)}>
            <TabsList>
              <TabsTrigger value="movies-series">
                <Film className="w-4 h-4 mr-2" />
                Movies & Series
              </TabsTrigger>
              <TabsTrigger value="books">
                <Book className="w-4 h-4 mr-2" />
                Books
              </TabsTrigger>
              <TabsTrigger value="recommendations">
                <Sparkles className="w-4 h-4 mr-2" />
                Recommendations
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Recommendations Tab Content */}
          {selectedCategory === 'recommendations' ? (
            <MediaRecommendations
              onMediaAdded={() => {
                fetchMedia();
              }}
            />
          ) : (
            <>
              {/* Stats */}
              <div className="text-sm text-muted-foreground">
                Showing {Object.values(groupedMedia).flat().length} of {media.length} items
              </div>

              {/* Grouped Media by Status */}
              {Object.keys(groupedMedia).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedMedia)
                .sort(([statusA], [statusB]) => {
                  // Sort statuses: To-do, Pause, In Progress, Done, DNF, then others
                  const order: Record<string, number> = {
                    'To-do': 1,
                    'Pause': 2,
                    'In Progress': 3,
                    'In progress': 3, // Handle both cases
                    'Done': 5,
                    'DNF': 6,
                  };
                  const orderA = order[statusA] || 99;
                  const orderB = order[statusB] || 99;
                  return orderA - orderB;
                })
                .map(([status, items], groupIndex) => {
                  const isCollapsed = collapsedGroups.has(status);
                  return (
                    <motion.div
                      key={status}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: groupIndex * 0.1 }}
                      className="space-y-3"
                    >
                      <motion.button
                        onClick={() => toggleGroup(status)}
                        className="flex items-center gap-2 text-xl font-semibold text-foreground hover:text-foreground/80 transition-colors w-full text-left"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </motion.div>
                        <span>
                          {status}{' '}
                          <span className="text-sm text-muted-foreground font-normal">({items.length})</span>
                        </span>
                      </motion.button>
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {items.map((item, index) => (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ 
                                    duration: 0.3, 
                                    delay: index * 0.05,
                                    ease: 'easeOut'
                                  }}
                                >
                                  <MediaCard 
                                    item={item}
                                    onClick={() => {
                                      setSelectedMedia(item);
                                      setIsModalOpen(true);
                                    }}
                                    onDelete={() => handleDeleteClick(item)}
                                  />
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No media found</h3>
              <p className="text-muted-foreground mb-4">
                {`No ${selectedCategory === 'movies-series' ? 'movies or series' : 'books'} found`}
              </p>
              {media.length === 0 && (
                <Button onClick={handleSync} disabled={isSyncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync from Notion
                </Button>
              )}
            </Card>
          )}
            </>
          )}
        </motion.div>
      </div>

      {/* Media Detail Modal */}
      <MediaDetailModal
        item={selectedMedia}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMedia(null);
        }}
        mediaList={Object.values(groupedMedia).flat()}
        currentIndex={(() => {
          if (!selectedMedia) return 0;
          const flatList = Object.values(groupedMedia).flat();
          const index = flatList.findIndex(item => item.id === selectedMedia.id);
          return index >= 0 ? index : 0;
        })()}
        onNavigate={(index) => {
          const flatList = Object.values(groupedMedia).flat();
          if (index >= 0 && index < flatList.length) {
            setSelectedMedia(flatList[index]);
          }
        }}
        onUpdate={(updatedItem) => {
          setMedia((prev) =>
            prev.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            )
          );
          setSelectedMedia(updatedItem);
        }}
      />

      {/* New Media Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={(open) => {
        setIsNewDialogOpen(open);
        // Clear all state when dialog closes or when opening fresh
        if (!open || !isNewDialogOpen) {
          setCreationPreview(null);
          setNewLinkUrl('');
          setCreatedMediaItem(null);
          setIsEditingCreated(false);
          setCreationSuccess(false);
          setEditTitle('');
          setEditDescription('');
          setEditStatus('To-do');
          setIsCreating(false);
          setIsUpdating(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Media</DialogTitle>
            <DialogDescription>
              {isEditingCreated ? 'Edit your new entry' : 'Paste an IMDb or Goodreads link to automatically create a new entry'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!isCreating && !isEditingCreated && (
              <>
                <div className="space-y-2">
                  <label htmlFor="link-input" className="text-sm font-medium">
                    Link (IMDb or Goodreads)
                  </label>
                  <input
                    id="link-input"
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://www.imdb.com/title/tt... or https://www.goodreads.com/book/show/..."
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isCreating}
                  />
                </div>
                <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsNewDialogOpen(false);
                  setNewLinkUrl('');
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!newLinkUrl.trim()) return;
                  
                  const url = newLinkUrl.trim();
                  setIsCreating(true);
                  
                  try {
                    // Create the media entry
                    const response = await fetch('/api/media/create-from-link', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.error || 'Failed to create media entry');
                    }

                    // Show preview with the created data
                    if (data.media) {
                      setCreationPreview({
                        title: data.media.name,
                        description: data.media.ai_synopsis || undefined,
                        authors: data.media.by || undefined,
                        thumbnailUrl: data.media.thumbnail_url || undefined,
                        category: data.media.category || undefined,
                      });

                      // Wait for animation to complete (minimum 3 seconds for smooth animation)
                      await new Promise(resolve => setTimeout(resolve, 3000));

                      // Store created media item and set up editing state
                      const normalizedStatus = data.media.status === 'Not started' ? 'To-do' : (data.media.status || 'To-do');
                      setCreatedMediaItem(data.media);
                      setEditTitle(data.media.name);
                      setEditDescription(data.media.ai_synopsis || '');
                      setEditStatus(normalizedStatus);
                      setIsEditingCreated(true);
                      setCreationSuccess(true);

                      // Add to media list
                      setMedia((prev) => [data.media, ...prev]);
                    }

                    // Don't close dialog - keep it open for editing
                    setNewLinkUrl('');
                  } catch (error: any) {
                    console.error('Error creating media:', error);
                    toast({
                      title: 'Creation failed',
                      description: error.message || 'Failed to create media entry. Please try again.',
                    });
                    setCreationPreview(null);
                  } finally {
                    setIsCreating(false);
                  }
                }}
                disabled={isCreating || !newLinkUrl.trim()}
              >
                {isCreating ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
                </div>
              </>
            )}
            
            {/* Creation Preview - shows during creation */}
            {isCreating && !isEditingCreated && (
              <MediaCreationPreview
                title={creationPreview?.title}
                description={creationPreview?.description}
                authors={creationPreview?.authors}
                thumbnailUrl={creationPreview?.thumbnailUrl}
                category={creationPreview?.category}
                isVisible={true}
              />
            )}

            {/* Editable Preview After Creation */}
            {isEditingCreated && createdMediaItem && (
              <div className="space-y-4">
                {creationSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      Entry created!
                    </p>
                  </div>
                )}
                
                <MediaCreationPreview
                  title={editTitle}
                  description={editDescription}
                  authors={createdMediaItem.by || undefined}
                  thumbnailUrl={createdMediaItem.thumbnail_url || undefined}
                  category={createdMediaItem.category || undefined}
                  status={editStatus}
                  isVisible={true}
                  isEditable={true}
                  onTitleChange={(title) => setEditTitle(title)}
                  onDescriptionChange={(desc) => setEditDescription(desc)}
                  onStatusChange={(status) => setEditStatus(status)}
                  onSave={async () => {
                    if (!createdMediaItem) return;
                    
                    setIsUpdating(true);
                    try {
                      const response = await fetch(`/api/media/${createdMediaItem.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: editTitle,
                          ai_synopsis: editDescription,
                          status: editStatus,
                        }),
                      });

                      const data = await response.json();

                      if (!response.ok) {
                        throw new Error(data.error || 'Failed to update media entry');
                      }

                      // Update local state
                      setMedia((prev) =>
                        prev.map((item) =>
                          item.id === createdMediaItem.id
                            ? { ...item, name: editTitle, ai_synopsis: editDescription, status: editStatus === 'To-do' ? 'Not started' : editStatus }
                            : item
                        )
                      );

                      setCreatedMediaItem(data.media);
                      setCreationSuccess(false);
                      
                      toast({
                        title: 'Updated successfully',
                        description: 'Your changes have been saved.',
                      });
                    } catch (error: any) {
                      console.error('Error updating media:', error);
                      toast({
                        title: 'Update failed',
                        description: error.message || 'Failed to update media entry. Please try again.',
                      });
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  isSaving={isUpdating}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setDeleteConfirmOpen(false);
          setItemToDelete(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This will permanently delete the entry from both Notion and Supabase. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setItemToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
