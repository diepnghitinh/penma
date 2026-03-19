'use client';

import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { getAncestorIds } from '@/lib/utils/tree-utils';
import type { PenmaNode } from '@/types/document';

const TAG_ICONS: Record<string, string> = {
  div: 'D', span: 'S', p: 'P',
  h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5', h6: 'H6',
  a: 'A', img: 'I', button: 'B', input: 'In', form: 'F',
  nav: 'N', header: 'Hd', footer: 'Ft', main: 'M',
  section: 'Sc', article: 'Ar', ul: 'UL', ol: 'OL', li: 'Li',
  svg: 'Sv', body: 'Bo',
};

// ─── Expanded-state store (local to this component tree) ────

interface ExpandedState {
  ids: Set<string>;
  toggle: (id: string) => void;
  expandAll: (ids: string[]) => void;
}

const useExpandedState = (): ExpandedState => {
  const [ids, setIds] = React.useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((toExpand: string[]) => {
    setIds((prev) => {
      const next = new Set(prev);
      for (const id of toExpand) next.add(id);
      return next;
    });
  }, []);

  return { ids, toggle, expandAll };
};

// ─── Layer item ─────────────────────────────────────────────

interface LayerItemProps {
  node: PenmaNode;
  depth: number;
  expanded: ExpandedState;
}

const LayerItem: React.FC<LayerItemProps> = ({ node, depth, expanded }) => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const toggleNodeVisibility = useEditorStore((s) => s.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((s) => s.toggleNodeLock);

  const isSelected = selectedIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.ids.has(node.id);
  const label = node.name || node.tagName;
  const tagIcon = TAG_ICONS[node.tagName] || node.tagName.slice(0, 2).toUpperCase();
  const rowRef = useRef<HTMLDivElement>(null);

  // Scroll into view when selected (e.g. from canvas click)
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      select(node.id, e.shiftKey);

      // Also scroll the canvas element into the viewport
      const el = document.querySelector(`[data-penma-id="${node.id}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    [node.id, select]
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      expanded.toggle(node.id);
    },
    [node.id, expanded]
  );

  return (
    <div>
      <div
        ref={rowRef}
        data-layer-id={node.id}
        className={`group flex h-7 cursor-pointer items-center text-xs hover:bg-neutral-100 ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'text-neutral-600'
        } ${!node.visible ? 'opacity-40' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={handleClick}
      >
        {/* Expand toggle */}
        <button
          className={`flex h-5 w-5 items-center justify-center ${
            hasChildren ? 'visible' : 'invisible'
          }`}
          onClick={handleToggle}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Tag icon */}
        <span className={`mr-1.5 flex h-4 min-w-[20px] items-center justify-center rounded text-[9px] font-mono ${
          isSelected ? 'bg-blue-100 text-blue-600' : 'bg-neutral-200 text-neutral-500'
        }`}>
          {tagIcon}
        </span>

        {/* Auto layout indicator */}
        {node.autoLayout && (
          <span className="mr-1 flex h-3.5 items-center justify-center rounded bg-purple-100 px-1 text-[8px] font-medium text-purple-600" title={`Auto layout: ${node.autoLayout.direction}`}>
            {node.autoLayout.direction === 'horizontal' ? '→' : node.autoLayout.direction === 'wrap' ? '↩' : '↓'}
          </span>
        )}

        {/* Label */}
        <span className="truncate flex-1">{label}</span>

        {/* Actions (visible on hover) */}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 pr-1">
          <button
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-200"
            onClick={(e) => {
              e.stopPropagation();
              toggleNodeVisibility(node.id);
            }}
            title={node.visible ? 'Hide' : 'Show'}
          >
            {node.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-200"
            onClick={(e) => {
              e.stopPropagation();
              toggleNodeLock(node.id);
            }}
            title={node.locked ? 'Unlock' : 'Lock'}
          >
            {node.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <LayerItem key={child.id} node={child} depth={depth + 1} expanded={expanded} />
        ))}
    </div>
  );
};

// ─── Layer panel ────────────────────────────────────────────

export const LayerPanel: React.FC = () => {
  const doc = useEditorStore((s) => s.document);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const expanded = useExpandedState();
  const prevSelectedRef = useRef<string[]>([]);

  // Auto-expand ancestors when selection changes (e.g. from canvas click)
  useEffect(() => {
    if (!doc || selectedIds.length === 0) return;

    // Only react to *new* selections, not removals
    const added = selectedIds.filter((id) => !prevSelectedRef.current.includes(id));
    prevSelectedRef.current = selectedIds;

    if (added.length === 0) return;

    const toExpand: string[] = [];
    for (const id of added) {
      const ancestors = getAncestorIds(doc.rootNode, id);
      toExpand.push(...ancestors);
    }
    if (toExpand.length > 0) {
      expanded.expandAll(toExpand);
    }
  }, [selectedIds, doc, expanded]);

  // Auto-expand first two levels on initial document load
  const initialExpanded = useRef(false);
  useEffect(() => {
    if (!doc || initialExpanded.current) return;
    initialExpanded.current = true;
    const toExpand: string[] = [];
    const walk = (node: PenmaNode, depth: number) => {
      if (depth < 2) {
        toExpand.push(node.id);
        for (const child of node.children) walk(child, depth + 1);
      }
    };
    walk(doc.rootNode, 0);
    expanded.expandAll(toExpand);
  }, [doc, expanded]);

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-neutral-400">
        <Layers size={24} className="mb-2" />
        <span className="text-xs">No layers</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center px-3" style={{ borderBottom: '1px solid var(--penma-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
          Layers
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <LayerItem node={doc.rootNode} depth={0} expanded={expanded} />
      </div>
    </div>
  );
};
