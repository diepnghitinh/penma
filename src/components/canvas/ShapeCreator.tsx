'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useEditorStore } from '@/store/editor-store';
import { screenToDocument } from '@/lib/canvas/coordinates';
import type { PenmaNode } from '@/types/document';
import type { Tool } from '@/types/editor';

const SHAPE_TOOLS = new Set<Tool>([
  'rectangle', 'ellipse', 'line', 'arrow', 'star', 'polygon', 'frame', 'text',
]);

/** Screen-space rectangle (clientX/clientY coords) */
interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ShapeCreator: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const activeTool = useEditorStore((s) => s.activeTool);

  // Preview rect in screen coords — single source of truth during drawing
  const [preview, setPreview] = useState<ScreenRect | null>(null);
  const isDrawing = useRef(false);
  const startClient = useRef({ x: 0, y: 0 });
  const targetFrameId = useRef<string | null>(null);

  const isShapeTool = SHAPE_TOOLS.has(activeTool);

  // ── Pointer down — start drawing ──────────────────────────

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!isShapeTool || e.button !== 0) return;
      const target = e.target as HTMLElement;

      const frameEl = target.closest('[data-penma-frame]') as HTMLElement | null;
      const penmaEl = target.closest('[data-penma-id]') as HTMLElement | null;
      if (penmaEl && !frameEl) return;

      targetFrameId.current = frameEl?.getAttribute('data-penma-id') ?? null;
      isDrawing.current = true;
      startClient.current = { x: e.clientX, y: e.clientY };
      setPreview(null);

      if (frameEl) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [isShapeTool]
  );

  // ── Pointer move — update preview in screen coords ────────

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing.current) return;
      const x = Math.min(startClient.current.x, e.clientX);
      const y = Math.min(startClient.current.y, e.clientY);
      const w = Math.abs(e.clientX - startClient.current.x);
      const h = Math.abs(e.clientY - startClient.current.y);
      if (w > 3 || h > 3) {
        setPreview({ x, y, width: w, height: h });
      }
    },
    []
  );

  // ── Pointer up — convert screen→document, create shape ────

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;

      const store = useEditorStore.getState();
      const cam = store.camera;
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) { setPreview(null); return; }

      // Convert start & end from screen (clientX/Y) → document space
      const toDoc = (cx: number, cy: number) =>
        screenToDocument({ x: cx - canvasRect.left, y: cy - canvasRect.top }, cam);

      const startDoc = toDoc(startClient.current.x, startClient.current.y);
      const endDoc = toDoc(e.clientX, e.clientY);

      let w = Math.abs(endDoc.x - startDoc.x);
      let h = Math.abs(endDoc.y - startDoc.y);

      // Minimum size for click-without-drag
      if (w < 10) w = activeTool === 'line' || activeTool === 'arrow' ? 200 : 100;
      if (h < 10) h = activeTool === 'line' || activeTool === 'arrow' ? 2 : 100;

      let finalX = Math.min(startDoc.x, endDoc.x);
      let finalY = Math.min(startDoc.y, endDoc.y);

      const drawnInFrameId = targetFrameId.current;

      if (drawnInFrameId) {
        // Inside a frame: position relative to frame element
        const frameEl = canvasRef.current?.querySelector(`[data-penma-id="${drawnInFrameId}"]`) as HTMLElement | null;
        if (frameEl) {
          const frameRect = frameEl.getBoundingClientRect();
          const sx = Math.min(startClient.current.x, e.clientX);
          const sy = Math.min(startClient.current.y, e.clientY);
          finalX = (sx - frameRect.left) / cam.zoom;
          finalY = (sy - frameRect.top) / cam.zoom;
        }
      }

      const node = createShapeNode(activeTool, finalX, finalY, w, h);
      if (node) {
        store.pushHistory(`Create ${activeTool}`);
        if (drawnInFrameId) {
          store.addNodeToParent(drawnInFrameId, node);
        } else {
          store.addCanvasNode(node);
        }
        store.select(node.id);
        store.setActiveTool('select');
      }
      targetFrameId.current = null;
      setPreview(null);
    },
    [activeTool, canvasRef]
  );

  // ── Register/unregister event listeners ───────────────────

  useEffect(() => {
    if (!isShapeTool) return;
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
  }, [isShapeTool, canvasRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  // ── Cursor ────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.style.cursor = isShapeTool ? 'crosshair' : '';
    return () => { if (canvasRef.current) canvasRef.current.style.cursor = ''; };
  }, [isShapeTool, canvasRef]);

  // ── Preview overlay ───────────────────────────────────────
  // Rendered in screen coords (position: fixed) — exactly where the user dragged.
  // No coordinate conversion needed — what you see is what you get.

  if (!preview) return null;

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: preview.x,
        top: preview.y,
        width: preview.width,
        height: preview.height,
        border: '2px solid var(--penma-primary)',
        background: 'rgba(59, 130, 246, 0.06)',
        borderRadius: activeTool === 'ellipse' ? '50%' : activeTool === 'rectangle' || activeTool === 'frame' ? 2 : 0,
        zIndex: 9999,
      }}
    />
  );
};

// ── Shape node factories ────────────────────────────────────

function createShapeNode(
  tool: Tool,
  x: number, y: number, w: number, h: number,
): PenmaNode | null {
  const position = 'absolute';
  const id = uuid();
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  const base: PenmaNode = {
    id,
    tagName: 'div',
    attributes: {},
    children: [],
    styles: { computed: {}, overrides: {} },
    bounds: { x: rx, y: ry, width: rw, height: rh },
    visible: true,
    locked: false,
  };

  switch (tool) {
    case 'rectangle':
      return {
        ...base,
        name: 'Rectangle',
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: `${rh}px`,
            'background-color': '#D9D9D9', 'border-radius': '0px',
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'ellipse':
      return {
        ...base,
        name: 'Ellipse',
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: `${rh}px`,
            'background-color': '#D9D9D9', 'border-radius': '50%',
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'frame':
      return {
        ...base,
        name: 'Frame',
        autoLayout: {
          direction: 'vertical', gap: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          primaryAxisAlign: 'start', counterAxisAlign: 'start',
          independentPadding: false, clipContent: true, reverse: false,
        },
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: `${rh}px`,
            'background-color': '#FFFFFF', overflow: 'hidden',
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'line':
      return {
        ...base,
        name: 'Line',
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: '0px',
            'border-top': '2px solid #1E293B',
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'arrow': {
      const ah = Math.max(rh, 20);
      return {
        ...base,
        name: 'Arrow',
        rawHtml: `<svg width="${rw}" height="${ah}" viewBox="0 0 ${rw} ${ah}" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="${ah / 2}" x2="${rw - 10}" y2="${ah / 2}" stroke="#1E293B" stroke-width="2"/><polygon points="${rw},${ah / 2} ${rw - 12},${ah / 2 - 5} ${rw - 12},${ah / 2 + 5}" fill="#1E293B"/></svg>`,
        tagName: 'div',
        styles: {
          computed: {},
          overrides: { position, left: `${rx}px`, top: `${ry}px` },
        },
      };
    }

    case 'polygon':
      return {
        ...base,
        name: 'Polygon',
        rawHtml: `<svg width="${rw}" height="${rh}" viewBox="0 0 100 100" fill="#D9D9D9" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,40 80,95 20,95 5,40"/></svg>`,
        tagName: 'div',
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: `${rh}px`,
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'star':
      return {
        ...base,
        name: 'Star',
        rawHtml: `<svg width="${rw}" height="${rh}" viewBox="0 0 100 100" fill="#D9D9D9" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"/></svg>`,
        tagName: 'div',
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: `${rh}px`,
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'text':
      return {
        ...base,
        tagName: 'p',
        name: 'Text',
        textContent: 'Type something',
        styles: {
          computed: {},
          overrides: {
            'font-size': '16px', 'font-family': 'Inter, sans-serif', color: '#1E293B',
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    case 'image':
      return {
        ...base,
        tagName: 'div',
        name: 'Image placeholder',
        textContent: 'Image',
        styles: {
          computed: {},
          overrides: {
            width: `${rw}px`, height: `${rh}px`,
            'background-color': '#E2E8F0', display: 'flex',
            'align-items': 'center', 'justify-content': 'center',
            'font-size': '12px', color: '#94A3B8',
            position, left: `${rx}px`, top: `${ry}px`,
          },
        },
      };

    default:
      return null;
  }
}
