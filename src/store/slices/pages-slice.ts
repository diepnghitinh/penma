import type { StateCreator } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { PenmaDocument } from '@/types/document';
import type { Camera } from '@/types/editor';
import type { EditorState } from '../editor-store';

export interface PenmaPage {
  id: string;
  name: string;
  /** Saved documents for this page (restored when switching back) */
  documents: PenmaDocument[];
  activeDocumentId: string | null;
  selectedIds: string[];
  camera: Camera;
}

export interface PagesSlice {
  pages: PenmaPage[];
  activePageId: string;
  addPage: (name?: string) => void;
  removePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  switchPage: (pageId: string) => void;
  duplicatePage: (pageId: string) => void;
}

function createDefaultPage(name: string): PenmaPage {
  return {
    id: uuid(),
    name,
    documents: [],
    activeDocumentId: null,
    selectedIds: [],
    camera: { x: 0, y: 0, zoom: 1 },
  };
}

export const createPagesSlice: StateCreator<
  EditorState,
  [],
  [],
  PagesSlice
> = (set, get) => {
  const defaultPage = createDefaultPage('Page 1');

  return {
    pages: [defaultPage],
    activePageId: defaultPage.id,

    addPage: (name) => {
      const state = get();
      const newPage = createDefaultPage(name || `Page ${state.pages.length + 1}`);
      // Save current page state before switching
      const updatedPages = saveCurrentPageState(state);
      set({
        pages: [...updatedPages, newPage],
        activePageId: newPage.id,
        // Clear canvas for new page
        documents: [],
        activeDocumentId: null,
        selectedIds: [],
        camera: { x: 0, y: 0, zoom: 1 },
      });
    },

    removePage: (pageId) => {
      const state = get();
      if (state.pages.length <= 1) return; // Can't delete last page

      const updatedPages = saveCurrentPageState(state).filter((p) => p.id !== pageId);
      const wasActive = pageId === state.activePageId;

      if (wasActive) {
        // Switch to first remaining page
        const newActive = updatedPages[0];
        set({
          pages: updatedPages,
          activePageId: newActive.id,
          documents: newActive.documents,
          activeDocumentId: newActive.activeDocumentId,
          selectedIds: newActive.selectedIds,
          camera: newActive.camera,
        });
      } else {
        set({ pages: updatedPages });
      }
    },

    renamePage: (pageId, name) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === pageId ? { ...p, name } : p)),
      }));
    },

    switchPage: (pageId) => {
      const state = get();
      if (pageId === state.activePageId) return;

      // Save current page state
      const updatedPages = saveCurrentPageState(state);
      const targetPage = updatedPages.find((p) => p.id === pageId);
      if (!targetPage) return;

      set({
        pages: updatedPages,
        activePageId: pageId,
        documents: targetPage.documents,
        activeDocumentId: targetPage.activeDocumentId,
        selectedIds: targetPage.selectedIds,
        camera: targetPage.camera,
      });
    },

    duplicatePage: (pageId) => {
      const state = get();
      const updatedPages = saveCurrentPageState(state);
      const sourcePage = updatedPages.find((p) => p.id === pageId);
      if (!sourcePage) return;

      const newPage: PenmaPage = {
        id: uuid(),
        name: `${sourcePage.name} (copy)`,
        documents: JSON.parse(JSON.stringify(sourcePage.documents)),
        activeDocumentId: sourcePage.activeDocumentId,
        selectedIds: [],
        camera: { ...sourcePage.camera },
      };

      set({
        pages: [...updatedPages, newPage],
        activePageId: newPage.id,
        documents: newPage.documents,
        activeDocumentId: newPage.activeDocumentId,
        selectedIds: [],
        camera: newPage.camera,
      });
    },
  };
};

/** Saves the current editor state back into the active page */
function saveCurrentPageState(state: EditorState): PenmaPage[] {
  return state.pages.map((p) => {
    if (p.id === state.activePageId) {
      return {
        ...p,
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
        selectedIds: state.selectedIds,
        camera: state.camera,
      };
    }
    return p;
  });
}
