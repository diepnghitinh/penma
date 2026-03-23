import type { PenmaStyles } from '@/types/document';

export function getEffectiveStyles(styles: PenmaStyles): Record<string, string> {
  return { ...styles.computed, ...styles.overrides };
}

export function getEffectiveStyle(
  styles: PenmaStyles,
  property: string
): string | undefined {
  return styles.overrides[property] ?? styles.computed[property];
}

export function buildInlineStyle(styles: PenmaStyles): React.CSSProperties {
  const effective = getEffectiveStyles(styles);
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(effective)) {
    if (!value || value === 'initial' || value === 'none') continue;
    // Convert CSS property names to camelCase for React
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }

  return result as React.CSSProperties;
}

// CSS properties commonly useful for editing, grouped by category
export const STYLE_CATEGORIES = {
  layout: [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'flex-direction', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'grid-template-rows',
  ],
  size: [
    'width', 'height', 'min-width', 'min-height',
    'max-width', 'max-height', 'overflow',
  ],
  spacing: [
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  ],
  typography: [
    'font-family', 'font-size', 'font-weight', 'line-height',
    'letter-spacing', 'text-align', 'text-valign', 'text-decoration',
  ],
  background: [
    'background-image', 'background-size',
    'background-position', 'background-repeat',
  ],
  border: [
    'border-width', 'border-style', 'border-color', 'border-radius',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
  ],
  effects: [
    'opacity', 'box-shadow', 'transform', 'transition',
    'filter', 'backdrop-filter',
  ],
} as const;
