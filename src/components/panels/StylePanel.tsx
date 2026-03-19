'use client';

import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Paintbrush } from 'lucide-react';
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center px-3" style={{ borderBottom: '1px solid var(--penma-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
          Design
        </span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
          &lt;{selectedNode.tagName}&gt;
        </span>
      </div>

      {/* Node info */}
      <div className="border-b border-neutral-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-700">
            {selectedNode.name || selectedNode.tagName}
          </span>
        </div>
        {selectedNode.textContent && (
          <p className="mt-1 text-[11px] text-neutral-400 truncate">
            {selectedNode.textContent.slice(0, 50)}
          </p>
        )}
        <div className="mt-1 flex gap-3 text-[10px] text-neutral-400">
          <span>{Math.round(selectedNode.bounds.width)}w</span>
          <span>{Math.round(selectedNode.bounds.height)}h</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Auto Layout — Figma-style layout controls */}
        <AutoLayoutPanel node={selectedNode} />

        {Object.entries(STYLE_CATEGORIES).map(([category, properties]) => (
          <StyleSection
            key={category}
            title={category.charAt(0).toUpperCase() + category.slice(1)}
            properties={properties}
            node={selectedNode}
          />
        ))}

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
