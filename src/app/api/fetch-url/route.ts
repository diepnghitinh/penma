import { NextRequest, NextResponse } from 'next/server';
import { scrapePage } from '@/lib/import/scrape-page';
import { buildPenmaDocument } from '@/lib/import/build-penma-tree';
import { downloadAndStoreFonts } from '@/lib/import/extract-fonts';
import { storeImportedCss } from '@/lib/import/store-css';
import type { AssetReference } from '@/types/document';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, viewport, stream: useStream } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json(
      { success: false, error: 'URL is required' },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid URL. Must start with http:// or https://' },
      { status: 400 }
    );
  }

  const viewportWidth = viewport?.width || 1440;
  const viewportHeight = viewport?.height || 900;

  if (useStream) {
    return streamImport(parsedUrl, viewportWidth, viewportHeight);
  }

  // ── Non-streaming import ────────────────────────────────────

  try {
    const { tree: serializedTree, fonts: extractedFonts, cssRules } = await scrapePage({
      url: parsedUrl,
      viewportWidth,
      viewportHeight,
    });

    const doc = buildPenmaDocument(
      serializedTree,
      parsedUrl.toString(),
      { width: viewportWidth, height: viewportHeight },
      cssRules,
    );

    // Store CSS rules in MongoDB
    storeImportedCss(parsedUrl.toString(), cssRules).catch(() => {});

    // Download and store fonts in MongoDB
    const storedFonts = await downloadAndStoreFonts(extractedFonts, parsedUrl.toString());
    const assets: Record<string, AssetReference> = {};
    for (const sf of storedFonts) {
      assets[`font-${sf.id}`] = {
        originalUrl: sf.family,
        proxyUrl: sf.serveUrl,
        type: 'font',
        fontWeight: sf.weight,
        fontStyle: sf.style,
        fontFormat: sf.format,
      };
    }
    doc.assets = assets;

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import error:', message);
    return NextResponse.json(
      { success: false, error: `Failed to import page: ${message}` },
      { status: 500 }
    );
  }
}

// ── SSE Streaming import with real progress ─────────────────

function streamImport(parsedUrl: URL, viewportWidth: number, viewportHeight: number) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const { tree: serializedTree, fonts: extractedFonts, cssRules } = await scrapePage({
          url: parsedUrl,
          viewportWidth,
          viewportHeight,
          onProgress: (percent, step) => send('progress', { percent, step }),
        });

        send('progress', { percent: 82, step: 'Processing nodes...' });
        send('progress', { percent: 85, step: 'Detecting layouts...' });

        const doc = buildPenmaDocument(
          serializedTree,
          parsedUrl.toString(),
          { width: viewportWidth, height: viewportHeight },
          cssRules,
        );

        // Store CSS rules in MongoDB
        storeImportedCss(parsedUrl.toString(), cssRules).catch(() => {});

        // Download and store fonts in MongoDB
        if (extractedFonts.length > 0) {
          send('progress', { percent: 88, step: `Downloading ${extractedFonts.length} fonts...` });
          const storedFonts = await downloadAndStoreFonts(
            extractedFonts,
            parsedUrl.toString(),
            (msg) => send('progress', { percent: 90, step: msg }),
          );
          const assets: Record<string, AssetReference> = {};
          for (const sf of storedFonts) {
            assets[`font-${sf.id}`] = {
              originalUrl: sf.family,
              proxyUrl: sf.serveUrl,
              type: 'font',
            };
          }
          doc.assets = assets;
        }

        send('progress', { percent: 95, step: 'Finalizing...' });
        send('progress', { percent: 100, step: 'Done!' });

        // Send document in chunks for reliable SSE delivery
        const docJson = JSON.stringify(doc);
        const CHUNK_SIZE = 32000;
        const totalChunks = Math.ceil(docJson.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = docJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          send('chunk', { index: i, total: totalChunks, data: chunk });
        }
        send('done', { success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        send('error', { error: `Failed to import page: ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
