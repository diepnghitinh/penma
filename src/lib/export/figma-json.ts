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
  strokeTopWeight?: number;
  strokeRightWeight?: number;
  strokeBottomWeight?: number;
  strokeLeftWeight?: number;
  strokeAlign?: string;
  cornerRadius?: number;
  topLeftRadius?: number;
  topRightRadius?: number;
  bottomRightRadius?: number;
  bottomLeftRadius?: number;
  opacity?: number;
  effects?: FigmaEffect[];
  children?: FigmaNode[];
  // Text-specific
  characters?: string;
  style?: FigmaTextStyle;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  // Auto layout (container)
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
  counterAxisSpacing?: number;
  layoutWrap?: string;
  // Auto layout (child resizing)
  layoutAlign?: string;       // "STRETCH" | "INHERIT" | "MIN" | "CENTER" | "MAX"
  layoutGrow?: number;        // 0 = fixed/hug, 1 = fill
  layoutSizingHorizontal?: string; // "FIXED" | "HUG" | "FILL"
  layoutSizingVertical?: string;   // "FIXED" | "HUG" | "FILL"
  clipsContent?: boolean;
  overflowDirection?: 'NONE' | 'HORIZONTAL_SCROLLING' | 'VERTICAL_SCROLLING' | 'HORIZONTAL_AND_VERTICAL_SCROLLING';
  // Grid layout metadata
  gridColumns?: number;
  gridTemplateColumns?: string;
  // Margins (not native Figma — stored for plugin use)
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  // Min/max sizing
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  // SVG/Vector data
  svgData?: string;
  /** Ready-to-use SVG string for figma.createNodeFromSvg() */
  svgString?: string;
  // Image
  imageUrl?: string;
  // Export settings
  exportSettings?: { format: string; suffix?: string; constraint?: { type: string; value: number } }[];
  // Absolute positioning (out of auto-layout flow)
  layoutPositioning?: 'ABSOLUTE' | 'AUTO';
  // Metadata
  componentProperties?: Record<string, unknown>;
}

interface FigmaFill {
  type: string;
  visible: boolean;
  color?: FigmaColor;
  opacity?: number;
  // Image fill
  scaleMode?: string;
  imageRef?: string;
  imageUrl?: string;
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
  textDecoration?: string;
}

// ── Main export function ────────────────────────────────────

export function documentToFigmaJson(doc: PenmaDocument): object {
  const rootFigmaNode = convertNode(doc.rootNode, doc.canvasX, doc.canvasY);

  // Design System frame: arrange children for clean vertical layout
  if (doc.rootNode.attributes?.class === 'design-system-frame') {
    arrangeDesignSystemFrame(rootFigmaNode);
  }

  // Collect all image and SVG references from the tree
  const images: Record<string, string> = {};
  const svgs: Record<string, string> = {};
  collectAssets(rootFigmaNode, images, svgs);

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
          children: [rootFigmaNode],
        },
      ],
    },
    // Asset references for images and SVGs
    images,
    svgs,
    metadata: {
      source: 'penma',
      sourceUrl: doc.sourceUrl,
      importedAt: doc.importedAt,
      viewport: doc.viewport,
    },
  };
}

/**
 * Arrange children of a "Design System" frame with clean vertical layout.
 * Ensures auto layout, resets child positions, and makes descendant bounds relative.
 */
function arrangeDesignSystemFrame(frame: FigmaNode): void {
  if (!frame.children || frame.children.length === 0) return;

  const PADDING = 40;
  const GAP = 32;

  // Ensure the frame has vertical auto layout
  if (!frame.layoutMode) {
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
    frame.primaryAxisAlignItems = 'MIN';
    frame.counterAxisAlignItems = 'MIN';
    frame.paddingTop = PADDING;
    frame.paddingRight = PADDING;
    frame.paddingBottom = PADDING;
    frame.paddingLeft = PADDING;
    frame.itemSpacing = GAP;
    frame.clipsContent = false;
  }

  for (const child of frame.children) {
    // Reset position — auto layout handles placement
    child.absoluteBoundingBox = {
      x: 0, y: 0,
      width: child.absoluteBoundingBox.width,
      height: child.absoluteBoundingBox.height,
    };

    // Ensure component has auto layout for its own children
    if (child.children && child.children.length > 0 && !child.layoutMode) {
      child.layoutMode = 'VERTICAL';
      child.primaryAxisSizingMode = 'AUTO';
      child.counterAxisSizingMode = 'AUTO';
      child.primaryAxisAlignItems = 'MIN';
      child.counterAxisAlignItems = 'MIN';
      child.itemSpacing = 0;
      child.paddingTop = 0;
      child.paddingRight = 0;
      child.paddingBottom = 0;
      child.paddingLeft = 0;
    }

    // Make all descendant bounds relative to their direct parent
    if (child.children) {
      recalcChildBounds(child);
    }
  }

  // Recalculate frame size
  let maxW = 0;
  let totalH = 0;
  for (const child of frame.children) {
    if (child.absoluteBoundingBox.width > maxW) maxW = child.absoluteBoundingBox.width;
    totalH += child.absoluteBoundingBox.height;
  }
  if (frame.children.length > 1) totalH += GAP * (frame.children.length - 1);
  frame.absoluteBoundingBox = {
    ...frame.absoluteBoundingBox,
    width: Math.max(frame.absoluteBoundingBox.width, maxW + PADDING * 2),
    height: Math.max(frame.absoluteBoundingBox.height, totalH + PADDING * 2),
  };
}

/** Recursively make children's absoluteBoundingBox relative to their parent. */
function recalcChildBounds(parent: FigmaNode): void {
  if (!parent.children) return;
  const px = parent.absoluteBoundingBox.x;
  const py = parent.absoluteBoundingBox.y;
  for (const child of parent.children) {
    child.absoluteBoundingBox = {
      ...child.absoluteBoundingBox,
      x: child.absoluteBoundingBox.x - px,
      y: child.absoluteBoundingBox.y - py,
    };
    if (child.children) recalcChildBounds(child);
  }
}

/** Recursively collect image URLs and SVG data from the Figma node tree */
function collectAssets(
  node: FigmaNode,
  images: Record<string, string>,
  svgs: Record<string, string>
): void {
  if (node.imageUrl) {
    images[node.id] = node.imageUrl;
  }
  if (node.svgData) {
    svgs[node.id] = node.svgData;
  }
  if (node.children) {
    for (const child of node.children) {
      collectAssets(child, images, svgs);
    }
  }
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

  const isComponent = !!node.componentId;
  const isInstance = !!node.componentRef;

  let type: string;
  if (isComponent) type = 'COMPONENT';
  else if (isInstance) type = 'INSTANCE';
  else if (isText) type = 'TEXT';
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

  // Absolute positioning → Figma "Ignore auto layout" with X/Y relative to parent
  const cssPosition = styles['position'];
  const isAbsolutePositioned = cssPosition === 'absolute' || cssPosition === 'fixed';
  if (isAbsolutePositioned) {
    result.layoutPositioning = 'ABSOLUTE';

    // X/Y from CSS left/top (relative to parent), falling back to bounds
    const cssLeft = parseFloat(styles['left'] || '') || 0;
    const cssTop = parseFloat(styles['top'] || '') || 0;
    result.absoluteBoundingBox = {
      x: cssLeft,
      y: cssTop,
      width: node.bounds.width,
      height: node.bounds.height,
    };
  }

  // Fills
  if (isImg) {
    // Image fill — resolve proxy URLs to originals
    const rawSrc = node.attributes?.src || node.attributes?.['data-src'] || '';
    const imgSrc = resolveProxyUrl(rawSrc);
    result.fills = [{
      type: 'IMAGE',
      visible: true,
      scaleMode: 'FILL',
      imageRef: node.id,
      imageUrl: imgSrc,
    }];
    result.imageUrl = imgSrc;
    result.exportSettings = [
      { format: 'PNG', suffix: '', constraint: { type: 'SCALE', value: 2 } },
    ];
  } else if (isSvg && node.rawHtml) {
    // SVG — prepare for Figma plugin's figma.createNodeFromSvg()
    const svgFillColor = parseColor(styles['color']) || { r: 0, g: 0, b: 0, a: 1 };
    const hexColor = `#${Math.round(svgFillColor.r * 255).toString(16).padStart(2, '0')}${Math.round(svgFillColor.g * 255).toString(16).padStart(2, '0')}${Math.round(svgFillColor.b * 255).toString(16).padStart(2, '0')}`;

    // Build a clean standalone SVG string
    let svgMarkup = node.rawHtml.replace(/currentColor/g, hexColor);
    if (!svgMarkup.includes('xmlns=')) {
      svgMarkup = svgMarkup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    // Ensure width/height attributes for figma.createNodeFromSvg()
    if (!svgMarkup.match(/\bwidth=/)) {
      svgMarkup = svgMarkup.replace('<svg', `<svg width="${node.bounds.width}"`);
    }
    if (!svgMarkup.match(/\bheight=/)) {
      svgMarkup = svgMarkup.replace('<svg', `<svg height="${node.bounds.height}"`);
    }

    result.svgString = svgMarkup;
    result.svgData = svgMarkup;
    result.fills = [{ type: 'SOLID', visible: true, color: svgFillColor }];
    result.exportSettings = [
      { format: 'SVG', suffix: '' },
      { format: 'PNG', suffix: '@2x', constraint: { type: 'SCALE', value: 2 } },
    ];
  } else if (node.fills && node.fills.length > 0) {
    // Structured fills (Figma-style multi-fill)
    result.fills = node.fills.map((f) => {
      const hex = f.color;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return {
        type: 'SOLID' as const,
        visible: f.visible,
        color: { r, g, b, a: 1 },
        opacity: f.opacity / 100,
      };
    });

    // Also check for background-image
    const bgImage = styles['background-image'];
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        const bgUrl = resolveProxyUrl(urlMatch[1]);
        result.fills.push({ type: 'IMAGE', visible: true, scaleMode: 'FILL', imageRef: node.id, imageUrl: bgUrl });
        result.imageUrl = bgUrl;
        result.exportSettings = [
          { format: 'PNG', suffix: '', constraint: { type: 'SCALE', value: 2 } },
        ];
      }
    }
  } else {
    // Fallback: background color from CSS
    const bgColor = parseColor(styles['background-color']);
    if (bgColor) {
      result.fills = [{ type: 'SOLID', visible: true, color: bgColor }];
    } else {
      result.fills = [];
    }

    // CSS background-image: url(...) → IMAGE fill
    const bgImage = styles['background-image'];
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        const bgUrl = resolveProxyUrl(urlMatch[1]);
        result.fills = [
          ...(result.fills || []),
          { type: 'IMAGE', visible: true, scaleMode: 'FILL', imageRef: node.id, imageUrl: bgUrl },
        ];
        result.imageUrl = bgUrl;
        result.exportSettings = [
          { format: 'PNG', suffix: '', constraint: { type: 'SCALE', value: 2 } },
        ];
      }
    }
  }

  // Elements with rawHtml that aren't SVG root (e.g. picture, video poster)
  if (node.rawHtml && !isSvg && node.tagName !== 'img') {
    // Check if rawHtml contains SVG
    if (node.rawHtml.includes('<svg')) {
      result.svgData = node.rawHtml;
      result.exportSettings = [
        ...(result.exportSettings || []),
        { format: 'SVG', suffix: '' },
      ];
    }
  }

  // Strokes (border) — support individual sides
  const bt = parseFloat(styles['border-top-width'] || '0') || 0;
  const br = parseFloat(styles['border-right-width'] || '0') || 0;
  const bb = parseFloat(styles['border-bottom-width'] || '0') || 0;
  const bl = parseFloat(styles['border-left-width'] || '0') || 0;
  const hasBorder = bt > 0 || br > 0 || bb > 0 || bl > 0;

  if (hasBorder) {
    // Find the first non-zero border color
    const borderColor =
      (bt > 0 && parseColor(styles['border-top-color'])) ||
      (br > 0 && parseColor(styles['border-right-color'])) ||
      (bb > 0 && parseColor(styles['border-bottom-color'])) ||
      (bl > 0 && parseColor(styles['border-left-color'])) ||
      null;

    if (borderColor) {
      result.strokes = [{ type: 'SOLID', color: borderColor }];
      result.strokeAlign = 'INSIDE';

      // Check if all sides are equal
      if (bt === br && br === bb && bb === bl) {
        result.strokeWeight = bt;
      } else {
        // Individual stroke weights per side
        result.strokeWeight = Math.max(bt, br, bb, bl);
        result.strokeTopWeight = bt;
        result.strokeRightWeight = br;
        result.strokeBottomWeight = bb;
        result.strokeLeftWeight = bl;
      }
    }
  }

  // Margins
  const mt = parseFloat(styles['margin-top'] || '0') || 0;
  const mr = parseFloat(styles['margin-right'] || '0') || 0;
  const mb = parseFloat(styles['margin-bottom'] || '0') || 0;
  const ml = parseFloat(styles['margin-left'] || '0') || 0;
  if (mt) result.marginTop = mt;
  if (mr) result.marginRight = mr;
  if (mb) result.marginBottom = mb;
  if (ml) result.marginLeft = ml;

  // Corner radius — support individual corners
  const rtl = parseFloat(styles['border-top-left-radius'] || '0') || 0;
  const rtr = parseFloat(styles['border-top-right-radius'] || '0') || 0;
  const rbr = parseFloat(styles['border-bottom-right-radius'] || '0') || 0;
  const rbl = parseFloat(styles['border-bottom-left-radius'] || '0') || 0;
  if (rtl > 0 || rtr > 0 || rbr > 0 || rbl > 0) {
    if (rtl === rtr && rtr === rbr && rbr === rbl) {
      result.cornerRadius = rtl;
    } else {
      result.cornerRadius = Math.max(rtl, rtr, rbr, rbl);
      result.topLeftRadius = rtl;
      result.topRightRadius = rtr;
      result.bottomRightRadius = rbr;
      result.bottomLeftRadius = rbl;
    }
  }

  // Opacity
  const opacity = parseFloat(styles['opacity'] || '1');
  if (opacity < 1) result.opacity = opacity;

  // Box shadow → effects
  const shadow = styles['box-shadow'];
  if (shadow && shadow !== 'none') {
    const effect = parseShadow(shadow);
    if (effect) result.effects = [effect];
  }

  // Text properties (skip for components — they get an inner TEXT child instead)
  if (isText && node.textContent && !isComponent && !isInstance) {
    result.characters = node.textContent;
    result.textAlignHorizontal = mapTextAlign(styles['text-align']);
    result.textAlignVertical = mapTextValign(styles['text-valign'])
    result.style = {
      fontFamily: (styles['font-family'] || 'Inter').split(',')[0].replace(/['"]/g, ''),
      fontSize: parseFloat(styles['font-size'] || '16'),
      fontWeight: parseInt(styles['font-weight'] || '400') || 400,
      lineHeightPx: parseLineHeight(styles['line-height'], styles['font-size']),
      letterSpacing: parseFloat(styles['letter-spacing'] || '0') || 0,
      textDecoration: mapTextDecoration(styles['text-decoration']),
    };

    // Text color: use node.fills if available, otherwise fallback to CSS color
    if (node.fills && node.fills.length > 0) {
      result.fills = node.fills.map((f) => {
        const hex = f.color;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { type: 'SOLID' as const, visible: f.visible, color: { r, g, b, a: 1 }, opacity: f.opacity / 100 };
      });
    } else {
      const textColor = parseColor(styles['color']);
      if (textColor) {
        result.fills = [{ type: 'SOLID', visible: true, color: textColor }];
      }
    }
  }

  // Auto layout → Figma layout mode
  if (node.autoLayout) {
    const al = node.autoLayout;
    const isHoriz = al.direction === 'horizontal' || al.direction === 'wrap';
    result.layoutMode = isHoriz ? 'HORIZONTAL' : 'VERTICAL';
    if (al.direction === 'wrap') result.layoutWrap = 'WRAP';

    // Container sizing from node.sizing
    const sizing = node.sizing;
    if (sizing) {
      // Primary axis: horizontal for HORIZONTAL layout, vertical for VERTICAL
      const primarySizing = isHoriz ? sizing.horizontal : sizing.vertical;
      const counterSizing = isHoriz ? sizing.vertical : sizing.horizontal;
      result.primaryAxisSizingMode = primarySizing === 'hug' ? 'AUTO' : 'FIXED';
      result.counterAxisSizingMode = counterSizing === 'hug' ? 'AUTO' : 'FIXED';
    } else {
      result.primaryAxisSizingMode = 'AUTO';
      result.counterAxisSizingMode = 'AUTO';
    }

    result.primaryAxisAlignItems = mapAxisAlign(al.primaryAxisAlign);
    result.counterAxisAlignItems = mapCounterAlign(al.counterAxisAlign);
    result.paddingTop = al.padding.top;
    result.paddingRight = al.padding.right;
    result.paddingBottom = al.padding.bottom;
    result.paddingLeft = al.padding.left;
    result.itemSpacing = al.gap;
    if (al.direction === 'wrap') {
      result.counterAxisSpacing = al.counterAxisGap ?? al.gap;
    }
    // Overflow → clipsContent + overflowDirection
    if (al.overflow === 'scroll') {
      result.clipsContent = true;
      result.overflowDirection = 'VERTICAL_SCROLLING';
    } else if (al.overflow === 'hidden' || al.clipContent) {
      result.clipsContent = true;
    }
    // Grid metadata
    if (al.gridColumns) result.gridColumns = al.gridColumns;
    if (al.gridTemplateColumns) result.gridTemplateColumns = al.gridTemplateColumns;
  }

  // Components/Instances: ensure auto layout + add metadata
  if ((isComponent || isInstance) && !result.layoutMode) {
    // Auto layout: center aligned, no padding (Figma component convention)
    result.layoutMode = 'HORIZONTAL';
    result.primaryAxisSizingMode = 'AUTO';
    result.counterAxisSizingMode = 'AUTO';
    result.primaryAxisAlignItems = 'CENTER';
    result.counterAxisAlignItems = 'CENTER';
    result.itemSpacing = 0;
    result.paddingTop = 0;
    result.paddingRight = 0;
    result.paddingBottom = 0;
    result.paddingLeft = 0;
  }

  // Component metadata
  if (isComponent) {
    result.componentProperties = {
      componentId: node.componentId,
      source: 'penma',
    };
  }
  if (isInstance) {
    result.componentProperties = {
      componentRef: node.componentRef,
      source: 'penma',
    };
  }

  // Sizing / resizing from node.sizing (applies to all nodes, not just auto layout containers)
  if (node.sizing) {
    result.layoutSizingHorizontal = mapSizingMode(node.sizing.horizontal);
    result.layoutSizingVertical = mapSizingMode(node.sizing.vertical);

    // layoutGrow: 1 means fill along parent's primary axis
    if (node.sizing.horizontal === 'fill' || node.sizing.vertical === 'fill') {
      result.layoutGrow = 1;
    } else {
      result.layoutGrow = 0;
    }

    // layoutAlign: STRETCH if fill on counter axis
    result.layoutAlign = 'INHERIT';
  }

  // Width/height from CSS → min/max constraints
  const cssWidth = styles['width'];
  const cssHeight = styles['height'];
  const cssMinW = styles['min-width'];
  const cssMaxW = styles['max-width'];
  const cssMinH = styles['min-height'];
  const cssMaxH = styles['max-height'];
  if (cssMinW && cssMinW !== '0px' && cssMinW !== 'auto') {
    const v = parseFloat(cssMinW);
    if (!isNaN(v) && v > 0) result.minWidth = v;
  }
  if (cssMaxW && cssMaxW !== 'none') {
    const v = parseFloat(cssMaxW);
    if (!isNaN(v) && v > 0) result.maxWidth = v;
  }
  if (cssMinH && cssMinH !== '0px' && cssMinH !== 'auto') {
    const v = parseFloat(cssMinH);
    if (!isNaN(v) && v > 0) result.minHeight = v;
  }
  if (cssMaxH && cssMaxH !== 'none') {
    const v = parseFloat(cssMaxH);
    if (!isNaN(v) && v > 0) result.maxHeight = v;
  }

  // If no explicit sizing but has fixed width/height, set FIXED
  if (!node.sizing && !node.autoLayout) {
    if (cssWidth && cssWidth !== 'auto' && !cssWidth.includes('%')) {
      result.layoutSizingHorizontal = 'FIXED';
    }
    if (cssHeight && cssHeight !== 'auto' && !cssHeight.includes('%')) {
      result.layoutSizingVertical = 'FIXED';
    }
    // Percentage width inside a flex parent → FILL
    if (cssWidth && cssWidth.includes('%')) {
      result.layoutSizingHorizontal = 'FILL';
      result.layoutGrow = 1;
    }
    if (cssHeight && cssHeight.includes('%')) {
      result.layoutSizingVertical = 'FILL';
    }
  }

  // Children
  if (hasChildren && !isText) {
    result.children = node.children
      .filter((c) => c.visible)
      .map((c) => convertNode(c, offsetX, offsetY));
  }

  // Components/Instances with text content but no children:
  // Create an inner TEXT child node (Figma components are containers, not text nodes)
  if ((isComponent || isInstance) && node.textContent && !hasChildren) {
    const textColor = parseColor(styles['color']);
    const textChild: FigmaNode = {
      id: `${node.id}-text`,
      name: node.textContent.slice(0, 30),
      type: 'TEXT',
      visible: true,
      locked: false,
      absoluteBoundingBox: { ...result.absoluteBoundingBox },
      characters: node.textContent,
      textAlignHorizontal: mapTextAlign(styles['text-align']),
      textAlignVertical: mapTextValign(styles['text-valign']),
      style: {
        fontFamily: (styles['font-family'] || 'Inter').split(',')[0].replace(/['"]/g, ''),
        fontSize: parseFloat(styles['font-size'] || '16'),
        fontWeight: parseInt(styles['font-weight'] || '400') || 400,
        lineHeightPx: parseLineHeight(styles['line-height'], styles['font-size']),
        letterSpacing: parseFloat(styles['letter-spacing'] || '0') || 0,
        textDecoration: mapTextDecoration(styles['text-decoration']),
      },
      fills: textColor ? [{ type: 'SOLID', visible: true, color: textColor }] : [],
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    };
    result.children = [textChild];
    // Remove characters from the container — it's a frame, not text
    delete result.characters;
    delete result.style;
  }

  return result;
}

// ── Helpers ─────────────────────────────────────────────────

function parseColor(raw: string | undefined): FigmaColor | null {
  if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'none') return null;

  // rgb(r, g, b) / rgba(r, g, b, a)
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

  // color(srgb r g b) / color(srgb r g b / a) — modern Chrome format
  const srgbMatch = raw.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (srgbMatch) {
    const a = srgbMatch[4] !== undefined ? parseFloat(srgbMatch[4]) : 1;
    if (a < 0.01) return null;
    return {
      r: parseFloat(srgbMatch[1]),
      g: parseFloat(srgbMatch[2]),
      b: parseFloat(srgbMatch[3]),
      a,
    };
  }

  // #hex
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

function mapTextValign(valign: string | undefined): string {
  switch (valign) {
    case 'middle': return 'CENTER';
    case 'bottom': return 'BOTTOM';
    default: return 'TOP';
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

/** Resolve proxy URLs back to original URLs */
function resolveProxyUrl(url: string): string {
  if (url.includes('/api/proxy-asset')) {
    try {
      const u = new URL(url, 'http://localhost');
      const original = u.searchParams.get('url');
      if (original) return decodeURIComponent(original);
    } catch {}
  }
  return url;
}

/** Map Penma sizing mode to Figma layout sizing */
function mapSizingMode(mode: 'fixed' | 'hug' | 'fill'): string {
  switch (mode) {
    case 'fill': return 'FILL';
    case 'hug': return 'HUG';
    default: return 'FIXED';
  }
}
