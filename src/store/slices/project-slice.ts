import type { StateCreator } from 'zustand';
import type { EditorState } from '../editor-store';
import type { PenmaPage } from './pages-slice';

export interface ProjectSlice {
  projectId: string | null;
  projectName: string;
  isSaving: boolean;
  lastSavedAt: Date | null;
  isDirty: boolean;

  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  setProjectName: (name: string) => void;
  markDirty: () => void;
}

export const createProjectSlice: StateCreator<
  EditorState,
  [],
  [],
  ProjectSlice
> = (set, get) => ({
  projectId: null,
  projectName: 'Untitled',
  isSaving: false,
  lastSavedAt: null,
  isDirty: false,

  loadProject: async (id: string) => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw new Error('Failed to load project');

    const data = await res.json();
    const pages: PenmaPage[] = data.pages ?? [];
    const firstPage = pages[0];

    set({
      projectId: data.id,
      projectName: data.name,
      pages,
      activePageId: firstPage?.id ?? '',
      documents: firstPage?.documents ?? [],
      activeDocumentId: firstPage?.activeDocumentId ?? null,
      selectedIds: [],
      camera: firstPage?.camera ?? { x: 0, y: 0, zoom: 1 },
      isDirty: false,
      lastSavedAt: new Date(data.updatedAt),
    });
  },

  saveProject: async () => {
    const state = get();
    if (!state.projectId) return;

    set({ isSaving: true });

    try {
      // Save current page state into pages array before persisting
      const pages = state.pages.map((p) => {
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

      // Convert pages to plain serializable objects for the API
      const serializedPages = pages.map((p) => ({
        _id: p.id,
        name: p.name,
        documents: p.documents,
        activeDocumentId: p.activeDocumentId,
        selectedIds: p.selectedIds,
        camera: p.camera,
      }));

      const res = await fetch(`/api/projects/${state.projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: serializedPages }),
      });

      if (!res.ok) throw new Error('Failed to save');

      const result = await res.json();
      set({ isDirty: false, lastSavedAt: new Date(result.updatedAt) });
    } finally {
      set({ isSaving: false });
    }
  },

  setProjectName: (name: string) => {
    const state = get();
    set({ projectName: name, isDirty: true });

    if (state.projectId) {
      fetch(`/api/projects/${state.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    }
  },

  markDirty: () => {
    set({ isDirty: true });
  },
});
