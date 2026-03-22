'use client';

import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Paintbrush, Eye, EyeOff, Minus, Plus, SeparatorHorizontal } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';
import { getEffectiveStyle } from '@/lib/styles/style-resolver';
import { STYLE_CATEGORIES } from '@/lib/styles/style-resolver';
import { AutoLayoutPanel } from './AutoLayoutPanel';
import { ExportPanel } from './ExportPanel';
import type { PenmaNode } from '@/types/document';

interface StyleSectionProps {
  title: string;
  properties: readonly string[];
  node: PenmaNode;
}

const StyleSection: React.FC<StyleSectionProps> = ({ title, properties, node }) => {
  const [expanded, setExpanded] = useState(true);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const handleStyleChange = useCallback(
    (property: string, value: string) => {
      pushHistory(`Change ${property}`);
      updateNodeStyles(node.id, { [property]: value });
    },
    [node.id, updateNodeStyles, pushHistory]
  );

  return (
    <div className="border-b border-neutral-100">
      <button
        className="flex h-8 w-full items-center gap-1 px-3 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {expanded && (
        <div className="px-3 pb-2">
          {properties.map((prop) => {
            const value = getEffectiveStyle(node.styles, prop) || '';
            const isOverridden = prop in node.styles.overrides;

            return (
              <div key={prop} className="flex items-center gap-2 py-0.5">
                <label
                  className={`w-28 truncate text-[11px] ${
                    isOverridden ? 'text-blue-600 font-medium' : 'text-neutral-400'
                  }`}
                  title={prop}
                >
                  {prop}
                </label>
                {prop.includes('color') ? (
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="color"
                      value={parseColorToHex(value)}
                      onChange={(e) => handleStyleChange(prop, e.target.value)}
                      className="h-5 w-5 cursor-pointer rounded border border-neutral-200 p-0"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleStyleChange(prop, e.target.value)}
                      className="flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700 focus:border-blue-300 focus:outline-none"
                    />
                  </div>
                ) : prop === 'text-valign' ? (
                  <select
                    value={value || 'middle'}
                    onChange={(e) => handleStyleChange(prop, e.target.value)}
                    className="flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700 focus:border-blue-300 focus:outline-none cursor-pointer"
                  >
                    <option value="top">Top</option>
                    <option value="middle">Middle</option>
                    <option value="bottom">Bottom</option>
                  </select>
                ) : prop === 'text-align' ? (
                  <select
                    value={value || 'left'}
                    onChange={(e) => handleStyleChange(prop, e.target.value)}
                    className="flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700 focus:border-blue-300 focus:outline-none cursor-pointer"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleStyleChange(prop, e.target.value)}
                    className="flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700 focus:border-blue-300 focus:outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function parseColorToHex(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7);
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

export const StylePanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  // Find the document containing the selected node
  const document = (() => {
    if (selectedIds.length === 0) return null;
    for (const doc of documents) {
      if (findNodeById(doc.rootNode, selectedIds[0])) return doc;
    }
    return null;
  })();

  if (!document || selectedIds.length === 0) {
    // No selection — show export for the active frame if available
    if (documents.length > 0) {
      return (
        <div className="flex h-full flex-col">
          <div className="flex h-9 items-center px-3" style={{ borderBottom: '1px solid var(--penma-border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
              Export
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 penma-scrollbar">
            <ExportPanel />
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center p-4" style={{ color: 'var(--penma-text-muted)' }}>
        <Paintbrush size={24} className="mb-2" />
        <span className="text-xs">Select an element</span>
      </div>
    );
  }

  const selectedNode = findNodeById(document.rootNode, selectedIds[0]);
  if (!selectedNode) return null;

  const isComponent = !!(selectedNode.componentId || selectedNode.componentRef);
  const isInstance = !!selectedNode.componentRef;
  const accentColor = isComponent ? '#ec4899' : 'var(--penma-text-muted)';

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center px-3" style={{ borderBottom: `1px solid ${isComponent ? '#fce7f3' : 'var(--penma-border)'}` }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accentColor, fontFamily: 'var(--font-heading)' }}>
          {isInstance ? 'Instance' : isComponent ? 'Component' : 'Design'}
        </span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
          &lt;{selectedNode.tagName}&gt;
        </span>
      </div>

      {/* Instance banner */}
      {isInstance && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px]" style={{ background: '#fdf2f8', color: '#be185d', borderBottom: '1px solid #fce7f3' }}>
          <span>◇</span>
          <span>Component reference — not editable</span>
        </div>
      )}

      {/* Node info */}
      <div className="border-b border-neutral-100 px-3 py-2">
        <div className="flex items-center gap-2">
          {isComponent && (
            <span className="flex h-4 w-4 items-center justify-center rounded text-[9px]" style={{ background: '#fce7f3', color: '#ec4899' }}>
              {isInstance ? '◇' : '◆'}
            </span>
          )}
          <span className={`text-xs font-medium ${isComponent ? 'text-pink-700' : 'text-neutral-700'}`}>
            {selectedNode.name || selectedNode.tagName}
          </span>
        </div>
        {selectedNode.textContent && (
          <p className="mt-1 text-[11px] text-neutral-400 truncate">
            {selectedNode.textContent.slice(0, 50)}
          </p>
        )}
      </div>

      {/* Dimensions — editable W/H/X/Y */}
      {!isInstance && (
        <DimensionInputs node={selectedNode} />
      )}
      {isInstance && (
        <div className="border-b border-neutral-100 px-3 py-2">
          <div className="flex gap-3 text-[10px] text-neutral-400">
            <span>W {Math.round(selectedNode.bounds.width)}</span>
            <span>H {Math.round(selectedNode.bounds.height)}</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Auto Layout — Figma-style layout controls */}
        <AutoLayoutPanel node={selectedNode} />

        {Object.entries(STYLE_CATEGORIES)
          .filter(([category]) => {
            // Text elements (span with text, no children) don't support spacing
            const isTextElement = selectedNode.tagName === 'span'
              && !!selectedNode.textContent
              && selectedNode.children.length === 0;
            if (isTextElement && category === 'spacing') return false;
            return true;
          })
          .map(([category, properties]) => (
          <StyleSection
            key={category}
            title={category.charAt(0).toUpperCase() + category.slice(1)}
            properties={properties}
            node={selectedNode}
          />
        ))}

        {/* Stroke */}
        {!isInstance && <StrokePanel node={selectedNode} />}

        {/* Export */}
        <div style={{ borderTop: '1px solid var(--penma-border)' }}>
          <div className="px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
              Export
            </span>
          </div>
          <div className="px-3 pb-3">
            <ExportPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Stroke panel (Figma-style) ──────────────────────────────

const STROKE_POSITIONS = ['inside', 'center', 'outside'] as const;

const StrokePanel: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [expanded, setExpanded] = useState(true);
  const [showIndividual, setShowIndividual] = useState(false);

  const styles = { ...node.styles.computed, ...node.styles.overrides };

  // Read current border values
  const btw = parseFloat(styles['border-top-width'] || '0') || 0;
  const brw = parseFloat(styles['border-right-width'] || '0') || 0;
  const bbw = parseFloat(styles['border-bottom-width'] || '0') || 0;
  const blw = parseFloat(styles['border-left-width'] || '0') || 0;
  const hasBorder = btw > 0 || brw > 0 || bbw > 0 || blw > 0;
  const uniformWeight = btw === brw && brw === bbw && bbw === blw;
  const weight = uniformWeight ? btw : Math.max(btw, brw, bbw, blw);

  // Color — pick first available
  const rawColor = styles['border-top-color'] || styles['border-right-color'] || styles['border-bottom-color'] || styles['border-left-color'] || '#E2E8F0';
  const hexColor = parseColorToHex(rawColor);

  // Visibility
  const borderStyle = styles['border-top-style'] || styles['border-bottom-style'] || 'solid';
  const isVisible = borderStyle !== 'none' && hasBorder;

  const applyBorder = useCallback((overrides: Record<string, string>) => {
    pushHistory('Change stroke');
    updateNodeStyles(node.id, overrides);
  }, [node.id, updateNodeStyles, pushHistory]);

  const setColor = useCallback((hex: string) => {
    applyBorder({
      'border-top-color': hex,
      'border-right-color': hex,
      'border-bottom-color': hex,
      'border-left-color': hex,
    });
  }, [applyBorder]);

  const setWeight = useCallback((val: number, side?: 'top' | 'right' | 'bottom' | 'left') => {
    const px = `${Math.max(0, val)}px`;
    if (side) {
      applyBorder({ [`border-${side}-width`]: px, [`border-${side}-style`]: val > 0 ? 'solid' : 'none' });
    } else {
      applyBorder({
        'border-top-width': px, 'border-right-width': px, 'border-bottom-width': px, 'border-left-width': px,
        'border-top-style': val > 0 ? 'solid' : 'none', 'border-right-style': val > 0 ? 'solid' : 'none',
        'border-bottom-style': val > 0 ? 'solid' : 'none', 'border-left-style': val > 0 ? 'solid' : 'none',
      });
    }
  }, [applyBorder]);

  const toggleVisibility = useCallback(() => {
    const newStyle = isVisible ? 'none' : 'solid';
    applyBorder({
      'border-top-style': newStyle, 'border-right-style': newStyle,
      'border-bottom-style': newStyle, 'border-left-style': newStyle,
    });
  }, [isVisible, applyBorder]);

  const addBorder = useCallback(() => {
    applyBorder({
      'border-top-width': '1px', 'border-right-width': '1px', 'border-bottom-width': '1px', 'border-left-width': '1px',
      'border-top-style': 'solid', 'border-right-style': 'solid', 'border-bottom-style': 'solid', 'border-left-style': 'solid',
      'border-top-color': '#E2E8F0', 'border-right-color': '#E2E8F0', 'border-bottom-color': '#E2E8F0', 'border-left-color': '#E2E8F0',
    });
  }, [applyBorder]);

  const removeBorder = useCallback(() => {
    applyBorder({
      'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px',
      'border-top-style': 'none', 'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
    });
  }, [applyBorder]);

  return (
    <div className="border-b border-neutral-100">
      {/* Header */}
      <div className="flex h-8 items-center justify-between px-3">
        <button
          className="flex items-center gap-1 text-xs font-medium text-neutral-500 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Stroke
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowIndividual(!showIndividual)}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-100 cursor-pointer"
            style={{ color: showIndividual ? 'var(--penma-primary)' : 'var(--penma-text-muted)' }}
            title="Individual sides"
          >
            <SeparatorHorizontal size={12} />
          </button>
          <button
            onClick={hasBorder ? removeBorder : addBorder}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-100 cursor-pointer"
            style={{ color: 'var(--penma-text-muted)' }}
            title={hasBorder ? 'Remove stroke' : 'Add stroke'}
          >
            {hasBorder ? <Minus size={12} /> : <Plus size={12} />}
          </button>
        </div>
      </div>

      {expanded && hasBorder && (
        <div className="px-3 pb-2.5">
          {/* Color + Opacity + Visibility */}
          <div className="flex items-center gap-2 mb-2">
            <input
              type="color"
              value={hexColor}
              onChange={(e) => setColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border border-neutral-200 p-0"
            />
            <input
              type="text"
              value={hexColor.replace('#', '').toUpperCase()}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                if (v.length === 6) setColor(`#${v}`);
              }}
              className="flex-1 rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-700 font-mono focus:border-blue-300 focus:outline-none"
            />
            <span className="text-[10px] text-neutral-400 w-8 text-right">100 %</span>
            <button
              onClick={toggleVisibility}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-neutral-100 cursor-pointer"
              style={{ color: 'var(--penma-text-muted)' }}
              title={isVisible ? 'Hide stroke' : 'Show stroke'}
            >
              {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </div>

          {/* Position + Weight */}
          {!showIndividual && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[9px] text-neutral-400 mb-1">Position</div>
                <select
                  value="inside"
                  onChange={(e) => {
                    // CSS box model is always "inside" for borders
                    // This is informational for Figma export
                  }}
                  className="w-full rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-700 focus:outline-none cursor-pointer"
                >
                  {STROKE_POSITIONS.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <div className="text-[9px] text-neutral-400 mb-1">Weight</div>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="w-full rounded border border-neutral-200 px-2 py-1 text-[11px] text-neutral-700 focus:border-blue-300 focus:outline-none
                    [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>
          )}

          {/* Individual side weights */}
          {showIndividual && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                const val = parseFloat(styles[`border-${side}-width`] || '0') || 0;
                return (
                  <div key={side} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400 w-6 capitalize">{side.slice(0, 1).toUpperCase()}</span>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setWeight(parseInt(e.target.value) || 0, side)}
                      min={0}
                      max={100}
                      className="flex-1 rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700 focus:border-blue-300 focus:outline-none
                        [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Editable dimension inputs ───────────────────────────────

const DimensionInputs: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const updateNodeBounds = useEditorStore((s) => s.updateNodeBounds);
  const updateDocumentViewport = useEditorStore((s) => s.updateDocumentViewport);
  const documents = useEditorStore((s) => s.documents);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  // Check if this node is a document root node
  const parentDoc = documents.find((d) => d.rootNode.id === node.id);

  const handleChange = useCallback(
    (prop: 'width' | 'height', value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) return;
      pushHistory(`Resize ${prop}`);
      if (parentDoc) {
        // Root node: update viewport (controls frame size) and root node styles
        const newViewport = {
          width: prop === 'width' ? num : parentDoc.viewport.width,
          height: prop === 'height' ? num : parentDoc.viewport.height,
        };
        updateDocumentViewport(parentDoc.id, newViewport);
        updateNodeStyles(node.id, { [prop]: `${num}px` });
      } else {
        // Regular node
        updateNodeStyles(node.id, { [prop]: `${num}px` });
        updateNodeBounds(node.id, { [prop]: num });
      }
    },
    [node.id, updateNodeStyles, updateNodeBounds, updateDocumentViewport, parentDoc, pushHistory]
  );

  const handlePositionChange = useCallback(
    (prop: 'left' | 'top', value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num)) return;
      pushHistory(`Move ${prop}`);
      updateNodeStyles(node.id, { position: 'relative', [prop]: `${num}px` });
      updateNodeBounds(node.id, prop === 'left' ? { x: num } : { y: num });
    },
    [node.id, updateNodeStyles, updateNodeBounds, pushHistory]
  );

  // Read effective values: root nodes use viewport, others use overrides/bounds
  const w = parentDoc
    ? parentDoc.viewport.width
    : Math.round(parseFloat(node.styles.overrides['width'] || '') || node.bounds.width);
  const h = parentDoc
    ? parentDoc.viewport.height
    : Math.round(parseFloat(node.styles.overrides['height'] || '') || node.bounds.height);
  const x = Math.round(parseFloat(node.styles.overrides['left'] || '0') || node.bounds.x);
  const y = Math.round(parseFloat(node.styles.overrides['top'] || '0') || node.bounds.y);

  return (
    <div className="border-b border-neutral-100 px-3 py-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <DimInput label="W" value={w} onChange={(v) => handleChange('width', v)} />
        <DimInput label="H" value={h} onChange={(v) => handleChange('height', v)} />
        <DimInput label="X" value={x} onChange={(v) => handlePositionChange('left', v)} />
        <DimInput label="Y" value={y} onChange={(v) => handlePositionChange('top', v)} />
      </div>
    </div>
  );
};

const DimInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const commit = () => {
    if (editValue.trim() && editValue.trim() !== String(value)) {
      onChange(editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium text-neutral-400 w-3">{label}</span>
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.replace(/[^0-9-]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 w-0 rounded border px-1.5 py-0.5 text-[11px] text-neutral-700 outline-none"
          style={{ borderColor: 'var(--penma-primary)' }}
        />
      ) : (
        <button
          onClick={() => { setEditing(true); setEditValue(String(value)); }}
          className="flex-1 rounded border border-transparent px-1.5 py-0.5 text-[11px] text-neutral-600 text-left hover:border-neutral-200 cursor-text"
        >
          {value}
        </button>
      )}
    </div>
  );
};
