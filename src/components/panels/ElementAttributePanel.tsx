'use client';

import React, { useState, useCallback, useRef, useEffect, } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';
import { getEffectiveStyle } from '@/lib/styles/style-resolver';
import type { PenmaNode } from '@/types/document';

/** CSS properties to include when copying all CSS */
const CSS_PROPS = [
  'width', 'height', 'display', 'position', 'overflow', 'opacity',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color',
  'background-color', 'border-radius',
  'border-top-width', 'border-top-style', 'border-top-color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
];

/** Editable panel showing element attributes in view mode */
export const ElementAttributePanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activePageId = useEditorStore((s) => s.activePageId);
  const [copied, setCopied] = useState(false);

  const document = (() => {
    if (selectedIds.length === 0) return null;
    for (const doc of documents) {
      if (findNodeById(doc.rootNode, selectedIds[0])) return doc;
    }
    return null;
  })();
  // activePageId ensures re-render on page switch
  void activePageId;

  if (!document || selectedIds.length === 0) return null;

  const selectedNode = findNodeById(document.rootNode, selectedIds[0]);
  if (!selectedNode) return null;

  const handleCopyCss = () => {
    const lines: string[] = [];
    for (const prop of CSS_PROPS) {
      const val = getEffectiveStyle(selectedNode.styles, prop);
      if (val && val !== 'initial' && val !== 'none' && val !== '0px' && val !== 'normal' && val !== 'static' && val !== 'visible') {
        lines.push(`${prop}: ${val};`);
      }
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex h-9 items-center px-3 shrink-0"
        style={{ borderBottom: '1px solid var(--penma-border)' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}
        >
          Inspect
        </span>
        <span className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCopyCss}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer"
            style={{
              color: copied ? 'var(--penma-success, #22c55e)' : 'var(--penma-text-muted)',
              background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--penma-border)'}`,
              transition: 'all 150ms',
            }}
            title="Copy all CSS properties"
          >
            {copied ? (
              <>
                <CheckIcon />
                Copied
              </>
            ) : (
              <>
                <CopyIcon />
                Copy CSS
              </>
            )}
          </button>
          <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
            &lt;{selectedNode.tagName}&gt;
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto penma-scrollbar">
        {/* Element name */}
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--penma-border)' }}>
          <div className="text-xs font-medium" style={{ color: 'var(--penma-text)' }}>
            {selectedNode.name || selectedNode.tagName}
          </div>
          {selectedNode.textContent && (
            <p className="mt-1 text-[11px] truncate" style={{ color: 'var(--penma-text-muted)' }}>
              {selectedNode.textContent.slice(0, 80)}
            </p>
          )}
        </div>

        {/* Position & Size */}
        <PositionSizeSection node={selectedNode} />

        {/* Typography (for text elements) */}
        {selectedNode.tagName === 'span' && selectedNode.textContent && selectedNode.children.length === 0 && (
          <TypographySection node={selectedNode} />
        )}

        {/* Fill */}
        <FillSection node={selectedNode} />

        {/* Stroke */}
        <StrokeSection node={selectedNode} />

        {/* Layout */}
        <LayoutSection node={selectedNode} />

        {/* HTML Attributes */}
        <HtmlAttributesSection node={selectedNode} />
      </div>
    </div>
  );
};

// ── Sub-sections ─────────────────────────────────────────────

const PositionSizeSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeBounds = useEditorStore((s) => s.updateNodeBounds);
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const handleBoundsChange = useCallback(
    (field: 'x' | 'y' | 'width' | 'height', value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      pushHistory(`Change ${field}`);
      // Update bounds (shared data for sidebar)
      updateNodeBounds(node.id, { [field]: num });
      // Also update styles so the Design View reflects the change
      const styleMap: Record<string, string> = {};
      if (field === 'x') styleMap['left'] = `${num}px`;
      if (field === 'y') styleMap['top'] = `${num}px`;
      if (field === 'width') styleMap['width'] = `${num}px`;
      if (field === 'height') styleMap['height'] = `${num}px`;
      updateNodeStyles(node.id, styleMap);
    },
    [node.id, updateNodeBounds, updateNodeStyles, pushHistory]
  );

  return (
    <AttrSection
      title="Position & Size"
      cssEntries={[
        ['left', `${Math.round(node.bounds.x)}px`],
        ['top', `${Math.round(node.bounds.y)}px`],
        ['width', `${Math.round(node.bounds.width)}px`],
        ['height', `${Math.round(node.bounds.height)}px`],
      ]}
    >
      <EditableAttrRow label="X" value={`${Math.round(node.bounds.x)}`} onCommit={(v) => handleBoundsChange('x', v)} />
      <EditableAttrRow label="Y" value={`${Math.round(node.bounds.y)}`} onCommit={(v) => handleBoundsChange('y', v)} />
      <EditableAttrRow label="W" value={`${Math.round(node.bounds.width)}`} onCommit={(v) => handleBoundsChange('width', v)} />
      <EditableAttrRow label="H" value={`${Math.round(node.bounds.height)}`} onCommit={(v) => handleBoundsChange('height', v)} />
    </AttrSection>
  );
};

const TypographySection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const fontFamily = getEffectiveStyle(node.styles, 'font-family') || '';
  const fontSize = getEffectiveStyle(node.styles, 'font-size') || '';
  const fontWeight = getEffectiveStyle(node.styles, 'font-weight') || '';
  const lineHeight = getEffectiveStyle(node.styles, 'line-height') || '';
  const letterSpacing = getEffectiveStyle(node.styles, 'letter-spacing') || '';
  const color = getEffectiveStyle(node.styles, 'color') || '';

  const handleChange = useCallback(
    (prop: string, value: string) => {
      pushHistory(`Change ${prop}`);
      updateNodeStyles(node.id, { [prop]: value });
    },
    [node.id, updateNodeStyles, pushHistory]
  );

  const entries: [string, string][] = [];
  if (fontFamily) entries.push(['font-family', fontFamily]);
  if (fontSize) entries.push(['font-size', fontSize]);
  if (fontWeight) entries.push(['font-weight', fontWeight]);
  if (lineHeight) entries.push(['line-height', lineHeight]);
  if (letterSpacing && letterSpacing !== 'normal') entries.push(['letter-spacing', letterSpacing]);
  if (color) entries.push(['color', color]);

  return (
    <AttrSection title="Typography" cssEntries={entries}>
      {fontFamily && <EditableAttrRow label="Font" value={fontFamily.split(',')[0].replace(/['"]/g, '')} onCommit={(v) => handleChange('font-family', v)} />}
      {fontSize && <EditableAttrRow label="Size" value={fontSize} onCommit={(v) => handleChange('font-size', v)} />}
      {fontWeight && <EditableAttrRow label="Weight" value={fontWeight} onCommit={(v) => handleChange('font-weight', v)} />}
      {lineHeight && <EditableAttrRow label="Line H" value={lineHeight} onCommit={(v) => handleChange('line-height', v)} />}
      {letterSpacing && letterSpacing !== 'normal' && <EditableAttrRow label="Spacing" value={letterSpacing} onCommit={(v) => handleChange('letter-spacing', v)} />}
      {color && <EditableAttrRow label="Color" value={color} colorPreview onCommit={(v) => handleChange('color', v)} />}
    </AttrSection>
  );
};

const FillSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const bgColor = getEffectiveStyle(node.styles, 'background-color') || '';
  if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') return null;

  const handleChange = useCallback(
    (value: string) => {
      pushHistory('Change background-color');
      updateNodeStyles(node.id, { 'background-color': value });
    },
    [node.id, updateNodeStyles, pushHistory]
  );

  return (
    <AttrSection title="Fill" cssEntries={[['background-color', bgColor]]}>
      <EditableAttrRow label="Background" value={bgColor} colorPreview onCommit={handleChange} />
    </AttrSection>
  );
};

const StrokeSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const bw = getEffectiveStyle(node.styles, 'border-top-width') || '0';
  if (bw === '0' || bw === '0px') return null;

  const bc = getEffectiveStyle(node.styles, 'border-top-color') || '';
  const bs = getEffectiveStyle(node.styles, 'border-top-style') || '';
  if (bs === 'none') return null;

  const handleChange = useCallback(
    (prop: string, value: string) => {
      pushHistory(`Change ${prop}`);
      updateNodeStyles(node.id, { [prop]: value });
    },
    [node.id, updateNodeStyles, pushHistory]
  );

  const entries: [string, string][] = [['border-width', bw]];
  if (bc) entries.push(['border-color', bc]);
  if (bs) entries.push(['border-style', bs]);

  return (
    <AttrSection title="Stroke" cssEntries={entries}>
      <EditableAttrRow label="Width" value={bw} onCommit={(v) => handleChange('border-top-width', v)} />
      {bc && <EditableAttrRow label="Color" value={bc} colorPreview onCommit={(v) => handleChange('border-top-color', v)} />}
      {bs && <EditableAttrRow label="Style" value={bs} onCommit={(v) => handleChange('border-top-style', v)} />}
    </AttrSection>
  );
};

const LayoutSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const display = getEffectiveStyle(node.styles, 'display') || '';
  const position = getEffectiveStyle(node.styles, 'position') || '';
  const overflow = getEffectiveStyle(node.styles, 'overflow') || '';
  const opacity = getEffectiveStyle(node.styles, 'opacity') || '';
  const borderRadius = getEffectiveStyle(node.styles, 'border-radius') || '';

  const hasContent = display || position || overflow || opacity || borderRadius;
  if (!hasContent) return null;

  const handleChange = useCallback(
    (prop: string, value: string) => {
      pushHistory(`Change ${prop}`);
      updateNodeStyles(node.id, { [prop]: value });
    },
    [node.id, updateNodeStyles, pushHistory]
  );

  const entries: [string, string][] = [];
  if (display) entries.push(['display', display]);
  if (position && position !== 'static') entries.push(['position', position]);
  if (overflow && overflow !== 'visible') entries.push(['overflow', overflow]);
  if (opacity && opacity !== '1') entries.push(['opacity', opacity]);
  if (borderRadius && borderRadius !== '0px') entries.push(['border-radius', borderRadius]);

  return (
    <AttrSection title="Layout" cssEntries={entries}>
      {display && <EditableAttrRow label="Display" value={display} onCommit={(v) => handleChange('display', v)} />}
      {position && position !== 'static' && <EditableAttrRow label="Position" value={position} onCommit={(v) => handleChange('position', v)} />}
      {overflow && overflow !== 'visible' && <EditableAttrRow label="Overflow" value={overflow} onCommit={(v) => handleChange('overflow', v)} />}
      {opacity && opacity !== '1' && <EditableAttrRow label="Opacity" value={opacity} onCommit={(v) => handleChange('opacity', v)} />}
      {borderRadius && borderRadius !== '0px' && <EditableAttrRow label="Radius" value={borderRadius} onCommit={(v) => handleChange('border-radius', v)} />}
    </AttrSection>
  );
};

const HtmlAttributesSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeAttributes = useEditorStore((s) => s.updateNodeAttributes);
  const removeNodeAttribute = useEditorStore((s) => s.removeNodeAttribute);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleChange = useCallback(
    (key: string, value: string) => {
      pushHistory(`Change attribute ${key}`);
      updateNodeAttributes(node.id, { [key]: value });
    },
    [node.id, updateNodeAttributes, pushHistory]
  );

  const handleRemove = useCallback(
    (key: string) => {
      pushHistory(`Remove attribute ${key}`);
      removeNodeAttribute(node.id, key);
    },
    [node.id, removeNodeAttribute, pushHistory]
  );

  const handleAdd = useCallback(() => {
    const key = newKey.trim();
    if (!key) return;
    pushHistory(`Add attribute ${key}`);
    updateNodeAttributes(node.id, { [key]: newValue });
    setNewKey('');
    setNewValue('');
  }, [node.id, newKey, newValue, updateNodeAttributes, pushHistory]);

  const attrs = Object.entries(node.attributes);

  return (
    <AttrSection title="Attributes">
      {attrs.map(([key, value]) => (
        <EditableAttrRow
          key={key}
          label={key}
          value={value}
          onCommit={(v) => handleChange(key, v)}
          onRemove={() => handleRemove(key)}
        />
      ))}
      {/* Add new attribute row */}
      <div className="flex items-center gap-1 py-1 mt-1" style={{ borderTop: attrs.length > 0 ? '1px solid var(--penma-border)' : undefined }}>
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="name"
          className="w-16 shrink-0 rounded px-1 py-0.5 text-[10px]"
          style={{
            color: 'var(--penma-text)',
            background: 'var(--penma-bg-secondary, rgba(0,0,0,0.04))',
            border: '1px solid var(--penma-border)',
            outline: 'none',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="value"
          className="flex-1 rounded px-1 py-0.5 text-[10px]"
          style={{
            color: 'var(--penma-text)',
            background: 'var(--penma-bg-secondary, rgba(0,0,0,0.04))',
            border: '1px solid var(--penma-border)',
            outline: 'none',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button
          onClick={handleAdd}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer"
          style={{
            color: 'var(--penma-text-muted)',
            border: '1px solid var(--penma-border)',
            background: 'transparent',
          }}
          title="Add attribute"
        >
          +
        </button>
      </div>
    </AttrSection>
  );
};

// ── Shared primitives ────────────────────────────────────────

const AttrSection: React.FC<{ title: string; children: React.ReactNode; cssEntries?: [string, string][] }> = ({ title, children, cssEntries }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cssEntries || cssEntries.length === 0) return;
    const text = cssEntries.map(([p, v]) => `${p}: ${v};`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [cssEntries]);

  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      <div className="group/section flex h-8 items-center gap-1.5 px-3">
        <button
          className="flex flex-1 items-center gap-1.5 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--penma-text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          >
            <path d="M3.5 2L6.5 5L3.5 8" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--penma-text-muted)' }}>
            {title}
          </span>
        </button>
        {cssEntries && cssEntries.length > 0 && (
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium cursor-pointer opacity-0 group-hover/section:opacity-100"
            style={{
              color: copied ? 'var(--penma-success, #22c55e)' : 'var(--penma-text-muted)',
              transition: 'opacity 100ms',
            }}
            title="Copy CSS for this section"
          >
            {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> CSS</>}
          </button>
        )}
      </div>
      {expanded && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
};

// Use shared color parser
import { parseColorToHex as _parseHex } from '@/lib/styles/color-parser';
function parseColorToHex(color: string): string | null {
  if (!color) return null;
  return _parseHex(color) || null;
}

/**
 * Editable attribute row — always-visible input directly bound to store value.
 * No local draft state: the input value IS the store value (single source of truth).
 * Changes are written to the store immediately on blur/Enter.
 */
const EditableAttrRow: React.FC<{
  label: string;
  value: string;
  colorPreview?: boolean;
  onCommit: (value: string) => void;
  onRemove?: () => void;
}> = ({ label, value, colorPreview, onCommit, onRemove }) => {
  const hex = colorPreview ? parseColorToHex(value) : null;
  const inputRef = useRef<HTMLInputElement>(null);
  // Track if user is actively typing to avoid store overwrites mid-edit
  const pendingRef = useRef<string | null>(null);

  // Keep input in sync with store value when not actively editing
  useEffect(() => {
    if (inputRef.current && pendingRef.current === null) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    pendingRef.current = e.target.value;
  }, []);

  const flush = useCallback(() => {
    if (pendingRef.current !== null && pendingRef.current !== value) {
      onCommit(pendingRef.current);
    }
    pendingRef.current = null;
  }, [value, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      flush();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      pendingRef.current = null;
      e.currentTarget.value = value;
      e.currentTarget.blur();
    }
  }, [flush, value]);

  return (
    <div className="group/row flex items-center gap-2 py-0.5">
      <span className="w-20 shrink-0 text-[11px]" style={{ color: 'var(--penma-text-muted)' }}>
        {label}
      </span>
      <div className="flex flex-1 items-center gap-1.5 min-w-0">
        {hex && (
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm"
            style={{ backgroundColor: hex, border: '1px solid var(--penma-border)' }}
          />
        )}
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          onChange={handleChange}
          onBlur={flush}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded px-1 py-0 text-[11px] min-w-0"
          style={{
            color: 'var(--penma-text)',
            background: 'transparent',
            border: '1px solid transparent',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--penma-accent, #2563eb)';
            e.currentTarget.style.background = 'var(--penma-bg-secondary, rgba(0,0,0,0.04))';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.background = 'transparent';
          }}
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="shrink-0 rounded px-0.5 text-[10px] cursor-pointer opacity-0 group-hover/row:opacity-100"
            style={{ color: 'var(--penma-text-muted)', transition: 'opacity 100ms' }}
            title="Remove attribute"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
};

// ── Inline SVG icons ─────────────────────────────────────────

const CopyIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <path d="M8 4V2.5A1 1 0 007 1.5H2.5A1 1 0 001.5 2.5V7A1 1 0 002.5 8H4" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.5L5 9L9.5 3" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h8M4.5 3V2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M9 3v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3" />
  </svg>
);
