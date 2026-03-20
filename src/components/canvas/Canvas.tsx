'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { getCanvasTransform } from '@/lib/canvas/coordinates';
import { DocumentRenderer } from './DocumentRenderer';
import { SelectionOverlay } from './SelectionOverlay';
import { AutoLayoutOverlay } from './AutoLayoutOverlay';
import { MeasureOverlay } from './MeasureOverlay';
import { MarqueeSelect } from './MarqueeSelect';
import dynamic from 'next/dynamic';
const BottomToolbar = dynamic(() => import('@/components/toolbar/BottomToolbar').then(m => m.BottomToolbar), { ssr: false });
import { ShapeCreator } from './ShapeCreator';
// CanvasContextMenu moved to EditorShell for z-index reliability

export const Canvas: React.FC = () => {
  const camera = useEditorStore((s) => s.camera);
  const pan = useEditorStore((s) => s.pan);
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const removeDocument = useEditorStore((s) => s.removeDocument);
  const updateDocumentViewport = useEditorStore((s) => s.updateDocumentViewport);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const activeTool = useEditorStore((s) => s.activeTool);
  const isPanning = useEditorStore((s) => s.isPanning);
  const setIsPanning = useEditorStore((s) => s.setIsPanning);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // Wheel/touchpad scroll → pan & zoom
  // Touchpad two-finger scroll → pan (deltaX/deltaY)
  // Touchpad pinch → zoom (ctrlKey + deltaY on most browsers)
  // Mouse wheel → zoom (with Ctrl/Cmd) or vertical pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();

      // Pinch-to-zoom (trackpad sends ctrlKey=true for pinch gestures)
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01;
        const newZoom = state.camera.zoom * (1 + delta);
        const rect = canvas.getBoundingClientRect();
        state.zoomTo(newZoom, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        // Two-finger scroll / mouse wheel → pan
        // deltaMode 0 = pixels, 1 = lines (multiply by ~20)
        const multiplier = e.deltaMode === 1 ? 20 : 1;
        state.pan(-e.deltaX * multiplier, -e.deltaY * multiplier);
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
      onContextMenu={(e) => e.preventDefault()}
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
                <ViewportSizeLabel
                  docId={doc.id}
                  viewport={doc.viewport}
                  onResize={updateDocumentViewport}
                  onStart={() => pushHistory('Resize viewport')}
                />
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
              <FrameContainer
                doc={doc}
                isActive={isActive}
                onAutoResize={updateDocumentViewport}
              />

              {/* Frame resize handles — outside overflow container */}
              {isActive && (
                <>
                  <FrameResizeHandle
                    docId={doc.id}
                    direction="e"
                    viewport={doc.viewport}
                    zoom={camera.zoom}
                    onResize={updateDocumentViewport}
                    onStart={() => pushHistory('Resize frame')}
                  />
                  <FrameResizeHandle
                    docId={doc.id}
                    direction="s"
                    viewport={doc.viewport}
                    zoom={camera.zoom}
                    onResize={updateDocumentViewport}
                    onStart={() => pushHistory('Resize frame')}
                  />
                  <FrameResizeHandle
                    docId={doc.id}
                    direction="se"
                    viewport={doc.viewport}
                    zoom={camera.zoom}
                    onResize={updateDocumentViewport}
                    onStart={() => pushHistory('Resize frame')}
                  />
                </>
              )}
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
      <ShapeCreator canvasRef={canvasRef} />
      <MarqueeSelect canvasRef={canvasRef} />
      <SelectionOverlay />

      {/* Figma-style bottom toolbar */}
      <BottomToolbar />

    </div>
  );
};

// ── Viewport size label (click to edit) ─────────────────────

const ViewportSizeLabel: React.FC<{
  docId: string;
  viewport: { width: number; height: number };
  onResize: (docId: string, viewport: { width: number; height: number }) => void;
  onStart: () => void;
}> = ({ docId, viewport, onResize, onStart }) => {
  const [editing, setEditing] = useState(false);
  const [wVal, setWVal] = useState('');
  const [hVal, setHVal] = useState('');
  const wRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setWVal(String(viewport.width));
    setHVal(String(viewport.height));
    setEditing(true);
    setTimeout(() => wRef.current?.focus(), 0);
  }, [viewport]);

  const commit = useCallback(() => {
    const w = parseInt(wVal, 10);
    const h = parseInt(hVal, 10);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      if (w !== viewport.width || h !== viewport.height) {
        onStart();
        onResize(docId, { width: w, height: h });
      }
    }
    setEditing(false);
  }, [wVal, hVal, docId, viewport, onResize, onStart]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
    e.stopPropagation();
  }, [commit]);

  if (editing) {
    return (
      <span
        className="flex items-center gap-0.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          ref={wRef}
          value={wVal}
          onChange={(e) => setWVal(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          className="w-10 rounded border px-1 py-0 text-[9px] text-center outline-none"
          style={{ borderColor: 'var(--penma-primary)', background: 'var(--penma-surface)', color: 'var(--penma-text)' }}
        />
        <span className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>×</span>
        <input
          value={hVal}
          onChange={(e) => setHVal(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          className="w-10 rounded border px-1 py-0 text-[9px] text-center outline-none"
          style={{ borderColor: 'var(--penma-primary)', background: 'var(--penma-surface)', color: 'var(--penma-text)' }}
        />
      </span>
    );
  }

  return (
    <span
      className="text-[9px] font-normal cursor-pointer hover:underline"
      style={{ color: 'var(--penma-text-muted)' }}
      onClick={startEdit}
      onPointerDown={(e) => e.stopPropagation()}
      title="Click to resize viewport"
    >
      {viewport.width}×{viewport.height}
    </span>
  );
};

// ── Frame container with auto-resize ────────────────────────

import type { PenmaDocument } from '@/types/document';

const FrameContainer: React.FC<{
  doc: PenmaDocument;
  isActive: boolean;
  onAutoResize: (docId: string, viewport: { width: number; height: number }) => void;
}> = ({ doc, isActive, onAutoResize }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastAppliedRef = useRef({ w: 0, h: 0 });

  // Keep lastApplied in sync with external viewport changes (manual resize)
  // so auto-resize doesn't fight them
  useEffect(() => {
    lastAppliedRef.current = { w: doc.viewport.width, h: doc.viewport.height };
  }, [doc.viewport.width, doc.viewport.height]);

  // Continuous auto-resize: measure an unconstrained inner wrapper,
  // then update the frame viewport if content exceeds it.
  // No loop because: inner div is unconstrained (no width/height set on it),
  // so changing the outer frame size doesn't change the inner's natural size.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let rafId = 0;

    const measure = () => {
      const contentW = content.scrollWidth;
      const contentH = content.scrollHeight;
      const curW = doc.viewport.width;
      const curH = doc.viewport.height;

      // Only resize if content overflows AND we haven't already applied this size
      const needW = contentW > curW;
      const needH = contentH > curH;
      if (!needW && !needH) return;

      const newW = needW ? contentW : curW;
      const newH = needH ? contentH : curH;

      // Guard: skip if we already applied this exact size
      if (newW === lastAppliedRef.current.w && newH === lastAppliedRef.current.h) return;

      lastAppliedRef.current = { w: newW, h: newH };
      onAutoResize(doc.id, { width: newW, height: newH });
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    });

    observer.observe(content);
    // Initial check
    rafId = requestAnimationFrame(measure);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [doc.id, onAutoResize]);

  return (
    <div
      ref={frameRef}
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
      {/* Inner wrapper: unconstrained so its natural size reflects content */}
      <div ref={contentRef} style={{ display: 'inline-block', minWidth: '100%' }}>
        <DocumentRenderer node={doc.rootNode} />
      </div>
    </div>
  );
};

// ── Frame resize handle ─────────────────────────────────────

const FrameResizeHandle: React.FC<{
  docId: string;
  direction: 'e' | 's' | 'se';
  viewport: { width: number; height: number };
  zoom: number;
  onResize: (docId: string, viewport: { width: number; height: number }) => void;
  onStart: () => void;
}> = ({ docId, direction, viewport, zoom, onResize, onStart }) => {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    startRef.current = { x: e.clientX, y: e.clientY, w: viewport.width, h: viewport.height };
    onStart();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [viewport, onStart]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const dx = (e.clientX - startRef.current.x) / zoom;
      const dy = (e.clientY - startRef.current.y) / zoom;
      let w = startRef.current.w;
      let h = startRef.current.h;
      if (direction === 'e' || direction === 'se') w = Math.max(200, startRef.current.w + dx);
      if (direction === 's' || direction === 'se') h = Math.max(200, startRef.current.h + dy);
      onResize(docId, { width: Math.round(w), height: Math.round(h) });
    };

    const handleUp = () => setDragging(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, zoom, docId, direction, onResize]);

  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(direction === 'e' && {
      left: viewport.width - 2, top: 0, width: 8, height: viewport.height, cursor: 'ew-resize',
    }),
    ...(direction === 's' && {
      left: 0, top: viewport.height - 2, width: viewport.width, height: 8, cursor: 'ns-resize',
    }),
    ...(direction === 'se' && {
      left: viewport.width - 4, top: viewport.height - 4, width: 12, height: 12, cursor: 'nwse-resize',
      background: 'var(--penma-primary)',
      borderRadius: 2,
    }),
  };

  return <div style={style} onPointerDown={handlePointerDown} />;
};
