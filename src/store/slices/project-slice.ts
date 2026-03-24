import type { StateCreator } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { EditorState } from '../editor-store';
import type { PenmaPage } from './pages-slice';

export interface ProjectSlice {
  projectId: string | null;
  projectName: string;
  publicShareId: string | null;
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
  publicShareId: null,
  isSaving: false,
  lastSavedAt: null,
  isDirty: false,

  loadProject: async (id: string) => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw new Error('Failed to load project');

    const data = await res.json();
    const pages: PenmaPage[] = (data.pages ?? []).map(
      (p: Record<string, unknown>) => ({
        id: (p.id || p._id) as string,
        name: (p.name || 'Page') as string,
        documents: (p.documents ?? []) as PenmaPage['documents'],
        activeDocumentId: (p.activeDocumentId ?? null) as string | null,
        selectedIds: (p.selectedIds ?? []) as string[],
        camera: (p.camera ?? { x: 0, y: 0, zoom: 1 }) as PenmaPage['camera'],
      })
    );

    // Use page from URL query param if available, otherwise first page
    const pageParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('page')
      : null;
    const targetPage = (pageParam && pages.find((p) => p.id === pageParam)) || pages[0];

    set({
      // Project metadata
      projectId: data.id,
      projectName: data.name,
      publicShareId: data.publicShareId ?? null,
      isDirty: false,
      lastSavedAt: new Date(data.updatedAt),
      // All pages with their full state
      pages,
      activePageId: targetPage?.id ?? '',
      // Hydrate active page into live editor state
      documents: targetPage?.documents ?? [],
      activeDocumentId: targetPage?.activeDocumentId ?? null,
      selectedIds: targetPage?.selectedIds ?? [],
      camera: targetPage?.camera ?? { x: 0, y: 0, zoom: 1 },
      // Reset session-only state
      undoStack: [],
      redoStack: [],
      // Hide import dialog if project already has documents
      showImportDialog: (targetPage?.documents ?? []).length === 0,
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
      const serializedPages = pages.map((p) => {
        const raw = p as unknown as Record<string, unknown>;
        const pageId = p.id || (raw._id as string) || uuid();
        return {
          _id: pageId,
          name: p.name || 'Page',
          documents: JSON.parse(JSON.stringify(p.documents ?? [])),
          activeDocumentId: p.activeDocumentId ?? null,
          selectedIds: p.selectedIds ?? [],
          camera: p.camera
            ? { x: p.camera.x, y: p.camera.y, zoom: p.camera.zoom }
            : { x: 0, y: 0, zoom: 1 },
        };
      });

      const res = await fetch(`/api/projects/${state.projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: serializedPages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }

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
