'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { screenToDocument } from '@/lib/canvas/coordinates';

/**
 * Debug overlay for viewport positioning.
 * Shows: camera state, cursor position (screen & document space),
 * viewport origin crosshair, and canvas root bounds.
 *
 * Toggle via: useEditorStore.setState({ debugViewport: true })
 * Or add ?debug=viewport to the URL.
 */
export const DebugOverlay: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const [enabled, setEnabled] = useState(false);
  const [mouse, setMouse] = useState({ screenX: 0, screenY: 0, docX: 0, docY: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0, zoom: 1 });
  const [canvasOffset, setCanvasOffset] = useState({ left: 0, top: 0 });
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [fps, setFps] = useState(0);
  const fpsFrames = useRef(0);
  const fpsLastTime = useRef(performance.now());

  // Last shape creation event
  interface ShapeDebug {
    tool: string;
    screen: { startX: number; startY: number; endX: number; endY: number };
    canvasRel: { startX: number; startY: number; endX: number; endY: number };
    doc: { startX: number; startY: number; endX: number; endY: number };
    final: { x: number; y: number; w: number; h: number };
    camera: { x: number; y: number; zoom: number };
    frameId: string | null;
  }
  const [lastShape, setLastShape] = useState<ShapeDebug | null>(null);
  const rafRef = useRef(0);

  // Enable via URL param or keyboard shortcut
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      setEnabled(true);
    }
    const handleKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug overlay
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setEnabled((v) => !v);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // FPS counter
  useEffect(() => {
    if (!enabled) return;
    let rafId = 0;
    const tick = () => {
      fpsFrames.current++;
      const now = performance.now();
      if (now - fpsLastTime.current >= 1000) {
        setFps(fpsFrames.current);
        fpsFrames.current = 0;
        fpsLastTime.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  // Listen for shape creation events
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: Event) => {
      setLastShape((e as CustomEvent).detail);
    };
    window.addEventListener('penma:debug:shape', handler);
    return () => window.removeEventListener('penma:debug:shape', handler);
  }, [enabled]);

  // Track mouse position + camera
  useEffect(() => {
    if (!enabled) return;

    const handleMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const camera = useEditorStore.getState().camera;
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const left = canvasRect?.left ?? 0;
        const top = canvasRect?.top ?? 0;

        const canvasRelX = e.clientX - left;
        const canvasRelY = e.clientY - top;
        const doc = screenToDocument({ x: canvasRelX, y: canvasRelY }, camera);

        setMouse({
          screenX: e.clientX,
          screenY: e.clientY,
          docX: Math.round(doc.x * 10) / 10,
          docY: Math.round(doc.y * 10) / 10,
        });
        setCam({ x: Math.round(camera.x * 10) / 10, y: Math.round(camera.y * 10) / 10, zoom: Math.round(camera.zoom * 1000) / 1000 });
        setCanvasOffset({ left: Math.round(left), top: Math.round(top) });
      });
    };

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, canvasRef]);

  if (!enabled) return null;

  // Compute viewport origin position on screen
  const camera = useEditorStore.getState().camera;
  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const originScreen = {
    x: camera.x + (canvasRect?.left ?? 0),
    y: camera.y + (canvasRect?.top ?? 0),
  };

  return (
    <>
      {/* Viewport origin crosshair */}
      <div
        className="fixed pointer-events-none"
        style={{
          left: originScreen.x - 20,
          top: originScreen.y,
          width: 40,
          height: 1,
          background: 'red',
          zIndex: 99999,
          opacity: 0.7,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          left: originScreen.x,
          top: originScreen.y - 20,
          width: 1,
          height: 40,
          background: 'red',
          zIndex: 99999,
          opacity: 0.7,
        }}
      />
      <div
        className="fixed pointer-events-none text-[8px] font-mono"
        style={{
          left: originScreen.x + 4,
          top: originScreen.y + 4,
          color: 'red',
          zIndex: 99999,
        }}
      >
        origin (0,0)
      </div>

      {/* Cursor crosshair in document space */}
      <div
        className="fixed pointer-events-none"
        style={{
          left: mouse.screenX,
          top: mouse.screenY - 8,
          width: 1,
          height: 16,
          background: 'lime',
          zIndex: 99999,
          opacity: 0.8,
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          left: mouse.screenX - 8,
          top: mouse.screenY,
          width: 16,
          height: 1,
          background: 'lime',
          zIndex: 99999,
          opacity: 0.8,
        }}
      />

      {/* Debug info panel — draggable */}
      <div
        data-penma-overlay
        className="fixed font-mono text-[10px] leading-tight select-none"
        style={{
          ...(panelPos
            ? { left: panelPos.x, top: panelPos.y }
            : { bottom: 48, left: (canvasRect?.left ?? 0) + 8 }),
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.85)',
          color: '#0f0',
          borderRadius: 6,
          zIndex: 99999,
          minWidth: 240,
          cursor: 'grab',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          const el = e.currentTarget;
          const rect = el.getBoundingClientRect();
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
          el.setPointerCapture(e.pointerId);
          el.style.cursor = 'grabbing';
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          setPanelPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
        }}
        onPointerUp={(e) => {
          dragRef.current = null;
          (e.currentTarget as HTMLElement).style.cursor = 'grab';
        }}
      >
        <div style={{ color: '#ff6', marginBottom: 2, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>Debug Viewport (Ctrl+Shift+D)</span>
          <span style={{ color: fps >= 50 ? '#0f0' : fps >= 30 ? '#ff6' : '#f44' }}>{fps} FPS</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>screen:</span> {mouse.screenX}, {mouse.screenY}
        </div>
        <div>
          <span style={{ color: '#888' }}>canvas-rel:</span> {mouse.screenX - canvasOffset.left}, {mouse.screenY - canvasOffset.top}
        </div>
        <div>
          <span style={{ color: '#0f0' }}>doc:</span> {mouse.docX}, {mouse.docY}
        </div>
        <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3 }}>
          <span style={{ color: '#888' }}>camera:</span> x={cam.x} y={cam.y} zoom={cam.zoom}
        </div>
        <div>
          <span style={{ color: '#888' }}>canvas offset:</span> left={canvasOffset.left} top={canvasOffset.top}
        </div>
        <div>
          <span style={{ color: 'red' }}>origin screen:</span> {Math.round(originScreen.x)}, {Math.round(originScreen.y)}
        </div>

        {/* Last shape creation */}
        {lastShape && (
          <>
            <div style={{ borderTop: '1px solid #333', marginTop: 3, paddingTop: 3, color: '#f0f' }}>
              Last Shape: {lastShape.tool} {lastShape.frameId ? `(in frame)` : '(canvas)'}
            </div>
            <div>
              <span style={{ color: '#888' }}>screen start:</span> {lastShape.screen.startX}, {lastShape.screen.startY}
            </div>
            <div>
              <span style={{ color: '#888' }}>screen end:</span> {lastShape.screen.endX}, {lastShape.screen.endY}
            </div>
            <div>
              <span style={{ color: '#888' }}>canvas-rel start:</span> {Math.round(lastShape.canvasRel.startX)}, {Math.round(lastShape.canvasRel.startY)}
            </div>
            <div>
              <span style={{ color: '#888' }}>canvas-rel end:</span> {Math.round(lastShape.canvasRel.endX)}, {Math.round(lastShape.canvasRel.endY)}
            </div>
            <div>
              <span style={{ color: '#0ff' }}>doc start:</span> {Math.round(lastShape.doc.startX * 10) / 10}, {Math.round(lastShape.doc.startY * 10) / 10}
            </div>
            <div>
              <span style={{ color: '#0ff' }}>doc end:</span> {Math.round(lastShape.doc.endX * 10) / 10}, {Math.round(lastShape.doc.endY * 10) / 10}
            </div>
            <div>
              <span style={{ color: '#f0f' }}>final pos:</span> x={Math.round(lastShape.final.x)} y={Math.round(lastShape.final.y)}
            </div>
            <div>
              <span style={{ color: '#f0f' }}>final size:</span> {Math.round(lastShape.final.w)}×{Math.round(lastShape.final.h)}
            </div>
            <div>
              <span style={{ color: '#888' }}>cam at create:</span> x={lastShape.camera.x} y={lastShape.camera.y} z={lastShape.camera.zoom}
            </div>
          </>
        )}
      </div>
    </>
  );
};
