import type { StateCreator } from 'zustand';
import { produce } from 'immer';
import { v4 as uuid } from 'uuid';
import type { PenmaDocument, PenmaNode, AutoLayout, SizingMode } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';
import { updateNodeById, findNodeById, findParentNode, flattenTree } from '@/lib/utils/tree-utils';
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
  addNodeToActiveDocument: (node: PenmaNode) => void;
  deleteNodes: (nodeIds: string[]) => void;
  toggleAutoLayout: (nodeId: string) => void;
  updateAutoLayout: (nodeId: string, patch: Partial<AutoLayout>) => void;
  updateAutoLayoutPadding: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', value: number) => void;
  setUniformPadding: (nodeId: string, value: number) => void;
  updateSizing: (nodeId: string, axis: 'horizontal' | 'vertical', mode: 'fixed' | 'hug' | 'fill') => void;
  /** Mark a node as a master component */
  makeComponent: (nodeId: string) => void;
  /** Create an instance (ref) of a master component next to it */
  createComponentRef: (nodeId: string) => void;
  /** Detach an instance, making it a regular editable node */
  detachComponent: (nodeId: string) => void;
  /** Check if a node is a component instance (ref) */
  isComponentRef: (nodeId: string) => boolean;
}

/**
 * Helper: apply a mutation to whichever document contains the given nodeId.
 * Returns the updated documents array.
 * If the mutated node is a master component, syncs all instances.
 */
function mutateNodeInDocs(
  docs: PenmaDocument[],
  nodeId: string,
  mutator: (draft: PenmaDocument) => void
): PenmaDocument[] {
  let mutatedNode: PenmaNode | null = null;
  const result = docs.map((doc) => {
    if (findNodeById(doc.rootNode, nodeId)) {
      const updated = produce(doc, mutator);
      mutatedNode = findNodeById(updated.rootNode, nodeId);
      return updated;
    }
    return doc;
  });
  // If we mutated a master component, sync all its instances
  if (mutatedNode && (mutatedNode as PenmaNode).componentId) {
    return syncComponentInstances(result);
  }
  return result;
}

/**
 * After mutating a master component node, sync all instances (nodes with
 * matching componentRef) to mirror the master's content.
 * Preserves each instance's own id, position (bounds), and componentRef.
 */
function syncComponentInstances(docs: PenmaDocument[]): PenmaDocument[] {
  // Collect all master components (nodes with componentId)
  const masters = new Map<string, PenmaNode>();
  for (const doc of docs) {
    for (const node of flattenTree(doc.rootNode)) {
      if (node.componentId) masters.set(node.componentId, node);
    }
  }
  if (masters.size === 0) return docs;

  // Find and update all instances
  let changed = false;
  const result = docs.map((doc) => {
    const instances: { nodeId: string; compId: string }[] = [];
    for (const node of flattenTree(doc.rootNode)) {
      if (node.componentRef && masters.has(node.componentRef)) {
        instances.push({ nodeId: node.id, compId: node.componentRef });
      }
    }
    if (instances.length === 0) return doc;

    changed = true;
    return produce(doc, (draft) => {
      for (const { nodeId, compId } of instances) {
        updateNodeById(draft.rootNode, nodeId, (instance) => {
          const master = masters.get(compId);
          if (!master) return;
          // Sync content from master, preserving instance's own position
          const savedBounds = { ...instance.bounds };
          const positionOverrides: Record<string, string> = {};
          const POSITION_KEYS = ['position', 'top', 'left', 'right', 'bottom', 'z-index', 'transform'];
          for (const key of POSITION_KEYS) {
            if (key in instance.styles.overrides) {
              positionOverrides[key] = instance.styles.overrides[key];
            }
          }

          instance.tagName = master.tagName;
          instance.attributes = { ...master.attributes };
          instance.textContent = master.textContent;
          instance.rawHtml = master.rawHtml;
          instance.styles = {
            computed: { ...master.styles.computed },
            overrides: { ...master.styles.overrides, ...positionOverrides },
          };
          instance.bounds = savedBounds;
          instance.visible = master.visible;
          instance.autoLayout = master.autoLayout
            ? { ...master.autoLayout, padding: { ...master.autoLayout.padding } }
            : undefined;
          instance.sizing = master.sizing ? { ...master.sizing } : undefined;
          instance.name = master.name;
          // Deep-clone children from master with fresh IDs
          instance.children = master.children.map((c) => cloneNodeWithNewIds(c));
        });
      }
    });
  });
  return changed ? result : docs;
}

/** Check if a node is a component instance (ref) — instances are not directly editable */
function isInstanceNode(docs: PenmaDocument[], nodeId: string): boolean {
  for (const doc of docs) {
    const node = findNodeById(doc.rootNode, nodeId);
    if (node) return !!node.componentRef;
  }
  return false;
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
    set((state) => {
      if (isInstanceNode(state.documents, nodeId)) return state; // Instances are not editable
      return {
        documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
          updateNodeById(draft.rootNode, nodeId, (node) => {
            Object.assign(node.styles.overrides, overrides);
          });
        }),
      };
    }),

  updateNodeText: (nodeId, text) =>
    set((state) => {
      if (isInstanceNode(state.documents, nodeId)) return state;
      return {
        documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
          updateNodeById(draft.rootNode, nodeId, (node) => { node.textContent = text; });
        }),
      };
    }),

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

  addNodeToActiveDocument: (node) =>
    set((state) => {
      const activeDoc = state.documents.find((d) => d.id === state.activeDocumentId) ?? state.documents[0];
      if (!activeDoc) return state;
      return {
        documents: state.documents.map((d) =>
          d.id === activeDoc.id
            ? produce(d, (draft) => { draft.rootNode.children.push(node); })
            : d
        ),
      };
    }),

  deleteNodes: (nodeIds) =>
    set((state) => {
      const idsSet = new Set(nodeIds);
      return {
        documents: state.documents.map((doc) => {
          // Check if any of the nodeIds exist in this document
          const hasMatch = nodeIds.some((id) => findNodeById(doc.rootNode, id));
          if (!hasMatch) return doc;
          return produce(doc, (draft) => {
            for (const nodeId of idsSet) {
              const parent = findParentNode(draft.rootNode, nodeId);
              if (parent) {
                parent.children = parent.children.filter((c) => c.id !== nodeId);
              }
            }
          });
        }),
        selectedIds: state.selectedIds.filter((id) => !idsSet.has(id)),
      };
    }),

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

  // ── Component system ──────────────────────────────────────

  makeComponent: (nodeId) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          if (!node.componentId) {
            node.componentId = uuid();
          }
          node.componentRef = undefined;
          if (!node.name?.startsWith('Component/')) {
            node.name = `Component/${node.name || node.tagName}`;
          }
        });
      }),
    })),

  createComponentRef: (nodeId) => {
    const state = get();
    // Find the master node
    let masterNode: PenmaNode | null = null;
    let masterDocId: string | null = null;
    for (const doc of state.documents) {
      const found = findNodeById(doc.rootNode, nodeId);
      if (found) {
        masterNode = found;
        masterDocId = doc.id;
        break;
      }
    }
    if (!masterNode || !masterDocId) return;

    // Ensure node is a component
    const compId = masterNode.componentId;
    if (!compId) return;

    // Deep-clone the master node with new IDs, set componentRef
    const cloned = cloneNodeWithNewIds(masterNode);
    cloned.componentRef = compId;
    cloned.componentId = undefined;
    // Mark name as instance
    if (cloned.name?.startsWith('Component/')) {
      cloned.name = cloned.name; // keep the Component/ prefix for pink display
    }

    // Insert the clone as sibling after the master
    set((s) => ({
      documents: s.documents.map((doc) => {
        if (doc.id !== masterDocId) return doc;
        return produce(doc, (draft) => {
          const parent = findParentNode(draft.rootNode, nodeId);
          if (parent) {
            const idx = parent.children.findIndex((c) => c.id === nodeId);
            parent.children.splice(idx + 1, 0, cloned);
          } else if (draft.rootNode.id === nodeId) {
            // The master IS the root — add clone to root's children
            draft.rootNode.children.push(cloned);
          }
        });
      }),
      selectedIds: [cloned.id],
    }));
  },

  detachComponent: (nodeId) =>
    set((state) => ({
      documents: mutateNodeInDocs(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          node.componentRef = undefined;
          node.componentId = undefined;
          // Remove Component/ prefix
          if (node.name?.startsWith('Component/')) {
            node.name = node.name.slice('Component/'.length);
          }
        });
      }),
    })),

  isComponentRef: (nodeId) => {
    const state = get();
    for (const doc of state.documents) {
      const node = findNodeById(doc.rootNode, nodeId);
      if (node) return !!node.componentRef;
    }
    return false;
  },
});

/** Deep-clone a node tree, assigning fresh IDs to every node */
function cloneNodeWithNewIds(node: PenmaNode): PenmaNode {
  return {
    ...node,
    id: uuid(),
    children: node.children.map((c) => cloneNodeWithNewIds(c)),
    styles: {
      computed: { ...node.styles.computed },
      overrides: { ...node.styles.overrides },
    },
    bounds: { ...node.bounds },
    autoLayout: node.autoLayout ? { ...node.autoLayout, padding: { ...node.autoLayout.padding } } : undefined,
    sizing: node.sizing ? { ...node.sizing } : undefined,
  };
}
