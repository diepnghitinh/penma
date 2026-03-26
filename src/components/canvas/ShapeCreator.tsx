'use client';

import React, { useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useEditorStore } from '@/store/editor-store';
import { screenToDocument } from '@/lib/canvas/coordinates';
import { useCanvasDrag } from './useCanvasDrag';
import type { PenmaNode } from '@/types/document';
import type { Tool } from '@/types/editor';

const SHAPE_TOOLS = new Set<Tool>([
  'rectangle', 'ellipse', 'line', 'arrow', 'star', 'polygon', 'frame', 'text',
]);

export const ShapeCreator: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const { rect, startClient, isDragging, targetFrameId, reset } = useCanvasDrag(canvasRef, SHAPE_TOOLS);

  // Handle pointer up — convert screen rect to document space and create shape
  useEffect(() => {
    const handleUp = (e: PointerEvent) => {
      if (!isDragging.current) return;

      // Capture refs BEFORE reset clears them
      const start = { ...startClient.current };
      const frameId = targetFrameId.current;

      // Reset drag state
      reset();

      const store = useEditorStore.getState();
      const cam = store.camera;
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      // Convert screen → document space (single conversion at commit time)
      const toDoc = (cx: number, cy: number) =>
        screenToDocument({ x: cx - canvasRect.left, y: cy - canvasRect.top }, cam);

      const startDoc = toDoc(start.x, start.y);
      const endDoc = toDoc(e.clientX, e.clientY);

      let w = Math.abs(endDoc.x - startDoc.x);
      let h = Math.abs(endDoc.y - startDoc.y);

      // Minimum size for click-without-drag
      if (w < 10) w = activeTool === 'line' || activeTool === 'arrow' ? 200 : 100;
      if (h < 10) h = activeTool === 'line' || activeTool === 'arrow' ? 2 : 100;

      let finalX = Math.min(startDoc.x, endDoc.x);
      let finalY = Math.min(startDoc.y, endDoc.y);

      if (frameId) {
        // Position relative to frame element
        const frameEl = canvasRef.current?.querySelector(`[data-penma-id="${frameId}"]`) as HTMLElement | null;
        if (frameEl) {
          const frameRect = frameEl.getBoundingClientRect();
          const sx = Math.min(start.x, e.clientX);
          const sy = Math.min(start.y, e.clientY);
          finalX = (sx - frameRect.left) / cam.zoom;
          finalY = (sy - frameRect.top) / cam.zoom;
        }
      }

      // Emit debug info for DebugOverlay
      window.dispatchEvent(new CustomEvent('penma:debug:shape', {
        detail: {
          tool: activeTool,
          screen: { startX: start.x, startY: start.y, endX: e.clientX, endY: e.clientY },
          canvasRel: { startX: start.x - canvasRect.left, startY: start.y - canvasRect.top, endX: e.clientX - canvasRect.left, endY: e.clientY - canvasRect.top },
          doc: { startX: startDoc.x, startY: startDoc.y, endX: endDoc.x, endY: endDoc.y },
          final: { x: finalX, y: finalY, w, h },
          camera: { x: cam.x, y: cam.y, zoom: cam.zoom },
          frameId,
        },
      }));

      const node = createShapeNode(activeTool, finalX, finalY, w, h);
      if (node) {
        store.pushHistory(`Create ${activeTool}`);
        if (frameId) {
          store.addNodeToParent(frameId, node);
        } else {
          store.addCanvasNode(node);
        }
        store.select(node.id);
        store.setActiveTool('select');
      }
    };

    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [activeTool, canvasRef, isDragging, startClient, targetFrameId, reset]);

  if (!rect) return null;

  // Preview — screen-space rect directly from the shared drag hook
  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
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
