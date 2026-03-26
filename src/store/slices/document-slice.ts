import type { StateCreator } from 'zustand';
import { produce } from 'immer';
import { v4 as uuid } from 'uuid';
import type { PenmaDocument, PenmaNode, AutoLayout, PenmaFill } from '@/types/document';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_SIZING } from '@/types/document';
import { updateNodeById, findNodeById, findParentNode, flattenTree, getAncestorIds } from '@/lib/utils/tree-utils';
import type { EditorState } from '../editor-store';

export interface DocumentSlice {
  documents: PenmaDocument[];
  activeDocumentId: string | null;
  isImporting: boolean;
  importError: string | null;
  /** Backward-compat: returns the active document */
  document: PenmaDocument | null;
  addDocument: (doc: PenmaDocument) => void;
  /** Add multiple documents at once, correctly positioned without overlap */
  addDocuments: (docs: PenmaDocument[]) => void;
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
  addNodeToParent: (parentId: string, node: PenmaNode) => void;
  deleteNodes: (nodeIds: string[]) => void;
  /** Move a node to a new index within its parent's children */
  reorderNode: (nodeId: string, targetParentId: string, targetIndex: number) => void;
  toggleAutoLayout: (nodeId: string) => void;
  updateAutoLayout: (nodeId: string, patch: Partial<AutoLayout>) => void;
  updateAutoLayoutPadding: (nodeId: string, side: 'top' | 'right' | 'bottom' | 'left', value: number) => void;
  setUniformPadding: (nodeId: string, value: number) => void;
  updateSizing: (nodeId: string, axis: 'horizontal' | 'vertical', mode: 'fixed' | 'hug' | 'fill') => void;
  updateNodeFills: (nodeId: string, fills: PenmaFill[]) => void;
  /** Move a document frame on the canvas */
  updateDocumentPosition: (docId: string, canvasX: number, canvasY: number) => void;
  /** Resize a frame's viewport */
  updateDocumentViewport: (docId: string, viewport: { width: number; height: number }) => void;
  /** Mark a node as a master component */
  makeComponent: (nodeId: string) => void;
  /** Create an instance (ref) of a master component next to it */
  createComponentRef: (nodeId: string) => void;
  /** Detach an instance, making it a regular editable node */
  detachComponent: (nodeId: string) => void;
  /** Update HTML attributes on a node */
  updateNodeAttributes: (nodeId: string, attributes: Record<string, string>) => void;
  /** Remove an HTML attribute from a node */
  removeNodeAttribute: (nodeId: string, key: string) => void;
  /** Check if a node is a component instance (ref) */
  isComponentRef: (nodeId: string) => boolean;
  /** Add a shape to the canvas document (creates it if needed) */
  addCanvasNode: (node: PenmaNode) => void;
}

/** Check if a node is inside a master component (or is one) */
function isInsideMaster(doc: PenmaDocument, nodeId: string): boolean {
  const node = findNodeById(doc.rootNode, nodeId);
  if (node?.componentId) return true;
  const ancestors = getAncestorIds(doc.rootNode, nodeId);
  for (const aid of ancestors) {
    const a = findNodeById(doc.rootNode, aid);
    if (a?.componentId) return true;
  }
  return false;
}

/**
 * Helper: apply a mutation to whichever document contains the given nodeId.
 * Returns the updated documents array.
 * If the mutated node is inside a master component, syncs all instances.
 * Pass getState to also sync component references on other pages.
 */
function mutateNodeInDocs(
  docs: PenmaDocument[],
  nodeId: string,
  mutator: (draft: PenmaDocument) => void,
  getState?: () => EditorState,
  setState?: (patch: Partial<EditorState>) => void,
): PenmaDocument[] {
  let shouldSync = false;
  const result = docs.map((doc) => {
    if (findNodeById(doc.rootNode, nodeId)) {
      const updated = produce(doc, mutator);
      if (isInsideMaster(updated, nodeId)) shouldSync = true;
      return updated;
    }
    return doc;
  });
  if (shouldSync) {
    const synced = syncComponentInstances(result);
    // Cross-page sync: update instances on other pages
    if (getState && setState) {
      const state = getState();
      const masters = collectMasters(synced);
      if (masters.size > 0) {
        let pagesChanged = false;
        const updatedPages = state.pages.map((page) => {
          if (page.id === state.activePageId) return page;
          const syncedDocs = syncWithMasters(page.documents, masters);
          if (syncedDocs !== page.documents) {
            pagesChanged = true;
            return { ...page, documents: syncedDocs };
          }
          return page;
        });
        if (pagesChanged) {
          setState({ pages: updatedPages } as Partial<EditorState>);
        }
      }
    }
    return synced;
  }
  return result;
}

/**
 * Collect all masters from documents and sync instances in a given docs array.
 */
function syncWithMasters(
  docs: PenmaDocument[],
  masters: Map<string, PenmaNode>,
): PenmaDocument[] {
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
          const overriddenIds = new Set(instance.instanceOverrides ?? []);
          if (!overriddenIds.has(instance.id)) {
            syncNodeFromMaster(instance, master);
          }
          instance.children = mergeChildren(master.children, instance.children, overriddenIds);
        });
      }
    });
  });
  return changed ? result : docs;
}

/** Collect all master component nodes from documents */
function collectMasters(docs: PenmaDocument[]): Map<string, PenmaNode> {
  const masters = new Map<string, PenmaNode>();
  for (const doc of docs) {
    for (const node of flattenTree(doc.rootNode)) {
      if (node.componentId) masters.set(node.componentId, node);
    }
  }
  return masters;
}

/** Sync a single node from master, preserving bounds and position overrides */
function syncNodeFromMaster(target: PenmaNode, master: PenmaNode): void {
  const savedBounds = { ...target.bounds };
  const positionOverrides: Record<string, string> = {};
  const POS_KEYS = ['position', 'top', 'left', 'right', 'bottom', 'z-index', 'transform'];
  for (const key of POS_KEYS) {
    if (key in target.styles.overrides) positionOverrides[key] = target.styles.overrides[key];
  }
  target.tagName = master.tagName;
  target.attributes = { ...master.attributes };
  target.textContent = master.textContent;
  target.rawHtml = master.rawHtml;
  target.styles = {
    computed: { ...master.styles.computed },
    overrides: { ...master.styles.overrides, ...positionOverrides },
  };
  target.bounds = savedBounds;
  target.visible = master.visible;
  target.autoLayout = master.autoLayout
    ? { ...master.autoLayout, padding: { ...master.autoLayout.padding } }
    : undefined;
  target.sizing = master.sizing ? { ...master.sizing } : undefined;
  target.fills = master.fills ? master.fills.map(f => ({ ...f })) : undefined;
  target.name = master.name;
}

/**
 * Recursively merge master children into instance children.
 * - Match by sourceNodeId
 * - Overridden nodes (edited by user) are kept as-is
 * - Non-overridden nodes are synced from master, then recurse into children
 */
function mergeChildren(
  masterChildren: PenmaNode[],
  instanceChildren: PenmaNode[],
  overriddenIds: Set<string>,
): PenmaNode[] {
  const bySource = new Map<string, PenmaNode>();
  for (const c of instanceChildren) {
    if (c.sourceNodeId) bySource.set(c.sourceNodeId, c);
  }

  const result: PenmaNode[] = [];
  for (const mc of masterChildren) {
    const ic = bySource.get(mc.id);
    if (!ic) {
      // New in master — clone it
      result.push(cloneNodeWithNewIds(mc));
      continue;
    }
    if (overriddenIds.has(ic.id)) {
      // User edited this node — keep it entirely as-is
      result.push(ic);
      continue;
    }
    // Not overridden — sync properties from master, then recurse children
    syncNodeFromMaster(ic, mc);
    ic.children = mergeChildren(mc.children, ic.children, overriddenIds);
    result.push(ic);
  }
  // Keep overridden nodes whose master counterpart was removed
  for (const ic of instanceChildren) {
    if (overriddenIds.has(ic.id) && !result.some(r => r.id === ic.id)) {
      result.push(ic);
    }
  }
  return result;
}

/**
 * After mutating a master component node, sync all instances.
 * Uses recursive merge so edited descendant nodes inside instances are preserved.
 */
function syncComponentInstances(docs: PenmaDocument[]): PenmaDocument[] {
  const masters = new Map<string, PenmaNode>();
  for (const doc of docs) {
    for (const node of flattenTree(doc.rootNode)) {
      if (node.componentId) masters.set(node.componentId, node);
    }
  }
  if (masters.size === 0) return docs;

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
          const overriddenIds = new Set(instance.instanceOverrides ?? []);

          // Sync instance root (unless the root itself was overridden)
          if (!overriddenIds.has(instance.id)) {
            syncNodeFromMaster(instance, master);
          }

          // Recursively merge children
          instance.children = mergeChildren(master.children, instance.children, overriddenIds);
        });
      }
    });
  });
  return changed ? result : docs;
}

/** Find the nearest ancestor component instance root for a node */
function findInstanceRoot(doc: PenmaDocument, nodeId: string): PenmaNode | null {
  const node = findNodeById(doc.rootNode, nodeId);
  if (node?.componentRef) return node;
  const ancestors = getAncestorIds(doc.rootNode, nodeId);
  for (const aid of ancestors) {
    const a = findNodeById(doc.rootNode, aid);
    if (a?.componentRef) return a;
  }
  return null;
}

/** Mark a node as overridden on its ancestor instance root */
function markInstanceOverride(docs: PenmaDocument[], nodeId: string): PenmaDocument[] {
  let instRootId: string | null = null;
  for (const doc of docs) {
    const root = findInstanceRoot(doc, nodeId);
    if (root) { instRootId = root.id; break; }
  }
  if (!instRootId) return docs;
  return docs.map((doc) => {
    if (!findNodeById(doc.rootNode, instRootId!)) return doc;
    return produce(doc, (draft) => {
      updateNodeById(draft.rootNode, instRootId!, (inst) => {
        const s = new Set(inst.instanceOverrides ?? []);
        s.add(nodeId);
        inst.instanceOverrides = [...s];
      });
    });
  });
}

const FRAME_GAP = 80; // px between frames on canvas

/** Get the effective size of a document frame */
function getDocSize(doc: PenmaDocument): { width: number; height: number } {
  return {
    // Width uses viewport only — rootNode.bounds.width from Puppeteer may
    // exceed the viewport (e.g. body wider than the chosen screen size),
    // but the frame clips to viewport width, so layout must use that.
    width: doc.viewport.width,
    height: Math.max(doc.viewport.height, doc.rootNode.bounds.height),
  };
}

/**
 * Arrange documents so they don't overlap.
 * Places each new document to the right of all existing + previously placed documents.
 * All documents top-aligned at the same Y.
 */
function layoutDocuments(
  existing: PenmaDocument[],
  incoming: PenmaDocument[],
): PenmaDocument[] {
  if (incoming.length === 0) return [];

  // Find the rightmost edge of all existing documents
  let nextX = 0;
  const startY = 0;

  for (const d of existing) {
    const right = d.canvasX + getDocSize(d).width;
    if (right > nextX) nextX = right;
  }

  // Add gap if there are existing documents
  if (existing.length > 0) {
    nextX += FRAME_GAP;
  }

  // Place each incoming document sequentially to the right
  const positioned: PenmaDocument[] = [];
  for (const doc of incoming) {
    const size = getDocSize(doc);
    positioned.push({
      ...doc,
      canvasX: nextX,
      canvasY: startY,
    });
    nextX += size.width + FRAME_GAP;
  }

  return positioned;
}

export const createDocumentSlice: StateCreator<
  EditorState,
  [],
  [],
  DocumentSlice
> = (set, get) => {
  /** Wrapper that passes get/set for cross-page sync */
  const mutate = (docs: PenmaDocument[], nodeId: string, mutator: (draft: PenmaDocument) => void) =>
    mutateNodeInDocs(docs, nodeId, mutator, get, set);

  return {
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
      const [positioned] = layoutDocuments(state.documents, [doc]);
      return {
        documents: [...state.documents, positioned],
        activeDocumentId: doc.id,
        isImporting: false,
        importError: null,
      };
    }),

  addDocuments: (docs) =>
    set((state) => {
      const positioned = layoutDocuments(state.documents, docs);
      const lastDoc = positioned[positioned.length - 1];
      return {
        documents: [...state.documents, ...positioned],
        activeDocumentId: lastDoc?.id ?? state.activeDocumentId,
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
      const [positioned] = layoutDocuments(state.documents, [doc]);
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
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          Object.assign(node.styles.overrides, overrides);
        });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  updateNodeText: (nodeId, text) =>
    set((state) => {
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.textContent = text; });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  toggleNodeVisibility: (nodeId) =>
    set((state) => {
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.visible = !node.visible; });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  toggleNodeLock: (nodeId) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.locked = !node.locked; });
      }),
    })),

  renameNode: (nodeId, name) =>
    set((state) => {
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { node.name = name; });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  updateNodeBounds: (nodeId, bounds) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
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

  addNodeToParent: (parentId, node) =>
    set((state) => {
      return {
        documents: state.documents.map((doc) => {
          if (!findNodeById(doc.rootNode, parentId)) return doc;
          return produce(doc, (draft) => {
            const parent = findNodeById(draft.rootNode, parentId);
            if (parent) parent.children.push(node);
          });
        }),
      };
    }),

  addCanvasNode: (node) =>
    set((state) => {
      let docs = state.documents;
      let canvasDoc = docs.find((d) => d.sourceUrl === 'local://canvas');

      if (!canvasDoc) {
        canvasDoc = {
          id: uuid(),
          sourceUrl: 'local://canvas',
          importedAt: new Date().toISOString(),
          viewport: { width: 0, height: 0 },
          rootNode: {
            id: uuid(),
            tagName: 'div',
            attributes: {},
            children: [],
            styles: { computed: { position: 'absolute', left: '0px', top: '0px' }, overrides: {} },
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            visible: true,
            locked: false,
            name: 'Canvas',
          },
          assets: {},
          canvasX: 0,
          canvasY: 0,
        };
        docs = [...docs, canvasDoc];
      }

      const canvasId = canvasDoc.id;
      return {
        documents: docs.map((d) =>
          d.id === canvasId
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

  reorderNode: (nodeId, targetParentId, targetIndex) =>
    set((state) => {
      // Find source document and target document
      let sourceDocIdx = -1;
      let targetDocIdx = -1;
      for (let i = 0; i < state.documents.length; i++) {
        if (findNodeById(state.documents[i].rootNode, nodeId)) sourceDocIdx = i;
        if (state.documents[i].rootNode.id === targetParentId || findNodeById(state.documents[i].rootNode, targetParentId)) targetDocIdx = i;
      }
      if (sourceDocIdx === -1 || targetDocIdx === -1) return state;

      if (sourceDocIdx === targetDocIdx) {
        // Same document — move within tree
        return {
          documents: state.documents.map((doc, i) => {
            if (i !== sourceDocIdx) return doc;
            return produce(doc, (draft) => {
              const oldParent = findParentNode(draft.rootNode, nodeId);
              if (!oldParent) return;
              const nodeIdx = oldParent.children.findIndex((c) => c.id === nodeId);
              if (nodeIdx === -1) return;
              const [node] = oldParent.children.splice(nodeIdx, 1);
              const newParent = targetParentId === draft.rootNode.id
                ? draft.rootNode
                : findNodeById(draft.rootNode, targetParentId);
              if (!newParent) return;
              const idx = Math.min(targetIndex, newParent.children.length);
              newParent.children.splice(idx, 0, node);
            });
          }),
        };
      }

      // Cross-document move — remove from source, insert into target
      let movedNode: PenmaNode | null = null;
      const newDocs = state.documents.map((doc, i) => {
        if (i === sourceDocIdx) {
          return produce(doc, (draft) => {
            const oldParent = findParentNode(draft.rootNode, nodeId);
            if (!oldParent) return;
            const nodeIdx = oldParent.children.findIndex((c) => c.id === nodeId);
            if (nodeIdx === -1) return;
            [movedNode] = oldParent.children.splice(nodeIdx, 1);
          });
        }
        return doc;
      }).map((doc, i) => {
        if (i === targetDocIdx && movedNode) {
          return produce(doc, (draft) => {
            const newParent = targetParentId === draft.rootNode.id
              ? draft.rootNode
              : findNodeById(draft.rootNode, targetParentId);
            if (!newParent) return;
            const idx = Math.min(targetIndex, newParent.children.length);
            newParent.children.splice(idx, 0, movedNode!);
          });
        }
        return doc;
      });
      return { documents: newDocs };
    }),

  toggleAutoLayout: (nodeId) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
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
      documents: mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (node.autoLayout) Object.assign(node.autoLayout, patch); });
      }),
    })),

  updateAutoLayoutPadding: (nodeId, side, value) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (node.autoLayout) node.autoLayout.padding[side] = value; });
      }),
    })),

  setUniformPadding: (nodeId, value) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (node.autoLayout) node.autoLayout.padding = { top: value, right: value, bottom: value, left: value }; });
      }),
    })),

  updateSizing: (nodeId, axis, mode) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => { if (!node.sizing) node.sizing = { ...DEFAULT_SIZING }; node.sizing[axis] = mode; });
      }),
    })),

  updateNodeFills: (nodeId, fills) =>
    set((state) => {
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          node.fills = fills;
        });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  updateDocumentPosition: (docId, canvasX, canvasY) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === docId ? { ...doc, canvasX, canvasY } : doc
      ),
    })),

  updateDocumentViewport: (docId, viewport) =>
    set((state) => ({
      documents: state.documents.map((doc) => {
        if (doc.id !== docId) return doc;
        // Only update viewport and root bounds — do NOT update root node CSS
        // to avoid layout feedback loops with auto-resize
        const updatedRoot = produce(doc.rootNode, (draft) => {
          draft.bounds.width = viewport.width;
          draft.bounds.height = viewport.height;
        });
        return { ...doc, viewport, rootNode: updatedRoot };
      }),
    })),

  // ── Component system ──────────────────────────────────────

  makeComponent: (nodeId) =>
    set((state) => ({
      documents: mutate(state.documents, nodeId, (draft) => {
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
      documents: mutate(state.documents, nodeId, (draft) => {
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

  updateNodeAttributes: (nodeId, attributes) =>
    set((state) => {
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          Object.assign(node.attributes, attributes);
        });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  removeNodeAttribute: (nodeId, key) =>
    set((state) => {
      let docs = mutate(state.documents, nodeId, (draft) => {
        updateNodeById(draft.rootNode, nodeId, (node) => {
          delete node.attributes[key];
        });
      });
      docs = markInstanceOverride(docs, nodeId);
      return { documents: docs };
    }),

  isComponentRef: (nodeId) => {
    const state = get();
    for (const doc of state.documents) {
      const node = findNodeById(doc.rootNode, nodeId);
      if (node) return !!node.componentRef;
    }
    return false;
  },
};};

/** Deep-clone a node tree, assigning fresh IDs. Sets sourceNodeId to map back to master. */
function cloneNodeWithNewIds(node: PenmaNode): PenmaNode {
  return {
    ...node,
    id: uuid(),
    sourceNodeId: node.sourceNodeId ?? node.id,
    instanceOverrides: undefined,
    children: node.children.map((c) => cloneNodeWithNewIds(c)),
    styles: {
      computed: { ...node.styles.computed },
      overrides: { ...node.styles.overrides },
    },
    bounds: { ...node.bounds },
    autoLayout: node.autoLayout ? { ...node.autoLayout, padding: { ...node.autoLayout.padding } } : undefined,
    sizing: node.sizing ? { ...node.sizing } : undefined,
    fills: node.fills ? node.fills.map(f => ({ ...f })) : undefined,
  };
}
