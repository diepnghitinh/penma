'use client';

import React, { useCallback, useState } from 'react';
import { Paintbrush } from 'lucide-react';
import { sidebarConfig } from '@/configs/editor';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';
import { getEffectiveStyle } from '@/lib/styles/style-resolver';
import { STYLE_CATEGORIES } from '@/lib/styles/style-resolver';
import { PositionPanel } from './PositionPanel';
import { LayoutPanel } from './LayoutPanel';
import { TypographyPanel } from './TypographyPanel';
import { ExportPanel } from './ExportPanel';
import type { PenmaNode, PenmaFill } from '@/types/document';

interface StyleSectionProps {
  title: string;
  properties: readonly string[];
  node: PenmaNode;
}

const StyleSection: React.FC<StyleSectionProps> = ({ title, properties, node }) => {
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
      <div className="flex h-8 w-full items-center gap-1 px-3 text-xs font-medium text-neutral-500">
        {title}
      </div>
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
    </div>
  );
};

function parseColorToHex(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7);
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  // color(srgb r g b)
  const srgbMatch = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255).toString(16).padStart(2, '0');
    const g = Math.round(parseFloat(srgbMatch[2]) * 255).toString(16).padStart(2, '0');
    const b = Math.round(parseFloat(srgbMatch[3]) * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

export const StylePanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activePageId = useEditorStore((s) => s.activePageId);

  // Find the document containing the selected node (scoped to active page)
  const document = (() => {
    if (selectedIds.length === 0) return null;
    for (const doc of documents) {
      if (findNodeById(doc.rootNode, selectedIds[0])) return doc;
    }
    return null;
  })();
  // activePageId ensures re-render on page switch
  void activePageId;

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
          <span
            className={`text-xs font-medium select-all cursor-text ${isComponent ? 'text-pink-700' : 'text-neutral-700'}`}
            title="Click to select, then copy"
          >
            {selectedNode.name || selectedNode.tagName}
          </span>
        </div>
        {selectedNode.textContent && (
          <p className="mt-1 text-[11px] text-neutral-400 truncate">
            {selectedNode.textContent.slice(0, 50)}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Position panel — alignment, X/Y, rotation */}
        {!isInstance && <PositionPanel node={selectedNode} />}

        {/* Layout panel (includes auto layout toggle) */}
        {isInstance ? (
          <div className="border-b border-neutral-100 px-3 py-2">
            <div className="flex gap-3 text-[10px] text-neutral-400">
              <span>W {Math.round(selectedNode.bounds.width)}</span>
              <span>H {Math.round(selectedNode.bounds.height)}</span>
            </div>
          </div>
        ) : (
          <LayoutPanel node={selectedNode} />
        )}

        {/* Typography panel (Figma-style) — shown for text elements (span) */}
        {!isInstance && (() => {
          const isTextElement = selectedNode.tagName === 'span'
            && !!selectedNode.textContent
            && selectedNode.children.length === 0;
          return isTextElement ? <TypographyPanel node={selectedNode} /> : null;
        })()}

        {/* Native CSS property sections — hidden when showNativeCss is false */}
        {sidebarConfig.showNativeCss && Object.entries(STYLE_CATEGORIES)
          .filter(([category]) => {
            const isTextElement = selectedNode.tagName === 'span'
              && !!selectedNode.textContent
              && selectedNode.children.length === 0;
            if (isTextElement && category === 'spacing') return false;
            if (category === 'background') return false;
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

        {/* Fill (Figma-style, replaces background) */}
        {!isInstance && <FillPanel node={selectedNode} />}

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

// ── Shared styles (consistent with Position / Layout panels) ─

const mutedStyle: React.CSSProperties = { color: 'var(--penma-text-muted)' };

const inputBgStyle: React.CSSProperties = {
  background: 'var(--penma-hover-bg)',
  color: 'var(--penma-text)',
  border: 'none',
  borderRadius: 6,
};

// ── Inline SVG icons ─────────────────────────────────────────

const ChevronDownIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4.5L6 7.5L9 4.5" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 3L7.5 6L4.5 9" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="7" y1="3" x2="7" y2="11" />
    <line x1="3" y1="7" x2="11" y2="7" />
  </svg>
);

const MinusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <line x1="3" y1="7" x2="11" y2="7" />
  </svg>
);

const EyeIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z" />
    <circle cx="7" cy="7" r="1.5" />
  </svg>
);

const EyeOffIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2l10 10" />
    <path d="M5.6 5.6a1.5 1.5 0 002.8 2.8" />
    <path d="M3.5 5.5C2.3 6.3 1.5 7 1.5 7s2.2 3.5 5.5 3.5c.8 0 1.6-.2 2.3-.5" />
    <path d="M10.5 8.5c1.2-.8 2-1.5 2-1.5s-2.2-3.5-5.5-3.5c-.3 0-.6 0-.9.1" />
  </svg>
);

const IndividualSidesIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="2" y1="7" x2="5" y2="7" />
    <line x1="9" y1="7" x2="12" y2="7" />
    <rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.2" />
  </svg>
);

// ── Small icon button (28×28, hover via JS) ──────────────────

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

// ── Fill panel (Figma-style, multiple fills with opacity) ───

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}

/** Build a checkerboard + color swatch for the fill preview */
function fillSwatchStyle(hex: string, opacity: number): React.CSSProperties {
  if (opacity >= 100) return { backgroundColor: hex };
  return {
    backgroundImage: `linear-gradient(${hexToRgba(hex, opacity)}, ${hexToRgba(hex, opacity)}), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)`,
    backgroundSize: '100% 100%, 6px 6px',
  };
}

/** Parse any CSS color string into a PenmaFill array.
 *  Handles rgb(), rgba(), color(srgb ...), and #hex */
function parseCssColorToFills(raw: string | undefined): PenmaFill[] {
  if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'none') return [];

  // rgb(r, g, b) / rgba(r, g, b, a)
  const rgbaMatch = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    if (a < 0.01) return [];
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return [{ id: crypto.randomUUID(), color: hex, opacity: Math.round(a * 100), visible: true }];
  }

  // color(srgb r g b) / color(srgb r g b / a) — modern Chrome computed style format
  const srgbMatch = raw.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255);
    const g = Math.round(parseFloat(srgbMatch[2]) * 255);
    const b = Math.round(parseFloat(srgbMatch[3]) * 255);
    const a = srgbMatch[4] !== undefined ? parseFloat(srgbMatch[4]) : 1;
    if (a < 0.01) return [];
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return [{ id: crypto.randomUUID(), color: hex, opacity: Math.round(a * 100), visible: true }];
  }

  // #hex
  if (raw.startsWith('#') && raw.length >= 7) {
    return [{ id: crypto.randomUUID(), color: raw.slice(0, 7), opacity: 100, visible: true }];
  }

  return [];
}

/** Migrate fills from CSS: div → background-color, span text → color */
function migrateFillsFromCss(node: PenmaNode): PenmaFill[] {
  const styles = { ...node.styles.computed, ...node.styles.overrides };
  const isTextElement = node.tagName === 'span'
    && !!node.textContent
    && node.children.length === 0;

  if (isTextElement) {
    const fromColor = parseCssColorToFills(styles['color']);
    if (fromColor.length > 0) return fromColor;
    return parseCssColorToFills(styles['background-color']);
  }
  return parseCssColorToFills(styles['background-color']);
}

const FillPanel: React.FC<{ node: PenmaNode }> = ({ node }) => {
  const updateNodeFills = useEditorStore((s) => s.updateNodeFills);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const [expanded, setExpanded] = useState(true);

  const fills: PenmaFill[] = node.fills ?? migrateFillsFromCss(node);

  const update = useCallback((newFills: PenmaFill[]) => {
    pushHistory('Change fill');
    updateNodeFills(node.id, newFills);
  }, [node.id, updateNodeFills, pushHistory]);

  const addFill = useCallback(() => {
    update([...fills, { id: crypto.randomUUID(), color: '#000000', opacity: 100, visible: true }]);
  }, [fills, update]);

  const removeFill = useCallback((id: string) => {
    update(fills.filter((f) => f.id !== id));
  }, [fills, update]);

  const updateFill = useCallback((id: string, patch: Partial<PenmaFill>) => {
    update(fills.map((f) => f.id === id ? { ...f, ...patch } : f));
  }, [fills, update]);

  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* Header */}
      <div className="flex h-9 items-center justify-between px-4">
        <button
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span style={mutedStyle}>{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--penma-text)' }}>Fill</span>
        </button>
        <IconBtn onClick={addFill} title="Add fill"><PlusIcon /></IconBtn>
      </div>

      {expanded && fills.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {[...fills].reverse().map((fill) => (
            <div key={fill.id} className="flex items-center gap-1.5">
              {/* Color swatch */}
              <label
                className="relative h-[28px] w-[28px] shrink-0 cursor-pointer rounded-md overflow-hidden"
                style={{ border: '1px solid var(--penma-border)' }}
              >
                <div className="absolute inset-0" style={fillSwatchStyle(fill.color, fill.opacity)} />
                <input
                  type="color"
                  value={fill.color}
                  onChange={(e) => updateFill(fill.id, { color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              {/* Hex */}
              <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2" style={inputBgStyle}>
                <input
                  type="text"
                  value={fill.color.replace('#', '').toUpperCase()}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                    if (v.length === 6) updateFill(fill.id, { color: `#${v}` });
                  }}
                  className="w-full bg-transparent text-[12px] font-mono focus:outline-none"
                  style={{ color: 'var(--penma-text)' }}
                />
              </div>
              {/* Opacity */}
              <div className="flex w-[52px] min-w-[52px] h-[30px] items-center rounded-md px-2 gap-0.5" style={inputBgStyle}>
                <input
                  type="number"
                  value={fill.opacity}
                  onChange={(e) => updateFill(fill.id, { opacity: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                  min={0}
                  max={100}
                  className="w-full bg-transparent text-[12px] text-right focus:outline-none
                    [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{ color: 'var(--penma-text)' }}
                />
                <span className="text-[10px] shrink-0" style={mutedStyle}>%</span>
              </div>
              {/* Visibility toggle */}
              <IconBtn
                onClick={() => updateFill(fill.id, { visible: !fill.visible })}
                title={fill.visible ? 'Hide fill' : 'Show fill'}
              >
                {fill.visible ? <EyeIcon /> : <EyeOffIcon />}
              </IconBtn>
              {/* Remove */}
              <IconBtn onClick={() => removeFill(fill.id)} title="Remove fill"><MinusIcon /></IconBtn>
            </div>
          ))}
        </div>
      )}
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

  const btw = parseFloat(styles['border-top-width'] || '0') || 0;
  const brw = parseFloat(styles['border-right-width'] || '0') || 0;
  const bbw = parseFloat(styles['border-bottom-width'] || '0') || 0;
  const blw = parseFloat(styles['border-left-width'] || '0') || 0;
  const hasBorder = btw > 0 || brw > 0 || bbw > 0 || blw > 0;
  const uniformWeight = btw === brw && brw === bbw && bbw === blw;
  const weight = uniformWeight ? btw : Math.max(btw, brw, bbw, blw);

  const rawColor = styles['border-top-color'] || styles['border-right-color'] || styles['border-bottom-color'] || styles['border-left-color'] || '#E2E8F0';
  const hexColor = parseColorToHex(rawColor);

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
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      {/* Header */}
      <div className="flex h-9 items-center justify-between px-4">
        <button
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span style={mutedStyle}>{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--penma-text)' }}>Stroke</span>
        </button>
        <div className="flex items-center gap-0.5">
          <IconBtn
            onClick={() => setShowIndividual(!showIndividual)}
            title="Individual sides"
            active={showIndividual}
          >
            <IndividualSidesIcon />
          </IconBtn>
          <IconBtn
            onClick={hasBorder ? removeBorder : addBorder}
            title={hasBorder ? 'Remove stroke' : 'Add stroke'}
          >
            {hasBorder ? <MinusIcon /> : <PlusIcon />}
          </IconBtn>
        </div>
      </div>

      {expanded && hasBorder && (
        <div className="px-4 pb-3 flex flex-col gap-3">
          {/* Color + Hex + Opacity + Visibility */}
          <div className="flex items-center gap-1.5">
            <label
              className="relative h-[28px] w-[28px] shrink-0 cursor-pointer rounded-md overflow-hidden"
              style={{ border: '1px solid var(--penma-border)' }}
            >
              <div className="absolute inset-0" style={{ backgroundColor: hexColor }} />
              <input
                type="color"
                value={hexColor}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <div className="flex flex-1 min-w-0 h-[30px] items-center rounded-md px-2" style={inputBgStyle}>
              <input
                type="text"
                value={hexColor.replace('#', '').toUpperCase()}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                  if (v.length === 6) setColor(`#${v}`);
                }}
                className="w-full bg-transparent text-[12px] font-mono focus:outline-none"
                style={{ color: 'var(--penma-text)' }}
              />
            </div>
            <div className="flex w-[52px] min-w-[52px] h-[30px] items-center rounded-md px-2 gap-0.5" style={inputBgStyle}>
              <span className="text-[12px]" style={{ color: 'var(--penma-text)' }}>100</span>
              <span className="text-[10px] shrink-0" style={mutedStyle}>%</span>
            </div>
            <IconBtn
              onClick={toggleVisibility}
              title={isVisible ? 'Hide stroke' : 'Show stroke'}
            >
              {isVisible ? <EyeIcon /> : <EyeOffIcon />}
            </IconBtn>
          </div>

          {/* Position + Weight */}
          {!showIndividual && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <span className="block text-[11px] mb-1.5" style={mutedStyle}>Position</span>
                <div className="flex h-[30px] items-center rounded-md" style={inputBgStyle}>
                  <select
                    value="inside"
                    onChange={() => {}}
                    className="w-full h-full bg-transparent rounded-md px-2 text-[12px] focus:outline-none cursor-pointer appearance-none"
                    style={{ color: 'var(--penma-text)' }}
                  >
                    {STROKE_POSITIONS.map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                  <svg width="8" height="5" viewBox="0 0 8 5" className="mr-2 shrink-0 pointer-events-none" style={{ color: 'var(--penma-text-muted)', opacity: 0.6 }}>
                    <path d="M0.5 0.5L4 4L7.5 0.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <span className="block text-[11px] mb-1.5" style={mutedStyle}>Weight</span>
                <div className="flex h-[30px] items-center rounded-md px-2" style={inputBgStyle}>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full bg-transparent text-[12px] focus:outline-none
                      [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ color: 'var(--penma-text)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Individual side weights */}
          {showIndividual && (
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-1.5">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                const val = parseFloat(styles[`border-${side}-width`] || '0') || 0;
                return (
                  <div key={side} className="flex h-[30px] items-center rounded-md px-2 gap-1.5" style={inputBgStyle}>
                    <span className="text-[11px] font-medium shrink-0 select-none" style={mutedStyle}>
                      {side.charAt(0).toUpperCase()}
                    </span>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setWeight(parseInt(e.target.value) || 0, side)}
                      min={0}
                      max={100}
                      className="w-full bg-transparent text-[12px] focus:outline-none
                        [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      style={{ color: 'var(--penma-text)' }}
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
