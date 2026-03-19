'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';

interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Marquee (rectangle) selection.
 * Click+drag on canvas background with the Select tool to draw a selection box.
 * All elements whose bounding boxes intersect the marquee get selected.
 */
export const MarqueeSelect: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (activeTool !== 'select' || e.button !== 0) return;
      // Only start marquee on the canvas background itself
      if (e.target !== canvasRef.current) return;

      isDragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      setMarquee(null);
    },
    [activeTool, canvasRef]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;

      // Only show marquee after a minimum drag distance (avoids flicker on click)
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;

      setMarquee({
        x: Math.min(startPos.current.x, e.clientX),
        y: Math.min(startPos.current.y, e.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (!marquee || marquee.width < 4 || marquee.height < 4) {
      setMarquee(null);
      return;
    }

    // Find all penma elements that intersect the marquee
    const allElements = document.querySelectorAll('[data-penma-id]');
    const matchedEls: Element[] = [];

    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      if (rectsIntersect(marquee, rect)) {
        matchedEls.push(el);
      }
    }

    // Filter to only topmost parents — remove any element whose
    // ancestor is also in the matched set
    const matchedSet = new Set(matchedEls);
    const selectedIds: string[] = [];
    for (const el of matchedEls) {
      let ancestor = el.parentElement;
      let hasParentInSet = false;
      while (ancestor) {
        if (matchedSet.has(ancestor)) {
          hasParentInSet = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!hasParentInSet) {
        const id = el.getAttribute('data-penma-id');
        if (id) selectedIds.push(id);
      }
    }

    // Set selection
    if (selectedIds.length > 0) {
      useEditorStore.setState({ selectedIds });
    } else {
      useEditorStore.getState().clearSelection();
    }

    setMarquee(null);
  }, [marquee]);

  // Attach to window so we capture events even outside the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  if (!marquee) return null;

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: marquee.x,
        top: marquee.y,
        width: marquee.width,
        height: marquee.height,
        border: '1px solid var(--penma-primary)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        zIndex: 25,
      }}
    />
  );
};

function rectsIntersect(a: MarqueeRect, b: DOMRect): boolean {
  return !(
    a.x + a.width < b.left ||
    b.right < a.x ||
    a.y + a.height < b.top ||
    b.bottom < a.y
  );
}
