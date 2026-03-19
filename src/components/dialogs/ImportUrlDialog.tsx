'use client';

import React, { useState, useCallback } from 'react';
import { X, Globe, Loader2, Monitor, MonitorUp, Laptop, Tablet, Smartphone } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { FetchUrlResponse } from '@/types/api';

const SCREEN_PRESETS = [
  { label: 'Full HD+', width: 1920, height: 1200, icon: MonitorUp },
  { label: 'Desktop', width: 1440, height: 900, icon: Monitor },
  { label: 'Laptop', width: 1024, height: 768, icon: Laptop },
  { label: 'Tablet', width: 768, height: 1024, icon: Tablet },
  { label: 'Mobile', width: 375, height: 812, icon: Smartphone },
] as const;

const EXAMPLE_URLS = [
  { label: 'Example.com', url: 'https://example.com' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com' },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
];

export const ImportUrlDialog: React.FC = () => {
  const showImportDialog = useEditorStore((s) => s.showImportDialog);
  const setShowImportDialog = useEditorStore((s) => s.setShowImportDialog);
  const setDocument = useEditorStore((s) => s.setDocument);
  const isImporting = useEditorStore((s) => s.isImporting);
  const setImporting = useEditorStore((s) => s.setImporting);
  const importError = useEditorStore((s) => s.importError);
  const setImportError = useEditorStore((s) => s.setImportError);

  const [url, setUrl] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0); // Desktop
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const getViewport = useCallback(() => {
    if (useCustom) {
      return {
        width: parseInt(customWidth) || 1440,
        height: parseInt(customHeight) || 900,
      };
    }
    const preset = SCREEN_PRESETS[selectedPreset];
    return { width: preset.width, height: preset.height };
  }, [useCustom, customWidth, customHeight, selectedPreset]);

  const handleImport = useCallback(async (targetUrl?: string) => {
    const importUrl = targetUrl || url;
    if (!importUrl.trim()) return;

    let finalUrl = importUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    setImporting(true);
    setImportError(null);

    try {
      const viewport = getViewport();
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl, viewport }),
      });

      const data: FetchUrlResponse = await response.json();

      if (data.success && data.document) {
        setDocument(data.document);
        setShowImportDialog(false);
        setUrl('');
      } else {
        setImportError(data.error || 'Failed to import page');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Network error');
    }
  }, [url, setDocument, setImporting, setImportError, setShowImportDialog, getViewport]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isImporting) {
        handleImport();
      }
    },
    [handleImport, isImporting]
  );

  if (!showImportDialog) return null;

  const viewport = getViewport();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-neutral-800">Import from URL</h2>
          </div>
          <button
            onClick={() => setShowImportDialog(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* URL input */}
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter website URL (e.g., example.com)"
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoFocus
              disabled={isImporting}
            />
            <button
              onClick={() => handleImport()}
              disabled={isImporting || !url.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </button>
          </div>

          {/* Screen size selector */}
          <div className="mt-4">
            <p className="text-xs text-neutral-400 mb-2">Screen size:</p>
            <div className="flex gap-2">
              {SCREEN_PRESETS.map((preset, i) => {
                const Icon = preset.icon;
                const active = !useCustom && selectedPreset === i;
                return (
                  <button
                    key={preset.label}
                    onClick={() => { setSelectedPreset(i); setUseCustom(false); }}
                    disabled={isImporting}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors
                      ${active
                        ? 'border-blue-300 bg-blue-50 text-blue-600'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50'
                      } disabled:opacity-50`}
                  >
                    <Icon size={18} />
                    <span className="text-[10px] font-medium">{preset.label}</span>
                    <span className="text-[9px] text-neutral-400">{preset.width}×{preset.height}</span>
                  </button>
                );
              })}

              {/* Custom option */}
              <button
                onClick={() => setUseCustom(true)}
                disabled={isImporting}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors
                  ${useCustom
                    ? 'border-blue-300 bg-blue-50 text-blue-600'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50'
                  } disabled:opacity-50`}
              >
                <span className="text-sm font-medium">⊞</span>
                <span className="text-[10px] font-medium">Custom</span>
                <span className="text-[9px] text-neutral-400">any size</span>
              </button>
            </div>

            {/* Custom size inputs */}
            {useCustom && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder="1440"
                  min={320}
                  max={3840}
                  className="w-24 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 focus:border-blue-300 focus:outline-none
                             [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  disabled={isImporting}
                />
                <span className="text-xs text-neutral-400">×</span>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder="900"
                  min={320}
                  max={3840}
                  className="w-24 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 focus:border-blue-300 focus:outline-none
                             [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  disabled={isImporting}
                />
                <span className="text-xs text-neutral-400">px</span>
              </div>
            )}
          </div>

          {/* Error */}
          {importError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
              {importError}
            </div>
          )}

          {/* Loading state info */}
          {isImporting && (
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm text-blue-600">
              Importing at {viewport.width}×{viewport.height}... This may take 10-20 seconds.
            </div>
          )}

          {/* Example URLs */}
          <div className="mt-4">
            <p className="text-xs text-neutral-400 mb-2">Try an example:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_URLS.map(({ label, url: exampleUrl }) => (
                <button
                  key={exampleUrl}
                  onClick={() => {
                    setUrl(exampleUrl);
                    handleImport(exampleUrl);
                  }}
                  disabled={isImporting}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-50 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
