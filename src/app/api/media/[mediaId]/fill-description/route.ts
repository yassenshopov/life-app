export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getNotionClient } from '@/lib/notion-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Media Ground database ID
const MEDIA_DATABASE_ID = '32638dcb058e4ebeaf325136ce8f3ec4';

// Extract IMDb ID from URL
function extractIMDbId(url: string): string | null {
  const match = url.match(/imdb\.com\/title\/(tt\d+)/);
  return match ? match[1] : null;
}

// Extract Goodreads ID from URL
function extractGoodreadsId(url: string): string | null {
  const match = url.match(/goodreads\.com\/book\/show\/(\d+)/);
  return match ? match[1] : null;
}

// Fetch with timeout
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

  return {
    ai_synopsis: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
  };
}

// Fetch book data using Google Books API
async function fetchBookDescription(bookTitle: string) {
  if (!bookTitle || bookTitle.trim().length === 0) {
    throw new Error('Book title is required');
  }

  // Clean up the title - remove year in parentheses if present for better search results
  // e.g., "Book Title (2023)" -> "Book Title"
  const cleanTitle = bookTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
  
  // Use Google Books API to search for the book
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const apiKeyParam = googleBooksApiKey ? `&key=${googleBooksApiKey}` : '';
  
  const searchQuery = encodeURIComponent(cleanTitle);
  const booksResponse = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=${searchQuery}&maxResults=5${apiKeyParam}`,
    {},
    10000
  );
  
  if (!booksResponse.ok) {
    throw new Error(`Failed to fetch from Google Books API: ${booksResponse.status}`);
  }
  
  const booksData = await booksResponse.json();
  
  if (!booksData.items || booksData.items.length === 0) {
    throw new Error(`No book found for "${cleanTitle}"`);
  }

  // Try to find the best match by comparing titles
  let bestMatch = booksData.items[0];
  const titleLower = cleanTitle.toLowerCase();
  
  for (const item of booksData.items) {
    const itemTitle = item.volumeInfo?.title?.toLowerCase() || '';
    if (itemTitle === titleLower || itemTitle.includes(titleLower) || titleLower.includes(itemTitle)) {
      bestMatch = item;
      break;
    }
  }

  const book = bestMatch.volumeInfo;
  
  // Get description - try different fields
  let description = book.description || book.subtitle || null;
  
  if (description) {
    // Clean HTML tags and normalize whitespace
    description = description
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit length (keep it reasonable for synopsis)
    if (description.length > 1000) {
      description = description.substring(0, 1000) + '...';
    }
  }

  return {
    ai_synopsis: description,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
    }

    // Get the media entry from Supabase
    const { data: mediaEntry, error: fetchError } = await supabase
      .from('media')
      .select('id, notion_page_id, url, category, ai_synopsis, name')
      .eq('id', mediaId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !mediaEntry) {
      return NextResponse.json(
        { error: 'Media entry not found' },
        { status: 404 }
      );
    }

    // Check if description already exists
    if (mediaEntry.ai_synopsis && mediaEntry.ai_synopsis.trim().length > 0) {
      return NextResponse.json(
        { error: 'Description already exists' },
        { status: 400 }
      );
    }

    // Check if URL exists
    if (!mediaEntry.url) {
      return NextResponse.json(
        { error: 'Media entry does not have a URL to fetch description from' },
        { status: 400 }
      );
    }

    const urlLower = mediaEntry.url.toLowerCase();
    let descriptionData: any;

    // Fetch description based on URL type or category
    if (urlLower.includes('imdb.com')) {
      const imdbId = extractIMDbId(mediaEntry.url);
      if (!imdbId) {
        return NextResponse.json({ error: 'Invalid IMDb URL' }, { status: 400 });
      }
      descriptionData = await fetchIMDbData(imdbId);
    } else if (urlLower.includes('goodreads.com') || mediaEntry.category === 'Book') {
      // Use the book name from the media entry to search Google Books API
      if (!mediaEntry.name || mediaEntry.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Book name is required to fetch description' },
          { status: 400 }
        );
      }
      descriptionData = await fetchBookDescription(mediaEntry.name);
    } else {
      return NextResponse.json(
        { error: 'URL must be from IMDb or Goodreads, or entry must be a Book' },
        { status: 400 }
      );
    }

    if (!descriptionData.ai_synopsis) {
      return NextResponse.json(
        { error: 'Could not fetch description from API' },
        { status: 500 }
      );
    }

    // Fetch database schema to get correct property names
    let propertyMap: Record<string, string> = {};
    let existingProperties: Set<string> = new Set();
    const notion = getNotionClient();
    
    try {
      const database = await notion.databases.retrieve({
        database_id: MEDIA_DATABASE_ID,
      });
      const properties = (database as any).properties || {};
      Object.entries(properties).forEach(([key, prop]: [string, any]) => {
        const propName = prop.name || key;
        propertyMap[propName] = key;
        existingProperties.add(propName);
      });
    } catch (error) {
      console.warn('Failed to fetch database schema, using defaults:', error);
      propertyMap = {
        'Synopsys': 'Synopsys',
      };
      Object.keys(propertyMap).forEach(key => existingProperties.add(key));
    }

    // Prepare Notion properties update
    const notionProperties: any = {};

    // Try to find the Synopsys property with common variations
    const possibleNames = ['Synopsys', 'AI Synopsis', 'Synopsis', 'Description', 'AI Description'];
    let synopsisProp: string | null = null;
    
    for (const name of possibleNames) {
      if (existingProperties.has(name)) {
        synopsisProp = propertyMap[name] || name;
        break;
      }
    }
    
    // If not found, try using 'Synopsys' as fallback
    if (!synopsisProp) {
      synopsisProp = propertyMap['Synopsys'] || 'Synopsys';
    }
    
    notionProperties[synopsisProp] = {
      rich_text: descriptionData.ai_synopsis ? [{ text: { content: descriptionData.ai_synopsis } }] : [],
    };

    // Update Notion page
    if (mediaEntry.notion_page_id) {
      try {
        await notion.pages.update({
          page_id: mediaEntry.notion_page_id,
          properties: notionProperties,
        });
      } catch (notionError: any) {
        console.error('Error updating Notion page:', notionError);
        // Continue with Supabase update even if Notion fails
      }
    }

    // Update Supabase
    const { data: updatedMedia, error: updateError } = await supabase
      .from('media')
      .update({
        ai_synopsis: descriptionData.ai_synopsis,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mediaId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating Supabase:', updateError);
      return NextResponse.json(
        { error: 'Failed to update media entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      media: updatedMedia,
    });
  } catch (error: any) {
    console.error('Error filling description:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fill description' },
      { status: 500 }
    );
  }
}

