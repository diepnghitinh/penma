import type { AutoLayout, SizingMode } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';
import { mapJustify, mapAlign, parsePadding } from './css-mapping';

// ── Detect auto layout from computed CSS styles ─────────────

export function detectAutoLayout(
  styles: Record<string, string>,
  childCount: number = 0,
): AutoLayout | undefined {
  const display = styles['display'] || '';
  const flexGrow = parseFloat(styles['flex-grow'] || '0') || 0;

  // CSS Grid → wrap auto layout
  const isGrid = display === 'grid' || display === 'inline-grid';
  if (isGrid) {
    const columnGap = parseFloat(styles['column-gap'] || styles['gap'] || styles['grid-gap'] || '0') || 0;
    const rowGap = parseFloat(styles['row-gap'] || styles['gap'] || styles['grid-gap'] || '0') || 0;
    const { padding, independentPadding } = parsePadding(styles);
    const templateCols = styles['grid-template-columns'] || '';
    const justify = styles['justify-items'] || styles['justify-content'] || '';
    const align = styles['align-items'] || '';

    let gridColumns = 0;
    const repeatMatch = templateCols.match(/repeat\((\d+)/);
    if (repeatMatch) {
      gridColumns = parseInt(repeatMatch[1]);
    } else if (templateCols) {
      gridColumns = templateCols.trim().split(/\s+/).length;
    }

    return {
      ...DEFAULT_AUTO_LAYOUT,
      direction: 'wrap',
      gap: columnGap,
      counterAxisGap: rowGap !== columnGap ? rowGap : undefined,
      padding,
      independentPadding,
      primaryAxisAlign: mapJustify(justify),
      counterAxisAlign: mapAlign(align),
      gridColumns: gridColumns > 0 ? gridColumns : undefined,
      gridTemplateColumns: templateCols || undefined,
    };
  }

  // CSS table displays → auto layout
  const isTableRow = display === 'table-row';
  if (isTableRow && childCount > 0) {
    const { padding, independentPadding } = parsePadding(styles);
    return {
      ...DEFAULT_AUTO_LAYOUT,
      direction: 'horizontal',
      gap: 0,
      padding,
      independentPadding,
    };
  }
  const isTableVertical = display === 'table' || display === 'inline-table'
    || display === 'table-header-group' || display === 'table-row-group'
    || display === 'table-footer-group';
  if (isTableVertical && childCount > 0) {
    const { padding, independentPadding } = parsePadding(styles);
    return {
      ...DEFAULT_AUTO_LAYOUT,
      direction: 'vertical',
      gap: 0,
      padding,
      independentPadding,
    };
  }

  // Explicit flex container
  const isFlex = display === 'flex' || display === 'inline-flex';

  // Implicit vertical layout: flex:1 block element
  if (!isFlex && flexGrow > 0 && (display === 'block' || display === '' || !display)) {
    const gap = parseFloat(styles['gap'] || '0') || 0;
    const { padding, independentPadding } = parsePadding(styles);
    return {
      ...DEFAULT_AUTO_LAYOUT,
      direction: 'vertical',
      gap,
      padding,
      independentPadding,
      clipContent: styles['overflow-y'] === 'auto' || styles['overflow-y'] === 'scroll' || styles['overflow'] === 'auto',
    };
  }

  if (!isFlex) {
    // Block element with multiple children → default vertical auto layout
    const isBlock = !display || display === 'block' || display === 'list-item' || display === 'flow-root';
    if (isBlock && childCount > 1) {
      const gap = parseFloat(styles['gap'] || '0') || 0;
      const { padding, independentPadding } = parsePadding(styles);
      return {
        ...DEFAULT_AUTO_LAYOUT,
        direction: 'vertical',
        gap,
        padding,
        independentPadding,
      };
    }
    return undefined;
  }

  const flexDir = styles['flex-direction'] || 'row';
  const columnGap = parseFloat(styles['column-gap'] || styles['gap'] || '0') || 0;
  const rowGap = parseFloat(styles['row-gap'] || styles['gap'] || '0') || 0;
  const { padding, independentPadding } = parsePadding(styles);
  const wrap = styles['flex-wrap'] || '';

  let direction: 'horizontal' | 'vertical' | 'wrap' = 'horizontal';
  if (wrap === 'wrap') direction = 'wrap';
  else if (flexDir === 'column' || flexDir === 'column-reverse') direction = 'vertical';

  return {
    ...DEFAULT_AUTO_LAYOUT,
    direction,
    gap: columnGap,
    counterAxisGap: direction === 'wrap' && rowGap !== columnGap ? rowGap : undefined,
    padding,
    independentPadding,
    primaryAxisAlign: mapJustify(styles['justify-content'] || ''),
    counterAxisAlign: mapAlign(styles['align-items'] || ''),
    reverse: flexDir === 'row-reverse' || flexDir === 'column-reverse',
  };
}

// ── Detect child sizing from computed styles + parent context ──

export function detectChildSizing(
  childStyles: Record<string, string>,
  parentAutoLayout: AutoLayout | undefined,
): SizingMode {
  if (!parentAutoLayout) return { ...DEFAULT_SIZING };

  // inline-flex/inline-grid → always hug contents
  const display = childStyles['display'] || '';
  if (display === 'inline-flex' || display === 'inline-grid') {
    return { horizontal: 'hug', vertical: 'hug' };
  }

  const isParentHoriz = parentAutoLayout.direction === 'horizontal' || parentAutoLayout.direction === 'wrap';
  const flexGrow = parseFloat(childStyles['flex-grow'] || '0') || 0;
  const alignSelf = childStyles['align-self'] || '';
  const width = childStyles['width'] || 'auto';
  const height = childStyles['height'] || 'auto';

  let horizontal: 'fixed' | 'hug' | 'fill' = 'hug';
  let vertical: 'fixed' | 'hug' | 'fill' = 'hug';

  if (isParentHoriz) {
    // Primary axis (horizontal)
    if (flexGrow > 0) horizontal = 'fill';
    else if (width !== 'auto' && !width.includes('%')) horizontal = 'fixed';
    // Counter axis (vertical): only fill if child explicitly stretches via align-self
    if (height !== 'auto' && !height.includes('%')) vertical = 'fixed';
    else if (alignSelf === 'stretch') vertical = 'fill';
  } else {
    // Primary axis (vertical)
    if (flexGrow > 0) vertical = 'fill';
    else if (height !== 'auto' && !height.includes('%')) vertical = 'fixed';
    // Counter axis (horizontal): only fill if child explicitly stretches via align-self
    if (width !== 'auto' && !width.includes('%')) horizontal = 'fixed';
    else if (alignSelf === 'stretch') horizontal = 'fill';
  }

  if (parentAutoLayout.primaryAxisAlign === 'space-between') {
    if (isParentHoriz && (width.includes('%') || width === '100%')) horizontal = 'fill';
    if (!isParentHoriz && (height.includes('%') || height === '100%')) vertical = 'fill';
  }

  return { horizontal, vertical };
}
