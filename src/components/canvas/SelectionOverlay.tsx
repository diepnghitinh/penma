'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';
import { getSnappedPosition, getResizeSnap, getEqualSpacing, type SnapRect } from '@/lib/canvas/smart-guides';
import type { Rect } from '@/types/editor';

interface SelectionBox {
  id: string;
  rect: Rect;
}

type ResizeDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const SelectionOverlay: React.FC = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const camera = useEditorStore((s) => s.camera);
  const editEnabled = useEditorStore((s) => s.editEnabled);
  const editSettings = useEditorStore((s) => s.editSettings);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const updateNodeBounds = useEditorStore((s) => s.updateNodeBounds);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const documents = useEditorStore((s) => s.documents);
  const activePageId = useEditorStore((s) => s.activePageId);
  // activePageId ensures re-render on page switch
  void activePageId;

  const [selectionBoxes, setSelectionBoxes] = useState<SelectionBox[]>([]);
  const [hoverBox, setHoverBox] = useState<Rect | null>(null);

  // Check if hovered node is a component (master or instance)
  const isHoveredComponent = (() => {
    if (!hoveredId || selectedIds.includes(hoveredId)) return false;
    for (const doc of documents) {
      const node = findNodeById(doc.rootNode, hoveredId);
      if (node) return !!(node.componentId || node.componentRef);
    }
    return false;
  })();

  // Check if any selected node is a component instance (ref) — block editing
  const isSelectedInstance = (() => {
    if (selectedIds.length === 0) return false;
    for (const id of selectedIds) {
      for (const doc of documents) {
        const node = findNodeById(doc.rootNode, id);
        if (node?.componentRef) return true;
      }
    }
    return false;
  })();
  const rafRef = useRef<number>(0);

  // ── Drag-to-move state ──
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragNodeOriginal = useRef<{ id: string; top: number; left: number }[]>([]);
  /** Cached sibling screen rects (built once at drag start) */
  const siblingRectsRef = useRef<SnapRect[]>([]);
  /** Initial bounding box of all dragged elements in screen space */
  const dragInitialScreenRect = useRef<SnapRect>({ id: '', x: 0, y: 0, width: 0, height: 0 });

  // ── Resize state ──
  const [isResizing, setIsResizing] = useState(false);
  const resizeDir = useRef<ResizeDir>('se');
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, nodeId: '' });
  /** Cached sibling screen rects for resize snapping */
  const resizeSiblingRectsRef = useRef<SnapRect[]>([]);
  /** Initial screen rect of resizing element */
  const resizeInitScreenRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });

  // Read DOM rects without causing re-renders on every frame
  useEffect(() => {
    const update = () => {
      // Selection boxes
      const boxes: SelectionBox[] = [];
      for (const id of selectedIds) {
        const el = document.querySelector(`[data-penma-id="${id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          boxes.push({ id, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
        }
      }
      setSelectionBoxes((prev) => {
        if (prev.length !== boxes.length) return boxes;
        const changed = boxes.some((b, i) => {
          const p = prev[i];
          return !p || p.id !== b.id || Math.abs(p.rect.x - b.rect.x) > 0.5 || Math.abs(p.rect.y - b.rect.y) > 0.5 || Math.abs(p.rect.width - b.rect.width) > 0.5 || Math.abs(p.rect.height - b.rect.height) > 0.5;
        });
        return changed ? boxes : prev;
      });

      // Hover box
      if (hoveredId && !selectedIds.includes(hoveredId)) {
        const el = document.querySelector(`[data-penma-id="${hoveredId}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          setHoverBox((prev) => {
            if (prev && Math.abs(prev.x - rect.x) < 0.5 && Math.abs(prev.y - rect.y) < 0.5 && Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5) return prev;
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          });
        } else setHoverBox(null);
      } else setHoverBox(null);

      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [selectedIds, hoveredId]);

  // ── Move handlers ──
  const handleMoveStart = useCallback((e: React.PointerEvent) => {
    if (!editEnabled && editSettings.movable || selectedIds.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };

    // Capture original positions
    dragNodeOriginal.current = selectedIds.map((id) => {
      const el = document.querySelector(`[data-penma-id="${id}"]`) as HTMLElement | null;
      const cs = el ? window.getComputedStyle(el) : null;
      return {
        id,
        top: parseFloat(cs?.top || '0') || 0,
        left: parseFloat(cs?.left || '0') || 0,
      };
    });

    // Ensure position:relative for move
    for (const id of selectedIds) {
      const el = document.querySelector(`[data-penma-id="${id}"]`) as HTMLElement | null;
      if (el) {
        const pos = window.getComputedStyle(el).position;
        if (pos === 'static' || !pos) el.style.position = 'relative';
      }
    }

    // Cache sibling rects for smart guides (screen space)
    const selectedSet = new Set(selectedIds);
    const allEls = document.querySelectorAll('[data-penma-id]');
    const siblings: SnapRect[] = [];
    for (const el of allEls) {
      const id = el.getAttribute('data-penma-id')!;
      if (selectedSet.has(id)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        siblings.push({ id, x: r.x, y: r.y, width: r.width, height: r.height });
      }
    }
    siblingRectsRef.current = siblings;

    // Cache initial bounding box of dragged elements in screen space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of selectedIds) {
      const el = document.querySelector(`[data-penma-id="${id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
      }
    }
    dragInitialScreenRect.current = { id: '__drag__', x: minX, y: minY, width: maxX - minX, height: maxY - minY };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editEnabled && editSettings.movable, selectedIds]);

  useEffect(() => {
    if (!isDragging) return;

    const setSmartGuides = useEditorStore.getState().setSmartGuides;
    const clearSmartGuides = useEditorStore.getState().clearSmartGuides;
    /** Track the current snap correction for use in handleUp */
    let lastSnapDx = 0;
    let lastSnapDy = 0;

    const handleMove = (e: PointerEvent) => {
      const screenDx = e.clientX - dragStart.current.x;
      const screenDy = e.clientY - dragStart.current.y;

      // Tentative dragged bounding box in screen space
      const init = dragInitialScreenRect.current;
      const tentative: SnapRect = {
        id: '__drag__',
        x: init.x + screenDx,
        y: init.y + screenDy,
        width: init.width,
        height: init.height,
      };

      // Compute snap
      const snap = getSnappedPosition(tentative, siblingRectsRef.current);
      lastSnapDx = snap.dx;
      lastSnapDy = snap.dy;

      // Snapped rect for spacing detection
      const snapped: SnapRect = {
        ...tentative,
        x: tentative.x + snap.dx,
        y: tentative.y + snap.dy,
      };
      const spacings = getEqualSpacing(snapped, siblingRectsRef.current);
      setSmartGuides(snap.guides, spacings);

      // Apply to DOM (convert screen snap correction to document space)
      const dx = (screenDx + snap.dx) / camera.zoom;
      const dy = (screenDy + snap.dy) / camera.zoom;
      for (const orig of dragNodeOriginal.current) {
        const el = document.querySelector(`[data-penma-id="${orig.id}"]`) as HTMLElement | null;
        if (el) {
          el.style.top = `${orig.top + dy}px`;
          el.style.left = `${orig.left + dx}px`;
        }
      }
    };

    const handleUp = (e: PointerEvent) => {
      setIsDragging(false);
      clearSmartGuides();
      const screenDx = e.clientX - dragStart.current.x;
      const screenDy = e.clientY - dragStart.current.y;
      const dx = (screenDx + lastSnapDx) / camera.zoom;
      const dy = (screenDy + lastSnapDy) / camera.zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        pushHistory('Move element');
        for (const orig of dragNodeOriginal.current) {
          updateNodeStyles(orig.id, {
            position: 'relative',
            top: `${orig.top + dy}px`,
            left: `${orig.left + dx}px`,
          });
          // Sync bounds so sidebar attributes stay in sync
          const el = document.querySelector(`[data-penma-id="${orig.id}"]`) as HTMLElement | null;
          if (el) {
            const rect = el.getBoundingClientRect();
            updateNodeBounds(orig.id, {
              x: Math.round(rect.x / camera.zoom),
              y: Math.round(rect.y / camera.zoom),
            });
          }
        }
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      clearSmartGuides();
    };
  }, [isDragging, camera.zoom, pushHistory, updateNodeStyles]);

  // ── Resize handlers ──
  const handleResizeStart = useCallback((dir: ResizeDir, e: React.PointerEvent) => {
    if (!editEnabled && editSettings.resizable || selectedIds.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeDir.current = dir;

    const el = document.querySelector(`[data-penma-id="${selectedIds[0]}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect.width / camera.zoom,
      height: rect.height / camera.zoom,
      nodeId: selectedIds[0],
    };
    resizeInitScreenRef.current = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

    // Cache sibling element screen rects for snapping
    const nodeId = selectedIds[0];
    const allEls = document.querySelectorAll('[data-penma-id]');
    const siblings: SnapRect[] = [];
    allEls.forEach((sibEl) => {
      const sibId = sibEl.getAttribute('data-penma-id')!;
      if (sibId === nodeId) return;
      const r = sibEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        siblings.push({ id: sibId, x: r.x, y: r.y, width: r.width, height: r.height });
      }
    });
    resizeSiblingRectsRef.current = siblings;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editEnabled && editSettings.resizable, selectedIds, camera.zoom]);

  useEffect(() => {
    if (!isResizing) return;

    const setSmartGuides = useEditorStore.getState().setSmartGuides;
    const clearSmartGuides = useEditorStore.getState().clearSmartGuides;

    /** Compute tentative screen rect from resize direction and deltas */
    const computeResizeRect = (dx: number, dy: number): { x: number; y: number; w: number; h: number } => {
      const dir = resizeDir.current;
      const init = resizeInitScreenRef.current;
      let x = init.x;
      let y = init.y;
      let w = init.width;
      let h = init.height;
      if (dir.includes('e')) w += dx;
      if (dir.includes('w')) { w -= dx; x += dx; }
      if (dir.includes('s')) h += dy;
      if (dir.includes('n')) { h -= dy; y += dy; }
      w = Math.max(20 * camera.zoom, w);
      h = Math.max(20 * camera.zoom, h);
      return { x, y, w, h };
    };

    let lastSnapDx = 0;
    let lastSnapDy = 0;

    const handleMove = (e: PointerEvent) => {
      const screenDx = e.clientX - resizeStart.current.x;
      const screenDy = e.clientY - resizeStart.current.y;
      const dir = resizeDir.current;
      const el = document.querySelector(`[data-penma-id="${resizeStart.current.nodeId}"]`) as HTMLElement | null;
      if (!el) return;

      // Tentative screen rect
      const t = computeResizeRect(screenDx, screenDy);
      const tentative: SnapRect = { id: '__resize__', x: t.x, y: t.y, width: t.w, height: t.h };

      // Snap — only check the edges being resized
      const resizeEdges = {
        right: dir.includes('e'),
        left: dir.includes('w'),
        bottom: dir.includes('s'),
        top: dir.includes('n'),
      };
      const snap = getResizeSnap(tentative, resizeSiblingRectsRef.current, resizeEdges);
      lastSnapDx = snap.dx;
      lastSnapDy = snap.dy;
      setSmartGuides(snap.guides, []);

      // Compute final doc-space dimensions
      let newW = resizeStart.current.width;
      let newH = resizeStart.current.height;
      const adjDx = (screenDx + snap.dx) / camera.zoom;
      const adjDy = (screenDy + snap.dy) / camera.zoom;
      if (dir.includes('e')) newW += adjDx;
      if (dir.includes('w')) newW -= adjDx;
      if (dir.includes('s')) newH += adjDy;
      if (dir.includes('n')) newH -= adjDy;
      newW = Math.max(20, newW);
      newH = Math.max(20, newH);
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
    };

    const handleUp = (e: PointerEvent) => {
      setIsResizing(false);
      clearSmartGuides();

      const screenDx = e.clientX - resizeStart.current.x;
      const screenDy = e.clientY - resizeStart.current.y;
      const dir = resizeDir.current;
      let newW = resizeStart.current.width;
      let newH = resizeStart.current.height;
      const adjDx = (screenDx + lastSnapDx) / camera.zoom;
      const adjDy = (screenDy + lastSnapDy) / camera.zoom;
      if (dir.includes('e')) newW += adjDx;
      if (dir.includes('w')) newW -= adjDx;
      if (dir.includes('s')) newH += adjDy;
      if (dir.includes('n')) newH -= adjDy;
      newW = Math.max(20, newW);
      newH = Math.max(20, newH);
      pushHistory('Resize element');
      const nodeId = resizeStart.current.nodeId;
      updateNodeStyles(nodeId, {
        width: `${Math.round(newW)}px`,
        height: `${Math.round(newH)}px`,
      });
      // Sync bounds so sidebar attributes stay in sync
      const el = document.querySelector(`[data-penma-id="${nodeId}"]`) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        updateNodeBounds(nodeId, {
          x: Math.round(rect.x / camera.zoom),
          y: Math.round(rect.y / camera.zoom),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      clearSmartGuides();
    };
  }, [isResizing, camera.zoom, pushHistory, updateNodeStyles]);

  // ── Render ──
  const HANDLE_DIRS: { dir: ResizeDir; cls: string }[] = [
    { dir: 'nw', cls: 'absolute -left-1 -top-1 cursor-nw-resize' },
    { dir: 'ne', cls: 'absolute -right-1 -top-1 cursor-ne-resize' },
    { dir: 'sw', cls: 'absolute -left-1 -bottom-1 cursor-sw-resize' },
    { dir: 'se', cls: 'absolute -right-1 -bottom-1 cursor-se-resize' },
    { dir: 'n', cls: 'absolute left-1/2 -top-1 -translate-x-1/2 cursor-n-resize' },
    { dir: 's', cls: 'absolute left-1/2 -bottom-1 -translate-x-1/2 cursor-s-resize' },
    { dir: 'w', cls: 'absolute -left-1 top-1/2 -translate-y-1/2 cursor-w-resize' },
    { dir: 'e', cls: 'absolute -right-1 top-1/2 -translate-y-1/2 cursor-e-resize' },
  ];

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-overlay)' }}>
      {/* Hover highlight */}
      {hoverBox && (
        <div
          className="absolute"
          style={{
            left: hoverBox.x, top: hoverBox.y, width: hoverBox.width, height: hoverBox.height,
            border: isHoveredComponent ? '2px solid #ec4899' : '1px solid var(--penma-secondary)',
            opacity: isHoveredComponent ? 1 : 0.6,
          }}
        />
      )}

      {/* Selection boxes */}
      {selectionBoxes.map(({ id, rect }) => (
        <div
          key={id}
          className="absolute pointer-events-auto"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('penma:contextmenu', {
              detail: { x: e.clientX, y: e.clientY, nodeId: id },
            }));
          }}
        >
          {/* Selection border — pink for instances */}
          <div className="absolute inset-0 pointer-events-none" style={{ border: `2px solid ${isSelectedInstance ? '#ec4899' : 'var(--penma-primary)'}` }} />

          {/* Move area (pointer-events-auto) — disabled for instances */}
          {editEnabled && editSettings.movable && !isSelectedInstance && (
            <div
              className="absolute inset-0 pointer-events-auto"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onPointerDown={handleMoveStart}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('penma:contextmenu', {
                  detail: { x: e.clientX, y: e.clientY, nodeId: id },
                }));
              }}
              onDoubleClick={() => {
                if (!editEnabled || !editSettings.textEditable) return;
                const el = window.document.querySelector(`[data-penma-id="${id}"]`) as HTMLElement | null;
                if (!el) return;
                el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              }}
            />
          )}

          {/* Resize handles — disabled for instances */}
          {editEnabled && editSettings.resizable && selectionBoxes.length === 1 && !isSelectedInstance && (
            <>
              {HANDLE_DIRS.map(({ dir, cls }) => (
                <div
                  key={dir}
                  className={`${cls} h-2 w-2 pointer-events-auto`}
                  style={{ background: 'var(--penma-surface)', border: '1px solid var(--penma-primary)' }}
                  onPointerDown={(e) => handleResizeStart(dir, e)}
                />
              ))}
            </>
          )}

          {/* Size label — actual rendered dimensions */}
          <SizeLabel rect={rect} />
        </div>
      ))}
    </div>
  );
};

// ── Size label showing actual rendered dimensions ──

const SizeLabel: React.FC<{ rect: Rect }> = ({ rect }) => {
  const camera = useEditorStore((s) => s.camera);

  const w = Math.round(rect.width / camera.zoom * 100) / 100;
  const h = Math.round(rect.height / camera.zoom * 100) / 100;

  const fmt = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(2));

  return (
    <div
      className="absolute left-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] text-white pointer-events-none"
      style={{
        background: 'var(--penma-primary)',
        bottom: -20,
        transform: 'translateX(-50%)',
      }}
    >
      {fmt(w)} × {fmt(h)}
    </div>
  );
};
