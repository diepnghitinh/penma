'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';

const AUTO_SAVE_DELAY = 2000;

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const { isSaving, saveProject } = useEditorStore.getState();
        if (!isSaving) {
          saveProject();
        }
      }, AUTO_SAVE_DELAY);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
