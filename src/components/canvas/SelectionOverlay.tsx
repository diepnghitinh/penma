'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
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

  const [selectionBoxes, setSelectionBoxes] = useState<SelectionBox[]>([]);
  const [hoverBox, setHoverBox] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);

  // ── Drag-to-move state ──
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragNodeOriginal = useRef<{ id: string; top: number; left: number }[]>([]);

  // ── Resize state ──
  const [isResizing, setIsResizing] = useState(false);
  const resizeDir = useRef<ResizeDir>('se');
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, nodeId: '' });

  const updateOverlays = useCallback(() => {
    const boxes: SelectionBox[] = [];
    for (const id of selectedIds) {
      const el = document.querySelector(`[data-penma-id="${id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        boxes.push({ id, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
      }
    }
    setSelectionBoxes(boxes);

    if (hoveredId && !selectedIds.includes(hoveredId)) {
      const el = document.querySelector(`[data-penma-id="${hoveredId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHoverBox({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      } else setHoverBox(null);
    } else setHoverBox(null);
  }, [selectedIds, hoveredId]);

  useEffect(() => {
    const update = () => {
      updateOverlays();
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateOverlays]);

  useEffect(() => { updateOverlays(); }, [camera, updateOverlays]);

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

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editEnabled && editSettings.movable, selectedIds]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const dx = (e.clientX - dragStart.current.x) / camera.zoom;
      const dy = (e.clientY - dragStart.current.y) / camera.zoom;
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
      const dx = (e.clientX - dragStart.current.x) / camera.zoom;
      const dy = (e.clientY - dragStart.current.y) / camera.zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        pushHistory('Move element');
        for (const orig of dragNodeOriginal.current) {
          updateNodeStyles(orig.id, {
            position: 'relative',
            top: `${orig.top + dy}px`,
            left: `${orig.left + dx}px`,
          });
        }
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
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

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editEnabled && editSettings.resizable, selectedIds, camera.zoom]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: PointerEvent) => {
      const dx = (e.clientX - resizeStart.current.x) / camera.zoom;
      const dy = (e.clientY - resizeStart.current.y) / camera.zoom;
      const dir = resizeDir.current;
      const el = document.querySelector(`[data-penma-id="${resizeStart.current.nodeId}"]`) as HTMLElement | null;
      if (!el) return;

      let newW = resizeStart.current.width;
      let newH = resizeStart.current.height;
      if (dir.includes('e')) newW += dx;
      if (dir.includes('w')) newW -= dx;
      if (dir.includes('s')) newH += dy;
      if (dir.includes('n')) newH -= dy;
      newW = Math.max(20, newW);
      newH = Math.max(20, newH);
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
    };

    const handleUp = (e: PointerEvent) => {
      setIsResizing(false);
      const dx = (e.clientX - resizeStart.current.x) / camera.zoom;
      const dy = (e.clientY - resizeStart.current.y) / camera.zoom;
      const dir = resizeDir.current;
      let newW = resizeStart.current.width;
      let newH = resizeStart.current.height;
      if (dir.includes('e')) newW += dx;
      if (dir.includes('w')) newW -= dx;
      if (dir.includes('s')) newH += dy;
      if (dir.includes('n')) newH -= dy;
      newW = Math.max(20, newW);
      newH = Math.max(20, newH);
      pushHistory('Resize element');
      updateNodeStyles(resizeStart.current.nodeId, {
        width: `${Math.round(newW)}px`,
        height: `${Math.round(newH)}px`,
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
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
            border: '1px solid var(--penma-secondary)',
            opacity: 0.6,
          }}
        />
      )}

      {/* Selection boxes */}
      {selectionBoxes.map(({ id, rect }) => (
        <div key={id} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
          {/* Selection border */}
          <div className="absolute inset-0" style={{ border: '2px solid var(--penma-primary)' }} />

          {/* Move area (pointer-events-auto) */}
          {editEnabled && editSettings.movable && (
            <div
              className="absolute inset-0 pointer-events-auto"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onPointerDown={handleMoveStart}
              onDoubleClick={() => {
                // Forward double-click to the underlying element for text editing
                if (!editEnabled || !editSettings.textEditable) return;
                const el = window.document.querySelector(`[data-penma-id="${id}"]`) as HTMLElement | null;
                if (!el) return;
                el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              }}
            />
          )}

          {/* Resize handles */}
          {editEnabled && editSettings.resizable && selectionBoxes.length === 1 && (
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

          {/* Size label */}
          <div
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] text-white"
            style={{ background: 'var(--penma-primary)' }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </div>
      ))}
    </div>
  );
};
