import { connectDB } from '@/lib/db/connection';
import { Font } from '@/lib/db/models/font';

export interface FontFaceInfo {
  family: string;
  weight: string;
  style: string;
  url: string;
  format: string;
}

export interface StoredFont {
  id: string;
  family: string;
  weight: string;
  style: string;
  format: string;
  serveUrl: string;
}

const FORMAT_MAP: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

function guessFormat(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
  return FORMAT_MAP[ext] || 'font/woff2';
}

/**
 * Download font files and save them to MongoDB.
 * Returns metadata for each stored font (skips duplicates).
 */
export async function downloadAndStoreFonts(
  fonts: FontFaceInfo[],
  sourceUrl: string,
  onProgress?: (msg: string) => void,
): Promise<StoredFont[]> {
  if (fonts.length === 0) return [];

  await connectDB();
  const results: StoredFont[] = [];

  for (const font of fonts) {
    try {
      // Check if already stored (by originalUrl)
      const existing = await Font.findOne({ originalUrl: font.url }).select('_id family weight style format');
      if (existing) {
        results.push({
          id: existing._id.toString(),
          family: existing.family,
          weight: existing.weight,
          style: existing.style,
          format: existing.format,
          serveUrl: `/api/fonts/${existing._id}`,
        });
        continue;
      }

      onProgress?.(`Downloading font: ${font.family} ${font.weight}`);

      // Download font binary
      const res = await fetch(font.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) continue;

      const format = font.format || guessFormat(font.url);

      const doc = await Font.create({
        family: font.family,
        weight: font.weight,
        style: font.style,
        format,
        originalUrl: font.url,
        sourceUrl,
        data: buffer,
      });

      results.push({
        id: doc._id.toString(),
        family: doc.family,
        weight: doc.weight,
        style: doc.style,
        format: doc.format,
        serveUrl: `/api/fonts/${doc._id}`,
      });
    } catch (err) {
      // Skip individual font failures
      console.warn(`Failed to download font ${font.family}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return results;
}
