'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { PenmaNode } from '@/types/document';

// ─── Icons ──────────────────────────────────────────────────

/** Absolute positioning icon (frame with crosshair) */
const AbsoluteIcon: React.FC<{ active?: boolean }> = ({ active }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={active ? 'var(--penma-primary)' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <line x1="8" y1="5" x2="8" y2="11" />
    <line x1="5" y1="8" x2="11" y2="8" />
  </svg>
);

// Alignment icons — horizontal
const AlignLeftIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="3" x2="3" y2="13" />
    <line x1="5" y1="8" x2="13" y2="8" />
  </svg>
);

const AlignCenterHIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="4" y1="8" x2="12" y2="8" />
  </svg>
);

const AlignRightIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="13" y1="3" x2="13" y2="13" />
    <line x1="3" y1="8" x2="11" y2="8" />
  </svg>
);

// Alignment icons — vertical
const AlignTopIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="3" x2="13" y2="3" />
    <line x1="8" y1="5" x2="8" y2="13" />
  </svg>
);

const AlignCenterVIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="8" x2="13" y2="8" />
    <line x1="8" y1="4" x2="8" y2="12" />
  </svg>
);

const AlignBottomIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="13" x2="13" y2="13" />
    <line x1="8" y1="3" x2="8" y2="11" />
  </svg>
);

// Constraints icon (frame with pin lines)
const ConstraintsIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="6" height="6" rx="1" />
    <line x1="8" y1="2" x2="8" y2="5" />
    <line x1="8" y1="11" x2="8" y2="14" />
    <line x1="2" y1="8" x2="5" y2="8" />
    <line x1="11" y1="8" x2="14" y2="8" />
  </svg>
);

// Rotation icon
const RotationIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 7a4 4 0 01-7.5 2" />
    <path d="M3 7a4 4 0 017.5-2" />
    <polyline points="11,3 11,5.5 8.5,5.5" />
  </svg>
);

// Flip horizontal
const FlipHIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3v10" strokeDasharray="1.5 1.5" />
    <polygon points="3,5 3,11 6,8" fill="currentColor" stroke="none" opacity="0.6" />
    <polygon points="13,5 13,11 10,8" fill="none" />
  </svg>
);

// Flip vertical
const FlipVIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8h10" strokeDasharray="1.5 1.5" />
    <polygon points="5,3 11,3 8,6" fill="currentColor" stroke="none" opacity="0.6" />
    <polygon points="5,13 11,13 8,10" fill="none" />
  </svg>
);

// Distribute spacing icon
const DistributeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="2" y1="3" x2="2" y2="13" />
    <line x1="14" y1="3" x2="14" y2="13" />
    <rect x="6" y="5" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
  </svg>
);

// ─── Shared styles ──────────────────────────────────────────

const mutedStyle: React.CSSProperties = { color: 'var(--penma-text-muted)' };

const inputBgStyle: React.CSSProperties = {
  background: 'var(--penma-hover-bg)',
  border: 'none',
  borderRadius: 6,
};

// ─── Editable numeric input ─────────────────────────────────

const PosInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const display = Math.round(value);

  const commit = () => {
    const n = parseFloat(editVal);
    if (!isNaN(n)) onChange(Math.round(n));
    setEditing(false);
  };

  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);

  return (
    <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2 gap-1.5" style={inputBgStyle}>
      <span className="text-[11px] font-medium shrink-0 select-none" style={mutedStyle}>{label}</span>
      {editing ? (
        <input
          ref={ref} autoFocus value={editVal}
          onChange={(e) => setEditVal(e.target.value.replace(/[^0-9.\-]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'ArrowUp') { e.preventDefault(); setEditVal(String(Math.round((parseFloat(editVal) || 0) + (e.shiftKey ? 10 : 1)))); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setEditVal(String(Math.round((parseFloat(editVal) || 0) - (e.shiftKey ? 10 : 1)))); }
          }}
          className="w-full min-w-0 text-[11px] outline-none bg-transparent
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={{ color: 'var(--penma-text)' }}
        />
      ) : (
        <button
          onClick={() => { setEditing(true); setEditVal(String(display)); }}
          className="text-[11px] cursor-text hover:underline"
          style={{ color: 'var(--penma-text)' }}
        >{display}</button>
      )}
    </div>
  );
};

// ─── Alignment button ───────────────────────────────────────

const AlignBtn: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="flex h-[30px] flex-1 items-center justify-center rounded-md cursor-pointer
               transition-all duration-150 ease-out hover:bg-[var(--penma-hover-bg)]"
    style={{ color: 'var(--penma-text-muted)' }}
  >
    {children}
  </button>
);

// ─── Constraint types ───────────────────────────────────────

type ConstraintH = 'left' | 'right' | 'left-right' | 'center' | 'scale';
type ConstraintV = 'top' | 'bottom' | 'top-bottom' | 'center' | 'scale';

const H_OPTIONS: { value: ConstraintH; label: string; icon: string }[] = [
  { value: 'left', label: 'Left', icon: '⊢' },
  { value: 'right', label: 'Right', icon: '⊣' },
  { value: 'left-right', label: 'Left and Right', icon: '⊢⊣' },
  { value: 'center', label: 'Center', icon: '⊹' },
  { value: 'scale', label: 'Scale', icon: '↔' },
];

const V_OPTIONS: { value: ConstraintV; label: string; icon: string }[] = [
  { value: 'top', label: 'Top', icon: '⊤' },
  { value: 'bottom', label: 'Bottom', icon: '⊥' },
  { value: 'top-bottom', label: 'Top and Bottom', icon: '⊤⊥' },
  { value: 'center', label: 'Center', icon: '⊹' },
  { value: 'scale', label: 'Scale', icon: '↕' },
];

// ─── Constraint visual preview ──────────────────────────────

const ConstraintPreview: React.FC<{ h: ConstraintH; v: ConstraintV }> = ({ h, v }) => {
  const pinColor = 'var(--penma-primary)';
  const lineColor = 'var(--penma-border-strong)';
  return (
    <div
      className="relative rounded-md flex items-center justify-center"
      style={{ width: 60, height: 60, background: 'var(--penma-hover-bg)', border: '1px solid var(--penma-border)' }}
    >
      {/* Inner box */}
      <div
        className="relative rounded-sm"
        style={{ width: 16, height: 16, border: `1.5px solid ${lineColor}` }}
      />
      {/* Left pin */}
      {(h === 'left' || h === 'left-right' || h === 'scale') && (
        <div className="absolute" style={{ left: 1, top: '50%', width: 18, height: 2, marginTop: -1, background: pinColor }} />
      )}
      {/* Right pin */}
      {(h === 'right' || h === 'left-right' || h === 'scale') && (
        <div className="absolute" style={{ right: 1, top: '50%', width: 18, height: 2, marginTop: -1, background: pinColor }} />
      )}
      {/* Horizontal center */}
      {h === 'center' && (
        <div className="absolute" style={{ left: '50%', top: '50%', width: 2, height: 10, marginLeft: -1, marginTop: -5, background: pinColor }} />
      )}
      {/* Top pin */}
      {(v === 'top' || v === 'top-bottom' || v === 'scale') && (
        <div className="absolute" style={{ top: 1, left: '50%', width: 2, height: 18, marginLeft: -1, background: pinColor }} />
      )}
      {/* Bottom pin */}
      {(v === 'bottom' || v === 'top-bottom' || v === 'scale') && (
        <div className="absolute" style={{ bottom: 1, left: '50%', width: 2, height: 18, marginLeft: -1, background: pinColor }} />
      )}
      {/* Vertical center */}
      {v === 'center' && (
        <div className="absolute" style={{ top: '50%', left: '50%', width: 10, height: 2, marginLeft: -5, marginTop: -1, background: pinColor }} />
      )}
    </div>
  );
};

// ─── Constraint dropdown ────────────────────────────────────

const ConstraintDropdown: React.FC<{
  icon: string;
  value: string;
  options: { value: string; label: string; icon: string }[];
  onChange: (v: string) => void;
}> = ({ icon, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full h-[30px] items-center gap-1.5 px-2 rounded-md cursor-pointer
                   transition-colors duration-150 hover:bg-[var(--penma-hover-bg)]"
        style={{ background: 'var(--penma-hover-bg)' }}
      >
        <span className="text-[11px] shrink-0" style={{ color: 'var(--penma-text-muted)' }}>{icon}</span>
        <span className="text-[11px] truncate" style={{ color: 'var(--penma-text)' }}>{current?.label}</span>
        <svg width="8" height="5" viewBox="0 0 8 5" className="ml-auto shrink-0" style={{ color: 'var(--penma-text-muted)', opacity: 0.6 }}>
          <path d="M0.5 0.5L4 4L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg py-1"
          style={{ background: 'var(--penma-surface)', border: '1px solid var(--penma-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
        >
          {options.map((opt) => {
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-2.5 py-[5px] text-[11px] cursor-pointer transition-colors duration-150
                  hover:bg-[var(--penma-hover-bg)]`}
                style={{
                  color: isActive ? 'var(--penma-primary)' : 'var(--penma-text)',
                  background: isActive ? 'var(--penma-primary-light)' : undefined,
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                <span style={{ color: isActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)' }}>{opt.icon}</span>
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
  );
};

// ─── Constraints section ────────────────────────────────────

const ConstraintsSection: React.FC<{
  horizontal: ConstraintH;
  vertical: ConstraintV;
  onChangeH: (v: ConstraintH) => void;
  onChangeV: (v: ConstraintV) => void;
}> = ({ horizontal, vertical, onChangeH, onChangeV }) => (
  <div>
    <span className="block text-[11px] mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>Constraints</span>
    <div className="flex items-start gap-2">
      <div className="flex flex-col gap-1.5 flex-1">
        <ConstraintDropdown icon="⊢" value={horizontal} options={H_OPTIONS} onChange={(v) => onChangeH(v as ConstraintH)} />
        <ConstraintDropdown icon="⊤" value={vertical} options={V_OPTIONS} onChange={(v) => onChangeV(v as ConstraintV)} />
      </div>
      <ConstraintPreview h={horizontal} v={vertical} />
    </div>
  </div>
);

// ─── Main Position Panel ────────────────────────────────────

export const PositionPanel: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeBounds = useEditorStore((s) => s.updateNodeBounds);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const documents = useEditorStore((s) => s.documents);

  const [showConstraints, setShowConstraints] = useState(false);

  const isAbsolute = node.styles.computed['position'] === 'absolute' || node.styles.computed['position'] === 'fixed'
    || node.styles.overrides['position'] === 'absolute' || node.styles.overrides['position'] === 'fixed';

  const x = Math.round(node.bounds.x);
  const y = Math.round(node.bounds.y);
  const rotation = parseFloat(node.styles.overrides['rotate'] || node.styles.computed['rotate'] || '0') || 0;

  // Derive constraints from CSS
  const constraintH: ConstraintH = (() => {
    const s = node.styles.overrides;
    const hasLeft = s['left'] !== undefined && s['left'] !== 'auto';
    const hasRight = s['right'] !== undefined && s['right'] !== 'auto';
    if (hasLeft && hasRight) return 'left-right';
    if (hasRight) return 'right';
    if (s['margin-left'] === 'auto' && s['margin-right'] === 'auto') return 'center';
    return 'left';
  })();

  const constraintV: ConstraintV = (() => {
    const s = node.styles.overrides;
    const hasTop = s['top'] !== undefined && s['top'] !== 'auto';
    const hasBottom = s['bottom'] !== undefined && s['bottom'] !== 'auto';
    if (hasTop && hasBottom) return 'top-bottom';
    if (hasBottom) return 'bottom';
    if (s['margin-top'] === 'auto' && s['margin-bottom'] === 'auto') return 'center';
    return 'top';
  })();

  const handleConstraintChange = useCallback((axis: 'horizontal' | 'vertical', value: string) => {
    if (axis === 'horizontal') {
      const updates: Record<string, string> = {};
      switch (value) {
        case 'left': updates['left'] = `${x}px`; updates['right'] = 'auto'; updates['margin-left'] = ''; updates['margin-right'] = ''; break;
        case 'right': updates['right'] = '0px'; updates['left'] = 'auto'; updates['margin-left'] = ''; updates['margin-right'] = ''; break;
        case 'left-right': updates['left'] = `${x}px`; updates['right'] = '0px'; updates['margin-left'] = ''; updates['margin-right'] = ''; break;
        case 'center': updates['left'] = '0'; updates['right'] = '0'; updates['margin-left'] = 'auto'; updates['margin-right'] = 'auto'; break;
      }
      updateNodeStyles(node.id, updates);
    } else {
      const updates: Record<string, string> = {};
      switch (value) {
        case 'top': updates['top'] = `${y}px`; updates['bottom'] = 'auto'; updates['margin-top'] = ''; updates['margin-bottom'] = ''; break;
        case 'bottom': updates['bottom'] = '0px'; updates['top'] = 'auto'; updates['margin-top'] = ''; updates['margin-bottom'] = ''; break;
        case 'top-bottom': updates['top'] = `${y}px`; updates['bottom'] = '0px'; updates['margin-top'] = ''; updates['margin-bottom'] = ''; break;
        case 'center': updates['top'] = '0'; updates['bottom'] = '0'; updates['margin-top'] = 'auto'; updates['margin-bottom'] = 'auto'; break;
      }
      updateNodeStyles(node.id, updates);
    }
  }, [node.id, x, y, updateNodeStyles]);

  const handlePositionChange = useCallback((axis: 'x' | 'y', value: number) => {
    pushHistory(`Move ${axis.toUpperCase()}`);
    updateNodeBounds(node.id, { [axis]: value });
    if (axis === 'x') {
      updateNodeStyles(node.id, { left: `${value}px` });
    } else {
      updateNodeStyles(node.id, { top: `${value}px` });
    }
  }, [node.id, updateNodeBounds, updateNodeStyles, pushHistory]);

  const handleRotationChange = useCallback((deg: number) => {
    pushHistory('Rotate');
    updateNodeStyles(node.id, { rotate: `${deg}deg` });
  }, [node.id, updateNodeStyles, pushHistory]);

  const handleFlipH = useCallback(() => {
    pushHistory('Flip horizontal');
    const current = node.styles.overrides['transform'] || '';
    const hasFlip = current.includes('scaleX(-1)');
    updateNodeStyles(node.id, {
      transform: hasFlip ? current.replace('scaleX(-1)', '').trim() : `${current} scaleX(-1)`.trim(),
    });
  }, [node.id, node.styles.overrides, updateNodeStyles, pushHistory]);

  const handleFlipV = useCallback(() => {
    pushHistory('Flip vertical');
    const current = node.styles.overrides['transform'] || '';
    const hasFlip = current.includes('scaleY(-1)');
    updateNodeStyles(node.id, {
      transform: hasFlip ? current.replace('scaleY(-1)', '').trim() : `${current} scaleY(-1)`.trim(),
    });
  }, [node.id, node.styles.overrides, updateNodeStyles, pushHistory]);

  // Alignment: align selected node within its parent
  const handleAlign = useCallback((align: string) => {
    if (selectedIds.length === 0) return;
    // Find parent bounds
    let parentBounds = { x: 0, y: 0, width: 0, height: 0 };
    for (const doc of documents) {
      const parent = findParentNode(doc.rootNode, node.id);
      if (parent) { parentBounds = parent.bounds; break; }
      if (doc.rootNode.id === node.id) { parentBounds = { x: 0, y: 0, width: doc.viewport.width, height: doc.viewport.height }; break; }
    }

    pushHistory(`Align ${align}`);
    const b = node.bounds;
    switch (align) {
      case 'left': updateNodeBounds(node.id, { x: parentBounds.x }); updateNodeStyles(node.id, { left: `${parentBounds.x}px` }); break;
      case 'center-h': updateNodeBounds(node.id, { x: parentBounds.x + (parentBounds.width - b.width) / 2 }); updateNodeStyles(node.id, { left: `${parentBounds.x + (parentBounds.width - b.width) / 2}px` }); break;
      case 'right': updateNodeBounds(node.id, { x: parentBounds.x + parentBounds.width - b.width }); updateNodeStyles(node.id, { left: `${parentBounds.x + parentBounds.width - b.width}px` }); break;
      case 'top': updateNodeBounds(node.id, { y: parentBounds.y }); updateNodeStyles(node.id, { top: `${parentBounds.y}px` }); break;
      case 'center-v': updateNodeBounds(node.id, { y: parentBounds.y + (parentBounds.height - b.height) / 2 }); updateNodeStyles(node.id, { top: `${parentBounds.y + (parentBounds.height - b.height) / 2}px` }); break;
      case 'bottom': updateNodeBounds(node.id, { y: parentBounds.y + parentBounds.height - b.height }); updateNodeStyles(node.id, { top: `${parentBounds.y + parentBounds.height - b.height}px` }); break;
    }
  }, [node.id, node.bounds, selectedIds, documents, updateNodeBounds, updateNodeStyles, pushHistory]);

  const toggleAbsolute = useCallback(() => {
    pushHistory('Toggle absolute position');
    updateNodeStyles(node.id, {
      position: isAbsolute ? 'relative' : 'absolute',
    });
  }, [node.id, isAbsolute, updateNodeStyles, pushHistory]);

  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* Header */}
      <div className="flex h-9 items-center justify-between px-4">
        <span className="text-[12px] font-semibold" style={{ color: 'var(--penma-text)' }}>
          Position
        </span>
        <button
          onClick={toggleAbsolute}
          title={isAbsolute ? 'Absolute positioned' : 'Set absolute position'}
          className="flex h-[28px] w-[28px] items-center justify-center rounded-md cursor-pointer
                     transition-all duration-150 ease-out shrink-0"
          style={{
            color: isAbsolute ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: isAbsolute ? 'var(--penma-primary-light)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!isAbsolute) e.currentTarget.style.background = 'var(--penma-hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isAbsolute ? 'var(--penma-primary-light)' : 'transparent'; }}
        >
          <AbsoluteIcon active={isAbsolute} />
        </button>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-3">
        {/* ── Alignment ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Alignment</span>
          <div className="flex items-center gap-2">
            {/* Horizontal alignment group */}
            <div className="flex flex-1 rounded-lg p-[2px]" style={{ background: 'var(--penma-hover-bg)' }}>
              <AlignBtn onClick={() => handleAlign('left')} title="Align left"><AlignLeftIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign('center-h')} title="Align center"><AlignCenterHIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign('right')} title="Align right"><AlignRightIcon /></AlignBtn>
            </div>
            {/* Vertical alignment group */}
            <div className="flex flex-1 rounded-lg p-[2px]" style={{ background: 'var(--penma-hover-bg)' }}>
              <AlignBtn onClick={() => handleAlign('top')} title="Align top"><AlignTopIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign('center-v')} title="Align middle"><AlignCenterVIcon /></AlignBtn>
              <AlignBtn onClick={() => handleAlign('bottom')} title="Align bottom"><AlignBottomIcon /></AlignBtn>
            </div>
          </div>
        </div>

        {/* ── Position X / Y + Constraints toggle ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Position</span>
          <div className="flex items-center gap-1.5">
            <PosInput label="X" value={x} onChange={(v) => handlePositionChange('x', v)} />
            <PosInput label="Y" value={y} onChange={(v) => handlePositionChange('y', v)} />
            <button
              onClick={() => setShowConstraints(!showConstraints)}
              title="Constraints"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md cursor-pointer
                         transition-all duration-150 ease-out shrink-0"
              style={{
                color: showConstraints ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
                background: showConstraints ? 'var(--penma-primary-light)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!showConstraints) e.currentTarget.style.background = 'var(--penma-hover-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = showConstraints ? 'var(--penma-primary-light)' : 'transparent'; }}
            >
              <ConstraintsIcon />
            </button>
          </div>
        </div>

        {/* ── Constraints (expandable) ── */}
        {showConstraints && (
          <ConstraintsSection
            horizontal={constraintH}
            vertical={constraintV}
            onChangeH={(v) => { pushHistory('Change constraint'); handleConstraintChange('horizontal', v); }}
            onChangeV={(v) => { pushHistory('Change constraint'); handleConstraintChange('vertical', v); }}
          />
        )}

        {/* ── Rotation + Flip ── */}
        <div>
          <span className="block text-[11px] mb-1.5" style={mutedStyle}>Rotation</span>
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2 gap-1.5" style={inputBgStyle}>
              <span className="flex items-center shrink-0" style={mutedStyle}><RotationIcon /></span>
              <input
                type="number"
                value={rotation}
                onChange={(e) => handleRotationChange(Number(e.target.value) || 0)}
                className="w-full bg-transparent text-[11px] focus:outline-none
                           [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ color: 'var(--penma-text)' }}
              />
              <span className="text-[10px] shrink-0" style={mutedStyle}>°</span>
            </div>
            <button
              onClick={handleFlipH}
              title="Flip horizontal"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md cursor-pointer
                         transition-all duration-150 ease-out hover:bg-[var(--penma-hover-bg)] shrink-0"
              style={mutedStyle}
            >
              <FlipHIcon />
            </button>
            <button
              onClick={handleFlipV}
              title="Flip vertical"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md cursor-pointer
                         transition-all duration-150 ease-out hover:bg-[var(--penma-hover-bg)] shrink-0"
              style={mutedStyle}
            >
              <FlipVIcon />
            </button>
            <button
              onClick={() => {}}
              title="Distribute spacing"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md cursor-pointer
                         transition-all duration-150 ease-out hover:bg-[var(--penma-hover-bg)] shrink-0"
              style={mutedStyle}
            >
              <DistributeIcon />
            </button>
          </div>
        </div>
      </div>
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
