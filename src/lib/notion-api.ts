import { Client } from '@notionhq/client';

// Notion API version - using latest version that supports file uploads
export const NOTION_API_VERSION = '2022-06-28';
export const NOTION_API_BASE = 'https://api.notion.com/v1';

// Shared Notion client instance
export function getNotionClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error('NOTION_API_KEY environment variable is not set');
  }
  return new Client({ auth: apiKey });
}

/**
 * Uploads a file to Notion using the File Upload API
 * 
 * @param fileBuffer - The file contents as an ArrayBuffer
 * @param filename - The name of the file (with or without extension)
 * @param contentType - The MIME type of the file (e.g., 'image/jpeg', 'image/png')
 * @returns The file_upload ID if successful, null otherwise
 * 
 * @see https://developers.notion.com/reference/file-upload
 */
export async function uploadFileToNotion(
  fileBuffer: ArrayBuffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      throw new Error('NOTION_API_KEY not configured');
    }

    // Step 1: Create a file upload
    const createUploadResponse = await fetch(`${NOTION_API_BASE}/file_uploads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify({
        mode: 'single_part',
        filename: filename,
        content_type: contentType,
        content_length: fileBuffer.byteLength,
      }),
    });

    if (!createUploadResponse.ok) {
      const errorData = await createUploadResponse.json().catch(() => ({}));
      console.error('Failed to create Notion file upload:', errorData);
      return null;
    }

    const uploadData = await createUploadResponse.json();
    const fileUploadId = uploadData.id;

    if (!fileUploadId) {
      console.error('No file upload ID returned from Notion');
      return null;
    }

    // Step 2: Send the file contents using the Notion API send endpoint
    // Use native FormData if available (Node.js 18+), otherwise construct manually
    let sendFileResponse;
    
    if (typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
      // Modern Node.js with FormData support
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: contentType });
      formData.append('file', blob, filename);
      
      sendFileResponse = await fetch(`${NOTION_API_BASE}/file_uploads/${fileUploadId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': NOTION_API_VERSION,
        },
        body: formData,
      });
    } else {
      // Fallback: Construct multipart/form-data manually
      const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
      const buffer = Buffer.from(fileBuffer);
      
      const parts: (string | Buffer)[] = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        `Content-Type: ${contentType}`,
        '',
        buffer,
        `--${boundary}--`,
      ];
      
      const formDataBody = Buffer.concat(
        parts.flatMap((part, index) => {
          if (Buffer.isBuffer(part)) {
            return index === 0 ? [part] : [Buffer.from('\r\n'), part];
          }
          const str = part + (index < parts.length - 1 ? '\r\n' : '');
          return [Buffer.from(str)];
        })
      );
      
      sendFileResponse = await fetch(`${NOTION_API_BASE}/file_uploads/${fileUploadId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formDataBody,
      });
    }

    if (!sendFileResponse.ok) {
      console.error('Failed to send file to Notion:', sendFileResponse.status, sendFileResponse.statusText);
      return null;
    }

    // Step 3: Verify the upload is complete by checking status
    // For single-part uploads, status should be "uploaded" immediately after sending
    // For multi-part, we'd need to call the complete endpoint, but thumbnails are typically small
    let status = uploadData.status;
    let retries = 0;
    const maxRetries = 5;
    
    while (status !== 'uploaded' && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      
      const statusResponse = await fetch(`${NOTION_API_BASE}/file_uploads/${fileUploadId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': NOTION_API_VERSION,
        },
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        status = statusData.status;
        
        if (status === 'failed' || status === 'expired') {
          console.error('File upload failed or expired:', status);
          return null;
        }
      }
      
      retries++;
    }

    if (status !== 'uploaded') {
      console.error('File upload did not complete in time, status:', status);
      return null;
    }

    // Return the file_upload ID to use in the files property
    return fileUploadId;
  } catch (error) {
    console.error('Error uploading file to Notion:', error);
    return null;
  }
}

/**
 * Creates a Notion files property value using a file_upload ID
 * 
 * @param fileUploadId - The file_upload ID from uploadFileToNotion
 * @returns The files property value to use in Notion page properties
 */
export function createNotionFileProperty(fileUploadId: string) {
  return {
    files: [
      {
        type: 'file_upload' as const,
        file_upload: {
          id: fileUploadId,
        },
      },
    ],
  };
}

/**
 * Uploads an image from a URL to Notion
 * 
 * @param imageUrl - The URL of the image to download and upload
 * @param filename - Optional filename (defaults to 'image.jpg')
 * @returns The file_upload ID if successful, null otherwise
 */
export async function uploadImageUrlToNotion(
  imageUrl: string,
  filename?: string
): Promise<string | null> {
  try {
    // Download the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error('Failed to download image:', imageResponse.status, imageResponse.statusText);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Determine filename and extension
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() ||
                     (contentType.includes('jpeg') ? 'jpg' :
                      contentType.includes('png') ? 'png' :
                      contentType.includes('gif') ? 'gif' :
                      contentType.includes('webp') ? 'webp' : 'jpg');
    
    const finalFilename = filename || `image.${extension}`;

    // Upload to Notion
    return await uploadFileToNotion(imageBuffer, finalFilename, contentType);
  } catch (error) {
    console.error('Error uploading image URL to Notion:', error);
    return null;
  }
}

