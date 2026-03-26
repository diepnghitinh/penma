'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Tool } from '@/types/editor';

export interface DragRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasDragResult {
  /** Current drag rect in screen coords (null if not dragging) */
  rect: DragRect | null;
  /** Raw start position in screen coords */
  startClient: React.RefObject<{ x: number; y: number }>;
  /** Whether a drag is active */
  isDragging: React.RefObject<boolean>;
  /** For shape tools: the frame element ID the drag started inside */
  targetFrameId: React.RefObject<string | null>;
  /** Call when drag completes to reset state */
  reset: () => void;
}

/**
 * Shared hook for drag-to-draw on the canvas.
 * Used by both MarqueeSelect (select tool) and ShapeCreator (shape tools).
 *
 * Returns a screen-space DragRect during drag, plus refs for start position
 * and target frame ID.
 *
 * @param canvasRef - Ref to the canvas DOM element
 * @param tools - Set of tool names that activate this drag behavior
 * @param minDistance - Minimum drag distance before rect appears (default 4)
 */
export function useCanvasDrag(
  canvasRef: React.RefObject<HTMLDivElement | null>,
  tools: Set<Tool>,
  minDistance = 4,
): CanvasDragResult {
  const activeTool = useEditorStore((s) => s.activeTool);
  const [rect, setRect] = useState<DragRect | null>(null);
  const isDragging = useRef(false);
  const startClient = useRef({ x: 0, y: 0 });
  const targetFrameId = useRef<string | null>(null);

  const isActive = tools.has(activeTool);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!isActive || e.button !== 0) return;
      const target = e.target as HTMLElement;

      // Don't start drag on UI overlays (debug panel, toolbars, etc.)
      if (target.closest('[data-penma-overlay]')) return;

      // For select tool: only on empty canvas (not on elements)
      // For shape tools: on empty canvas or inside frames
      const penmaEl = target.closest('[data-penma-id]') as HTMLElement | null;
      const frameEl = target.closest('[data-penma-frame]') as HTMLElement | null;

      if (activeTool === 'select') {
        if (penmaEl) return; // don't start marquee on elements
      } else {
        // Allow drawing on empty canvas, inside frames, or on the viewport background.
        // Block drawing on non-frame leaf elements (buttons, text, etc.)
        if (penmaEl && !frameEl) {
          // Check if the clicked element is a child of a penma element (not just the canvas root)
          // Allow if the penma element has no interactive content (it's just a container)
          const isCanvasRoot = penmaEl === target && !penmaEl.parentElement?.closest('[data-penma-id]');
          if (!isCanvasRoot) return;
        }
      }

      targetFrameId.current = frameEl?.getAttribute('data-penma-id') ?? null;
      isDragging.current = true;
      startClient.current = { x: e.clientX, y: e.clientY };
      setRect(null);

      if (frameEl) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [isActive, activeTool]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - startClient.current.x;
      const dy = e.clientY - startClient.current.y;
      if (Math.abs(dx) < minDistance && Math.abs(dy) < minDistance) return;
      setRect({
        x: Math.min(startClient.current.x, e.clientX),
        y: Math.min(startClient.current.y, e.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
    },
    [minDistance]
  );

  const handlePointerUp = useCallback(() => {
    // Don't reset isDragging here — let the consumer handle it via reset()
    // so they can read the final rect and start position
  }, []);

  const reset = useCallback(() => {
    isDragging.current = false;
    targetFrameId.current = null;
    setRect(null);
  }, []);

  useEffect(() => {
    if (!isActive) return;
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
  }, [isActive, canvasRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  // Change cursor when active
  useEffect(() => {
    if (!canvasRef.current) return;
    if (isActive && activeTool !== 'select') {
      canvasRef.current.style.cursor = 'crosshair';
    }
    return () => { if (canvasRef.current) canvasRef.current.style.cursor = ''; };
  }, [isActive, activeTool, canvasRef]);

  return { rect, startClient, isDragging, targetFrameId, reset };
}
