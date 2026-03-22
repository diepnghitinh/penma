'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { PenmaNode } from '@/types/document';

// ── Resizing icons (Figma-accurate, pixel-hinted) ──────────

const AutoWidthIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="1.5" y1="3.5" x2="1.5" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="2" y1="8" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <polyline points="5,6.2 6.8,8 5,9.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AutoHeightIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="3.5" y1="1.5" x2="12.5" y2="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="8" y1="2" x2="8" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <polyline points="6.2,5 8,6.8 9.8,5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FixedSizeIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="4.5" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <line x1="6" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    <line x1="6" y1="9" x2="9" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const ConstrainIcon: React.FC<{ active?: boolean; size?: number }> = ({ active, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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

// ── Sizing mode icons (for dropdown items) ──────────────────

const FixedModeIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
    <line x1="1.5" y1="2" x2="1.5" y2="10" />
    <line x1="10.5" y1="2" x2="10.5" y2="10" />
    <line x1="3" y1="6" x2="9" y2="6" />
  </svg>
);

const HugModeIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3.5,4 1.5,6 3.5,8" />
    <polyline points="8.5,4 10.5,6 8.5,8" />
    <rect x="4.5" y="4" width="3" height="4" rx="0.5" strokeWidth="1" />
  </svg>
);

const FillModeIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="3.5" width="9" height="5" rx="0.75" />
    <polyline points="3.5,6 1.5,6" />
    <polyline points="8.5,6 10.5,6" />
  </svg>
);

// ── Sizing mode types & options ──────────────────────────────

type SizingModeValue = 'fixed' | 'hug' | 'fill';

const SIZING_OPTIONS: { value: SizingModeValue; wLabel: string; hLabel: string; shortLabel: string; Icon: React.FC }[] = [
  { value: 'fixed', wLabel: 'Fixed width', hLabel: 'Fixed height', shortLabel: 'Fixed', Icon: FixedModeIcon },
  { value: 'hug', wLabel: 'Hug content', hLabel: 'Hug content', shortLabel: 'Hug', Icon: HugModeIcon },
  { value: 'fill', wLabel: 'Fill container', hLabel: 'Fill container', shortLabel: 'Fill', Icon: FillModeIcon },
];

// ── Dimension row: value input + mode selector ──────────────

const DimensionRow: React.FC<{
  label: string;
  value: number;
  mode: SizingModeValue;
  onValueChange: (value: string) => void;
  onModeChange: (mode: SizingModeValue) => void;
  fillDisabled?: boolean;
}> = ({ label, value, mode, onValueChange, onModeChange, fillDisabled }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const axis = label as 'W' | 'H';
  const isValueEditable = mode === 'fixed';
  const displayValue = value % 1 === 0 ? String(value) : value.toFixed(2);
  const currentOption = SIZING_OPTIONS.find((o) => o.value === mode)!;
  const modeLabel = axis === 'W' ? currentOption.wLabel : currentOption.hLabel;

  const commit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== String(value)) {
      onValueChange(trimmed);
    }
    setEditing(false);
  };

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <div className="flex items-center gap-1.5">
      {/* Label */}
      <span
        className="shrink-0 w-[14px] text-[11px] font-medium select-none"
        style={{ color: 'var(--penma-text-muted)' }}
      >
        {label}
      </span>

      {/* Value input */}
      <div
        className="flex min-w-0 h-[28px] rounded overflow-hidden transition-colors duration-150"
        style={{
          width: isValueEditable ? 64 : 52,
          border: editing
            ? '1.5px solid var(--penma-primary)'
            : '1px solid var(--penma-border)',
          background: isValueEditable ? 'var(--penma-surface)' : 'var(--penma-hover-bg)',
        }}
      >
        {isValueEditable ? (
          editing ? (
            <input
              ref={inputRef}
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value.replace(/[^0-9.\-]/g, ''))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.shiftKey ? 10 : 1;
                  setEditValue(String(Math.round((parseFloat(editValue) || 0) + step)));
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const step = e.shiftKey ? 10 : 1;
                  setEditValue(String(Math.max(0, Math.round((parseFloat(editValue) || 0) - step))));
                }
              }}
              className="w-full px-1.5 text-[11px] outline-none bg-transparent
                         [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ color: 'var(--penma-text)' }}
            />
          ) : (
            <button
              onClick={() => { setEditing(true); setEditValue(displayValue); }}
              className="w-full px-1.5 text-[11px] text-left truncate cursor-text
                         hover:bg-[var(--penma-hover-bg)] transition-colors duration-150"
              style={{ color: 'var(--penma-text)' }}
            >
              {displayValue}
            </button>
          )
        ) : (
          <div
            className="w-full px-1.5 flex items-center text-[11px] truncate"
            style={{ color: 'var(--penma-text-muted)' }}
          >
            {mode === 'hug' ? 'Auto' : 'Fill'}
          </div>
        )}
      </div>

      {/* Mode dropdown trigger — shows current mode */}
      <div ref={dropdownRef} className="relative flex-1 min-w-0">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex w-full h-[28px] items-center gap-1 px-1.5 rounded cursor-pointer
                     transition-colors duration-150 hover:bg-[var(--penma-hover-bg)]"
          style={{ color: 'var(--penma-text-secondary)' }}
          aria-label={modeLabel}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
        >
          <span style={{ color: 'var(--penma-text-muted)' }}>
            <currentOption.Icon />
          </span>
          <span className="text-[10px] truncate" style={{ color: 'var(--penma-text-muted)' }}>
            {currentOption.shortLabel}
          </span>
          <svg
            width="8" height="5" viewBox="0 0 8 5" className="ml-auto shrink-0"
            style={{ color: 'var(--penma-text-muted)', opacity: 0.6 }}
          >
            <path d="M0.5 0.5L4 4L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {dropdownOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 min-w-[148px] rounded-lg py-1"
            style={{
              background: 'var(--penma-surface)',
              border: '1px solid var(--penma-border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
            }}
            role="listbox"
            aria-label={`${label} sizing mode`}
          >
            {SIZING_OPTIONS.map((opt) => {
              const disabled = opt.value === 'fill' && fillDisabled;
              const isActive = mode === opt.value;
              const optLabel = axis === 'W' ? opt.wLabel : opt.hLabel;
              return (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    if (!disabled) {
                      onModeChange(opt.value);
                      setDropdownOpen(false);
                    }
                  }}
                  disabled={disabled}
                  className={`flex w-full items-center gap-2 px-2.5 py-[6px] text-[11px] text-left cursor-pointer
                    transition-colors duration-150
                    ${isActive ? 'font-medium' : ''}
                    ${disabled ? 'cursor-not-allowed opacity-35' : 'hover:bg-[var(--penma-hover-bg)]'}`}
                  style={{
                    color: isActive ? 'var(--penma-primary)' : 'var(--penma-text)',
                    background: isActive ? 'var(--penma-primary-light)' : undefined,
                  }}
                >
                  <span style={{ color: isActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)' }}>
                    <opt.Icon />
                  </span>
                  {optLabel}
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

// ── Resizing preset logic ───────────────────────────────────

type ResizingPreset = 'auto-width' | 'auto-height' | 'fixed';

function getResizingPreset(hMode: SizingModeValue, vMode: SizingModeValue): ResizingPreset {
  if (hMode === 'fixed' && vMode === 'fixed') return 'fixed';
  if (hMode !== 'fixed') return 'auto-width';
  return 'auto-height';
}

// ── Main Layout Panel ──────────────────────────────────────

export const LayoutPanel: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const updateNodeBounds = useEditorStore((s) => s.updateNodeBounds);
  const updateDocumentViewport = useEditorStore((s) => s.updateDocumentViewport);
  const updateSizing = useEditorStore((s) => s.updateSizing);
  const documents = useEditorStore((s) => s.documents);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [constrainProportions, setConstrainProportions] = useState(false);

  const parentDoc = documents.find((d) => d.rootNode.id === node.id);
  const sizing = node.sizing;
  const hMode: SizingModeValue = sizing?.horizontal ?? 'fixed';
  const vMode: SizingModeValue = sizing?.vertical ?? 'fixed';

  // Find parent node to determine context
  const parentNode = (() => {
    for (const doc of documents) {
      const found = findParentNode(doc.rootNode, node.id);
      if (found) return found;
    }
    return null;
  })();
  const parentHasAutoLayout = !!parentNode?.autoLayout;
  const fillDisabled = !parentHasAutoLayout && !parentDoc;

  const resizingPreset = getResizingPreset(hMode, vMode);

  // Dimensions
  const w = parentDoc
    ? parentDoc.viewport.width
    : Math.round(parseFloat(node.styles.overrides['width'] || '') || node.bounds.width);
  const h = parentDoc
    ? parentDoc.viewport.height
    : Math.round(parseFloat(node.styles.overrides['height'] || '') || node.bounds.height);

  const handleDimensionChange = useCallback(
    (prop: 'width' | 'height', value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return;
      pushHistory(`Resize ${prop}`);

      if (constrainProportions && w > 0 && h > 0) {
        const ratio = w / h;
        const otherProp = prop === 'width' ? 'height' : 'width';
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
          updateNodeStyles(node.id, { [prop]: `${num}px`, [otherProp]: `${otherNum}px` });
          updateNodeBounds(node.id, { [prop]: num, [otherProp]: otherNum });
        }
      } else {
        if (parentDoc) {
          const newViewport = {
            width: prop === 'width' ? num : parentDoc.viewport.width,
            height: prop === 'height' ? num : parentDoc.viewport.height,
          };
          updateDocumentViewport(parentDoc.id, newViewport);
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

  const handleResizingPreset = useCallback(
    (preset: ResizingPreset) => {
      pushHistory('Change resizing');
      switch (preset) {
        case 'auto-width':
          updateSizing(node.id, 'horizontal', 'hug');
          break;
        case 'auto-height':
          updateSizing(node.id, 'vertical', 'hug');
          updateSizing(node.id, 'horizontal', 'fixed');
          break;
        case 'fixed':
          updateSizing(node.id, 'horizontal', 'fixed');
          updateSizing(node.id, 'vertical', 'fixed');
          break;
      }
    },
    [node.id, updateSizing, pushHistory]
  );

  const resizingPresets: { value: ResizingPreset; label: string; Icon: React.FC<{ size?: number }> }[] = [
    { value: 'auto-width', label: 'Auto width', Icon: AutoWidthIcon },
    { value: 'auto-height', label: 'Auto height', Icon: AutoHeightIcon },
    { value: 'fixed', label: 'Fixed size', Icon: FixedSizeIcon },
  ];

  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* Header */}
      <div className="flex h-8 items-center px-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--penma-text-secondary)', fontFamily: 'var(--font-heading)' }}
        >
          Layout
        </span>
      </div>

      <div className="px-3 pb-3 flex flex-col gap-2.5">
        {/* ── Resizing presets ── */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium" style={{ color: 'var(--penma-text-muted)' }}>
            Resizing
          </span>
          <div
            className="flex h-[30px] rounded-md p-[3px]"
            style={{ background: 'var(--penma-hover-bg)' }}
            role="radiogroup"
            aria-label="Resizing mode"
          >
            {resizingPresets.map(({ value, label, Icon }) => {
              const isActive = resizingPreset === value;
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => handleResizingPreset(value)}
                  title={label}
                  className={`flex flex-1 items-center justify-center rounded cursor-pointer
                    transition-all duration-150 ease-out
                    ${isActive
                      ? 'shadow-sm'
                      : 'hover:text-[var(--penma-text-secondary)]'
                    }`}
                  style={{
                    background: isActive ? 'var(--penma-surface)' : 'transparent',
                    color: isActive ? 'var(--penma-text)' : 'var(--penma-text-muted)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08), 0 0.5px 1px rgba(0,0,0,0.06)' : undefined,
                  }}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dimensions: W and H each on own row with mode selector ── */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: 'var(--penma-text-muted)' }}>
              Dimensions
            </span>
            <button
              onClick={() => setConstrainProportions(!constrainProportions)}
              title={constrainProportions ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              aria-pressed={constrainProportions}
              className="shrink-0 flex h-[20px] w-[20px] items-center justify-center rounded cursor-pointer
                         transition-all duration-150 ease-out"
              style={{
                background: constrainProportions ? 'var(--penma-primary-light)' : 'transparent',
                color: constrainProportions ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
              }}
            >
              <ConstrainIcon active={constrainProportions} size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <DimensionRow
              label="W"
              value={parseFloat(w.toFixed(2))}
              mode={hMode}
              onValueChange={(v) => handleDimensionChange('width', v)}
              onModeChange={(m) => handleSizingChange('horizontal', m)}
              fillDisabled={fillDisabled}
            />
            <DimensionRow
              label="H"
              value={parseFloat(h.toFixed(2))}
              mode={vMode}
              onValueChange={(v) => handleDimensionChange('height', v)}
              onModeChange={(m) => handleSizingChange('vertical', m)}
              fillDisabled={fillDisabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Helper: find parent of a node ──────────────────────────

function findParentNode(root: PenmaNode, targetId: string): PenmaNode | null {
  for (const child of root.children) {
    if (child.id === targetId) return root;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}
