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
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const documents = useEditorStore((s) => s.documents);
  const activePageId = useEditorStore((s) => s.activePageId);
  // activePageId ensures re-render on page switch
  void activePageId;

  const [selectionBoxes, setSelectionBoxes] = useState<SelectionBox[]>([]);
  const [hoverBox, setHoverBox] = useState<Rect | null>(null);

  /**
   * DOM refs for each rendered selection box, keyed by node id.
   * Used during drag/resize to update the overlay imperatively without
   * triggering React re-renders or forced sync layout via measureBoxes.
   */
  const boxElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

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
  const dragNodeOriginal = useRef<{ id: string; el: HTMLElement; top: number; left: number; position: string; startScreenRect: { x: number; y: number; width: number; height: number } }[]>([]);
  /** Cached sibling screen rects (built once at drag start) */
  const siblingRectsRef = useRef<SnapRect[]>([]);
  /** Initial bounding box of all dragged elements in screen space */
  const dragInitialScreenRect = useRef<SnapRect>({ id: '', x: 0, y: 0, width: 0, height: 0 });

  // ── Resize state ──
  const [isResizing, setIsResizing] = useState(false);
  const resizeDir = useRef<ResizeDir>('se');
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, nodeId: '' });
  /** Cached DOM element ref for resize (avoid querySelector on every move) */
  const resizeElRef = useRef<HTMLElement | null>(null);
  /** Cached sibling screen rects for resize snapping */
  const resizeSiblingRectsRef = useRef<SnapRect[]>([]);
  /** Initial screen rect of resizing element */
  const resizeInitScreenRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });

  // Read DOM rects — triggered by selection/hover/camera changes, not continuous RAF.
  // Reads latest selection/hover via getState() so the callback is reference-stable
  // (empty deps). Previously this depended on selectedIds/hoveredId; if either ref
  // changed every render, the effect → RAF → setState → render loop hit max depth.
  const measureBoxes = useCallback(() => {
    const ids = useEditorStore.getState().selectedIds;
    const hovered = useEditorStore.getState().hoveredId;
    const boxes: SelectionBox[] = [];
    for (const id of ids) {
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

    if (hovered && !ids.includes(hovered)) {
      const el = document.querySelector(`[data-penma-id="${hovered}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHoverBox((prev) => {
          if (prev && Math.abs(prev.x - rect.x) < 0.5 && Math.abs(prev.y - rect.y) < 0.5 && Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5) return prev;
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
      } else setHoverBox((prev) => (prev === null ? prev : null));
    } else setHoverBox((prev) => (prev === null ? prev : null));
  }, []);

  // measureBoxes is reference-stable (empty deps), so this ref captures it once
  // and never needs reassignment — kept for handlers that already use the ref.
  const measureBoxesRef = useRef(measureBoxes);

  /** Write a screen rect directly to a selection box's DOM (no React render). */
  const writeBoxRect = useCallback((id: string, x: number, y: number, w: number, h: number, zoom: number) => {
    const el = boxElsRef.current.get(id);
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    const label = el.querySelector<HTMLElement>('[data-penma-size-label]');
    if (label) {
      const dw = w / zoom;
      const dh = h / zoom;
      const fmt = (v: number) => (v % 1 === 0 ? String(Math.round(v)) : (Math.round(v * 100) / 100).toFixed(2));
      label.textContent = `${fmt(dw)} × ${fmt(dh)}`;
    }
  }, []);

  // Measure on selection/hover change
  useEffect(() => {
    rafRef.current = requestAnimationFrame(measureBoxes);
    return () => cancelAnimationFrame(rafRef.current);
  }, [selectedIds, hoveredId, measureBoxes]);

  // Re-measure when camera changes (pan/zoom moves DOM elements)
  useEffect(() => {
    let prevCamera = useEditorStore.getState().camera;
    const unsub = useEditorStore.subscribe((state) => {
      if (state.camera !== prevCamera) {
        prevCamera = state.camera;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(measureBoxes);
      }
    });
    return unsub;
  }, [measureBoxes]);

  // ── Move handlers ──
  const handleMoveStart = useCallback((e: React.PointerEvent) => {
    if (!editEnabled && editSettings.movable || selectedIds.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };

    // Capture original positions, position type, and cache DOM element refs
    dragNodeOriginal.current = selectedIds.map((id) => {
      const el = document.querySelector(`[data-penma-id="${id}"]`) as HTMLElement | null;
      const cs = el ? window.getComputedStyle(el) : null;
      // Ensure element is positioned for move
      if (el) {
        const pos = cs?.position || '';
        if (pos === 'static' || !pos) el.style.position = 'relative';
      }
      const r = el ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
      return {
        id,
        el: el!,
        top: parseFloat(cs?.top || '0') || 0,
        left: parseFloat(cs?.left || '0') || 0,
        position: cs?.position || 'relative',
        startScreenRect: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    });

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
    for (const orig of dragNodeOriginal.current) {
      if (orig.el) {
        const r = orig.el.getBoundingClientRect();
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
    const updateNodeBounds = useEditorStore.getState().updateNodeBounds;
    /** RAF id for all visual updates */
    let moveRaf = 0;
    /** Latest pointer coords (sampled at pointer rate, applied at RAF rate) */
    let latestClientX = 0;
    let latestClientY = 0;
    /** True once we've crossed the move threshold and committed to the operation. */
    let movementCommitted = false;
    /**
     * Throttle store writes to ~30fps. The DOM/box update at 60fps for smooth
     * visuals; the store update is heavier (Immer + React reconcile of the
     * dragged node and all its ancestors), so we run it half as often.
     * The latest values are captured here and flushed in handleUp regardless.
     */
    let lastStoreWrite = 0;
    let pendingDx = 0;
    let pendingDy = 0;
    const STORE_THROTTLE_MS = 33;

    const flushStoreUpdate = (dx: number, dy: number) => {
      for (const orig of dragNodeOriginal.current) {
        updateNodeStyles(orig.id, {
          top: `${orig.top + dy}px`,
          left: `${orig.left + dx}px`,
        });
        updateNodeBounds(orig.id, {
          x: Math.round(orig.left + dx),
          y: Math.round(orig.top + dy),
        });
      }
    };

    const applyMove = () => {
      moveRaf = 0;
      const screenDx = latestClientX - dragStart.current.x;
      const screenDy = latestClientY - dragStart.current.y;

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

      const dx = (screenDx + snap.dx) / camera.zoom;
      const dy = (screenDy + snap.dy) / camera.zoom;

      // Wait for real movement before pushing history or mutating anything.
      if (!movementCommitted) {
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        movementCommitted = true;
        pushHistory('Move element');
        for (const orig of dragNodeOriginal.current) {
          // 'static' ignores top/left — coerce to 'relative' so top/left apply.
          if (orig.position === 'static' || !orig.position) {
            updateNodeStyles(orig.id, { position: 'relative' });
          }
        }
      }

      // Snapped rect for spacing detection
      const snapped: SnapRect = {
        ...tentative,
        x: tentative.x + snap.dx,
        y: tentative.y + snap.dy,
      };
      const spacings = getEqualSpacing(snapped, siblingRectsRef.current);
      setSmartGuides(snap.guides, spacings);

      const screenDxFinal = screenDx + snap.dx;
      const screenDyFinal = screenDy + snap.dy;

      // Imperative visual update: 60fps DOM + box mutations.
      for (const orig of dragNodeOriginal.current) {
        if (!orig.el) continue;
        orig.el.style.top = `${orig.top + dy}px`;
        orig.el.style.left = `${orig.left + dx}px`;
        const r = orig.startScreenRect;
        writeBoxRect(orig.id, r.x + screenDxFinal, r.y + screenDyFinal, r.width, r.height, camera.zoom);
      }

      // Throttled store update: 30fps. Always remember the latest delta so
      // handleUp can flush a final sync.
      pendingDx = dx;
      pendingDy = dy;
      const now = performance.now();
      if (now - lastStoreWrite >= STORE_THROTTLE_MS) {
        lastStoreWrite = now;
        flushStoreUpdate(dx, dy);
      }
    };

    const handleMove = (e: PointerEvent) => {
      latestClientX = e.clientX;
      latestClientY = e.clientY;
      if (!moveRaf) moveRaf = requestAnimationFrame(applyMove);
    };

    const handleUp = () => {
      setIsDragging(false);
      clearSmartGuides();
      if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; }
      // Final flush so the store matches the last DOM/box state.
      if (movementCommitted) flushStoreUpdate(pendingDx, pendingDy);
      measureBoxesRef.current();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (moveRaf) cancelAnimationFrame(moveRaf);
      clearSmartGuides();
    };
  }, [isDragging, camera.zoom, pushHistory, updateNodeStyles, writeBoxRect]);

  // ── Resize handlers ──
  const handleResizeStart = useCallback((dir: ResizeDir, e: React.PointerEvent) => {
    if (!editEnabled && editSettings.resizable || selectedIds.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeDir.current = dir;

    const el = document.querySelector(`[data-penma-id="${selectedIds[0]}"]`) as HTMLElement | null;
    if (!el) return;
    resizeElRef.current = el;
    const rect = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: rect.width / camera.zoom,
      height: rect.height / camera.zoom,
      top: parseFloat(cs.top) || 0,
      left: parseFloat(cs.left) || 0,
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
    const updateNodeBounds = useEditorStore.getState().updateNodeBounds;
    const updateSizing = useEditorStore.getState().updateSizing;
    const zoomVal = camera.zoom;

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
      w = Math.max(20 * zoomVal, w);
      h = Math.max(20 * zoomVal, h);
      return { x, y, w, h };
    };

    /** RAF id for all visual updates */
    let resizeRaf = 0;
    /** Latest pointer coords (sampled at pointer rate, applied at RAF rate) */
    let latestClientX = 0;
    let latestClientY = 0;
    /** True once the resize has crossed the threshold and committed to history. */
    let resizeCommitted = false;
    /**
     * Throttle store writes to ~30fps. DOM/box updates run at 60fps for smooth
     * visuals; the store update is heavier (Immer + React reconcile of the
     * resized node and all its ancestors), so we run it half as often.
     * The latest values are captured here and flushed in handleUp regardless.
     */
    let lastStoreWrite = 0;
    let pendingStyleUpdate: Record<string, string> | null = null;
    let pendingBoundsUpdate: Record<string, number> | null = null;
    const STORE_THROTTLE_MS = 33;

    const flushResizeStoreUpdate = () => {
      if (!pendingStyleUpdate || !pendingBoundsUpdate) return;
      const nodeId = resizeStart.current.nodeId;
      updateNodeStyles(nodeId, pendingStyleUpdate);
      updateNodeBounds(nodeId, pendingBoundsUpdate);
    };

    const applyResize = () => {
      resizeRaf = 0;
      const screenDx = latestClientX - resizeStart.current.x;
      const screenDy = latestClientY - resizeStart.current.y;
      const dir = resizeDir.current;
      const el = resizeElRef.current;
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

      // Compute final doc-space dimensions and position
      let newW = resizeStart.current.width;
      let newH = resizeStart.current.height;
      let newLeft = resizeStart.current.left;
      let newTop = resizeStart.current.top;
      const adjDx = (screenDx + snap.dx) / zoomVal;
      const adjDy = (screenDy + snap.dy) / zoomVal;
      if (dir.includes('e')) newW += adjDx;
      if (dir.includes('w')) { newW -= adjDx; newLeft += adjDx; }
      if (dir.includes('s')) newH += adjDy;
      if (dir.includes('n')) { newH -= adjDy; newTop += adjDy; }
      newW = Math.max(20, newW);
      newH = Math.max(20, newH);

      const nodeId = resizeStart.current.nodeId;

      // Wait for real movement before pushing history or mutating anything.
      if (!resizeCommitted) {
        if (Math.abs(adjDx) < 1 && Math.abs(adjDy) < 1) return;
        resizeCommitted = true;
        pushHistory('Resize element');
        // Flip sizing so width/height aren't stripped by DocumentRenderer's
        // hug/fill branch on subsequent renders.
        if (dir.includes('e') || dir.includes('w')) updateSizing(nodeId, 'horizontal', 'fixed');
        if (dir.includes('s') || dir.includes('n')) updateSizing(nodeId, 'vertical', 'fixed');
      }

      setSmartGuides(snap.guides, []);

      // Imperative DOM mutation: instant visual feedback even if React frame lags.
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
      if (dir.includes('w')) el.style.left = `${newLeft}px`;
      if (dir.includes('n')) el.style.top = `${newTop}px`;

      // Update the selection-box overlay imperatively from the snapped screen rect.
      const initR = resizeInitScreenRef.current;
      let boxX = initR.x;
      let boxY = initR.y;
      let boxW = initR.width;
      let boxH = initR.height;
      const sDx = screenDx + snap.dx;
      const sDy = screenDy + snap.dy;
      if (dir.includes('e')) boxW += sDx;
      if (dir.includes('w')) { boxW -= sDx; boxX += sDx; }
      if (dir.includes('s')) boxH += sDy;
      if (dir.includes('n')) { boxH -= sDy; boxY += sDy; }
      boxW = Math.max(20 * zoomVal, boxW);
      boxH = Math.max(20 * zoomVal, boxH);
      writeBoxRect(nodeId, boxX, boxY, boxW, boxH, zoomVal);

      // Throttled store update: 30fps. Always remember the latest values so
      // handleUp can flush a final sync.
      const styleUpdate: Record<string, string> = {
        width: `${Math.round(newW)}px`,
        height: `${Math.round(newH)}px`,
      };
      const boundsUpdate: Record<string, number> = {
        width: Math.round(newW),
        height: Math.round(newH),
      };
      if (dir.includes('w')) {
        styleUpdate.left = `${Math.round(newLeft)}px`;
        boundsUpdate.x = Math.round(newLeft);
      }
      if (dir.includes('n')) {
        styleUpdate.top = `${Math.round(newTop)}px`;
        boundsUpdate.y = Math.round(newTop);
      }
      pendingStyleUpdate = styleUpdate;
      pendingBoundsUpdate = boundsUpdate;
      const now = performance.now();
      if (now - lastStoreWrite >= STORE_THROTTLE_MS) {
        lastStoreWrite = now;
        flushResizeStoreUpdate();
      }
    };

    const handleMove = (e: PointerEvent) => {
      latestClientX = e.clientX;
      latestClientY = e.clientY;
      if (!resizeRaf) resizeRaf = requestAnimationFrame(applyResize);
    };

    const handleUp = () => {
      setIsResizing(false);
      clearSmartGuides();
      if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
      // Final flush so the store matches the last DOM/box state.
      if (resizeCommitted) flushResizeStoreUpdate();
      resizeElRef.current = null;
      measureBoxesRef.current();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      clearSmartGuides();
    };
  }, [isResizing, camera.zoom, pushHistory, updateNodeStyles, writeBoxRect]);

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
    <div className="pointer-events-none fixed inset-0" data-penma-overlay style={{ zIndex: 'var(--z-overlay)' }}>
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
          ref={(el) => {
            if (el) boxElsRef.current.set(id, el);
            else boxElsRef.current.delete(id);
          }}
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

          {/* Move area (pointer-events-auto) */}
          {editEnabled && editSettings.movable && (
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
      data-penma-size-label
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
