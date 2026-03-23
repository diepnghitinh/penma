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
    const zoom = camera.zoom;

    // Measure selected element to its parent edges
    const parentEl = selectedEl.parentElement;
    if (parentEl) {
      const parRect = parentEl.getBoundingClientRect();
      measureToParent(selRect, parRect, zoom, result);

      // Also measure to siblings (nearest in each direction)
      measureToSiblings(selectedEl, selRect, zoom, result);
    }

    setLines(result);
  }, [altHeld, selectedIds, mousePos, camera.zoom]);

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

function measureBetweenRects(a: DOMRect, b: DOMRect, zoom: number, out: MeasureLine[]) {
  const aCx = a.left + a.width / 2;
  const aCy = a.top + a.height / 2;
  const bCx = b.left + b.width / 2;
  const bCy = b.top + b.height / 2;

  // Horizontal distance (label shows design-space value, divided by zoom)
  if (a.right < b.left) {
    const gap = Math.round((b.left - a.right) / zoom);
    if (gap > 0) out.push({ x1: a.right, y1: aCy, x2: b.left, y2: aCy, label: `${gap}`, orientation: 'h' });
  } else if (b.right < a.left) {
    const gap = Math.round((a.left - b.right) / zoom);
    if (gap > 0) out.push({ x1: b.right, y1: aCy, x2: a.left, y2: aCy, label: `${gap}`, orientation: 'h' });
  } else {
    if (Math.abs(a.left - b.left) > 1) {
      const d = Math.round(Math.abs(a.left - b.left) / zoom);
      const y = Math.min(a.top, b.top) - 12;
      out.push({ x1: Math.min(a.left, b.left), y1: y, x2: Math.max(a.left, b.left), y2: y, label: `${d}`, orientation: 'h' });
    }
    if (Math.abs(a.right - b.right) > 1) {
      const d = Math.round(Math.abs(a.right - b.right) / zoom);
      const y = Math.max(a.bottom, b.bottom) + 12;
      out.push({ x1: Math.min(a.right, b.right), y1: y, x2: Math.max(a.right, b.right), y2: y, label: `${d}`, orientation: 'h' });
    }
  }

  // Vertical distance
  if (a.bottom < b.top) {
    const gap = Math.round((b.top - a.bottom) / zoom);
    if (gap > 0) out.push({ x1: aCx, y1: a.bottom, x2: aCx, y2: b.top, label: `${gap}`, orientation: 'v' });
  } else if (b.bottom < a.top) {
    const gap = Math.round((a.top - b.bottom) / zoom);
    if (gap > 0) out.push({ x1: bCx, y1: b.bottom, x2: bCx, y2: a.top, label: `${gap}`, orientation: 'v' });
  } else {
    if (Math.abs(a.top - b.top) > 1) {
      const d = Math.round(Math.abs(a.top - b.top) / zoom);
      const x = Math.min(a.left, b.left) - 12;
      out.push({ x1: x, y1: Math.min(a.top, b.top), x2: x, y2: Math.max(a.top, b.top), label: `${d}`, orientation: 'v' });
    }
    if (Math.abs(a.bottom - b.bottom) > 1) {
      const d = Math.round(Math.abs(a.bottom - b.bottom) / zoom);
      const x = Math.max(a.right, b.right) + 12;
      out.push({ x1: x, y1: Math.min(a.bottom, b.bottom), x2: x, y2: Math.max(a.bottom, b.bottom), label: `${d}`, orientation: 'v' });
    }
  }
}

function measureToSiblings(el: Element, selRect: DOMRect, zoom: number, out: MeasureLine[]) {
  const parent = el.parentElement;
  if (!parent) return;

  const siblings = Array.from(parent.children).filter((c) => c !== el && c.getBoundingClientRect().width > 0);
  if (siblings.length === 0) return;

  const cx = selRect.left + selRect.width / 2;
  const cy = selRect.top + selRect.height / 2;

  let nearestLeft: { el: Element; dist: number } | null = null;
  let nearestRight: { el: Element; dist: number } | null = null;
  let nearestTop: { el: Element; dist: number } | null = null;
  let nearestBottom: { el: Element; dist: number } | null = null;

  for (const sib of siblings) {
    const r = sib.getBoundingClientRect();
    if (r.right <= selRect.left) { const d = selRect.left - r.right; if (!nearestLeft || d < nearestLeft.dist) nearestLeft = { el: sib, dist: d }; }
    if (r.left >= selRect.right) { const d = r.left - selRect.right; if (!nearestRight || d < nearestRight.dist) nearestRight = { el: sib, dist: d }; }
    if (r.bottom <= selRect.top) { const d = selRect.top - r.bottom; if (!nearestTop || d < nearestTop.dist) nearestTop = { el: sib, dist: d }; }
    if (r.top >= selRect.bottom) { const d = r.top - selRect.bottom; if (!nearestBottom || d < nearestBottom.dist) nearestBottom = { el: sib, dist: d }; }
  }

  // Labels show design-space distances (divided by zoom)
  if (nearestLeft && nearestLeft.dist > 0) {
    const r = nearestLeft.el.getBoundingClientRect();
    out.push({ x1: r.right, y1: cy, x2: selRect.left, y2: cy, label: `${Math.round(nearestLeft.dist / zoom)}`, orientation: 'h' });
  }
  if (nearestRight && nearestRight.dist > 0) {
    const r = nearestRight.el.getBoundingClientRect();
    out.push({ x1: selRect.right, y1: cy, x2: r.left, y2: cy, label: `${Math.round(nearestRight.dist / zoom)}`, orientation: 'h' });
  }
  if (nearestTop && nearestTop.dist > 0) {
    const r = nearestTop.el.getBoundingClientRect();
    out.push({ x1: cx, y1: r.bottom, x2: cx, y2: selRect.top, label: `${Math.round(nearestTop.dist / zoom)}`, orientation: 'v' });
  }
  if (nearestBottom && nearestBottom.dist > 0) {
    const r = nearestBottom.el.getBoundingClientRect();
    out.push({ x1: cx, y1: selRect.bottom, x2: cx, y2: r.top, label: `${Math.round(nearestBottom.dist / zoom)}`, orientation: 'v' });
  }
}

function measureToParent(child: DOMRect, parent: DOMRect, zoom: number, out: MeasureLine[]) {
  const cx = child.left + child.width / 2;
  const cy = child.top + child.height / 2;

  // Labels show design-space distances (divided by zoom)
  const top = Math.round((child.top - parent.top) / zoom);
  if (top > 0) out.push({ x1: cx, y1: parent.top, x2: cx, y2: child.top, label: `${top}`, orientation: 'v' });

  const bottom = Math.round((parent.bottom - child.bottom) / zoom);
  if (bottom > 0) out.push({ x1: cx, y1: child.bottom, x2: cx, y2: parent.bottom, label: `${bottom}`, orientation: 'v' });

  const left = Math.round((child.left - parent.left) / zoom);
  if (left > 0) out.push({ x1: parent.left, y1: cy, x2: child.left, y2: cy, label: `${left}`, orientation: 'h' });

  const right = Math.round((parent.right - child.right) / zoom);
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
