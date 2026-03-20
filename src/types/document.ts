export interface PenmaDocument {
  id: string;
  sourceUrl: string;
  importedAt: string;
  viewport: { width: number; height: number };
  rootNode: PenmaNode;
  assets: Record<string, AssetReference>;
  /** Position of this frame on the canvas (top-left corner in document space) */
  canvasX: number;
  canvasY: number;
}

export interface PenmaNode {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  children: PenmaNode[];
  textContent?: string;
  /** Raw inner HTML for opaque elements (svg, canvas, picture). Rendered verbatim. */
  rawHtml?: string;
  styles: PenmaStyles;
  bounds: PenmaBounds;
  visible: boolean;
  locked: boolean;
  name?: string;
  autoLayout?: AutoLayout;
  sizing?: SizingMode;
  /** Unique ID identifying this node as a master component */
  componentId?: string;
  /** Points to a master component's componentId — this node is an instance (ref) */
  componentRef?: string;
}

// ── Auto Layout (Figma-style) ──────────────────────────────
export type LayoutDirection = 'horizontal' | 'vertical' | 'wrap';

export type PrimaryAxisAlign = 'start' | 'center' | 'end' | 'space-between';
export type CounterAxisAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

export type SizingMode = {
  horizontal: 'fixed' | 'hug' | 'fill';
  vertical: 'fixed' | 'hug' | 'fill';
};

export interface AutoLayout {
  direction: LayoutDirection;
  gap: number;
  padding: LayoutPadding;
  primaryAxisAlign: PrimaryAxisAlign;
  counterAxisAlign: CounterAxisAlign;
  /** When true, padding values can differ per side. Otherwise all sides share one value. */
  independentPadding: boolean;
  /** Clip content that overflows the frame */
  clipContent: boolean;
  /** Reverse the visual order of children */
  reverse: boolean;
  /** CSS grid: number of columns (e.g. from repeat(4, 1fr) → 4) */
  gridColumns?: number;
  /** Raw grid-template-columns value for export */
  gridTemplateColumns?: string;
}

export interface LayoutPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_AUTO_LAYOUT: AutoLayout = {
  direction: 'vertical',
  gap: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  primaryAxisAlign: 'start',
  counterAxisAlign: 'start',
  independentPadding: false,
  clipContent: true,
  reverse: false,
};

export const DEFAULT_SIZING: SizingMode = {
  horizontal: 'hug',
  vertical: 'hug',
};

export interface PenmaStyles {
  computed: Record<string, string>;
  overrides: Record<string, string>;
}

export interface PenmaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AssetReference {
  originalUrl: string;
  proxyUrl: string;
  type: 'image' | 'font' | 'stylesheet' | 'other';
}
