import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

interface IconRouteConfig {
  tableName: string;
  bucketName: string;
  idParamName: string;
}

/**
 * Creates a GET handler for serving icons from Supabase Storage or external URLs.
 * Handles authentication, database lookup, URL extraction, storage download or external fetch,
 * content-type mapping, and response building.
 */
export function createIconRouteHandler(config: IconRouteConfig) {
  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<Record<string, string>> }
  ) {
    try {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const resolvedParams = await params;
      const id = resolvedParams[config.idParamName];

      if (!id) {
        return NextResponse.json(
          { error: `${config.idParamName} is required` },
          { status: 400 }
        );
      }

      // Verify the record belongs to the user
      const { data: record, error: recordError } = await supabase
        .from(config.tableName)
        .select('id, icon_url')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (recordError || !record) {
        return NextResponse.json(
          { error: 'Record not found' },
          { status: 404 }
        );
      }

      // If no icon_url, return 404
      if (!record.icon_url) {
        return NextResponse.json(
          { error: 'Icon not found' },
          { status: 404 }
        );
      }

      // Extract the file path from the Supabase Storage URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/[bucketName]/[userId]/[id].[ext]
      const url = new URL(record.icon_url);
      const pathMatch = url.pathname.match(
        new RegExp(`/storage/v1/object/public/${config.bucketName}/(.+)$`)
      );

      if (!pathMatch) {
        // If it's not a Supabase Storage URL, try to fetch it directly (for backwards compatibility)
        const imageResponse = await fetch(record.icon_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!imageResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch icon' },
            { status: 404 }
          );
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';

        return new NextResponse(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      const filePath = pathMatch[1];

      // Download from Supabase Storage
      const { data, error } = await supabase.storage
        .from(config.bucketName)
        .download(filePath);

      if (error || !data) {
        console.error('Error downloading icon from storage:', error);
        return NextResponse.json(
          { error: 'Failed to fetch icon from storage' },
          { status: 404 }
        );
      }

      // Convert blob to buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine content type from file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
      };
      const contentType = contentTypeMap[extension || ''] || 'image/png';

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error: any) {
      console.error('Error serving icon:', error);
      return NextResponse.json(
        { error: 'Failed to serve icon' },
        { status: 500 }
      );
    }
  };
}

