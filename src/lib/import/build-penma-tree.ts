import { v4 as uuid } from 'uuid';
import type { PenmaNode, PenmaDocument, AutoLayout } from '@/types/document';
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
