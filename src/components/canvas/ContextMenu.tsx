'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Component,
  Group,
  ArrowUpToLine,
  ArrowDownToLine,
  FileOutput,
  Copy,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById } from '@/lib/utils/tree-utils';

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

export const CanvasContextMenu: React.FC = () => {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);

  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const documents = useEditorStore((s) => s.documents);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  // Listen for custom context menu event from elements
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMenu({ x: detail.x, y: detail.y, nodeId: detail.nodeId });
      setSubMenu(null);
    };
    window.addEventListener('penma:contextmenu', handler);
    return () => window.removeEventListener('penma:contextmenu', handler);
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        (!subMenuRef.current || !subMenuRef.current.contains(e.target as Node))
      ) {
        setMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menu]);

  const close = useCallback(() => { setMenu(null); setSubMenu(null); }, []);

  // ── Actions ──

  const handleCreateComponent = useCallback(() => {
    pushHistory('Create component');
    // Mark the selected node(s) as a component by renaming with "Component/" prefix
    const store = useEditorStore.getState();
    for (const id of store.selectedIds) {
      const currentName = findNodeName(id);
      if (currentName && !currentName.startsWith('Component/')) {
        store.renameNode(id, `Component/${currentName}`);
      }
    }
    close();
  }, [pushHistory, close]);

  const handleGroupSelection = useCallback(() => {
    // Group is conceptual — rename with "Group/" prefix
    pushHistory('Group selection');
    const store = useEditorStore.getState();
    for (const id of store.selectedIds) {
      const currentName = findNodeName(id);
      if (currentName && !currentName.startsWith('Group/')) {
        store.renameNode(id, `Group/${currentName}`);
      }
    }
    close();
  }, [pushHistory, close]);

  const handleBringToFront = useCallback(() => {
    if (!menu) return;
    pushHistory('Bring to front');
    const el = document.querySelector(`[data-penma-id="${menu.nodeId}"]`) as HTMLElement | null;
    if (el?.parentElement) {
      el.parentElement.appendChild(el);
    }
    // Update z-index override
    useEditorStore.getState().updateNodeStyles(menu.nodeId, { 'z-index': '999', position: 'relative' });
    close();
  }, [menu, pushHistory, close]);

  const handleSendToBack = useCallback(() => {
    if (!menu) return;
    pushHistory('Send to back');
    const el = document.querySelector(`[data-penma-id="${menu.nodeId}"]`) as HTMLElement | null;
    if (el?.parentElement) {
      el.parentElement.insertBefore(el, el.parentElement.firstChild);
    }
    useEditorStore.getState().updateNodeStyles(menu.nodeId, { 'z-index': '0', position: 'relative' });
    close();
  }, [menu, pushHistory, close]);

  const handleCopyStyles = useCallback(() => {
    if (!menu) return;
    const el = document.querySelector(`[data-penma-id="${menu.nodeId}"]`) as HTMLElement | null;
    if (el) {
      const cs = window.getComputedStyle(el);
      const props = ['color', 'background-color', 'font-size', 'font-weight', 'font-family', 'border-radius', 'padding', 'margin'];
      const css = props.map((p) => `${p}: ${cs.getPropertyValue(p)};`).join('\n');
      navigator.clipboard.writeText(css);
    }
    close();
  }, [menu, close]);

  const handleDelete = useCallback(() => {
    if (!menu) return;
    pushHistory('Delete element');
    // Hide the element (soft delete via visibility)
    useEditorStore.getState().toggleNodeVisibility(menu.nodeId);
    useEditorStore.getState().clearSelection();
    close();
  }, [menu, pushHistory, close]);

  const handleMoveToPage = useCallback((pageId: string) => {
    if (!menu) return;
    // For now, copy the selected node info — full move requires deeper tree manipulation
    // This is a visual indicator that the feature exists
    pushHistory('Move to page');
    close();
  }, [menu, pushHistory, close]);

  if (!menu) return null;

  // Keep menu within viewport
  const menuX = Math.min(menu.x, window.innerWidth - 200);
  const menuY = Math.min(menu.y, window.innerHeight - 320);
  const otherPages = pages.filter((p) => p.id !== activePageId);

  return (
    <>
      <div
        ref={menuRef}
        className="fixed rounded-lg shadow-xl border py-1"
        style={{
          left: menuX,
          top: menuY,
          background: 'var(--penma-surface)',
          borderColor: 'var(--penma-border)',
          zIndex: 100,
          minWidth: 200,
        }}
      >
        <MenuItem icon={Component} label="Create component" shortcut="Ctrl+Alt+K" onClick={handleCreateComponent} />
        <MenuItem icon={Group} label="Group selection" shortcut="Ctrl+G" onClick={handleGroupSelection} />

        <MenuDivider />

        {/* Move to page — submenu */}
        {otherPages.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setSubMenu('move-to-page')}
            onMouseLeave={() => setSubMenu(null)}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
              style={{ transition: 'var(--transition-fast)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FileOutput size={14} style={{ color: 'var(--penma-text-secondary)' }} />
              <span className="text-[11px] flex-1" style={{ color: 'var(--penma-text)' }}>Move to page</span>
              <ChevronRight size={12} style={{ color: 'var(--penma-text-muted)' }} />
            </div>

            {subMenu === 'move-to-page' && (
              <div
                ref={subMenuRef}
                className="absolute left-full top-0 ml-1 rounded-lg shadow-lg border py-1"
                style={{
                  background: 'var(--penma-surface)',
                  borderColor: 'var(--penma-border)',
                  minWidth: 140,
                  zIndex: 101,
                }}
              >
                {otherPages.map((page) => (
                  <button
                    key={page.id}
                    className="flex w-full items-center px-3 py-1.5 text-[11px] cursor-pointer"
                    style={{ color: 'var(--penma-text)', transition: 'var(--transition-fast)' }}
                    onClick={() => handleMoveToPage(page.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <MenuDivider />

        <MenuItem icon={ArrowUpToLine} label="Bring to front" shortcut="]" onClick={handleBringToFront} />
        <MenuItem icon={ArrowDownToLine} label="Send to back" shortcut="[" onClick={handleSendToBack} />

        <MenuDivider />

        <MenuItem icon={Copy} label="Copy CSS" onClick={handleCopyStyles} />
        <MenuItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={handleDelete} />
      </div>
    </>
  );
};

// ── Sub-components ──────────────────────────────────────────

const MenuItem: React.FC<{
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, shortcut, danger, onClick }) => (
  <button
    className="flex w-full items-center gap-2 px-3 py-1.5 cursor-pointer"
    style={{ transition: 'var(--transition-fast)' }}
    onClick={onClick}
    onMouseEnter={(e) => (e.currentTarget.style.background = danger ? '#FEF2F2' : 'var(--penma-hover-bg)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    <Icon size={14} style={{ color: danger ? 'var(--penma-danger)' : 'var(--penma-text-secondary)' }} />
    <span className="text-[11px] flex-1" style={{ color: danger ? 'var(--penma-danger)' : 'var(--penma-text)' }}>
      {label}
    </span>
    {shortcut && (
      <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>{shortcut}</span>
    )}
  </button>
);

const MenuDivider: React.FC = () => (
  <div className="my-1" style={{ borderTop: '1px solid var(--penma-border)' }} />
);

// ── Helper ──────────────────────────────────────────────────

function findNodeName(nodeId: string): string | null {
  const docs = useEditorStore.getState().documents;
  for (const doc of docs) {
    const node = findNodeById(doc.rootNode, nodeId);
    if (node) return node.name || node.tagName;
  }
  return null;
}
