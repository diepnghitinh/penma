/**
 * Smart Guides & Snapping System
 * Pure functions — no DOM or React dependencies.
 * All coordinates are in screen space (pixels).
 */

// ── Types ────────────────────────────────────────────────────

export interface SnapRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideLine {
  type: 'vertical' | 'horizontal';
  /** Position on the perpendicular axis (x for vertical, y for horizontal) */
  position: number;
  /** Start of the line along the parallel axis */
  start: number;
  /** End of the line along the parallel axis */
  end: number;
}

export interface SpacingIndicator {
  direction: 'horizontal' | 'vertical';
  value: number;
  segments: { x1: number; y1: number; x2: number; y2: number }[];
}

export interface SnapResult {
  /** Screen-space X correction to apply */
  dx: number;
  /** Screen-space Y correction to apply */
  dy: number;
  /** Guide lines to render */
  guides: GuideLine[];
}

// ── Constants ────────────────────────────────────────────────

const SNAP_THRESHOLD = 5;
const SPACING_TOLERANCE = 4;
const NEARBY_MARGIN = 300;

// ── Helpers ──────────────────────────────────────────────────

interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function edges(r: SnapRect): Edges {
  return {
    left: r.x,
    right: r.x + r.width,
    top: r.y,
    bottom: r.y + r.height,
    centerX: r.x + r.width / 2,
    centerY: r.y + r.height / 2,
  };
}

function filterNearby(dragged: SnapRect, others: SnapRect[]): SnapRect[] {
  const m = NEARBY_MARGIN;
  return others.filter((r) =>
    r.id !== dragged.id &&
    r.x < dragged.x + dragged.width + m &&
    r.x + r.width > dragged.x - m &&
    r.y < dragged.y + dragged.height + m &&
    r.y + r.height > dragged.y - m
  );
}

// ── Snapping ─────────────────────────────────────────────────

/**
 * Compute snapped position and guide lines for a dragged rect.
 * Returns screen-space dx/dy corrections and guide lines to render.
 */
export function getSnappedPosition(
  dragged: SnapRect,
  others: SnapRect[],
  threshold = SNAP_THRESHOLD,
): SnapResult {
  const nearby = filterNearby(dragged, others);
  if (nearby.length === 0) return { dx: 0, dy: 0, guides: [] };

  const d = edges(dragged);

  // Candidate: { delta, priority, guideFn }
  // Priority: 0 = center, 1 = edge (lower = better)
  type Candidate = { delta: number; priority: number; guides: GuideLine[] };

  let bestX: Candidate | null = null;
  let bestY: Candidate | null = null;

  for (const other of nearby) {
    const o = edges(other);

    // ── Vertical guides (snap X axis) ──
    const xPairs: { dVal: number; oVal: number; priority: number }[] = [
      // center-center
      { dVal: d.centerX, oVal: o.centerX, priority: 0 },
      // edge alignments
      { dVal: d.left, oVal: o.left, priority: 1 },
      { dVal: d.right, oVal: o.right, priority: 1 },
      { dVal: d.left, oVal: o.right, priority: 1 },
      { dVal: d.right, oVal: o.left, priority: 1 },
    ];

    for (const { dVal, oVal, priority } of xPairs) {
      const delta = oVal - dVal;
      if (Math.abs(delta) > threshold) continue;
      const absDelta = Math.abs(delta);
      if (!bestX || absDelta < Math.abs(bestX.delta) || (absDelta === Math.abs(bestX.delta) && priority < bestX.priority)) {
        const minY = Math.min(d.top, o.top);
        const maxY = Math.max(d.bottom, o.bottom);
        bestX = { delta, priority, guides: [{ type: 'vertical', position: oVal, start: minY, end: maxY }] };
      }
    }

    // ── Horizontal guides (snap Y axis) ──
    const yPairs: { dVal: number; oVal: number; priority: number }[] = [
      { dVal: d.centerY, oVal: o.centerY, priority: 0 },
      { dVal: d.top, oVal: o.top, priority: 1 },
      { dVal: d.bottom, oVal: o.bottom, priority: 1 },
      { dVal: d.top, oVal: o.bottom, priority: 1 },
      { dVal: d.bottom, oVal: o.top, priority: 1 },
    ];

    for (const { dVal, oVal, priority } of yPairs) {
      const delta = oVal - dVal;
      if (Math.abs(delta) > threshold) continue;
      const absDelta = Math.abs(delta);
      if (!bestY || absDelta < Math.abs(bestY.delta) || (absDelta === Math.abs(bestY.delta) && priority < bestY.priority)) {
        const minX = Math.min(d.left, o.left);
        const maxX = Math.max(d.right, o.right);
        bestY = { delta, priority, guides: [{ type: 'horizontal', position: oVal, start: minX, end: maxX }] };
      }
    }
  }

  const guides: GuideLine[] = [];
  if (bestX) guides.push(...bestX.guides);
  if (bestY) guides.push(...bestY.guides);

  return {
    dx: bestX?.delta ?? 0,
    dy: bestY?.delta ?? 0,
    guides,
  };
}

// ── Resize Snapping ──────────────────────────────────────────

export type ResizeEdges = {
  /** Which edges are being resized */
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
  top?: boolean;
};

/**
 * Compute snapped position for a resize operation.
 * Only checks the edges being resized, ignoring fixed edges.
 */
export function getResizeSnap(
  dragged: SnapRect,
  others: SnapRect[],
  resizeEdges: ResizeEdges,
  threshold = SNAP_THRESHOLD,
): SnapResult {
  const nearby = filterNearby(dragged, others);
  if (nearby.length === 0) return { dx: 0, dy: 0, guides: [] };

  const d = edges(dragged);

  type Candidate = { delta: number; priority: number; guides: GuideLine[] };

  let bestX: Candidate | null = null;
  let bestY: Candidate | null = null;

  for (const other of nearby) {
    const o = edges(other);

    // ── Vertical guides (snap X axis) — only check resizing edges ──
    if (resizeEdges.right || resizeEdges.left) {
      const xPairs: { dVal: number; oVal: number; priority: number }[] = [];

      if (resizeEdges.right) {
        xPairs.push(
          { dVal: d.right, oVal: o.right, priority: 1 },
          { dVal: d.right, oVal: o.left, priority: 1 },
          { dVal: d.right, oVal: o.centerX, priority: 2 },
        );
      }
      if (resizeEdges.left) {
        xPairs.push(
          { dVal: d.left, oVal: o.left, priority: 1 },
          { dVal: d.left, oVal: o.right, priority: 1 },
          { dVal: d.left, oVal: o.centerX, priority: 2 },
        );
      }
      // Center snap when both sides or either side resizes
      xPairs.push({ dVal: d.centerX, oVal: o.centerX, priority: 0 });

      for (const { dVal, oVal, priority } of xPairs) {
        const delta = oVal - dVal;
        if (Math.abs(delta) > threshold) continue;
        const absDelta = Math.abs(delta);
        if (!bestX || absDelta < Math.abs(bestX.delta) || (absDelta === Math.abs(bestX.delta) && priority < bestX.priority)) {
          const minY = Math.min(d.top, o.top);
          const maxY = Math.max(d.bottom, o.bottom);
          bestX = { delta, priority, guides: [{ type: 'vertical', position: oVal, start: minY, end: maxY }] };
        }
      }
    }

    // ── Horizontal guides (snap Y axis) — only check resizing edges ──
    if (resizeEdges.bottom || resizeEdges.top) {
      const yPairs: { dVal: number; oVal: number; priority: number }[] = [];

      if (resizeEdges.bottom) {
        yPairs.push(
          { dVal: d.bottom, oVal: o.bottom, priority: 1 },
          { dVal: d.bottom, oVal: o.top, priority: 1 },
          { dVal: d.bottom, oVal: o.centerY, priority: 2 },
        );
      }
      if (resizeEdges.top) {
        yPairs.push(
          { dVal: d.top, oVal: o.top, priority: 1 },
          { dVal: d.top, oVal: o.bottom, priority: 1 },
          { dVal: d.top, oVal: o.centerY, priority: 2 },
        );
      }
      yPairs.push({ dVal: d.centerY, oVal: o.centerY, priority: 0 });

      for (const { dVal, oVal, priority } of yPairs) {
        const delta = oVal - dVal;
        if (Math.abs(delta) > threshold) continue;
        const absDelta = Math.abs(delta);
        if (!bestY || absDelta < Math.abs(bestY.delta) || (absDelta === Math.abs(bestY.delta) && priority < bestY.priority)) {
          const minX = Math.min(d.left, o.left);
          const maxX = Math.max(d.right, o.right);
          bestY = { delta, priority, guides: [{ type: 'horizontal', position: oVal, start: minX, end: maxX }] };
        }
      }
    }
  }

  const guides: GuideLine[] = [];
  if (bestX) guides.push(...bestX.guides);
  if (bestY) guides.push(...bestY.guides);

  return {
    dx: bestX?.delta ?? 0,
    dy: bestY?.delta ?? 0,
    guides,
  };
}

// ── Equal Spacing ────────────────────────────────────────────

/**
 * Detect equal spacing between elements.
 * When the dragged element is between two others with equal gaps,
 * returns spacing indicators.
 */
export function getEqualSpacing(
  dragged: SnapRect,
  others: SnapRect[],
): SpacingIndicator[] {
  const nearby = filterNearby(dragged, others);
  if (nearby.length < 2) return [];

  const indicators: SpacingIndicator[] = [];
  const d = edges(dragged);

  // ── Horizontal spacing ──
  const leftNeighbors = nearby.filter((r) => r.x + r.width <= d.left + SPACING_TOLERANCE).sort((a, b) => (b.x + b.width) - (a.x + a.width));
  const rightNeighbors = nearby.filter((r) => r.x >= d.right - SPACING_TOLERANCE).sort((a, b) => a.x - b.x);

  if (leftNeighbors.length > 0 && rightNeighbors.length > 0) {
    const left = leftNeighbors[0];
    const right = rightNeighbors[0];
    const gapLeft = d.left - (left.x + left.width);
    const gapRight = right.x - d.right;
    if (gapLeft > 0 && gapRight > 0 && Math.abs(gapLeft - gapRight) < SPACING_TOLERANCE) {
      const avgGap = Math.round((gapLeft + gapRight) / 2);
      const cy = d.centerY;
      indicators.push({
        direction: 'horizontal',
        value: avgGap,
        segments: [
          { x1: left.x + left.width, y1: cy, x2: d.left, y2: cy },
          { x1: d.right, y1: cy, x2: right.x, y2: cy },
        ],
      });
    }
  }

  // ── Vertical spacing ──
  const topNeighbors = nearby.filter((r) => r.y + r.height <= d.top + SPACING_TOLERANCE).sort((a, b) => (b.y + b.height) - (a.y + a.height));
  const bottomNeighbors = nearby.filter((r) => r.y >= d.bottom - SPACING_TOLERANCE).sort((a, b) => a.y - b.y);

  if (topNeighbors.length > 0 && bottomNeighbors.length > 0) {
    const top = topNeighbors[0];
    const bottom = bottomNeighbors[0];
    const gapTop = d.top - (top.y + top.height);
    const gapBottom = bottom.y - d.bottom;
    if (gapTop > 0 && gapBottom > 0 && Math.abs(gapTop - gapBottom) < SPACING_TOLERANCE) {
      const avgGap = Math.round((gapTop + gapBottom) / 2);
      const cx = d.centerX;
      indicators.push({
        direction: 'vertical',
        value: avgGap,
        segments: [
          { x1: cx, y1: top.y + top.height, x2: cx, y2: d.top },
          { x1: cx, y1: d.bottom, x2: cx, y2: bottom.y },
        ],
      });
    }
  }

  return indicators;
}
