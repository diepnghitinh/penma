'use client';

import React from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { GuideLine, SpacingIndicator } from '@/lib/canvas/smart-guides';

const GUIDE_COLOR = '#FF00FF';
const SPACING_COLOR = '#F43F5E';

export const SmartGuidesOverlay: React.FC = () => {
  const guides = useEditorStore((s) => s.smartGuides);
  const spacings = useEditorStore((s) => s.spacingIndicators);
  const zoom = useEditorStore((s) => s.camera.zoom);

  if (guides.length === 0 && spacings.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 44 }}>
      {/* Alignment guide lines */}
      {guides.map((g, i) => (
        <GuideLineView key={i} guide={g} />
      ))}

      {/* Equal spacing indicators */}
      {spacings.map((s, i) => (
        <SpacingView key={`sp-${i}`} spacing={s} zoom={zoom} />
      ))}
    </div>
  );
};

const GuideLineView: React.FC<{ guide: GuideLine }> = ({ guide }) => {
  const isV = guide.type === 'vertical';

  return (
    <div
      className="absolute"
      style={{
        left: isV ? guide.position : guide.start,
        top: isV ? guide.start : guide.position,
        width: isV ? 1 : guide.end - guide.start,
        height: isV ? guide.end - guide.start : 1,
        backgroundColor: GUIDE_COLOR,
      }}
    />
  );
};

const SpacingView: React.FC<{ spacing: SpacingIndicator; zoom: number }> = ({ spacing, zoom }) => {
  const designValue = Math.round(spacing.value / zoom);

  return (
    <>
      {spacing.segments.map((seg, i) => {
        const isH = spacing.direction === 'horizontal';
        const minX = Math.min(seg.x1, seg.x2);
        const minY = Math.min(seg.y1, seg.y2);
        const length = isH ? Math.abs(seg.x2 - seg.x1) : Math.abs(seg.y2 - seg.y1);
        if (length < 2) return null;

        return (
          <React.Fragment key={i}>
            {/* Line */}
            <div
              className="absolute"
              style={{
                left: minX,
                top: minY,
                width: isH ? length : 1,
                height: isH ? 1 : length,
                backgroundColor: SPACING_COLOR,
              }}
            />
            {/* End caps */}
            {isH ? (
              <>
                <div className="absolute" style={{ left: minX, top: minY - 3, width: 1, height: 7, backgroundColor: SPACING_COLOR }} />
                <div className="absolute" style={{ left: minX + length, top: minY - 3, width: 1, height: 7, backgroundColor: SPACING_COLOR }} />
              </>
            ) : (
              <>
                <div className="absolute" style={{ left: minX - 3, top: minY, width: 7, height: 1, backgroundColor: SPACING_COLOR }} />
                <div className="absolute" style={{ left: minX - 3, top: minY + length, width: 7, height: 1, backgroundColor: SPACING_COLOR }} />
              </>
            )}
            {/* Label */}
            {i === 0 && (
              <div
                className="absolute flex items-center justify-center"
                style={{
                  left: isH ? minX + length / 2 - 14 : minX + 4,
                  top: isH ? minY - 18 : minY + length / 2 - 8,
                  minWidth: 28,
                  height: 16,
                  backgroundColor: SPACING_COLOR,
                  borderRadius: 3,
                  padding: '0 4px',
                }}
              >
                <span className="text-[9px] font-medium text-white font-mono">{designValue}</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
