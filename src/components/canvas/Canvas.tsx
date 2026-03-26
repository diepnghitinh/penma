'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { Viewport } from './Viewport';
import { FontLoader } from './FontLoader';
import { SelectionOverlay } from './SelectionOverlay';
import { AutoLayoutOverlay } from './AutoLayoutOverlay';
import { MeasureOverlay } from './MeasureOverlay';
import { SmartGuidesOverlay } from './SmartGuidesOverlay';
import { MarqueeSelect } from './MarqueeSelect';
import dynamic from 'next/dynamic';
const BottomToolbar = dynamic(() => import('@/components/toolbar/BottomToolbar').then(m => m.BottomToolbar), { ssr: false });
import { ShapeCreator } from './ShapeCreator';
import { DebugOverlay } from './DebugOverlay';
// CanvasContextMenu moved to EditorShell for z-index reliability

export const Canvas: React.FC = () => {
  const editEnabled = useEditorStore((s) => s.editEnabled);
  const pan = useEditorStore((s) => s.pan);
  const documents = useEditorStore((s) => s.documents);
  const activeTool = useEditorStore((s) => s.activeTool);
  const isPanning = useEditorStore((s) => s.isPanning);
  const setIsPanning = useEditorStore((s) => s.setIsPanning);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // Document frame drag state
  const dragDocRef = useRef<{ docId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleFrameDragStart = useCallback((e: React.PointerEvent, docId: string, canvasX: number, canvasY: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    useEditorStore.getState().pushHistory('Move frame');
    dragDocRef.current = { docId, startX: e.clientX, startY: e.clientY, origX: canvasX, origY: canvasY };
  }, []);

  const handleFrameDragMove = useCallback((e: React.PointerEvent) => {
    const drag = dragDocRef.current;
    if (!drag) return;
    const zoom = useEditorStore.getState().camera.zoom;
    const dx = (e.clientX - drag.startX) / zoom;
    const dy = (e.clientY - drag.startY) / zoom;
    useEditorStore.getState().updateDocumentPosition(drag.docId, Math.round(drag.origX + dx), Math.round(drag.origY + dy));
  }, []);

  const handleFrameDragEnd = useCallback(() => {
    dragDocRef.current = null;
  }, []);

  // Wheel/touchpad scroll → pan & zoom
  // Pinch-to-zoom (ctrlKey + deltaY) → zoom at cursor
  // Trackpad two-finger scroll (has deltaX) → pan
  // Mouse wheel (no deltaX, deltaMode=1 or large deltaY steps) → zoom at cursor
  // Shift+scroll → horizontal pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();
      const rect = canvas.getBoundingClientRect();
      const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      // Pinch-to-zoom (trackpad sends ctrlKey=true for pinch gestures)
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01;
        const newZoom = state.camera.zoom * (1 + delta);
        state.zoomTo(newZoom, focal);
        return;
      }

      // Shift+scroll → horizontal pan
      if (e.shiftKey) {
        state.pan(-e.deltaY, 0);
        return;
      }

      // Detect trackpad vs mouse wheel:
      // - Trackpad: deltaMode=0, often has deltaX, small fractional deltaY
      // - Mouse wheel: deltaMode=1 (line-based) or deltaMode=0 with large integer deltaY steps
      const isTrackpad = e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || Math.abs(e.deltaY) < 4);

      if (isTrackpad) {
        // Trackpad two-finger scroll → pan
        state.pan(-e.deltaX, -e.deltaY);
      } else {
        // Mouse wheel → zoom at cursor
        const multiplier = e.deltaMode === 1 ? 20 : 1;
        const delta = -e.deltaY * multiplier * 0.002;
        const newZoom = state.camera.zoom * (1 + delta);
        state.zoomTo(newZoom, focal);
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
        // Clear selection when clicking empty canvas space (not on a penma element)
        const target = e.target as HTMLElement;
        if (!target.closest('[data-penma-id]')) {
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
      style={{ cursor, background: 'var(--penma-bg)', touchAction: 'none', overscrollBehavior: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Canvas background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: '#F5F7FA' }}
      />

      {/* Viewport — manages camera transform, document frames, canvas shapes */}
      <Viewport
        viewportRef={viewportRef}
        onFrameDragStart={handleFrameDragStart}
        onFrameDragMove={handleFrameDragMove}
        onFrameDragEnd={handleFrameDragEnd}
      />

      {/* Empty state */}
      {(documents.length === 0 || documents.every((d) => d.sourceUrl === 'local://canvas' && d.rootNode.children.length === 0)) && (
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
      <SmartGuidesOverlay />
      {editEnabled && <ShapeCreator canvasRef={canvasRef} />}
      <MarqueeSelect canvasRef={canvasRef} />
      <SelectionOverlay />

      {/* Load imported web fonts */}
      <FontLoader />

      {/* Debug viewport overlay (Ctrl+Shift+D or ?debug in URL) */}
      <DebugOverlay canvasRef={canvasRef} />

      {/* Figma-style bottom toolbar */}
      <BottomToolbar />

    </div>
  );
};

