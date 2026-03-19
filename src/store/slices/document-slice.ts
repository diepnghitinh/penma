import type { StateCreator } from 'zustand';
import { produce } from 'immer';
import type { PenmaDocument, PenmaNode, AutoLayout, SizingMode } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';
import { updateNodeById, findNodeById } from '@/lib/utils/tree-utils';
import type { EditorState } from '../editor-store';

export interface DocumentSlice {
  documents: PenmaDocument[];
  activeDocumentId: string | null;
  isImporting: boolean;
  importError: string | null;
  /** Backward-compat: returns the active document */
  document: PenmaDocument | null;
  addDocument: (doc: PenmaDocument) => void;
  removeDocument: (docId: string) => void;
  setActiveDocument: (docId: string) => void;
  /** Legacy — adds or replaces the single doc */
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

/**
 * Helper: apply a mutation to whichever document contains the given nodeId.
 * Returns the updated documents array.
 */
function mutateNodeInDocs(
  docs: PenmaDocument[],
  nodeId: string,
  mutator: (draft: PenmaDocument) => void
): PenmaDocument[] {
  return docs.map((doc) => {
    if (findNodeById(doc.rootNode, nodeId)) {
      return produce(doc, mutator);
    }
    return doc;
  });
}

const FRAME_GAP = 80; // px between frames on canvas

export const createDocumentSlice: StateCreator<
  EditorState,
  [],
  [],
  DocumentSlice
> = (set, get) => ({
  documents: [],
  activeDocumentId: null,
  isImporting: false,
  importError: null,

  // Backward-compat: computed on access but NOT reactive.
  // Components should use the selector: useEditorStore((s) => s.documents.find(...))
  // This field is only for non-reactive reads.
  document: null as PenmaDocument | null,

  addDocument: (doc) =>
    set((state) => {
      // Position new frame to the right of existing frames
      let maxRight = 0;
      for (const d of state.documents) {
        const right = d.canvasX + d.viewport.width;
        if (right > maxRight) maxRight = right;
      }
      const positioned = {
        ...doc,
        canvasX: state.documents.length > 0 ? maxRight + FRAME_GAP : 0,
        canvasY: 0,
      };
      return {
        documents: [...state.documents, positioned],
        activeDocumentId: doc.id,
        isImporting: false,
        importError: null,
      };
    }),

  removeDocument: (docId) =>
    set((state) => {
      const filtered = state.documents.filter((d) => d.id !== docId);
      return {
        documents: filtered,
        activeDocumentId:
          state.activeDocumentId === docId
            ? filtered[0]?.id ?? null
            : state.activeDocumentId,
      };
    }),

  setActiveDocument: (docId) => set({ activeDocumentId: docId }),

  setDocument: (doc) =>
    set((state) => {
      const positioned = { ...doc, canvasX: doc.canvasX ?? 0, canvasY: doc.canvasY ?? 0 };
      // Position to the right of existing frames
      let maxRight = 0;
      for (const d of state.documents) {
        const right = d.canvasX + d.viewport.width;
        if (right > maxRight) maxRight = right;
      }
      if (state.documents.length > 0) {
        positioned.canvasX = maxRight + FRAME_GAP;
      }
      return {
        documents: [...state.documents, positioned],
        activeDocumentId: doc.id,
        isImporting: false,
        importError: null,
      };
    }),

  clearDocument: () => set({ documents: [], activeDocumentId: null }),

  setImporting: (importing) => set({ isImporting: importing, importError: null }),
  setImportError: (error) => set({ importError: error, isImporting: false }),

  updateNodeStyles: (nodeId, overrides) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          Object.assign(node.styles.overrides, overrides);
        });
      }),
    })),

  updateNodeText: (nodeId, text) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.textContent = text; });
      }),
    })),

  toggleNodeVisibility: (nodeId) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.visible = !node.visible; });
      }),
    })),

  toggleNodeLock: (nodeId) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.locked = !node.locked; });
      }),
    })),

  renameNode: (nodeId, name) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.name = name; });
      }),
    })),

  updateNodeBounds: (nodeId, bounds) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { Object.assign(node.bounds, bounds); });
      }),
    })),

  toggleAutoLayout: (nodeId) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (node.autoLayout) {
            node.autoLayout = undefined;
            node.sizing = undefined;
            for (const child of node.children) child.sizing = undefined;
          } else {
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

            const mj = (v: string) => { if (v === 'center') return 'center' as const; if (v === 'flex-end' || v === 'end') return 'end' as const; if (v === 'space-between') return 'space-between' as const; return 'start' as const; };
            const ma = (v: string) => { if (v === 'center') return 'center' as const; if (v === 'flex-end' || v === 'end') return 'end' as const; if (v === 'stretch') return 'stretch' as const; if (v === 'baseline') return 'baseline' as const; return 'start' as const; };

            const autoLayout: AutoLayout = { ...DEFAULT_AUTO_LAYOUT, direction, gap, padding: { top: pt, right: pr, bottom: pb, left: pl }, independentPadding: !(pt === pr && pr === pb && pb === pl), primaryAxisAlign: mj(justify), counterAxisAlign: ma(align), reverse: flexDir === 'row-reverse' || flexDir === 'column-reverse' };
            node.autoLayout = autoLayout;
            node.sizing = { ...DEFAULT_SIZING };

            const isHoriz = direction === 'horizontal' || direction === 'wrap';
            for (const child of node.children) {
              const cs = child.styles.computed;
              const fg = parseFloat(cs['flex-grow'] || '0') || 0;
              const as2 = cs['align-self'] || '';
              const w = cs['width'] || 'auto';
              const h = cs['height'] || 'auto';
              let hz: 'fixed' | 'hug' | 'fill' = 'hug';
              let vt: 'fixed' | 'hug' | 'fill' = 'hug';
              if (isHoriz) { if (fg > 0 || w.includes('%')) hz = 'fill'; else if (w !== 'auto') hz = 'fixed'; if (as2 === 'stretch' || autoLayout.counterAxisAlign === 'stretch') vt = 'fill'; else if (h !== 'auto' && !h.includes('%')) vt = 'fixed'; }
              else { if (fg > 0 || h.includes('%')) vt = 'fill'; else if (h !== 'auto') vt = 'fixed'; if (as2 === 'stretch' || autoLayout.counterAxisAlign === 'stretch') hz = 'fill'; else if (w !== 'auto' && !w.includes('%')) hz = 'fixed'; }
              child.sizing = { horizontal: hz, vertical: vt };
            }
          }
        });
      }),
    })),

  updateAutoLayout: (nodeId, patch) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (node.autoLayout) Object.assign(node.autoLayout, patch); });
      }),
    })),

  updateAutoLayoutPadding: (nodeId, side, value) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (node.autoLayout) node.autoLayout.padding[side] = value; });
      }),
    })),

  setUniformPadding: (nodeId, value) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (node.autoLayout) node.autoLayout.padding = { top: value, right: value, bottom: value, left: value }; });
      }),
    })),

  updateSizing: (nodeId, axis, mode) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (!node.sizing) node.sizing = { ...DEFAULT_SIZING }; node.sizing[axis] = mode; });
      }),
    })),
});
