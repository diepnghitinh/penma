'use client';

import React, { useState, useCallback } from 'react';
import {
  Download,
  FileJson,
  FileCode,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Frame,
  Component,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';
import { documentToFigmaJson, documentsToFigmaJson, nodeToFigmaJson } from '@/lib/export/figma-json';
import { nodeToHtml } from '@/lib/export/html-export';
import type { PenmaDocument, PenmaNode } from '@/types/document';

type ExportFormat = 'figma-json' | 'html' | 'penma-json';

const FORMATS: { id: ExportFormat; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'figma-json', label: 'Figma JSON', icon: FileJson, description: 'Figma-compatible node tree (.json)' },
  { id: 'html', label: 'HTML', icon: FileCode, description: 'HTML with inline styles (.html)' },
  { id: 'penma-json', label: 'Penma JSON', icon: FileJson, description: 'Full Penma document (.json)' },
];

export const ExportPanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);

  const [format, setFormat] = useState<ExportFormat>('figma-json');
  const [exportScope, setExportScope] = useState<'selection' | 'frame' | 'page' | 'all-pages'>('frame');
  const [selectedPageId, setSelectedPageId] = useState<string>(activePageId);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Determine what to export based on scope
  const exportTarget = useCallback((): { type: 'frame' | 'component' | 'page' | 'all-pages'; doc: PenmaDocument; node?: PenmaNode; docs?: PenmaDocument[] } | null => {
    if (exportScope === 'selection' && selectedIds.length > 0) {
      for (const doc of documents) {
        const node = findNodeById(doc.rootNode, selectedIds[0]);
        if (node) return { type: 'component', doc, node };
      }
    }
    if (exportScope === 'all-pages') {
      // Collect all documents from all pages
      const allDocs: PenmaDocument[] = [...documents];
      for (const page of pages) {
        if (page.id !== activePageId) {
          allDocs.push(...(page.documents || []));
        }
      }
      if (allDocs.length > 0) return { type: 'all-pages', doc: allDocs[0], docs: allDocs };
    }
    if (exportScope === 'page') {
      // Export all frames on selected page
      let pageDocs: PenmaDocument[];
      if (selectedPageId === activePageId) {
        pageDocs = documents;
      } else {
        const page = pages.find((p) => p.id === selectedPageId);
        pageDocs = page?.documents ?? [];
      }
      if (pageDocs.length > 0) return { type: 'page', doc: pageDocs[0], docs: pageDocs };
    }
    // Default: active frame
    const activeDoc = documents.find((d) => d.id === activeDocumentId) ?? documents[0];
    if (activeDoc) return { type: 'frame', doc: activeDoc };
    return null;
  }, [documents, pages, activePageId, selectedIds, activeDocumentId, exportScope, selectedPageId]);

  const target = exportTarget();

  // Find the design system frame among all documents (if any)
  const dsDoc = documents.find((d) => d.rootNode.attributes?.class === 'design-system-frame') ?? null;

  const generateExport = useCallback((): string => {
    if (!target) return '';
    const docs = target.docs ?? [target.doc];
    switch (format) {
      case 'figma-json':
        if (target.node && target.type === 'component') {
          return JSON.stringify(nodeToFigmaJson(target.node), null, 2);
        }
        {
          // Filter out the DS frame from regular docs to avoid duplication
          const frameDocs = docs.filter((d) => d.rootNode.attributes?.class !== 'design-system-frame');
          if (frameDocs.length === 0) {
            // Exporting only the DS frame itself
            return JSON.stringify(documentToFigmaJson(docs[0]), null, 2);
          }
          // Include design system components if the DS frame exists
          const exportDsDoc = dsDoc && !docs.includes(dsDoc) ? dsDoc : dsDoc ?? undefined;
          return JSON.stringify(documentsToFigmaJson(frameDocs, exportDsDoc), null, 2);
        }
      case 'html':
        if (target.node && target.type === 'component') return nodeToHtml(target.node);
        return docs.map((d) => nodeToHtml(d.rootNode)).join('\n\n');
      case 'penma-json':
        if (target.node && target.type === 'component') {
          return JSON.stringify(target.node, null, 2);
        }
        if (docs.length === 1) return JSON.stringify(docs[0], null, 2);
        return JSON.stringify(docs, null, 2);
      default:
        return '';
    }
  }, [target, format]);

  const handleCopy = useCallback(() => {
    const data = generateExport();
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [generateExport]);

  const handleDownload = useCallback(() => {
    const data = generateExport();
    const ext = format === 'html' ? 'html' : 'json';
    const mime = format === 'html' ? 'text/html' : 'application/json';
    let filename = 'export';
    if (target) {
      try { filename = new URL(target.doc.sourceUrl).hostname.replace(/\./g, '-'); } catch {}
      if (target.type === 'component' && target.node) {
        filename += `-${target.node.name || target.node.tagName}`;
      }
    }
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generateExport, format, target]);

  if (!target) {
    return (
      <div className="flex flex-col items-center justify-center p-4 gap-2" style={{ color: 'var(--penma-text-muted)' }}>
        <Download size={20} />
        <span className="text-xs text-center">Select a frame or element to export</span>
      </div>
    );
  }

  const preview = previewOpen ? generateExport() : '';

  return (
    <div className="flex flex-col gap-3">
      {/* Export scope selector */}
      <div>
        <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>Export scope</p>
        <div className="flex gap-1 flex-wrap">
          {selectedIds.length > 0 && (
            <ScopeButton label="Selection" active={exportScope === 'selection'} onClick={() => setExportScope('selection')} />
          )}
          <ScopeButton label="Frame" active={exportScope === 'frame'} onClick={() => setExportScope('frame')} />
          <ScopeButton label="Page" active={exportScope === 'page'} onClick={() => setExportScope('page')} />
          {pages.length > 1 && (
            <ScopeButton label="All Pages" active={exportScope === 'all-pages'} onClick={() => setExportScope('all-pages')} />
          )}
        </div>

        {/* Page selector when scope is "page" */}
        {exportScope === 'page' && pages.length > 1 && (
          <select
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className="mt-1.5 w-full rounded-md border px-2 py-1 text-[11px] outline-none cursor-pointer"
            style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)', color: 'var(--penma-text)' }}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Export target info */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--penma-hover-bg)' }}>
        {target.type === 'component' ? <Component size={14} style={{ color: 'var(--penma-cta)' }} /> : <Frame size={14} style={{ color: 'var(--penma-primary)' }} />}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium truncate" style={{ color: 'var(--penma-text)' }}>
            {target.type === 'component'
              ? target.node?.name || target.node?.tagName || 'Element'
              : target.type === 'all-pages'
                ? `All pages (${target.docs?.length ?? 0} frames)`
                : target.type === 'page'
                  ? `${pages.find((p) => p.id === selectedPageId)?.name ?? 'Page'} (${target.docs?.length ?? 0} frames)`
                  : (() => { try { return new URL(target.doc.sourceUrl).hostname; } catch { return 'Frame'; } })()}
          </div>
          <div className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>
            {target.type === 'component'
              ? `<${target.node?.tagName}>`
              : target.docs
                ? `${target.docs.length} frame${target.docs.length !== 1 ? 's' : ''}`
                : `${target.doc.viewport.width}×${target.doc.viewport.height}`}
          </div>
        </div>
      </div>

      {/* Format selector */}
      <div className="flex flex-col gap-1">
        {FORMATS.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            onClick={() => setFormat(id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-left"
            style={{
              background: format === id ? 'var(--penma-primary-light)' : 'transparent',
              border: format === id ? '1px solid var(--penma-primary)' : '1px solid transparent',
              transition: 'var(--transition-fast)',
            }}
          >
            <Icon size={14} style={{ color: format === id ? 'var(--penma-primary)' : 'var(--penma-text-muted)' }} />
            <div className="flex-1">
              <div className="text-[11px] font-medium" style={{ color: format === id ? 'var(--penma-primary)' : 'var(--penma-text)' }}>
                {label}
              </div>
              <div className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>{description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-white cursor-pointer"
          style={{ background: 'var(--penma-primary)', transition: 'var(--transition-base)' }}
        >
          <Download size={13} />
          Download
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
          style={{
            border: '1px solid var(--penma-border)',
            color: copied ? 'var(--penma-primary)' : 'var(--penma-text-secondary)',
            transition: 'var(--transition-base)',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setPreviewOpen(!previewOpen)}
        className="flex items-center gap-1 text-[10px] cursor-pointer"
        style={{ color: 'var(--penma-text-muted)' }}
      >
        {previewOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Preview output
      </button>
      {previewOpen && (
        <pre
          className="text-[9px] leading-tight overflow-auto rounded-lg p-2 max-h-48 penma-scrollbar font-mono"
          style={{
            background: 'var(--penma-hover-bg)',
            color: 'var(--penma-text-secondary)',
            border: '1px solid var(--penma-border)',
          }}
        >
          {preview.slice(0, 5000)}{preview.length > 5000 ? '\n...(truncated)' : ''}
        </pre>
      )}
    </div>
  );
};

const ScopeButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-md px-2.5 py-1 text-[10px] font-medium cursor-pointer"
    style={{
      background: active ? 'var(--penma-primary-light)' : 'transparent',
      color: active ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
      border: active ? '1px solid var(--penma-primary)' : '1px solid var(--penma-border)',
      transition: 'var(--transition-fast)',
    }}
  >
    {label}
  </button>
);
