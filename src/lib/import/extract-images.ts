import { connectDB } from '@/lib/db/connection';
import { Image } from '@/lib/db/models/image';
import { readFile } from 'fs/promises';

export interface ImageInfo {
  /** Original URL (absolute http/https or file://) */
  url: string;
  /** Filename extracted from URL path */
  filename: string;
}

export interface StoredImage {
  id: string;
  originalUrl: string;
  filename: string;
  contentType: string;
  serveUrl: string;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
};

function guessContentType(url: string, responseType?: string): string {
  if (responseType && responseType.startsWith('image/')) return responseType;
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPE_MAP[ext] || 'image/png';
}

function extractFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop() || '';
  } catch {
    return url.split('/').pop()?.split('?')[0] || '';
  }
}

/**
 * Download images and store them in MongoDB.
 * Returns metadata for each stored image (skips duplicates).
 * Supports both http/https URLs and file:// paths.
 */
export async function downloadAndStoreImages(
  images: ImageInfo[],
  sourceUrl: string,
  onProgress?: (msg: string) => void,
): Promise<StoredImage[]> {
  if (images.length === 0) return [];

  await connectDB();
  const results: StoredImage[] = [];

  for (const img of images) {
    try {
      // Check if already stored (by originalUrl)
      const existing = await Image.findOne({ originalUrl: img.url }).select('_id contentType filename');
      if (existing) {
        results.push({
          id: existing._id.toString(),
          originalUrl: img.url,
          filename: existing.filename,
          contentType: existing.contentType,
          serveUrl: `/api/images/${existing._id}`,
        });
        continue;
      }

      onProgress?.(`Storing image: ${img.filename}`);

      let buffer: Buffer;
      let contentType: string;

      if (img.url.startsWith('file://')) {
        // Local file (ZIP import)
        const filePath = decodeURIComponent(img.url.replace('file://', ''));
        buffer = await readFile(filePath);
        contentType = guessContentType(img.url);
      } else {
        // Remote URL
        const res = await fetch(img.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;
        contentType = guessContentType(img.url, res.headers.get('content-type') || undefined);
        buffer = Buffer.from(await res.arrayBuffer());
      }

      if (buffer.length === 0) continue;

      const filename = img.filename || extractFilename(img.url);

      const doc = await Image.create({
        originalUrl: img.url,
        sourceUrl,
        contentType,
        filename,
        data: buffer,
        size: buffer.length,
      });

      results.push({
        id: doc._id.toString(),
        originalUrl: img.url,
        filename: doc.filename,
        contentType: doc.contentType,
        serveUrl: `/api/images/${doc._id}`,
      });
    } catch (err) {
      console.warn(`Failed to store image ${img.filename}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return results;
}
