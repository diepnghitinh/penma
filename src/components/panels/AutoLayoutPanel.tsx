'use client';

import React, { useCallback } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Plus,
  X,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Columns3,
  WrapText,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { PenmaNode, LayoutDirection, PrimaryAxisAlign, CounterAxisAlign } from '@/types/document';

interface AutoLayoutPanelProps {
  node: PenmaNode;
}

// ─── Small reusable controls ────────────────────────────────

const NumericInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  label?: string;
  min?: number;
  max?: number;
  className?: string;
}> = ({ value, onChange, label, min = 0, max = 9999, className = '' }) => (
  <div className={`flex flex-col items-center gap-0.5 ${className}`}>
    {label && <span className="text-[9px] text-neutral-400 uppercase">{label}</span>}
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
      className="w-12 rounded border border-neutral-200 px-1.5 py-0.5 text-center text-[11px] text-neutral-700
                 focus:border-blue-300 focus:outline-none [appearance:textfield]
                 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  </div>
);

const ToggleButton: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex h-7 w-7 items-center justify-center rounded transition-colors
      ${active ? 'bg-blue-50 text-blue-600' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'}`}
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

  // Map (row, col) to [primary, counter] based on direction
  const primaryOpts: PrimaryAxisAlign[] = ['start', 'center', 'end'];
  const counterOpts: CounterAxisAlign[] = ['start', 'center', 'end'];

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] text-neutral-400 uppercase mb-0.5">Alignment</span>
      <div className="grid grid-cols-3 gap-0.5 rounded border border-neutral-200 p-0.5 bg-neutral-50">
        {counterOpts.map((ca) =>
          primaryOpts.map((pa) => {
            const isActive = primary === pa && counter === ca;
            return (
              <button
                key={`${pa}-${ca}`}
                onClick={() => { onChangePrimary(pa); onChangeCounter(ca); }}
                className={`flex h-5 w-5 items-center justify-center rounded-sm transition-colors
                  ${isActive ? 'bg-blue-500' : 'hover:bg-neutral-200'}`}
                title={`Primary: ${pa}, Counter: ${ca}`}
              >
                <div
                  className={`rounded-full ${isActive ? 'bg-white' : 'bg-neutral-300'}`}
                  style={{ width: 5, height: 5 }}
                />
              </button>
            );
          })
        )}
      </div>
      {/* Space-between option */}
      <button
        onClick={() => onChangePrimary('space-between')}
        className={`mt-0.5 flex h-6 items-center gap-1 rounded px-2 text-[10px] transition-colors
          ${primary === 'space-between' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-neutral-400 hover:bg-neutral-100'}`}
      >
        <Columns3 size={11} />
        Space between
      </button>
    </div>
  );
};

// ─── Padding visualizer (box model) ────────────────────────

const PaddingEditor: React.FC<{
  padding: { top: number; right: number; bottom: number; left: number };
  independent: boolean;
  onToggleIndependent: () => void;
  onChangeSide: (side: 'top' | 'right' | 'bottom' | 'left', value: number) => void;
  onChangeUniform: (value: number) => void;
}> = ({ padding, independent, onToggleIndependent, onChangeSide, onChangeUniform }) => {
  if (!independent) {
    return (
      <div className="flex items-center gap-2">
        <NumericInput
          value={padding.top}
          onChange={(v) => onChangeUniform(v)}
          label="Padding"
        />
        <button
          onClick={onToggleIndependent}
          title="Set individual padding per side"
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <Maximize2 size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-neutral-400 uppercase">Padding</span>
        <button
          onClick={onToggleIndependent}
          title="Set uniform padding"
          className="flex h-4 w-4 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <Minimize2 size={9} />
        </button>
      </div>
      {/* Visual box layout */}
      <div className="relative flex flex-col items-center">
        <NumericInput value={padding.top} onChange={(v) => onChangeSide('top', v)} />
        <div className="flex items-center gap-2">
          <NumericInput value={padding.left} onChange={(v) => onChangeSide('left', v)} />
          <div className="h-5 w-8 rounded border border-dashed border-neutral-300" />
          <NumericInput value={padding.right} onChange={(v) => onChangeSide('right', v)} />
        </div>
        <NumericInput value={padding.bottom} onChange={(v) => onChangeSide('bottom', v)} />
      </div>
    </div>
  );
};

// ─── Sizing controls ────────────────────────────────────────

const SizingControl: React.FC<{
  label: string;
  mode: 'fixed' | 'hug' | 'fill';
  onChange: (m: 'fixed' | 'hug' | 'fill') => void;
}> = ({ label, mode, onChange }) => {
  const options: { value: 'fixed' | 'hug' | 'fill'; label: string; icon: string }[] = [
    { value: 'fixed', label: 'Fixed', icon: '⊞' },
    { value: 'hug', label: 'Hug', icon: '↔' },
    { value: 'fill', label: 'Fill', icon: '⇔' },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-6 text-[9px] text-neutral-400 uppercase">{label}</span>
      <div className="flex rounded border border-neutral-200 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`flex h-6 items-center px-2 text-[10px] transition-colors
              ${mode === opt.value
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main panel ─────────────────────────────────────────────

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

  // No auto layout → show Add button
  if (!layout) {
    return (
      <div className="border-b border-neutral-100">
        <div className="flex h-8 items-center justify-between px-3">
          <span className="text-xs font-medium text-neutral-500">Auto layout</span>
          <button
            onClick={() => {
              if (!hasChildren) return;
              pushHistory('Add auto layout');
              toggleAutoLayout(node.id);
            }}
            disabled={!hasChildren}
            className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] text-blue-500 hover:bg-blue-50 disabled:text-neutral-300 disabled:hover:bg-transparent transition-colors"
            title={hasChildren ? 'Add auto layout' : 'Element needs children for auto layout'}
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      </div>
    );
  }

  // Has auto layout → full controls
  return (
    <div className="border-b border-neutral-100">
      {/* Header */}
      <div className="flex h-8 items-center justify-between px-3">
        <span className="text-xs font-medium text-blue-600">Auto layout</span>
        <button
          onClick={() => {
            pushHistory('Remove auto layout');
            toggleAutoLayout(node.id);
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Remove auto layout"
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-3 pb-3 flex flex-col gap-3">
        {/* Direction */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-neutral-400 uppercase w-14">Direction</span>
          <div className="flex gap-0.5">
            <ToggleButton
              active={layout.direction === 'vertical'}
              onClick={() => change({ direction: 'vertical' })}
              title="Vertical"
            >
              <ArrowDown size={14} />
            </ToggleButton>
            <ToggleButton
              active={layout.direction === 'horizontal'}
              onClick={() => change({ direction: 'horizontal' })}
              title="Horizontal"
            >
              <ArrowRight size={14} />
            </ToggleButton>
            <ToggleButton
              active={layout.direction === 'wrap'}
              onClick={() => change({ direction: 'wrap' })}
              title="Wrap"
            >
              <WrapText size={14} />
            </ToggleButton>
          </div>
          {/* Reverse */}
          <button
            onClick={() => change({ reverse: !layout.reverse })}
            className={`ml-auto flex h-6 items-center rounded px-1.5 text-[10px] transition-colors
              ${layout.reverse ? 'bg-blue-50 text-blue-600' : 'text-neutral-400 hover:bg-neutral-100'}`}
            title="Reverse order"
          >
            Rev
          </button>
        </div>

        {/* Gap */}
        {layout.direction === 'wrap' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-neutral-400 uppercase w-14">H Gap</span>
              <NumericInput value={layout.gap} onChange={(v) => change({ gap: v })} />
              <span className="text-[9px] text-neutral-400">px</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-neutral-400 uppercase w-14">V Gap</span>
              <NumericInput value={layout.counterAxisGap ?? layout.gap} onChange={(v) => change({ counterAxisGap: v })} />
              <span className="text-[9px] text-neutral-400">px</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-400 uppercase w-14">Gap</span>
            <NumericInput value={layout.gap} onChange={(v) => change({ gap: v })} />
            <span className="text-[9px] text-neutral-400">px</span>
          </div>
        )}

        {/* Alignment */}
        <AlignmentGrid
          direction={layout.direction}
          primary={layout.primaryAxisAlign}
          counter={layout.counterAxisAlign}
          onChangePrimary={(v) => change({ primaryAxisAlign: v })}
          onChangeCounter={(v) => change({ counterAxisAlign: v })}
        />

        {/* Padding */}
        <PaddingEditor
          padding={layout.padding}
          independent={layout.independentPadding}
          onToggleIndependent={() => change({ independentPadding: !layout.independentPadding })}
          onChangeSide={(side, value) => {
            pushHistory('Change padding');
            updateAutoLayoutPadding(node.id, side, value);
          }}
          onChangeUniform={(value) => {
            pushHistory('Change padding');
            setUniformPadding(node.id, value);
          }}
        />

        {/* Sizing */}
        {sizing && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] text-neutral-400 uppercase">Sizing</span>
            <SizingControl
              label="W"
              mode={sizing.horizontal}
              onChange={(m) => {
                pushHistory('Change sizing');
                updateSizing(node.id, 'horizontal', m);
              }}
            />
            <SizingControl
              label="H"
              mode={sizing.vertical}
              onChange={(m) => {
                pushHistory('Change sizing');
                updateSizing(node.id, 'vertical', m);
              }}
            />
          </div>
        )}

        {/* Clip content */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={layout.clipContent}
            onChange={(e) => change({ clipContent: e.target.checked })}
            className="rounded border-neutral-300 text-blue-500 focus:ring-blue-300 h-3 w-3"
          />
          <span className="text-[10px] text-neutral-500">Clip content</span>
        </label>
      </div>
    </div>
  );
};
