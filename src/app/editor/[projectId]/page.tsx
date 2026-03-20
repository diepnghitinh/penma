'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useEditorStore } from '@/store/editor-store';
import { EditorShell } from '@/components/editor/EditorShell';
import { useAutoSave } from '@/hooks/useAutoSave';

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useAutoSave();

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    useEditorStore
      .getState()
      .loadProject(projectId)
      .then(() => setLoading(false))
      .catch(() => {
        setError('Project not found');
        setLoading(false);
      });
  }, [projectId]);

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
          <span className="text-sm">Loading project...</span>
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
          <span className="text-lg font-medium" style={{ color: 'var(--penma-text)' }}>
            {error}
          </span>
          <a
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: 'var(--penma-primary)' }}
          >
            Back to Projects
          </a>
        </div>
      </div>
    );
  }

  return <EditorShell />;
}
