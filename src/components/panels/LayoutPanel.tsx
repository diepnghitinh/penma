'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { PenmaNode, LayoutDirection, PrimaryAxisAlign, CounterAxisAlign } from '@/types/document';
import { VIEWPORT_PRESET_GROUPS, VIEWPORT_PRESETS } from '@/types/editor';

// ─── Icons ──────────────────────────────────────────────────

const FlowHorizIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="5" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <line x1="7.5" y1="8" x2="11" y2="8" />
    <polyline points="9.5,6.5 11,8 9.5,9.5" />
  </svg>
);

const FlowVertIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="8" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <line x1="8" y1="7.5" x2="8" y2="11" />
    <polyline points="6.5,9.5 8,11 9.5,9.5" />
  </svg>
);

const FlowWrapIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="3" y="4" width="3" height="3" rx="0.8" fill="currentColor" />
    <rect x="7" y="4" width="3" height="3" rx="0.8" fill="currentColor" />
    <rect x="11" y="4" width="3" height="3" rx="0.8" fill="currentColor" opacity="0.4" />
    <rect x="3" y="9" width="3" height="3" rx="0.8" fill="currentColor" opacity="0.4" />
  </svg>
);

const FlowScrollIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="5.5,5 8,3 10.5,5" />
    <line x1="8" y1="3.5" x2="8" y2="9" />
    <polyline points="5.5,11 8,13 10.5,11" />
  </svg>
);

const ReverseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5H6.5a2.5 2.5 0 000 5H8" />
    <polyline points="10,3 12,5 10,7" />
  </svg>
);

/** Auto layout toggle icon (shown in header) */
const AutoLayoutIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <rect x="2" y="4" width="5" height="8" rx="1" />
    <rect x="9" y="4" width="5" height="8" rx="1" />
    <line x1="4.5" y1="7" x2="4.5" y2="9" />
    <line x1="11.5" y1="7" x2="11.5" y2="9" />
  </svg>
);

const GapIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <path d="M4 3.5C3 3.5 2.5 4.5 2.5 5v4c0 .5.5 1.5 1.5 1.5" />
    <path d="M10 3.5c1 0 1.5 1 1.5 1.5v4c0 .5-.5 1.5-1.5 1.5" />
    <line x1="7" y1="4" x2="7" y2="10" />
  </svg>
);

const PadHorizIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="2" y1="3" x2="2" y2="11" />
    <line x1="12" y1="3" x2="12" y2="11" />
    <line x1="4" y1="7" x2="10" y2="7" />
  </svg>
);

const PadVertIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="3" y1="2" x2="11" y2="2" />
    <line x1="3" y1="12" x2="11" y2="12" />
    <line x1="7" y1="4" x2="7" y2="10" />
  </svg>
);

const ConstrainIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        <path d="M5 3.5H3.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 3.5H12.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 12.5H3.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 12.5H12.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="3.5" y1="5" x2="3.5" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="12.5" y1="5" x2="12.5" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5" y1="3.5" x2="11" y2="3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5" y1="12.5" x2="11" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M5 3.5H3.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 3.5H12.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 12.5H3.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 12.5H12.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </svg>
);

// ─── Shared styles ──────────────────────────────────────────

const mutedStyle: React.CSSProperties = { color: 'var(--penma-text-muted)' };

const inputBgStyle: React.CSSProperties = {
  background: 'var(--penma-hover-bg)',
  color: 'var(--penma-text)',
  border: 'none',
  borderRadius: 6,
};

// ─── Small reusable components ──────────────────────────────

const NumericInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  prefix?: React.ReactNode;
  className?: string;
}> = ({ value, onChange, prefix, className = '' }) => (
  <div
    className={`flex items-center h-[30px] rounded-md px-2 gap-1.5 flex-1 ${className}`}
    style={inputBgStyle}
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

const FlowBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex h-[30px] flex-1 items-center justify-center cursor-pointer
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

const IconBtn: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, active, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex h-[28px] w-[28px] items-center justify-center rounded-md cursor-pointer
               transition-all duration-150 ease-out shrink-0"
    style={{
      color: active ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
      background: active ? 'var(--penma-primary-light)' : 'transparent',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--penma-hover-bg)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'var(--penma-primary-light)' : 'transparent'; }}
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

  return (
    <div
      className="grid grid-cols-3 rounded-lg p-[3px]"
      style={{ background: 'var(--penma-hover-bg)', gap: 2 }}
    >
      {counterOpts.map((ca) =>
        primaryOpts.map((pa) => {
          const isActive = !isSpaceBetween && primary === pa && counter === ca;
          const bars = isActive
            ? (isHoriz
              ? [{ w: 2, h: 8 }, { w: 2, h: 5 }, { w: 2, h: 7 }]
              : [{ w: 8, h: 2 }, { w: 5, h: 2 }, { w: 7, h: 2 }])
            : null;
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
                    <div key={i} className="rounded-sm" style={{ width: b.w, height: b.h, background: 'var(--penma-primary)' }} />
                  ))}
                </div>
              ) : (
                <div className="rounded-full" style={{ width: 4, height: 4, background: 'var(--penma-border-strong)' }} />
              )}
            </button>
          );
        })
      )}
    </div>
  );
};

// ─── Dimension cell: [W 1616 ▾] ─────────────────────────────

type SizingModeValue = 'fixed' | 'hug' | 'fill';

const DimCell: React.FC<{
  label: string;
  value: number;
  mode: SizingModeValue;
  onChange: (v: string) => void;
  onModeChange: (m: SizingModeValue) => void;
  fillDisabled?: boolean;
}> = ({ label, value, mode, onChange, onModeChange, fillDisabled }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const display = value % 1 === 0 ? String(value) : value.toFixed(2);

  const commit = () => {
    const v = editValue.trim();
    if (v && v !== display) onChange(v);
    setEditing(false);
  };

  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);
  useEffect(() => {
    if (!dropdownOpen) return;
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropdownOpen]);

  const options: { value: SizingModeValue; label: string }[] = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'hug', label: 'Hug' },
    { value: 'fill', label: 'Fill' },
  ];

  return (
    <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2 gap-1" style={inputBgStyle}>
      <span className="text-[11px] font-medium shrink-0 select-none" style={mutedStyle}>{label}</span>
      {editing ? (
        <input
          ref={inputRef} autoFocus value={editValue}
          onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'ArrowUp') { e.preventDefault(); setEditValue(String(Math.round((parseFloat(editValue) || 0) + (e.shiftKey ? 10 : 1)))); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setEditValue(String(Math.max(0, Math.round((parseFloat(editValue) || 0) - (e.shiftKey ? 10 : 1))))); }
          }}
          className="w-10 min-w-0 text-[11px] outline-none bg-transparent
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={{ color: 'var(--penma-text)' }}
        />
      ) : (
        <button
          onClick={() => { if (mode === 'fixed') { setEditing(true); setEditValue(display); } }}
          className="text-[11px] cursor-text hover:underline truncate"
          style={{ color: mode === 'fixed' ? 'var(--penma-text)' : 'var(--penma-text-muted)' }}
        >
          {mode === 'fixed' ? display : mode === 'hug' ? 'Auto' : 'Fill'}
        </button>
      )}
      {/* Mode dropdown */}
      <div ref={dropdownRef} className="relative ml-auto shrink-0">
        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center cursor-pointer">
          <svg width="8" height="5" viewBox="0 0 8 5" style={{ color: 'var(--penma-text-muted)', opacity: 0.6 }}>
            <path d="M0.5 0.5L4 4L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {dropdownOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[110px] rounded-lg py-1"
            style={{ background: 'var(--penma-surface)', border: '1px solid var(--penma-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          >
            {options.map((opt) => {
              const disabled = opt.value === 'fill' && fillDisabled;
              const isActive = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { if (!disabled) { onModeChange(opt.value); setDropdownOpen(false); } }}
                  disabled={disabled}
                  className={`flex w-full items-center px-2.5 py-[5px] text-[11px] cursor-pointer transition-colors duration-150
                    ${disabled ? 'cursor-not-allowed opacity-35' : 'hover:bg-[var(--penma-hover-bg)]'}`}
                  style={{
                    color: isActive ? 'var(--penma-primary)' : 'var(--penma-text)',
                    background: isActive ? 'var(--penma-primary-light)' : undefined,
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {opt.label}
                  {isActive && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-auto" stroke="var(--penma-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1.5,5.5 4,8 8.5,2.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Layout Panel ──────────────────────────────────────

export const LayoutPanel: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const toggleAutoLayout = useEditorStore((s) => s.toggleAutoLayout);
  const updateAutoLayout = useEditorStore((s) => s.updateAutoLayout);
  const updateAutoLayoutPadding = useEditorStore((s) => s.updateAutoLayoutPadding);
  const setUniformPadding = useEditorStore((s) => s.setUniformPadding);
  const updateSizing = useEditorStore((s) => s.updateSizing);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const updateNodeBounds = useEditorStore((s) => s.updateNodeBounds);
  const updateDocumentViewport = useEditorStore((s) => s.updateDocumentViewport);
  const documents = useEditorStore((s) => s.documents);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const [constrainProportions, setConstrainProportions] = useState(false);

  const layout = node.autoLayout;
  const hasAutoLayout = !!layout;
  const sizing = node.sizing;
  const hasChildren = node.children.length > 0;
  const parentDoc = documents.find((d) => d.rootNode.id === node.id);

  // Find parent node to determine fill eligibility
  const parentNode = (() => {
    for (const doc of documents) {
      const found = findParentNode(doc.rootNode, node.id);
      if (found) return found;
    }
    return null;
  })();
  const fillDisabled = !parentNode && !parentDoc;

  const hMode: SizingModeValue = sizing?.horizontal ?? 'fixed';
  const vMode: SizingModeValue = sizing?.vertical ?? 'fixed';

  // Dimensions
  const w = parentDoc
    ? parentDoc.viewport.width
    : Math.round(parseFloat(node.styles.overrides['width'] || node.styles.computed['width'] || '') || node.bounds.width);
  const h = parentDoc
    ? parentDoc.viewport.height
    : Math.round(parseFloat(node.styles.overrides['height'] || node.styles.computed['height'] || '') || node.bounds.height);

  const handleDimensionChange = useCallback(
    (prop: 'width' | 'height', value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return;
      pushHistory(`Resize ${prop}`);

      if (constrainProportions && w > 0 && h > 0) {
        const ratio = w / h;
        const otherNum = prop === 'width' ? Math.round(num / ratio) : Math.round(num * ratio);
        if (parentDoc) {
          updateDocumentViewport(parentDoc.id, {
            width: prop === 'width' ? num : otherNum,
            height: prop === 'height' ? num : otherNum,
          });
          updateNodeStyles(node.id, {
            width: `${prop === 'width' ? num : otherNum}px`,
            height: `${prop === 'height' ? num : otherNum}px`,
          });
        } else {
          const otherProp = prop === 'width' ? 'height' : 'width';
          updateNodeStyles(node.id, { [prop]: `${num}px`, [otherProp]: `${otherNum}px` });
          updateNodeBounds(node.id, { [prop]: num, [otherProp]: otherNum });
        }
      } else {
        if (parentDoc) {
          updateDocumentViewport(parentDoc.id, {
            width: prop === 'width' ? num : parentDoc.viewport.width,
            height: prop === 'height' ? num : parentDoc.viewport.height,
          });
          updateNodeStyles(node.id, { [prop]: `${num}px` });
        } else {
          updateNodeStyles(node.id, { [prop]: `${num}px` });
          updateNodeBounds(node.id, { [prop]: num });
        }
      }
    },
    [node.id, w, h, constrainProportions, updateNodeStyles, updateNodeBounds, updateDocumentViewport, parentDoc, pushHistory]
  );

  const handleSizingChange = useCallback(
    (axis: 'horizontal' | 'vertical', mode: SizingModeValue) => {
      pushHistory('Change resizing');
      updateSizing(node.id, axis, mode);
    },
    [node.id, updateSizing, pushHistory]
  );

  const changeLayout = useCallback(
    (patch: Partial<NonNullable<typeof layout>>) => {
      pushHistory('Update layout');
      updateAutoLayout(node.id, patch);
    },
    [node.id, updateAutoLayout, pushHistory]
  );

  const pad = layout?.padding;
  const isUniformPad = layout ? !layout.independentPadding : true;

  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* ── Header: "Layout" with auto layout toggle in top-right ── */}
      <div className="flex h-9 items-center justify-between px-4">
        <span className="text-[12px] font-semibold" style={{ color: 'var(--penma-text)' }}>
          {hasAutoLayout ? 'Auto layout' : 'Layout'}
        </span>
        <div className="flex items-center gap-1">
          <IconBtn
            onClick={() => {
              if (!hasChildren && !hasAutoLayout) return;
              pushHistory(hasAutoLayout ? 'Remove auto layout' : 'Add auto layout');
              toggleAutoLayout(node.id);
            }}
            title="Toggle auto layout"
            active={hasAutoLayout}
          >
            <AutoLayoutIcon />
          </IconBtn>
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-3">
        {/* ── Flow (auto layout only) ── */}
        {hasAutoLayout && layout && (
          <div>
            <span className="block text-[11px] mb-1.5" style={mutedStyle}>Flow</span>
            <div className="flex items-center gap-1.5">
              <div
                className="flex flex-1 rounded-lg p-[2px]"
                style={{ background: 'var(--penma-hover-bg)' }}
              >
                <FlowBtn active={layout.direction === 'horizontal'} onClick={() => changeLayout({ direction: 'horizontal' })} title="Horizontal">
                  <FlowHorizIcon />
                </FlowBtn>
                <FlowBtn active={layout.direction === 'vertical'} onClick={() => changeLayout({ direction: 'vertical' })} title="Vertical">
                  <FlowVertIcon />
                </FlowBtn>
                <FlowBtn
                  active={layout.overflow === 'scroll'}
                  onClick={() => changeLayout({ overflow: layout.overflow === 'scroll' ? 'hidden' : 'scroll', clipContent: true })}
                  title="Scroll"
                >
                  <FlowScrollIcon />
                </FlowBtn>
                <FlowBtn active={layout.direction === 'wrap'} onClick={() => changeLayout({ direction: 'wrap' })} title="Wrap">
                  <FlowWrapIcon />
                </FlowBtn>
              </div>
              <IconBtn
                onClick={() => changeLayout({ reverse: !layout.reverse })}
                title="Reverse order"
                active={layout.reverse}
              >
                <ReverseIcon />
              </IconBtn>
            </div>
          </div>
        )}

        {/* ── Dimensions ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Dimensions</span>

          {/* Viewport presets — shown for frames and document roots */}
          {(hasAutoLayout || parentDoc) && (
            <ViewportPresetSelect w={w} h={h} onChange={(pw, ph) => {
              handleDimensionChange('width', String(pw));
              // Need separate call for height since handleDimensionChange only changes one axis
              // unless constrainProportions is on
              if (!constrainProportions) {
                pushHistory(`Resize height`);
                if (parentDoc) {
                  updateDocumentViewport(parentDoc.id, { width: pw, height: ph });
                  updateNodeStyles(node.id, { width: `${pw}px`, height: `${ph}px` });
                } else {
                  updateNodeStyles(node.id, { width: `${pw}px`, height: `${ph}px` });
                  updateNodeBounds(node.id, { width: pw, height: ph });
                }
              }
            }} />
          )}

          <div className="flex items-center gap-1.5">
            <DimCell
              label="W"
              value={w}
              mode={hMode}
              onChange={(v) => handleDimensionChange('width', v)}
              onModeChange={(m) => handleSizingChange('horizontal', m)}
              fillDisabled={fillDisabled}
            />
            <DimCell
              label="H"
              value={h}
              mode={vMode}
              onChange={(v) => handleDimensionChange('height', v)}
              onModeChange={(m) => handleSizingChange('vertical', m)}
              fillDisabled={fillDisabled}
            />
            <IconBtn
              onClick={() => setConstrainProportions(!constrainProportions)}
              title={constrainProportions ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              active={constrainProportions}
            >
              <ConstrainIcon active={constrainProportions} />
            </IconBtn>
          </div>
        </div>

        {/* ── Alignment + Gap (auto layout only) ── */}
        {hasAutoLayout && layout && (
          <>
            <div className="flex gap-3">
              <div className="shrink-0">
                <span className="block text-[11px] mb-1.5" style={mutedStyle}>Alignment</span>
                <AlignmentGrid
                  direction={layout.direction}
                  primary={layout.primaryAxisAlign}
                  counter={layout.counterAxisAlign}
                  onChangePrimary={(v) => changeLayout({ primaryAxisAlign: v })}
                  onChangeCounter={(v) => changeLayout({ counterAxisAlign: v })}
                />
                <button
                  onClick={() => changeLayout({ primaryAxisAlign: layout.primaryAxisAlign === 'space-between' ? 'start' : 'space-between' })}
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

              <div className="flex-1">
                <span className="block text-[11px] mb-1.5" style={mutedStyle}>Gap</span>
                {layout.direction === 'wrap' ? (
                  <div className="flex flex-col gap-1.5">
                    <NumericInput value={layout.gap} onChange={(v) => changeLayout({ gap: v })} prefix={<GapIcon />} />
                    <NumericInput
                      value={layout.counterAxisGap ?? layout.gap}
                      onChange={(v) => changeLayout({ counterAxisGap: v })}
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
                  <NumericInput value={layout.gap} onChange={(v) => changeLayout({ gap: v })} prefix={<GapIcon />} />
                )}
                <div style={{ height: layout.direction === 'wrap' ? 0 : 30 }} />
              </div>
            </div>

            {/* ── Padding ── */}
            <div>
              <span className="block text-[11px] mb-1.5" style={mutedStyle}>Padding</span>
              <div className="flex items-center gap-1.5">
                {isUniformPad && pad ? (
                  <>
                    <NumericInput
                      value={pad.left}
                      onChange={(v) => { pushHistory('Change padding'); setUniformPadding(node.id, v); }}
                      prefix={<PadHorizIcon />}
                    />
                    <NumericInput
                      value={pad.top}
                      onChange={(v) => { pushHistory('Change padding'); setUniformPadding(node.id, v); }}
                      prefix={<PadVertIcon />}
                    />
                  </>
                ) : pad ? (
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    <NumericInput value={pad.top} onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'top', v); }} prefix={<span className="text-[9px]">T</span>} />
                    <NumericInput value={pad.right} onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'right', v); }} prefix={<span className="text-[9px]">R</span>} />
                    <NumericInput value={pad.bottom} onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'bottom', v); }} prefix={<span className="text-[9px]">B</span>} />
                    <NumericInput value={pad.left} onChange={(v) => { pushHistory('Change padding'); updateAutoLayoutPadding(node.id, 'left', v); }} prefix={<span className="text-[9px]">L</span>} />
                  </div>
                ) : null}
                {layout && (
                  <IconBtn
                    onClick={() => changeLayout({ independentPadding: !layout.independentPadding })}
                    title={isUniformPad ? 'Individual padding' : 'Uniform padding'}
                    active={layout.independentPadding}
                  >
                    {isUniformPad ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                  </IconBtn>
                )}
              </div>
            </div>

            {/* ── Clip content ── */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                className="relative flex h-[18px] w-[30px] rounded-full cursor-pointer transition-colors duration-200"
                style={{ background: layout.clipContent ? 'var(--penma-primary)' : 'var(--penma-border)' }}
              >
                <div
                  className="absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all duration-200"
                  style={{ background: '#fff', left: layout.clipContent ? 14 : 2, boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                />
              </div>
              <input
                type="checkbox"
                checked={layout.clipContent}
                onChange={(e) => changeLayout({ clipContent: e.target.checked, overflow: e.target.checked ? 'hidden' : 'visible' })}
                className="sr-only"
              />
              <span className="text-[12px]" style={{ color: 'var(--penma-text-secondary)' }}>Clip content</span>
            </label>
          </>
        )}
      </div>
    </div>
  );
};

// ── Viewport preset select ──────────────────────────────────

const ViewportPresetSelect: React.FC<{
  w: number;
  h: number;
  onChange: (w: number, h: number) => void;
}> = ({ w, h, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const matched = VIEWPORT_PRESETS.find((p) => p.width === w && p.height === h);

  return (
    <div className="relative mb-1.5">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full h-[26px] items-center justify-between rounded-md px-2 text-[11px] cursor-pointer"
        style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-text)', border: 'none' }}
      >
        <span>{matched?.name ?? 'Custom'}</span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--penma-text-muted)' }}>
          <path d="M0.5 0.5L4 4L7.5 0.5" />
        </svg>
      </button>
      {open && (
        <div
          ref={ref}
          className="absolute left-0 right-0 top-full mt-1 rounded-lg shadow-lg border overflow-y-auto"
          style={{ background: 'var(--penma-surface)', borderColor: 'var(--penma-border)', zIndex: 50, maxHeight: 360 }}
        >
          {VIEWPORT_PRESET_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div style={{ borderTop: '1px solid var(--penma-border)' }} />}
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)' }}>
                  {group.label}
                </span>
              </div>
              {group.presets.map((preset) => {
                const isActive = matched?.name === preset.name && w === preset.width && h === preset.height;
                return (
                  <button
                    key={`${preset.name}-${preset.width}`}
                    onClick={() => { onChange(preset.width, preset.height); setOpen(false); }}
                    className="flex w-full items-center px-3 py-1 text-[11px] cursor-pointer text-left"
                    style={{ color: isActive ? 'var(--penma-primary)' : 'var(--penma-text)', fontWeight: isActive ? 600 : 400, transition: 'background 80ms' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="flex-1 truncate">{preset.name}</span>
                    <span className="ml-2 font-mono text-[9px] shrink-0" style={{ color: 'var(--penma-text-muted)' }}>
                      {preset.width}×{preset.height}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Helper ──────────────────────────────────────────────────

function findParentNode(root: PenmaNode, targetId: string): PenmaNode | null {
  for (const child of root.children) {
    if (child.id === targetId) return root;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}
