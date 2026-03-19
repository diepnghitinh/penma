import type { StateCreator } from 'zustand';
import type { Tool, PanelId } from '@/types/editor';
import type { EditorState } from '../editor-store';

export interface UISlice {
  activeTool: Tool;
  openPanels: PanelId[];
  showImportDialog: boolean;
  showExportDialog: boolean;
  isPanning: boolean;
  setActiveTool: (tool: Tool) => void;
  togglePanel: (panel: PanelId) => void;
  setShowImportDialog: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
  setIsPanning: (panning: boolean) => void;
}

export const createUISlice: StateCreator<
  EditorState,
  [],
  [],
  UISlice
> = (set) => ({
  activeTool: 'select',
  openPanels: ['layers', 'styles'],
  showImportDialog: true, // Show on initial load
  showExportDialog: false,
  isPanning: false,

  setActiveTool: (tool) => set({ activeTool: tool }),

  togglePanel: (panel) =>
    set((state) => ({
      openPanels: state.openPanels.includes(panel)
        ? state.openPanels.filter((p) => p !== panel)
        : [...state.openPanels, panel],
    })),

  setShowImportDialog: (show) => set({ showImportDialog: show }),
  setShowExportDialog: (show) => set({ showExportDialog: show }),
  setIsPanning: (panning) => set({ isPanning: panning }),
});
