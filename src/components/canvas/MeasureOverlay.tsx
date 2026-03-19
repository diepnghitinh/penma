'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';

interface MeasureLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  orientation: 'h' | 'v';
}

/**
 * Figma-style "Measure the Distance" overlay.
 * Hold Alt/Option to see distances between:
 * - Selected element ↔ hovered element
 * - Selected element ↔ parent edges (when no hover target)
 */
export const MeasureOverlay: React.FC = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hoveredId = useEditorStore((s) => s.hoveredId);
  const camera = useEditorStore((s) => s.camera);

  const [altHeld, setAltHeld] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [lines, setLines] = useState<MeasureLine[]>([]);
  const rafRef = useRef(0);

  // Track Alt/Option key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { e.preventDefault(); setAltHeld(true); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltHeld(false);
    };
    const blur = () => setAltHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Track mouse position for parent-edge measurement
  useEffect(() => {
    if (!altHeld) return;
    const move = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [altHeld]);

  // Compute measurement lines
  const computeLines = useCallback(() => {
    if (!altHeld || selectedIds.length === 0) {
      setLines([]);
      return;
    }

    const selectedEl = document.querySelector(`[data-penma-id="${selectedIds[0]}"]`);
    if (!selectedEl) { setLines([]); return; }

    const selRect = selectedEl.getBoundingClientRect();
    const result: MeasureLine[] = [];

    // If hovering a different element, measure between selected and hovered
    if (hoveredId && hoveredId !== selectedIds[0]) {
      const hoverEl = document.querySelector(`[data-penma-id="${hoveredId}"]`);
      if (hoverEl) {
        const hovRect = hoverEl.getBoundingClientRect();
        measureBetweenRects(selRect, hovRect, result);
      }
    } else {
      // No hover target — measure to parent edges
      const parentEl = selectedEl.parentElement;
      if (parentEl) {
        const parRect = parentEl.getBoundingClientRect();
        measureToParent(selRect, parRect, result);
      }
    }

    setLines(result);
  }, [altHeld, selectedIds, hoveredId, mousePos]);

  useEffect(() => {
    if (!altHeld) { setLines([]); return; }
    const update = () => {
      computeLines();
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [altHeld, computeLines]);

  if (!altHeld || lines.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 45 }}>
      {lines.map((line, i) => (
        <MeasureLineView key={i} line={line} />
      ))}
    </div>
  );
};

// ── Measurement logic ───────────────────────────────────────

function measureBetweenRects(a: DOMRect, b: DOMRect, out: MeasureLine[]) {
  const aCx = a.left + a.width / 2;
  const aCy = a.top + a.height / 2;
  const bCx = b.left + b.width / 2;
  const bCy = b.top + b.height / 2;

  // Horizontal distance
  if (a.right < b.left) {
    // A is left of B
    const gap = Math.round(b.left - a.right);
    if (gap > 0) out.push({ x1: a.right, y1: aCy, x2: b.left, y2: aCy, label: `${gap}`, orientation: 'h' });
  } else if (b.right < a.left) {
    // B is left of A
    const gap = Math.round(a.left - b.right);
    if (gap > 0) out.push({ x1: b.right, y1: aCy, x2: a.left, y2: aCy, label: `${gap}`, orientation: 'h' });
  } else {
    // Overlapping horizontally — show overlap edges
    if (Math.abs(a.left - b.left) > 1) {
      const d = Math.round(Math.abs(a.left - b.left));
      const y = Math.min(a.top, b.top) - 12;
      out.push({ x1: Math.min(a.left, b.left), y1: y, x2: Math.max(a.left, b.left), y2: y, label: `${d}`, orientation: 'h' });
    }
    if (Math.abs(a.right - b.right) > 1) {
      const d = Math.round(Math.abs(a.right - b.right));
      const y = Math.max(a.bottom, b.bottom) + 12;
      out.push({ x1: Math.min(a.right, b.right), y1: y, x2: Math.max(a.right, b.right), y2: y, label: `${d}`, orientation: 'h' });
    }
  }

  // Vertical distance
  if (a.bottom < b.top) {
    const gap = Math.round(b.top - a.bottom);
    if (gap > 0) out.push({ x1: aCx, y1: a.bottom, x2: aCx, y2: b.top, label: `${gap}`, orientation: 'v' });
  } else if (b.bottom < a.top) {
    const gap = Math.round(a.top - b.bottom);
    if (gap > 0) out.push({ x1: bCx, y1: b.bottom, x2: bCx, y2: a.top, label: `${gap}`, orientation: 'v' });
  } else {
    // Overlapping vertically
    if (Math.abs(a.top - b.top) > 1) {
      const d = Math.round(Math.abs(a.top - b.top));
      const x = Math.min(a.left, b.left) - 12;
      out.push({ x1: x, y1: Math.min(a.top, b.top), x2: x, y2: Math.max(a.top, b.top), label: `${d}`, orientation: 'v' });
    }
    if (Math.abs(a.bottom - b.bottom) > 1) {
      const d = Math.round(Math.abs(a.bottom - b.bottom));
      const x = Math.max(a.right, b.right) + 12;
      out.push({ x1: x, y1: Math.min(a.bottom, b.bottom), x2: x, y2: Math.max(a.bottom, b.bottom), label: `${d}`, orientation: 'v' });
    }
  }
}

function measureToParent(child: DOMRect, parent: DOMRect, out: MeasureLine[]) {
  const cx = child.left + child.width / 2;
  const cy = child.top + child.height / 2;

  // Top
  const top = Math.round(child.top - parent.top);
  if (top > 0) out.push({ x1: cx, y1: parent.top, x2: cx, y2: child.top, label: `${top}`, orientation: 'v' });

  // Bottom
  const bottom = Math.round(parent.bottom - child.bottom);
  if (bottom > 0) out.push({ x1: cx, y1: child.bottom, x2: cx, y2: parent.bottom, label: `${bottom}`, orientation: 'v' });

  // Left
  const left = Math.round(child.left - parent.left);
  if (left > 0) out.push({ x1: parent.left, y1: cy, x2: child.left, y2: cy, label: `${left}`, orientation: 'h' });

  // Right
  const right = Math.round(parent.right - child.right);
  if (right > 0) out.push({ x1: child.right, y1: cy, x2: parent.right, y2: cy, label: `${right}`, orientation: 'h' });
}

// ── Rendering ───────────────────────────────────────────────

const MEASURE_COLOR = '#F43F5E'; // Rose-500

const MeasureLineView: React.FC<{ line: MeasureLine }> = ({ line }) => {
  const { x1, y1, x2, y2, label, orientation } = line;
  const isH = orientation === 'h';
  const length = isH ? Math.abs(x2 - x1) : Math.abs(y2 - y1);

  if (length < 2) return null;

  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);

  return (
    <>
      {/* Line */}
      <div
        className="absolute"
        style={{
          left: minX,
          top: minY,
          width: isH ? length : 1,
          height: isH ? 1 : length,
          backgroundColor: MEASURE_COLOR,
        }}
      />

      {/* End caps */}
      {isH ? (
        <>
          <div className="absolute" style={{ left: minX, top: minY - 3, width: 1, height: 7, backgroundColor: MEASURE_COLOR }} />
          <div className="absolute" style={{ left: minX + length, top: minY - 3, width: 1, height: 7, backgroundColor: MEASURE_COLOR }} />
        </>
      ) : (
        <>
          <div className="absolute" style={{ left: minX - 3, top: minY, width: 7, height: 1, backgroundColor: MEASURE_COLOR }} />
          <div className="absolute" style={{ left: minX - 3, top: minY + length, width: 7, height: 1, backgroundColor: MEASURE_COLOR }} />
        </>
      )}

      {/* Label */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: isH ? minX + length / 2 - 14 : minX + 4,
          top: isH ? minY - 18 : minY + length / 2 - 8,
          minWidth: 28,
          height: 16,
          backgroundColor: MEASURE_COLOR,
          borderRadius: 3,
          padding: '0 4px',
        }}
      >
        <span className="text-[9px] font-medium text-white font-mono">{label}</span>
      </div>
    </>
  );
};
