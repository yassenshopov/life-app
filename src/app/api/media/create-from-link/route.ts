export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getNotionClient, uploadImageUrlToNotion, createNotionFileProperty } from '@/lib/notion-api';

const notion = getNotionClient();

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

// Fetch IMDb data using OMDB API (free tier)
async function fetchIMDbData(imdbId: string) {
  const omdbApiKey = process.env.OMDB_API_KEY;
  if (!omdbApiKey) {
    throw new Error('OMDB_API_KEY not configured. Please set the OMDB_API_KEY environment variable.');
  }

  const response = await fetchWithTimeout(
    `https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbApiKey}`,
    {},
    10000 // 10 second timeout
  );
  
  if (!response.ok) {
    throw new Error(`OMDB API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();

  if (data.Response === 'False') {
    // Provide more helpful error messages for common API errors
    const errorMessage = data.Error || 'Failed to fetch IMDb data';
    if (errorMessage.includes('Invalid API key') || errorMessage.includes('API key')) {
      throw new Error('Invalid OMDB API key. Please check your OMDB_API_KEY environment variable. You can get a free API key at http://www.omdbapi.com/apikey.aspx');
    }
    throw new Error(errorMessage);
  }

  // Format title with year in brackets
  const year = data.Year && data.Year !== 'N/A' ? data.Year : null;
  const title = year ? `${data.Title} (${year})` : data.Title;

  // Handle multiple directors/writers by splitting comma-separated values
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
  };
}

// Extract book title from Goodreads URL (minimal scraping just for title)
async function extractBookTitleFromGoodreads(goodreadsId: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      `https://www.goodreads.com/book/show/${goodreadsId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      10000 // 10 second timeout
    );

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Try to extract title from meta tags first (most reliable)
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch) {
      // Remove " by Author Name" suffix if present
      const title = ogTitleMatch[1].split(' by ')[0].trim();
      return title || null;
    }
    
    // Fallback to HTML parsing (updated selector for current Goodreads structure)
    const titleMatch = html.match(/<h1[^>]*data-testid="bookTitle"[^>]*>([^<]+)</i);
    
    return titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null;
  } catch (error) {
    console.warn('Failed to extract title from Goodreads:', error);
    return null;
  }
}

// Fetch book data using Google Books API (secure, reliable, no scraping)
async function fetchGoodreadsData(goodreadsId: string) {
  // First, try to get the book title from Goodreads (minimal scraping)
  // This is necessary because Google Books API doesn't support Goodreads IDs directly
  const bookTitle = await extractBookTitleFromGoodreads(goodreadsId);
  
  if (!bookTitle) {
    throw new Error('Could not extract book title from Goodreads URL');
  }

  // Use Google Books API to search for the book
  // Google Books API is free, reliable, and doesn't require an API key (though you can use one for higher limits)
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const apiKeyParam = googleBooksApiKey ? `&key=${googleBooksApiKey}` : '';
  
  const searchQuery = encodeURIComponent(bookTitle);
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=${searchQuery}&maxResults=1${apiKeyParam}`,
    {},
    10000 // 10 second timeout
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch book data from Google Books API: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error(`No book found for "${bookTitle}"`);
  }

  const book = data.items[0].volumeInfo;
  
  // Extract authors
  const authors = book.authors || [];
  
  // Get publication year
  const publishedDate = book.publishedDate;
  const year = publishedDate ? publishedDate.split('-')[0] : null;
  
  // Format title with year in brackets if available
  const titleWithYear = year ? `${book.title} (${year})` : book.title;
  
  // Get thumbnail - try different image sizes
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
    name: titleWithYear,
    category: 'Book',
    by: authors,
    thumbnail: thumbnail,
    ai_synopsis: description,
    created: publishedDate || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const urlLower = url.toLowerCase();
    let mediaData: any;
    let isIMDB = false;
    let isGoodreads = false;

    // Detect and fetch data
    if (urlLower.includes('imdb.com')) {
      isIMDB = true;
      const imdbId = extractIMDbId(url);
      if (!imdbId) {
        return NextResponse.json({ error: 'Invalid IMDb URL' }, { status: 400 });
      }
      mediaData = await fetchIMDbData(imdbId);
    } else if (urlLower.includes('goodreads.com')) {
      isGoodreads = true;
      const goodreadsId = extractGoodreadsId(url);
      if (!goodreadsId) {
        return NextResponse.json({ error: 'Invalid Goodreads URL' }, { status: 400 });
      }
      mediaData = await fetchGoodreadsData(goodreadsId);
    } else {
      return NextResponse.json(
        { error: 'URL must be from IMDb or Goodreads' },
        { status: 400 }
      );
    }

    if (!mediaData.name) {
      return NextResponse.json({ error: 'Failed to extract media data' }, { status: 500 });
    }

    // Fetch database schema to get correct property names and types
    let propertyMap: Record<string, string> = {};
    let existingProperties: Set<string> = new Set();
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
      // Use default property names
      propertyMap = {
        'Name': 'Name',
        'URL': 'URL',
        'Category': 'Category',
        'By': 'By',
        'Created': 'Created',
        'Thumbnail': 'Thumbnail',
      };
      Object.keys(propertyMap).forEach(key => existingProperties.add(key));
    }

    // Prepare Notion properties
    const notionProperties: any = {
      [propertyMap['Name'] || 'Name']: {
        title: [{ text: { content: mediaData.name } }],
      },
      [propertyMap['URL'] || 'URL']: {
        url: url,
      },
    };

    if (mediaData.category && existingProperties.has('Category')) {
      const categoryProp = propertyMap['Category'] || 'Category';
      notionProperties[categoryProp] = {
        select: { name: mediaData.category },
      };
    }

    if (mediaData.by && mediaData.by.length > 0 && existingProperties.has('By')) {
      const byProp = propertyMap['By'] || 'By';
      notionProperties[byProp] = {
        multi_select: mediaData.by.map((author: string) => ({ name: author })),
      };
    }

    // Add Synopsys - try to find the property with common variations
    if (mediaData.ai_synopsis) {
      const possibleNames = ['Synopsys', 'AI Synopsis', 'Synopsis', 'Description', 'AI Description'];
      let synopsisProp: string | null = null;
      
      for (const name of possibleNames) {
        if (existingProperties.has(name)) {
          synopsisProp = propertyMap[name] || name;
          break;
        }
      }
      
      // If not found, try using 'Synopsys' as fallback (Notion will error if it doesn't exist)
      if (!synopsisProp) {
        synopsisProp = propertyMap['Synopsys'] || 'Synopsys';
      }
      
      notionProperties[synopsisProp] = {
        rich_text: [{ text: { content: mediaData.ai_synopsis } }],
      };
    }

    if (mediaData.created && existingProperties.has('Created')) {
      try {
        const date = new Date(mediaData.created);
        if (!isNaN(date.getTime())) {
          const createdProp = propertyMap['Created'] || 'Created';
          notionProperties[createdProp] = {
            date: { start: date.toISOString().split('T')[0] },
          };
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Upload thumbnail to Notion and Supabase before creating the page
    let notionFileUploadId: string | null = null;
    let thumbnailUrl: string | null = null;
    
    if (mediaData.thumbnail && existingProperties.has('Thumbnail')) {
      try {
        // Upload to Notion using shared utility
        notionFileUploadId = await uploadImageUrlToNotion(mediaData.thumbnail, 'thumbnail.jpg');
        
        // Also upload to Supabase Storage (using a temp path, we'll update after page creation)
        const imageResponse = await fetchWithTimeout(
          mediaData.thumbnail,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          },
          15000 // 15 second timeout for image downloads
        );
        
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          const fileExtension = contentType.split('/')[1] || 'jpg';
          const tempFilePath = `${userId}/temp-${Date.now()}.${fileExtension}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('media-thumbnails')
            .upload(tempFilePath, imageBuffer, {
              contentType,
              upsert: true,
            });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('media-thumbnails')
              .getPublicUrl(tempFilePath);
            thumbnailUrl = publicUrlData.publicUrl;
          }
        }
      } catch (error) {
        console.warn('Failed to process thumbnail:', error);
      }
    }

    // Add thumbnail to Notion properties if upload was successful
    if (notionFileUploadId && existingProperties.has('Thumbnail')) {
      const thumbnailProp = propertyMap['Thumbnail'] || 'Thumbnail';
      notionProperties[thumbnailProp] = createNotionFileProperty(notionFileUploadId);
    }

    // Determine icon based on category using Notion-compatible external icons
    // Movies/Series get movie icon, Books get empty bookmark (since new entries are "Not started")
    let pageIcon: { type: 'external'; external: { url: string } } | null = null;
    if (mediaData.category === 'Movie' || mediaData.category === 'Series') {
      // Use film/clapperboard icon from Iconify (Lucide icon set)
      pageIcon = { 
        type: 'external', 
        external: { url: 'https://api.iconify.design/lucide/clapperboard.svg' } 
      };
    } else if (mediaData.category === 'Book') {
      // New entries are "Not started" by default, so use empty bookmark
      pageIcon = { 
        type: 'external', 
        external: { url: 'https://api.iconify.design/lucide/bookmark.svg' } 
      };
    }

    // Create Notion page (with thumbnail and icon if available)
    let notionPage;
    try {
      const pageData: any = {
        parent: {
          database_id: MEDIA_DATABASE_ID,
        },
        properties: notionProperties,
      };
      
      // Add icon if determined
      if (pageIcon) {
        pageData.icon = pageIcon;
      }
      
      notionPage = await notion.pages.create(pageData);
    } catch (notionError: any) {
      // If property error, try without the problematic property
      if (notionError.code === 'object_invalid' || notionError.message?.includes('property')) {
        console.warn('Notion property error, retrying without Synopsys:', notionError.message);
        // Remove Synopsys property and retry
        const retryProperties = { ...notionProperties };
        const possibleNames = ['Synopsys', 'AI Synopsis', 'Synopsis', 'Description', 'AI Description'];
        for (const name of possibleNames) {
          const prop = propertyMap[name] || name;
          if (retryProperties[prop]) {
            delete retryProperties[prop];
            break;
          }
        }
        const retryPageData: any = {
          parent: {
            database_id: MEDIA_DATABASE_ID,
          },
          properties: retryProperties,
        };
        
        // Add icon if determined
        if (pageIcon) {
          retryPageData.icon = pageIcon;
        }
        
        notionPage = await notion.pages.create(retryPageData);
      } else {
        throw notionError;
      }
    }

    // Update Supabase Storage file path to use page ID if we used a temp path
    if (thumbnailUrl && mediaData.thumbnail) {
      try {
        // Extract the temp path from the URL
        const urlParts = thumbnailUrl.split('/');
        const tempFileName = urlParts[urlParts.length - 1];
        const tempFilePath = `${userId}/${tempFileName}`;
        
        // Download the file from temp location
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('media-thumbnails')
          .download(tempFilePath);
        
        if (!downloadError && fileData) {
          const fileExtension = tempFileName.split('.').pop() || 'jpg';
          const finalFilePath = `${userId}/${notionPage.id}.${fileExtension}`;
          
          // Upload to final location
          const arrayBuffer = await fileData.arrayBuffer();
          const contentType = `image/${fileExtension}`;
          
          const { error: moveError } = await supabase.storage
            .from('media-thumbnails')
            .upload(finalFilePath, arrayBuffer, {
              contentType,
              upsert: true,
            });
          
          if (!moveError) {
            // Delete temp file
            await supabase.storage
              .from('media-thumbnails')
              .remove([tempFilePath]);
            
            // Update thumbnailUrl to use final path
            const { data: finalUrlData } = supabase.storage
              .from('media-thumbnails')
              .getPublicUrl(finalFilePath);
            thumbnailUrl = finalUrlData.publicUrl;
          }
        }
      } catch (error) {
        console.warn('Failed to rename thumbnail file, using temp path:', error);
        // Continue with temp path - it still works
      }
    }

    // Create Supabase entry
    // Use Supabase Storage URL for thumbnail if available, otherwise use original URL
    const thumbnailUrlForEntry = thumbnailUrl || mediaData.thumbnail;
    const supabaseEntry = {
      user_id: userId,
      notion_page_id: notionPage.id,
      notion_database_id: MEDIA_DATABASE_ID,
      name: mediaData.name,
      category: mediaData.category || null,
      status: 'Not started',
      url: url,
      by: mediaData.by || null,
      topic: null,
      thumbnail: thumbnailUrlForEntry ? [{ type: 'external', external: { url: thumbnailUrlForEntry } }] : null,
      thumbnail_url: thumbnailUrl,
      ai_synopsis: mediaData.ai_synopsis || null,
      created: mediaData.created ? new Date(mediaData.created).toISOString() : null,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const { data: insertedMedia, error: supabaseError } = await supabase
      .from('media')
      .insert(supabaseEntry)
      .select()
      .single();

    if (supabaseError) {
      console.error('Error inserting into Supabase:', supabaseError);
      // Still return success since Notion entry was created
    }

    return NextResponse.json({
      success: true,
      media: insertedMedia || {
        ...supabaseEntry,
        id: notionPage.id,
      },
      notionPage,
    });
  } catch (error: any) {
    console.error('Error creating media from link:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create media entry' },
      { status: 500 }
    );
  }
}

