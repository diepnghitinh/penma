import type { AutoLayout, SizingMode, PenmaNode } from '@/types/document';

/**
 * Converts a PenmaNode's AutoLayout settings into CSS properties
 * that get applied to the container element.
 */
export function autoLayoutToContainerCSS(layout: AutoLayout): React.CSSProperties {
  const style: React.CSSProperties = {};

  // Base: flexbox
  style.display = 'flex';

  // Direction
  switch (layout.direction) {
    case 'horizontal':
      style.flexDirection = layout.reverse ? 'row-reverse' : 'row';
      break;
    case 'vertical':
      style.flexDirection = layout.reverse ? 'column-reverse' : 'column';
      break;
    case 'wrap':
      style.flexDirection = layout.reverse ? 'row-reverse' : 'row';
      style.flexWrap = 'wrap';
      break;
  }

  // Gap
  if (layout.direction === 'wrap' && layout.counterAxisGap !== undefined) {
    style.columnGap = `${layout.gap}px`;
    style.rowGap = `${layout.counterAxisGap}px`;
  } else {
    style.gap = `${layout.gap}px`;
  }

  // Primary axis alignment → justify-content
  switch (layout.primaryAxisAlign) {
    case 'start':
      style.justifyContent = 'flex-start';
      break;
    case 'center':
      style.justifyContent = 'center';
      break;
    case 'end':
      style.justifyContent = 'flex-end';
      break;
    case 'space-between':
      style.justifyContent = 'space-between';
      break;
  }

  // Counter axis alignment → align-items
  switch (layout.counterAxisAlign) {
    case 'start':
      style.alignItems = 'flex-start';
      break;
    case 'center':
      style.alignItems = 'center';
      break;
    case 'end':
      style.alignItems = 'flex-end';
      break;
    case 'stretch':
      style.alignItems = 'stretch';
      break;
    case 'baseline':
      style.alignItems = 'baseline';
      break;
  }

  // Padding
  const { top, right, bottom, left } = layout.padding;
  if (top === right && right === bottom && bottom === left) {
    style.padding = `${top}px`;
  } else {
    style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }

  // Clip content
  if (layout.clipContent) {
    style.overflow = 'hidden';
  }

  return style;
}

/**
 * Converts a child node's SizingMode into CSS properties
 * that control how the child sizes itself within the auto layout parent.
 */
export function sizingToChildCSS(
  sizing: SizingMode | undefined,
  parentDirection: AutoLayout['direction'] | undefined
): React.CSSProperties {
  if (!sizing || !parentDirection) return {};

  const style: React.CSSProperties = {};
  const isParentHoriz = parentDirection === 'horizontal' || parentDirection === 'wrap';

  // Horizontal sizing
  switch (sizing.horizontal) {
    case 'fixed':
      // Use the element's explicit width (don't override)
      style.flexShrink = 0;
      break;
    case 'hug':
      style.width = 'fit-content';
      break;
    case 'fill':
      if (isParentHoriz) {
        style.flexGrow = 1;
        style.flexShrink = 1;
        style.flexBasis = '0%';
      } else {
        style.width = '100%';
        style.alignSelf = 'stretch';
      }
      break;
  }

  // Vertical sizing
  switch (sizing.vertical) {
    case 'fixed':
      style.flexShrink = 0;
      break;
    case 'hug':
      style.height = 'fit-content';
      break;
    case 'fill':
      if (!isParentHoriz) {
        style.flexGrow = 1;
        style.flexShrink = 1;
        style.flexBasis = '0%';
      } else {
        style.height = '100%';
        style.alignSelf = 'stretch';
      }
      break;
  }

  return style;
}

/**
 * Detects if a node already uses flexbox layout based on its computed styles.
 * Used when importing a page to auto-detect existing auto layouts.
 */
export function detectAutoLayoutFromStyles(node: PenmaNode): boolean {
  const display = node.styles.computed['display'] || '';
  return display === 'flex' || display === 'inline-flex';
}
