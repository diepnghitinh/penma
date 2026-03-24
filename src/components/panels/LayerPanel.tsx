'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { getAncestorIds, findParentNode } from '@/lib/utils/tree-utils';
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

// ─── Drag reorder state (shared via context) ────────────────

interface DragState {
  dragId: string | null;
  dropTargetId: string | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
  setDrag: (id: string | null) => void;
  setDrop: (targetId: string | null, position: 'before' | 'after' | 'inside' | null) => void;
}

const DragContext = React.createContext<DragState>({
  dragId: null, dropTargetId: null, dropPosition: null,
  setDrag: () => {}, setDrop: () => {},
});

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
  const renameNode = useEditorStore((s) => s.renameNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const documents = useEditorStore((s) => s.documents);
  const drag = React.useContext(DragContext);

  const isSelected = selectedIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.ids.has(node.id);
  const label = node.name || node.tagName;
  const isMasterComponent = !!node.componentId;
  const isInstanceRef = !!node.componentRef;
  const isComponent = isMasterComponent || isInstanceRef;
  const tagIcon = isComponent ? (isInstanceRef ? '◇' : '◆') : (TAG_ICONS[node.tagName] || node.tagName.slice(0, 2).toUpperCase());
  const rowRef = useRef<HTMLDivElement>(null);

  // ── Rename state ──
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback(() => {
    setRenameValue(node.name || node.tagName);
    setIsRenaming(true);
    setTimeout(() => renameRef.current?.select(), 0);
  }, [node.name, node.tagName]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== (node.name || node.tagName)) {
      pushHistory('Rename element');
      renameNode(node.id, trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, node.id, node.name, node.tagName, renameNode, pushHistory]);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      select(node.id, e.shiftKey);
      const el = document.querySelector(`[data-penma-id="${node.id}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  // ── Drag handlers ──
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    drag.setDrag(node.id);
  }, [node.id, drag]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag.dragId === node.id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    if (hasChildren && ratio > 0.3 && ratio < 0.7) {
      drag.setDrop(node.id, 'inside');
    } else if (ratio <= 0.3) {
      drag.setDrop(node.id, 'before');
    } else {
      drag.setDrop(node.id, 'after');
    }
  }, [node.id, drag, hasChildren]);

  const handleDragLeave = useCallback(() => {
    if (drag.dropTargetId === node.id) drag.setDrop(null, null);
  }, [node.id, drag]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === node.id) { drag.setDrag(null); drag.setDrop(null, null); return; }

    // Find parent and index for drop
    let targetParentId: string | null = null;
    let targetIndex = 0;

    if (drag.dropPosition === 'inside') {
      targetParentId = node.id;
      targetIndex = 0; // insert at beginning
      expanded.expandAll([node.id]);
    } else {
      // Find parent of this node
      for (const doc of documents) {
        const parent = findParentNode(doc.rootNode, node.id);
        if (parent) {
          targetParentId = parent.id;
          const idx = parent.children.findIndex((c) => c.id === node.id);
          targetIndex = drag.dropPosition === 'after' ? idx + 1 : idx;
          break;
        }
      }
    }

    if (targetParentId) {
      pushHistory('Reorder element');
      reorderNode(draggedId, targetParentId, targetIndex);
    }
    drag.setDrag(null);
    drag.setDrop(null, null);
  }, [node.id, drag, documents, expanded, pushHistory, reorderNode]);

  // Drop indicator style
  const isDropTarget = drag.dropTargetId === node.id;
  const dropStyle: React.CSSProperties = {};
  if (isDropTarget) {
    if (drag.dropPosition === 'before') dropStyle.borderTop = '2px solid var(--penma-primary)';
    else if (drag.dropPosition === 'after') dropStyle.borderBottom = '2px solid var(--penma-primary)';
    else if (drag.dropPosition === 'inside') dropStyle.background = 'var(--penma-primary-light)';
  }

  return (
    <div>
      <div
        ref={rowRef}
        data-layer-id={node.id}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex h-7 cursor-pointer items-center text-xs hover:bg-neutral-100 ${
          isComponent
            ? isSelected ? 'bg-pink-50 text-pink-700' : 'text-pink-600'
            : isSelected ? 'bg-blue-50 text-blue-700' : 'text-neutral-600'
        } ${!node.visible ? 'opacity-40' : ''}`}
        style={{ paddingLeft: depth * 16 + 4, ...dropStyle }}
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
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

        {/* Label / Rename input */}
        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setIsRenaming(false);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-xs outline-none border-b"
            style={{ borderColor: 'var(--penma-primary)', color: 'var(--penma-text)' }}
            autoFocus
          />
        ) : (
          <span className="truncate flex-1">{label}</span>
        )}

        {/* Actions (visible on hover) */}
        {!isRenaming && (
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
        )}
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
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const removeDocument = useEditorStore((s) => s.removeDocument);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  // activePageId ensures re-render on page switch
  void activePageId;
  const expanded = useExpandedState();
  const prevSelectedRef = useRef<string[]>([]);

  // Drag reorder state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  const dragState: DragState = {
    dragId,
    dropTargetId,
    dropPosition,
    setDrag: setDragId,
    setDrop: (id, pos) => { setDropTargetId(id); setDropPosition(pos); },
  };

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

  // Auto-expand only the document header for new documents
  const expandedDocIds = useRef<Set<string>>(new Set());
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
    <DragContext.Provider value={dragState}>
      <div className="flex h-full flex-col">
        <div className="flex h-9 items-center px-3" style={{ borderBottom: '1px solid var(--penma-border)' }}>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
            Layers
          </span>
          <span className="ml-auto text-[9px] rounded-full px-1.5 py-0.5" style={{ background: 'var(--penma-primary-light)', color: 'var(--penma-primary)' }}>
            {documents.length}
          </span>
        </div>
        <div
          className="flex-1 overflow-y-auto py-1 penma-scrollbar"
          onDragOver={(e) => e.preventDefault()}
        >
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
    </DragContext.Provider>
  );
};
