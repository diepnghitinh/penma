'use client';

import React, { useState, useCallback } from 'react';
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

/** Read-only panel showing element attributes in view mode */
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
        <AttrSection
          title="Position & Size"
          cssEntries={[
            ['left', `${Math.round(selectedNode.bounds.x)}px`],
            ['top', `${Math.round(selectedNode.bounds.y)}px`],
            ['width', `${Math.round(selectedNode.bounds.width)}px`],
            ['height', `${Math.round(selectedNode.bounds.height)}px`],
          ]}
        >
          <AttrRow label="X" value={`${Math.round(selectedNode.bounds.x)}`} />
          <AttrRow label="Y" value={`${Math.round(selectedNode.bounds.y)}`} />
          <AttrRow label="W" value={`${Math.round(selectedNode.bounds.width)}`} />
          <AttrRow label="H" value={`${Math.round(selectedNode.bounds.height)}`} />
        </AttrSection>

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
        {Object.keys(selectedNode.attributes).length > 0 && (
          <AttrSection title="Attributes">
            {Object.entries(selectedNode.attributes).map(([key, value]) => (
              <AttrRow key={key} label={key} value={value} />
            ))}
          </AttrSection>
        )}
      </div>
    </div>
  );
};

// ── Sub-sections ─────────────────────────────────────────────

const TypographySection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const fontFamily = getEffectiveStyle(node.styles, 'font-family') || '';
  const fontSize = getEffectiveStyle(node.styles, 'font-size') || '';
  const fontWeight = getEffectiveStyle(node.styles, 'font-weight') || '';
  const lineHeight = getEffectiveStyle(node.styles, 'line-height') || '';
  const letterSpacing = getEffectiveStyle(node.styles, 'letter-spacing') || '';
  const color = getEffectiveStyle(node.styles, 'color') || '';

  const entries: [string, string][] = [];
  if (fontFamily) entries.push(['font-family', fontFamily]);
  if (fontSize) entries.push(['font-size', fontSize]);
  if (fontWeight) entries.push(['font-weight', fontWeight]);
  if (lineHeight) entries.push(['line-height', lineHeight]);
  if (letterSpacing && letterSpacing !== 'normal') entries.push(['letter-spacing', letterSpacing]);
  if (color) entries.push(['color', color]);

  return (
    <AttrSection title="Typography" cssEntries={entries}>
      {fontFamily && <AttrRow label="Font" value={fontFamily.split(',')[0].replace(/['"]/g, '')} />}
      {fontSize && <AttrRow label="Size" value={fontSize} />}
      {fontWeight && <AttrRow label="Weight" value={fontWeight} />}
      {lineHeight && <AttrRow label="Line H" value={lineHeight} />}
      {letterSpacing && letterSpacing !== 'normal' && <AttrRow label="Spacing" value={letterSpacing} />}
      {color && <AttrRow label="Color" value={color} colorPreview />}
    </AttrSection>
  );
};

const FillSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const bgColor = getEffectiveStyle(node.styles, 'background-color') || '';
  if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') return null;

  return (
    <AttrSection title="Fill" cssEntries={[['background-color', bgColor]]}>
      <AttrRow label="Background" value={bgColor} colorPreview />
    </AttrSection>
  );
};

const StrokeSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const bw = getEffectiveStyle(node.styles, 'border-top-width') || '0';
  if (bw === '0' || bw === '0px') return null;

  const bc = getEffectiveStyle(node.styles, 'border-top-color') || '';
  const bs = getEffectiveStyle(node.styles, 'border-top-style') || '';
  if (bs === 'none') return null;

  const entries: [string, string][] = [['border-width', bw]];
  if (bc) entries.push(['border-color', bc]);
  if (bs) entries.push(['border-style', bs]);

  return (
    <AttrSection title="Stroke" cssEntries={entries}>
      <AttrRow label="Width" value={bw} />
      {bc && <AttrRow label="Color" value={bc} colorPreview />}
      {bs && <AttrRow label="Style" value={bs} />}
    </AttrSection>
  );
};

const LayoutSection: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const display = getEffectiveStyle(node.styles, 'display') || '';
  const position = getEffectiveStyle(node.styles, 'position') || '';
  const overflow = getEffectiveStyle(node.styles, 'overflow') || '';
  const opacity = getEffectiveStyle(node.styles, 'opacity') || '';
  const borderRadius = getEffectiveStyle(node.styles, 'border-radius') || '';

  const hasContent = display || position || overflow || opacity || borderRadius;
  if (!hasContent) return null;

  const entries: [string, string][] = [];
  if (display) entries.push(['display', display]);
  if (position && position !== 'static') entries.push(['position', position]);
  if (overflow && overflow !== 'visible') entries.push(['overflow', overflow]);
  if (opacity && opacity !== '1') entries.push(['opacity', opacity]);
  if (borderRadius && borderRadius !== '0px') entries.push(['border-radius', borderRadius]);

  return (
    <AttrSection title="Layout" cssEntries={entries}>
      {display && <AttrRow label="Display" value={display} />}
      {position && position !== 'static' && <AttrRow label="Position" value={position} />}
      {overflow && overflow !== 'visible' && <AttrRow label="Overflow" value={overflow} />}
      {opacity && opacity !== '1' && <AttrRow label="Opacity" value={opacity} />}
      {borderRadius && borderRadius !== '0px' && <AttrRow label="Radius" value={borderRadius} />}
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

function parseColorToHex(color: string): string | null {
  if (!color) return null;
  if (color.startsWith('#')) return color.slice(0, 7);
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  const srgbMatch = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255).toString(16).padStart(2, '0');
    const g = Math.round(parseFloat(srgbMatch[2]) * 255).toString(16).padStart(2, '0');
    const b = Math.round(parseFloat(srgbMatch[3]) * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return null;
}

const AttrRow: React.FC<{ label: string; value: string; colorPreview?: boolean }> = ({ label, value, colorPreview }) => {
  const hex = colorPreview ? parseColorToHex(value) : null;

  return (
    <div className="flex items-center gap-2 py-0.5">
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
        <span
          className="text-[11px] truncate select-all cursor-text"
          style={{ color: 'var(--penma-text)' }}
          title={value}
        >
          {value}
        </span>
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
