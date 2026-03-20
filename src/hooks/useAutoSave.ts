'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';

const AUTO_SAVE_DELAY = 2000;

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSnapshotRef = useRef<string>('');

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (!state.projectId) return;

      // Create a lightweight fingerprint of the data we care about
      // to avoid triggering on isSaving/isDirty/lastSavedAt changes
      const snapshot = `${state.activePageId}:${state.documents.length}:${state.pages.length}:${state.camera.x}:${state.camera.y}:${state.camera.zoom}`;
      if (snapshot === prevSnapshotRef.current) return;
      prevSnapshotRef.current = snapshot;

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
