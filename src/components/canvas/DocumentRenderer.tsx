'use client';

import React, { useCallback, memo } from 'react';
import type { PenmaNode } from '@/types/document';
import { getEffectiveStyles } from '@/lib/styles/style-resolver';
import { autoLayoutToContainerCSS, sizingToChildCSS } from '@/lib/layout/auto-layout-engine';
import { useEditorStore } from '@/store/editor-store';

interface DocumentRendererProps {
  node: PenmaNode;
  depth?: number;
  parentAutoLayout?: PenmaNode['autoLayout'];
}

// Tags that should not have children rendered
const VOID_ELEMENTS = new Set([
  'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base',
  'col', 'embed', 'source', 'track', 'wbr',
]);

// Tags to skip rendering entirely
const SKIP_TAGS = new Set(['style', 'script', 'noscript', 'head']);

const DocumentRendererInner: React.FC<DocumentRendererProps> = ({ node, depth = 0, parentAutoLayout }) => {
  const select = useEditorStore((s) => s.select);
  const setHovered = useEditorStore((s) => s.setHovered);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editEnabled = useEditorStore((s) => s.editEnabled);
  const editSettings = useEditorStore((s) => s.editSettings);
  const updateNodeText = useEditorStore((s) => s.updateNodeText);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool !== 'select') return;
      e.stopPropagation();
      select(node.id, e.shiftKey);
    },
    [activeTool, node.id, select]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Select the element if not already selected
      if (!selectedIds.includes(node.id)) {
        select(node.id, false);
      }
      // Dispatch custom event for the ContextMenu component
      window.dispatchEvent(new CustomEvent('penma:contextmenu', {
        detail: { x: e.clientX, y: e.clientY, nodeId: node.id },
      }));
    },
    [node.id, selectedIds, select]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editEnabled || !editSettings.textEditable) return;
      // Allow editing if node has textContent, or is a leaf with visible text
      const hasEditableText = node.textContent || (e.currentTarget as HTMLElement).textContent?.trim();
      if (!hasEditableText) return;
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      el.contentEditable = 'true';
      el.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      const originalText = el.textContent?.trim() || '';
      const handleBlur = () => {
        el.contentEditable = 'false';
        const newText = el.textContent?.trim() || '';
        if (newText !== originalText) {
          pushHistory('Edit text');
          updateNodeText(node.id, newText);
        }
        el.removeEventListener('blur', handleBlur);
        el.removeEventListener('keydown', handleKey);
      };
      const handleKey = (ke: KeyboardEvent) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          el.blur();
        }
        if (ke.key === 'Escape') {
          el.textContent = originalText;
          el.blur();
        }
      };
      el.addEventListener('blur', handleBlur);
      el.addEventListener('keydown', handleKey);
    },
    [editEnabled, editSettings.textEditable, node.textContent, node.id, pushHistory, updateNodeText]
  );

  const handleMouseEnter = useCallback(() => {
    if (activeTool === 'select') {
      setHovered(node.id);
    }
  }, [activeTool, node.id, setHovered]);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
  }, [setHovered]);

  if (!node.visible || SKIP_TAGS.has(node.tagName)) return null;

  const effectiveStyles = getEffectiveStyles(node.styles);

  // Build style object, filtering out position-related properties
  // since we want elements to flow naturally in the document
  const style: React.CSSProperties = {};
  for (const [key, value] of Object.entries(effectiveStyles)) {
    if (!value || value === 'initial') continue;
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (style as any)[camelKey] = value;
  }

  // Preserve positioning that works within parent context (absolute, relative)
  // Only strip fixed/sticky which would break canvas containment
  const pos = style.position as string | undefined;
  if (pos === 'fixed' || pos === 'sticky') {
    delete style.position;
    delete style.top;
    delete style.right;
    delete style.bottom;
    delete style.left;
    delete style.zIndex;
  }
  // For static elements, offsets are meaningless — clean them
  if (!pos || pos === 'static') {
    delete style.top;
    delete style.right;
    delete style.bottom;
    delete style.left;
  }

  // For the body node, set some base styles
  if (node.tagName === 'body') {
    style.margin = '0';
    style.minHeight = 'auto';
  }

  // ── Auto Layout: strip computed flex props so the engine is sole authority ──
  if (node.autoLayout) {
    delete style.display;
    delete style.flexDirection;
    delete style.flexWrap;
    delete style.justifyContent;
    delete style.alignItems;
    delete style.alignContent;
    delete style.gap;
    delete style.rowGap;
    delete style.columnGap;
    delete style.padding;
    delete style.paddingTop;
    delete style.paddingRight;
    delete style.paddingBottom;
    delete style.paddingLeft;
    delete style.overflow;
    delete style.overflowX;
    delete style.overflowY;

    const layoutCSS = autoLayoutToContainerCSS(node.autoLayout);
    Object.assign(style, layoutCSS);
  }

  // ── Auto Layout: strip child sizing props so the engine controls them ──
  if (parentAutoLayout && node.sizing) {
    delete style.flexGrow;
    delete style.flexShrink;
    delete style.flexBasis;
    delete style.alignSelf;
    // Keep width/height only for 'fixed' mode
    if (node.sizing.horizontal === 'hug') {
      delete style.width;
      delete style.minWidth;
      delete style.maxWidth;
    } else if (node.sizing.horizontal === 'fill') {
      delete style.width;
      delete style.minWidth;
      delete style.maxWidth;
    } else if (!style.width) {
      style.width = `${node.bounds.width}px`;
    }
    if (node.sizing.vertical === 'hug') {
      delete style.height;
      delete style.minHeight;
      delete style.maxHeight;
    } else if (node.sizing.vertical === 'fill') {
      delete style.height;
      delete style.minHeight;
      delete style.maxHeight;
    } else if (!style.height) {
      style.height = `${node.bounds.height}px`;
    }

    const childCSS = sizingToChildCSS(node.sizing, parentAutoLayout.direction);
    Object.assign(style, childCSS);

    // Ensure fixed dimensions are enforced against parent padding compression
    if (node.sizing.horizontal === 'fixed' && style.width) {
      style.minWidth = style.width;
      style.boxSizing = 'border-box';
    }
    if (node.sizing.vertical === 'fixed' && style.height) {
      style.minHeight = style.height;
      style.boxSizing = 'border-box';
    }
  }

  // ── Sizing for non-auto-layout elements ──
  if (!parentAutoLayout && node.sizing) {
    if (node.sizing.horizontal === 'fixed') {
      if (!style.width) {
        style.width = `${node.bounds.width}px`;
      }
      style.minWidth = style.width;
      style.maxWidth = style.width;
      style.flexShrink = 0;
      style.boxSizing = 'border-box';
    } else if (node.sizing.horizontal === 'hug') {
      style.width = 'fit-content';
      delete style.minWidth;
      delete style.maxWidth;
    } else if (node.sizing.horizontal === 'fill') {
      style.width = '100%';
      delete style.minWidth;
      delete style.maxWidth;
      style.boxSizing = 'border-box';
    }
    if (node.sizing.vertical === 'fixed') {
      if (!style.height) {
        style.height = `${node.bounds.height}px`;
      }
      style.minHeight = style.height;
      style.maxHeight = style.height;
      style.flexShrink = 0;
      style.boxSizing = 'border-box';
    } else if (node.sizing.vertical === 'hug') {
      style.height = 'fit-content';
      delete style.minHeight;
      delete style.maxHeight;
    } else if (node.sizing.vertical === 'fill') {
      style.height = '100%';
      delete style.minHeight;
      delete style.maxHeight;
      style.boxSizing = 'border-box';
    }
  }

  // ── Text elements: strip spacing, apply vertical alignment ──
  const isTextElement = node.tagName === 'span'
    && !!node.textContent
    && node.children.length === 0;
  if (isTextElement) {
    delete style.padding;
    delete style.paddingTop;
    delete style.paddingRight;
    delete style.paddingBottom;
    delete style.paddingLeft;
    // Preserve margins/minWidth/minHeight for fixed sizing
    if (!node.sizing || (node.sizing.horizontal !== 'fixed' && node.sizing.vertical !== 'fixed')) {
      delete style.margin;
      delete style.marginTop;
      delete style.marginRight;
      delete style.marginBottom;
      delete style.marginLeft;
    }

    // Remove custom properties from inline style (not valid CSS)
    delete (style as Record<string, unknown>)['textValign'];
    delete style.textAlign;

    // Use flex to handle both text-align and text-valign
    const valign = effectiveStyles['text-valign'] || 'middle';
    const halign = effectiveStyles['text-align'] || 'left';

    const valignMap: Record<string, string> = {
      top: 'start', middle: 'center', bottom: 'end',
    };
    const halignMap: Record<string, string> = {
      left: 'start', center: 'center', right: 'end',
    };

    style.display = 'flex';
    style.alignItems = valignMap[valign] || 'start';
    style.justifyContent = halignMap[halign] || 'start';
  }

  // ── Gradient text detection ──
  // When background-clip: text is used with a background-image, it's a gradient text effect.
  // Preserve the background properties and don't override with fills.
  const bgClip = style.backgroundClip || style.WebkitBackgroundClip || '';
  const isGradientText = bgClip === 'text' && style.backgroundImage && style.backgroundImage !== 'none';

  // ── Fills: apply as background (div) or color (span text) ──
  if (node.fills && node.fills.length > 0 && !isGradientText) {
    const visibleFills = node.fills.filter((f) => f.visible);
    if (isTextElement) {
      // Text elements: fills apply as text color (topmost visible fill wins)
      if (visibleFills.length > 0) {
        const top = visibleFills[visibleFills.length - 1];
        const hex = top.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = top.opacity / 100;
        style.color = `rgba(${r},${g},${b},${a})`;
      } else {
        style.color = 'transparent';
      }
    } else {
      // Container elements: fills apply as layered backgrounds
      // Clear all background longhands first to avoid React shorthand/longhand conflict
      delete style.backgroundColor;
      delete style.backgroundImage;
      delete style.backgroundSize;
      delete style.backgroundPosition;
      delete style.backgroundRepeat;
      delete style.backgroundAttachment;
      delete style.backgroundOrigin;
      delete style.backgroundClip;
      if (visibleFills.length > 0) {
        const layers = [...visibleFills].reverse().map((f) => {
          const hex = f.color;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const a = f.opacity / 100;
          return `linear-gradient(rgba(${r},${g},${b},${a}), rgba(${r},${g},${b},${a}))`;
        });
        style.background = layers.join(', ');
      } else {
        style.background = 'transparent';
      }
    }
  }

  const isSelected = selectedIds.includes(node.id);

  // Build safe attributes (filter out event handlers, map to React camelCase)
  const HTML_TO_REACT: Record<string, string> = {
    srcset: 'srcSet',
    tabindex: 'tabIndex',
    colspan: 'colSpan',
    rowspan: 'rowSpan',
    maxlength: 'maxLength',
    minlength: 'minLength',
    readonly: 'readOnly',
    autocomplete: 'autoComplete',
    autofocus: 'autoFocus',
    crossorigin: 'crossOrigin',
    frameborder: 'frameBorder',
    cellpadding: 'cellPadding',
    cellspacing: 'cellSpacing',
    allowfullscreen: 'allowFullScreen',
    formaction: 'formAction',
    novalidate: 'noValidate',
    datetime: 'dateTime',
    for: 'htmlFor',
    fetchpriority: 'fetchPriority',
    loading: 'loading',
    decoding: 'decoding',
  };
  const safeAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.attributes)) {
    if (key.startsWith('on') || key === 'style' || key === 'class') continue;
    const reactKey = HTML_TO_REACT[key] || key;
    safeAttrs[reactKey] = value;
  }

  // Special handling for img tags
  if (node.tagName === 'img') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...safeAttrs}
        data-penma-id={node.id}
        style={{
          ...style,
          maxWidth: '100%',
          outline: isSelected ? '2px solid #2563eb' : undefined,
          cursor: activeTool === 'select' ? 'default' : undefined,
        }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        alt={safeAttrs.alt || ''}
        draggable={false}
      />
    );
  }

  // Opaque elements (svg, canvas, video, picture) — render raw HTML
  if (node.rawHtml) {
    return (
      <div
        data-penma-id={node.id}
        style={style}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        dangerouslySetInnerHTML={{ __html: node.rawHtml }}
      />
    );
  }

  // Remap tags that are invalid as children of <div>
  const REMAP_TAGS: Record<string, string> = {
    html: 'div', body: 'div', head: 'div',
    table: 'div', thead: 'div', tbody: 'div', tfoot: 'div',
    tr: 'div', td: 'div', th: 'div', caption: 'div',
    colgroup: 'div', col: 'div',
  };
  // Phrasing-only elements that cannot contain block-level children (div, section, etc.)
  const PHRASING_ONLY = new Set(['p', 'span', 'a', 'em', 'strong', 'small', 'b', 'i', 'u', 'label', 'abbr', 'cite', 'code', 'mark', 'sub', 'sup', 'time']);
  const hasBlockChildren = node.children.some((c) =>
    !PHRASING_ONLY.has(c.tagName) && !VOID_ELEMENTS.has(c.tagName) && c.tagName !== 'span',
  );
  let tagName = REMAP_TAGS[node.tagName] ?? node.tagName;
  if (PHRASING_ONLY.has(tagName) && hasBlockChildren) {
    tagName = 'div';
  }
  const Tag = tagName as keyof React.JSX.IntrinsicElements;
  const isVoid = VOID_ELEMENTS.has(node.tagName);

  // Void elements (input, br, hr, etc.) cannot have children
  if (isVoid) {
    return (
      <Tag
        data-penma-id={node.id}
        style={style}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />
    );
  }

  // Textarea/select: use defaultValue instead of children for text content
  if (node.tagName === 'textarea') {
    return (
      <textarea
        data-penma-id={node.id}
        style={style}
        defaultValue={node.textContent || ''}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        readOnly
      />
    );
  }

  return (
    <Tag
      data-penma-id={node.id}
      {...(node.autoLayout ? { 'data-penma-frame': 'true' } : {})}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {node.textContent && node.children.length === 0 && node.textContent}
      {node.textContent && node.children.length > 0 && node.textContent}
      {node.children.map((child) => (
        <DocumentRendererMemo
          key={child.id}
          node={child}
          depth={depth + 1}
          parentAutoLayout={node.autoLayout}
        />
      ))}
    </Tag>
  );
};

const DocumentRendererMemo = memo(DocumentRendererInner, (prev, next) => {
  return prev.node === next.node && prev.depth === next.depth && prev.parentAutoLayout === next.parentAutoLayout;
});

DocumentRendererMemo.displayName = 'DocumentRenderer';

export const DocumentRenderer = DocumentRendererMemo;
