'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { saveProjectToLocal } from '@/lib/local-persistence';

const LOCAL_SAVE_DELAY = 500; // Save to localStorage quickly
const DB_SYNC_DELAY = 2000; // Sync to database less frequently

/** Merge current editor state into the pages array for persistence */
function getMergedPages() {
  const s = useEditorStore.getState();
  return s.pages.map((p) =>
    p.id === s.activePageId
      ? {
          ...p,
          documents: s.documents,
          activeDocumentId: s.activeDocumentId,
          selectedIds: s.selectedIds,
          camera: s.camera,
        }
      : p
  );
}

/** Flush current state to localStorage (synchronous, safe for beforeunload) */
function flushToLocal() {
  const s = useEditorStore.getState();
  if (!s.projectId || !s.isDirty) return;
  saveProjectToLocal(s.projectId, {
    pages: getMergedPages(),
    projectName: s.projectName,
    savedAt: Date.now(),
  });
}

export function useAutoSave() {
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef<{
    documents: unknown;
    pages: unknown;
    camera: unknown;
    activePageId: unknown;
    activeDocumentId: unknown;
    selectedIds: unknown;
  } | null>(null);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (!state.projectId) return;

      // Skip changes to save-related fields (isSaving, isDirty, lastSavedAt)
      // by comparing object references of the actual data fields
      const current = {
        documents: state.documents,
        pages: state.pages,
        camera: state.camera,
        activePageId: state.activePageId,
        activeDocumentId: state.activeDocumentId,
        selectedIds: state.selectedIds,
      };

      if (prevRef.current) {
        const prev = prevRef.current;
        if (
          prev.documents === current.documents &&
          prev.pages === current.pages &&
          prev.camera === current.camera &&
          prev.activePageId === current.activePageId &&
          prev.activeDocumentId === current.activeDocumentId &&
          prev.selectedIds === current.selectedIds
        ) {
          return; // No data change, skip
        }
      }
      prevRef.current = current;

      useEditorStore.getState().markDirty();

      // 1. Save to localStorage quickly (safety net)
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      localTimerRef.current = setTimeout(() => {
        flushToLocal();
      }, LOCAL_SAVE_DELAY);

      // 2. Sync to database with longer delay
      if (dbTimerRef.current) clearTimeout(dbTimerRef.current);
      dbTimerRef.current = setTimeout(() => {
        const { isSaving, saveProject } = useEditorStore.getState();
        if (!isSaving) {
          saveProject();
        }
      }, DB_SYNC_DELAY);
    });

    // Flush to localStorage on page unload (last-chance save)
    window.addEventListener('beforeunload', flushToLocal);

    return () => {
      unsub();
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (dbTimerRef.current) clearTimeout(dbTimerRef.current);
      window.removeEventListener('beforeunload', flushToLocal);
    };
  }, []);
}
