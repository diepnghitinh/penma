'use client';

import React from 'react';
import {
  MousePointer2,
  Hand,
  Type,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Import,
  Download,
  PanelLeft,
  PanelRight,
  Palette,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { Tool } from '@/types/editor';

const tools: { id: Tool; icon: React.ElementType; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand', shortcut: 'H' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
];

export const TopToolbar: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const camera = useEditorStore((s) => s.camera);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetView = useEditorStore((s) => s.resetView);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const setShowImportDialog = useEditorStore((s) => s.setShowImportDialog);
  const setShowExportDialog = useEditorStore((s) => s.setShowExportDialog);
  const document = useEditorStore((s) => s.document);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const openPanels = useEditorStore((s) => s.openPanels);

  const Separator = () => <div className="mx-1.5 h-5 w-px" style={{ background: 'var(--penma-border)' }} />;

  return (
    <div
      className="flex items-center justify-between px-3"
      style={{
        height: 'var(--toolbar-h)',
        background: 'var(--penma-surface)',
        borderBottom: '1px solid var(--penma-border)',
        zIndex: 'var(--z-toolbar)',
      }}
    >
      {/* Left: Logo + Panels + Tools + History */}
      <div className="flex items-center gap-0.5">
        {/* Logo */}
        <div className="mr-2 flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'var(--penma-primary)' }}
          >
            <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-heading)' }}>P</span>
          </div>
          <span
            className="text-sm font-semibold hidden sm:inline"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--penma-text)' }}
          >
            Penma
          </span>
        </div>

        <Separator />

        {/* Panel toggles */}
        <button
          onClick={() => togglePanel('layers')}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
          style={{
            color: openPanels.includes('layers') ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: openPanels.includes('layers') ? 'var(--penma-primary-light)' : 'transparent',
            transition: 'var(--transition-base)',
          }}
          title="Toggle Layers Panel"
        >
          <PanelLeft size={16} />
        </button>
        <button
          onClick={() => togglePanel('styles')}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
          style={{
            color: openPanels.includes('styles') ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: openPanels.includes('styles') ? 'var(--penma-primary-light)' : 'transparent',
            transition: 'var(--transition-base)',
          }}
          title="Toggle Styles Panel"
        >
          <PanelRight size={16} />
        </button>
        <button
          onClick={() => togglePanel('design-system')}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
          style={{
            color: openPanels.includes('design-system') ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: openPanels.includes('design-system') ? 'var(--penma-primary-light)' : 'transparent',
            transition: 'var(--transition-base)',
          }}
          title="Toggle Design System"
        >
          <Palette size={16} />
        </button>

        <Separator />

        {/* Tools */}
        {tools.map(({ id, icon: Icon, label, shortcut }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
            style={{
              color: activeTool === id ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
              background: activeTool === id ? 'var(--penma-primary-light)' : 'transparent',
              transition: 'var(--transition-base)',
            }}
            title={`${label} (${shortcut})`}
          >
            <Icon size={18} />
          </button>
        ))}

        <Separator />

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer disabled:opacity-25 disabled:cursor-default"
          style={{ color: 'var(--penma-text-secondary)', transition: 'var(--transition-base)' }}
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer disabled:opacity-25 disabled:cursor-default"
          style={{ color: 'var(--penma-text-secondary)', transition: 'var(--transition-base)' }}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Center: Zoom controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => zoomOut()}
          className="flex h-7 w-7 items-center justify-center rounded cursor-pointer"
          style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-base)' }}
          title="Zoom Out (Cmd+-)"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={resetView}
          className="min-w-[52px] rounded px-2 py-1 text-xs font-medium cursor-pointer"
          style={{
            color: 'var(--penma-text-secondary)',
            fontFamily: 'var(--font-mono)',
            transition: 'var(--transition-base)',
          }}
          title="Reset Zoom (Cmd+0)"
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button
          onClick={() => zoomIn()}
          className="flex h-7 w-7 items-center justify-center rounded cursor-pointer"
          style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-base)' }}
          title="Zoom In (Cmd+=)"
        >
          <ZoomIn size={15} />
        </button>
      </div>

      {/* Right: Import/Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowImportDialog(true)}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium text-white cursor-pointer"
          style={{
            background: 'var(--penma-primary)',
            fontFamily: 'var(--font-body)',
            transition: 'var(--transition-base)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--penma-primary)')}
        >
          <Import size={14} />
          Import URL
        </button>
        {document && (
          <button
            onClick={() => setShowExportDialog(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium cursor-pointer"
            style={{
              border: '1px solid var(--penma-border)',
              color: 'var(--penma-text-secondary)',
              fontFamily: 'var(--font-body)',
              transition: 'var(--transition-base)',
            }}
          >
            <Download size={14} />
            Export
          </button>
        )}
      </div>
    </div>
  );
};
