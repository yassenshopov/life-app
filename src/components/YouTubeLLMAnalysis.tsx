'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, RefreshCw, Lightbulb, Gift, TrendingUp, ExternalLink, Play } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface LLMAnalysisProps {
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

type AnalysisType = 'insights' | 'wrapped' | 'recommendations';

interface AnalysisResult {
  analysis: string;
  type: AnalysisType;
  context: {
    totalVideos: number;
    dateRange: {
      oldest: string;
      newest: string;
    };
    topChannels: Array<{ name: string; count: number }>;
    topVideos: Array<{ title: string; count: number }>;
  };
}

interface Insight {
  number: number;
  title: string;
  description: string;
}

interface YouTubeVideo {
  id: string;
  url: string;
  title?: string;
}

// Typed text animation component
function TypedText({ 
  text, 
  delay = 0, 
  className = '',
  speed = 20,
  onComplete
}: { 
  text: string; 
  delay?: number; 
  className?: string;
  speed?: number;
  onComplete?: () => void;
}) {
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
          if (onComplete) {
            setTimeout(() => onComplete(), 0);
          }
        }
      }, speed);

      return () => clearInterval(typingInterval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse text-primary">|</span>}
    </span>
  );
}

export function YouTubeLLMAnalysis({ colorPalette }: LLMAnalysisProps) {
  const [analysisType, setAnalysisType] = React.useState<AnalysisType>('insights');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [currentInsightIndex, setCurrentInsightIndex] = React.useState(0);
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [youtubeVideos, setYoutubeVideos] = React.useState<YouTubeVideo[]>([]);

  const getCardStyle = (): React.CSSProperties | undefined => {
    if (!colorPalette) return undefined;
    return {
      backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.15)'),
      borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.3)'),
    };
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentInsightIndex(0);
    setInsights([]);
    setYoutubeVideos([]);

    try {
      const response = await fetch('/api/youtube/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate analysis');
      }

      const data = await response.json();
      setResult(data);
      
      // Parse insights from the analysis text
      const parsedInsights = parseInsights(data.analysis);
      setInsights(parsedInsights);
      
      // Parse YouTube videos from the analysis text
      const parsedVideos = parseYouTubeVideos(data.analysis);
      setYoutubeVideos(parsedVideos);
    } catch (err: any) {
      setError(err.message || 'Failed to generate analysis');
    } finally {
      setLoading(false);
    }
  };

  // Extract YouTube video ID from URL
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Get YouTube thumbnail URL
  const getThumbnailUrl = (videoId: string): string => {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  };

  // Parse YouTube videos from text
  const parseYouTubeVideos = (text: string): YouTubeVideo[] => {
    const videos: YouTubeVideo[] = [];
    const urlPattern = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[^\s\)]+)/gi;
    const matches = text.matchAll(urlPattern);
    
    for (const match of matches) {
      const url = match[0];
      const videoId = extractVideoId(url);
      if (videoId && !videos.find(v => v.id === videoId)) {
        videos.push({
          id: videoId,
          url: url,
        });
      }
    }
    
    return videos;
  };

  const parseInsights = (text: string): Insight[] => {
    const insights: Insight[] = [];
    // Split by numbered list items (e.g., "1. **Title**: Description")
    const insightPattern = /(\d+)\.\s+\*\*(.+?)\*\*:\s*(.+?)(?=\d+\.\s+\*\*|$)/gs;
    let match;
    
    while ((match = insightPattern.exec(text)) !== null) {
      const number = parseInt(match[1], 10);
      const title = match[2].trim();
      const description = match[3].trim();
      
      insights.push({ number, title, description });
    }
    
    // If no matches found with the pattern, try a simpler approach
    if (insights.length === 0) {
      const lines = text.split('\n').filter(line => line.trim());
      let currentInsight: Partial<Insight> | null = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
        
        if (numberedMatch) {
          // Save previous insight if exists
          if (currentInsight && currentInsight.title) {
            insights.push(currentInsight as Insight);
          }
          
          const fullText = numberedMatch[2];
          // Try to extract bold title
          const boldMatch = fullText.match(/\*\*(.+?)\*\*:\s*(.+)$/);
          
          if (boldMatch) {
            currentInsight = {
              number: parseInt(numberedMatch[1], 10),
              title: boldMatch[1].trim(),
              description: boldMatch[2].trim(),
            };
          } else {
            // No bold title, use first part as title
            const colonIndex = fullText.indexOf(':');
            if (colonIndex > 0) {
              currentInsight = {
                number: parseInt(numberedMatch[1], 10),
                title: fullText.substring(0, colonIndex).trim(),
                description: fullText.substring(colonIndex + 1).trim(),
              };
            } else {
              currentInsight = {
                number: parseInt(numberedMatch[1], 10),
                title: fullText,
                description: '',
              };
            }
          }
        } else if (currentInsight && trimmed) {
          // Continuation of description
          currentInsight.description += ' ' + trimmed;
        }
      }
      
      // Add last insight
      if (currentInsight && currentInsight.title) {
        insights.push(currentInsight as Insight);
      }
    }
    
    return insights;
  };

  // Reset current insight index when new insights are loaded
  React.useEffect(() => {
    if (insights.length > 0 && !loading) {
      setCurrentInsightIndex(0);
    }
  }, [insights.length, loading]);

  const formatAnalysis = (text: string) => {
    // If we have parsed insights, use the formatted version (for insights tab with typing animation)
    if (insights.length > 0 && analysisType === 'insights') {
      return insights.map((insight, index) => {
        const shouldShow = index <= currentInsightIndex;
        const isCurrentlyTyping = index === currentInsightIndex;
        const isComplete = index < currentInsightIndex;
        
        if (!shouldShow) return null;
        
        const handleTitleComplete = () => {
          // Title is done, description will start automatically
        };
        
        const handleDescriptionComplete = () => {
          // Move to next insight after a brief pause
          setTimeout(() => {
            setCurrentInsightIndex(prev => Math.min(prev + 1, insights.length));
          }, 300);
        };
        
        return (
          <div 
            key={insight.number} 
            className="mb-6 last:mb-0 p-4 rounded-lg bg-background/50 border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {insight.number}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-base font-semibold text-foreground">
                  {isComplete ? (
                    insight.title
                  ) : isCurrentlyTyping ? (
                    <TypedText 
                      text={insight.title} 
                      delay={0}
                      speed={30}
                      className="text-foreground"
                      onComplete={handleTitleComplete}
                    />
                  ) : null}
                </h3>
                {isComplete ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                ) : isCurrentlyTyping ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <TypedText 
                      text={insight.description} 
                      delay={insight.title.length * 30 + 200}
                      speed={20}
                      className="text-muted-foreground"
                      onComplete={handleDescriptionComplete}
                    />
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        );
      });
    }
    
    // Fallback to original formatting if parsing failed
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map((line, index) => {
      const trimmed = line.trim();
      
      // Check if it's a heading (starts with # or is all caps)
      if (trimmed.startsWith('#') || (trimmed.length < 50 && trimmed === trimmed.toUpperCase())) {
        return (
          <h3 key={index} className="text-lg font-semibold mt-4 mb-2 first:mt-0">
            {trimmed.replace(/^#+\s*/, '')}
          </h3>
        );
      }
      
      // Check if it's a numbered list item
      if (/^\d+[\.\)]\s/.test(trimmed)) {
        return (
          <p key={index} className="mb-2 ml-4">
            <span className="font-semibold">{trimmed.match(/^\d+[\.\)]\s/)?.[0]}</span>
            {trimmed.replace(/^\d+[\.\)]\s/, '')}
          </p>
        );
      }
      
      // Check if it's a bullet point
      if (/^[-•*]\s/.test(trimmed)) {
        return (
          <li key={index} className="mb-1 ml-4">
            {trimmed.replace(/^[-•*]\s/, '')}
          </li>
        );
      }
      
      // Regular paragraph
      return (
        <p key={index} className="mb-3 leading-relaxed">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <Card style={getCardStyle()}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI-Powered Analysis
            </CardTitle>
            <CardDescription>
              Get personalized insights about your YouTube watching habits
            </CardDescription>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={analysisType} onValueChange={(v) => {
          setAnalysisType(v as AnalysisType);
          setCurrentInsightIndex(0);
          setYoutubeVideos([]);
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="wrapped" className="gap-2">
              <Gift className="h-4 w-4" />
              Wrapped
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Recommendations
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="insights" className="mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Get personalized insights about your watching patterns, preferences, and habits.
            </div>
          </TabsContent>
          
          <TabsContent value="wrapped" className="mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Generate a fun "YouTube Wrapped" style summary of your year in videos.
            </div>
          </TabsContent>
          
          <TabsContent value="recommendations" className="mt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Get personalized recommendations for channels and content based on your watching patterns.
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              {formatAnalysis(result.analysis)}
            </div>
            
            {/* Show YouTube videos for recommendations */}
            {analysisType === 'recommendations' && youtubeVideos.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground">
                  <Play className="w-4 h-4" />
                  Recommended Videos ({youtubeVideos.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {youtubeVideos.map((video) => (
                    <a
                      key={video.id}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <div className="rounded-lg border border-border/50 overflow-hidden hover:border-border transition-all hover:shadow-lg bg-card">
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <img
                            src={getThumbnailUrl(video.id)}
                            alt={`YouTube video ${video.id}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              // Fallback to default thumbnail if maxresdefault fails
                              const target = e.target as HTMLImageElement;
                              target.src = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100 duration-200">
                              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                <Play className="w-7 h-7 text-white ml-1" fill="white" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 bg-card">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            <ExternalLink className="w-3 h-3" />
                            <span>Watch on YouTube</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {result.context && (
              <div className="pt-4 border-t text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold">Total Videos:</span> {result.context.totalVideos.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold">Date Range:</span>{' '}
                    {new Date(result.context.dateRange.oldest).toLocaleDateString()} -{' '}
                    {new Date(result.context.dateRange.newest).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="mt-4 text-center text-sm text-muted-foreground py-8">
            Click "Generate" to analyze your YouTube watch history
          </div>
        )}
      </CardContent>
    </Card>
  );
}

