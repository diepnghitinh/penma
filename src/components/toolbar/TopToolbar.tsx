'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Import,
  Globe,
  Archive,
  ChevronDown,
  PanelLeft,
  PanelRight,
  Palette,
  ArrowLeft,
  Check,
  Loader2,
  Circle,
  Plus,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useEditorStore } from '@/store/editor-store';
import { EditSettingsPopover } from './EditSettingsPopover';

// Tools moved to BottomToolbar

export const TopToolbar: React.FC = () => {
  const camera = useEditorStore((s) => s.camera);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomTo = useEditorStore((s) => s.zoomTo);
  const resetView = useEditorStore((s) => s.resetView);
  const fitToScreen = useEditorStore((s) => s.fitToScreen);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const setShowImportDialog = useEditorStore((s) => s.setShowImportDialog);
  const setShowImportZipDialog = useEditorStore((s) => s.setShowImportZipDialog);
  const documents = useEditorStore((s) => s.documents);
  const addDocument = useEditorStore((s) => s.addDocument);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const togglePanel = useEditorStore((s) => s.togglePanel);
  const openPanels = useEditorStore((s) => s.openPanels);

  // Project state
  const projectId = useEditorStore((s) => s.projectId);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const isSaving = useEditorStore((s) => s.isSaving);
  const isDirty = useEditorStore((s) => s.isDirty);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
    } else {
      setNameValue(projectName);
    }
    setIsEditingName(false);
  };

  // Zoom popover state
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState('');
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const zoomInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showZoomMenu) {
      setZoomInputValue(String(Math.round(camera.zoom * 100)));
      setTimeout(() => {
        zoomInputRef.current?.focus();
        zoomInputRef.current?.select();
      }, 0);
    }
  }, [showZoomMenu, camera.zoom]);

  useEffect(() => {
    if (!showZoomMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setShowZoomMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showZoomMenu]);

  const commitZoomInput = (closeMenu = false) => {
    const val = parseInt(zoomInputValue, 10);
    if (!isNaN(val) && val > 0) {
      zoomTo(Math.max(0.1, Math.min(10, val / 100)));
    }
    if (closeMenu) setShowZoomMenu(false);
  };

  const handleZoomPreset = (level: number) => {
    zoomTo(level);
    setShowZoomMenu(false);
  };

  const handleZoomToFit = () => {
    const docs = useEditorStore.getState().documents;
    if (docs.length === 0) { setShowZoomMenu(false); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of docs) {
      minX = Math.min(minX, d.canvasX);
      minY = Math.min(minY, d.canvasY);
      maxX = Math.max(maxX, d.canvasX + d.viewport.width);
      maxY = Math.max(maxY, d.canvasY + d.viewport.height);
    }
    const canvas = document.querySelector('.penma-canvas');
    const vw = canvas?.clientWidth ?? window.innerWidth;
    const vh = canvas?.clientHeight ?? window.innerHeight;
    fitToScreen({ width: maxX - minX, height: maxY - minY }, { width: vw, height: vh });
    setShowZoomMenu(false);
  };

  const Separator = () => <div className="mx-1.5 h-5 w-px" style={{ background: 'var(--penma-border)' }} />;

  return (
    <div
      className="flex items-center justify-between px-3"
      style={{
        height: 'var(--toolbar-h)',
        background: 'var(--penma-surface)',
        borderBottom: '1px solid var(--penma-border)',
        zIndex: 'var(--z-toolbar)',
      }}
    >
      {/* Left: Logo + Panels + Tools + History */}
      <div className="flex items-center gap-0.5">
        {/* Back + Logo / Project Name */}
        <div className="mr-2 flex items-center gap-2">
          {projectId && (
            <a
              href="/"
              className="flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer"
              style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-base)' }}
              title="Back to projects"
            >
              <ArrowLeft size={16} />
            </a>
          )}
          <a
            href="/"
            className="flex h-7 w-7 items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'var(--penma-primary)' }}
            title="Back to projects"
          >
            <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-heading)' }}>P</span>
          </a>
          {projectId ? (
            isEditingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') { setNameValue(projectName); setIsEditingName(false); }
                }}
                className="h-7 rounded px-1.5 text-sm font-semibold outline-none"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--penma-text)',
                  background: 'var(--penma-bg)',
                  border: '1px solid var(--penma-primary)',
                  width: `${Math.max(nameValue.length * 8, 80)}px`,
                }}
              />
            ) : (
              <span
                className="text-sm font-semibold hidden sm:inline cursor-pointer"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--penma-text)' }}
                onClick={() => setIsEditingName(true)}
                title="Click to rename"
              >
                {projectName}
              </span>
            )
          ) : (
            <span
              className="text-sm font-semibold hidden sm:inline"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--penma-text)' }}
            >
              Penma
            </span>
          )}
        </div>

        <Separator />

        {/* Panel toggles */}
        <button
          onClick={() => togglePanel('layers')}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
          style={{
            color: openPanels.includes('layers') ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: openPanels.includes('layers') ? 'var(--penma-primary-light)' : 'transparent',
            transition: 'var(--transition-base)',
          }}
          title="Toggle Layers Panel"
        >
          <PanelLeft size={16} />
        </button>
        <button
          onClick={() => togglePanel('styles')}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
          style={{
            color: openPanels.includes('styles') ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: openPanels.includes('styles') ? 'var(--penma-primary-light)' : 'transparent',
            transition: 'var(--transition-base)',
          }}
          title="Toggle Styles Panel"
        >
          <PanelRight size={16} />
        </button>
        <button
          onClick={() => togglePanel('design-system')}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
          style={{
            color: openPanels.includes('design-system') ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
            background: openPanels.includes('design-system') ? 'var(--penma-primary-light)' : 'transparent',
            transition: 'var(--transition-base)',
          }}
          title="Toggle Design System"
        >
          <Palette size={16} />
        </button>

        <Separator />

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer disabled:opacity-25 disabled:cursor-default"
          style={{ color: 'var(--penma-text-secondary)', transition: 'var(--transition-base)' }}
          title="Undo (Cmd+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className="flex h-8 w-8 items-center justify-center rounded cursor-pointer disabled:opacity-25 disabled:cursor-default"
          style={{ color: 'var(--penma-text-secondary)', transition: 'var(--transition-base)' }}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Center: Zoom controls */}
      <div className="relative flex items-center gap-0.5">
        <button
          onClick={() => zoomOut()}
          className="flex h-7 w-7 items-center justify-center rounded cursor-pointer"
          style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-base)' }}
          title="Zoom Out (Cmd+-)"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={() => setShowZoomMenu((v) => !v)}
          className="min-w-[52px] rounded px-2 py-1 text-xs font-medium cursor-pointer"
          style={{
            color: 'var(--penma-text-secondary)',
            fontFamily: 'var(--font-mono)',
            transition: 'var(--transition-base)',
          }}
          title="Zoom options"
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button
          onClick={() => zoomIn()}
          className="flex h-7 w-7 items-center justify-center rounded cursor-pointer"
          style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-base)' }}
          title="Zoom In (Cmd+=)"
        >
          <ZoomIn size={15} />
        </button>

        {/* Zoom popover menu */}
        {showZoomMenu && (
          <div
            ref={zoomMenuRef}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 rounded-lg shadow-lg border py-1"
            style={{
              background: 'var(--penma-surface)',
              borderColor: 'var(--penma-border)',
              zIndex: 'var(--z-dialog)',
              minWidth: 200,
            }}
          >
            {/* Editable zoom input */}
            <div className="px-2 py-1.5">
              <input
                ref={zoomInputRef}
                value={zoomInputValue}
                onChange={(e) => setZoomInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitZoomInput(true);
                  if (e.key === 'Escape') setShowZoomMenu(false);
                }}
                onBlur={() => commitZoomInput(false)}
                className="w-full rounded-md px-3 py-1.5 text-sm font-medium outline-none"
                style={{
                  background: 'var(--penma-bg)',
                  color: 'var(--penma-text)',
                  border: '1px solid var(--penma-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
                placeholder="%"
              />
            </div>
            <div className="my-1" style={{ borderTop: '1px solid var(--penma-border)' }} />
            <ZoomMenuItem label="Zoom in" shortcut="⌘+" onClick={() => { zoomIn(); setShowZoomMenu(false); }} />
            <ZoomMenuItem label="Zoom out" shortcut="⌘−" onClick={() => { zoomOut(); setShowZoomMenu(false); }} />
            <ZoomMenuItem label="Zoom to fit" shortcut="⇧1" onClick={handleZoomToFit} />
            <div className="my-1" style={{ borderTop: '1px solid var(--penma-border)' }} />
            <ZoomMenuItem label="Zoom to 50%" onClick={() => handleZoomPreset(0.5)} />
            <ZoomMenuItem label="Zoom to 100%" shortcut="⌘0" onClick={() => handleZoomPreset(1)} />
            <ZoomMenuItem label="Zoom to 200%" onClick={() => handleZoomPreset(2)} />
          </div>
        )}
      </div>

      {/* Right: Save status + Settings + Import/Export */}
      <div className="flex items-center gap-2">
        {projectId && (
          <div className="flex items-center gap-1.5 mr-1 text-xs" style={{ color: 'var(--penma-text-muted)' }}>
            {isSaving ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : isDirty ? (
              <>
                <Circle size={8} fill="currentColor" />
                <span>Unsaved</span>
              </>
            ) : (
              <>
                <Check size={12} style={{ color: 'var(--penma-success, #22c55e)' }} />
                <span>Saved</span>
              </>
            )}
          </div>
        )}
        <EditSettingsPopover />
        <button
          onClick={() => {
            pushHistory('New frame');
            addDocument({
              id: uuid(),
              sourceUrl: 'local://frame',
              importedAt: new Date().toISOString(),
              viewport: { width: 1440, height: 900 },
              rootNode: {
                id: uuid(),
                tagName: 'div',
                attributes: {},
                children: [],
                styles: {
                  computed: { width: '1440px', height: '900px', position: 'relative', 'background-color': '#ffffff' },
                  overrides: {},
                },
                bounds: { x: 0, y: 0, width: 1440, height: 900 },
                visible: true,
                locked: false,
                name: 'Frame',
              },
              assets: {},
              canvasX: 0,
              canvasY: 0,
            });
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium cursor-pointer"
          style={{
            border: '1px solid var(--penma-border)',
            color: 'var(--penma-text-secondary)',
            fontFamily: 'var(--font-body)',
            transition: 'var(--transition-base)',
          }}
          title="New blank frame"
        >
          <Plus size={14} />
          New Frame
        </button>
        <ImportDropdown
          onImportUrl={() => setShowImportDialog(true)}
          onImportZip={() => setShowImportZipDialog(true)}
        />
      </div>
    </div>
  );
};

// ── Zoom menu item ──────────────────────────────────────────

const ZoomMenuItem: React.FC<{ label: string; shortcut?: string; onClick: () => void }> = ({
  label,
  shortcut,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center justify-between px-3 py-1.5 text-sm cursor-pointer text-left"
    style={{
      color: 'var(--penma-text)',
      transition: 'var(--transition-fast)',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-primary-light)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    <span>{label}</span>
    {shortcut && (
      <span className="ml-4 text-xs" style={{ color: 'var(--penma-text-muted)' }}>
        {shortcut}
      </span>
    )}
  </button>
);

// ── Import dropdown ──────────────────────────────────────────

const ImportDropdown: React.FC<{
  onImportUrl: () => void;
  onImportZip: () => void;
}> = ({ onImportUrl, onImportZip }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const toggle = () => {
    const el = popoverRef.current;
    if (!el) return;
    if (open) { el.hidePopover(); setOpen(false); }
    else { el.showPopover(); setOpen(true); }
  };

  // Sync state when popover is dismissed (e.g. click outside, Escape)
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      setOpen((e as ToggleEvent).newState === 'open');
    };
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, []);

  // Position the popover below the button
  useEffect(() => {
    if (!open || !btnRef.current || !popoverRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    popoverRef.current.style.top = `${rect.bottom + 6}px`;
    popoverRef.current.style.left = `${rect.right - popoverRef.current.offsetWidth}px`;
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex h-8 items-center gap-1.5 rounded-lg pl-3.5 pr-2.5 text-xs font-medium text-white cursor-pointer"
        style={{
          background: 'var(--penma-primary)',
          fontFamily: 'var(--font-body)',
          transition: 'var(--transition-base)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-primary-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--penma-primary)')}
      >
        <Import size={14} />
        Import
        <ChevronDown size={12} style={{ opacity: 0.7, marginLeft: 2, transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {/* Popover renders in top layer — above all z-index stacking contexts */}
      <div
        ref={popoverRef}
        popover="auto"
        className="rounded-lg shadow-lg border py-1 m-0"
        style={{
          background: 'var(--penma-surface)',
          borderColor: 'var(--penma-border)',
          minWidth: 190,
          position: 'fixed',
        }}
      >
        <button
          className="flex w-full items-center gap-2.5 px-3 py-2 cursor-pointer text-left"
          style={{ transition: 'var(--transition-fast)' }}
          onClick={() => { onImportUrl(); popoverRef.current?.hidePopover(); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Globe size={15} style={{ color: 'var(--penma-primary)' }} />
          <div>
            <span className="text-xs font-medium block" style={{ color: 'var(--penma-text)' }}>Import URL</span>
            <span className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>Capture a live website</span>
          </div>
        </button>
        <button
          className="flex w-full items-center gap-2.5 px-3 py-2 cursor-pointer text-left"
          style={{ transition: 'var(--transition-fast)' }}
          onClick={() => { onImportZip(); popoverRef.current?.hidePopover(); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Archive size={15} style={{ color: '#8B5CF6' }} />
          <div>
            <span className="text-xs font-medium block" style={{ color: 'var(--penma-text)' }}>Import ZIP</span>
            <span className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>Upload HTML files from a ZIP</span>
          </div>
        </button>
      </div>
    </>
  );
};

