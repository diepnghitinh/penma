'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { VIEWPORT_PRESET_GROUPS, VIEWPORT_PRESETS } from '@/types/editor';

export const DocumentSizePanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const updateDocumentViewport = useEditorStore((s) => s.updateDocumentViewport);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const activeDoc = documents.find((d) => d.id === activeDocumentId) ?? documents[0];

  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Sync inputs when active document changes
  useEffect(() => {
    if (activeDoc) {
      setWidth(String(activeDoc.viewport.width));
      setHeight(String(activeDoc.viewport.height));
    }
  }, [activeDoc?.id, activeDoc?.viewport.width, activeDoc?.viewport.height]);

  // Close preset dropdown on outside click
  useEffect(() => {
    if (!showPresets) return;
    const handleClick = (e: MouseEvent) => {
      if (
        presetsRef.current && !presetsRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPresets]);

  const commitSize = useCallback(() => {
    if (!activeDoc) return;
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return;
    if (w === activeDoc.viewport.width && h === activeDoc.viewport.height) return;
    pushHistory('Resize document');
    updateDocumentViewport(activeDoc.id, { width: w, height: h });
  }, [activeDoc, width, height, pushHistory, updateDocumentViewport]);

  const applyPreset = useCallback((pw: number, ph: number) => {
    if (!activeDoc) return;
    pushHistory('Resize document');
    updateDocumentViewport(activeDoc.id, { width: pw, height: ph });
    setShowPresets(false);
  }, [activeDoc, pushHistory, updateDocumentViewport]);

  if (!activeDoc) return null;

  // Find matching preset name
  const matchedPreset = VIEWPORT_PRESETS.find(
    (p) => p.width === activeDoc.viewport.width && p.height === activeDoc.viewport.height
  );

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* Preset selector button */}
      <div className="relative">
        <button
          ref={btnRef}
          onClick={() => setShowPresets((v) => !v)}
          className="flex w-full h-[30px] items-center justify-between rounded-md px-2 text-[12px] cursor-pointer"
          style={{
            background: 'var(--penma-hover-bg)',
            color: 'var(--penma-text)',
            border: 'none',
          }}
        >
          <span>{matchedPreset?.name ?? 'Custom'}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--penma-text-muted)' }}>
            <path d="M1 1L5 5L9 1" />
          </svg>
        </button>

        {/* Preset dropdown */}
        {showPresets && (
          <div
            ref={presetsRef}
            className="absolute left-0 right-0 top-full mt-1 rounded-lg shadow-lg border overflow-y-auto"
            style={{
              background: 'var(--penma-surface)',
              borderColor: 'var(--penma-border)',
              zIndex: 50,
              maxHeight: 420,
            }}
          >
            {VIEWPORT_PRESET_GROUPS.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <div style={{ borderTop: '1px solid var(--penma-border)' }} />}
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)' }}>
                    {group.label}
                  </span>
                </div>
                {group.presets.map((preset) => {
                  const isActive = matchedPreset?.name === preset.name
                    && activeDoc.viewport.width === preset.width
                    && activeDoc.viewport.height === preset.height;
                  return (
                    <button
                      key={`${preset.name}-${preset.width}`}
                      onClick={() => applyPreset(preset.width, preset.height)}
                      className="flex w-full items-center px-3 py-1.5 text-[11px] cursor-pointer text-left"
                      style={{
                        color: isActive ? 'var(--penma-primary)' : 'var(--penma-text)',
                        fontWeight: isActive ? 600 : 400,
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="flex-1 truncate">{preset.name}</span>
                      <span className="ml-3 font-mono text-[10px] shrink-0" style={{ color: 'var(--penma-text-muted)' }}>
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

      {/* Size inputs */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-[10px] mb-1" style={{ color: 'var(--penma-text-muted)' }}>W</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSize(); }}
            min={100}
            className="w-full h-[30px] rounded-md px-2 text-[12px] focus:outline-none
              [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-text)', border: 'none' }}
          />
        </div>
        <span className="text-[11px] mt-4" style={{ color: 'var(--penma-text-muted)' }}>×</span>
        <div className="flex-1">
          <label className="block text-[10px] mb-1" style={{ color: 'var(--penma-text-muted)' }}>H</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSize(); }}
            min={100}
            className="w-full h-[30px] rounded-md px-2 text-[12px] focus:outline-none
              [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-text)', border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};
