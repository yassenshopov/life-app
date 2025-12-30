import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId } = await params;

    // Verify the asset belongs to the user
    const { data: asset, error: assetError } = await supabase
      .from('finances_assets')
      .select('id, icon_url')
      .eq('id', assetId)
      .eq('user_id', userId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // If no icon_url, return 404
    if (!asset.icon_url) {
      return NextResponse.json(
        { error: 'Icon not found' },
        { status: 404 }
      );
    }

    // Extract the file path from the Supabase Storage URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/finances-icons/[userId]/[assetId].[ext]
    const url = new URL(asset.icon_url);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/finances-icons\/(.+)$/);
    
    if (!pathMatch) {
      // If it's not a Supabase Storage URL, try to fetch it directly (for backwards compatibility)
      const imageResponse = await fetch(asset.icon_url, {
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
      .from('finances-icons')
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
}

