'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { AssetReference } from '@/types/document';

/**
 * Injects @font-face CSS rules for all font assets across all documents.
 * Ensures imported web fonts render correctly in the design canvas.
 */
export const FontLoader: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    // Collect all font assets from all documents
    const fontAssets: (AssetReference & { key: string })[] = [];
    for (const doc of documents) {
      if (!doc.assets) continue;
      for (const [key, asset] of Object.entries(doc.assets)) {
        if (asset.type === 'font' && !loadedRef.current.has(key)) {
          fontAssets.push({ ...asset, key });
        }
      }
    }

    if (fontAssets.length === 0) return;

    for (const asset of fontAssets) {
      const family = asset.originalUrl; // family name stored in originalUrl
      const weight = asset.fontWeight || '400';
      const style = asset.fontStyle || 'normal';
      const format = asset.fontFormat || 'font/woff2';
      const url = asset.proxyUrl;

      // Map MIME to CSS format() descriptor
      const cssFormat =
        format.includes('woff2') ? 'woff2' :
        format.includes('woff') ? 'woff' :
        format.includes('ttf') ? 'truetype' :
        format.includes('otf') ? 'opentype' :
        'woff2';

      try {
        const fontFace = new FontFace(family, `url(${url})`, {
          weight,
          style,
          display: 'swap',
        });

        fontFace.load().then((loaded) => {
          document.fonts.add(loaded);
          loadedRef.current.add(asset.key);
        }).catch((err) => {
          console.warn(`Failed to load font ${family} ${weight}: ${err.message}`);

          // Fallback: inject via style element
          const styleEl = document.createElement('style');
          styleEl.textContent = `
            @font-face {
              font-family: '${family}';
              src: url('${url}') format('${cssFormat}');
              font-weight: ${weight};
              font-style: ${style};
              font-display: swap;
            }
          `;
          document.head.appendChild(styleEl);
          loadedRef.current.add(asset.key);
        });
      } catch {
        // Final fallback for environments without FontFace API
        const styleEl = document.createElement('style');
        styleEl.textContent = `
          @font-face {
            font-family: '${family}';
            src: url('${url}') format('${cssFormat}');
            font-weight: ${weight};
            font-style: ${style};
            font-display: swap;
          }
        `;
        document.head.appendChild(styleEl);
        loadedRef.current.add(asset.key);
      }
    }
  }, [documents]);

  return null;
};
