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
    if (node.sizing.horizontal !== 'fixed') delete style.width;
    if (node.sizing.vertical !== 'fixed') delete style.height;

    const childCSS = sizingToChildCSS(node.sizing, parentAutoLayout.direction);
    Object.assign(style, childCSS);
  }

  const isSelected = selectedIds.includes(node.id);

  // Build safe attributes (filter out event handlers)
  const safeAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.attributes)) {
    if (key.startsWith('on') || key === 'style' || key === 'class') continue;
    safeAttrs[key] = value;
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
  const tagName = REMAP_TAGS[node.tagName] ?? node.tagName;
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

  return (
    <Tag
      data-penma-id={node.id}
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
