'use client';

import React, { useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useCanvasDrag, type DragRect } from './useCanvasDrag';
import type { Tool } from '@/types/editor';

const SELECT_TOOLS = new Set<Tool>(['select']);

/**
 * Marquee (rectangle) selection.
 * Click+drag on canvas background with the Select tool to draw a selection box.
 * All elements whose bounding boxes intersect the marquee get selected.
 */
export const MarqueeSelect: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const { rect, isDragging, reset } = useCanvasDrag(canvasRef, SELECT_TOOLS);

  // Handle pointer up — select intersecting elements
  useEffect(() => {
    const handleUp = () => {
      if (!isDragging.current) return;
      const marquee = rect;

      // Reset drag state first
      reset();

      if (!marquee || marquee.width < 4 || marquee.height < 4) return;

      // Find all penma elements that intersect the marquee
      const allElements = document.querySelectorAll('[data-penma-id]');
      const matchedEls: Element[] = [];
      for (const el of allElements) {
        const elRect = el.getBoundingClientRect();
        if (rectsIntersect(marquee, elRect)) {
          matchedEls.push(el);
        }
      }

      // Filter to only topmost parents
      const matchedSet = new Set(matchedEls);
      const selectedIds: string[] = [];
      for (const el of matchedEls) {
        let ancestor = el.parentElement;
        let hasParentInSet = false;
        while (ancestor) {
          if (matchedSet.has(ancestor)) { hasParentInSet = true; break; }
          ancestor = ancestor.parentElement;
        }
        if (!hasParentInSet) {
          const id = el.getAttribute('data-penma-id');
          if (id) selectedIds.push(id);
        }
      }

      if (selectedIds.length > 0) {
        useEditorStore.setState({ selectedIds });
      } else {
        useEditorStore.getState().clearSelection();
      }
    };

    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [rect, isDragging, reset]);

  if (!rect) return null;

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        border: '1px solid var(--penma-primary)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        zIndex: 9999,
      }}
    />
  );
};

function rectsIntersect(a: DragRect, b: DOMRect): boolean {
  return !(
    a.x + a.width < b.left ||
    b.right < a.x ||
    a.y + a.height < b.top ||
    b.bottom < a.y
  );
}
