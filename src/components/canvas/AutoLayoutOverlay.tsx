'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';

/**
 * Renders visual indicators for auto layout:
 * - Pink/magenta padding region around the container
 * - Blue gap indicators between children
 * These only appear when an auto-layout node is selected.
 */
export const AutoLayoutOverlay: React.FC = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const document = useEditorStore((s) => s.document);
  const camera = useEditorStore((s) => s.camera);

  const [overlayData, setOverlayData] = useState<{
    paddingRects: { x: number; y: number; w: number; h: number }[];
    gapRects: { x: number; y: number; w: number; h: number; isSpaceBetween: boolean }[];
  } | null>(null);

  const rafRef = useRef(0);

  const computeOverlay = useCallback(() => {
    if (!document || selectedIds.length !== 1) {
      setOverlayData(null);
      return;
    }

    const node = findNodeById(document.rootNode, selectedIds[0]);
    if (!node?.autoLayout) {
      setOverlayData(null);
      return;
    }

    const el = window.document.querySelector(`[data-penma-id="${node.id}"]`);
    if (!el) {
      setOverlayData(null);
      return;
    }

    const containerRect = el.getBoundingClientRect();
    const layout = node.autoLayout;
    const { top: pt, right: pr, bottom: pb, left: pl } = layout.padding;
    const zoom = camera.zoom;

    // Padding regions (scaled by zoom since they're rendered from computed styles in px)
    const paddingRects: { x: number; y: number; w: number; h: number }[] = [];

    // Top padding
    if (pt > 0) {
      paddingRects.push({
        x: containerRect.x,
        y: containerRect.y,
        w: containerRect.width,
        h: pt * zoom,
      });
    }
    // Bottom padding
    if (pb > 0) {
      paddingRects.push({
        x: containerRect.x,
        y: containerRect.y + containerRect.height - pb * zoom,
        w: containerRect.width,
        h: pb * zoom,
      });
    }
    // Left padding
    if (pl > 0) {
      paddingRects.push({
        x: containerRect.x,
        y: containerRect.y + pt * zoom,
        w: pl * zoom,
        h: containerRect.height - pt * zoom - pb * zoom,
      });
    }
    // Right padding
    if (pr > 0) {
      paddingRects.push({
        x: containerRect.x + containerRect.width - pr * zoom,
        y: containerRect.y + pt * zoom,
        w: pr * zoom,
        h: containerRect.height - pt * zoom - pb * zoom,
      });
    }

    // Gap indicators between children — measured from actual rendered positions,
    // works for explicit gap AND space-between distribution
    const gapRects: { x: number; y: number; w: number; h: number; isSpaceBetween: boolean }[] = [];
    const isSpaceBetween = layout.primaryAxisAlign === 'space-between';
    const children = Array.from(el.children);
    const visibleChildren = children.filter((child) => {
      const cs = window.getComputedStyle(child);
      return cs.display !== 'none';
    });

    if (visibleChildren.length >= 2) {
      const isHoriz = layout.direction === 'horizontal' || layout.direction === 'wrap';

      for (let i = 0; i < visibleChildren.length - 1; i++) {
        const a = visibleChildren[i].getBoundingClientRect();
        const b = visibleChildren[i + 1].getBoundingClientRect();

        if (isHoriz) {
          const spacing = b.left - a.right;
          if (spacing > 0.5) {
            gapRects.push({
              x: a.right,
              y: Math.min(a.top, b.top),
              w: spacing,
              h: Math.max(a.height, b.height),
              isSpaceBetween,
            });
          }
        } else {
          const spacing = b.top - a.bottom;
          if (spacing > 0.5) {
            gapRects.push({
              x: Math.min(a.left, b.left),
              y: a.bottom,
              w: Math.max(a.width, b.width),
              h: spacing,
              isSpaceBetween,
            });
          }
        }
      }
    }

    setOverlayData({ paddingRects, gapRects });
  }, [selectedIds, document, camera]);

  useEffect(() => {
    const update = () => {
      computeOverlay();
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [computeOverlay]);

  if (!overlayData) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* Padding indicators (pink/magenta) */}
      {overlayData.paddingRects.map((r, i) => (
        <div
          key={`pad-${i}`}
          className="absolute"
          style={{
            left: r.x,
            top: r.y,
            width: r.w,
            height: r.h,
            backgroundColor: 'rgba(236, 72, 153, 0.1)',
            borderColor: 'rgba(236, 72, 153, 0.3)',
            borderWidth: 1,
            borderStyle: 'dashed',
          }}
        />
      ))}

      {/* Gap indicators: blue for explicit gap, green for space-between */}
      {overlayData.gapRects.map((r, i) => {
        const isSB = r.isSpaceBetween;
        const bg = isSB ? 'rgba(34, 197, 94, 0.08)' : 'rgba(59, 130, 246, 0.08)';
        const lineClass = isSB ? 'bg-green-400/40' : 'bg-blue-400/40';
        const textClass = isSB ? 'text-green-600' : 'text-blue-500';
        const isWide = r.w > r.h;
        const size = Math.round(isWide ? r.w : r.h);

        return (
          <div
            key={`gap-${i}`}
            className="absolute flex items-center justify-center"
            style={{ left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: bg }}
          >
            {/* Center line */}
            <div
              className={lineClass}
              style={{ width: isWide ? '100%' : 1, height: isWide ? 1 : '100%' }}
            />
            {/* Size label */}
            {size > 4 && (
              <span className={`absolute text-[8px] font-medium bg-white/80 px-0.5 rounded ${textClass}`}>
                {size}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
