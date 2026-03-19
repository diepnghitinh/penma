import type { StateCreator } from 'zustand';
import type { Tool, PanelId } from '@/types/editor';
import { editorConfig } from '@/configs/editor';
import type { EditorState } from '../editor-store';

export interface EditSettings {
  textEditable: boolean;
  resizable: boolean;
  movable: boolean;
}

export interface UISlice {
  activeTool: Tool;
  openPanels: PanelId[];
  showImportDialog: boolean;
  showExportDialog: boolean;
  isPanning: boolean;
  editEnabled: boolean;
  editSettings: EditSettings;
  setActiveTool: (tool: Tool) => void;
  togglePanel: (panel: PanelId) => void;
  setShowImportDialog: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
  setIsPanning: (panning: boolean) => void;
  setEditEnabled: (enabled: boolean) => void;
  toggleEditEnabled: () => void;
  setEditSetting: (key: keyof EditSettings, value: boolean) => void;
  toggleEditSetting: (key: keyof EditSettings) => void;
}

export const createUISlice: StateCreator<
  EditorState,
  [],
  [],
  UISlice
> = (set) => ({
  activeTool: 'select',
  openPanels: ['layers', 'styles'],
  showImportDialog: true,
  showExportDialog: false,
  isPanning: false,
  editEnabled: editorConfig.enabled,
  editSettings: {
    textEditable: editorConfig.textEditable,
    resizable: editorConfig.resizable,
    movable: editorConfig.movable,
  },

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

  setEditEnabled: (enabled) => set({ editEnabled: enabled }),
  toggleEditEnabled: () => set((state) => ({ editEnabled: !state.editEnabled })),

  setEditSetting: (key, value) =>
    set((state) => ({
      editSettings: { ...state.editSettings, [key]: value },
    })),

  toggleEditSetting: (key) =>
    set((state) => ({
      editSettings: { ...state.editSettings, [key]: !state.editSettings[key] },
    })),
});
