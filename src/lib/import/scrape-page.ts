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
  'background-clip', '-webkit-background-clip', '-webkit-text-fill-color',
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

export interface ExtractedFontFace {
  family: string;
  weight: string;
  style: string;
  url: string;
  format: string;
}

export interface ExtractedCssRule {
  selector: string;
  declarations: Record<string, string>;
  source: string;
}

/** Map of CSS class name → merged CSS declarations from all matching rules */
export type ClassCssMap = Record<string, Record<string, string>>;

export interface ScrapeResult {
  tree: SerializedNode;
  fonts: ExtractedFontFace[];
  cssRules: ExtractedCssRule[];
  classCss: ClassCssMap;
}

export async function scrapePage(opts: ScrapeOptions): Promise<ScrapeResult> {
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
          cssClasses?: string[];
          matchedCssRules?: number[];
        }

        function serializeNode(element: Element): SNode | null {
          if (nodeCount >= evalOpts.maxNodes) return null;
          nodeCount++;

          const tagName = element.tagName.toLowerCase();
          if (['script', 'noscript', 'link', 'meta', 'style', 'br'].includes(tagName)) return null;

          const rect = element.getBoundingClientRect();
          const computed = window.getComputedStyle(element);

          // Skip truly invisible elements (0×0 with no content), but keep display:none
          // and visibility:hidden so the tree is complete
          if (
            !['html', 'body', 'svg'].includes(tagName) &&
            computed.display !== 'none' && computed.visibility !== 'hidden' &&
            rect.width === 0 && rect.height === 0
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
            if (['style', 'onclick', 'onload', 'onerror'].includes(attr.name)) continue;
            let val = attr.value;
            if (['src', 'href', 'poster', 'data-src'].includes(attr.name) && val) val = resolveUrl(val);
            attrs[attr.name] = val;
          }

          // Extract CSS classes
          const cssClasses: string[] = [];
          if (element.className && typeof element.className === 'string') {
            for (const c of element.className.split(/\s+/)) {
              if (c) cssClasses.push(c);
            }
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
            cssClasses: cssClasses.length > 0 ? cssClasses : undefined,
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

    // ── Extract @font-face declarations from all stylesheets ──
    progress(78, 'Extracting fonts...');
    const extractedFonts = await page.evaluate((evalPageUrl: string) => {
      const fonts: { family: string; weight: string; style: string; url: string; format: string }[] = [];
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList;
          try { rules = sheet.cssRules; } catch { continue; } // CORS-blocked sheets
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSFontFaceRule) {
              const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
              const weight = rule.style.getPropertyValue('font-weight') || '400';
              const fontStyle = rule.style.getPropertyValue('font-style') || 'normal';
              const src = rule.style.getPropertyValue('src') || '';

              // Parse url() references from src — prefer woff2, then woff, then others
              const urlMatches = [...src.matchAll(/url\(["']?([^"')]+)["']?\)\s*format\(["']?([^"')]+)["']?\)/g)];
              const plainUrls = [...src.matchAll(/url\(["']?([^"')]+)["']?\)/g)];

              let bestUrl = '';
              let bestFormat = '';

              // Prioritize woff2 > woff > others
              for (const m of urlMatches) {
                const fmt = m[2].toLowerCase();
                if (fmt === 'woff2' || fmt.includes('woff2')) { bestUrl = m[1]; bestFormat = 'font/woff2'; break; }
                if (!bestUrl && (fmt === 'woff' || fmt.includes('woff'))) { bestUrl = m[1]; bestFormat = 'font/woff'; }
                if (!bestUrl) { bestUrl = m[1]; bestFormat = `font/${fmt}`; }
              }

              // Fallback: plain url() without format()
              if (!bestUrl && plainUrls.length > 0) {
                bestUrl = plainUrls[0][1];
                const ext = bestUrl.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
                bestFormat = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'ttf' ? 'font/ttf' : 'font/woff2';
              }

              if (bestUrl && family && !bestUrl.startsWith('data:')) {
                // Resolve relative URL
                try {
                  bestUrl = new URL(bestUrl, evalPageUrl).toString();
                } catch {}
                fonts.push({ family, weight, style: fontStyle, url: bestUrl, format: bestFormat });
              }
            }
          }
        }
      } catch {}
      return fonts;
    }, pageUrl);

    progress(80, `Found ${extractedFonts.length} font faces`);

    // ── Extract CSS rules from all stylesheets ──────────────────
    progress(81, 'Extracting CSS rules...');
    const extractedCssRules = await page.evaluate(() => {
      const rules: Array<{ selector: string; declarations: Record<string, string>; source: string }> = [];
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          let cssRules: CSSRuleList;
          try { cssRules = sheet.cssRules; } catch { continue; }
          const source = sheet.href || 'inline';
          for (const rule of Array.from(cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const decls: Record<string, string> = {};
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                decls[prop] = rule.style.getPropertyValue(prop);
              }
              if (Object.keys(decls).length > 0) {
                rules.push({ selector: rule.selectorText, declarations: decls, source });
              }
            }
          }
          // Limit to prevent memory issues on large sites
          if (rules.length >= 5000) break;
        }
      } catch {}
      return rules;
    });

    progress(82, `Found ${extractedCssRules.length} CSS rules`);

    // ── Match CSS rules to nodes in the serialized tree ──────────
    // We do this in the browser so we can use element.matches()
    if (extractedCssRules.length > 0 && serializedTree) {
      const selectors = extractedCssRules.map((r) => r.selector);
      await page.evaluate(
        (evalSelectors: string[]) => {
          function assignMatchedRules(element: Element) {
            const matched: number[] = [];
            for (let i = 0; i < evalSelectors.length; i++) {
              try {
                if (element.matches(evalSelectors[i])) {
                  matched.push(i);
                }
              } catch { /* invalid selector */ }
            }
            // Store on the element as a data attribute for the serializer to read
            if (matched.length > 0) {
              element.setAttribute('data-penma-matched-rules', matched.join(','));
            }
            for (const child of Array.from(element.children)) {
              assignMatchedRules(child);
            }
          }
          if (document.body) assignMatchedRules(document.body);
        },
        selectors,
      );

      // Now walk the serialized tree and read matched rules from the DOM
      const matchedRulesMap = await page.evaluate(() => {
        const map: Record<string, number[]> = {};
        const els = document.querySelectorAll('[data-penma-matched-rules]');
        for (const el of Array.from(els)) {
          // Build a simple path as key
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
          const rect = el.getBoundingClientRect();
          const key = `${tag}${id}${cls}|${Math.round(rect.x)},${Math.round(rect.y)}`;
          const indices = el.getAttribute('data-penma-matched-rules')!.split(',').map(Number);
          map[key] = indices;
        }
        return map;
      });

      // Walk the serialized tree and assign matchedCssRules
      function assignToTree(node: SerializedNode) {
        const id = node.attributes?.id ? `#${node.attributes.id}` : '';
        const cls = node.name?.startsWith('.') ? node.name : '';
        const key = `${node.tagName}${id}${cls}|${Math.round(node.bounds.x)},${Math.round(node.bounds.y)}`;
        const matched = matchedRulesMap[key];
        if (matched && matched.length > 0) {
          node.matchedCssRules = matched;
        }
        for (const child of node.children) {
          assignToTree(child);
        }
      }
      assignToTree(serializedTree as SerializedNode);
    }

    // ── Build class CSS map: className → merged declarations ───
    progress(83, 'Building class CSS map...');
    const classCss: ClassCssMap = {};

    // Collect all unique class names from the serialized tree
    function collectClasses(node: SerializedNode, classes: Set<string>) {
      if (node.cssClasses) {
        for (const c of node.cssClasses) classes.add(c);
      }
      for (const child of node.children) {
        collectClasses(child, classes);
      }
    }
    const allClasses = new Set<string>();
    collectClasses(serializedTree as SerializedNode, allClasses);

    // For each class, find CSS rules whose selector targets it and merge declarations
    if (allClasses.size > 0 && extractedCssRules.length > 0) {
      for (const className of allClasses) {
        // Match rules whose selector contains .className (as a whole word)
        const pattern = new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,:+~>\\[{]|$)`);
        const merged: Record<string, string> = {};
        for (const rule of extractedCssRules) {
          if (pattern.test(rule.selector)) {
            Object.assign(merged, rule.declarations);
          }
        }
        if (Object.keys(merged).length > 0) {
          classCss[className] = merged;
        }
      }
    }

    progress(84, `Mapped CSS for ${Object.keys(classCss).length} classes`);

    return { tree: serializedTree as SerializedNode, fonts: extractedFonts, cssRules: extractedCssRules, classCss };
  } finally {
    await browser.close();
  }
}
