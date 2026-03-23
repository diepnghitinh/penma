import { v4 as uuid } from 'uuid';
import type { PenmaNode, PenmaDocument, AutoLayout, PenmaFill } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';
import { HALIGN_MAP, VALIGN_MAP, VALIGN_TO_TEXT, TEXT_STYLE_KEYS, parsePadding } from './css-mapping';
import { detectAutoLayout, detectChildSizing } from './detect-layout';

// ── Serialized node shape from page.evaluate ────────────────

export interface SerializedNode {
  tagName: string;
  attributes: Record<string, string>;
  children: SerializedNode[];
  textContent?: string;
  rawHtml?: string;
  styles: Record<string, string>;
  bounds: { x: number; y: number; width: number; height: number };
  name: string;
}

/** Parse any CSS color value into hex + opacity. Handles:
 *  - rgb(r, g, b) / rgba(r, g, b, a)
 *  - color(srgb r g b) / color(srgb r g b / a)
 *  - #hex
 */
function parseCssColor(raw: string | undefined): { hex: string; opacity: number } | null {
  if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'none') return null;

  // rgb(r, g, b) / rgba(r, g, b, a)
  const rgbaMatch = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    if (a < 0.01) return null;
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { hex, opacity: Math.round(a * 100) };
  }

  // color(srgb r g b) / color(srgb r g b / a) — modern Chrome computed style format
  const srgbMatch = raw.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255);
    const g = Math.round(parseFloat(srgbMatch[2]) * 255);
    const b = Math.round(parseFloat(srgbMatch[3]) * 255);
    const a = srgbMatch[4] !== undefined ? parseFloat(srgbMatch[4]) : 1;
    if (a < 0.01) return null;
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { hex, opacity: Math.round(a * 100) };
  }

  // #hex
  if (raw.startsWith('#') && raw.length >= 7) {
    return { hex: raw.slice(0, 7), opacity: 100 };
  }

  return null;
}

function parseBgToFills(styles: Record<string, string>): PenmaFill[] | undefined {
  const parsed = parseCssColor(styles['background-color']);
  if (!parsed) return undefined;
  return [{ id: uuid(), color: parsed.hex, opacity: parsed.opacity, visible: true }];
}

function parseColorToFills(raw: string | undefined): PenmaFill[] | undefined {
  const parsed = parseCssColor(raw);
  if (!parsed) return undefined;
  return [{ id: uuid(), color: parsed.hex, opacity: parsed.opacity, visible: true }];
}

// ── Tags that keep their original tag as the container ──────

const INTERACTIVE_TAGS = new Set(['button', 'a', 'select', 'label']);

// ── Build container + text child from a text-only element ───
// <button class="x">Text</button> → <button class="x"><span>Text</span></button>
// <span class="x">Text</span>     → <div class="x"><span>Text</span></div>

function buildTextContainer(
  node: SerializedNode,
  containerTag: string,
  parentAutoLayout?: AutoLayout,
): PenmaNode {
  const styles = node.styles;
  const display = styles['display'] || '';
  const isFlex = display.includes('flex');
  const alignItems = styles['align-items'] || '';
  const justifyContent = styles['justify-content'] || '';
  const textAlign = styles['text-align'] || '';

  // Container alignment
  const primaryAlign = (isFlex && justifyContent)
    ? (HALIGN_MAP[justifyContent] || 'center')
    : (HALIGN_MAP[textAlign] || 'center');
  const counterAlign = (isFlex && alignItems)
    ? (VALIGN_MAP[alignItems] || 'center')
    : 'center';

  // Container padding (CSS → autoLayout)
  const { padding, independentPadding } = parsePadding(styles);

  const containerAutoLayout: AutoLayout = {
    ...DEFAULT_AUTO_LAYOUT,
    direction: 'horizontal',
    primaryAxisAlign: primaryAlign,
    counterAxisAlign: counterAlign,
    padding,
    independentPadding,
  };

  // Container sizing (inline → hug)
  const isInline = display.startsWith('inline');
  const containerSizing = isInline
    ? { horizontal: 'hug' as const, vertical: 'hug' as const }
    : parentAutoLayout
      ? detectChildSizing(styles, parentAutoLayout)
      : { ...DEFAULT_SIZING };

  // Split styles: typography → text child, visual → container
  const textStyles: Record<string, string> = {};
  const containerStyles: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (TEXT_STYLE_KEYS.has(key)) textStyles[key] = value;
    if (!key.startsWith('padding')) containerStyles[key] = value;
  }

  // CSS flex alignment → text-valign / text-align
  if (isFlex) {
    textStyles['text-valign'] = VALIGN_TO_TEXT[alignItems] || 'top';
    if (justifyContent === 'center') textStyles['text-align'] = 'center';
    else if (justifyContent === 'flex-end' || justifyContent === 'end') textStyles['text-align'] = 'right';
  }
  if (!textStyles['text-valign']) textStyles['text-valign'] = 'middle';

  // Text child spans are always "auto width" (hug content)
  const textChildSizing = { horizontal: 'hug' as const, vertical: 'hug' as const };

  // Text child fills: use CSS `color` (text color) → fills
  const textChildFills = parseColorToFills(textStyles['color']);

  // Assemble nodes
  const textChild: PenmaNode = {
    id: uuid(),
    tagName: 'span',
    attributes: {},
    children: [],
    textContent: node.textContent,
    styles: { computed: textStyles, overrides: {} },
    bounds: node.bounds,
    visible: true,
    locked: false,
    sizing: textChildSizing,
    fills: textChildFills,
  };

  return {
    id: uuid(),
    tagName: containerTag,
    attributes: node.attributes,
    children: [textChild],
    styles: { computed: containerStyles, overrides: {} },
    bounds: node.bounds,
    visible: true,
    locked: false,
    name: node.name,
    autoLayout: containerAutoLayout,
    sizing: containerSizing,
    fills: parseBgToFills(styles),
  };
}

// ── Recursively convert serialized DOM → PenmaNode tree ─────

function assignIds(
  node: SerializedNode,
  parentAutoLayout?: AutoLayout,
): PenmaNode {
  // Text-only element → container + text child
  const isTextOnly = !!node.textContent
    && (!node.children || node.children.length === 0)
    && !node.rawHtml;

  if (isTextOnly) {
    const isInteractive = INTERACTIVE_TAGS.has(node.tagName);
    return buildTextContainer(node, isInteractive ? node.tagName : 'div', parentAutoLayout);
  }

  const childCount = node.children?.length ?? 0;
  const autoLayout = detectAutoLayout(node.styles, childCount);
  const sizing = parentAutoLayout
    ? detectChildSizing(node.styles, parentAutoLayout)
    : {
        horizontal: (node.styles['width'] && node.styles['width'] !== 'auto' ? 'fixed' : 'hug') as 'fixed' | 'hug' | 'fill',
        vertical: (node.styles['height'] && node.styles['height'] !== 'auto' ? 'fixed' : 'hug') as 'fixed' | 'hug' | 'fill',
      };

  return {
    id: uuid(),
    tagName: node.tagName,
    attributes: node.attributes,
    children: node.children.map((child) => assignIds(child, autoLayout)),
    textContent: node.textContent,
    rawHtml: node.rawHtml,
    styles: { computed: node.styles, overrides: {} },
    bounds: node.bounds,
    visible: true,
    locked: false,
    name: node.name,
    autoLayout,
    sizing,
    fills: parseBgToFills(node.styles),
  };
}

// ── Build a complete PenmaDocument from a serialized tree ───

export function buildPenmaDocument(
  serializedTree: SerializedNode,
  sourceUrl: string,
  viewport: { width: number; height: number },
): PenmaDocument {
  const rootNode = assignIds(serializedTree);

  return {
    id: uuid(),
    sourceUrl,
    importedAt: new Date().toISOString(),
    viewport,
    rootNode,
    assets: {},
    canvasX: 0,
    canvasY: 0,
  };
}
