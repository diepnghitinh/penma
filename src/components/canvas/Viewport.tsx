'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { getCanvasTransform } from '@/lib/canvas/coordinates';
import { DocumentRenderer } from './DocumentRenderer';
import type { PenmaDocument } from '@/types/document';

// ── Canvas shapes layer (local://canvas documents) ──────────

const CanvasShapesLayer = React.memo<{ documents: PenmaDocument[] }>(({ documents }) => {
  const canvasDocs = documents.filter((d) => d.sourceUrl === 'local://canvas');
  if (canvasDocs.length === 0) return null;
  return (
    <>
      {canvasDocs.map((doc) => (
        <DocumentRenderer key={doc.id} node={doc.rootNode} />
      ))}
    </>
  );
});
CanvasShapesLayer.displayName = 'CanvasShapesLayer';

// ── Single document frame ───────────────────────────────────

interface DocumentFrameProps {
  doc: PenmaDocument;
  isActive: boolean;
  zoom: number;
  onActivate: (id: string) => void;
  onFrameDragStart: (e: React.PointerEvent, docId: string, canvasX: number, canvasY: number) => void;
  onFrameDragMove: (e: React.PointerEvent) => void;
  onFrameDragEnd: (e: React.PointerEvent) => void;
  onViewportResize: (docId: string, viewport: { width: number; height: number }) => void;
  onRemove: (docId: string) => void;
  onPushHistory: (description: string) => void;
}

const DocumentFrame = React.memo<DocumentFrameProps>(({
  doc, isActive, zoom,
  onActivate, onFrameDragStart, onFrameDragMove, onFrameDragEnd,
  onViewportResize, onRemove, onPushHistory,
}) => (
  <div
    className="absolute"
    style={{ left: doc.canvasX, top: doc.canvasY }}
    onPointerDown={() => onActivate(doc.id)}
  >
    {/* Frame label — draggable to move document */}
    <div
      className="group/label absolute left-0 flex items-center gap-1.5 whitespace-nowrap text-[11px] select-none cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => onFrameDragStart(e, doc.id, doc.canvasX, doc.canvasY)}
      onPointerMove={onFrameDragMove}
      onPointerUp={onFrameDragEnd}
      style={{
        top: -24 / zoom,
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'bottom left',
        color: isActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
        fontFamily: 'var(--font-heading)',
        fontWeight: 600,
      }}
    >
      <span className="truncate max-w-[400px]">{doc.sourceUrl}</span>
      <ViewportSizeLabel
        docId={doc.id}
        viewport={doc.viewport}
        onResize={onViewportResize}
        onStart={() => onPushHistory('Resize viewport')}
      />
      <button
        className="opacity-0 group-hover/label:opacity-100 flex h-4 w-4 items-center justify-center rounded cursor-pointer"
        style={{
          color: 'var(--penma-text-muted)',
          background: 'var(--penma-surface)',
          border: '1px solid var(--penma-border)',
          fontSize: 10, lineHeight: 1,
          transition: 'var(--transition-fast)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onPushHistory('Delete frame'); onRemove(doc.id); }}
        title="Delete frame"
      >
        ×
      </button>
    </div>

    {/* Frame */}
    <FrameContainer doc={doc} isActive={isActive} onAutoResize={onViewportResize} />

    {/* Frame resize handles */}
    {isActive && (
      <>
        <FrameResizeHandle docId={doc.id} direction="e" viewport={doc.viewport} zoom={zoom} onResize={onViewportResize} onStart={() => onPushHistory('Resize frame')} />
        <FrameResizeHandle docId={doc.id} direction="s" viewport={doc.viewport} zoom={zoom} onResize={onViewportResize} onStart={() => onPushHistory('Resize frame')} />
        <FrameResizeHandle docId={doc.id} direction="se" viewport={doc.viewport} zoom={zoom} onResize={onViewportResize} onStart={() => onPushHistory('Resize frame')} />
      </>
    )}
  </div>
));
DocumentFrame.displayName = 'DocumentFrame';

// ── Main Viewport component ─────────────────────────────────

export interface ViewportProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onFrameDragStart: (e: React.PointerEvent, docId: string, canvasX: number, canvasY: number) => void;
  onFrameDragMove: (e: React.PointerEvent) => void;
  onFrameDragEnd: (e: React.PointerEvent) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  viewportRef,
  onFrameDragStart,
  onFrameDragMove,
  onFrameDragEnd,
}) => {
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const camera = useEditorStore((s) => s.camera);
  const { setActiveDocument, updateDocumentViewport, removeDocument, pushHistory } = useEditorStore.getState();

  // Apply camera transform via ref — bypasses React reconciliation
  useEffect(() => {
    let prevCamera = useEditorStore.getState().camera;
    if (viewportRef.current) {
      viewportRef.current.style.transform = getCanvasTransform(prevCamera);
    }
    const unsub = useEditorStore.subscribe((state) => {
      if (state.camera !== prevCamera) {
        prevCamera = state.camera;
        if (viewportRef.current) {
          viewportRef.current.style.transform = getCanvasTransform(state.camera);
        }
      }
    });
    return unsub;
  }, [viewportRef]);

  return (
    <div
      ref={viewportRef}
      className="absolute origin-top-left"
      style={{ willChange: 'transform' }}
    >
      <CanvasShapesLayer documents={documents} />
      {documents.filter((d) => d.sourceUrl !== 'local://canvas').map((doc) => (
        <DocumentFrame
          key={doc.id}
          doc={doc}
          isActive={doc.id === activeDocumentId}
          zoom={camera.zoom}
          onActivate={setActiveDocument}
          onFrameDragStart={onFrameDragStart}
          onFrameDragMove={onFrameDragMove}
          onFrameDragEnd={onFrameDragEnd}
          onViewportResize={updateDocumentViewport}
          onRemove={removeDocument}
          onPushHistory={pushHistory}
        />
      ))}
    </div>
  );
};

// ── Viewport size label (click to edit) ─────────────────────

import { useState } from 'react';

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
      <span className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
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
      data-viewport-size
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

const FrameContainer: React.FC<{
  doc: PenmaDocument;
  isActive: boolean;
  onAutoResize: (docId: string, viewport: { width: number; height: number }) => void;
}> = ({ doc, isActive, onAutoResize }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastAppliedRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    lastAppliedRef.current = { w: doc.viewport.width, h: doc.viewport.height };
  }, [doc.viewport.width, doc.viewport.height]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let rafId = 0;

    const measure = () => {
      const contentH = content.scrollHeight;
      const curW = doc.viewport.width;
      const curH = doc.viewport.height;

      if (contentH <= curH) return;
      if (curW === lastAppliedRef.current.w && contentH === lastAppliedRef.current.h) return;

      lastAppliedRef.current = { w: curW, h: contentH };
      onAutoResize(doc.id, { width: curW, height: contentH });
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    });

    observer.observe(content);
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
      <div ref={contentRef} style={{ display: 'inline-block', minWidth: '100%', position: 'relative' }}>
        <DocumentRenderer node={doc.rootNode} />
      </div>
    </div>
  );
};

// ── Frame resize handle ─────────────────────────────────────

import { getResizeSnap, type SnapRect } from '@/lib/canvas/smart-guides';

const FrameResizeHandle: React.FC<{
  docId: string;
  direction: 'e' | 's' | 'se';
  viewport: { width: number; height: number };
  zoom: number;
  onResize: (docId: string, viewport: { width: number; height: number }) => void;
  onStart: () => void;
}> = ({ docId, direction, viewport, zoom, onResize, onStart }) => {
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const frameElRef = useRef<HTMLElement | null>(null);
  const sizeElRef = useRef<HTMLElement | null>(null);
  const siblingFramesRef = useRef<SnapRect[]>([]);
  const initScreenRectRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY, w: viewport.width, h: viewport.height };
    onStart();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const handle = e.currentTarget as HTMLElement;
    const wrapper = handle.parentElement;
    frameElRef.current = wrapper?.querySelector('.shadow-2xl') as HTMLElement ?? wrapper?.firstElementChild as HTMLElement;
    sizeElRef.current = wrapper?.querySelector('[data-viewport-size]') as HTMLElement;

    const frameEl = frameElRef.current;
    if (frameEl) {
      const r = frameEl.getBoundingClientRect();
      initScreenRectRef.current = { x: r.x, y: r.y };
    }

    const snapTargets: SnapRect[] = [];
    const allFrames = document.querySelectorAll('.shadow-2xl');
    allFrames.forEach((el) => {
      if (el === frameElRef.current) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        snapTargets.push({ id: `frame-${el.parentElement?.getAttribute('data-doc-id') || ''}`, x: r.x, y: r.y, width: r.width, height: r.height });
      }
    });

    const currentFrame = frameElRef.current;
    if (currentFrame) {
      const childEls = currentFrame.querySelectorAll('[data-penma-id]');
      childEls.forEach((el) => {
        const childId = el.getAttribute('data-penma-id')!;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          snapTargets.push({ id: childId, x: r.x, y: r.y, width: r.width, height: r.height });
        }
      });
    }

    siblingFramesRef.current = snapTargets;

    const setSmartGuides = useEditorStore.getState().setSmartGuides;
    const clearSmartGuides = useEditorStore.getState().clearSmartGuides;

    const handleMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startRef.current.x) / zoom;
      const dy = (ev.clientY - startRef.current.y) / zoom;
      let w = startRef.current.w;
      let h = startRef.current.h;
      if (direction === 'e' || direction === 'se') w = Math.max(200, Math.round(startRef.current.w + dx));
      if (direction === 's' || direction === 'se') h = Math.max(200, Math.round(startRef.current.h + dy));

      const screenRect: SnapRect = {
        id: docId,
        x: initScreenRectRef.current.x,
        y: initScreenRectRef.current.y,
        width: w * zoom,
        height: h * zoom,
      };
      const resizeEdges = {
        right: direction === 'e' || direction === 'se',
        bottom: direction === 's' || direction === 'se',
      };
      const snap = getResizeSnap(screenRect, siblingFramesRef.current, resizeEdges);
      setSmartGuides(snap.guides, []);

      if (resizeEdges.right) w = Math.max(200, Math.round(w + snap.dx / zoom));
      if (resizeEdges.bottom) h = Math.max(200, Math.round(h + snap.dy / zoom));

      const frame = frameElRef.current;
      if (frame) {
        if (direction === 'e' || direction === 'se') frame.style.width = `${w}px`;
        if (direction === 's' || direction === 'se') frame.style.minHeight = `${h}px`;
      }
      handle.style.left = direction === 's' ? '0' : `${w - (direction === 'se' ? 4 : 2)}px`;
      handle.style.top = direction === 'e' ? '0' : `${h - (direction === 'se' ? 4 : 2)}px`;
      if (direction === 'e') handle.style.height = `${h}px`;
      if (direction === 's') handle.style.width = `${w}px`;
      if (sizeElRef.current) sizeElRef.current.textContent = `${w}×${h}`;
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      clearSmartGuides();

      const dx = (ev.clientX - startRef.current.x) / zoom;
      const dy = (ev.clientY - startRef.current.y) / zoom;
      let w = startRef.current.w;
      let h = startRef.current.h;
      if (direction === 'e' || direction === 'se') w = Math.max(200, Math.round(startRef.current.w + dx));
      if (direction === 's' || direction === 'se') h = Math.max(200, Math.round(startRef.current.h + dy));

      const screenRect: SnapRect = {
        id: docId,
        x: initScreenRectRef.current.x,
        y: initScreenRectRef.current.y,
        width: w * zoom,
        height: h * zoom,
      };
      const resizeEdges = {
        right: direction === 'e' || direction === 'se',
        bottom: direction === 's' || direction === 'se',
      };
      const snap = getResizeSnap(screenRect, siblingFramesRef.current, resizeEdges);
      if (resizeEdges.right) w = Math.max(200, Math.round(w + snap.dx / zoom));
      if (resizeEdges.bottom) h = Math.max(200, Math.round(h + snap.dy / zoom));

      onResize(docId, { width: w, height: h });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [viewport, zoom, docId, direction, onResize, onStart]);

  const handleSize = 8 / zoom;
  const seSize = 12 / zoom;

  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(direction === 'e' && {
      left: viewport.width - handleSize / 4, top: 0, width: handleSize, height: viewport.height, cursor: 'ew-resize',
    }),
    ...(direction === 's' && {
      left: 0, top: viewport.height - handleSize / 4, width: viewport.width, height: handleSize, cursor: 'ns-resize',
    }),
    ...(direction === 'se' && {
      left: viewport.width - seSize / 3, top: viewport.height - seSize / 3, width: seSize, height: seSize, cursor: 'nwse-resize',
      background: 'var(--penma-primary)',
      borderRadius: 2 / zoom,
    }),
  };

  return <div style={style} onPointerDown={handlePointerDown} />;
};
