import type { StateCreator } from 'zustand';
import type { PenmaDocument } from '@/types/document';
import type { EditorState } from '../editor-store';

interface HistoryEntry {
  documents: PenmaDocument[];
  description: string;
}

export interface HistorySlice {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  pushHistory: (description: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 100;

export const createHistorySlice: StateCreator<
  EditorState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushHistory: (description) => {
    const state = get();
    if (state.documents.length === 0) return;
    set((s) => ({
      undoStack: [
        ...s.undoStack.slice(-MAX_HISTORY + 1),
        { documents: JSON.parse(JSON.stringify(s.documents)), description },
      ],
      redoStack: [],
    }));
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack[state.undoStack.length - 1];
    set({
      documents: prev.documents,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [
        ...state.redoStack,
        { documents: JSON.parse(JSON.stringify(state.documents)), description: prev.description },
      ],
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const next = state.redoStack[state.redoStack.length - 1];
    set({
      documents: next.documents,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [
        ...state.undoStack,
        { documents: JSON.parse(JSON.stringify(state.documents)), description: next.description },
      ],
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
});
