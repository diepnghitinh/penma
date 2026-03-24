import type { StateCreator } from 'zustand';
import type { Tool, PanelId } from '@/types/editor';
import type { PenmaNode } from '@/types/document';
import { v4 as uuid } from 'uuid';
import { editorConfig } from '@/configs/editor';
import { findNodeById } from '@/lib/utils/tree-utils';
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
  clipboard: PenmaNode[];
  copyNodes: () => void;
  cutNodes: () => void;
  pasteNodes: () => void;
}

export const createUISlice: StateCreator<
  EditorState,
  [],
  [],
  UISlice
> = (set, get) => ({
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

  clipboard: [],

  copyNodes: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    const copied: PenmaNode[] = [];
    for (const id of state.selectedIds) {
      for (const doc of state.documents) {
        const node = findNodeById(doc.rootNode, id);
        if (node) {
          copied.push(JSON.parse(JSON.stringify(node)));
          break;
        }
      }
    }
    set({ clipboard: copied });
  },

  cutNodes: () => {
    const state = get();
    if (state.selectedIds.length === 0) return;
    // Copy first
    const copied: PenmaNode[] = [];
    for (const id of state.selectedIds) {
      for (const doc of state.documents) {
        const node = findNodeById(doc.rootNode, id);
        if (node) {
          copied.push(JSON.parse(JSON.stringify(node)));
          break;
        }
      }
    }
    set({ clipboard: copied });
    // Then delete
    state.pushHistory('Cut');
    state.deleteNodes(state.selectedIds);
  },

  pasteNodes: () => {
    const state = get();
    if (state.clipboard.length === 0) return;
    state.pushHistory('Paste');
    const newIds: string[] = [];
    for (const node of state.clipboard) {
      const cloned = cloneWithNewIds(node);
      // Offset position so paste is visible
      const left = parseFloat(cloned.styles.overrides['left'] || cloned.styles.computed['left'] || '0') || 0;
      const top = parseFloat(cloned.styles.overrides['top'] || cloned.styles.computed['top'] || '0') || 0;
      cloned.styles.overrides['position'] = 'relative';
      cloned.styles.overrides['left'] = `${left + 20}px`;
      cloned.styles.overrides['top'] = `${top + 20}px`;
      state.addNodeToActiveDocument(cloned);
      newIds.push(cloned.id);
    }
    set({ selectedIds: newIds });
  },
});

/** Deep clone a node tree with all children, assigning new UUIDs to every node.
 *  If the source is a master component, the clone becomes a component reference. */
function cloneWithNewIds(node: PenmaNode): PenmaNode {
  const deep: PenmaNode = JSON.parse(JSON.stringify(node));
  const masterCompId = deep.componentId; // save before clearing
  const assignIds = (n: PenmaNode, isRoot: boolean) => {
    if (n.sourceNodeId === undefined) n.sourceNodeId = n.id;
    n.id = uuid();
    n.componentRef = undefined;
    n.componentId = undefined;
    n.instanceOverrides = undefined;
    for (const child of n.children) assignIds(child, false);
    // If root was a master component, make the clone a reference to it
    if (isRoot && masterCompId) {
      n.componentRef = masterCompId;
    }
  };
  assignIds(deep, true);
  return deep;
}
