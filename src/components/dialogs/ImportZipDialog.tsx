'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Archive, Loader2, Monitor, MonitorUp, Laptop, Tablet, Smartphone, Check, Upload } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { PenmaDocument } from '@/types/document';
import { autoDetectComponents } from '@/lib/design-system/component-detector';

const SCREEN_PRESETS = [
  { label: 'Full HD+', width: 1920, height: 1200, icon: MonitorUp },
  { label: 'Desktop', width: 1440, height: 900, icon: Monitor },
  { label: 'Laptop', width: 1024, height: 768, icon: Laptop },
  { label: 'Tablet', width: 768, height: 1024, icon: Tablet },
  { label: 'Mobile', width: 375, height: 812, icon: Smartphone },
] as const;

export const ImportZipDialog: React.FC = () => {
  const showImportZipDialog = useEditorStore((s) => s.showImportZipDialog);
  const setShowImportZipDialog = useEditorStore((s) => s.setShowImportZipDialog);
  const addDocuments = useEditorStore((s) => s.addDocuments);
  const setImporting = useEditorStore((s) => s.setImporting);
  const setImportError = useEditorStore((s) => s.setImportError);

  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStep, setImportStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(1); // Desktop default
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [autoComponents, setAutoComponents] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a .zip file');
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleImport = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setImporting(true);
    setError(null);
    setImportProgress(0);
    setImportStep('Uploading ZIP...');

    try {
      const viewport = getViewport();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('viewportWidth', String(viewport.width));
      formData.append('viewportHeight', String(viewport.height));

      const response = await fetch('/api/import-zip', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({ error: 'Network error' }));
        setError(data.error || `HTTP ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const docChunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
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
              docChunks[data.index] = data.data;
              setImportStep(`Receiving data... ${data.index + 1}/${data.total}`);
            } else if (eventType === 'done') {
              setImportProgress(100);
              setImportStep('Done!');

              if (data.success && docChunks.length > 0) {
                const fullJson = docChunks.join('');
                const docs: PenmaDocument[] = JSON.parse(fullJson);

                // Auto-detect components in each document
                if (autoComponents) {
                  for (const doc of docs) {
                    if (doc.rootNode) {
                      autoDetectComponents(doc.rootNode);
                    }
                  }
                }

                addDocuments(docs);

                // Fit camera to show all new frames
                const store = useEditorStore.getState();
                const canvasEl = window.document.querySelector('.penma-editor');
                const vw = canvasEl?.clientWidth || 1200;
                const vh = canvasEl?.clientHeight || 800;

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const d of store.documents) {
                  minX = Math.min(minX, d.canvasX);
                  minY = Math.min(minY, d.canvasY);
                  maxX = Math.max(maxX, d.canvasX + d.viewport.width);
                  maxY = Math.max(maxY, d.canvasY + d.viewport.height);
                }
                if (minX < Infinity) {
                  store.fitToScreen(
                    { width: maxX - minX, height: maxY - minY },
                    { width: vw, height: vh },
                  );
                }
              }

              setShowImportZipDialog(false);
              setFile(null);
              setIsLoading(false);
            } else if (eventType === 'error') {
              setError(data.error || 'Import failed');
            }
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
      setImporting(false);
    }
  }, [file, addDocuments, setImporting, setImportError, setShowImportZipDialog, getViewport, autoComponents]);

  if (!showImportZipDialog) return null;

  const viewport = getViewport();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      style={{ zIndex: 'var(--z-modal-overlay)' }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-violet-500" />
            <h2 className="text-base font-semibold text-neutral-800">Import from ZIP</h2>
          </div>
          {!isLoading && (
            <button
              onClick={() => setShowImportZipDialog(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Loading progress */}
          {isLoading && (
            <div className="mb-4">
              <ImportProgress viewport={viewport} percent={importProgress} step={importStep} />
            </div>
          )}

          {/* Form */}
          <div
            style={{
              opacity: isLoading ? 0.4 : 1,
              pointerEvents: isLoading ? 'none' : 'auto',
              transition: 'opacity 200ms',
            }}
          >
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
                isDragging
                  ? 'border-violet-400 bg-violet-50'
                  : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <>
                  <Archive size={24} className="text-green-500" />
                  <span className="text-sm font-medium text-neutral-700">{file.name}</span>
                  <span className="text-xs text-neutral-400">
                    {(file.size / 1024 / 1024).toFixed(1)} MB — Click to change
                  </span>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-neutral-400" />
                  <span className="text-sm text-neutral-500">
                    Drop a ZIP file here or click to browse
                  </span>
                  <span className="text-xs text-neutral-400">
                    ZIP containing .html files (max 100MB)
                  </span>
                </>
              )}
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
                      className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors
                        ${active
                          ? 'border-violet-300 bg-violet-50 text-violet-600'
                          : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50'
                        }`}
                    >
                      <Icon size={18} />
                      <span className="text-[10px] font-medium">{preset.label}</span>
                      <span className="text-[9px] text-neutral-400">
                        {preset.width}x{preset.height}
                      </span>
                    </button>
                  );
                })}

                <button
                  onClick={() => setUseCustom(true)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors
                    ${useCustom
                      ? 'border-violet-300 bg-violet-50 text-violet-600'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                >
                  <span className="text-sm font-medium">&#x229E;</span>
                  <span className="text-[10px] font-medium">Custom</span>
                  <span className="text-[9px] text-neutral-400">any size</span>
                </button>
              </div>

              {useCustom && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="1440"
                    min={320}
                    max={3840}
                    className="w-24 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 focus:border-violet-300 focus:outline-none
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-neutral-400">&times;</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="900"
                    min={320}
                    max={3840}
                    className="w-24 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 focus:border-violet-300 focus:outline-none
                               [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-neutral-400">px</span>
                </div>
              )}
            </div>

            {/* Auto-detect components */}
            <label className="mt-4 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoComponents}
                onChange={(e) => setAutoComponents(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-violet-500 focus:ring-violet-200 cursor-pointer accent-violet-500"
              />
              <div>
                <span className="text-xs font-medium text-neutral-700">
                  Auto-detect design system components
                </span>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Identifies buttons, cards, nav items across all imported pages
                </p>
              </div>
            </label>

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={!file || isLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Archive size={16} />
                  Import HTML from ZIP
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Progress component ────────────────────────────────────────

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
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}
    >
      <div className="h-1.5 w-full" style={{ background: 'var(--penma-hover-bg)' }}>
        <div
          className="h-full"
          style={{
            width: `${percent}%`,
            background: percent >= 100 ? '#22C55E' : '#8B5CF6',
            transition: 'width 400ms ease, background 300ms',
          }}
        />
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--penma-text)' }}>
            Importing at {viewport.width}&times;{viewport.height}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold font-mono"
              style={{ color: '#8B5CF6' }}
            >
              {percent}%
            </span>
            <span
              className="text-[10px] font-mono"
              style={{ color: 'var(--penma-text-muted)' }}
            >
              {Math.round(elapsed / 1000)}s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {percent < 100 ? (
            <Loader2
              size={12}
              className="animate-spin flex-shrink-0"
              style={{ color: '#8B5CF6' }}
            />
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
