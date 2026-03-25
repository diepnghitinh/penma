import type { StateCreator } from 'zustand';
import { flattenTree } from '@/lib/utils/tree-utils';
import type { EditorState } from '../editor-store';

export interface SelectionSlice {
  selectedIds: string[];
  hoveredId: string | null;
  lastSelectedId: string | null;
  select: (id: string, additive?: boolean) => void;
  selectMultiple: (ids: string[]) => void;
  deselect: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setHovered: (id: string | null) => void;
}

export const createSelectionSlice: StateCreator<
  EditorState,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  selectedIds: [],
  hoveredId: null,
  lastSelectedId: null,

  select: (id, additive = false) =>
    set((state) => {
      if (additive) {
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter((s) => s !== id)
            : [...state.selectedIds, id],
          lastSelectedId: id,
        };
      }
      return { selectedIds: [id], lastSelectedId: id };
    }),

  selectMultiple: (ids) => set({ selectedIds: ids }),

  deselect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.filter((s) => s !== id),
    })),

  clearSelection: () => set({ selectedIds: [], lastSelectedId: null }),

  selectAll: () => {
    const state = get();
    if (state.documents.length === 0) return;
    const allNodes = state.documents.flatMap((d) => flattenTree(d.rootNode));
    set({ selectedIds: allNodes.map((n) => n.id) });
  },

  setHovered: (id) => set({ hoveredId: id }),
});
