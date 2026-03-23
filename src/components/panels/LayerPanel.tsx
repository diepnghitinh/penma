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
  const isMasterComponent = !!node.componentId;
  const isInstanceRef = !!node.componentRef;
  const isComponent = isMasterComponent || isInstanceRef;
  const tagIcon = isComponent ? (isInstanceRef ? '◇' : '◆') : (TAG_ICONS[node.tagName] || node.tagName.slice(0, 2).toUpperCase());
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
          isComponent
            ? isSelected ? 'bg-pink-50 text-pink-700' : 'text-pink-600'
            : isSelected ? 'bg-blue-50 text-blue-700' : 'text-neutral-600'
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
          isComponent
            ? 'bg-pink-100 text-pink-600'
            : isSelected ? 'bg-blue-100 text-blue-600' : 'bg-neutral-200 text-neutral-500'
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
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const removeDocument = useEditorStore((s) => s.removeDocument);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const expanded = useExpandedState();
  const prevSelectedRef = useRef<string[]>([]);

  // Auto-expand ancestors when selection changes
  useEffect(() => {
    if (documents.length === 0 || selectedIds.length === 0) return;
    const added = selectedIds.filter((id) => !prevSelectedRef.current.includes(id));
    prevSelectedRef.current = selectedIds;
    if (added.length === 0) return;

    const toExpand: string[] = [];
    for (const id of added) {
      for (const doc of documents) {
        const ancestors = getAncestorIds(doc.rootNode, id);
        if (ancestors.length > 0) {
          toExpand.push(doc.id, ...ancestors);
          break;
        }
      }
    }
    if (toExpand.length > 0) expanded.expandAll(toExpand);
  }, [selectedIds, documents, expanded]);

  // Auto-expand first two levels on document load
  const expandedDocIds = useRef<Set<string>>(new Set());
  // Auto-expand only the document header (collapsed tree) for new documents
  useEffect(() => {
    const toExpand: string[] = [];
    for (const doc of documents) {
      if (expandedDocIds.current.has(doc.id)) continue;
      expandedDocIds.current.add(doc.id);
      toExpand.push(doc.id);
    }
    if (toExpand.length > 0) expanded.expandAll(toExpand);
  }, [documents, expanded]);

  if (documents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4" style={{ color: 'var(--penma-text-muted)' }}>
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
        <span className="ml-auto text-[9px] rounded-full px-1.5 py-0.5" style={{ background: 'var(--penma-primary-light)', color: 'var(--penma-primary)' }}>
          {documents.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1 penma-scrollbar">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const isDocExpanded = expanded.ids.has(doc.id);
          let hostname = doc.sourceUrl;
          try { hostname = new URL(doc.sourceUrl).hostname; } catch {}
          return (
            <div key={doc.id}>
              {/* Frame header */}
              <div
                className="group flex h-7 items-center gap-1 px-1 text-xs cursor-pointer"
                style={{
                  background: isActive ? 'var(--penma-primary-light)' : 'transparent',
                  color: isActive ? 'var(--penma-primary)' : 'var(--penma-text-secondary)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-heading)',
                }}
                onClick={() => { setActiveDocument(doc.id); expanded.toggle(doc.id); }}
              >
                <button className="flex h-5 w-5 items-center justify-center" onClick={(e) => { e.stopPropagation(); expanded.toggle(doc.id); }}>
                  {isDocExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <span className="truncate flex-1">{hostname}</span>
                <span className="text-[9px] font-normal" style={{ color: 'var(--penma-text-muted)' }}>
                  {doc.viewport.width}×{doc.viewport.height}
                </span>
                <button
                  className="h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 ml-1"
                  style={{ color: 'var(--penma-text-muted)' }}
                  onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }}
                  title="Remove frame"
                >
                  ×
                </button>
              </div>
              {isDocExpanded && (
                <LayerItem node={doc.rootNode} depth={1} expanded={expanded} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
