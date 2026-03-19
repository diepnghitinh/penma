import type { PenmaDocument, PenmaNode } from '@/types/document';
import { getEffectiveStyles } from '@/lib/styles/style-resolver';

/**
 * Converts a PenmaDocument (or subtree) into a Figma-compatible JSON structure.
 * This produces a format that can be imported into Figma via plugins or the REST API.
 *
 * Figma node types used:
 * - FRAME: for container elements (div, section, nav, etc.)
 * - TEXT: for text-only elements
 * - RECTANGLE: for elements with no children and no text
 * - VECTOR: for SVGs
 */

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  absoluteBoundingBox: { x: number; y: number; width: number; height: number };
  constraints?: { vertical: string; horizontal: string };
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  cornerRadius?: number;
  opacity?: number;
  effects?: FigmaEffect[];
  children?: FigmaNode[];
  // Text-specific
  characters?: string;
  style?: FigmaTextStyle;
  // Auto layout
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  // Metadata
  componentProperties?: Record<string, unknown>;
}

interface FigmaFill {
  type: string;
  visible: boolean;
  color: FigmaColor;
  opacity?: number;
}

interface FigmaStroke {
  type: string;
  color: FigmaColor;
}

interface FigmaEffect {
  type: string;
  visible: boolean;
  radius?: number;
  offset?: { x: number; y: number };
  color?: FigmaColor;
}

interface FigmaTextStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: string;
  textDecoration?: string;
}

// ── Main export function ────────────────────────────────────

export function documentToFigmaJson(doc: PenmaDocument): object {
  return {
    name: getDocName(doc),
    schemaVersion: 0,
    document: {
      id: '0:0',
      name: 'Document',
      type: 'DOCUMENT',
      children: [
        {
          id: '0:1',
          name: 'Page 1',
          type: 'CANVAS',
          backgroundColor: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
          children: [convertNode(doc.rootNode, doc.canvasX, doc.canvasY)],
        },
      ],
    },
    metadata: {
      source: 'penma',
      sourceUrl: doc.sourceUrl,
      importedAt: doc.importedAt,
      viewport: doc.viewport,
    },
  };
}

export function nodeToFigmaJson(node: PenmaNode): object {
  return convertNode(node, 0, 0);
}

function getDocName(doc: PenmaDocument): string {
  try {
    return new URL(doc.sourceUrl).hostname;
  } catch {
    return 'Imported Page';
  }
}

// ── Node conversion ─────────────────────────────────────────

function convertNode(node: PenmaNode, offsetX: number, offsetY: number): FigmaNode {
  const styles = getEffectiveStyles(node.styles);
  const isText = !!node.textContent && node.children.length === 0 && !node.rawHtml;
  const isSvg = !!node.rawHtml && node.tagName === 'svg';
  const isImg = node.tagName === 'img';
  const hasChildren = node.children.length > 0;

  let type: string;
  if (isText) type = 'TEXT';
  else if (isSvg) type = 'VECTOR';
  else if (isImg) type = 'RECTANGLE';
  else if (hasChildren || node.autoLayout) type = 'FRAME';
  else type = 'RECTANGLE';

  const result: FigmaNode = {
    id: node.id,
    name: node.name || node.tagName,
    type,
    visible: node.visible,
    locked: node.locked,
    absoluteBoundingBox: {
      x: node.bounds.x + offsetX,
      y: node.bounds.y + offsetY,
      width: node.bounds.width,
      height: node.bounds.height,
    },
    constraints: { vertical: 'TOP', horizontal: 'LEFT' },
  };

  // Fills (background-color)
  const bgColor = parseColor(styles['background-color']);
  if (bgColor) {
    result.fills = [{ type: 'SOLID', visible: true, color: bgColor }];
  } else {
    result.fills = [];
  }

  // Strokes (border)
  const borderColor = parseColor(styles['border-top-color'] || styles['border-color']);
  const borderWidth = parseFloat(styles['border-top-width'] || styles['border-width'] || '0');
  if (borderColor && borderWidth > 0) {
    result.strokes = [{ type: 'SOLID', color: borderColor }];
    result.strokeWeight = borderWidth;
  }

  // Corner radius
  const radius = parseFloat(styles['border-top-left-radius'] || styles['border-radius'] || '0');
  if (radius > 0) result.cornerRadius = radius;

  // Opacity
  const opacity = parseFloat(styles['opacity'] || '1');
  if (opacity < 1) result.opacity = opacity;

  // Box shadow → effects
  const shadow = styles['box-shadow'];
  if (shadow && shadow !== 'none') {
    const effect = parseShadow(shadow);
    if (effect) result.effects = [effect];
  }

  // Text properties
  if (isText && node.textContent) {
    result.characters = node.textContent;
    result.style = {
      fontFamily: (styles['font-family'] || 'Inter').split(',')[0].replace(/['"]/g, ''),
      fontSize: parseFloat(styles['font-size'] || '16'),
      fontWeight: parseInt(styles['font-weight'] || '400') || 400,
      lineHeightPx: parseLineHeight(styles['line-height'], styles['font-size']),
      letterSpacing: parseFloat(styles['letter-spacing'] || '0') || 0,
      textAlignHorizontal: mapTextAlign(styles['text-align']),
      textDecoration: mapTextDecoration(styles['text-decoration']),
    };

    // Text color as fill
    const textColor = parseColor(styles['color']);
    if (textColor) {
      result.fills = [{ type: 'SOLID', visible: true, color: textColor }];
    }
  }

  // Auto layout → Figma layout mode
  if (node.autoLayout) {
    const al = node.autoLayout;
    result.layoutMode = al.direction === 'horizontal' || al.direction === 'wrap' ? 'HORIZONTAL' : 'VERTICAL';
    result.primaryAxisSizingMode = 'AUTO';
    result.counterAxisSizingMode = 'AUTO';
    result.primaryAxisAlignItems = mapAxisAlign(al.primaryAxisAlign);
    result.counterAxisAlignItems = mapCounterAlign(al.counterAxisAlign);
    result.paddingTop = al.padding.top;
    result.paddingRight = al.padding.right;
    result.paddingBottom = al.padding.bottom;
    result.paddingLeft = al.padding.left;
    result.itemSpacing = al.gap;
  }

  // Children
  if (hasChildren && !isText) {
    result.children = node.children
      .filter((c) => c.visible)
      .map((c) => convertNode(c, offsetX, offsetY));
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────

function parseColor(raw: string | undefined): FigmaColor | null {
  if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'none') return null;

  const rgbMatch = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    if (a < 0.01) return null;
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
      a,
    };
  }

  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: 1,
      };
    }
  }

  return null;
}

function parseShadow(raw: string): FigmaEffect | null {
  // Simple shadow: "0px 4px 6px rgba(0,0,0,0.1)"
  const match = raw.match(/([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(rgba?\([^)]+\))/);
  if (!match) return null;
  const color = parseColor(match[4]);
  if (!color) return null;
  return {
    type: 'DROP_SHADOW',
    visible: true,
    radius: parseFloat(match[3]),
    offset: { x: parseFloat(match[1]), y: parseFloat(match[2]) },
    color,
  };
}

function parseLineHeight(lh: string | undefined, fs: string | undefined): number | undefined {
  if (!lh || lh === 'normal') return undefined;
  const px = parseFloat(lh);
  if (!isNaN(px) && px > 0) return px;
  // Unitless multiplier
  const mul = parseFloat(lh);
  const fontSize = parseFloat(fs || '16');
  if (!isNaN(mul)) return mul * fontSize;
  return undefined;
}

function mapTextAlign(align: string | undefined): string {
  switch (align) {
    case 'center': return 'CENTER';
    case 'right': return 'RIGHT';
    case 'justify': return 'JUSTIFIED';
    default: return 'LEFT';
  }
}

function mapTextDecoration(dec: string | undefined): string {
  if (!dec) return 'NONE';
  if (dec.includes('underline')) return 'UNDERLINE';
  if (dec.includes('line-through')) return 'STRIKETHROUGH';
  return 'NONE';
}

function mapAxisAlign(align: string): string {
  switch (align) {
    case 'center': return 'CENTER';
    case 'end': return 'MAX';
    case 'space-between': return 'SPACE_BETWEEN';
    default: return 'MIN';
  }
}

function mapCounterAlign(align: string): string {
  switch (align) {
    case 'center': return 'CENTER';
    case 'end': return 'MAX';
    case 'baseline': return 'BASELINE';
    default: return 'MIN';
  }
}
