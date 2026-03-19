import type { StateCreator } from 'zustand';
import { produce } from 'immer';
import type { PenmaDocument, PenmaNode, AutoLayout, SizingMode } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';
import { updateNodeById } from '@/lib/utils/tree-utils';
import type { EditorState } from '../editor-store';

export interface DocumentSlice {
  document: PenmaDocument | null;
  isImporting: boolean;
  importError: string | null;
  setDocument: (doc: PenmaDocument) => void;
  clearDocument: () => void;
  setImporting: (importing: boolean) => void;
  setImportError: (error: string | null) => void;
  updateNodeStyles: (nodeId: string, overrides: Record<string, string>) => void;
  updateNodeText: (nodeId: string, text: string) => void;
  toggleNodeVisibility: (nodeId: string) => void;
  toggleNodeLock: (nodeId: string) => void;
  renameNode: (nodeId: string, name: string) => void;
  updateNodeBounds: (nodeId: string, bounds: Partial<PenmaNode['bounds']>) => void;
  toggleAutoLayout: (nodeId: string) => void;
  updateAutoLayout: (nodeId: string, patch: Partial<AutoLayout>) => void;
  updateAutoLayoutPadding: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', value: number) => void;
  setUniformPadding: (nodeId: string, value: number) => void;
  updateSizing: (nodeId: string, axis: 'horizontal' | 'vertical', mode: 'fixed' | 'hug' | 'fill') => void;
}

export const createDocumentSlice: StateCreator<
  EditorState,
  [],
  [],
  DocumentSlice
> = (set) => ({
  document: null,
  isImporting: false,
  importError: null,

  setDocument: (doc) =>
    set({ document: doc, isImporting: false, importError: null }),

  clearDocument: () =>
    set({ document: null }),

  setImporting: (importing) =>
    set({ isImporting: importing, importError: null }),

  setImportError: (error) =>
    set({ importError: error, isImporting: false }),

  updateNodeStyles: (nodeId, overrides) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          Object.assign(node.styles.overrides, overrides);
        });
      });
      return { document: newDoc };
    }),

  updateNodeText: (nodeId, text) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          node.textContent = text;
        });
      });
      return { document: newDoc };
    }),

  toggleNodeVisibility: (nodeId) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          node.visible = !node.visible;
        });
      });
      return { document: newDoc };
    }),

  toggleNodeLock: (nodeId) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          node.locked = !node.locked;
        });
      });
      return { document: newDoc };
    }),

  renameNode: (nodeId, name) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          node.name = name;
        });
      });
      return { document: newDoc };
    }),

  updateNodeBounds: (nodeId, bounds) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          Object.assign(node.bounds, bounds);
        });
      });
      return { document: newDoc };
    }),

  toggleAutoLayout: (nodeId) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (node.autoLayout) {
            // Remove auto layout from parent and sizing from children
            node.autoLayout = undefined;
            node.sizing = undefined;
            for (const child of node.children) {
              child.sizing = undefined;
            }
          } else {
            // Detect existing layout from computed styles
            const display = node.styles.computed['display'] || '';
            const flexDir = node.styles.computed['flex-direction'] || '';
            const gap = parseFloat(node.styles.computed['gap'] || '0') || 0;
            const pt = parseFloat(node.styles.computed['padding-top'] || '0') || 0;
            const pr = parseFloat(node.styles.computed['padding-right'] || '0') || 0;
            const pb = parseFloat(node.styles.computed['padding-bottom'] || '0') || 0;
            const pl = parseFloat(node.styles.computed['padding-left'] || '0') || 0;
            const justify = node.styles.computed['justify-content'] || '';
            const align = node.styles.computed['align-items'] || '';
            const wrap = node.styles.computed['flex-wrap'] || '';

            let direction: 'horizontal' | 'vertical' | 'wrap' = 'vertical';
            if (display === 'flex' || display === 'inline-flex') {
              if (wrap === 'wrap') direction = 'wrap';
              else if (flexDir === 'row' || flexDir === 'row-reverse') direction = 'horizontal';
            }

            const mapJustify = (v: string) => {
              if (v === 'center') return 'center' as const;
              if (v === 'flex-end' || v === 'end') return 'end' as const;
              if (v === 'space-between') return 'space-between' as const;
              return 'start' as const;
            };
            const mapAlign = (v: string) => {
              if (v === 'center') return 'center' as const;
              if (v === 'flex-end' || v === 'end') return 'end' as const;
              if (v === 'stretch') return 'stretch' as const;
              if (v === 'baseline') return 'baseline' as const;
              return 'start' as const;
            };

            const padding = { top: pt, right: pr, bottom: pb, left: pl };
            const independentPadding = !(pt === pr && pr === pb && pb === pl);

            const autoLayout: AutoLayout = {
              ...DEFAULT_AUTO_LAYOUT,
              direction,
              gap,
              padding,
              independentPadding,
              primaryAxisAlign: mapJustify(justify),
              counterAxisAlign: mapAlign(align),
              reverse: flexDir === 'row-reverse' || flexDir === 'column-reverse',
            };
            node.autoLayout = autoLayout;
            node.sizing = { ...DEFAULT_SIZING };

            // Detect child sizing from their computed styles
            const isParentHoriz = direction === 'horizontal' || direction === 'wrap';
            for (const child of node.children) {
              const cs = child.styles.computed;
              const flexGrow = parseFloat(cs['flex-grow'] || '0') || 0;
              const alignSelf = cs['align-self'] || '';
              const w = cs['width'] || 'auto';
              const h = cs['height'] || 'auto';

              let hz: 'fixed' | 'hug' | 'fill' = 'hug';
              let vt: 'fixed' | 'hug' | 'fill' = 'hug';

              if (isParentHoriz) {
                if (flexGrow > 0 || w.includes('%')) hz = 'fill';
                else if (w !== 'auto') hz = 'fixed';
                if (alignSelf === 'stretch' || autoLayout.counterAxisAlign === 'stretch') vt = 'fill';
                else if (h !== 'auto' && !h.includes('%')) vt = 'fixed';
              } else {
                if (flexGrow > 0 || h.includes('%')) vt = 'fill';
                else if (h !== 'auto') vt = 'fixed';
                if (alignSelf === 'stretch' || autoLayout.counterAxisAlign === 'stretch') hz = 'fill';
                else if (w !== 'auto' && !w.includes('%')) hz = 'fixed';
              }

              child.sizing = { horizontal: hz, vertical: vt };
            }
          }
        });
      });
      return { document: newDoc };
    }),

  updateAutoLayout: (nodeId, patch) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (node.autoLayout) {
            Object.assign(node.autoLayout, patch);
          }
        });
      });
      return { document: newDoc };
    }),

  updateAutoLayoutPadding: (nodeId, side, value) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (node.autoLayout) {
            node.autoLayout.padding[side] = value;
          }
        });
      });
      return { document: newDoc };
    }),

  setUniformPadding: (nodeId, value) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (node.autoLayout) {
            node.autoLayout.padding = { top: value, right: value, bottom: value, left: value };
          }
        });
      });
      return { document: newDoc };
    }),

  updateSizing: (nodeId, axis, mode) =>
    set((state) => {
      if (!state.document) return state;
      const newDoc = produce(state.document, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (!node.sizing) node.sizing = { ...DEFAULT_SIZING };
          node.sizing[axis] = mode;
        });
      });
      return { document: newDoc };
    }),
});
