'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { screenToDocument, documentToScreen } from '@/lib/canvas/coordinates';

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

      {/* Debug info panel */}
      <div
        className="fixed pointer-events-none font-mono text-[10px] leading-tight"
        style={{
          bottom: 48,
          left: (canvasRect?.left ?? 0) + 8,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.85)',
          color: '#0f0',
          borderRadius: 6,
          zIndex: 99999,
          minWidth: 240,
        }}
      >
        <div style={{ color: '#ff6', marginBottom: 2 }}>Debug Viewport (Ctrl+Shift+D)</div>
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
      </div>
    </>
  );
};
