'use client';

import React, { useEffect } from 'react';
// @ts-expect-error tinykeys types not resolved via exports
import { tinykeys } from 'tinykeys';
import { useEditorStore } from '@/store/editor-store';
import { TopToolbar } from '@/components/toolbar/TopToolbar';
import { Canvas } from '@/components/canvas/Canvas';
import { LayerPanel } from '@/components/panels/LayerPanel';
import { StylePanel } from '@/components/panels/StylePanel';
import { DesignSystemPanel } from '@/components/panels/DesignSystemPanel';
import { ImportUrlDialog } from '@/components/dialogs/ImportUrlDialog';
import { ResizablePanel } from '@/components/ui/ResizablePanel';

export const EditorShell: React.FC = () => {
  const openPanels = useEditorStore((s) => s.openPanels);

  // Global keyboard shortcuts
  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      'v': () => useEditorStore.getState().setActiveTool('select'),
      'h': () => useEditorStore.getState().setActiveTool('hand'),
      't': () => useEditorStore.getState().setActiveTool('text'),
      '$mod+z': (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().undo();
      },
      '$mod+Shift+z': (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().redo();
      },
      '$mod+i': (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().setShowImportDialog(true);
      },
      'Escape': () => {
        const state = useEditorStore.getState();
        if (state.showImportDialog && !state.isImporting) {
          state.setShowImportDialog(false);
        } else if (state.showExportDialog) {
          state.setShowExportDialog(false);
        } else {
          state.clearSelection();
        }
      },
      'Delete': () => {
        const state = useEditorStore.getState();
        if (state.selectedIds.length === 0 && state.activeDocumentId && state.documents.length > 0) {
          state.pushHistory('Delete frame');
          state.removeDocument(state.activeDocumentId);
        }
      },
      'Backspace': () => {
        const state = useEditorStore.getState();
        if (state.selectedIds.length === 0 && state.activeDocumentId && state.documents.length > 0) {
          state.pushHistory('Delete frame');
          state.removeDocument(state.activeDocumentId);
        }
      },
      '$mod+0': (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().resetView();
      },
      '$mod+Equal': (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().zoomIn();
      },
      '$mod+Minus': (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().zoomOut();
      },
    });

    return unsubscribe;
  }, []);

  const showLayers = openPanels.includes('layers');
  const showStyles = openPanels.includes('styles');
  const showDesignSystem = openPanels.includes('design-system');

  return (
    <div className="penma-editor flex h-screen flex-col select-none" style={{ background: 'var(--penma-bg)' }}>
      <TopToolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Layers — resizable */}
        {showLayers && (
          <ResizablePanel side="left" defaultWidth={240} minWidth={180} maxWidth={400}>
            <LayerPanel />
          </ResizablePanel>
        )}

        {/* Center: Canvas */}
        <Canvas />

        {/* Right panels */}
        {(showStyles || showDesignSystem) && (
          <ResizablePanel side="right" defaultWidth={288} minWidth={240} maxWidth={480}>
            {showStyles && showDesignSystem ? (
              <RightPanelTabs />
            ) : showDesignSystem ? (
              <DesignSystemPanel />
            ) : (
              <StylePanel />
            )}
          </ResizablePanel>
        )}
      </div>

      {/* Dialogs */}
      <ImportUrlDialog />
    </div>
  );
};

// ── Right panel tabs (Style + Design System) ────────────────

const RightPanelTabs: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'styles' | 'design-system'>('styles');

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 flex-shrink-0" style={{ borderBottom: '1px solid var(--penma-border)' }}>
        {(['styles', 'design-system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wider cursor-pointer"
            style={{
              fontFamily: 'var(--font-heading)',
              color: activeTab === tab ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--penma-primary)' : '2px solid transparent',
              transition: 'var(--transition-base)',
            }}
          >
            {tab === 'styles' ? 'Design' : 'System'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'styles' ? <StylePanel /> : <DesignSystemPanel />}
      </div>
    </div>
  );
};
