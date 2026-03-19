'use client';

import React, { useEffect } from 'react';
// @ts-expect-error tinykeys types not resolved via exports
import { tinykeys } from 'tinykeys';
import { useEditorStore } from '@/store/editor-store';
import { TopToolbar } from '@/components/toolbar/TopToolbar';
import { Canvas } from '@/components/canvas/Canvas';
import { LayerPanel } from '@/components/panels/LayerPanel';
import { StylePanel } from '@/components/panels/StylePanel';
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
        if (state.showImportDialog) {
          state.setShowImportDialog(false);
        } else if (state.showExportDialog) {
          state.setShowExportDialog(false);
        } else {
          state.clearSelection();
        }
      },
      'Delete': () => {},
      'Backspace': () => {},
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

        {/* Right panel: Styles — resizable */}
        {showStyles && (
          <ResizablePanel side="right" defaultWidth={288} minWidth={240} maxWidth={480}>
            <StylePanel />
          </ResizablePanel>
        )}
      </div>

      {/* Dialogs */}
      <ImportUrlDialog />
    </div>
  );
};
