'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { getCanvasTransform } from '@/lib/canvas/coordinates';
import { DocumentRenderer } from './DocumentRenderer';
import { SelectionOverlay } from './SelectionOverlay';
import { AutoLayoutOverlay } from './AutoLayoutOverlay';
import { MeasureOverlay } from './MeasureOverlay';
import { MarqueeSelect } from './MarqueeSelect';

export const Canvas: React.FC = () => {
  const camera = useEditorStore((s) => s.camera);
  const pan = useEditorStore((s) => s.pan);
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const removeDocument = useEditorStore((s) => s.removeDocument);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const activeTool = useEditorStore((s) => s.activeTool);
  const isPanning = useEditorStore((s) => s.isPanning);
  const setIsPanning = useEditorStore((s) => s.setIsPanning);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01;
        const newZoom = state.camera.zoom * (1 + delta);
        const rect = canvas.getBoundingClientRect();
        state.zoomTo(newZoom, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        state.pan(-e.deltaX, -e.deltaY);
      }
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || activeTool === 'hand') {
        isPanningRef.current = true;
        setIsPanning(true);
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      } else if (e.button === 0 && activeTool === 'select') {
        if ((e.target as HTMLElement) === canvasRef.current) {
          clearSelection();
        }
      }
    },
    [activeTool, setIsPanning, clearSelection]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      pan(dx, dy);
    },
    [pan]
  );

  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, [setIsPanning]);

  // Space key for hand tool
  useEffect(() => {
    let prevTool = activeTool;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && activeTool !== 'hand') {
        prevTool = activeTool;
        useEditorStore.getState().setActiveTool('hand');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        useEditorStore.getState().setActiveTool(prevTool);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool]);

  const cursor = activeTool === 'hand' || isPanning ? 'grab' : 'default';

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 overflow-hidden"
      style={{ cursor, background: 'var(--penma-bg)' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #d4d4d4 1px, transparent 1px)`,
          backgroundSize: `${20 * camera.zoom}px ${20 * camera.zoom}px`,
          backgroundPosition: `${camera.x % (20 * camera.zoom)}px ${camera.y % (20 * camera.zoom)}px`,
        }}
      />

      {/* Viewport transform */}
      <div
        className="absolute origin-top-left"
        style={{ transform: getCanvasTransform(camera), willChange: 'transform' }}
      >
        {/* Multiple document frames */}
        {documents.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          return (
            <div
              key={doc.id}
              className="absolute"
              style={{ left: doc.canvasX, top: doc.canvasY }}
              onPointerDown={() => setActiveDocument(doc.id)}
            >
              {/* Frame label */}
              <div
                className="group/label absolute -top-6 left-0 flex items-center gap-1.5 whitespace-nowrap text-[11px] select-none"
                style={{
                  color: isActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 600,
                }}
              >
                <span className="truncate max-w-[200px]">
                  {new URL(doc.sourceUrl).hostname}
                </span>
                <span className="text-[9px] font-normal" style={{ color: 'var(--penma-text-muted)' }}>
                  {doc.viewport.width}×{doc.viewport.height}
                </span>
                <button
                  className="opacity-0 group-hover/label:opacity-100 flex h-4 w-4 items-center justify-center rounded cursor-pointer"
                  style={{
                    color: 'var(--penma-text-muted)',
                    background: 'var(--penma-surface)',
                    border: '1px solid var(--penma-border)',
                    fontSize: 10,
                    lineHeight: 1,
                    transition: 'var(--transition-fast)',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    pushHistory('Delete frame');
                    removeDocument(doc.id);
                  }}
                  title="Delete frame"
                >
                  ×
                </button>
              </div>

              {/* Frame */}
              <div
                className="shadow-2xl"
                style={{
                  width: doc.viewport.width,
                  minHeight: doc.viewport.height,
                  overflow: 'hidden',
                  background: 'var(--penma-surface)',
                  outline: isActive ? '2px solid var(--penma-primary)' : '1px solid var(--penma-border)',
                  outlineOffset: isActive ? -1 : 0,
                  borderRadius: 2,
                }}
              >
                <DocumentRenderer node={doc.rootNode} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24" style={{ color: 'var(--penma-border-strong)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>No designs yet</h2>
            <p className="text-sm" style={{ color: 'var(--penma-text-muted)' }}>
              Import a URL to get started
            </p>
          </div>
        </div>
      )}

      <AutoLayoutOverlay />
      <MeasureOverlay />
      <MarqueeSelect canvasRef={canvasRef} />
      <SelectionOverlay />
    </div>
  );
};
