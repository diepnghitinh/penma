import type { PenmaNode, PenmaDocument, AssetReference } from '@/types/document';
import { downloadAndStoreImages, type ImageInfo } from './extract-images';

const PROXY_PREFIX = '/api/proxy-asset?url=';
const IMAGE_EXTENSIONS = /\.(svg|png|jpg|jpeg|gif|webp|avif|ico|bmp)([?#]|$)/i;

/**
 * Resolve a proxied URL back to its original URL.
 * e.g. "/api/proxy-asset?url=https%3A%2F%2F..." → "https://..."
 */
function unproxyUrl(url: string): string {
  if (url.startsWith(PROXY_PREFIX)) {
    return decodeURIComponent(url.slice(PROXY_PREFIX.length));
  }
  return url;
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
 * Collect all image URLs from a PenmaNode tree.
 * Returns deduplicated list of image URLs (unpoxied to original).
 */
function collectImageUrls(node: PenmaNode): ImageInfo[] {
  const seen = new Set<string>();
  const images: ImageInfo[] = [];

  function walk(n: PenmaNode) {
    // img src
    if (n.tagName === 'img' && n.attributes.src) {
      const original = unproxyUrl(n.attributes.src);
      if (!original.startsWith('data:') && !seen.has(original)) {
        seen.add(original);
        images.push({ url: original, filename: extractFilename(original) });
      }
    }

    // Any element with background-image url()
    const bgImage = n.styles?.computed?.['background-image'] || n.styles?.overrides?.['background-image'];
    if (bgImage && bgImage !== 'none') {
      const urlMatches = bgImage.matchAll(/url\(["']?((?!data:)[^"')]+)["']?\)/g);
      for (const m of urlMatches) {
        const original = unproxyUrl(m[1]);
        if (IMAGE_EXTENSIONS.test(original) && !seen.has(original)) {
          seen.add(original);
          images.push({ url: original, filename: extractFilename(original) });
        }
      }
    }

    // rawHtml may contain image references (SVG etc) — extract src/href
    if (n.rawHtml) {
      const srcMatches = n.rawHtml.matchAll(/(?:src|href)="([^"]*)"/g);
      for (const m of srcMatches) {
        const original = unproxyUrl(m[1]);
        if (!original.startsWith('data:') && IMAGE_EXTENSIONS.test(original) && !seen.has(original)) {
          seen.add(original);
          images.push({ url: original, filename: extractFilename(original) });
        }
      }
    }

    for (const child of n.children) {
      walk(child);
    }
  }

  walk(node);
  return images;
}

/**
 * Rewrite image URLs in a PenmaNode tree from proxy/original URLs to /api/images/[id].
 */
function rewriteImageUrls(node: PenmaNode, urlMap: Map<string, string>) {
  // img src
  if (node.tagName === 'img' && node.attributes.src) {
    const original = unproxyUrl(node.attributes.src);
    const serveUrl = urlMap.get(original);
    if (serveUrl) {
      node.attributes.src = serveUrl;
    }
  }

  // background-image
  for (const styleObj of [node.styles?.computed, node.styles?.overrides]) {
    if (styleObj?.['background-image'] && styleObj['background-image'] !== 'none') {
      styleObj['background-image'] = styleObj['background-image'].replace(
        /url\(["']?((?!data:)[^"')]+)["']?\)/g,
        (_match, rawUrl) => {
          const original = unproxyUrl(rawUrl);
          const serveUrl = urlMap.get(original);
          return serveUrl ? `url("${serveUrl}")` : _match;
        }
      );
    }
  }

  // rawHtml
  if (node.rawHtml) {
    node.rawHtml = node.rawHtml.replace(
      /(src|href)="([^"]*)"/g,
      (match, attr, rawUrl) => {
        const original = unproxyUrl(rawUrl);
        const serveUrl = urlMap.get(original);
        return serveUrl ? `${attr}="${serveUrl}"` : match;
      }
    );
  }

  for (const child of node.children) {
    rewriteImageUrls(child, urlMap);
  }
}

/**
 * Process all images in a document: collect, download, store, rewrite URLs.
 * Returns image asset references for the document.
 */
export async function processDocumentImages(
  doc: PenmaDocument,
  onProgress?: (msg: string) => void,
): Promise<Record<string, AssetReference>> {
  const imageInfos = collectImageUrls(doc.rootNode);
  if (imageInfos.length === 0) return {};

  onProgress?.(`Found ${imageInfos.length} images, storing...`);

  const storedImages = await downloadAndStoreImages(imageInfos, doc.sourceUrl, onProgress);

  // Build URL rewrite map: original URL → /api/images/[id]
  const urlMap = new Map<string, string>();
  const assets: Record<string, AssetReference> = {};

  for (const si of storedImages) {
    urlMap.set(si.originalUrl, si.serveUrl);
    assets[`image-${si.id}`] = {
      originalUrl: si.originalUrl,
      proxyUrl: si.serveUrl,
      type: 'image',
    };
  }

  // Rewrite all image URLs in the tree
  rewriteImageUrls(doc.rootNode, urlMap);

  onProgress?.(`Stored ${storedImages.length} images`);

  return assets;
}
