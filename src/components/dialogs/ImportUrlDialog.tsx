'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Globe, Loader2, Monitor, MonitorUp, Laptop, Tablet, Smartphone, Check } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { FetchUrlResponse } from '@/types/api';
import { autoDetectComponents } from '@/lib/design-system/component-detector';

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
  const setImporting = useEditorStore((s) => s.setImporting);
  const importError = useEditorStore((s) => s.importError);
  const setImportError = useEditorStore((s) => s.setImportError);

  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStep, setImportStep] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
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

    setIsLoading(true);
    setImporting(true);
    setImportError(null);
    setImportProgress(0);
    setImportStep('Starting...');

    try {
      const viewport = getViewport();

      // Use SSE streaming for real progress
      const response = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl, viewport, stream: true }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        setImportError(data.error || `HTTP ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const docChunks: string[] = [];
      let totalChunks = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE messages are separated by double newlines
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const msg of messages) {
          const lines = msg.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventType === 'progress') {
              setImportProgress(data.percent);
              setImportStep(data.step);
            } else if (eventType === 'chunk') {
              // Reassemble document from chunks
              totalChunks = data.total;
              docChunks[data.index] = data.data;
              setImportStep(`Receiving data... ${data.index + 1}/${data.total}`);
            } else if (eventType === 'done') {
              setImportProgress(100);
              setImportStep('Done!');

              if (data.success && docChunks.length > 0) {
                // Reassemble and parse the document
                const fullJson = docChunks.join('');
                const doc = JSON.parse(fullJson);

                // Auto-detect design system components (buttons, cards, nav items, etc.)
                if (doc.rootNode) {
                  autoDetectComponents(doc.rootNode);
                }

                setDocument(doc);

                // Center camera on the new frame
                const store = useEditorStore.getState();
                const newDoc = store.documents.find((d: { id: string }) => d.id === doc.id);
                if (newDoc) {
                  const canvasEl = window.document.querySelector('.penma-editor');
                  const vw = canvasEl?.clientWidth || 1200;
                  const vh = canvasEl?.clientHeight || 800;
                  store.fitToScreen(
                    { width: newDoc.viewport.width, height: newDoc.viewport.height },
                    { width: vw, height: vh }
                  );
                }
              }

              setShowImportDialog(false);
              setUrl('');
              setIsLoading(false);
            } else if (eventType === 'error') {
              setImportError(data.error || 'Import failed');
            }
          } catch (parseErr) {
            // JSON parse error on a chunk — skip
            console.warn('SSE parse error:', parseErr);
          }
        }
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
      setImporting(false);
    }
  }, [url, setDocument, setImporting, setImportError, setShowImportDialog, getViewport]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        handleImport();
      }
    },
    [handleImport, isLoading]
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
          {!isLoading && (
            <button
              onClick={() => setShowImportDialog(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Loading progress — shown prominently at top when importing */}
          {isLoading && (
            <div className="mb-4">
              <ImportProgress viewport={viewport} percent={importProgress} step={importStep} />
            </div>
          )}

          {/* Form — disabled during import */}
          <div style={{ opacity: isLoading ? 0.4 : 1, pointerEvents: isLoading ? 'none' : 'auto', transition: 'opacity 200ms' }}>
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
              disabled={isLoading}
            />
            <button
              onClick={() => handleImport()}
              disabled={isLoading || !url.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
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
                    disabled={isLoading}
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
                disabled={isLoading}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
                <span className="text-xs text-neutral-400">px</span>
              </div>
            )}
          </div>

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
                  disabled={isLoading}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-50 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          </div>{/* end form wrapper */}

          {/* Error — shown outside the disabled wrapper */}
          {importError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
              {importError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Real-time import progress (driven by SSE from server) ───

const ImportProgress: React.FC<{
  viewport: { width: number; height: number };
  percent: number;
  step: string;
}> = ({ viewport, percent, step }) => {
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}>
      {/* Progress bar */}
      <div className="h-1.5 w-full" style={{ background: 'var(--penma-hover-bg)' }}>
        <div
          className="h-full"
          style={{
            width: `${percent}%`,
            background: percent >= 100 ? '#22C55E' : 'var(--penma-primary)',
            transition: 'width 400ms ease, background 300ms',
          }}
        />
      </div>

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--penma-text)' }}>
            Importing at {viewport.width}×{viewport.height}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold font-mono" style={{ color: 'var(--penma-primary)' }}>
              {percent}%
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
              {Math.round(elapsed / 1000)}s
            </span>
          </div>
        </div>

        {/* Current step */}
        <div className="flex items-center gap-2">
          {percent < 100 ? (
            <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: 'var(--penma-primary)' }} />
          ) : (
            <Check size={12} className="flex-shrink-0" style={{ color: '#22C55E' }} />
          )}
          <span
            className="text-[11px]"
            style={{
              color: percent >= 100 ? '#22C55E' : 'var(--penma-text)',
              fontWeight: 500,
            }}
          >
            {step}
          </span>
        </div>
      </div>
    </div>
  );
};
