'use client';

import React, { useCallback, useState } from 'react';
import { Plus, Maximize2, Minimize2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { PenmaNode, LayoutDirection, PrimaryAxisAlign, CounterAxisAlign } from '@/types/document';

// ─── Figma-style SVG icons ──────────────────────────────────

/** Horizontal flow: ⟶ (row) */
const FlowHorizIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="5" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <line x1="7.5" y1="8" x2="11" y2="8" />
    <polyline points="9.5,6.5 11,8 9.5,9.5" />
  </svg>
);

/** Vertical flow: ↓ (column) */
const FlowVertIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="8" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="7.5" x2="8" y2="11" />
    <polyline points="6.5,9.5 8,11 9.5,9.5" />
  </svg>
);

/** Wrap flow: grid wrap */
const FlowWrapIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="4" width="3" height="3" rx="0.8" fill="currentColor" />
    <rect x="7" y="4" width="3" height="3" rx="0.8" fill="currentColor" />
    <rect x="11" y="4" width="3" height="3" rx="0.8" fill="currentColor" opacity="0.4" />
    <rect x="3" y="9" width="3" height="3" rx="0.8" fill="currentColor" opacity="0.4" />
  </svg>
);

/** Reverse icon: ↩ */
const ReverseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5H6.5a2.5 2.5 0 000 5H8" />
    <polyline points="10,3 12,5 10,7" />
  </svg>
);

/** Auto layout header icon */
const AutoLayoutIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <rect x="2" y="4" width="5" height="8" rx="1" />
    <rect x="9" y="4" width="5" height="8" rx="1" />
    <line x1="4.5" y1="7" x2="4.5" y2="9" />
    <line x1="11.5" y1="7" x2="11.5" y2="9" />
  </svg>
);

/** Gap icon: }|{ */
const GapIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <path d="M4 3.5C3 3.5 2.5 4.5 2.5 5v4c0 .5.5 1.5 1.5 1.5" />
    <path d="M10 3.5c1 0 1.5 1 1.5 1.5v4c0 .5-.5 1.5-1.5 1.5" />
    <line x1="7" y1="4" x2="7" y2="10" />
  </svg>
);

/** Horizontal padding icon: |o| */
const PadHorizIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="2" y1="3" x2="2" y2="11" />
    <line x1="12" y1="3" x2="12" y2="11" />
    <line x1="4" y1="7" x2="10" y2="7" />
  </svg>
);

/** Vertical padding icon: ═ */
const PadVertIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="3" y1="2" x2="11" y2="2" />
    <line x1="3" y1="12" x2="11" y2="12" />
    <line x1="7" y1="4" x2="7" y2="10" />
  </svg>
);

/** Constrain proportions icon */
const ConstrainIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="10" height="10" rx="2" />
    <path d="M5 5l4 4M9 5l-4 4" />
  </svg>
);

/** Settings/tune icon */
const TuneIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="7" y1="2" x2="7" y2="5" />
    <line x1="7" y1="9" x2="7" y2="12" />
    <circle cx="7" cy="7" r="2" />
    <line x1="3" y1="2" x2="3" y2="8" />
    <line x1="3" y1="10" x2="3" y2="12" />
    <circle cx="3" cy="9" r="1" />
    <line x1="11" y1="2" x2="11" y2="4" />
    <line x1="11" y1="8" x2="11" y2="12" />
    <circle cx="11" cy="6" r="1" />
  </svg>
);

/** Scroll icon */
const ScrollIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="1.5" width="8" height="11" rx="1.5" />
    <line x1="7" y1="4" x2="7" y2="7" />
    <polyline points="5.5,5.5 7,4 8.5,5.5" />
    <polyline points="5.5,8.5 7,10 8.5,8.5" />
  </svg>
);

// ─── Shared styles ──────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--penma-hover-bg)',
  color: 'var(--penma-text)',
  border: 'none',
  borderRadius: 6,
};

const labelStyle: React.CSSProperties = {
  color: 'var(--penma-text-secondary)',
  fontSize: 12,
  fontWeight: 500,
};

const mutedStyle: React.CSSProperties = {
  color: 'var(--penma-text-muted)',
};

// ─── NumericInput (Figma-style: grey bg, no border) ─────────

const NumericInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  prefix?: React.ReactNode;
  className?: string;
}> = ({ value, onChange, prefix, className = '' }) => (
  <div
    className={`flex items-center h-[30px] rounded-md px-2 gap-1.5 flex-1 ${className}`}
    style={inputStyle}
  >
    {prefix && <span style={mutedStyle} className="flex items-center shrink-0">{prefix}</span>}
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(9999, Number(e.target.value) || 0)))}
      className="w-full bg-transparent text-[12px] focus:outline-none
                 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                 [&::-webkit-outer-spin-button]:appearance-none"
      style={{ color: 'var(--penma-text)' }}
    />
  </div>
);

// ─── Flow toggle button ─────────────────────────────────────

const FlowBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex h-[34px] flex-1 items-center justify-center cursor-pointer
               transition-all duration-150 ease-out"
    style={{
      background: active ? 'var(--penma-surface)' : 'transparent',
      color: active ? 'var(--penma-text)' : 'var(--penma-text-muted)',
      borderRadius: active ? 6 : 0,
      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08), 0 0.5px 1px rgba(0,0,0,0.06)' : undefined,
    }}
  >
    {children}
  </button>
);

// ─── Icon button (right-side actions) ───────────────────────

const IconBtn: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex h-[30px] w-[30px] items-center justify-center rounded-md cursor-pointer
               transition-all duration-150 ease-out shrink-0"
    style={{
      color: active ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
      background: active ? 'var(--penma-primary-light)' : 'transparent',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--penma-hover-bg)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--penma-primary-light)' : 'transparent'; }}
  >
    {children}
  </button>
);

// ─── Alignment grid (3×3 Figma style) ──────────────────────

const AlignmentGrid: React.FC<{
  direction: LayoutDirection;
  primary: PrimaryAxisAlign;
  counter: CounterAxisAlign;
  onChangePrimary: (v: PrimaryAxisAlign) => void;
  onChangeCounter: (v: CounterAxisAlign) => void;
}> = ({ direction, primary, counter, onChangePrimary, onChangeCounter }) => {
  const isHoriz = direction === 'horizontal' || direction === 'wrap';
  const primaryOpts: PrimaryAxisAlign[] = ['start', 'center', 'end'];
  const counterOpts: CounterAxisAlign[] = ['start', 'center', 'end'];
  const isSpaceBetween = primary === 'space-between';

  // Figma shows alignment bars for the active cell
  const getBarStyle = (_pa: PrimaryAxisAlign, _ca: CounterAxisAlign, isActive: boolean) => {
    if (!isActive) return null;
    const bars = isHoriz
      ? [{ w: 2, h: 8 }, { w: 2, h: 5 }, { w: 2, h: 7 }]
      : [{ w: 8, h: 2 }, { w: 5, h: 2 }, { w: 7, h: 2 }];
    return bars;
  };

  return (
    <div
      className="grid grid-cols-3 rounded-lg p-[3px]"
      style={{ background: 'var(--penma-hover-bg)', gap: 2 }}
    >
      {counterOpts.map((ca) =>
        primaryOpts.map((pa) => {
          const isActive = !isSpaceBetween && primary === pa && counter === ca;
          const bars = getBarStyle(pa, ca, isActive);
          return (
            <button
              key={`${pa}-${ca}`}
              onClick={() => { onChangePrimary(pa); onChangeCounter(ca); }}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-md cursor-pointer
                         transition-all duration-150 ease-out"
              style={{
                background: isActive ? 'var(--penma-surface)' : 'transparent',
                boxShadow: isActive ? '0 0.5px 2px rgba(0,0,0,0.08)' : undefined,
              }}
              title={`${pa} / ${ca}`}
            >
              {bars ? (
                <div className={`flex ${isHoriz ? 'flex-row' : 'flex-col'} gap-[1px] items-${isHoriz ? (ca === 'start' ? 'start' : ca === 'end' ? 'end' : 'center') : 'center'} justify-${pa === 'start' ? 'start' : pa === 'end' ? 'end' : 'center'}`}>
                  {bars.map((b, i) => (
                    <div
                      key={i}
                      className="rounded-sm"
                      style={{
                        width: b.w, height: b.h,
                        background: 'var(--penma-primary)',
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-full"
                  style={{ width: 4, height: 4, background: 'var(--penma-border-strong)' }}
                />
              )}
            </button>
          );
        })
      )}
    </div>
  );
};

// ─── Overflow selector ──────────────────────────────────────

type OverflowMode = 'hidden' | 'scroll' | 'visible';

const OVERFLOW_OPTIONS: { value: OverflowMode; label: string }[] = [
  { value: 'hidden', label: 'Clip' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'visible', label: 'Visible' },
];

const OverflowSelector: React.FC<{
  value: OverflowMode;
  onChange: (v: OverflowMode) => void;
}> = ({ value, onChange }) => (
  <div
    className="flex h-[30px] rounded-md p-[2px]"
    style={{ background: 'var(--penma-hover-bg)' }}
  >
    {OVERFLOW_OPTIONS.map((opt) => {
      const isActive = value === opt.value;
      return (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex flex-1 items-center justify-center rounded cursor-pointer
                     transition-all duration-150 ease-out text-[11px]"
          style={{
            background: isActive ? 'var(--penma-surface)' : 'transparent',
            color: isActive ? 'var(--penma-text)' : 'var(--penma-text-muted)',
            boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08), 0 0.5px 1px rgba(0,0,0,0.06)' : undefined,
            fontWeight: isActive ? 500 : 400,
          }}
          title={opt.label}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ─── Main panel ─────────────────────────────────────────────

interface AutoLayoutPanelProps {
  node: PenmaNode;
}

export const AutoLayoutPanel: React.FC<AutoLayoutPanelProps> = ({ node }) => {
  const toggleAutoLayout = useEditorStore((s) => s.toggleAutoLayout);
  const updateAutoLayout = useEditorStore((s) => s.updateAutoLayout);
  const updateAutoLayoutPadding = useEditorStore((s) => s.updateAutoLayoutPadding);
  const setUniformPadding = useEditorStore((s) => s.setUniformPadding);
  const updateSizing = useEditorStore((s) => s.updateSizing);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const layout = node.autoLayout;
  const sizing = node.sizing;
  const hasChildren = node.children.length > 0;

  const change = useCallback(
    (patch: Partial<NonNullable<typeof layout>>) => {
      pushHistory('Update auto layout');
      updateAutoLayout(node.id, patch);
    },
    [node.id, updateAutoLayout, pushHistory]
  );

  // Derive overflow mode from layout
  const overflowMode: OverflowMode = layout?.overflow ?? (layout?.clipContent ? 'hidden' : 'visible');

  const handleOverflowChange = useCallback(
    (mode: OverflowMode) => {
      pushHistory('Change overflow');
      updateAutoLayout(node.id, {
        overflow: mode,
        clipContent: mode === 'hidden',
      });
    },
    [node.id, updateAutoLayout, pushHistory]
  );

  // ── No auto layout → show Layout header with overflow + Add auto layout button ──
  if (!layout) {
    return (
      <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
        {/* Section header: Auto layout with add button */}
        <div className="flex h-9 items-center justify-between px-4">
          <span style={{ ...labelStyle, color: 'var(--penma-text-muted)' }}>Auto layout</span>
          <button
            onClick={() => {
              if (!hasChildren) return;
              pushHistory('Add auto layout');
              toggleAutoLayout(node.id);
            }}
            disabled={!hasChildren}
            className="flex h-[26px] items-center gap-1 rounded-md px-2.5 cursor-pointer
                       transition-all duration-150 ease-out disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--penma-primary)' }}
            title={hasChildren ? 'Add auto layout' : 'Needs children'}
            onMouseEnter={(e) => { if (hasChildren) e.currentTarget.style.background = 'var(--penma-primary-light)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // ── Padding values ──
  const pad = layout.padding;
  const isUniformPad = !layout.independentPadding;
  const padH = pad.left;
  const padV = pad.top;

  // ── Has auto layout → full controls ──
  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* ── Header ── */}
      <div className="flex h-9 items-center justify-between px-4">
        <span style={{ ...labelStyle, fontWeight: 600, color: 'var(--penma-text)' }}>
          Auto layout
        </span>
        <IconBtn
          onClick={() => { pushHistory('Remove auto layout'); toggleAutoLayout(node.id); }}
          title="Toggle auto layout"
        >
          <AutoLayoutIcon />
        </IconBtn>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {/* ── Overflow ── */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ScrollIcon />
            <span className="text-[11px]" style={mutedStyle}>Overflow</span>
          </div>
          <OverflowSelector value={overflowMode} onChange={handleOverflowChange} />
        </div>

        {/* ── Flow ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Flow</span>
          <div className="flex items-center gap-1.5">
            <div
              className="flex flex-1 rounded-lg p-[3px]"
              style={{ background: 'var(--penma-hover-bg)' }}
            >
              <FlowBtn
                active={layout.direction === 'horizontal'}
                onClick={() => change({ direction: 'horizontal' })}
                title="Horizontal"
              >
                <FlowHorizIcon />
              </FlowBtn>
              <FlowBtn
                active={layout.direction === 'vertical'}
                onClick={() => change({ direction: 'vertical' })}
                title="Vertical"
              >
                <FlowVertIcon />
              </FlowBtn>
              <FlowBtn
                active={layout.direction === 'wrap'}
                onClick={() => change({ direction: 'wrap' })}
                title="Wrap"
              >
                <FlowWrapIcon />
              </FlowBtn>
            </div>
            <IconBtn
              onClick={() => change({ reverse: !layout.reverse })}
              title="Reverse order"
              active={layout.reverse}
            >
              <ReverseIcon />
            </IconBtn>
          </div>
        </div>

        {/* ── Dimensions (container sizing) ── */}
        {sizing && (
          <div>
            <span className="block text-[11px] mb-1.5" style={mutedStyle}>Resizing</span>
            <div className="flex items-center gap-1.5">
              {/* W */}
              <div
                className="flex items-center h-[30px] flex-1 rounded-md px-2 gap-1"
                style={inputStyle}
              >
                <span className="text-[11px] shrink-0" style={mutedStyle}>W</span>
                <input
                  type="text"
                  value={Math.round(node.bounds.width)}
                  readOnly
                  className="w-full bg-transparent text-[12px] focus:outline-none"
                  style={{ color: 'var(--penma-text)' }}
                />
                <select
                  value={sizing.horizontal}
                  onChange={(e) => { pushHistory('Change sizing'); updateSizing(node.id, 'horizontal', e.target.value as 'fixed' | 'hug' | 'fill'); }}
                  className="bg-transparent text-[9px] cursor-pointer focus:outline-none appearance-none"
                  style={mutedStyle}
                  title="Width sizing mode"
                >
                  <option value="fixed">Fixed</option>
                  <option value="hug">Hug</option>
                  <option value="fill">Fill</option>
                </select>
              </div>
              {/* H */}
              <div
                className="flex items-center h-[30px] flex-1 rounded-md px-2 gap-1"
                style={inputStyle}
              >
                <span className="text-[11px] shrink-0" style={mutedStyle}>H</span>
                <input
                  type="text"
                  value={Math.round(node.bounds.height)}
                  readOnly
                  className="w-full bg-transparent text-[12px] focus:outline-none"
                  style={{ color: 'var(--penma-text)' }}
                />
                <select
                  value={sizing.vertical}
                  onChange={(e) => { pushHistory('Change sizing'); updateSizing(node.id, 'vertical', e.target.value as 'fixed' | 'hug' | 'fill'); }}
                  className="bg-transparent text-[9px] cursor-pointer focus:outline-none appearance-none"
                  style={mutedStyle}
                  title="Height sizing mode"
                >
                  <option value="fixed">Fixed</option>
                  <option value="hug">Hug</option>
                  <option value="fill">Fill</option>
                </select>
              </div>
              {/* Constrain */}
              <IconBtn onClick={() => {}} title="Constrain proportions">
                <ConstrainIcon />
              </IconBtn>
            </div>
          </div>
        )}

        {/* ── Alignment + Gap (side by side like Figma) ── */}
        <div className="flex gap-3">
          {/* Alignment grid */}
          <div className="shrink-0">
            <span className="block text-[11px] mb-1.5" style={mutedStyle}>Alignment</span>
            <AlignmentGrid
              direction={layout.direction}
              primary={layout.primaryAxisAlign}
              counter={layout.counterAxisAlign}
              onChangePrimary={(v) => change({ primaryAxisAlign: v })}
              onChangeCounter={(v) => change({ counterAxisAlign: v })}
            />
            {/* Space-between toggle below grid */}
            <button
              onClick={() => change({ primaryAxisAlign: layout.primaryAxisAlign === 'space-between' ? 'start' : 'space-between' })}
              className="mt-1.5 flex h-[22px] w-full items-center justify-center gap-1 rounded-md cursor-pointer
                         transition-all duration-150 ease-out text-[9px]"
              style={{
                background: layout.primaryAxisAlign === 'space-between' ? 'var(--penma-primary-light)' : 'var(--penma-hover-bg)',
                color: layout.primaryAxisAlign === 'space-between' ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
                fontWeight: layout.primaryAxisAlign === 'space-between' ? 500 : 400,
              }}
              title="Space between"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="1" y="3" width="2" height="6" rx="0.5" />
                <rect x="5" y="3" width="2" height="6" rx="0.5" />
                <rect x="9" y="3" width="2" height="6" rx="0.5" />
              </svg>
            </button>
          </div>

          {/* Gap */}
          <div className="flex-1">
            <span className="block text-[11px] mb-1.5" style={mutedStyle}>Gap</span>
            {layout.direction === 'wrap' ? (
              <div className="flex flex-col gap-1.5">
                <NumericInput
                  value={layout.gap}
                  onChange={(v) => change({ gap: v })}
                  prefix={<GapIcon />}
                />
                <NumericInput
                  value={layout.counterAxisGap ?? layout.gap}
                  onChange={(v) => change({ counterAxisGap: v })}
                  prefix={
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                      <path d="M3.5 4C3.5 3 4.5 2.5 5 2.5h4c.5 0 1.5.5 1.5 1.5" />
                      <path d="M3.5 10c0 1 1 1.5 1.5 1.5h4c.5 0 1.5-.5 1.5-1.5" />
                      <line x1="4" y1="7" x2="10" y2="7" />
                    </svg>
                  }
                />
              </div>
            ) : (
              <NumericInput
                value={layout.gap}
                onChange={(v) => change({ gap: v })}
                prefix={<GapIcon />}
              />
            )}
            {/* Extra space for alignment with grid height */}
            <div style={{ height: layout.direction === 'wrap' ? 0 : 30 }} />
          </div>

          {/* Tune icon */}
          <div className="flex flex-col items-center pt-5">
            <IconBtn onClick={() => {}} title="Advanced settings">
              <TuneIcon />
            </IconBtn>
          </div>
        </div>

        {/* ── Padding ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Padding</span>
          <div className="flex items-center gap-1.5">
            {isUniformPad ? (
              <>
                <NumericInput
                  value={padH}
                  onChange={(v) => { pushHistory('Change padding'); setUniformPadding(node.id, v); }}
                  prefix={<PadHorizIcon />}
                />
                <NumericInput
                  value={padV}
                  onChange={(v) => { pushHistory('Change padding'); setUniformPadding(node.id, v); }}
                  prefix={<PadVertIcon />}
                />
              </>
            ) : (
              <>
                {/* 4 individual inputs */}
                <div className="flex-1 grid grid-cols-2 gap-1">
                  <NumericInput
                    value={pad.top}
                    onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'top', v); }}
                    prefix={<span className="text-[9px]">T</span>}
                  />
                  <NumericInput
                    value={pad.right}
                    onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'right', v); }}
                    prefix={<span className="text-[9px]">R</span>}
                  />
                  <NumericInput
                    value={pad.bottom}
                    onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'bottom', v); }}
                    prefix={<span className="text-[9px]">B</span>}
                  />
                  <NumericInput
                    value={pad.left}
                    onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'left', v); }}
                    prefix={<span className="text-[9px]">L</span>}
                  />
                </div>
              </>
            )}
            <IconBtn
              onClick={() => change({ independentPadding: !layout.independentPadding })}
              title={isUniformPad ? 'Individual padding' : 'Uniform padding'}
              active={layout.independentPadding}
            >
              {isUniformPad ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </IconBtn>
          </div>
        </div>

        {/* ── Clip content (legacy toggle, kept for backward compat) ── */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div
            className="relative flex h-[18px] w-[30px] rounded-full cursor-pointer transition-colors duration-200"
            style={{
              background: layout.clipContent ? 'var(--penma-primary)' : 'var(--penma-border)',
            }}
          >
            <div
              className="absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all duration-200"
              style={{
                background: '#fff',
                left: layout.clipContent ? 14 : 2,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            />
          </div>
          <input
            type="checkbox"
            checked={layout.clipContent}
            onChange={(e) => change({ clipContent: e.target.checked, overflow: e.target.checked ? 'hidden' : 'visible' })}
            className="sr-only"
          />
          <span className="text-[12px]" style={{ color: 'var(--penma-text-secondary)' }}>
            Clip content
          </span>
        </label>
      </div>
    </div>
  );
};
