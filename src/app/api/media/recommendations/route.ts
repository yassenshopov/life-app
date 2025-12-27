export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { callAIGateway, DEFAULT_MODEL } from '@/lib/ai-gateway';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to fetch with timeout protection
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Search OMDB by title to get IMDB ID
async function searchIMDbByTitle(title: string): Promise<string | null> {
  const omdbApiKey = process.env.OMDB_API_KEY;
  if (!omdbApiKey) {
    throw new Error('OMDB_API_KEY not configured');
  }

  try {
    const searchQuery = encodeURIComponent(title);
    const response = await fetchWithTimeout(
      `https://www.omdbapi.com/?s=${searchQuery}&apikey=${omdbApiKey}`,
      {},
      10000
    );
    const data = await response.json();

    if (data.Response === 'False' || !data.Search || data.Search.length === 0) {
      return null;
    }

    // Return the first result's IMDB ID
    return data.Search[0].imdbID || null;
  } catch (error) {
    console.error('Error searching OMDB:', error);
    return null;
  }
}

// Search Goodreads by title to get book ID
async function searchGoodreadsByTitle(title: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(title);
    const response = await fetchWithTimeout(
      `https://www.goodreads.com/search?q=${searchQuery}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      10000
    );

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Try to extract the first book ID from search results
    // Goodreads search results have links like /book/show/12345
    const bookIdMatch = html.match(/\/book\/show\/(\d+)/);
    if (bookIdMatch) {
      return bookIdMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Goodreads:', error);
    return null;
  }
}

// Search Google Books by title to get book data
async function searchBookByTitle(title: string): Promise<{ url: string; data: any } | null> {
  try {
    // First try to find Goodreads URL
    const goodreadsId = await searchGoodreadsByTitle(title);
    const goodreadsUrl = goodreadsId 
      ? `https://www.goodreads.com/book/show/${goodreadsId}`
      : `https://www.goodreads.com/search?q=${encodeURIComponent(title)}`;
    
    // Get book data from Google Books API
    const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const apiKeyParam = googleBooksApiKey ? `&key=${googleBooksApiKey}` : '';
    
    const searchQuery = encodeURIComponent(title);
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${searchQuery}&maxResults=1${apiKeyParam}`,
      {},
      10000
    );

    if (!response.ok) {
      // If Google Books fails, return with Goodreads URL if we found one
      if (goodreadsId) {
        return {
          url: goodreadsUrl,
          data: {
            name: title,
            category: 'Book',
            by: null,
            thumbnail: null,
            ai_synopsis: null,
            created: null,
          }
        };
      }
      return null;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      // If no Google Books results, return with Goodreads URL if we found one
      if (goodreadsId) {
        return {
          url: goodreadsUrl,
          data: {
            name: title,
            category: 'Book',
            by: null,
            thumbnail: null,
            ai_synopsis: null,
            created: null,
          }
        };
      }
      return null;
    }

    const book = data.items[0].volumeInfo;
    
    // Extract authors
    const authors = book.authors || [];
    
    // Get publication year
    const publishedDate = book.publishedDate;
    const year = publishedDate ? publishedDate.split('-')[0] : null;
    
    // Format title with year in brackets if available
    const titleWithYear = year ? `${book.title} (${year})` : book.title;
    
    // Get thumbnail
    const thumbnail = book.imageLinks?.thumbnail?.replace('http://', 'https://') ||
                    book.imageLinks?.smallThumbnail?.replace('http://', 'https://') ||
                    book.imageLinks?.medium?.replace('http://', 'https://') ||
                    book.imageLinks?.large?.replace('http://', 'https://') ||
                    null;
    
    // Get description
    const description = book.description 
      ? book.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 500)
      : null;

    return {
      url: goodreadsUrl,
      data: {
        name: titleWithYear,
        category: 'Book',
        by: authors,
        thumbnail: thumbnail,
        ai_synopsis: description,
        created: publishedDate || null,
      }
    };
  } catch (error) {
    console.error('Error searching Google Books:', error);
    return null;
  }
}

// Fetch IMDb data using OMDB API
async function fetchIMDbData(imdbId: string) {
  const omdbApiKey = process.env.OMDB_API_KEY;
  if (!omdbApiKey) {
    throw new Error('OMDB_API_KEY not configured');
  }

  const response = await fetchWithTimeout(
    `https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbApiKey}`,
    {},
    10000
  );
  const data = await response.json();

  if (data.Response === 'False') {
    throw new Error(data.Error || 'Failed to fetch IMDb data');
  }

  const year = data.Year && data.Year !== 'N/A' ? data.Year : null;
  const title = year ? `${data.Title} (${year})` : data.Title;

  let by: string[] = [];
  if (data.Director && data.Director !== 'N/A') {
    by = data.Director.split(',').map(name => name.trim()).filter(name => name.length > 0);
  } else if (data.Writer && data.Writer !== 'N/A') {
    by = data.Writer.split(',').map(name => name.trim()).filter(name => name.length > 0);
  }

  return {
    name: title,
    category: data.Type === 'series' ? 'Series' : 'Movie',
    by: by,
    thumbnail: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
    ai_synopsis: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
    created: data.Released && data.Released !== 'N/A' ? data.Released : null,
    url: `https://www.imdb.com/title/${imdbId}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's media library
    const { data: media, error: mediaError } = await supabase
      .from('media')
      .select('name, category, by, topic, status')
      .eq('user_id', userId)
      .order('created', { ascending: false });

    if (mediaError) {
      console.error('Error fetching media:', mediaError);
      return NextResponse.json(
        { error: 'Failed to fetch media library' },
        { status: 500 }
      );
    }

    // Build context for AI
    const libraryContext = {
      books: media?.filter(m => m.category === 'Book').slice(0, 20) || [],
      movies: media?.filter(m => m.category === 'Movie').slice(0, 20) || [],
      series: media?.filter(m => m.category === 'Series').slice(0, 20) || [],
    };

    // Generate recommendations using AI
    const librarySummary = `
Books in library (${libraryContext.books.length}): ${libraryContext.books.map(b => b.name).join(', ')}
Movies in library (${libraryContext.movies.length}): ${libraryContext.movies.map(m => m.name).join(', ')}
Series in library (${libraryContext.series.length}): ${libraryContext.series.map(s => s.name).join(', ')}
`;

    const prompt = `Based on the following media library, suggest exactly 30 recommendations:
- 10 Books
- 10 Movies  
- 10 Series

Consider the user's preferences based on what they already have. Aim for variety within each category.

Library:
${librarySummary}

For each recommendation, provide:
1. The exact title (as it appears on IMDB for movies/series, or as it appears on Goodreads for books)
2. Whether it's a "Book", "Movie", or "Series"
3. The author (for books) or director (for movies/series) if known

Format your response as a JSON array of objects, each with:
- "title": "exact title"
- "type": "Book" | "Movie" | "Series"
- "creator": "author or director name" (optional)

Make sure to include exactly 10 of each type. Example structure:
[
  {"title": "The Seven Husbands of Evelyn Hugo", "type": "Book", "creator": "Taylor Jenkins Reid"},
  {"title": "Project Hail Mary", "type": "Book", "creator": "Andy Weir"},
  ... (8 more books) ...
  {"title": "Inception", "type": "Movie", "creator": "Christopher Nolan"},
  {"title": "The Matrix", "type": "Movie", "creator": "The Wachowskis"},
  ... (8 more movies) ...
  {"title": "Breaking Bad", "type": "Series", "creator": "Vince Gilligan"},
  {"title": "The Crown", "type": "Series", "creator": "Peter Morgan"},
  ... (8 more series) ...
]

Return ONLY the JSON array, no other text.`;

    let recommendations: Array<{ title: string; type: string; creator?: string }> = [];
    
    try {
      const aiResponse = await callAIGateway(
        [
          {
            role: 'system',
            content: 'You are a helpful media recommendation assistant. You provide recommendations in JSON format only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        DEFAULT_MODEL,
        {
          temperature: 0.8,
          max_tokens: 2000,
        }
      );

      // Parse JSON from response - try multiple strategies
      try {
        // Strategy 1: Look for JSON array in the response
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch[0]);
        } else {
          // Strategy 2: Try to parse the whole response
          recommendations = JSON.parse(aiResponse.trim());
        }
      } catch (parseError) {
        // Strategy 3: Try to extract JSON from code blocks
        const codeBlockMatch = aiResponse.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (codeBlockMatch) {
          recommendations = JSON.parse(codeBlockMatch[1]);
        } else {
          // Strategy 4: Try to find and parse any array-like structure
          const arrayLikeMatch = aiResponse.match(/\{[\s\S]*"title"[\s\S]*\}/g);
          if (arrayLikeMatch) {
            recommendations = arrayLikeMatch.map((item) => {
              try {
                return JSON.parse(item);
              } catch {
                return null;
              }
            }).filter(Boolean);
          } else {
            throw new Error('Could not parse AI response as JSON');
          }
        }
      }
      
      // Validate recommendations structure
      if (!Array.isArray(recommendations)) {
        throw new Error('AI response is not an array');
      }
      
      // Filter out invalid recommendations
      recommendations = recommendations.filter(
        (rec) => rec && rec.title && rec.type && ['Book', 'Movie', 'Series'].includes(rec.type)
      );
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return NextResponse.json(
        { error: 'Failed to generate recommendations' },
        { status: 500 }
      );
    }

      // Ensure we have exactly 10 of each type (or as many as available)
      const books = recommendations.filter(r => r.type === 'Book').slice(0, 10);
      const movies = recommendations.filter(r => r.type === 'Movie').slice(0, 10);
      const series = recommendations.filter(r => r.type === 'Series').slice(0, 10);
      
      // Combine in order: books, movies, series
      recommendations = [...books, ...movies, ...series];

    // For each recommendation, search for URL and fetch details
    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        try {
          if (rec.type === 'Book') {
            const bookResult = await searchBookByTitle(rec.title);
            if (bookResult) {
              return {
                ...bookResult.data,
                url: bookResult.url,
                searchTitle: rec.title,
              };
            }
          } else if (rec.type === 'Movie' || rec.type === 'Series') {
            const imdbId = await searchIMDbByTitle(rec.title);
            if (imdbId) {
              const imdbData = await fetchIMDbData(imdbId);
              return {
                ...imdbData,
                searchTitle: rec.title,
              };
            }
          }
          
          // If search failed, return basic info
          return {
            name: rec.title,
            category: rec.type,
            by: rec.creator ? [rec.creator] : null,
            thumbnail: null,
            ai_synopsis: null,
            created: null,
            url: null,
            searchTitle: rec.title,
          };
        } catch (error) {
          console.error(`Error processing recommendation "${rec.title}":`, error);
          return {
            name: rec.title,
            category: rec.type,
            by: rec.creator ? [rec.creator] : null,
            thumbnail: null,
            ai_synopsis: null,
            created: null,
            url: null,
            searchTitle: rec.title,
          };
        }
      })
    );

    // Normalize name for comparison (remove year, lowercase, trim)
    const normalizeName = (name: string): string => {
      return name
        .replace(/\s*\(\d{4}\)\s*/g, '') // Remove year in parentheses like "(2023)"
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' '); // Normalize whitespace
    };

    // Create a map of normalized names by category from existing library for quick lookup
    const existingByCategory: Record<string, Set<string>> = {
      Book: new Set(),
      Movie: new Set(),
      Series: new Set(),
    };

    (media || []).forEach((m) => {
      if (m.category && existingByCategory[m.category]) {
        existingByCategory[m.category].add(normalizeName(m.name));
      }
    });

    // Filter out recommendations that already exist in the library (checking same category)
    const filteredRecommendations = enrichedRecommendations.filter((rec) => {
      if (!rec.category) return true; // Keep if no category
      const categorySet = existingByCategory[rec.category];
      if (!categorySet) return true; // Keep if category not in map
      const normalizedRecName = normalizeName(rec.name);
      return !categorySet.has(normalizedRecName);
    });

    // Group recommendations by category
    const grouped = {
      Book: filteredRecommendations.filter(r => r.category === 'Book'),
      Movie: filteredRecommendations.filter(r => r.category === 'Movie'),
      Series: filteredRecommendations.filter(r => r.category === 'Series'),
    };

    return NextResponse.json({
      recommendations: grouped,
    });
  } catch (error: any) {
    console.error('Error in recommendations endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

