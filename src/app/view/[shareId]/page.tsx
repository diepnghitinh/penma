'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useEditorStore } from '@/store/editor-store';
import { EditorShell } from '@/components/editor/EditorShell';
import { findNodeAcrossDocuments, cameraToFitBounds } from '@/lib/canvas/navigate-to-node';

export default function PublicViewPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-screen items-center justify-center"
          style={{ background: 'var(--penma-bg)', color: 'var(--penma-text-muted)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--penma-border)', borderTopColor: 'transparent' }}
            />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <PublicViewContent />
    </Suspense>
  );
}

function PublicViewContent() {
  const { shareId } = useParams<{ shareId: string }>();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get('page');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;

    setLoading(true);
    setError(null);

    // Fetch project by public share token
    fetch(`/api/public/projects/${shareId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Project not found or not shared');
        return res.json();
      })
      .then((data) => {
        const pages = data.pages ?? [];
        // Use page from URL query param if available, otherwise first page
        const targetPage = (pageParam && pages.find((p: { id: string }) => p.id === pageParam)) || pages[0];

        // Hydrate store in one batch (same pattern as loadProject)
        useEditorStore.setState({
          projectId: data.id,
          projectName: data.name,
          isDirty: false,
          pages,
          activePageId: targetPage?.id ?? '',
          documents: targetPage?.documents ?? [],
          activeDocumentId: targetPage?.activeDocumentId ?? null,
          selectedIds: [],
          camera: targetPage?.camera ?? { x: 0, y: 0, zoom: 1 },
          undoStack: [],
          redoStack: [],
          showImportDialog: false,
          // Read-only mode
          editEnabled: false,
          editSettings: { textEditable: false, resizable: false, movable: false },
        });

        setLoading(false);

        // Navigate to element if URL has a hash
        requestAnimationFrame(() => {
          const hash = window.location.hash.slice(1);
          if (!hash) return;
          const st = useEditorStore.getState();
          const result = findNodeAcrossDocuments(st.documents, hash);
          if (!result) return;
          st.select(result.node.id);
          const canvas = document.querySelector('.penma-canvas');
          const vw = canvas?.clientWidth ?? window.innerWidth;
          const vh = canvas?.clientHeight ?? window.innerHeight;
          useEditorStore.setState({ camera: cameraToFitBounds(result.absoluteBounds, vw, vh) });
        });
      })
      .catch(() => {
        setError('This project is not available');
        setLoading(false);
      });
  }, [shareId, pageParam]);

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'var(--penma-bg)', color: 'var(--penma-text-muted)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--penma-border)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'var(--penma-bg)', color: 'var(--penma-text-muted)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="6" width="36" height="36" rx="6" />
            <line x1="18" y1="18" x2="30" y2="30" />
            <line x1="30" y1="18" x2="18" y2="30" />
          </svg>
          <span className="text-lg font-medium" style={{ color: 'var(--penma-text)' }}>
            {error}
          </span>
          <p className="text-sm" style={{ color: 'var(--penma-text-muted)' }}>
            The link may be invalid or sharing has been disabled.
          </p>
        </div>
      </div>
    );
  }

  return <EditorShell readOnly />;
}
