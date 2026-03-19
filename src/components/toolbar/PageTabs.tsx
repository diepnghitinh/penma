'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, X, Copy, MoreHorizontal } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';

export const PageTabs: React.FC = () => {
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const addPage = useEditorStore((s) => s.addPage);
  const removePage = useEditorStore((s) => s.removePage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const switchPage = useEditorStore((s) => s.switchPage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const editRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Start renaming
  const startRename = useCallback((pageId: string, currentName: string) => {
    setEditingId(pageId);
    setEditValue(currentName);
    setContextMenuId(null);
    setTimeout(() => editRef.current?.select(), 0);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      renamePage(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, renamePage]);

  // Context menu close on outside click
  useEffect(() => {
    if (!contextMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenuId]);

  return (
    <div
      className="flex items-center h-8 px-2 gap-0.5 overflow-x-auto"
      style={{
        background: 'var(--penma-surface)',
        borderBottom: '1px solid var(--penma-border)',
        minHeight: 32,
      }}
    >
      {pages.map((page) => {
        const isActive = page.id === activePageId;
        const isEditing = editingId === page.id;

        return (
          <div
            key={page.id}
            className="group relative flex items-center h-6 rounded px-2 gap-1 cursor-pointer flex-shrink-0"
            style={{
              background: isActive ? 'var(--penma-primary-light)' : 'transparent',
              color: isActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
              transition: 'var(--transition-fast)',
            }}
            onClick={() => switchPage(page.id)}
            onDoubleClick={() => startRename(page.id, page.name)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuId(page.id);
              setContextPos({ x: e.clientX, y: e.clientY });
            }}
          >
            {isEditing ? (
              <input
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-20 bg-transparent text-[11px] font-medium outline-none border-b"
                style={{
                  borderColor: 'var(--penma-primary)',
                  color: 'var(--penma-text)',
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-[11px] font-medium whitespace-nowrap" style={{ fontFamily: 'var(--font-heading)' }}>
                {page.name}
              </span>
            )}

            {/* Close button — only on hover, not for last page */}
            {pages.length > 1 && !isEditing && (
              <button
                className="h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-fast)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  removePage(page.id);
                }}
                title="Remove page"
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}

      {/* Add page button */}
      <button
        className="flex h-6 w-6 items-center justify-center rounded flex-shrink-0 cursor-pointer"
        style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-fast)' }}
        onClick={() => addPage()}
        title="Add page"
      >
        <Plus size={14} />
      </button>

      {/* Context menu */}
      {contextMenuId && (
        <div
          ref={menuRef}
          className="fixed rounded-lg shadow-lg border py-1"
          style={{
            left: contextPos.x,
            top: contextPos.y,
            background: 'var(--penma-surface)',
            borderColor: 'var(--penma-border)',
            zIndex: 'var(--z-dialog)',
            minWidth: 140,
          }}
        >
          <ContextMenuItem
            label="Rename"
            onClick={() => {
              const page = pages.find((p) => p.id === contextMenuId);
              if (page) startRename(page.id, page.name);
            }}
          />
          <ContextMenuItem
            label="Duplicate"
            onClick={() => {
              duplicatePage(contextMenuId);
              setContextMenuId(null);
            }}
          />
          {pages.length > 1 && (
            <>
              <div className="my-1" style={{ borderTop: '1px solid var(--penma-border)' }} />
              <ContextMenuItem
                label="Delete"
                danger
                onClick={() => {
                  removePage(contextMenuId);
                  setContextMenuId(null);
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ContextMenuItem: React.FC<{
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ label, onClick, danger }) => (
  <button
    className="flex w-full items-center px-3 py-1.5 text-[11px] cursor-pointer"
    style={{
      color: danger ? 'var(--penma-danger)' : 'var(--penma-text)',
      transition: 'var(--transition-fast)',
    }}
    onClick={onClick}
    onMouseEnter={(e) => (e.currentTarget.style.background = danger ? '#FEF2F2' : 'var(--penma-hover-bg)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    {label}
  </button>
);
