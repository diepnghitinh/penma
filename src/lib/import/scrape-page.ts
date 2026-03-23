import puppeteer from 'puppeteer';
import type { SerializedNode } from './build-penma-tree';

const MAX_NODES = 8000;
const TIMEOUT = 20000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export { MAX_NODES, TIMEOUT };

// ── CSS properties extracted from the browser ───────────────

const STYLE_PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex-direction', 'justify-content', 'align-items', 'align-self', 'gap', 'row-gap', 'column-gap', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'grid-template-columns', 'grid-template-rows',
  'font-family', 'font-size', 'font-weight', 'line-height',
  'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'color',
  'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'opacity', 'box-shadow', 'overflow', 'overflow-x', 'overflow-y',
  'z-index', 'transform', 'transition', 'white-space', 'word-break', 'text-overflow',
  'list-style-type', 'list-style-position', 'cursor', 'visibility',
];

// ── Launch browser, navigate, extract DOM ───────────────────

export interface ScrapeOptions {
  url: URL;
  viewportWidth: number;
  viewportHeight: number;
  onProgress?: (percent: number, step: string) => void;
}

export async function scrapePage(opts: ScrapeOptions): Promise<SerializedNode> {
  const { url, viewportWidth, viewportHeight, onProgress } = opts;
  const progress = onProgress ?? (() => {});

  progress(5, 'Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    progress(10, 'Browser ready');
    progress(15, 'Navigating to page...');

    const page = await browser.newPage();
    await page.setViewport({ width: viewportWidth, height: viewportHeight });
    await page.setUserAgent(USER_AGENT);

    progress(20, 'Loading page content...');
    await page.goto(url.toString(), { waitUntil: 'networkidle2', timeout: TIMEOUT });
    progress(35, 'Page loaded');

    progress(40, 'Waiting for JS rendering...');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 1000)));
    progress(45, 'Content rendered');

    progress(50, 'Extracting DOM structure...');
    const proxyBase = '/api/proxy-asset?url=';
    const pageUrl = url.toString();

    const serializedTree = await page.evaluate(
      (evalOpts: { maxNodes: number; proxyBase: string; pageUrl: string; styleProps: string[] }) => {
        let nodeCount = 0;

        function resolveUrl(rawUrl: string): string {
          if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
          try {
            const absolute = new URL(rawUrl, evalOpts.pageUrl).toString();
            return evalOpts.proxyBase + encodeURIComponent(absolute);
          } catch { return rawUrl; }
        }

        function rewriteCssUrls(css: string): string {
          return css.replace(/url\(["']?((?!data:)[^"')]+)["']?\)/g, (_match, rawUrl) => {
            return `url("${resolveUrl(rawUrl)}")`;
          });
        }

        interface SNode {
          tagName: string;
          attributes: Record<string, string>;
          children: SNode[];
          textContent?: string;
          rawHtml?: string;
          styles: Record<string, string>;
          bounds: { x: number; y: number; width: number; height: number };
          name: string;
        }

        function serializeNode(element: Element): SNode | null {
          if (nodeCount >= evalOpts.maxNodes) return null;
          nodeCount++;

          const tagName = element.tagName.toLowerCase();
          if (['script', 'noscript', 'link', 'meta', 'style'].includes(tagName)) return null;

          const rect = element.getBoundingClientRect();
          const computed = window.getComputedStyle(element);

          if (
            !['html', 'body', 'svg'].includes(tagName) &&
            (computed.display === 'none' || (rect.width === 0 && rect.height === 0))
          ) return null;

          // Extract computed styles
          const styles: Record<string, string> = {};
          for (const prop of evalOpts.styleProps) {
            const val = computed.getPropertyValue(prop);
            if (val) styles[prop] = val;
          }
          if (styles['background-image'] && styles['background-image'] !== 'none') {
            styles['background-image'] = rewriteCssUrls(styles['background-image']);
          }

          // Extract attributes
          const attrs: Record<string, string> = {};
          for (const attr of Array.from(element.attributes)) {
            if (['style', 'class', 'id', 'onclick', 'onload', 'onerror'].includes(attr.name)) continue;
            let val = attr.value;
            if (['src', 'href', 'poster', 'data-src'].includes(attr.name) && val) val = resolveUrl(val);
            attrs[attr.name] = val;
          }

          // Opaque elements: capture as raw HTML
          const OPAQUE_TAGS = ['svg', 'canvas', 'video', 'picture'];
          let rawHtml: string | undefined;
          if (OPAQUE_TAGS.includes(tagName)) {
            let html = element.outerHTML;
            html = html.replace(/(src|href|xlink:href|poster)="([^"]*)"/g, (_m, attr, url) => {
              if (!url || url.startsWith('data:') || url.startsWith('blob:')) return `${attr}="${url}"`;
              return `${attr}="${resolveUrl(url)}"`;
            });
            rawHtml = rewriteCssUrls(html);
          }

          // Text content and children
          let textContent: string | undefined;
          const children: SNode[] = [];

          if (!rawHtml) {
            const childNodes = Array.from(element.childNodes);
            const hasElementChildren = element.children.length > 0;
            const textNodes = childNodes.filter(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
            );

            if (textNodes.length > 0 && !hasElementChildren) {
              textContent = element.textContent?.trim();
            } else {
              for (const childNode of childNodes) {
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                  const serialized = serializeNode(childNode as Element);
                  if (serialized) children.push(serialized);
                } else if (childNode.nodeType === Node.TEXT_NODE) {
                  const text = childNode.textContent?.trim();
                  if (text) {
                    nodeCount++;
                    // Inherit typography + color styles from parent element
                    const inheritedStyles: Record<string, string> = {};
                    const INHERIT_PROPS = [
                      'font-family', 'font-size', 'font-weight', 'line-height',
                      'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'color',
                    ];
                    for (const prop of INHERIT_PROPS) {
                      if (styles[prop]) inheritedStyles[prop] = styles[prop];
                    }
                    children.push({
                      tagName: 'span',
                      attributes: {},
                      children: [],
                      textContent: text,
                      styles: inheritedStyles,
                      bounds: { x: 0, y: 0, width: 0, height: 0 },
                      name: `"${text.slice(0, 20)}"`,
                    });
                  }
                }
              }
            }
          }

          // Readable name
          let name = tagName;
          if (element.id) name = `#${element.id}`;
          else if (element.className && typeof element.className === 'string') {
            const firstClass = element.className.split(' ')[0];
            if (firstClass) name = `.${firstClass}`;
          }

          return {
            tagName, attributes: attrs, children, textContent, rawHtml, styles,
            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            name,
          };
        }

        const root = document.body;
        if (!root) return null;
        return serializeNode(root);
      },
      { maxNodes: MAX_NODES, proxyBase, pageUrl, styleProps: STYLE_PROPS },
    );

    progress(75, 'DOM extracted');

    if (!serializedTree) {
      throw new Error('Failed to extract page content');
    }

    return serializedTree as SerializedNode;
  } finally {
    await browser.close();
  }
}
