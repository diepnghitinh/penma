'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, FileText, Pencil } from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  pageCount: number;
}

export const ProjectList: React.FC = () => {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleCreate = async () => {
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled' }),
    });
    const data = await res.json();
    router.push(`/editor/${data.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;

    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
    );
    setEditingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: 'var(--penma-bg)', color: 'var(--penma-text)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-6"
        style={{ borderBottom: '1px solid var(--penma-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'var(--penma-primary)' }}
          >
            <span className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              P
            </span>
          </div>
          <span
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Penma
          </span>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white cursor-pointer disabled:opacity-50"
          style={{
            background: 'var(--penma-primary)',
            fontFamily: 'var(--font-body)',
            transition: 'var(--transition-base)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--penma-primary)')}
        >
          <Plus size={16} />
          {creating ? 'Creating...' : 'New Project'}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--penma-border)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--penma-surface)' }}
            >
              <FileText size={28} style={{ color: 'var(--penma-text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--penma-text-muted)' }}>
              No projects yet. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/editor/${project.id}`)}
                className="group relative flex flex-col gap-3 rounded-xl p-4 cursor-pointer"
                style={{
                  background: 'var(--penma-surface)',
                  border: '1px solid var(--penma-border)',
                  transition: 'var(--transition-base)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--penma-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--penma-border)';
                }}
              >
                {/* Thumbnail placeholder */}
                <div
                  className="flex h-28 items-center justify-center rounded-lg"
                  style={{ background: 'var(--penma-bg)' }}
                >
                  <FileText size={32} style={{ color: 'var(--penma-text-muted)', opacity: 0.4 }} />
                </div>

                {/* Name */}
                {editingId === project.id ? (
                  <input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(project.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded px-1 py-0.5 text-sm font-medium outline-none"
                    style={{
                      background: 'var(--penma-bg)',
                      color: 'var(--penma-text)',
                      border: '1px solid var(--penma-primary)',
                    }}
                  />
                ) : (
                  <span
                    className="truncate text-sm font-medium"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(project.id);
                      setEditName(project.name);
                    }}
                  >
                    {project.name}
                  </span>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--penma-text-muted)' }}>
                  <span>{project.pageCount} {project.pageCount === 1 ? 'page' : 'pages'}</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100" style={{ transition: 'var(--transition-base)' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(project.id);
                      setEditName(project.name);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer"
                    style={{
                      background: 'var(--penma-bg)',
                      color: 'var(--penma-text-muted)',
                      transition: 'var(--transition-base)',
                    }}
                    title="Rename project"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer"
                    style={{
                      background: 'var(--penma-bg)',
                      color: 'var(--penma-text-muted)',
                      transition: 'var(--transition-base)',
                    }}
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
