'use client';

import React, { useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { getEffectiveStyle } from '@/lib/styles/style-resolver';
import type { PenmaNode } from '@/types/document';

// ─── Icons ──────────────────────────────────────────────────

const TextAlignLeftIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="4" x2="13" y2="4" />
    <line x1="3" y1="8" x2="10" y2="8" />
    <line x1="3" y1="12" x2="13" y2="12" />
  </svg>
);

const TextAlignCenterIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="4" x2="13" y2="4" />
    <line x1="5" y1="8" x2="11" y2="8" />
    <line x1="3" y1="12" x2="13" y2="12" />
  </svg>
);

const TextAlignRightIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="4" x2="13" y2="4" />
    <line x1="6" y1="8" x2="13" y2="8" />
    <line x1="3" y1="12" x2="13" y2="12" />
  </svg>
);

const ValignTopIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="3" x2="13" y2="3" />
    <line x1="8" y1="5" x2="8" y2="13" />
    <polyline points="5.5,7.5 8,5 10.5,7.5" />
  </svg>
);

const ValignMiddleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="8" y1="3" x2="8" y2="6" />
    <polyline points="5.5,5 8,7 10.5,5" />
    <line x1="4" y1="8" x2="12" y2="8" />
    <line x1="8" y1="10" x2="8" y2="13" />
    <polyline points="5.5,11 8,9 10.5,11" />
  </svg>
);

const ValignBottomIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="8" y1="3" x2="8" y2="11" />
    <polyline points="5.5,8.5 8,11 10.5,8.5" />
    <line x1="3" y1="13" x2="13" y2="13" />
  </svg>
);

const LineHeightIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="5" y1="3" x2="12" y2="3" />
    <line x1="5" y1="7" x2="10" y2="7" />
    <line x1="5" y1="11" x2="12" y2="11" />
    <line x1="2" y1="4.5" x2="2" y2="9.5" />
    <polyline points="1,5.5 2,4 3,5.5" />
    <polyline points="1,8.5 2,10 3,8.5" />
  </svg>
);

const LetterSpacingIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="1" y1="4" x2="1" y2="10" />
    <line x1="13" y1="4" x2="13" y2="10" />
    <text x="4.5" y="10" fill="currentColor" stroke="none" fontSize="8" fontWeight="600" fontFamily="Inter, sans-serif">A</text>
  </svg>
);

const TypoSettingsIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="5" r="1.5" />
    <circle cx="11" cy="5" r="1.5" />
    <circle cx="5" cy="11" r="1.5" />
    <circle cx="11" cy="11" r="1.5" />
  </svg>
);

// ─── Shared styles (same as PositionPanel / LayoutPanel) ────

const mutedStyle: React.CSSProperties = { color: 'var(--penma-text-muted)' };

const inputBgStyle: React.CSSProperties = {
  background: 'var(--penma-hover-bg)',
  color: 'var(--penma-text)',
  border: 'none',
  borderRadius: 6,
};

// ─── Constants ──────────────────────────────────────────────

const FONT_WEIGHTS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];

// ─── Alignment button (matches PositionPanel AlignBtn) ──────

const AlignBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex h-[30px] flex-1 items-center justify-center rounded-md cursor-pointer
               transition-all duration-150 ease-out"
    style={{
      color: active ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
      background: active ? 'var(--penma-surface)' : 'transparent',
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08), 0 0.5px 1px rgba(0,0,0,0.06)' : undefined,
    }}
  >
    {children}
  </button>
);

// ─── Main Typography Panel ──────────────────────────────────

export const TypographyPanel: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const get = useCallback(
    (prop: string) => getEffectiveStyle(node.styles, prop) ?? '',
    [node.styles],
  );

  const set = useCallback(
    (overrides: Record<string, string>) => {
      const { pushHistory, updateNodeStyles } = useEditorStore.getState();
      pushHistory('Change typography');
      updateNodeStyles(node.id, overrides);
    },
    [node.id],
  );

  const fontFamily = get('font-family').split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  const fontWeight = String(parseInt(get('font-weight')) || 400);
  const fontSize = parseFloat(get('font-size')) || 16;
  const lineHeight = get('line-height');
  const letterSpacing = get('letter-spacing');
  const textAlign = get('text-align') || 'left';
  const textValign = get('text-valign') || 'top';

  // Display-friendly line height
  const lhDisplay = (() => {
    if (!lineHeight || lineHeight === 'normal') return 'Auto';
    const px = parseFloat(lineHeight);
    if (!isNaN(px)) return `${Math.round(px * 10) / 10}`;
    return lineHeight;
  })();

  // Display-friendly letter spacing
  const lsDisplay = (() => {
    if (!letterSpacing || letterSpacing === 'normal' || letterSpacing === '0px') return '0px';
    const px = parseFloat(letterSpacing);
    if (!isNaN(px)) return `${Math.round(px * 10) / 10}px`;
    return letterSpacing;
  })();

  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* ── Header ── */}
      <div className="flex h-9 items-center justify-between px-4">
        <span className="text-[12px] font-semibold" style={{ color: 'var(--penma-text)' }}>
          Typography
        </span>
        <button
          title="Typography settings"
          className="flex h-[28px] w-[28px] items-center justify-center rounded-md cursor-pointer
                     transition-all duration-150 ease-out shrink-0"
          style={mutedStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--penma-hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <TypoSettingsIcon />
        </button>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-3">
        {/* ── Font family ── */}
        <div>
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => set({ 'font-family': e.target.value })}
            className="w-full h-[30px] rounded-md px-2 text-[12px] focus:outline-none
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={inputBgStyle}
            title="Font family"
          />
        </div>

        {/* ── Weight + Size ── */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md" style={inputBgStyle}>
            <select
              value={fontWeight}
              onChange={(e) => set({ 'font-weight': e.target.value })}
              className="w-full h-full bg-transparent rounded-md px-2 text-[12px] focus:outline-none cursor-pointer appearance-none"
              style={{ color: 'var(--penma-text)' }}
              title="Font weight"
            >
              {FONT_WEIGHTS.map((fw) => (
                <option key={fw.value} value={fw.value}>{fw.label}</option>
              ))}
            </select>
            <svg width="8" height="5" viewBox="0 0 8 5" className="mr-2 shrink-0 pointer-events-none" style={{ color: 'var(--penma-text-muted)', opacity: 0.6 }}>
              <path d="M0.5 0.5L4 4L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex w-[72px] min-w-[72px] h-[30px] items-center rounded-md px-2" style={inputBgStyle}>
            <input
              type="number"
              value={Math.round(fontSize * 10) / 10}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) set({ 'font-size': `${v}px` });
              }}
              min={1}
              max={999}
              step={0.1}
              className="w-full bg-transparent text-[12px] focus:outline-none
                         [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ color: 'var(--penma-text)' }}
              title="Font size"
            />
            <svg width="8" height="5" viewBox="0 0 8 5" className="shrink-0 pointer-events-none" style={{ color: 'var(--penma-text-muted)', opacity: 0.6 }}>
              <path d="M0.5 0.5L4 4L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ── Line height + Letter spacing ── */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2 gap-1.5" style={inputBgStyle}>
            <span className="flex items-center shrink-0" style={mutedStyle}><LineHeightIcon /></span>
            <input
              type="text"
              value={lhDisplay}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === '' || v.toLowerCase() === 'auto') {
                  set({ 'line-height': 'normal' });
                } else {
                  const px = parseFloat(v);
                  if (!isNaN(px) && px > 0) set({ 'line-height': `${px}px` });
                }
              }}
              className="w-full bg-transparent text-[12px] focus:outline-none"
              style={{ color: 'var(--penma-text)' }}
              title="Line height"
            />
          </div>
          <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2 gap-1.5" style={inputBgStyle}>
            <span className="flex items-center shrink-0" style={mutedStyle}><LetterSpacingIcon /></span>
            <input
              type="text"
              value={lsDisplay}
              onChange={(e) => {
                const raw = e.target.value.replace(/px$/i, '').trim();
                const px = parseFloat(raw);
                if (!isNaN(px)) set({ 'letter-spacing': `${px}px` });
                else if (raw === '0' || raw === '') set({ 'letter-spacing': '0px' });
              }}
              className="w-full bg-transparent text-[12px] focus:outline-none"
              style={{ color: 'var(--penma-text)' }}
              title="Letter spacing"
            />
          </div>
        </div>

        {/* ── Alignment ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Alignment</span>
          <div className="flex items-center gap-2">
            {/* Horizontal alignment group */}
            <div className="flex flex-1 rounded-lg p-[2px]" style={{ background: 'var(--penma-hover-bg)' }}>
              <AlignBtn active={textAlign === 'left'} onClick={() => set({ 'text-align': 'left' })} title="Align left">
                <TextAlignLeftIcon />
              </AlignBtn>
              <AlignBtn active={textAlign === 'center'} onClick={() => set({ 'text-align': 'center' })} title="Align center">
                <TextAlignCenterIcon />
              </AlignBtn>
              <AlignBtn active={textAlign === 'right'} onClick={() => set({ 'text-align': 'right' })} title="Align right">
                <TextAlignRightIcon />
              </AlignBtn>
            </div>
            {/* Vertical alignment group */}
            <div className="flex flex-1 rounded-lg p-[2px]" style={{ background: 'var(--penma-hover-bg)' }}>
              <AlignBtn active={textValign === 'top'} onClick={() => set({ 'text-valign': 'top' })} title="Align top">
                <ValignTopIcon />
              </AlignBtn>
              <AlignBtn active={textValign === 'middle'} onClick={() => set({ 'text-valign': 'middle' })} title="Align middle">
                <ValignMiddleIcon />
              </AlignBtn>
              <AlignBtn active={textValign === 'bottom'} onClick={() => set({ 'text-valign': 'bottom' })} title="Align bottom">
                <ValignBottomIcon />
              </AlignBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
