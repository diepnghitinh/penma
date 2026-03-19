/**
 * Penma → Figma Plugin
 *
 * Converts Penma JSON (or Figma-compatible JSON exported from Penma)
 * into real Figma design nodes.
 *
 * Supports:
 * - FRAME nodes with auto layout (layoutMode, padding, gap, alignment)
 * - TEXT nodes with font, size, weight, color
 * - RECTANGLE nodes with fills, strokes, corner radius
 * - Nested children
 * - Colors (SOLID fills)
 * - Effects (DROP_SHADOW)
 * - Opacity, visibility, locked state
 *
 * Input formats:
 * 1. Figma JSON (from Penma export) — has .document.children[0].children
 * 2. Penma Document JSON — has .rootNode with PenmaNode structure
 * 3. Single Figma node JSON — has .type directly
 */

figma.showUI(__html__, { width: 360, height: 480 });

let nodeCount = 0;

figma.ui.onmessage = async (msg: { type: string; data: any }) => {
  if (msg.type !== 'import' || !msg.data) return;

  try {
    nodeCount = 0;
    const data = msg.data;

    let rootNodes: SceneNode[];

    if (data.document && data.document.children) {
      // Figma JSON format (from Penma export)
      rootNodes = await importFigmaJson(data);
    } else if (data.rootNode) {
      // Penma Document JSON
      rootNodes = [await importPenmaNode(data.rootNode, null)];
    } else if (data.type) {
      // Single Figma node
      rootNodes = [await createFigmaNode(data, null)];
    } else {
      throw new Error('Unrecognized JSON format. Expected Penma or Figma JSON.');
    }

    // Position on canvas
    const viewport = figma.viewport.center;
    for (const node of rootNodes) {
      node.x = viewport.x - node.width / 2;
      node.y = viewport.y - node.height / 2;
      figma.currentPage.appendChild(node);
    }

    figma.viewport.scrollAndZoomIntoView(rootNodes);
    figma.ui.postMessage({ type: 'done', count: nodeCount });
  } catch (err: any) {
    figma.ui.postMessage({ type: 'error', message: err.message || 'Unknown error' });
  }
};

// ── Import Figma JSON ─────────────────────────────────────

async function importFigmaJson(data: any): Promise<SceneNode[]> {
  const pages = data.document.children || [];
  const results: SceneNode[] = [];

  for (const page of pages) {
    if (page.children) {
      for (const child of page.children) {
        const node = await createFigmaNode(child, null);
        results.push(node);
      }
    }
  }
  return results;
}

// ── Import Penma Node ─────────────────────────────────────

async function importPenmaNode(penmaNode: any, parent: FrameNode | null): Promise<SceneNode> {
  const isText = !!penmaNode.textContent && (!penmaNode.children || penmaNode.children.length === 0);
  const hasChildren = penmaNode.children && penmaNode.children.length > 0;

  if (isText) {
    return await createTextFromPenma(penmaNode);
  }

  const frame = figma.createFrame();
  nodeCount++;
  reportProgress();

  frame.name = penmaNode.name || penmaNode.tagName || 'Frame';
  frame.resize(
    Math.max(1, penmaNode.bounds?.width || 100),
    Math.max(1, penmaNode.bounds?.height || 100)
  );
  frame.visible = penmaNode.visible !== false;
  frame.locked = penmaNode.locked === true;

  // Fills
  const styles = { ...(penmaNode.styles?.computed || {}), ...(penmaNode.styles?.overrides || {}) };
  const bgColor = parseRgba(styles['background-color']);
  if (bgColor) {
    frame.fills = [{ type: 'SOLID', color: { r: bgColor.r, g: bgColor.g, b: bgColor.b }, opacity: bgColor.a }];
  } else {
    frame.fills = [];
  }

  // Border
  const borderColor = parseRgba(styles['border-top-color'] || styles['border-color']);
  const borderWidth = parseFloat(styles['border-top-width'] || styles['border-width'] || '0');
  if (borderColor && borderWidth > 0) {
    frame.strokes = [{ type: 'SOLID', color: { r: borderColor.r, g: borderColor.g, b: borderColor.b } }];
    frame.strokeWeight = borderWidth;
  }

  // Corner radius
  const radius = parseFloat(styles['border-top-left-radius'] || styles['border-radius'] || '0');
  if (radius > 0) frame.cornerRadius = radius;

  // Opacity
  const opacity = parseFloat(styles['opacity'] || '1');
  if (opacity < 1) frame.opacity = opacity;

  // Auto layout
  if (penmaNode.autoLayout) {
    const al = penmaNode.autoLayout;
    frame.layoutMode = (al.direction === 'horizontal' || al.direction === 'wrap') ? 'HORIZONTAL' : 'VERTICAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'AUTO';
    frame.itemSpacing = al.gap || 0;
    frame.paddingTop = al.padding?.top || 0;
    frame.paddingRight = al.padding?.right || 0;
    frame.paddingBottom = al.padding?.bottom || 0;
    frame.paddingLeft = al.padding?.left || 0;

    if (al.primaryAxisAlign === 'center') frame.primaryAxisAlignItems = 'CENTER';
    else if (al.primaryAxisAlign === 'end') frame.primaryAxisAlignItems = 'MAX';
    else if (al.primaryAxisAlign === 'space-between') frame.primaryAxisAlignItems = 'SPACE_BETWEEN';
    else frame.primaryAxisAlignItems = 'MIN';

    if (al.counterAxisAlign === 'center') frame.counterAxisAlignItems = 'CENTER';
    else if (al.counterAxisAlign === 'end') frame.counterAxisAlignItems = 'MAX';
    else if (al.counterAxisAlign === 'baseline') frame.counterAxisAlignItems = 'BASELINE';
    else frame.counterAxisAlignItems = 'MIN';

    if (al.clipContent) frame.clipsContent = true;
  }

  // Children
  if (hasChildren) {
    for (const child of penmaNode.children) {
      if (child.visible === false) continue;
      const childNode = await importPenmaNode(child, frame);
      frame.appendChild(childNode);
    }
  }

  return frame;
}

async function createTextFromPenma(penmaNode: any): Promise<TextNode> {
  const text = figma.createText();
  nodeCount++;
  reportProgress();

  const styles = { ...(penmaNode.styles?.computed || {}), ...(penmaNode.styles?.overrides || {}) };
  const fontFamily = (styles['font-family'] || 'Inter').split(',')[0].replace(/['"]/g, '').trim();
  const fontWeight = parseInt(styles['font-weight'] || '400') || 400;
  const fontStyle = mapFontWeight(fontWeight);

  // Load font — must succeed before setting characters
  let loadedFont = { family: 'Inter', style: 'Regular' };
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    loadedFont = { family: fontFamily, style: fontStyle };
  } catch {
    // Try font family with Regular style
    try {
      await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
      loadedFont = { family: fontFamily, style: 'Regular' };
    } catch {
      // Fallback to Inter Regular
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    }
  }

  // Set font BEFORE setting characters
  text.fontName = loadedFont as FontName;
  text.characters = penmaNode.textContent || '';
  text.name = penmaNode.name || `"${(penmaNode.textContent || '').slice(0, 20)}"`;

  // Font size
  const fontSize = parseFloat(styles['font-size'] || '16');
  if (fontSize > 0) text.fontSize = fontSize;

  // Line height
  const lh = styles['line-height'];
  if (lh && lh !== 'normal') {
    const lhPx = parseFloat(lh);
    if (!isNaN(lhPx) && lhPx > 0) {
      text.lineHeight = { value: lhPx, unit: 'PIXELS' };
    }
  }

  // Letter spacing
  const ls = parseFloat(styles['letter-spacing'] || '0');
  if (ls !== 0) text.letterSpacing = { value: ls, unit: 'PIXELS' };

  // Text color
  const color = parseRgba(styles['color']);
  if (color) {
    text.fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
  }

  // Text align
  const align = styles['text-align'];
  if (align === 'center') text.textAlignHorizontal = 'CENTER';
  else if (align === 'right') text.textAlignHorizontal = 'RIGHT';
  else if (align === 'justify') text.textAlignHorizontal = 'JUSTIFIED';

  // Size
  if (penmaNode.bounds) {
    text.resize(
      Math.max(1, penmaNode.bounds.width || 100),
      Math.max(1, penmaNode.bounds.height || 20)
    );
  }

  text.visible = penmaNode.visible !== false;
  text.locked = penmaNode.locked === true;

  return text;
}

// ── Create from Figma JSON format ─────────────────────────

async function createFigmaNode(data: any, parent: FrameNode | null): Promise<SceneNode> {
  const type = data.type;

  if (type === 'TEXT') {
    return await createTextNode(data);
  }

  if (type === 'RECTANGLE' || type === 'VECTOR') {
    return createRectNode(data);
  }

  // FRAME or default
  const frame = figma.createFrame();
  nodeCount++;
  reportProgress();

  frame.name = data.name || 'Frame';

  const bbox = data.absoluteBoundingBox;
  if (bbox) {
    frame.resize(Math.max(1, bbox.width), Math.max(1, bbox.height));
  }

  frame.visible = data.visible !== false;
  frame.locked = data.locked === true;

  // Fills
  if (data.fills && data.fills.length > 0) {
    frame.fills = data.fills.filter((f: any) => f.visible !== false).map((f: any) => ({
      type: 'SOLID',
      color: { r: f.color?.r || 0, g: f.color?.g || 0, b: f.color?.b || 0 },
      opacity: f.opacity ?? f.color?.a ?? 1,
    }));
  } else {
    frame.fills = [];
  }

  // Strokes
  if (data.strokes && data.strokes.length > 0) {
    frame.strokes = data.strokes.map((s: any) => ({
      type: 'SOLID',
      color: { r: s.color?.r || 0, g: s.color?.g || 0, b: s.color?.b || 0 },
    }));
    if (data.strokeWeight) frame.strokeWeight = data.strokeWeight;
  }

  // Corner radius
  if (data.cornerRadius) frame.cornerRadius = data.cornerRadius;

  // Opacity
  if (data.opacity !== undefined && data.opacity < 1) frame.opacity = data.opacity;

  // Effects
  if (data.effects) {
    frame.effects = data.effects.filter((e: any) => e.visible !== false).map((e: any) => ({
      type: e.type === 'DROP_SHADOW' ? 'DROP_SHADOW' : 'LAYER_BLUR',
      color: e.color ? { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a ?? 1 } : { r: 0, g: 0, b: 0, a: 0.25 },
      offset: e.offset || { x: 0, y: 0 },
      radius: e.radius || 0,
      visible: true,
    }));
  }

  // Auto layout
  if (data.layoutMode) {
    frame.layoutMode = data.layoutMode;
    if (data.primaryAxisSizingMode) frame.primaryAxisSizingMode = data.primaryAxisSizingMode as any;
    if (data.counterAxisSizingMode) frame.counterAxisSizingMode = data.counterAxisSizingMode as any;
    if (data.primaryAxisAlignItems) frame.primaryAxisAlignItems = data.primaryAxisAlignItems as any;
    if (data.counterAxisAlignItems) frame.counterAxisAlignItems = data.counterAxisAlignItems as any;
    if (data.paddingTop !== undefined) frame.paddingTop = data.paddingTop;
    if (data.paddingRight !== undefined) frame.paddingRight = data.paddingRight;
    if (data.paddingBottom !== undefined) frame.paddingBottom = data.paddingBottom;
    if (data.paddingLeft !== undefined) frame.paddingLeft = data.paddingLeft;
    if (data.itemSpacing !== undefined) frame.itemSpacing = data.itemSpacing;
  }

  // Children
  if (data.children) {
    for (const child of data.children) {
      const childNode = await createFigmaNode(child, frame);
      frame.appendChild(childNode);
    }
  }

  return frame;
}

async function createTextNode(data: any): Promise<TextNode> {
  const text = figma.createText();
  nodeCount++;
  reportProgress();

  const style = data.style || {};
  const fontFamily = style.fontFamily || 'Inter';
  const fontWeight = style.fontWeight || 400;
  const fontStyle = mapFontWeight(fontWeight);

  // Load font — must succeed before setting characters
  let loadedFont = { family: 'Inter', style: 'Regular' };
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    loadedFont = { family: fontFamily, style: fontStyle };
  } catch {
    try {
      await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
      loadedFont = { family: fontFamily, style: 'Regular' };
    } catch {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    }
  }

  // Set font BEFORE setting characters
  text.fontName = loadedFont as FontName;
  text.characters = data.characters || '';
  text.name = data.name || `"${(data.characters || '').slice(0, 20)}"`;

  if (style.fontSize) text.fontSize = style.fontSize;
  if (style.lineHeightPx) text.lineHeight = { value: style.lineHeightPx, unit: 'PIXELS' };
  if (style.letterSpacing) text.letterSpacing = { value: style.letterSpacing, unit: 'PIXELS' };
  if (style.textAlignHorizontal) text.textAlignHorizontal = style.textAlignHorizontal as any;

  // Text color from fills
  if (data.fills && data.fills.length > 0) {
    text.fills = data.fills.map((f: any) => ({
      type: 'SOLID',
      color: { r: f.color?.r || 0, g: f.color?.g || 0, b: f.color?.b || 0 },
      opacity: f.opacity ?? f.color?.a ?? 1,
    }));
  }

  const bbox = data.absoluteBoundingBox;
  if (bbox) {
    text.resize(Math.max(1, bbox.width), Math.max(1, bbox.height));
  }

  text.visible = data.visible !== false;
  text.locked = data.locked === true;

  return text;
}

function createRectNode(data: any): RectangleNode {
  const rect = figma.createRectangle();
  nodeCount++;
  reportProgress();

  rect.name = data.name || 'Rectangle';

  const bbox = data.absoluteBoundingBox;
  if (bbox) {
    rect.resize(Math.max(1, bbox.width), Math.max(1, bbox.height));
  }

  if (data.fills && data.fills.length > 0) {
    rect.fills = data.fills.map((f: any) => ({
      type: 'SOLID',
      color: { r: f.color?.r || 0, g: f.color?.g || 0, b: f.color?.b || 0 },
      opacity: f.opacity ?? f.color?.a ?? 1,
    }));
  }

  if (data.strokes && data.strokes.length > 0) {
    rect.strokes = data.strokes.map((s: any) => ({
      type: 'SOLID',
      color: { r: s.color?.r || 0, g: s.color?.g || 0, b: s.color?.b || 0 },
    }));
    if (data.strokeWeight) rect.strokeWeight = data.strokeWeight;
  }

  if (data.cornerRadius) rect.cornerRadius = data.cornerRadius;
  if (data.opacity !== undefined) rect.opacity = data.opacity;

  rect.visible = data.visible !== false;
  rect.locked = data.locked === true;

  return rect;
}

// ── Helpers ─────────────────────────────────────────────────

function parseRgba(raw: string | undefined): { r: number; g: number; b: number; a: number } | null {
  if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'none') return null;

  const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
    if (a < 0.01) return null;
    return {
      r: parseInt(match[1]) / 255,
      g: parseInt(match[2]) / 255,
      b: parseInt(match[3]) / 255,
      a,
    };
  }

  if (raw.startsWith('#')) {
    const hex = raw.replace('#', '');
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

function mapFontWeight(weight: number): string {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'Extra Light';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'Semi Bold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'Extra Bold';
  return 'Black';
}

function reportProgress() {
  if (nodeCount % 10 === 0) {
    figma.ui.postMessage({ type: 'progress', percent: Math.min(90, nodeCount) });
  }
}
