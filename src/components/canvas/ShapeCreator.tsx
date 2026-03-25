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

interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ShapeCreator: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const camera = useEditorStore((s) => s.camera);

  const [drawing, setDrawing] = useState<DrawRect | null>(null);
  const isDrawing = useRef(false);
  const startScreen = useRef({ x: 0, y: 0 });
  const targetFrameId = useRef<string | null>(null);

  const isShapeTool = SHAPE_TOOLS.has(activeTool);

  // Pointer down — start drawing
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!isShapeTool || e.button !== 0) return;
      const target = e.target as HTMLElement;

      // Allow drawing on canvas background OR inside frames
      const frameEl = target.closest('[data-penma-frame]') as HTMLElement | null;
      const penmaEl = target.closest('[data-penma-id]') as HTMLElement | null;
      if (penmaEl && !frameEl) return; // clicked on a non-frame element
      // If clicked on a non-frame child inside a frame, still allow (frameEl will be set)

      targetFrameId.current = frameEl?.getAttribute('data-penma-id') ?? null;
      isDrawing.current = true;
      startScreen.current = { x: e.clientX, y: e.clientY };
      setDrawing(null);

      // Prevent frame selection/drag when drawing inside it
      if (frameEl) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [isShapeTool]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing.current) return;
      const x = Math.min(startScreen.current.x, e.clientX);
      const y = Math.min(startScreen.current.y, e.clientY);
      const w = Math.abs(e.clientX - startScreen.current.x);
      const h = Math.abs(e.clientY - startScreen.current.y);
      if (w > 3 || h > 3) {
        setDrawing({ x, y, width: w, height: h });
      }
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;

      const store = useEditorStore.getState();
      const cam = store.camera;

      // Calculate document-space position
      const canvasEl = canvasRef.current;
      const canvasRect = canvasEl?.getBoundingClientRect();
      if (!canvasRect) { setDrawing(null); return; }

      const startDoc = screenToDocument(
        { x: startScreen.current.x - canvasRect.left, y: startScreen.current.y - canvasRect.top },
        cam
      );
      const endDoc = screenToDocument(
        { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top },
        cam
      );

      // Convert from canvas space to document-frame-relative space
      const activeDoc = store.documents.find((d) => d.id === store.activeDocumentId) ?? store.documents[0];
      const frameOffsetX = activeDoc?.canvasX ?? 0;
      const frameOffsetY = activeDoc?.canvasY ?? 0;

      let w = Math.abs(endDoc.x - startDoc.x);
      let h = Math.abs(endDoc.y - startDoc.y);
      const x = Math.min(startDoc.x, endDoc.x) - frameOffsetX;
      const y = Math.min(startDoc.y, endDoc.y) - frameOffsetY;

      // Minimum size — if click without drag, use default size
      if (w < 10) w = activeTool === 'line' || activeTool === 'arrow' ? 200 : 100;
      if (h < 10) h = activeTool === 'line' || activeTool === 'arrow' ? 2 : 100;

      const drawnInFrameId = targetFrameId.current;
      let finalX = x;
      let finalY = y;

      if (drawnInFrameId) {
        // Compute position relative to the frame element.
        // frameRect is in screen pixels (already scaled by zoom),
        // so divide the screen-pixel offset by zoom to get CSS pixels inside the frame.
        const frameEl = canvasEl?.querySelector(`[data-penma-id="${drawnInFrameId}"]`) as HTMLElement | null;
        if (frameEl) {
          const frameRect = frameEl.getBoundingClientRect();
          const sx = Math.min(startScreen.current.x, e.clientX);
          const sy = Math.min(startScreen.current.y, e.clientY);
          finalX = (sx - frameRect.left) / cam.zoom;
          finalY = (sy - frameRect.top) / cam.zoom;
        }
      }

      const node = createShapeNode(activeTool, finalX, finalY, w, h);
      if (node) {
        // Auto-create a canvas document if none exists
        if (store.documents.length === 0) {
          store.setDocument({
            id: uuid(),
            sourceUrl: 'local://canvas',
            importedAt: new Date().toISOString(),
            viewport: { width: 1440, height: 900 },
            rootNode: {
              id: uuid(),
              tagName: 'div',
              attributes: {},
              children: [],
              styles: { computed: {}, overrides: {} },
              bounds: { x: 0, y: 0, width: 1440, height: 900 },
              visible: true,
              locked: false,
              name: 'Canvas',
            },
            assets: {},
            canvasX: 0,
            canvasY: 0,
          });
        }
        store.pushHistory(`Create ${activeTool}`);
        if (drawnInFrameId) {
          store.addNodeToParent(drawnInFrameId, node);
        } else {
          store.addNodeToActiveDocument(node);
        }
        store.select(node.id);
        store.setActiveTool('select');
      }
      targetFrameId.current = null;

      setDrawing(null);
    },
    [activeTool, canvasRef]
  );

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

  // Change cursor when shape tool is active
  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.style.cursor = isShapeTool ? 'crosshair' : '';
    return () => { if (canvasRef.current) canvasRef.current.style.cursor = ''; };
  }, [isShapeTool, canvasRef]);

  if (!drawing) return null;

  // Preview rectangle
  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: drawing.x,
        top: drawing.y,
        width: drawing.width,
        height: drawing.height,
        border: '2px solid var(--penma-primary)',
        background: 'rgba(59, 130, 246, 0.06)',
        borderRadius: activeTool === 'ellipse' ? '50%' : activeTool === 'rectangle' || activeTool === 'frame' ? 2 : 0,
        zIndex: 25,
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
  const base: PenmaNode = {
    id,
    tagName: 'div',
    attributes: {},
    children: [],
    styles: { computed: {}, overrides: {} },
    bounds: { x, y, width: w, height: h },
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
            width: `${Math.round(w)}px`,
            height: `${Math.round(h)}px`,
            'background-color': '#D9D9D9',
            'border-radius': '0px',
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
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
            width: `${Math.round(w)}px`,
            height: `${Math.round(h)}px`,
            'background-color': '#D9D9D9',
            'border-radius': '50%',
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
          },
        },
      };

    case 'frame':
      return {
        ...base,
        name: 'Frame',
        autoLayout: {
          direction: 'vertical',
          gap: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          primaryAxisAlign: 'start',
          counterAxisAlign: 'start',
          independentPadding: false,
          clipContent: true,
          reverse: false,
        },
        styles: {
          computed: {},
          overrides: {
            width: `${Math.round(w)}px`,
            height: `${Math.round(h)}px`,
            'background-color': '#FFFFFF',
            overflow: 'hidden',
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
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
            width: `${Math.round(w)}px`,
            height: '0px',
            'border-top': '2px solid #1E293B',
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
          },
        },
      };

    case 'arrow':
      return {
        ...base,
        name: 'Arrow',
        rawHtml: `<svg width="${Math.round(w)}" height="${Math.round(Math.max(h, 20))}" viewBox="0 0 ${Math.round(w)} ${Math.round(Math.max(h, 20))}" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="${Math.round(Math.max(h, 20) / 2)}" x2="${Math.round(w - 10)}" y2="${Math.round(Math.max(h, 20) / 2)}" stroke="#1E293B" stroke-width="2"/><polygon points="${Math.round(w)},${Math.round(Math.max(h, 20) / 2)} ${Math.round(w - 12)},${Math.round(Math.max(h, 20) / 2 - 5)} ${Math.round(w - 12)},${Math.round(Math.max(h, 20) / 2 + 5)}" fill="#1E293B"/></svg>`,
        tagName: 'div',
        styles: {
          computed: {},
          overrides: {
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
          },
        },
      };

    case 'polygon':
      return {
        ...base,
        name: 'Polygon',
        rawHtml: `<svg width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 100 100" fill="#D9D9D9" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,40 80,95 20,95 5,40"/></svg>`,
        tagName: 'div',
        styles: {
          computed: {},
          overrides: {
            width: `${Math.round(w)}px`,
            height: `${Math.round(h)}px`,
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
          },
        },
      };

    case 'star':
      return {
        ...base,
        name: 'Star',
        rawHtml: `<svg width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 100 100" fill="#D9D9D9" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35"/></svg>`,
        tagName: 'div',
        styles: {
          computed: {},
          overrides: {
            width: `${Math.round(w)}px`,
            height: `${Math.round(h)}px`,
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
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
            'font-size': '16px',
            'font-family': 'Inter, sans-serif',
            color: '#1E293B',
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
          },
        },
      };

    case 'image':
      return {
        ...base,
        tagName: 'div',
        name: 'Image placeholder',
        styles: {
          computed: {},
          overrides: {
            width: `${Math.round(w)}px`,
            height: `${Math.round(h)}px`,
            'background-color': '#E2E8F0',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '12px',
            color: '#94A3B8',
            position,
            left: `${Math.round(x)}px`,
            top: `${Math.round(y)}px`,
          },
        },
        textContent: 'Image',
      };

    default:
      return null;
  }
}
