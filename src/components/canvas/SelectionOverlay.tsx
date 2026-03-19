'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Rect } from '@/types/editor';

interface SelectionBox {
  id: string;
  rect: Rect;
}

export const SelectionOverlay: React.FC = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const camera = useEditorStore((s) => s.camera);
  const [selectionBoxes, setSelectionBoxes] = useState<SelectionBox[]>([]);
  const [hoverBox, setHoverBox] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);

  const updateOverlays = useCallback(() => {
    // Get bounding rects for selected elements
    const boxes: SelectionBox[] = [];
    for (const id of selectedIds) {
      const el = document.querySelector(`[data-penma-id="${id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        boxes.push({
          id,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }
    }
    setSelectionBoxes(boxes);

    // Get bounding rect for hovered element
    if (hoveredId && !selectedIds.includes(hoveredId)) {
      const el = document.querySelector(`[data-penma-id="${hoveredId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHoverBox({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      } else {
        setHoverBox(null);
      }
    } else {
      setHoverBox(null);
    }
  }, [selectedIds, hoveredId]);

  useEffect(() => {
    const update = () => {
      updateOverlays();
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateOverlays]);

  // Also update when camera changes
  useEffect(() => {
    updateOverlays();
  }, [camera, updateOverlays]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Hover highlight */}
      {hoverBox && (
        <div
          className="absolute border border-blue-400/60"
          style={{
            left: hoverBox.x,
            top: hoverBox.y,
            width: hoverBox.width,
            height: hoverBox.height,
          }}
        />
      )}

      {/* Selection boxes */}
      {selectionBoxes.map(({ id, rect }) => (
        <div key={id} className="absolute" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
          {/* Selection border */}
          <div className="absolute inset-0 border-2 border-blue-500" />

          {/* Resize handles */}
          {selectionBoxes.length === 1 && (
            <>
              {/* Corners */}
              <div className="absolute -left-1 -top-1 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-nw-resize" />
              <div className="absolute -right-1 -top-1 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-ne-resize" />
              <div className="absolute -left-1 -bottom-1 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-sw-resize" />
              <div className="absolute -right-1 -bottom-1 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-se-resize" />
              {/* Edges */}
              <div className="absolute left-1/2 -top-1 -translate-x-1/2 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-n-resize" />
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-s-resize" />
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-w-resize" />
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-2 w-2 bg-white border border-blue-500 pointer-events-auto cursor-e-resize" />
            </>
          )}

          {/* Size label */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </div>
      ))}
    </div>
  );
};
