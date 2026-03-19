import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { v4 as uuid } from 'uuid';
import type { PenmaDocument, PenmaNode, AutoLayout } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';

const MAX_NODES = 8000;
const TIMEOUT = 20000;

export async function POST(request: NextRequest) {
  let browser;
  try {
    const body = await request.json();
    const { url, viewport } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
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

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: viewportWidth, height: viewportHeight });

    // Set a reasonable user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(parsedUrl.toString(), {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT,
    });

    // Wait a bit for any remaining JS rendering
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1000)));

    // Extract the DOM tree with computed styles
    const baseUrl = parsedUrl.origin;
    const proxyBase = '/api/proxy-asset?url=';

    const serializedTree = await page.evaluate(
      (opts: { maxNodes: number; baseUrl: string; proxyBase: string; pageUrl: string }) => {
        let nodeCount = 0;

        function resolveUrl(rawUrl: string): string {
          if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
          try {
            const absolute = new URL(rawUrl, opts.pageUrl).toString();
            return opts.proxyBase + encodeURIComponent(absolute);
          } catch {
            return rawUrl;
          }
        }

        function rewriteCssUrls(css: string): string {
          return css.replace(/url\(["']?((?!data:)[^"')]+)["']?\)/g, (match, rawUrl) => {
            const resolved = resolveUrl(rawUrl);
            return `url("${resolved}")`;
          });
        }

        function serializeNode(element: Element): SerializedNode | null {
          if (nodeCount >= opts.maxNodes) return null;
          nodeCount++;

          const tagName = element.tagName.toLowerCase();

          // Skip non-visual elements
          if (['script', 'noscript', 'link', 'meta', 'style'].includes(tagName)) {
            return null;
          }

          const rect = element.getBoundingClientRect();
          const computed = window.getComputedStyle(element);

          // Skip invisible elements (except body/html and svg — svgs may report 0x0 via gBCR)
          if (
            !['html', 'body', 'svg'].includes(tagName) &&
            (computed.display === 'none' ||
              (rect.width === 0 && rect.height === 0))
          ) {
            return null;
          }

          // Extract relevant computed styles
          const styleProps = [
            'display', 'position', 'top', 'right', 'bottom', 'left',
            'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
            'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'flex-direction', 'justify-content', 'align-items', 'align-self', 'gap', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
            'grid-template-columns', 'grid-template-rows',
            'font-family', 'font-size', 'font-weight', 'line-height',
            'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'color',
            'background-color', 'background-image', 'background-size',
            'background-position', 'background-repeat',
            'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
            'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
            'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
            'border-top-left-radius', 'border-top-right-radius',
            'border-bottom-right-radius', 'border-bottom-left-radius',
            'opacity', 'box-shadow', 'overflow', 'overflow-x', 'overflow-y',
            'z-index', 'transform', 'transition',
            'white-space', 'word-break', 'text-overflow',
            'list-style-type', 'list-style-position',
            'cursor', 'visibility',
          ];

          const styles: Record<string, string> = {};
          for (const prop of styleProps) {
            const val = computed.getPropertyValue(prop);
            if (val) styles[prop] = val;
          }

          // Rewrite background-image urls
          if (styles['background-image'] && styles['background-image'] !== 'none') {
            styles['background-image'] = rewriteCssUrls(styles['background-image']);
          }

          // Extract attributes
          const attrs: Record<string, string> = {};
          for (const attr of Array.from(element.attributes)) {
            if (['style', 'class', 'id', 'onclick', 'onload', 'onerror'].includes(attr.name)) continue;
            let val = attr.value;
            // Rewrite src/href attributes
            if (['src', 'href', 'poster', 'data-src'].includes(attr.name) && val) {
              val = resolveUrl(val);
            }
            attrs[attr.name] = val;
          }

          // ── Opaque elements: capture as raw HTML ──
          // SVGs, picture, canvas, and video are kept as raw HTML blobs
          // so icons, illustrations, and media render faithfully.
          const OPAQUE_TAGS = ['svg', 'canvas', 'video', 'picture'];
          let rawHtml: string | undefined;
          if (OPAQUE_TAGS.includes(tagName)) {
            let html = element.outerHTML;
            // Rewrite any URLs inside the raw HTML
            html = html.replace(/(src|href|xlink:href|poster)="([^"]*)"/g, (_m, attr, url) => {
              if (!url || url.startsWith('data:') || url.startsWith('blob:')) return `${attr}="${url}"`;
              return `${attr}="${resolveUrl(url)}"`;
            });
            html = rewriteCssUrls(html);
            rawHtml = html;
          }

          // Get text content and serialize children
          let textContent: string | undefined;
          const children: SerializedNode[] = [];

          if (!rawHtml) {
            const childNodes = Array.from(element.childNodes);
            const hasElementChildren = element.children.length > 0;
            const textNodes = childNodes.filter(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
            );

            if (textNodes.length > 0 && !hasElementChildren) {
              // Pure text node — store directly
              textContent = element.textContent?.trim();
            } else {
              // Mixed content: serialize element children AND create text pseudo-nodes
              // so text like "내 캠페인" next to <svg> icons is preserved
              for (const childNode of childNodes) {
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                  const serialized = serializeNode(childNode as Element);
                  if (serialized) children.push(serialized);
                } else if (childNode.nodeType === Node.TEXT_NODE) {
                  const text = childNode.textContent?.trim();
                  if (text) {
                    nodeCount++;
                    children.push({
                      tagName: 'span',
                      attributes: {},
                      children: [],
                      textContent: text,
                      styles: {},
                      bounds: { x: 0, y: 0, width: 0, height: 0 },
                      name: `"${text.slice(0, 20)}"`,
                    });
                  }
                }
              }
            }
          }

          // Generate a readable name
          let name = tagName;
          if (element.id) name = `#${element.id}`;
          else if (element.className && typeof element.className === 'string') {
            const firstClass = element.className.split(' ')[0];
            if (firstClass) name = `.${firstClass}`;
          }

          return {
            tagName,
            attributes: attrs,
            children,
            textContent,
            rawHtml,
            styles,
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            name,
          };
        }

        interface SerializedNode {
          tagName: string;
          attributes: Record<string, string>;
          children: SerializedNode[];
          textContent?: string;
          rawHtml?: string;
          styles: Record<string, string>;
          bounds: { x: number; y: number; width: number; height: number };
          name: string;
        }

        const root = document.body;
        if (!root) return null;

        return serializeNode(root);
      },
      { maxNodes: MAX_NODES, baseUrl, proxyBase, pageUrl: parsedUrl.toString() }
    );

    await browser.close();
    browser = undefined;

    if (!serializedTree) {
      return NextResponse.json(
        { success: false, error: 'Failed to extract page content' },
        { status: 500 }
      );
    }

    // ── Helpers for mapping CSS values to our enums ──
    const mapJustify = (v: string) => {
      if (v === 'center') return 'center' as const;
      if (v === 'flex-end' || v === 'end') return 'end' as const;
      if (v === 'space-between') return 'space-between' as const;
      return 'start' as const;
    };
    const mapAlign = (v: string) => {
      if (v === 'center') return 'center' as const;
      if (v === 'flex-end' || v === 'end') return 'end' as const;
      if (v === 'stretch') return 'stretch' as const;
      if (v === 'baseline') return 'baseline' as const;
      return 'start' as const;
    };

    // Detect auto layout from a node's computed styles
    function detectAutoLayout(styles: Record<string, string>): AutoLayout | undefined {
      const display = styles['display'] || '';
      if (display !== 'flex' && display !== 'inline-flex') return undefined;

      const flexDir = styles['flex-direction'] || 'row';
      const gap = parseFloat(styles['gap'] || '0') || 0;
      const pt = parseFloat(styles['padding-top'] || '0') || 0;
      const pr = parseFloat(styles['padding-right'] || '0') || 0;
      const pb = parseFloat(styles['padding-bottom'] || '0') || 0;
      const pl = parseFloat(styles['padding-left'] || '0') || 0;
      const justify = styles['justify-content'] || '';
      const align = styles['align-items'] || '';
      const wrap = styles['flex-wrap'] || '';

      let direction: 'horizontal' | 'vertical' | 'wrap' = 'horizontal';
      if (wrap === 'wrap') direction = 'wrap';
      else if (flexDir === 'column' || flexDir === 'column-reverse') direction = 'vertical';

      return {
        ...DEFAULT_AUTO_LAYOUT,
        direction,
        gap,
        padding: { top: pt, right: pr, bottom: pb, left: pl },
        independentPadding: !(pt === pr && pr === pb && pb === pl),
        primaryAxisAlign: mapJustify(justify),
        counterAxisAlign: mapAlign(align),
        reverse: flexDir === 'row-reverse' || flexDir === 'column-reverse',
      };
    }

    // Detect child sizing from computed styles + parent context
    function detectChildSizing(
      childStyles: Record<string, string>,
      parentAutoLayout: AutoLayout | undefined
    ): import('@/types/document').SizingMode {
      if (!parentAutoLayout) return { ...DEFAULT_SIZING };

      const isParentHoriz = parentAutoLayout.direction === 'horizontal' || parentAutoLayout.direction === 'wrap';
      const flexGrow = parseFloat(childStyles['flex-grow'] || '0') || 0;
      const flexShrink = parseFloat(childStyles['flex-shrink'] || '1');
      const flexBasis = childStyles['flex-basis'] || 'auto';
      const alignSelf = childStyles['align-self'] || '';
      const width = childStyles['width'] || 'auto';
      const height = childStyles['height'] || 'auto';

      let horizontal: 'fixed' | 'hug' | 'fill' = 'hug';
      let vertical: 'fixed' | 'hug' | 'fill' = 'hug';

      if (isParentHoriz) {
        // Primary axis = horizontal
        if (flexGrow > 0) {
          horizontal = 'fill';
        } else if (width !== 'auto' && !width.includes('%')) {
          horizontal = 'fixed';
        }
        // Counter axis = vertical
        if (alignSelf === 'stretch' || parentAutoLayout.counterAxisAlign === 'stretch') {
          vertical = 'fill';
        } else if (height !== 'auto' && !height.includes('%')) {
          vertical = 'fixed';
        }
      } else {
        // Primary axis = vertical
        if (flexGrow > 0) {
          vertical = 'fill';
        } else if (height !== 'auto' && !height.includes('%')) {
          vertical = 'fixed';
        }
        // Counter axis = horizontal
        if (alignSelf === 'stretch' || parentAutoLayout.counterAxisAlign === 'stretch') {
          horizontal = 'fill';
        } else if (width !== 'auto' && !width.includes('%')) {
          horizontal = 'fixed';
        }
      }

      // space-between: children that take up remaining space along the
      // primary axis should be 'fill' so editing the layout keeps the
      // distribution correct.  A common pattern is all children having
      // flex-grow:0 but the browser distributes the leftover space as
      // gaps.  Detect percentage-based or 100%-wide children as 'fill'.
      if (parentAutoLayout.primaryAxisAlign === 'space-between') {
        if (isParentHoriz) {
          if (width.includes('%') || width === '100%') horizontal = 'fill';
        } else {
          if (height.includes('%') || height === '100%') vertical = 'fill';
        }
      }

      return { horizontal, vertical };
    }

    // Assign UUIDs to nodes and auto-detect flex layouts
    function assignIds(
      node: typeof serializedTree,
      parentAutoLayout?: AutoLayout
    ): PenmaNode {
      if (!node) throw new Error('Node is null');

      const autoLayout = detectAutoLayout(node.styles);
      const sizing = parentAutoLayout
        ? detectChildSizing(node.styles, parentAutoLayout)
        : autoLayout
          ? { ...DEFAULT_SIZING }
          : undefined;

      return {
        id: uuid(),
        tagName: node.tagName,
        attributes: node.attributes,
        children: node.children.map((child) => assignIds(child, autoLayout)),
        textContent: node.textContent,
        rawHtml: node.rawHtml,
        styles: {
          computed: node.styles,
          overrides: {},
        },
        bounds: node.bounds,
        visible: true,
        locked: false,
        name: node.name,
        autoLayout,
        sizing,
      };
    }

    const rootNode = assignIds(serializedTree);

    const doc: PenmaDocument = {
      id: uuid(),
      sourceUrl: parsedUrl.toString(),
      importedAt: new Date().toISOString(),
      viewport: { width: viewportWidth, height: viewportHeight },
      rootNode,
      assets: {},
    };

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import error:', message);
    return NextResponse.json(
      { success: false, error: `Failed to import page: ${message}` },
      { status: 500 }
    );
  }
}
