import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { scrapePage } from '@/lib/import/scrape-page';
import { buildPenmaDocument } from '@/lib/import/build-penma-tree';
import { downloadAndStoreFonts } from '@/lib/import/extract-fonts';
import { storeImportedCss } from '@/lib/import/store-css';
import type { AssetReference, PenmaDocument } from '@/types/document';
import { importBlacklist } from '@/configs/editor';

const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB
const HTML_EXTENSIONS = ['.html', '.htm'];

function isHtmlFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return HTML_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isBlacklisted(path: string): boolean {
  const parts = path.split('/');
  return parts.some((part) =>
    importBlacklist.some((b) => part.toLowerCase() === b.toLowerCase()),
  );
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      let tempDir = '';

      try {
        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const viewportWidth = parseInt(formData.get('viewportWidth') as string) || 1440;
        const viewportHeight = parseInt(formData.get('viewportHeight') as string) || 900;

        if (!file) {
          send('error', { error: 'No file uploaded' });
          controller.close();
          return;
        }

        if (file.size > MAX_ZIP_SIZE) {
          send('error', { error: 'ZIP file too large (max 100MB)' });
          controller.close();
          return;
        }

        send('progress', { percent: 5, step: 'Reading ZIP file...' });

        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Find all HTML files in the ZIP, skipping blacklisted paths
        const htmlEntries: { path: string; file: JSZip.JSZipObject }[] = [];
        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir && isHtmlFile(relativePath) && !isBlacklisted(relativePath)) {
            htmlEntries.push({ path: relativePath, file: zipEntry });
          }
        });

        if (htmlEntries.length === 0) {
          send('error', { error: 'No HTML files found in the ZIP archive' });
          controller.close();
          return;
        }

        send('progress', {
          percent: 10,
          step: `Found ${htmlEntries.length} HTML file${htmlEntries.length > 1 ? 's' : ''}`,
        });

        // Extract entire ZIP to a temp directory so relative assets (CSS, images) work
        tempDir = join(tmpdir(), `penma-zip-${randomUUID()}`);
        await mkdir(tempDir, { recursive: true });

        send('progress', { percent: 15, step: 'Extracting files...' });

        const allFiles = Object.entries(zip.files).filter(([path, entry]) => !entry.dir && !isBlacklisted(path));
        for (const [relativePath, entry] of allFiles) {
          const filePath = join(tempDir, relativePath);
          const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
          await mkdir(dirPath, { recursive: true });
          const content = await entry.async('nodebuffer');
          await writeFile(filePath, content);
        }

        send('progress', { percent: 20, step: 'Files extracted. Starting import...' });

        // Process each HTML file with Puppeteer
        const documents: PenmaDocument[] = [];
        const totalFiles = htmlEntries.length;

        for (let i = 0; i < totalFiles; i++) {
          const entry = htmlEntries[i];
          const fileName = entry.path.split('/').pop() || entry.path;
          const progressBase = 20 + (i / totalFiles) * 70; // 20-90% range

          send('progress', {
            percent: Math.round(progressBase),
            step: `Importing ${fileName} (${i + 1}/${totalFiles})...`,
          });

          try {
            const filePath = join(tempDir, entry.path);
            const fileUrl = new URL(`file://${filePath}`);

            const { tree: serializedTree, fonts: extractedFonts, cssRules } = await scrapePage({
              url: fileUrl,
              viewportWidth,
              viewportHeight,
              onProgress: (percent, step) => {
                // Map scrape progress (5-80%) into this file's portion
                const mapped = progressBase + (percent / 100) * (70 / totalFiles);
                send('progress', { percent: Math.round(mapped), step: `[${fileName}] ${step}` });
              },
            });

            const doc = buildPenmaDocument(
              serializedTree,
              `zip://${entry.path}`,
              { width: viewportWidth, height: viewportHeight },
              cssRules,
            );

            // Store CSS rules in MongoDB
            storeImportedCss(`zip://${entry.path}`, cssRules).catch(() => {});

            // Handle fonts
            if (extractedFonts.length > 0) {
              const storedFonts = await downloadAndStoreFonts(
                extractedFonts,
                `zip://${entry.path}`,
              );
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
            }

            // Use the filename as the frame name
            if (doc.rootNode) {
              doc.rootNode.name = fileName.replace(/\.(html|htm)$/i, '');
            }

            documents.push(doc);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            send('progress', {
              percent: Math.round(progressBase + 70 / totalFiles),
              step: `Skipped ${fileName}: ${msg}`,
            });
          }
        }

        if (documents.length === 0) {
          send('error', { error: 'Failed to import any HTML files from the ZIP' });
          controller.close();
          return;
        }

        send('progress', { percent: 95, step: 'Finalizing...' });

        // Send documents in chunks
        const docsJson = JSON.stringify(documents);
        const CHUNK_SIZE = 32000;
        const totalChunks = Math.ceil(docsJson.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = docsJson.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          send('chunk', { index: i, total: totalChunks, data: chunk });
        }

        send('progress', { percent: 100, step: 'Done!' });
        send('done', { success: true, count: documents.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('ZIP import error:', message);
        send('error', { error: `Failed to import ZIP: ${message}` });
      } finally {
        // Clean up temp directory
        if (tempDir) {
          rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
