import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_CONTENT_TYPES = [
  'image/',
  'font/',
  'application/font',
  'application/x-font',
  'text/css',
  'application/javascript',
  'application/octet-stream',
];

// Simple in-memory cache
const cache = new Map<string, { data: Uint8Array; contentType: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
  // Evict oldest if still too large
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < oldest.length - MAX_CACHE_SIZE; i++) {
      cache.delete(oldest[i][0]);
    }
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const decoded = decodeURIComponent(url);
    const parsed = new URL(decoded);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(decoded);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new NextResponse(cached.data as unknown as BodyInit, {
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch asset: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Verify content type is safe to proxy
    const isAllowed = ALLOWED_CONTENT_TYPES.some((type) => contentType.startsWith(type));
    if (!isAllowed) {
      // Allow it anyway but log
      console.warn(`Proxying unexpected content type: ${contentType} for ${decoded}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());

    // Cache the response
    cache.set(decoded, { data, contentType, timestamp: Date.now() });
    cleanCache();

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Proxy error: ${message}` },
      { status: 500 }
    );
  }
}
