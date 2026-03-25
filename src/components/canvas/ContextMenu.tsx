'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Component,
  Group,
  ArrowUpToLine,
  ArrowDownToLine,
  FileOutput,
  Copy,
  Clipboard,
  ClipboardPaste,
  Scissors,
  CopyPlus,
  Trash2,
  ChevronRight,
  Unlink,
  CopyCheck,
  LocateFixed,
  Link,
  Code2,
  Plus,
  Save,
  X,
  Tag,
  ArrowRightLeft,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { findNodeById, flattenTree } from '@/lib/utils/tree-utils';
import { getEffectiveStyles } from '@/lib/styles/style-resolver';
import type { PenmaNode, PenmaDocument, CssRuleEntry } from '@/types/document';

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

  const [devRuleNode, setDevRuleNode] = useState<PenmaNode | null>(null);
  const [devRuleDoc, setDevRuleDoc] = useState<PenmaDocument | null>(null);

  const close = useCallback(() => { setMenu(null); setSubMenu(null); }, []);

  // ── Actions ──

  const handleCreateComponent = useCallback(() => {
    pushHistory('Create component');
    const store = useEditorStore.getState();
    for (const id of store.selectedIds) {
      store.makeComponent(id);
    }
    close();
  }, [pushHistory, close]);

  const handleCreateRef = useCallback(() => {
    if (!menu) return;
    pushHistory('Create component reference');
    useEditorStore.getState().createComponentRef(menu.nodeId);
    close();
  }, [menu, pushHistory, close]);

  const handleDetachComponent = useCallback(() => {
    if (!menu) return;
    pushHistory('Detach component');
    useEditorStore.getState().detachComponent(menu.nodeId);
    close();
  }, [menu, pushHistory, close]);

  const handleGoToMainComponent = useCallback(() => {
    if (!menu) { close(); return; }
    const store = useEditorStore.getState();
    // Find the instance node to get its componentRef
    let compRef: string | undefined;
    for (const doc of store.documents) {
      const node = findNodeById(doc.rootNode, menu.nodeId);
      if (node?.componentRef) { compRef = node.componentRef; break; }
    }
    if (!compRef) { close(); return; }
    // Find the master node with matching componentId
    for (const doc of store.documents) {
      const allNodes = flattenTree(doc.rootNode);
      const master = allNodes.find((n) => n.componentId === compRef);
      if (master) {
        store.select(master.id);
        const el = document.querySelector(`[data-penma-id="${master.id}"]`);
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
      }
    }
    close();
  }, [menu, close]);

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

  if (!menu && !devRuleNode) return null;

  // Determine component state of the target node
  const targetNode = menu ? (() => {
    for (const doc of documents) {
      const n = findNodeById(doc.rootNode, menu.nodeId);
      if (n) return n;
    }
    return null;
  })() : null;
  const isMaster = !!targetNode?.componentId;
  const isInstance = !!targetNode?.componentRef;

  // Keep menu within viewport
  const menuX = menu ? Math.min(menu.x, window.innerWidth - 200) : 0;
  const menuY = menu ? Math.min(menu.y, window.innerHeight - 320) : 0;
  const otherPages = pages.filter((p) => p.id !== activePageId);

  return (
    <>
      {menu && <div
        ref={menuRef}
        className="fixed rounded-lg shadow-xl border py-1"
        style={{
          left: menuX,
          top: menuY,
          background: 'var(--penma-surface)',
          borderColor: 'var(--penma-border)',
          zIndex: 'var(--z-modal)',
          minWidth: 200,
        }}
      >
        {isInstance ? (
          <>
            <MenuItem icon={LocateFixed} label="Go to main component" onClick={handleGoToMainComponent} />
            <MenuItem icon={Unlink} label="Detach instance" onClick={handleDetachComponent} />
          </>
        ) : isMaster ? (
          <>
            <MenuItem icon={CopyCheck} label="Create reference" onClick={handleCreateRef} />
            <MenuItem icon={Unlink} label="Remove component" onClick={handleDetachComponent} />
          </>
        ) : (
          <MenuItem icon={Component} label="Create component" shortcut="Ctrl+Alt+K" onClick={handleCreateComponent} />
        )}
        <MenuItem icon={Group} label="Group selection" shortcut="Ctrl+G" onClick={handleGroupSelection} />

        <MenuDivider />

        {/* Move to page — submenu */}
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
                zIndex: 'var(--z-modal)',
              }}
            >
              {otherPages.map((page) => (
                <button
                  key={page.id}
                  className="flex w-full items-center px-3 py-1.5 text-[11px] cursor-pointer text-left"
                  style={{ color: 'var(--penma-text)', transition: 'var(--transition-fast)' }}
                  onClick={() => handleMoveToPage(page.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {page.name}
                </button>
              ))}
              {/* New page option */}
              {otherPages.length > 0 && <MenuDivider />}
              <button
                className="flex w-full items-center px-3 py-1.5 text-[11px] cursor-pointer text-left"
                style={{ color: 'var(--penma-primary)', transition: 'var(--transition-fast)' }}
                onClick={() => {
                  pushHistory('Move to new page');
                  useEditorStore.getState().addPage();
                  close();
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                + New page
              </button>
            </div>
          )}
        </div>

        <MenuDivider />

        <MenuItem icon={ArrowUpToLine} label="Bring to front" shortcut="]" onClick={handleBringToFront} />
        <MenuItem icon={ArrowDownToLine} label="Send to back" shortcut="[" onClick={handleSendToBack} />

        <MenuDivider />

        <MenuItem icon={Clipboard} label="Copy" shortcut="Cmd+C" onClick={() => { useEditorStore.getState().copyNodes(); close(); }} />
        <MenuItem icon={Scissors} label="Cut" shortcut="Cmd+X" onClick={() => { useEditorStore.getState().cutNodes(); close(); }} />
        <MenuItem icon={ClipboardPaste} label="Paste" shortcut="Cmd+V" onClick={() => { useEditorStore.getState().pasteNodes(); close(); }} />
        <MenuItem icon={CopyPlus} label="Duplicate" shortcut="Cmd+D" onClick={() => { const s = useEditorStore.getState(); s.copyNodes(); s.pasteNodes(); close(); }} />

        <MenuDivider />

        {/* Share submenu */}
        <div
          className="relative"
          onMouseEnter={() => setSubMenu('share')}
          onMouseLeave={() => setSubMenu(null)}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
            style={{ transition: 'var(--transition-fast)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Link size={14} style={{ color: 'var(--penma-text-secondary)' }} />
            <span className="text-[11px] flex-1" style={{ color: 'var(--penma-text)' }}>Copy / Share</span>
            <ChevronRight size={12} style={{ color: 'var(--penma-text-muted)' }} />
          </div>

          {subMenu === 'share' && (
            <ShareSubMenu
              nodeId={menu.nodeId}
              node={targetNode}
              close={close}
            />
          )}
        </div>

        <MenuDivider />

        {/* Dev submenu */}
        <div
          className="relative"
          onMouseEnter={() => setSubMenu('dev')}
          onMouseLeave={() => setSubMenu(null)}
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
            style={{ transition: 'var(--transition-fast)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Code2 size={14} style={{ color: '#8B5CF6' }} />
            <span className="text-[11px] flex-1" style={{ color: 'var(--penma-text)' }}>Dev</span>
            <ChevronRight size={12} style={{ color: 'var(--penma-text-muted)' }} />
          </div>

          {subMenu === 'dev' && (
            <div
              className="absolute left-full top-0 ml-1 rounded-lg shadow-lg border py-1"
              style={{
                background: 'var(--penma-surface)',
                borderColor: 'var(--penma-border)',
                minWidth: 200,
                zIndex: 'var(--z-modal)',
              }}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 cursor-pointer text-left"
                style={{ transition: 'var(--transition-fast)' }}
                onClick={() => {
                  if (targetNode && menu) {
                    setDevRuleNode(targetNode);
                    // Find the parent document for CSS rules access
                    const docs = useEditorStore.getState().documents;
                    for (const doc of docs) {
                      const found = findNodeById(doc.rootNode, menu.nodeId);
                      if (found) { setDevRuleDoc(doc); break; }
                    }
                    setMenu(null);
                    setSubMenu(null);
                  }
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Plus size={14} style={{ color: '#8B5CF6' }} />
                <span className="text-[11px]" style={{ color: 'var(--penma-text)' }}>Add to Mapping Rules</span>
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 cursor-pointer text-left"
                style={{ transition: 'var(--transition-fast)' }}
                onClick={() => {
                  if (targetNode) {
                    const styles = getEffectiveStyles(targetNode.styles);
                    const info = `Tag: ${targetNode.tagName}\nName: ${targetNode.name || ''}\nClass: ${targetNode.attributes.class || ''}\n\n${Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('\n')}`;
                    navigator.clipboard.writeText(info);
                  }
                  close();
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Copy size={14} style={{ color: 'var(--penma-text-secondary)' }} />
                <span className="text-[11px]" style={{ color: 'var(--penma-text)' }}>Copy node info</span>
              </button>
            </div>
          )}
        </div>

        <MenuItem icon={Trash2} label="Delete" shortcut="Del" danger onClick={handleDelete} />
      </div>}

      {/* Dev: Mapping Rule Dialog (rendered outside menu so it persists after menu closes) */}
      {devRuleNode && (
        <DevMappingRuleDialog node={devRuleNode} document={devRuleDoc} onClose={() => { setDevRuleNode(null); setDevRuleDoc(null); }} />
      )}
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
    className="flex w-full items-center gap-2 px-3 py-1.5 cursor-pointer text-left"
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

// ── Share sub-menu ──────────────────────────────────────────

const ShareSubMenu: React.FC<{
  nodeId: string;
  node: ReturnType<typeof findNodeById> | null;
  close: () => void;
}> = ({ nodeId, node, close }) => {
  const [copied, setCopied] = React.useState<string | null>(null);
  const publicShareId = useEditorStore((s) => s.publicShareId);
  const activePageId = useEditorStore((s) => s.activePageId);

  const copyAndFlash = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => { setCopied(null); close(); }, 800);
  };

  const editorLink = `${window.location.origin}${window.location.pathname}?page=${activePageId}#${nodeId}`;
  const publicLink = publicShareId
    ? `${window.location.origin}/view/${publicShareId}?page=${activePageId}#${nodeId}`
    : null;

  // Build CSS string
  const cssText = (() => {
    const el = document.querySelector(`[data-penma-id="${nodeId}"]`) as HTMLElement | null;
    if (!el) return '';
    const cs = window.getComputedStyle(el);
    const props = ['color', 'background-color', 'font-size', 'font-weight', 'font-family', 'line-height', 'letter-spacing', 'border-radius', 'padding', 'margin', 'width', 'height'];
    return props.map((p) => `${p}: ${cs.getPropertyValue(p)};`).join('\n');
  })();

  const items: { label: string; value: string; icon: React.ElementType }[] = [
    { label: 'Editor link', value: editorLink, icon: Link },
  ];

  if (publicLink) {
    items.push({ label: 'Public link', value: publicLink, icon: Link });
  }

  items.push(
    { label: 'Element ID', value: nodeId, icon: Copy },
    { label: 'Element name', value: node?.name || node?.tagName || nodeId, icon: Copy },
    { label: 'CSS styles', value: cssText, icon: Copy },
  );

  return (
    <div
      className="absolute left-full top-0 ml-1 rounded-lg shadow-lg border py-1"
      style={{
        background: 'var(--penma-surface)',
        borderColor: 'var(--penma-border)',
        minWidth: 180,
        zIndex: 'var(--z-modal)',
      }}
    >
      {items.map((item) => {
        const isCopied = copied === item.label;
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            className="flex w-full items-center gap-2 px-3 py-1.5 cursor-pointer text-left"
            style={{ transition: 'var(--transition-fast)' }}
            onClick={() => copyAndFlash(item.label, item.value)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={14} style={{ color: isCopied ? '#16A34A' : 'var(--penma-text-secondary)' }} />
            <span className="text-[11px] flex-1" style={{ color: isCopied ? '#16A34A' : 'var(--penma-text)' }}>
              {isCopied ? 'Copied!' : item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ── Dev: Mapping Rule Dialog ─────────────────────────────────

const KEY_CSS_PROPS = [
  'display', 'position', 'flex-direction', 'justify-content', 'align-items', 'gap',
  'font-size', 'font-weight', 'font-family', 'line-height', 'color',
  'background-color', 'border-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'width', 'height', 'min-width', 'min-height', 'overflow', 'opacity',
];

function extractNodeMatchData(node: PenmaNode) {
  const styles = getEffectiveStyles(node.styles);
  const cssMatch: Record<string, string> = {};
  for (const prop of KEY_CSS_PROPS) {
    const val = styles[prop];
    if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== 'visible' && val !== '0px' && val !== 'initial') {
      cssMatch[prop] = val;
    }
  }
  // Use stored cssClasses if available, else fall back to class attribute
  const classes = node.cssClasses || node.attributes.class?.split(' ').filter(Boolean) || [];
  return {
    tag: node.tagName,
    cssClasses: classes,
    classPattern: classes.slice(0, 3).join('|'),
    cssMatch,
    hasText: !!node.textContent || node.children.some((c) => !!c.textContent),
  };
}

const DevMappingRuleDialog: React.FC<{ node: PenmaNode; document: PenmaDocument | null; onClose: () => void }> = ({ node, document: parentDoc, onClose }) => {
  const matchData = React.useMemo(() => extractNodeMatchData(node), [node]);

  // Get original CSS rules that matched this node
  const originalRules = React.useMemo(() => {
    if (!parentDoc?.cssRules || !node.matchedCssRules) return [];
    return node.matchedCssRules
      .filter((i) => i < parentDoc.cssRules!.length)
      .map((i) => parentDoc.cssRules![i]);
  }, [parentDoc, node.matchedCssRules]);

  const [name, setName] = useState(node.name || node.tagName);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState(10);

  // Match — pre-filled, editable
  const [matchTag, setMatchTag] = useState(matchData.tag);
  const [matchClassPattern, setMatchClassPattern] = useState(matchData.classPattern);
  const [selectedCssProps, setSelectedCssProps] = useState<Set<string>>(
    () => new Set(Object.keys(matchData.cssMatch)),
  );

  // Transform
  const [trName, setTrName] = useState('');
  const [trSizingH, setTrSizingH] = useState('');
  const [trSizingV, setTrSizingV] = useState('');
  const [trVisible, setTrVisible] = useState<'any' | 'true' | 'false'>('any');

  // Figma
  const [fgNodeType, setFgNodeType] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [tab, setTab] = useState<'match' | 'css' | 'transform' | 'figma'>('match');

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const match: Record<string, unknown> = {};
    if (matchTag) match.tag = matchTag;
    if (matchClassPattern) match.classPattern = matchClassPattern;
    const css: Record<string, string> = {};
    for (const prop of selectedCssProps) {
      if (matchData.cssMatch[prop]) css[prop] = matchData.cssMatch[prop];
    }
    if (Object.keys(css).length > 0) match.cssMatch = css;

    const transform: Record<string, unknown> = {};
    if (trName) transform.name = trName;
    if (trSizingH || trSizingV) {
      const sizing: Record<string, string> = {};
      if (trSizingH) sizing.horizontal = trSizingH;
      if (trSizingV) sizing.vertical = trSizingV;
      transform.sizing = sizing;
    }
    if (trVisible !== 'any') transform.visible = trVisible === 'true';

    const figmaOverrides: Record<string, unknown> = {};
    if (fgNodeType) figmaOverrides.nodeType = fgNodeType;

    try {
      const res = await fetch('/api/admin/mapping-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, enabled: true, priority, category,
          match, transform, figmaOverrides,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleCssProp = (prop: string) => {
    setSelectedCssProps((prev) => {
      const next = new Set(prev);
      if (next.has(prop)) next.delete(prop);
      else next.add(prop);
      return next;
    });
  };

  const CATEGORIES = ['general', 'layout', 'typography', 'color', 'component', 'figma', 'cleanup'];
  const tabColor = { match: '#3B82F6', css: '#22C55E', transform: '#8B5CF6', figma: '#F97316' };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm" style={{ zIndex: 'var(--z-modal-overlay)' }}>
      <div className="w-full max-w-[560px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--penma-surface)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--penma-border)' }}>
          <div className="flex items-center gap-2">
            <Code2 size={16} style={{ color: '#8B5CF6' }} />
            <div>
              <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Add to Mapping Rules</h2>
              <p className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>
                From &lt;{node.tagName}&gt; {node.name ? `\u2014 ${node.name}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer" style={{ color: 'var(--penma-text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          {/* Name / category row */}
          <div className="grid grid-cols-[1fr_120px_80px] gap-2">
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Rule Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="dev-input" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="dev-input cursor-pointer">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Priority</label>
              <input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} className="dev-input font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="dev-input" />
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--penma-bg)' }}>
            {(['match', 'css', 'transform', 'figma'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-medium cursor-pointer"
                style={{
                  background: tab === t ? 'var(--penma-surface)' : 'transparent',
                  color: tab === t ? tabColor[t] : 'var(--penma-text-muted)',
                  boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {t === 'match' && <Tag size={11} />}
                {t === 'css' && <Code2 size={11} />}
                {t === 'transform' && <ArrowRightLeft size={11} />}
                {t === 'figma' && <Sparkles size={11} />}
                {t === 'css' ? `CSS${originalRules.length > 0 ? ` (${originalRules.length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Match tab */}
          {tab === 'match' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>HTML Tag</label>
                  <input value={matchTag} onChange={(e) => setMatchTag(e.target.value)} className="dev-input font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Class Pattern</label>
                  <input value={matchClassPattern} onChange={(e) => setMatchClassPattern(e.target.value)} placeholder="regex" className="dev-input font-mono" />
                </div>
              </div>

              {/* CSS property picker — extracted from element */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>
                  CSS Match <span className="font-normal">(click to toggle)</span>
                </label>
                <div className="rounded-lg p-2 space-y-1 max-h-52 overflow-auto" style={{ background: 'var(--penma-bg)' }}>
                  {Object.entries(matchData.cssMatch).length === 0 ? (
                    <p className="text-[10px] py-2 text-center" style={{ color: 'var(--penma-text-muted)' }}>No significant CSS properties detected</p>
                  ) : (
                    Object.entries(matchData.cssMatch).map(([prop, value]) => {
                      const selected = selectedCssProps.has(prop);
                      return (
                        <button
                          key={prop}
                          onClick={() => toggleCssProp(prop)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left cursor-pointer transition-all"
                          style={{
                            background: selected ? '#F5F3FF' : 'transparent',
                            border: `1px solid ${selected ? '#8B5CF640' : 'transparent'}`,
                          }}
                        >
                          <div
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border flex-shrink-0"
                            style={{
                              borderColor: selected ? '#8B5CF6' : 'var(--penma-border)',
                              background: selected ? '#8B5CF6' : 'transparent',
                            }}
                          >
                            {selected && <span className="text-white text-[8px] leading-none">{'\u2713'}</span>}
                          </div>
                          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#3B82F6', minWidth: 120 }}>{prop}</span>
                          <span className="text-[10px] font-mono truncate" style={{ color: 'var(--penma-text-secondary)' }}>{value}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CSS tab — original stylesheet rules */}
          {tab === 'css' && (
            <div className="space-y-3">
              {/* CSS classes */}
              {matchData.cssClasses.length > 0 && (
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>Classes</label>
                  <div className="flex flex-wrap gap-1">
                    {matchData.cssClasses.map((cls, i) => (
                      <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-mono" style={{ background: '#F0FDF4', color: '#22C55E' }}>
                        .{cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Original CSS rules */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>
                  Original CSS Rules {originalRules.length > 0 && <span className="font-normal">({originalRules.length} matched)</span>}
                </label>
                {originalRules.length === 0 ? (
                  <div className="rounded-lg p-3 text-center text-[10px]" style={{ background: 'var(--penma-bg)', color: 'var(--penma-text-muted)' }}>
                    {parentDoc?.cssRules ? 'No CSS rules matched this element' : 'CSS rules not available — re-import to capture'}
                  </div>
                ) : (
                  <div className="rounded-lg overflow-auto max-h-60" style={{ background: 'var(--penma-bg)' }}>
                    {originalRules.map((rule, i) => (
                      <div key={i} className="border-b px-3 py-2" style={{ borderColor: 'var(--penma-border)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-semibold" style={{ color: '#22C55E' }}>{rule.selector}</span>
                          <span className="text-[9px] font-mono truncate max-w-[120px]" style={{ color: 'var(--penma-text-muted)' }}>
                            {rule.source === 'inline' ? 'inline' : new URL(rule.source).pathname.split('/').pop()}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {Object.entries(rule.declarations).slice(0, 12).map(([prop, val]) => (
                            <div key={prop} className="flex items-center gap-1 text-[9px] font-mono">
                              <span style={{ color: '#3B82F6' }}>{prop}</span>
                              <span style={{ color: 'var(--penma-text-muted)' }}>:</span>
                              <span className="truncate" style={{ color: 'var(--penma-text-secondary)' }}>{val}</span>
                            </div>
                          ))}
                          {Object.keys(rule.declarations).length > 12 && (
                            <span className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>
                              +{Object.keys(rule.declarations).length - 12} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Computed styles summary */}
              <div>
                <label className="block text-[10px] font-semibold mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>Computed Styles (key properties)</label>
                <div className="rounded-lg p-2 space-y-0.5 max-h-32 overflow-auto" style={{ background: 'var(--penma-bg)' }}>
                  {Object.entries(matchData.cssMatch).map(([prop, val]) => (
                    <div key={prop} className="flex items-center gap-1 text-[9px] font-mono">
                      <span style={{ color: '#8B5CF6' }}>{prop}</span>
                      <span style={{ color: 'var(--penma-text-muted)' }}>:</span>
                      <span className="truncate" style={{ color: 'var(--penma-text-secondary)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transform tab */}
          {tab === 'transform' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Node Name</label>
                <input value={trName} onChange={(e) => setTrName(e.target.value)} placeholder="e.g. Button, Card, Hero" className="dev-input" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Sizing</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={trSizingH} onChange={(e) => setTrSizingH(e.target.value)} className="dev-input cursor-pointer">
                    <option value="">H: No change</option>
                    <option value="fixed">H: Fixed</option>
                    <option value="hug">H: Hug</option>
                    <option value="fill">H: Fill</option>
                  </select>
                  <select value={trSizingV} onChange={(e) => setTrSizingV(e.target.value)} className="dev-input cursor-pointer">
                    <option value="">V: No change</option>
                    <option value="fixed">V: Fixed</option>
                    <option value="hug">V: Hug</option>
                    <option value="fill">V: Fill</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Visibility</label>
                <select value={trVisible} onChange={(e) => setTrVisible(e.target.value as 'any' | 'true' | 'false')} className="dev-input cursor-pointer">
                  <option value="any">No change</option>
                  <option value="true">Visible</option>
                  <option value="false">Hidden</option>
                </select>
              </div>
              <p className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>
                For advanced transforms (auto layout, fills, style overrides), edit the rule in <a href="/admin/mapping-rules" target="_blank" className="underline">Admin</a>.
              </p>
            </div>
          )}

          {/* Figma tab */}
          {tab === 'figma' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--penma-text-muted)' }}>Figma Node Type</label>
                <select value={fgNodeType} onChange={(e) => setFgNodeType(e.target.value)} className="dev-input cursor-pointer">
                  <option value="">Auto-detect</option>
                  <option value="FRAME">FRAME</option>
                  <option value="TEXT">TEXT</option>
                  <option value="RECTANGLE">RECTANGLE</option>
                  <option value="VECTOR">VECTOR</option>
                  <option value="COMPONENT">COMPONENT</option>
                  <option value="INSTANCE">INSTANCE</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium" style={{ background: '#FEF2F2', color: '#EF4444' }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium" style={{ background: '#F0FDF4', color: '#22C55E' }}>
              <Save size={12} /> Rule saved!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--penma-border)' }}>
          <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
            <Tag size={10} /> {matchTag || '*'}
            {selectedCssProps.size > 0 && <><span style={{ color: 'var(--penma-border-strong)' }}>|</span> {selectedCssProps.size} CSS</>}
            {trName && <><span style={{ color: '#8B5CF6' }}>{'\u2192'}</span> {trName}</>}
            {fgNodeType && <><span style={{ color: '#F97316' }}>{'\u2192'}</span> {fgNodeType}</>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-1.5 text-[11px] font-medium cursor-pointer"
              style={{ borderColor: 'var(--penma-border)', color: 'var(--penma-text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving || success}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50 cursor-pointer"
              style={{ background: '#8B5CF6' }}
            >
              <Save size={12} />
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>

        <style jsx>{`
          div :global(.dev-input) {
            width: 100%;
            border-radius: 6px;
            border: 1px solid var(--penma-border);
            padding: 5px 8px;
            font-size: 11px;
            color: var(--penma-text);
            background: var(--penma-bg);
            outline: none;
            transition: border-color 150ms;
          }
          div :global(.dev-input:focus) {
            border-color: #8B5CF6;
            box-shadow: 0 0 0 2px #8B5CF610;
          }
          div :global(.dev-input::placeholder) {
            color: var(--penma-text-muted);
          }
        `}</style>
      </div>
    </div>
  );
};

// ── Helper ──────────────────────────────────────────────────

function findNodeName(nodeId: string): string | null {
  const docs = useEditorStore.getState().documents;
  for (const doc of docs) {
    const node = findNodeById(doc.rootNode, nodeId);
    if (node) return node.name || node.tagName;
  }
  return null;
}
