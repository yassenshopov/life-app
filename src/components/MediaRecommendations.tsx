'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Loader2, Plus, ExternalLink, Book, Film, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MediaCreationPreview } from '@/components/MediaCreationPreview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_MODELS, DEFAULT_MODEL } from '@/lib/ai-gateway';

interface Recommendation {
  name: string;
  category: string | null;
  by: string[] | null;
  thumbnail: string | null;
  ai_synopsis: string | null;
  created: string | null;
  url: string | null;
  searchTitle?: string;
}

interface MediaRecommendationsProps {
  onMediaAdded?: () => void;
}

// Recommendation Card Component
function RecommendationCard({
  rec,
  itemId,
  isAdding,
  isCreating,
  index,
  onAdd,
  onHide,
}: {
  rec: Recommendation;
  itemId: string;
  isAdding: boolean;
  isCreating: boolean;
  index: number;
  onAdd: () => void;
  onHide: () => void;
}) {
  const isIMDB = rec.url?.toLowerCase().includes('imdb.com');
  const isGoodreads = rec.url?.toLowerCase().includes('goodreads.com');
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="p-0 overflow-hidden hover:shadow-lg transition-shadow">
        {/* Thumbnail */}
        <div className="aspect-video w-full overflow-hidden relative bg-muted flex items-center justify-center">
          {rec.thumbnail ? (
            <img
              src={rec.thumbnail}
              alt={rec.name}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                {rec.category === 'Book' ? (
                  <Book className="h-12 w-12 mx-auto mb-2 opacity-50" />
                ) : (
                  <Film className="h-12 w-12 mx-auto mb-2 opacity-50" />
                )}
                <p className="text-xs">No image</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Category Badge */}
          {rec.category && (
            <Badge variant="outline" className="text-xs">
              {rec.category}
            </Badge>
          )}

          {/* Title */}
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
            {rec.name}
          </h3>

          {/* Authors/Creators */}
          {rec.by && rec.by.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">By:</span> {rec.by.join(', ')}
            </p>
          )}

          {/* Description */}
          {rec.ai_synopsis && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {rec.ai_synopsis}
            </p>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              {rec.url ? (
                <Button
                  onClick={onAdd}
                  disabled={isAdding || isCreating}
                  className="flex-1 text-xs"
                  size="sm"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      Add to DB
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled
                  className="flex-1 text-xs"
                  size="sm"
                >
                  No URL Available
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onHide}
                className="text-xs px-2"
                title="Hide this recommendation"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {/* External Link */}
            {rec.url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => window.open(rec.url!, '_blank')}
              >
                {isIMDB ? (
                  <>
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/IMDb_Logo_Square.svg/2048px-IMDb_Logo_Square.svg.png" 
                      alt="IMDb" 
                      className="h-3 w-3 mr-1 object-contain"
                    />
                    View on IMDb
                  </>
                ) : isGoodreads ? (
                  <>
                    <img 
                      src="https://static.vecteezy.com/system/resources/previews/055/030/405/non_2x/goodreads-circle-icon-logo-symbol-free-png.png" 
                      alt="Goodreads" 
                      className="h-3 w-3 mr-1 object-contain"
                    />
                    View on Goodreads
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open Link
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

interface GroupedRecommendations {
  Book: Recommendation[];
  Movie: Recommendation[];
  Series: Recommendation[];
}

interface RecommendationSettings {
  includeBooks: boolean;
  includeMovies: boolean;
  includeSeries: boolean;
  bookCount: number;
  movieCount: number;
  seriesCount: number;
  model: string;
}

export function MediaRecommendations({ onMediaAdded }: MediaRecommendationsProps) {
  const [recommendations, setRecommendations] = React.useState<GroupedRecommendations>({
    Book: [],
    Movie: [],
    Series: [],
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [addingIds, setAddingIds] = React.useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = React.useState<Recommendation | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = React.useState(false);
  const [settings, setSettings] = React.useState<RecommendationSettings>({
    includeBooks: true,
    includeMovies: true,
    includeSeries: false,
    bookCount: 10,
    movieCount: 10,
    seriesCount: 0,
    model: DEFAULT_MODEL,
  });
  const { toast } = useToast();

  const hideRecommendation = (rec: Recommendation) => {
    const itemId = rec.searchTitle || rec.name;
    setHiddenIds((prev) => new Set(prev).add(itemId));
    
    // Remove from recommendations
    setRecommendations((prev) => {
      const category = rec.category as keyof GroupedRecommendations;
      if (category && prev[category]) {
        return {
          ...prev,
          [category]: prev[category].filter((r) => (r.searchTitle || r.name) !== itemId),
        };
      }
      return prev;
    });

    toast({
      title: 'Recommendation hidden',
      description: 'This recommendation has been hidden.',
    });
  };

  const generateRecommendations = async () => {
    setIsLoading(true);
    try {
      // Build request payload based on settings
      const payload: any = {
        model: settings.model,
      };
      if (settings.includeBooks) {
        payload.books = settings.bookCount;
      }
      if (settings.includeMovies) {
        payload.movies = settings.movieCount;
      }
      if (settings.includeSeries) {
        payload.series = settings.seriesCount;
      }

      const response = await fetch('/api/media/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      const newRecommendations = data.recommendations || { Book: [], Movie: [], Series: [] };
      
      // Filter out hidden items
      const filtered = {
        Book: newRecommendations.Book.filter(r => !hiddenIds.has(r.searchTitle || r.name)),
        Movie: newRecommendations.Movie.filter(r => !hiddenIds.has(r.searchTitle || r.name)),
        Series: newRecommendations.Series.filter(r => !hiddenIds.has(r.searchTitle || r.name)),
      };
      
      setRecommendations(filtered);
    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      toast({
        title: 'Failed to generate recommendations',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addToDatabase = async (recommendation: Recommendation) => {
    if (!recommendation.url) {
      toast({
        title: 'Cannot add to database',
        description: 'This recommendation does not have a valid URL. Please add it manually.',
        variant: 'destructive',
      });
      return;
    }

    const itemId = recommendation.searchTitle || recommendation.name;
    setAddingIds((prev) => new Set(prev).add(itemId));
    setIsCreating(true);

    try {
      const response = await fetch('/api/media/create-from-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: recommendation.url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add media to database');
      }

      // Show preview
      setPreviewItem({
        ...recommendation,
        name: data.media?.name || recommendation.name,
        ai_synopsis: data.media?.ai_synopsis || recommendation.ai_synopsis,
        thumbnail: data.media?.thumbnail_url || recommendation.thumbnail,
      });
      setIsPreviewVisible(true);

      toast({
        title: 'Media added successfully',
        description: `${recommendation.name} has been added to your library.`,
      });

      // Remove from recommendations list
      setRecommendations((prev) => {
        const category = recommendation.category as keyof GroupedRecommendations;
        if (category && prev[category]) {
          return {
            ...prev,
            [category]: prev[category].filter((r) => (r.searchTitle || r.name) !== itemId),
          };
        }
        return prev;
      });

      if (onMediaAdded) {
        onMediaAdded();
      }
    } catch (error: any) {
      console.error('Error adding media:', error);
      toast({
        title: 'Failed to add media',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      setIsCreating(false);
    }
  };

  const totalRecommendations = recommendations.Book.length + recommendations.Movie.length + recommendations.Series.length;
  
  if (totalRecommendations === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center space-y-4 max-w-md w-full">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold">Get Personalized Recommendations</h3>
          <p className="text-sm text-muted-foreground">
            Based on your media library, we'll suggest books and movies you might enjoy.
          </p>
          
          {/* Settings Panel */}
          <Card className="p-4 mt-4 text-left">
            <div className="space-y-4">
              {/* AI Model Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">AI Model</Label>
                <Select
                  value={settings.model}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, model: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      🔥 Latest (Newest Models)
                    </div>
                    {Object.values(AI_MODELS)
                      .filter((m) => m.displayName.includes('🔥'))
                      .map((model) => (
                        <SelectItem key={model.name} value={model.name}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                      ⭐ Trending (Most Popular)
                    </div>
                    {Object.values(AI_MODELS)
                      .filter((m) => m.displayName.includes('⭐') && !m.displayName.includes('🔥'))
                      .map((model) => (
                        <SelectItem key={model.name} value={model.name}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                      Major Models
                    </div>
                    {Object.values(AI_MODELS)
                      .filter((m) => m.category === 'major' && !m.displayName.includes('⭐'))
                      .map((model) => (
                        <SelectItem key={model.name} value={model.name}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                      Fast & Cheap
                    </div>
                    {Object.values(AI_MODELS)
                      .filter((m) => m.category === 'fast-cheap')
                      .map((model) => (
                        <SelectItem key={model.name} value={model.name}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categories</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-books"
                      checked={settings.includeBooks}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, includeBooks: checked === true }))
                      }
                    />
                    <Label htmlFor="include-books" className="flex-1 cursor-pointer">
                      Books
                    </Label>
                    {settings.includeBooks && (
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={settings.bookCount}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            bookCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                          }))
                        }
                        className="w-20 h-8 text-xs"
                      />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-movies"
                      checked={settings.includeMovies}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, includeMovies: checked === true }))
                      }
                    />
                    <Label htmlFor="include-movies" className="flex-1 cursor-pointer">
                      Movies
                    </Label>
                    {settings.includeMovies && (
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={settings.movieCount}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            movieCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                          }))
                        }
                        className="w-20 h-8 text-xs"
                      />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-series"
                      checked={settings.includeSeries}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, includeSeries: checked === true }))
                      }
                    />
                    <Label htmlFor="include-series" className="flex-1 cursor-pointer">
                      Series
                    </Label>
                    {settings.includeSeries && (
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={settings.seriesCount}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            seriesCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                          }))
                        }
                        className="w-20 h-8 text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={generateRecommendations}
                className="w-full"
                disabled={!settings.includeBooks && !settings.includeMovies && !settings.includeSeries}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Recommendations
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recommendations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalRecommendations} personalized recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
            disabled={isLoading}
          >
            Settings
          </Button>
          <Button
            variant="outline"
            onClick={generateRecommendations}
            disabled={isLoading || (!settings.includeBooks && !settings.includeMovies && !settings.includeSeries)}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && isPreviewVisible && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setIsPreviewVisible(false);
            setPreviewItem(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">Media Added Successfully!</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsPreviewVisible(false);
                  setPreviewItem(null);
                }}
              >
                ×
              </Button>
            </div>
            <MediaCreationPreview
              title={previewItem.name}
              description={previewItem.ai_synopsis || undefined}
              authors={previewItem.by || undefined}
              thumbnailUrl={previewItem.thumbnail || undefined}
              category={previewItem.category || undefined}
              status="To-do"
              isVisible={isPreviewVisible}
              isEditable={false}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsPreviewVisible(false);
                  setPreviewItem(null);
                }}
              >
                Close
              </Button>
              {previewItem.url && (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => window.open(previewItem.url!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Source
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Card className="p-4">
          <div className="space-y-4">
            {/* AI Model Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Model</Label>
              <Select
                value={settings.model}
                onValueChange={(value) =>
                  setSettings((prev) => ({ ...prev, model: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Fast & Cheap
                  </div>
                  {Object.values(AI_MODELS)
                    .filter((m) => m.category === 'fast-cheap')
                    .map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Major Models
                  </div>
                  {Object.values(AI_MODELS)
                    .filter((m) => m.category === 'major')
                    .map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categories & Quantities</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="settings-books"
                    checked={settings.includeBooks}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, includeBooks: checked === true }))
                    }
                  />
                  <Label htmlFor="settings-books" className="flex-1 cursor-pointer flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    Books
                  </Label>
                  {settings.includeBooks && (
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={settings.bookCount}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          bookCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                        }))
                      }
                      className="w-20 h-8 text-xs"
                    />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="settings-movies"
                    checked={settings.includeMovies}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, includeMovies: checked === true }))
                    }
                  />
                  <Label htmlFor="settings-movies" className="flex-1 cursor-pointer flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Movies
                  </Label>
                  {settings.includeMovies && (
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={settings.movieCount}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          movieCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                        }))
                      }
                      className="w-20 h-8 text-xs"
                    />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="settings-series"
                    checked={settings.includeSeries}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, includeSeries: checked === true }))
                    }
                  />
                  <Label htmlFor="settings-series" className="flex-1 cursor-pointer flex items-center gap-2">
                    <Film className="h-4 w-4" />
                    Series
                  </Label>
                  {settings.includeSeries && (
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={settings.seriesCount}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          seriesCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                        }))
                      }
                      className="w-20 h-8 text-xs"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="p-0 overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recommendations Grid - Grouped by Category */}
      {!isLoading && totalRecommendations > 0 && (
        <div className="space-y-8">
          {/* Books Section */}
          {recommendations.Book.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Book className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Books</h3>
                <Badge variant="secondary" className="ml-2">
                  {recommendations.Book.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recommendations.Book.map((rec, index) => {
                  const itemId = rec.searchTitle || rec.name;
                  const isAdding = addingIds.has(itemId);
                  return (
                    <RecommendationCard
                      key={itemId}
                      rec={rec}
                      itemId={itemId}
                      isAdding={isAdding}
                      isCreating={isCreating}
                      index={index}
                      onAdd={() => addToDatabase(rec)}
                      onHide={() => hideRecommendation(rec)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Movies Section */}
          {recommendations.Movie.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Movies</h3>
                <Badge variant="secondary" className="ml-2">
                  {recommendations.Movie.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recommendations.Movie.map((rec, index) => {
                  const itemId = rec.searchTitle || rec.name;
                  const isAdding = addingIds.has(itemId);
                  return (
                    <RecommendationCard
                      key={itemId}
                      rec={rec}
                      itemId={itemId}
                      isAdding={isAdding}
                      isCreating={isCreating}
                      index={index}
                      onAdd={() => addToDatabase(rec)}
                      onHide={() => hideRecommendation(rec)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Series Section */}
          {recommendations.Series.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Series</h3>
                <Badge variant="secondary" className="ml-2">
                  {recommendations.Series.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recommendations.Series.map((rec, index) => {
                  const itemId = rec.searchTitle || rec.name;
                  const isAdding = addingIds.has(itemId);
                  return (
                    <RecommendationCard
                      key={itemId}
                      rec={rec}
                      itemId={itemId}
                      isAdding={isAdding}
                      isCreating={isCreating}
                      index={index}
                      onAdd={() => addToDatabase(rec)}
                      onHide={() => hideRecommendation(rec)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && totalRecommendations === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No recommendations available. Try generating new ones.</p>
        </div>
      )}
    </div>
  );
}

