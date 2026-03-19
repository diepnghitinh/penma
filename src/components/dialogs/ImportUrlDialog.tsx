'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Globe, Loader2, Monitor, MonitorUp, Laptop, Tablet, Smartphone, Check } from 'lucide-react';
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

          {/* Loading progress */}
          {isImporting && (
            <ImportProgress viewport={viewport} />
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

// ── Animated import progress ────────────────────────────────

const IMPORT_STEPS = [
  { label: 'Launching browser', duration: 2000 },
  { label: 'Navigating to page', duration: 3000 },
  { label: 'Waiting for content to render', duration: 5000 },
  { label: 'Extracting DOM structure', duration: 3000 },
  { label: 'Capturing styles & assets', duration: 3000 },
  { label: 'Building design tree', duration: 2000 },
];

const ImportProgress: React.FC<{ viewport: { width: number; height: number } }> = ({ viewport }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const total = now - startTime.current;
      setElapsed(total);

      // Advance steps based on cumulative duration
      let cumulative = 0;
      for (let i = 0; i < IMPORT_STEPS.length; i++) {
        cumulative += IMPORT_STEPS[i].duration;
        if (total < cumulative) {
          setCurrentStep(i);
          return;
        }
      }
      setCurrentStep(IMPORT_STEPS.length - 1);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const totalEstimate = IMPORT_STEPS.reduce((s, step) => s + step.duration, 0);
  const progress = Math.min((elapsed / totalEstimate) * 100, 95); // Never hit 100 until actually done

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}>
      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: 'var(--penma-hover-bg)' }}>
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: 'var(--penma-primary)',
            transition: 'width 400ms ease',
          }}
        />
      </div>

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--penma-text)' }}>
            Importing at {viewport.width}×{viewport.height}
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
            {Math.round(elapsed / 1000)}s
          </span>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-1.5">
          {IMPORT_STEPS.map((step, i) => {
            const isDone = i < currentStep;
            const isActive = i === currentStep;
            return (
              <div key={i} className="flex items-center gap-2">
                {/* Icon */}
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {isDone ? (
                    <Check size={12} style={{ color: 'var(--penma-primary)' }} />
                  ) : isActive ? (
                    <Loader2 size={12} className="animate-spin" style={{ color: 'var(--penma-primary)' }} />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--penma-border)' }} />
                  )}
                </div>
                {/* Label */}
                <span
                  className="text-[11px]"
                  style={{
                    color: isDone ? 'var(--penma-text-muted)' : isActive ? 'var(--penma-text)' : 'var(--penma-border-strong)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
