'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getAncestorIds, findParentNode, findNodeById, flattenTree } from '@/lib/utils/tree-utils';
import type { PenmaNode } from '@/types/document';

const TAG_ICONS: Record<string, string> = {
  div: 'D', span: 'S', p: 'P',
  h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5', h6: 'H6',
  a: 'A', img: 'I', button: 'B', input: 'In', form: 'F',
  nav: 'N', header: 'Hd', footer: 'Ft', main: 'M',
  section: 'Sc', article: 'Ar', ul: 'UL', ol: 'OL', li: 'Li',
  svg: 'Sv', body: 'Bo',
};

// ─── Expanded-state store ───────────────────────────────────

interface ExpandedState {
  ids: Set<string>;
  toggle: (id: string) => void;
  expandAll: (ids: string[]) => void;
}

const useExpandedState = (): ExpandedState => {
  const [ids, setIds] = React.useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const expandAll = useCallback((toExpand: string[]) => {
    setIds((prev) => { const next = new Set(prev); for (const id of toExpand) next.add(id); return next; });
  }, []);
  return { ids, toggle, expandAll };
};

// ─── Pointer-based drag system ──────────────────────────────

interface DragInfo {
  nodeId: string;
  nodeName: string;
  startY: number;
  mode: 'reorder' | 'select';
}

interface DropTarget {
  targetId: string;
  position: 'before' | 'after' | 'inside';
  depth: number;
  /** Y position of the indicator line in the scroll container */
  indicatorY: number;
  /** Left offset for depth indentation */
  indicatorLeft: number;
}

// Check if nodeId is a descendant of ancestorId
function isDescendant(root: PenmaNode, ancestorId: string, nodeId: string): boolean {
  const ancestor = findNodeById(root, ancestorId);
  if (!ancestor) return false;
  return !!findNodeById(ancestor, nodeId) && ancestorId !== nodeId;
}

// ─── Visible node IDs (in tree order) ───────────────────────

function getVisibleNodeIds(node: PenmaNode, expandedIds: Set<string>): string[] {
  const result: string[] = [node.id];
  if (expandedIds.has(node.id) && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...getVisibleNodeIds(child, expandedIds));
    }
  }
  return result;
}

// ─── Layer item ─────────────────────────────────────────────

interface LayerItemProps {
  node: PenmaNode;
  depth: number;
  expanded: ExpandedState;
  dragInfo: DragInfo | null;
  dropTarget: DropTarget | null;
  onDragStart: (nodeId: string, nodeName: string, y: number, isSelected: boolean) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  visibleIds: string[];
}

const LayerItem: React.FC<LayerItemProps> = React.memo(({ node, depth, expanded, dragInfo, dropTarget, onDragStart, scrollRef, visibleIds }) => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const selectMultiple = useEditorStore((s) => s.selectMultiple);
  const lastSelectedId = useEditorStore((s) => s.lastSelectedId);
  const toggleNodeVisibility = useEditorStore((s) => s.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((s) => s.toggleNodeLock);
  const renameNode = useEditorStore((s) => s.renameNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const isSelected = selectedIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.ids.has(node.id);
  const label = node.name || node.tagName;
  const isMasterComponent = !!node.componentId;
  const isInstanceRef = !!node.componentRef;
  const isComponent = isMasterComponent || isInstanceRef;
  const tagIcon = isComponent ? (isInstanceRef ? '◇' : '◆') : (TAG_ICONS[node.tagName] || node.tagName.slice(0, 2).toUpperCase());
  const rowRef = useRef<HTMLDivElement>(null);
  const isDragged = dragInfo?.nodeId === node.id;

  // Rename state
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

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    select(node.id, false);
    window.dispatchEvent(new CustomEvent('penma:contextmenu', {
      detail: { x: e.clientX, y: e.clientY, nodeId: node.id },
    }));
  }, [node.id, select]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelectedId && visibleIds.length > 0) {
      // Range selection: select all items between anchor and clicked
      const anchorIdx = visibleIds.indexOf(lastSelectedId);
      const clickIdx = visibleIds.indexOf(node.id);
      if (anchorIdx !== -1 && clickIdx !== -1) {
        const start = Math.min(anchorIdx, clickIdx);
        const end = Math.max(anchorIdx, clickIdx);
        selectMultiple(visibleIds.slice(start, end + 1));
        const el = document.querySelector(`[data-penma-id="${node.id}"]`);
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
    }
    select(node.id, false);
    const el = document.querySelector(`[data-penma-id="${node.id}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [node.id, select, selectMultiple, lastSelectedId, visibleIds]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    expanded.toggle(node.id);
  }, [node.id, expanded]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isRenaming || e.button !== 0) return;
    // Don't start drag from buttons
    if ((e.target as HTMLElement).closest('button')) return;
    onDragStart(node.id, label, e.clientY, isSelected);
  }, [node.id, label, isRenaming, isSelected, onDragStart]);

  return (
    <div>
      <div
        ref={rowRef}
        data-layer-id={node.id}
        data-layer-depth={depth}
        className={`group flex h-7 cursor-pointer items-center text-xs select-none
          ${isComponent
            ? isSelected ? 'bg-pink-50 text-pink-700' : 'text-pink-600'
            : isSelected ? 'bg-blue-50 text-blue-700' : 'text-neutral-600'}
          ${!node.visible ? 'opacity-40' : ''}
          ${isDragged ? 'opacity-30' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onDoubleClick={(e) => { e.stopPropagation(); startRename(); }}
        onContextMenu={handleContextMenu}
      >
        {/* Expand toggle */}
        <button className={`flex h-5 w-5 items-center justify-center shrink-0 ${hasChildren ? 'visible' : 'invisible'}`} onClick={handleToggle}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Tag icon */}
        <span className={`mr-1.5 flex h-4 min-w-[20px] items-center justify-center rounded text-[9px] font-mono ${
          isComponent ? 'bg-pink-100 text-pink-600'
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
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setIsRenaming(false); e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-xs outline-none border-b"
            style={{ borderColor: 'var(--penma-primary)', color: 'var(--penma-text)' }}
            autoFocus
          />
        ) : (
          <span className="truncate flex-1">{label}</span>
        )}

        {/* Actions (visible on hover) */}
        {!isRenaming && !dragInfo && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 pr-1">
            <button className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-200"
              onClick={(e) => { e.stopPropagation(); toggleNodeVisibility(node.id); }} title={node.visible ? 'Hide' : 'Show'}>
              {node.visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-200"
              onClick={(e) => { e.stopPropagation(); toggleNodeLock(node.id); }} title={node.locked ? 'Unlock' : 'Lock'}>
              {node.locked ? <Lock size={11} /> : <Unlock size={11} />}
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && node.children.map((child) => (
        <LayerItem key={child.id} node={child} depth={depth + 1} expanded={expanded}
          dragInfo={dragInfo} dropTarget={dropTarget} onDragStart={onDragStart} scrollRef={scrollRef} visibleIds={visibleIds} />
      ))}
    </div>
  );
});
LayerItem.displayName = 'LayerItem';

// ─── Drop indicator line ────────────────────────────────────

const DropIndicator: React.FC<{ target: DropTarget }> = ({ target }) => {
  if (target.position === 'inside') {
    return (
      <div
        className="absolute pointer-events-none rounded"
        style={{
          left: target.indicatorLeft,
          top: target.indicatorY,
          right: 4,
          height: 28,
          border: '2px solid var(--penma-primary)',
          background: 'var(--penma-primary-light)',
          opacity: 0.5,
        }}
      />
    );
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: target.indicatorLeft,
        top: target.indicatorY - 1,
        right: 4,
        height: 2,
        background: 'var(--penma-primary)',
        borderRadius: 1,
      }}
    >
      {/* Circle at left end */}
      <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full" style={{ background: 'var(--penma-primary)' }} />
    </div>
  );
};

// ─── Ghost preview ──────────────────────────────────────────

const DragGhost: React.FC<{ name: string; y: number }> = ({ name, y }) => (
  <div
    className="fixed pointer-events-none flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-lg"
    style={{
      left: 20,
      top: y - 14,
      background: 'var(--penma-surface)',
      border: '1px solid var(--penma-primary)',
      color: 'var(--penma-primary)',
      zIndex: 9999,
      maxWidth: 180,
    }}
  >
    <span className="truncate">{name}</span>
  </div>
);

// ─── Layer panel ────────────────────────────────────────────

export const LayerPanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const removeDocument = useEditorStore((s) => s.removeDocument);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const selectMultiple = useEditorStore((s) => s.selectMultiple);
  const select = useEditorStore((s) => s.select);
  const lastSelectedId = useEditorStore((s) => s.lastSelectedId);
  const reorderNode = useEditorStore((s) => s.reorderNode);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  void activePageId;

  const expanded = useExpandedState();
  const prevSelectedRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Flat list of all visible node IDs in tree order (for range/drag selection)
  // Always include rootNode.id (the level-0 frame header is always visible)
  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const doc of documents) {
      if (!expanded.ids.has(doc.id)) {
        // Document collapsed — only the frame header (rootNode) is visible
        ids.push(doc.rootNode.id);
        continue;
      }
      ids.push(...getVisibleNodeIds(doc.rootNode, expanded.ids));
    }
    return ids;
  }, [documents, expanded.ids]);

  // ── Pointer-based drag state ──
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [ghostY, setGhostY] = useState(0);
  const dragThresholdMet = useRef(false);

  const handleDragStart = useCallback((nodeId: string, nodeName: string, y: number, isSelected: boolean) => {
    setDragInfo({ nodeId, nodeName, startY: y, mode: isSelected ? 'reorder' : 'select' });
    setGhostY(y);
    dragThresholdMet.current = false;
  }, []);

  // Pointer move/up during drag
  useEffect(() => {
    if (!dragInfo) return;

    const handleMove = (e: PointerEvent) => {
      // Check drag threshold (5px)
      if (!dragThresholdMet.current) {
        if (Math.abs(e.clientY - dragInfo.startY) < 5) return;
        dragThresholdMet.current = true;
        // For select mode, select the start item immediately
        if (dragInfo.mode === 'select') {
          select(dragInfo.nodeId, false);
        }
      }

      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      // ── Drag-to-select mode ──
      if (dragInfo.mode === 'select') {
        // Find the layer row closest to the cursor
        const els = scrollEl.querySelectorAll<HTMLElement>('[data-layer-id]');
        let closestId: string | null = null;
        let closestDist = Infinity;
        for (const el of els) {
          const id = el.getAttribute('data-layer-id')!;
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(e.clientY - (rect.top + rect.height / 2));
          if (dist < closestDist) {
            closestDist = dist;
            closestId = id;
          }
        }
        if (closestId) {
          const startIdx = visibleIds.indexOf(dragInfo.nodeId);
          const endIdx = visibleIds.indexOf(closestId);
          if (startIdx !== -1 && endIdx !== -1) {
            const from = Math.min(startIdx, endIdx);
            const to = Math.max(startIdx, endIdx);
            selectMultiple(visibleIds.slice(from, to + 1));
          }
        }
        return;
      }

      // ── Reorder mode ──
      setGhostY(e.clientY);

      const els = scrollEl.querySelectorAll<HTMLElement>('[data-layer-id]');
      let best: { el: HTMLElement; id: string; depth: number } | null = null;
      let bestDist = Infinity;

      for (const el of els) {
        const id = el.getAttribute('data-layer-id')!;
        if (id === dragInfo.nodeId) continue;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(e.clientY - (rect.top + rect.height / 2));
        if (dist < bestDist) {
          bestDist = dist;
          best = { el, id, depth: parseInt(el.getAttribute('data-layer-depth') || '0', 10) };
        }
      }

      if (!best) { setDropTarget(null); return; }

      // Check if dropping into own descendant (would create circular ref)
      let isOwnDescendant = false;
      for (const doc of documents) {
        if (isDescendant(doc.rootNode, dragInfo.nodeId, best.id)) {
          isOwnDescendant = true;
          break;
        }
      }
      if (isOwnDescendant) { setDropTarget(null); return; }

      const rect = best.el.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const relY = rect.top - scrollRect.top + scrollEl.scrollTop;
      const ratio = (e.clientY - rect.top) / rect.height;
      const CONTAINER_TAGS = new Set(['div', 'section', 'nav', 'header', 'footer', 'main', 'article', 'aside', 'ul', 'ol', 'form', 'body']);
      const isContainer = (() => {
        for (const doc of documents) {
          const n = findNodeById(doc.rootNode, best!.id);
          if (!n) continue;
          if (n.children.length > 0) return true;
          if (n.autoLayout) return true;
          if (CONTAINER_TAGS.has(n.tagName)) return true;
          if (doc.rootNode.id === n.id) return true;
        }
        return false;
      })();

      let position: 'before' | 'after' | 'inside';
      const indicatorDepth = best.depth;

      if (isContainer && ratio > 0.25 && ratio < 0.75) {
        position = 'inside';
      } else if (ratio <= 0.25) {
        position = 'before';
      } else {
        position = 'after';
      }

      setDropTarget({
        targetId: best.id,
        position,
        depth: indicatorDepth,
        indicatorY: position === 'before' ? relY : position === 'after' ? relY + rect.height : relY,
        indicatorLeft: indicatorDepth * 16 + 8,
      });
    };

    const handleUp = () => {
      if (dragThresholdMet.current && dragInfo.mode === 'reorder' && dropTarget && dragInfo) {
        let targetParentId: string | null = null;
        let targetIndex = 0;

        if (dropTarget.position === 'inside') {
          targetParentId = dropTarget.targetId;
          targetIndex = 0;
          expanded.expandAll([dropTarget.targetId]);
        } else {
          for (const doc of documents) {
            const parent = findParentNode(doc.rootNode, dropTarget.targetId);
            if (parent) {
              targetParentId = parent.id;
              const idx = parent.children.findIndex((c) => c.id === dropTarget.targetId);
              targetIndex = dropTarget.position === 'after' ? idx + 1 : idx;
              break;
            }
          }
        }

        if (targetParentId) {
          pushHistory('Reorder element');
          reorderNode(dragInfo.nodeId, targetParentId, targetIndex);
        }
      }

      setDragInfo(null);
      setDropTarget(null);
      dragThresholdMet.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragInfo(null);
        setDropTarget(null);
        dragThresholdMet.current = false;
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragInfo, dropTarget, documents, expanded, pushHistory, reorderNode, visibleIds, select, selectMultiple]);

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
        if (ancestors.length > 0) { toExpand.push(doc.id, ...ancestors); break; }
      }
    }
    if (toExpand.length > 0) expanded.expandAll(toExpand);
  }, [selectedIds, documents, expanded]);

  // Auto-expand document headers on load
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
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center px-3" style={{ borderBottom: '1px solid var(--penma-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
          Layers
        </span>
        <span className="ml-auto text-[9px] rounded-full px-1.5 py-0.5" style={{ background: 'var(--penma-primary-light)', color: 'var(--penma-primary)' }}>
          {documents.length}
        </span>
      </div>
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto py-1 penma-scrollbar">
        {documents.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const isDocExpanded = expanded.ids.has(doc.id);
          const isFrameSelected = selectedIds.includes(doc.rootNode.id);
          const isCanvasDoc = doc.sourceUrl === 'local://canvas';
          let hostname = isCanvasDoc ? 'Canvas' : doc.sourceUrl;
          if (!isCanvasDoc) { try { hostname = new URL(doc.sourceUrl).hostname; } catch {} }
          return (
            <div key={doc.id}>
              <div
                data-layer-id={doc.rootNode.id}
                data-layer-depth="0"
                className={`group flex h-7 items-center gap-1 px-1 text-xs cursor-pointer select-none
                  ${isFrameSelected ? 'bg-blue-50 text-blue-700' : ''}`}
                style={{
                  background: isFrameSelected ? undefined : (isActive ? 'var(--penma-primary-light)' : 'transparent'),
                  color: isFrameSelected ? undefined : (isActive ? 'var(--penma-primary)' : 'var(--penma-text-secondary)'),
                  fontWeight: 600, fontFamily: 'var(--font-heading)',
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  select(doc.rootNode.id, false);
                  window.dispatchEvent(new CustomEvent('penma:contextmenu', {
                    detail: { x: e.clientX, y: e.clientY, nodeId: doc.rootNode.id },
                  }));
                }}
                onClick={(e) => {
                  setActiveDocument(doc.id);
                  if (e.shiftKey && lastSelectedId && visibleIds.length > 0) {
                    const anchorIdx = visibleIds.indexOf(lastSelectedId);
                    const clickIdx = visibleIds.indexOf(doc.rootNode.id);
                    if (anchorIdx !== -1 && clickIdx !== -1) {
                      const start = Math.min(anchorIdx, clickIdx);
                      const end = Math.max(anchorIdx, clickIdx);
                      selectMultiple(visibleIds.slice(start, end + 1));
                      return;
                    }
                  }
                  select(doc.rootNode.id, false);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  if ((e.target as HTMLElement).closest('button')) return;
                  handleDragStart(doc.rootNode.id, hostname, e.clientY, isFrameSelected);
                }}
              >
                <button className="flex h-5 w-5 items-center justify-center" onClick={(e) => { e.stopPropagation(); expanded.toggle(doc.id); }}>
                  {isDocExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <span className="truncate flex-1">{hostname}</span>
                {!isCanvasDoc && (
                  <span className="text-[9px] font-normal" style={{ color: 'var(--penma-text-muted)' }}>
                    {doc.viewport.width}×{doc.viewport.height}
                  </span>
                )}
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
                <LayerItem node={doc.rootNode} depth={1} expanded={expanded}
                  dragInfo={dragThresholdMet.current ? dragInfo : null} dropTarget={dropTarget}
                  onDragStart={handleDragStart} scrollRef={scrollRef} visibleIds={visibleIds} />
              )}
            </div>
          );
        })}

        {/* Drop indicator (reorder mode only) */}
        {dragThresholdMet.current && dragInfo && dragInfo.mode === 'reorder' && dropTarget && <DropIndicator target={dropTarget} />}
      </div>

      {/* Ghost preview (reorder mode only) */}
      {dragThresholdMet.current && dragInfo && dragInfo.mode === 'reorder' && <DragGhost name={dragInfo.nodeName} y={ghostY} />}
    </div>
  );
};
