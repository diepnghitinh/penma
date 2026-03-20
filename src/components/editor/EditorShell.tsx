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
import { PageTabs } from '@/components/toolbar/PageTabs';
import { CanvasContextMenu } from '@/components/canvas/ContextMenu';

export const EditorShell: React.FC = () => {
  const openPanels = useEditorStore((s) => s.openPanels);

  // Global keyboard shortcuts
  useEffect(() => {
    /** Returns true when focus is inside a text-editable element */
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const unsubscribe = tinykeys(window, {
      'v': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('select'); },
      'h': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('hand'); },
      'f': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('frame'); },
      's': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('section'); },
      'r': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('rectangle'); },
      'l': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('line'); },
      'o': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('ellipse'); },
      'p': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('pen'); },
      't': () => { if (!isInputFocused()) useEditorStore.getState().setActiveTool('text'); },
      '$mod+z': (e: KeyboardEvent) => {
        if (isInputFocused()) return;
        e.preventDefault();
        useEditorStore.getState().undo();
      },
      '$mod+Shift+z': (e: KeyboardEvent) => {
        if (isInputFocused()) return;
        e.preventDefault();
        useEditorStore.getState().redo();
      },
      '$mod+c': (e: KeyboardEvent) => {
        if (isInputFocused()) return;
        e.preventDefault();
        useEditorStore.getState().copyNodes();
      },
      '$mod+x': (e: KeyboardEvent) => {
        if (isInputFocused()) return;
        e.preventDefault();
        useEditorStore.getState().cutNodes();
      },
      '$mod+v': (e: KeyboardEvent) => {
        if (isInputFocused()) return;
        e.preventDefault();
        useEditorStore.getState().pasteNodes();
      },
      '$mod+d': (e: KeyboardEvent) => {
        if (isInputFocused()) return;
        e.preventDefault();
        const state = useEditorStore.getState();
        state.copyNodes();
        state.pasteNodes();
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
        if (isInputFocused()) return;
        const state = useEditorStore.getState();
        if (state.selectedIds.length > 0) {
          state.pushHistory('Delete element');
          state.deleteNodes(state.selectedIds);
        } else if (state.activeDocumentId && state.documents.length > 0) {
          state.pushHistory('Delete frame');
          state.removeDocument(state.activeDocumentId);
        }
      },
      'Backspace': () => {
        if (isInputFocused()) return;
        const state = useEditorStore.getState();
        if (state.selectedIds.length > 0) {
          state.pushHistory('Delete element');
          state.deleteNodes(state.selectedIds);
        } else if (state.activeDocumentId && state.documents.length > 0) {
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
      'Shift+1': () => {
        if (isInputFocused()) return;
        const state = useEditorStore.getState();
        if (state.documents.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const d of state.documents) {
          minX = Math.min(minX, d.canvasX);
          minY = Math.min(minY, d.canvasY);
          maxX = Math.max(maxX, d.canvasX + d.viewport.width);
          maxY = Math.max(maxY, d.canvasY + d.viewport.height);
        }
        const canvas = document.querySelector('.penma-canvas');
        const vw = canvas?.clientWidth ?? window.innerWidth;
        const vh = canvas?.clientHeight ?? window.innerHeight;
        state.fitToScreen({ width: maxX - minX, height: maxY - minY }, { width: vw, height: vh });
      },
    });

    return unsubscribe;
  }, []);

  // Disable browser back/forward swipe gesture (macOS trackpad)
  useEffect(() => {
    // Push a dummy history entry so swipe-back doesn't leave the page
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Re-push to prevent navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Block horizontal overscroll that triggers back/forward
    const handleWheel = (e: WheelEvent) => {
      // Horizontal scroll at the edge of the page triggers navigation
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX < -30) {
        e.preventDefault();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const showLayers = openPanels.includes('layers');
  const showStyles = openPanels.includes('styles');
  const showDesignSystem = openPanels.includes('design-system');

  return (
    <div className="penma-editor flex h-screen flex-col select-none" style={{ background: 'var(--penma-bg)' }}>
      <TopToolbar />
      <PageTabs />

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
      <CanvasContextMenu />
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
